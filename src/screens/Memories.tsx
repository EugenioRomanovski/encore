import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Images, MapPin, Search, X } from 'lucide-react'
import { db, type Memory } from '../lib/db'
import { pl, stamp, year } from '../lib/format'
import { glow } from '../lib/palette'
import { hasOwnConcerts, loadDemo } from '../lib/demo'
import { Cover } from '../components/Cover'
import { Stars, TicketArt } from '../components/ui'
import { ShareInbox } from '../components/ShareInbox'

function matches(m: Memory, q: string) {
  const s = q.toLowerCase().replace(/ё/g, 'е')
  return [m.artist, m.venue, m.tour, m.notes, ...m.genres, ...m.people]
    .filter(Boolean)
    .some((x) => x!.toLowerCase().replace(/ё/g, 'е').includes(s))
}

function MemoryCard({ m }: { m: Memory }) {
  const nav = useNavigate()
  const n = m.mediaIds.length
  return (
    <Cover
      id={m.coverId || m.mediaIds[0]}
      palette={m.palette}
      onClick={() => nav(`/memory/${m.id}`)}
      style={{ height: 340, borderRadius: 20, cursor: 'pointer', boxShadow: `0 22px 44px -26px ${glow(m.palette)}` }}
    >
      {n > 0 && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 14, background: 'rgba(10,10,14,.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#fff', font: '600 12px var(--sans)' }}>
          <Images size={15} />
          {n}
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '90px 18px 18px', background: 'linear-gradient(180deg,transparent,rgba(8,8,12,.92))', color: '#fff' }}>
        {m.rating > 0 && <div style={{ marginBottom: 8 }}><Stars value={m.rating} /></div>}
        <div className="display" style={{ fontSize: 44, lineHeight: 0.94, textWrap: 'balance' }}>{m.artist}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 14px var(--sans)', color: 'rgba(255,255,255,.85)', minWidth: 0 }}>
            <MapPin size={16} color="#FF7AB0" fill="#FF7AB0" stroke="rgba(8,8,12,.9)" style={{ flex: 'none' }} />
            <span className="ellipsis">{m.venue}</span>
          </div>
          <div className="stamp">{stamp(m.date)}</div>
        </div>
      </div>
    </Cover>
  )
}

export default function Memories() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [searchOpen, setSearchOpen] = useState(!!q)
  const [yr, setYr] = useState<string>('all')
  const all = useLiveQuery(() => db.memories.orderBy('date').reverse().toArray(), [])
  const own = useLiveQuery(hasOwnConcerts, [])
  const hdr = useRef<HTMLDivElement>(null)
  const [hdrH, setHdrH] = useState(150)

  useLayoutEffect(() => {
    const el = hdr.current
    if (!el) return
    const ro = new ResizeObserver(() => setHdrH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [all === undefined])

  useEffect(() => {
    if (q) setSearchOpen(true)
  }, [q])

  const years = useMemo(() => Array.from(new Set((all || []).map((m) => String(year(m.date))))), [all])
  const list = useMemo(() => (all || []).filter((m) => (!q || matches(m, q)) && (yr === 'all' || String(year(m.date)) === yr)), [all, q, yr])
  const groups = useMemo(() => {
    const g: { year: string; items: Memory[] }[] = []
    for (const m of list) {
      const y = String(year(m.date))
      if (!g.length || g[g.length - 1].year !== y) g.push({ year: y, items: [] })
      g[g.length - 1].items.push(m)
    }
    return g
  }, [list])

  const setQ = (v: string) => setParams(v ? { q: v } : {}, { replace: true })

  if (all && all.length === 0) {
    return (
      <div className="screen with-tabs">
        <div className="hdr">
          <div className="hdr-row"><div className="hdr-title">Воспоминания</div></div>
        </div>
        <div style={{ padding: '6px 16px 0' }}>
          <ShareInbox kind="memory" />
        </div>
        <div className="empty">
          <TicketArt title="ENCORE" sub="ВАШ АРХИВ КОНЦЕРТОВ" />
          <div className="empty-title">Здесь будут ваши концерты</div>
          <div className="empty-text">Добавьте фото с концерта — мы прочитаем дату из снимков, а вы допишете площадку, сет-лист и впечатления.</div>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => nav('/memory/new')}><Images size={20} />Добавить воспоминание</button>
            {own === false && <button className="btn btn-secondary" onClick={() => loadDemo()}>Посмотреть на демо-данных</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen with-tabs">
      <div className="hdr" ref={hdr}>
        <div className="hdr-row">
          <div className="hdr-title">Воспоминания</div>
          <div className="hdr-actions">
            <button className={'icon-btn' + (searchOpen ? ' active' : '')} aria-label="Поиск" onClick={() => { if (searchOpen) setQ(''); setSearchOpen(!searchOpen) }}>
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
          </div>
        </div>
        {searchOpen && (
          <div style={{ padding: '0 20px 12px' }}>
            <div className="field">
              <Search size={18} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Артист, площадка, жанр, друзья…" enterKeyHint="search" />
            </div>
          </div>
        )}
        <div className="chips">
          {['all', ...years].map((y) => (
            <button key={y} className={'chip' + (yr === y ? ' active' : '')} onClick={() => setYr(y)}>
              {y === 'all' ? 'Все' : y}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {!q && (
          <div style={{ paddingTop: 10 }}>
            <ShareInbox kind="memory" />
          </div>
        )}
        {groups.map((g) => (
          <div key={g.year}>
            <div style={{ position: 'sticky', top: hdrH, zIndex: 3, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px 12px', background: 'var(--bg)' }}>
              <span className="display" style={{ fontSize: 28, lineHeight: 1, letterSpacing: '.03em' }}>{g.year}</span>
              <div style={{ flex: 1, borderTop: '1.5px dashed var(--line2)' }} />
              <span className="mono-label" style={{ fontSize: 10, letterSpacing: '.18em' }}>{pl(g.items.length, ['концерт', 'концерта', 'концертов'])}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 10 }}>
              {g.items.map((m) => (
                <MemoryCard key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
        {all && list.length === 0 && (
          <div className="empty" style={{ paddingTop: 40 }}>
            <div className="empty-title" style={{ marginTop: 0 }}>Ничего не нашлось</div>
            <div className="empty-text">Попробуйте другое имя артиста или площадку.</div>
          </div>
        )}
      </div>
    </div>
  )
}
