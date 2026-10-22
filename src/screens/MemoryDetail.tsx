import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ImagePlus, MapPin, Pencil, Play, Plus, Share, Trash2 } from 'lucide-react'
import { db, deleteMemory } from '../lib/db'
import { RATING_LABELS, pl, stampDow } from '../lib/format'
import { Cover } from '../components/Cover'
import { Avatar, Label, Stars, Tag } from '../components/ui'
import { Menu } from '../components/Menu'
import { PhotoViewer } from '../components/PhotoViewer'
import { AttachTicket, TicketStub } from '../components/TicketStub'
import { useMedia } from '../lib/hooks'
import { useUI } from '../store/ui'
import { FriendPhotosSection } from '../components/FriendPhotosSection'

function GalleryTile({ id, palette, i, more, big, onOpen }: { id: string; palette: number; i: number; more: number; big: boolean; onOpen: () => void }) {
  const m = useMedia(id)
  return (
    <Cover id={id} palette={palette} shift={i} onClick={onOpen} style={{ borderRadius: 14, cursor: 'pointer', gridColumn: big ? 'span 2' : undefined, gridRow: big ? 'span 2' : undefined }}>
      {m?.kind === 'video' && (
        <div style={{ position: 'absolute', left: 6, bottom: 6, display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 8, background: 'rgba(0,0,0,.5)', color: '#fff' }}>
          <Play size={14} fill="#fff" />
        </div>
      )}
      {more > 0 && (
        <div className="display" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', background: 'rgba(0,0,0,.35)' }}>+{more}</div>
      )}
    </Cover>
  )
}

