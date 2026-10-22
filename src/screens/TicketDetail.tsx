import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Link2, Share, Sun, Trash2, X } from 'lucide-react'
import { db, deleteTicket, type Media, type Ticket, type TicketCode } from '../lib/db'
import { fileSize, pl, stampDow } from '../lib/format'
import { TICKET_PAL } from '../lib/palette'
import { useBlobUrl, useMedia, useWakeLock } from '../lib/hooks'
import { DEMO_QR } from '../lib/demo'
import { Menu } from '../components/Menu'
import { Portal } from '../components/Portal'
import { PhotoViewer } from '../components/PhotoViewer'
import { KIND } from './Tickets'
import { useUI } from '../store/ui'

function Page({ id, onOpen }: { id: string; onOpen: () => void }) {
  const m = useMedia(id)
  const url = useBlobUrl(m?.blob)
  return (
    <button onClick={onOpen} style={{ display: 'block', width: '100%' }} aria-label="Открыть на весь экран">
      {url ? <img src={url} alt="Билет" style={{ display: 'block', width: '100%', maxHeight: '62dvh', objectFit: 'contain', borderRadius: 10 }} /> : <div style={{ height: 300 }} />}
    </button>
  )
}

/** Look for barcodes on tickets saved before codes were detected (or when detection failed at import). */
function useCodes(t: Ticket | null | undefined) {
  useEffect(() => {
    if (!t || t.codes || !t.pageIds.length) return
    let live = true
    ;(async () => {
      const pages = (await db.media.bulkGet(t.pageIds)).filter(Boolean).map((m) => m!.blob)
      const { findCodes } = await import('../lib/barcodes')
      const codes = await findCodes(pages)
      if (live) await db.tickets.update(t.id, { codes })
    })().catch((e) => console.warn('barcode search failed', e))
    return () => {
      live = false
    }
  }, [t])
}

function useCodeImage(t: Ticket, i: number, file?: Media) {
  const code = t.codes![i]
  const page = useMedia(t.pageIds[code.page])
  const [blob, setBlob] = useState<Blob | null>(null)
  const pdf = file && file.blob.type === 'application/pdf' ? file.blob : undefined
  useEffect(() => {
    if (!page) return
    let live = true
    import('../lib/barcodes')
      .then((m) => m.cropCode(`${t.id}:${i}:${code.text}:${pdf ? 'pdf' : 'img'}`, code, page.blob, pdf))
      .then((b) => live && setBlob(b), (e) => console.warn('code crop failed', e))
    return () => {
      live = false
    }
  }, [t.id, i, code, page, pdf])
  return { url: useBlobUrl(blob), sharp: !!pdf, code }
}

const showText = (c: TicketCode) => c.text.length <= 32 && /^[\x20-\x7e]+$/.test(c.text)

/** One code, big, on the white part of the stub. */
function CodeView({ t, i, file, onOpen }: { t: Ticket; i: number; file?: Media; onOpen: () => void }) {
  const { url, sharp, code } = useCodeImage(t, i, file)
  return (
    <button onClick={onOpen} aria-label="Показать код на весь экран" data-testid="ticket-code" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
      <div style={{ width: '100%', maxWidth: code.linear ? '100%' : 280, minHeight: url ? undefined : code.linear ? 110 : 280 }}>
        {url ? <img src={url} alt="Штрихкод билета" style={{ display: 'block', width: '100%', height: 'auto', imageRendering: sharp ? 'auto' : 'pixelated' }} /> : null}
      </div>
      {showText(code) && <div className="mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em', color: 'rgba(22,19,26,.65)', overflowWrap: 'anywhere' }}>{code.text}</div>}
    </button>
  )
}

/** Full screen, white, as large as possible — for the scanner at the gate. */
function CodeFullscreen({ t, i, file, onClose }: { t: Ticket; i: number; file?: Media; onClose: () => void }) {
  const { url, sharp, code } = useCodeImage(t, i, file)
  return (
    <Portal>
      <div role="dialog" aria-label="Код билета" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: '#fff', color: '#16131A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 16px', animation: 'enc-fade .2s ease-out' }}>
        <button aria-label="Закрыть" onClick={onClose} style={{ position: 'absolute', top: 'calc(var(--sat) + 12px)', right: 16, width: 44, height: 44, borderRadius: 22, background: 'rgba(22,19,26,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16131A' }}><X size={22} /></button>
        {url && <img src={url} alt="Штрихкод билета" style={{ display: 'block', width: '100%', maxWidth: code.linear ? 'none' : 'min(100%, 70dvh)', maxHeight: '70dvh', objectFit: 'contain', imageRendering: sharp ? 'auto' : 'pixelated' }} />}
        {showText(code) && <div className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: '.14em', overflowWrap: 'anywhere', textAlign: 'center' }}>{code.text}</div>}
        <div style={{ font: '500 13px var(--sans)', color: 'rgba(22,19,26,.5)' }}>{t.artist}{t.seat.length ? ' · ' + t.seat.map((s) => `${s.k} ${s.v}`).join(' · ') : ''}</div>
      </div>
    </Portal>
  )
}

