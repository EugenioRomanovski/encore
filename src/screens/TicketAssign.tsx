import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, PlusCircle, Sparkles } from 'lucide-react'
import { db, type SeatField } from '../lib/db'
import { dayNum, monShort, stamp, todayISO } from '../lib/format'
import { saveDraft, type TicketInfo } from '../lib/ticketImport'
import { textMentions } from '../lib/ticketText'
import { useBlobUrl, useMediaUrl } from '../lib/hooks'
import { useUI } from '../store/ui'

type Choice = { kind: 'event' | 'memory'; id: string }

interface Row {
  kind: 'event' | 'memory'
  id: string
  artist: string
  tour?: string
  venue: string
  date: string
  time?: string
  taken: boolean
}

const DEFAULT_LABELS = ['СЕКТОР', 'РЯД', 'МЕСТО']

function fillSeat(seat: SeatField[]): SeatField[] {
  return [0, 1, 2].map((i) => seat[i] || { k: DEFAULT_LABELS[i], v: '' })
}

export default function TicketAssign() {
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const ticketId = params.get('ticket')
  const { draft, setDraft, target, say, setBusy } = useUI()
  const existing = useLiveQuery(() => (ticketId ? db.tickets.get(ticketId) : undefined), [ticketId])
  const selectEventId = (loc.state as { selectEventId?: string } | null)?.selectEventId

  const data = useLiveQuery(async () => {
    const [events, memories, tickets] = await Promise.all([db.events.orderBy('date').toArray(), db.memories.orderBy('date').reverse().limit(30).toArray(), db.tickets.toArray()])
    const takenE = new Set(tickets.filter((t) => t.id !== ticketId).map((t) => t.eventId))
    const takenM = new Set(tickets.filter((t) => t.id !== ticketId).map((t) => t.memoryId))
    const rows: Row[] = [
      ...events.map((e) => ({ kind: 'event' as const, id: e.id, artist: e.artist, tour: e.tour, venue: e.venue, date: e.date, time: e.show, taken: takenE.has(e.id) })),
      ...memories.map((m) => ({ kind: 'memory' as const, id: m.id, artist: m.artist, tour: m.tour, venue: m.venue, date: m.date, time: m.time, taken: takenM.has(m.id) })),
    ]
    return rows
  }, [ticketId])

  const [choice, setChoice] = useState<Choice | null>(null)
  const [seat, setSeat] = useState<SeatField[]>(fillSeat([]))

  const text = draft?.text || ''
  const hints = existing ? undefined : draft?.hints
  // a plan/memory matches if the ticket names its artist, or failing that, its date
  const matchId = useMemo(() => {
    if (!data) return undefined
    return (text && data.find((r) => textMentions(text, r.artist))?.id) || data.find((r) => r.date && hints?.dates.includes(r.date))?.id
  }, [text, data, hints])

  useEffect(() => {
    if (!ticketId && !draft) nav('/tickets', { replace: true })
  }, [ticketId, draft, nav])

  useEffect(() => {
    if (existing) setSeat(fillSeat(existing.seat))
    else if (draft) setSeat(fillSeat(draft.seat))
  }, [existing, draft])

  // pick a sensible default concert once data is in
  useEffect(() => {
    if (!data || choice) return
    const find = (id?: string) => (id ? data.find((r) => r.id === id) : undefined)
    const r =
      find(selectEventId) ||
      find(existing?.eventId) || find(existing?.memoryId) ||
      find(target.eventId) || find(target.memoryId) ||
      find(matchId) ||
      data.find((r) => r.kind === 'event' && !r.taken && (!r.date || r.date >= todayISO()))
    if (r) setChoice({ kind: r.kind, id: r.id })
  }, [data, choice, selectEventId, existing, target, matchId])

  const draftThumb = useBlobUrl(draft?.pages[0])
  const storedThumb = useMediaUrl(existing?.pageIds[0])
  const thumb = draftThumb || storedThumb

  const upcoming = (data || []).filter((r) => r.kind === 'event')
  const memories = (data || []).filter((r) => r.kind === 'memory')
  const chosen = data?.find((r) => choice && r.id === choice.id)
  const readSomething = (draft?.seat.length || 0) > 0 || !!matchId || !!hints?.artists.length || !!hints?.dates.length
  const readLine = [hints?.artists[0], hints?.dates[0] && stamp(hints.dates[0]), hints?.venues[0]].filter(Boolean).join(' · ')

  const save = async () => {
    if (!chosen) return
    const info: TicketInfo = {
      artist: chosen.artist,
      tour: chosen.tour,
      venue: chosen.venue,
      date: chosen.date,
      time: chosen.time,
      eventId: chosen.kind === 'event' ? chosen.id : undefined,
      memoryId: chosen.kind === 'memory' ? chosen.id : undefined,
    }
    const cleanSeat = seat.map((s) => ({ k: s.k.trim().toUpperCase(), v: s.v.trim().toUpperCase() })).filter((s) => s.v)
    setBusy('Сохраняем билет…')
    try {
      if (existing) {
        await db.tickets.update(existing.id, { ...info, seat: cleanSeat })
        say('Билет обновлён')
        nav(`/ticket/${existing.id}`, { replace: true })
      } else if (draft) {
        await saveDraft(draft, info, cleanSeat)
        setDraft(null)
        say('Билет сохранён')
        nav('/tickets', { replace: true })
      }
    } catch (e) {
      console.error(e)
      say('Не удалось сохранить — мало места?')
    } finally {
      setBusy(null)
    }
  }

  const back = () => {
    if (!existing) setDraft(null)
    nav(-1)
  }

  const row = (r: Row) => {
    const on = choice?.id === r.id
    return (
      <button key={r.id} onClick={() => setChoice({ kind: r.kind, id: r.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 18, background: 'var(--s1)', border: on ? '1.5px solid #FF2E88' : '1px solid var(--line)', textAlign: 'left', width: '100%' }}>
        <div style={{ flex: 'none', width: 46, height: 52, borderRadius: 12, background: 'var(--s2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.12em', color: 'var(--mag)' }}>{monShort(r.date)}</span>
          <span className="display" style={{ fontSize: 22, lineHeight: 1 }}>{dayNum(r.date)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span className="display ellipsis" style={{ fontSize: 19, lineHeight: 1 }}>{r.artist}</span>
            {r.id === matchId && <span style={{ flex: 'none', padding: '2px 6px', borderRadius: 6, background: 'var(--af)', color: 'var(--mag)', font: '700 10px var(--sans)' }}>Совпадение</span>}
          </div>
          <div className="ellipsis" style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 4 }}>
            {r.venue}{r.taken ? ' · уже есть билет' : ''}
          </div>
        </div>
        <div style={{ width: 24, height: 24, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: on ? 'var(--grad)' : 'transparent', border: on ? 'none' : '1.5px solid var(--line2)' }}>
          {on && <Check size={15} strokeWidth={3} />}
        </div>
      </button>
    )
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="navbar">
        <div className="navbar-grid">
          <button className="nav-link" style={{ color: 'var(--mag)' }} onClick={back}><ChevronLeft size={20} />Назад</button>
          <div className="navbar-title">{existing ? 'Привязка билета' : 'Новый билет'}</div>
          <div />
        </div>
      </div>
      <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
        <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
          <div style={{ width: 56, height: 80, flex: 'none', borderRadius: 6, background: thumb ? `#fff center/cover url("${thumb}")` : 'linear-gradient(170deg,#f6f0e4,#e5d9c4)', transform: 'rotate(-4deg)', boxShadow: '0 6px 16px rgba(0,0,0,.25)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="auto-badge">{readSomething ? <><Sparkles size={12} />МЫ ПРОЧИТАЛИ</> : 'БИЛЕТ'}</div>
            <div className="display ellipsis" style={{ fontSize: 24, lineHeight: 1, marginTop: 6 }}>{chosen?.artist || draft?.fileName || existing?.artist || 'Билет'}</div>
            <div className="mono ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx2)', marginTop: 4 }}>
              {[chosen && chosen.date && stamp(chosen.date), ...seat.filter((s) => s.v).map((s) => `${s.k} ${s.v}`)].filter(Boolean).join(' · ') || 'Выберите концерт ниже'}
            </div>
          </div>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <span className="mono-label">Место · необязательно</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {seat.map((s, i) => (
              <div key={i} className="card" style={{ padding: '8px 10px', borderRadius: 14 }}>
                <input value={s.k} onChange={(e) => setSeat(seat.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} aria-label="Название поля" style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: '500 10px var(--mono)', letterSpacing: '.14em', color: 'var(--tx3)', textTransform: 'uppercase', padding: 0 }} />
                <input value={s.v} onChange={(e) => setSeat(seat.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="—" aria-label={s.k} style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: '700 18px var(--sans)', color: 'var(--tx)', padding: '4px 0 0', textTransform: 'uppercase' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ font: '800 22px/1.2 var(--sans)', letterSpacing: '-.02em' }}>Для какого концерта?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.length > 0 && <span className="mono-label">Планы</span>}
          {upcoming.map(row)}
          <button className="dashed-btn" style={{ justifyContent: 'flex-start', padding: '0 14px' }} onClick={() => nav('/event/new', { state: { returnTo: loc.pathname + loc.search } })}>
            <PlusCircle size={20} style={{ flex: 'none' }} />
            <span style={{ textAlign: 'left', minWidth: 0 }}>
              Создать новое событие
              {readLine && !matchId && <span className="ellipsis" style={{ display: 'block', font: '500 12px var(--sans)', color: 'var(--mag)', marginTop: 2 }}>Из билета: {readLine}</span>}
            </span>
          </button>
          {memories.length > 0 && <span className="mono-label" style={{ marginTop: 10 }}>Воспоминания</span>}
          {memories.map(row)}
        </div>
      </div>
      <div className="sticky-cta">
        <button className="btn btn-primary" disabled={!chosen} onClick={save}>{existing ? 'Сохранить' : 'Сохранить билет'}</button>
      </div>
    </div>
  )
}
