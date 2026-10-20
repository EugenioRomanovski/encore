import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CheckCircle2, ChevronRight, MinusCircle, Plus, Sparkles } from 'lucide-react'
import { db, type PlannedEvent } from '../lib/db'
import { dayNum, daysUntil, monShort, pl, plural, stampShort, todayISO } from '../lib/format'
import { hasOwnConcerts, loadDemo } from '../lib/demo'
import { Cover } from '../components/Cover'
import { TicketArt } from '../components/ui'
import { useUI } from '../store/ui'

function useTicketEventIds() {
  return useLiveQuery(async () => new Set((await db.tickets.toArray()).map((t) => t.eventId).filter(Boolean) as string[]), []) || new Set<string>()
}

function Countdown({ e, hasTicket }: { e: PlannedEvent; hasTicket: boolean }) {
  const nav = useNavigate()
  const d = daysUntil(e.date)
  return (
    <Cover id={e.coverId} palette={e.palette} onClick={() => nav(`/event/${e.id}`)} style={{ height: 430, borderRadius: 24, cursor: 'pointer', boxShadow: '0 26px 60px -26px rgba(255,46,136,.7)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 25%,rgba(8,8,12,.9) 100%)' }} />
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 14, background: 'rgba(10,10,14,.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#fff', font: '600 10px var(--mono)', letterSpacing: '.18em' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#FF2E88', boxShadow: '0 0 8px #FF2E88' }} />
          СЛЕДУЮЩИЙ
        </div>
        {hasTicket && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', borderRadius: 14, background: 'rgba(10,30,20,.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#6BF0B4', font: '600 12px var(--sans)' }}>
            <CheckCircle2 size={15} />Билет сохранён
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <span className="display" style={{ fontSize: d === 0 ? 96 : 136, lineHeight: 0.78, background: 'linear-gradient(170deg,#FFD0E4 0%,#FF2E88 45%,#FF8A2B 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 24px rgba(255,46,136,.55))' }}>
            {d === 0 ? 'СЕГОДНЯ' : d}
          </span>
          {d > 0 && (
            <div style={{ paddingBottom: 4 }}>
              <div className="display" style={{ fontSize: 36, lineHeight: 0.9 }}>{plural(d, ['день', 'дня', 'дней'])}</div>
              <div style={{ font: '500 10px var(--mono)', letterSpacing: '.2em', opacity: 0.75, marginTop: 4 }}>{plural(d, ['ОСТАЛСЯ', 'ОСТАЛОСЬ', 'ОСТАЛОСЬ'])}</div>
            </div>
          )}
        </div>
        <div className="display" style={{ fontSize: 42, lineHeight: 0.95, marginTop: 16, overflowWrap: 'anywhere' }}>{e.artist}</div>
        <div className="ellipsis" style={{ font: '500 14px var(--sans)', opacity: 0.88, marginTop: 6 }}>{e.venue}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          <div className="stamp">{stampShort(e.date)}</div>
          {e.doors && <div className="stamp">ДВЕРИ {e.doors}</div>}
          {e.show && <div className="stamp">НАЧАЛО {e.show}</div>}
        </div>
      </div>
    </Cover>
  )
}

function EventRow({ e, hasTicket }: { e: PlannedEvent; hasTicket: boolean }) {
  const nav = useNavigate()
  return (
    <button className="card" onClick={() => nav(`/event/${e.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, textAlign: 'left', width: '100%' }}>
      <div style={{ flex: 'none', width: 58, height: 68, borderRadius: 14, background: 'var(--s2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', color: 'var(--mag)' }}>{monShort(e.date)}</span>
        <span className="display" style={{ fontSize: 30, lineHeight: 1 }}>{dayNum(e.date)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="display ellipsis" style={{ fontSize: 22, lineHeight: 1 }}>{e.artist}</div>
        <div className="ellipsis" style={{ font: '400 13px var(--sans)', color: 'var(--tx2)' }}>{e.venue} · {pl(daysUntil(e.date), ['день', 'дня', 'дней'])}</div>
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 11, font: '600 11px var(--sans)', background: hasTicket ? 'var(--okbg)' : 'var(--s2)', color: hasTicket ? 'var(--ok)' : 'var(--tx3)' }}>
          {hasTicket ? <CheckCircle2 size={13} /> : <MinusCircle size={13} />}
          {hasTicket ? 'Билет сохранён' : 'Нет билета'}
        </div>
      </div>
      <ChevronRight size={20} color="var(--tx3)" />
    </button>
  )
}

function PastPrompt({ e }: { e: PlannedEvent }) {
  const nav = useNavigate()
  return (
    <button onClick={() => nav(`/memory/new?fromEvent=${e.id}`)} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, background: 'var(--grad)', color: '#fff', boxShadow: '0 16px 36px -16px rgba(255,46,136,.8)', textAlign: 'left', width: '100%' }}>
      <div className="grain" style={{ opacity: 0.25 }} />
      <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 22, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={22} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '800 17px var(--sans)' }}>Как всё прошло?</div>
        <div className="ellipsis" style={{ font: '500 14px var(--sans)', opacity: 0.92, marginTop: 2 }}>{e.artist} — превратите в воспоминание →</div>
      </div>
    </button>
  )
}

export default function Upcoming() {
  const nav = useNavigate()
  const openSheet = useUI((s) => s.openSheet)
  const events = useLiveQuery(() => db.events.orderBy('date').toArray(), [])
  const withTicket = useTicketEventIds()
  const own = useLiveQuery(hasOwnConcerts, [])
  const today = todayISO()
  const future = (events || []).filter((e) => e.date >= today)
  const past = (events || []).filter((e) => e.date < today).reverse()
  const [next, ...later] = future

  return (
    <div className="screen with-tabs">
      <div className="hdr">
        <div className="hdr-row" style={{ paddingBottom: 4 }}>
          <div className="hdr-title">Скоро</div>
          <div className="hdr-actions">
            <button className="icon-btn" aria-label="Запланировать концерт" onClick={() => nav('/event/new')}><Plus size={22} /></button>
          </div>
        </div>
      </div>

      {events && events.length === 0 && (
        <div className="empty" style={{ paddingTop: 70 }}>
          <TicketArt />
          <div className="empty-title">На горизонте пока пусто</div>
          <div className="empty-text">Запланируйте концерт — мы будем считать дни, держать билет под рукой и напомним до открытия дверей.</div>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => nav('/event/new')}><CalendarPlus size={20} />Запланировать концерт</button>
            <button className="btn btn-secondary" onClick={() => openSheet('ticket')}>Или сначала добавить билет</button>
            {own === false && <button className="link" style={{ marginTop: 8 }} onClick={() => loadDemo()}>Посмотреть на демо-данных</button>}
          </div>
        </div>
      )}

      <div style={{ padding: '6px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {past.map((e) => <PastPrompt key={e.id} e={e} />)}
        {next && <Countdown e={next} hasTicket={withTicket.has(next.id)} />}
        {later.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 4px 2px' }}>
            <span className="mono-label">Дальше</span>
            <span style={{ font: '500 12px var(--sans)', color: 'var(--tx3)' }}>{pl(later.length, ['концерт', 'концерта', 'концертов'])}</span>
          </div>
        )}
        {later.map((e) => <EventRow key={e.id} e={e} hasTicket={withTicket.has(e.id)} />)}
      </div>
    </div>
  )
}