export default function TicketDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from
  const say = useUI((s) => s.say)
  const t = useLiveQuery(() => db.tickets.get(id!), [id])
  const file = useMedia(t?.fileId)
  const [page, setPage] = useState(0)
  const [viewer, setViewer] = useState(false)
  const [codeIdx, setCodeIdx] = useState(0)
  const [bigCode, setBigCode] = useState(false)
  const awake = useWakeLock(!!t)
  useCodes(t)

  if (t === undefined) return null
  if (!t) {
    return (
      <div className="screen empty">
        <div className="empty-title">Билет не найден</div>
        <div className="empty-actions"><button className="btn btn-secondary" onClick={() => nav('/tickets')}>К билетам</button></div>
      </div>
    )
  }

  const p = TICKET_PAL[t.palette % TICKET_PAL.length]
  const k = KIND[t.kind]
  const pages = t.pageIds
  const codes = t.codes || []
  const ci = Math.min(codeIdx, Math.max(0, codes.length - 1))
  // with codes found, the pager steps through codes; otherwise through pages
  const count = codes.length || pages.length
  const at = codes.length ? ci : page
  const go = (d: number) => (codes.length ? setCodeIdx((x) => Math.max(0, Math.min(codes.length - 1, x + d))) : setPage((x) => Math.max(0, Math.min(pages.length - 1, x + d))))
  const openPages = () => {
    if (codes.length) setPage(codes[ci].page)
    setViewer(true)
  }
  const back = () => (from ? nav(-1) : nav('/tickets'))

  const share = async () => {
    try {
      const pageMedia = !file && pages[page] ? await db.media.get(pages[page]) : undefined
      const blob = file?.blob || pageMedia?.blob
      if (blob && navigator.canShare) {
        const name = t.fileName && file ? t.fileName : `${t.artist}.${blob.type.includes('png') ? 'png' : 'jpg'}`
        const f = new File([blob], name, { type: blob.type })
        if (navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], title: t.artist })
      }
      const text = `Билет: ${t.artist} — ${t.venue}, ${stampDow(t.date).toLowerCase()}`
      if (navigator.share) await navigator.share({ title: t.artist, text })
      else {
        await navigator.clipboard.writeText(text)
        say('Скопировано')
      }
    } catch {
      /* cancelled */
    }
  }

  const openOriginal = () => {
    if (!file) return
    const url = URL.createObjectURL(file.blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const remove = async () => {
    if (!confirm('Удалить билет? Файл тоже удалится с устройства.')) return
    await deleteTicket(t)
    say('Билет удалён')
    nav('/tickets', { replace: true })
  }

  const linked = t.eventId ? `/event/${t.eventId}` : t.memoryId ? `/memory/${t.memoryId}` : null
  const info = [t.fileName, pages.length > 1 && pl(pages.length, ['страница', 'страницы', 'страниц']), fileSize(t.fileSize)].filter(Boolean).join(' · ')

  return (
    <div className="screen" style={{ paddingBottom: 'calc(30px + var(--sab))' }}>
      <div style={{ padding: 'calc(var(--sat) + 8px) 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="nav-link" style={{ color: 'var(--mag)' }} onClick={back}><ChevronLeft size={22} />Назад</button>
        <div style={{ paddingRight: 8, display: 'flex', gap: 8 }}>
          <button className="icon-btn" aria-label="Поделиться" onClick={share}><Share size={19} /></button>
          <Menu items={[
            { label: 'Изменить привязку', icon: <Link2 size={18} />, onClick: () => nav(`/tickets/assign?ticket=${t.id}`) },
            { label: 'Удалить билет', icon: <Trash2 size={18} />, danger: true, onClick: remove },
          ]} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 15, background: 'rgba(255,179,71,.14)', color: '#F2A33A', font: '600 12px var(--sans)', boxShadow: '0 0 24px -4px rgba(255,179,71,.45)' }}>
          <Sun size={15} />
          {awake ? 'Экран не погаснет' : 'Прибавьте яркость для сканера'}
        </div>
      </div>

      <div style={{ margin: '14px 20px 0', borderRadius: 26, boxShadow: `0 30px 60px -30px ${p.glow}` }}>
        <div style={{ position: 'relative', padding: '20px 20px 26px', borderRadius: '26px 26px 0 0', color: '#fff', overflow: 'hidden', background: p.bg }}>
          <div className="grain" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '500 10px var(--mono)', letterSpacing: '.18em', opacity: 0.85 }}>ВХОДНОЙ БИЛЕТ</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: 'rgba(0,0,0,.25)', font: '600 10px var(--mono)' }}><k.Icon size={13} />{k.label}</div>
          </div>
          <div className="display" style={{ fontSize: 46, lineHeight: 0.92, marginTop: 12, overflowWrap: 'anywhere' }}>{t.artist}</div>
          {t.tour && <div style={{ font: '500 13px var(--sans)', opacity: 0.88, marginTop: 4 }}>{t.tour}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div><div style={{ font: '500 9px var(--mono)', letterSpacing: '.16em', opacity: 0.7 }}>ДАТА</div><div style={{ font: '700 14px var(--sans)', marginTop: 3 }}>{stampDow(t.date)}{t.time ? `, ${t.time}` : ''}</div></div>
            <div style={{ minWidth: 0 }}><div style={{ font: '500 9px var(--mono)', letterSpacing: '.16em', opacity: 0.7 }}>ПЛОЩАДКА</div><div style={{ font: '700 14px var(--sans)', marginTop: 3 }}>{t.venue}</div></div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 0 }}>
          <div style={{ position: 'absolute', left: -12, top: -12, width: 24, height: 24, borderRadius: 12, background: 'var(--bg)', zIndex: 2 }} />
          <div style={{ position: 'absolute', right: -12, top: -12, width: 24, height: 24, borderRadius: 12, background: 'var(--bg)', zIndex: 2 }} />
          <div style={{ position: 'absolute', left: 18, right: 18, top: -1, borderTop: '2px dashed rgba(22,19,26,.25)', zIndex: 2 }} />
        </div>
        <div style={{ padding: '22px 16px 20px', borderRadius: '0 0 26px 26px', background: '#F7F4EE', color: '#16131A' }}>
          {codes.length > 0 ? (
            <>
              <CodeView key={ci} t={t} i={ci} file={file} onOpen={() => setBigCode(true)} />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button onClick={openPages} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 12px var(--sans)', color: 'rgba(22,19,26,.55)', padding: '6px 10px' }}><FileText size={14} />Весь билет</button>
              </div>
            </>
          ) : pages.length > 0 ? (
            <Page key={pages[page]} id={pages[page]} onOpen={() => setViewer(true)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 14, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(25,1fr)', width: 190, height: 190 }}>
                  {DEMO_QR.map((on, i) => <div key={i} style={{ background: on ? '#141218' : 'transparent' }} />)}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.14em', color: 'rgba(22,19,26,.6)' }}>{t.code || 'ДЕМО-БИЛЕТ'}</div>
            </div>
          )}
          {t.seat.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, t.seat.length)},1fr)`, gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(22,19,26,.1)' }}>
              {t.seat.slice(0, 3).map((s) => (
                <div key={s.k} style={{ textAlign: 'center', minWidth: 0 }}>
                  <div style={{ font: '500 9px var(--mono)', letterSpacing: '.16em', color: 'rgba(22,19,26,.5)' }}>{s.k}</div>
                  <div className="display ellipsis" style={{ fontSize: s.v.length > 5 ? 18 : 26, lineHeight: 1.1, marginTop: s.v.length > 5 ? 8 : 4 }}>{s.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {count > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 14 }}>
          <button aria-label="Предыдущая" onClick={() => go(-1)} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx2)' }}><ChevronLeft size={22} /></button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {Array.from({ length: count }, (_, i) => <div key={i} style={{ height: 6, borderRadius: 3, transition: 'width .25s', width: i === at ? 18 : 6, background: i === at ? 'var(--tx)' : 'var(--line2)' }} />)}
            </div>
            <span className="mono-label" style={{ fontSize: 10 }}>{codes.length ? 'КОД' : 'СТР.'} {at + 1} ИЗ {count}</span>
          </div>
          <button aria-label="Следующая" onClick={() => go(1)} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx2)' }}><ChevronRight size={22} /></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: file || pages.length ? '1fr 1.4fr' : '1fr', gap: 10, padding: '16px 20px 0' }}>
        {linked ? (
          <button className="btn btn-secondary" style={{ height: 56 }} onClick={() => nav(linked)}><Link2 size={18} />{t.eventId ? 'К концерту' : 'К воспоминанию'}</button>
        ) : (
          <button className="btn btn-secondary" style={{ height: 56 }} onClick={() => nav(`/tickets/assign?ticket=${t.id}`)}><Link2 size={18} />Привязать</button>
        )}
        {file ? (
          <button className="btn btn-primary" style={{ height: 56, fontSize: 16 }} onClick={openOriginal}><ExternalLink size={19} />Открыть оригинал</button>
        ) : pages.length > 0 ? (
          <button className="btn btn-primary" style={{ height: 56, fontSize: 16 }} onClick={openPages}><FileText size={19} />Весь билет</button>
        ) : null}
      </div>
      {info && <div className="mono" style={{ textAlign: 'center', fontSize: 10, fontWeight: 500, letterSpacing: '.1em', color: 'var(--tx3)', padding: '16px 20px 0', textTransform: 'uppercase' }}>{info}</div>}

      {bigCode && codes.length > 0 && <CodeFullscreen t={t} i={ci} file={file} onClose={() => setBigCode(false)} />}
      {viewer && <PhotoViewer ids={pages} start={page} onClose={() => setViewer(false)} />}
    </div>
  )
}