export default function MemoryDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { openSheet, say } = useUI()
  const m = useLiveQuery(() => db.memories.get(id!), [id])
  const ticket = useLiveQuery(() => db.tickets.where('memoryId').equals(id!).first(), [id])
  const venueCount = useLiveQuery(async () => (m ? db.memories.where('venue').equals(m.venue).count() : 0), [m?.venue])
  const [viewer, setViewer] = useState<number | null>(null)

  const tiles = useMemo(() => (m ? m.mediaIds.slice(0, 6) : []), [m])

  if (m === undefined) return null
  if (m === null || !m) {
    return (
      <div className="screen empty">
        <div className="empty-title">Воспоминание не найдено</div>
        <div className="empty-actions"><button className="btn btn-secondary" onClick={() => nav('/')}>К ленте</button></div>
      </div>
    )
  }

  const share = async () => {
    const text = `${m.artist} — ${m.venue}, ${stampDow(m.date).toLowerCase()}${m.rating ? ' ' + '★'.repeat(m.rating) : ''}`
    try {
      if (navigator.share) await navigator.share({ title: m.artist, text })
      else {
        await navigator.clipboard.writeText(text)
        say('Скопировано')
      }
    } catch {
      /* cancelled */
    }
  }

  const remove = async () => {
    if (!confirm(`Удалить воспоминание «${m.artist}»? Фото тоже удалятся.`)) return
    await deleteMemory(m)
    nav('/', { replace: true })
    say('Воспоминание удалено')
  }

  const setlistMain = m.encoreAt === null ? m.setlist : m.setlist.slice(0, m.encoreAt)
  // Encore friends first, then names typed by hand
  const company = [...(m.friends || []).map((f) => f.name), ...m.people]
  const companyAvatars = [...(m.friends || []).map((f) => f.avatar), ...m.people.map(() => undefined)]

  return (
    <div className="screen" style={{ paddingBottom: 'calc(40px + var(--sab))' }}>
      <Cover id={m.coverId || m.mediaIds[0]} palette={m.palette} full style={{ height: 470 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,8,12,.5) 0%,transparent 24%,transparent 42%,rgba(8,8,12,.9) 100%)' }} />
        <div style={{ position: 'absolute', top: 'calc(var(--sat) + 12px)', left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button className="glass-btn" aria-label="Назад" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))}><ChevronLeft size={24} /></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="glass-btn" aria-label="Поделиться" onClick={share}><Share size={19} /></button>
            <Menu glass items={[
              { label: 'Редактировать', icon: <Pencil size={18} />, onClick: () => nav(`/memory/${m.id}/edit`) },
              { label: 'Удалить', icon: <Trash2 size={18} />, danger: true, onClick: remove },
            ]} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 46, color: '#fff' }}>
          {m.tour && <div style={{ font: '500 11px var(--mono)', letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.85 }}>{m.tour}</div>}
          <div className="display" style={{ fontSize: 66, lineHeight: 0.9, marginTop: 8, textWrap: 'balance', overflowWrap: 'anywhere' }}>{m.artist}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <div className="stamp">{stampDow(m.date)}{m.time ? ` · ${m.time}` : ''}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 14px var(--sans)', opacity: 0.9 }}>
              <MapPin size={16} color="#FF7AB0" fill="#FF7AB0" stroke="rgba(8,8,12,.9)" />
              {m.venue}
            </div>
          </div>
        </div>
      </Cover>

      <div style={{ position: 'relative', marginTop: -26, borderRadius: '28px 28px 0 0', background: 'var(--bg)', padding: '22px 20px 20px', display: 'flex', flexDirection: 'column', gap: 30 }}>
        {m.genres.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {m.genres.map((g, i) => <Tag key={g} label={g} i={i} />)}
          </div>
        )}

        <div className="section">
          <Label right={m.mediaIds.length > 0 && <button className="link" onClick={() => setViewer(0)}>Все {m.mediaIds.length}</button>}>Фото и видео</Label>
          {tiles.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: 108, gap: 6 }}>
              {tiles.map((mid, i) => (
                <GalleryTile key={mid} id={mid} palette={m.palette} i={i} big={i === 0 && tiles.length >= 3} more={i === 5 ? m.mediaIds.length - 6 : 0} onOpen={() => setViewer(i)} />
              ))}
            </div>
          ) : (
            <button className="dashed-btn" onClick={() => nav(`/memory/${m.id}/edit`)}><ImagePlus size={20} />Добавить фото с концерта</button>
          )}
        </div>

        <FriendPhotosSection m={m} />

        <div className="section">
          <Label>Площадка</Label>
          <button className="card" onClick={() => nav(`/?q=${encodeURIComponent(m.venue)}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 15px var(--sans)' }}>{m.venue}</div>
              <div style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>
                {venueCount && venueCount > 1 ? `Вы были здесь ${pl(venueCount, ['раз', 'раза', 'раз'])}` : 'Первый концерт здесь'}
              </div>
            </div>
            <ChevronRight size={20} color="var(--tx3)" />
          </button>
        </div>

        {m.setlist.length > 0 && (
          <div className="section">
            <Label right={<span style={{ font: '500 12px var(--sans)', color: 'var(--tx3)' }}>{pl(m.setlist.length, ['песня', 'песни', 'песен'])}</span>}>Сет-лист</Label>
            <div className="card" style={{ padding: '6px 0' }}>
              {setlistMain.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' }}>
                  <span className="mono" style={{ width: 20, fontSize: 12, color: 'var(--tx3)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ font: '500 15px var(--sans)' }}>{s}</span>
                </div>
              ))}
              {m.encoreAt !== null && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 4px' }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.2em', color: 'var(--mag)' }}>НА БИС</span>
                    <div style={{ flex: 1, borderTop: '1.5px dashed var(--line2)' }} />
                  </div>
                  {m.setlist.slice(m.encoreAt).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' }}>
                      <span className="mono" style={{ width: 20, fontSize: 12, color: 'var(--tx3)' }}>{String(m.encoreAt! + i + 1).padStart(2, '0')}</span>
                      <span style={{ font: '500 15px var(--sans)' }}>{s}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <div className="section">
          <Label right={<button className="link" onClick={() => nav(`/memory/${m.id}/edit`)}>Изменить</button>}>Мои заметки</Label>
          <div className="card" style={{ padding: 18 }}>
            <div className="display grad-text" style={{ fontSize: 44, lineHeight: 0.6, height: 22, textTransform: 'none' }}>“</div>
            <div style={{ font: '400 16px/1.55 var(--sans)', textWrap: 'pretty', whiteSpace: 'pre-wrap', color: m.notes ? 'var(--tx)' : 'var(--tx3)' }}>
              {m.notes || 'Момент, который хочется запомнить…'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="mono-label">Оценка</span>
            <Stars value={m.rating} size={22} off="var(--tx3)" />
            <span style={{ font: '600 14px var(--sans)' }}>{m.rating ? RATING_LABELS[m.rating] : 'Без оценки'}</span>
          </div>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <span className="mono-label">С кем ходили</span>
            <div style={{ display: 'flex' }}>
              {company.slice(0, 4).map((p, i) => <Avatar key={p + i} name={p} src={companyAvatars[i]} style={{ marginRight: -8, border: '2px solid var(--s1)' }} />)}
              <button aria-label="Добавить" onClick={() => nav(`/memory/${m.id}/edit`)} style={{ width: 36, height: 36, borderRadius: 18, border: '1.5px dashed var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: company.length ? 14 : 0 }}>
                <Plus size={18} color="var(--tx3)" />
              </button>
            </div>
            <span className="ellipsis" style={{ font: '500 13px var(--sans)', color: 'var(--tx2)' }}>{company.length ? company.join(', ') : 'Пока никого'}</span>
          </div>
        </div>

        <div className="section">
          <Label>Билет</Label>
          {ticket ? (
            <TicketStub t={ticket} from={`/memory/${m.id}`} />
          ) : (
            <AttachTicket label="Прикрепить корешок билета" onClick={() => openSheet('ticket', { memoryId: m.id })} />
          )}
        </div>
      </div>

      {viewer !== null && <PhotoViewer ids={m.mediaIds} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
