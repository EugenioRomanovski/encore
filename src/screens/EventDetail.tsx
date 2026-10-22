import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BellRing, ChevronLeft, ChevronRight, MapPin, Navigation, Pencil, Share, Sparkles, Ticket, Trash2 } from 'lucide-react'
import { db, deleteEvent } from '../lib/db'
import { dayNum, daysUntil, dow, monShort, relDays, stampDow, year } from '../lib/format'
import { addToCalendar } from '../lib/ics'
import { Cover } from '../components/Cover'
import { Avatar, Label } from '../components/ui'
import { Menu } from '../components/Menu'
import { AttachTicket } from '../components/TicketStub'
import { useUI } from '../store/ui'

const tile = { padding: 12, borderRadius: 16 } as const

export default function EventDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { openSheet, say } = useUI()
  const e = useLiveQuery(() => db.events.get(id!), [id])
  const tickets = useLiveQuery(() => db.tickets.where('eventId').equals(id!).sortBy('createdAt'), [id])

  if (e === undefined) return null
  if (!e) {
    return (
      <div className="screen empty">
        <div className="empty-title">Событие не найдено</div>
        <div className="empty-actions"><button className="btn btn-secondary" onClick={() => nav('/upcoming')}>К списку</button></div>
      </div>
    )
  }

  const dated = !!e.date
  const d = dated ? daysUntil(e.date) : null
  const past = d !== null && d < 0

  const share = async () => {
    const text = [e.artist, e.venue, dated && stampDow(e.date).toLowerCase(), e.show && 'начало в ' + e.show].filter(Boolean).join(', ').replace(', ', ' — ')
    try {
      if (navigator.share) await navigator.share({ title: e.artist, text })
      else {
        await navigator.clipboard.writeText(text)
        say('Скопировано')
      }
    } catch {
      /* cancelled */
    }
  }

  const remove = async () => {
    if (!confirm(`Удалить «${e.artist}» из планов? Билет останется в разделе «Билеты».`)) return
    await deleteEvent(e)
    nav('/upcoming', { replace: true })
    say('Событие удалено')
  }

  const directions = () => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(e.venue)}`, '_blank', 'noopener')

  return (
    <div className="screen" style={{ paddingBottom: 'calc(40px + var(--sab))' }}>
      <Cover id={e.coverId} palette={e.palette} full style={{ height: 400 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,8,12,.5) 0%,transparent 24%,transparent 40%,rgba(8,8,12,.9) 100%)' }} />
        <div style={{ position: 'absolute', top: 'calc(var(--sat) + 12px)', left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button className="glass-btn" aria-label="Назад" onClick={() => (history.length > 1 ? nav(-1) : nav('/upcoming'))}><ChevronLeft size={24} /></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="glass-btn" aria-label="Поделиться" onClick={share}><Share size={19} /></button>
            <Menu glass items={[
              { label: 'Редактировать', icon: <Pencil size={18} />, onClick: () => nav(`/event/${e.id}/edit`) },
              { label: 'Удалить', icon: <Trash2 size={18} />, danger: true, onClick: remove },
            ]} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 46, color: '#fff' }}>
          {d !== null && !past && (
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 13, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)', font: '700 12px var(--sans)' }}>{relDays(d)}</div>
          )}
          {e.tour && <div style={{ font: '500 11px var(--mono)', letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.85, marginTop: 12 }}>{e.tour}</div>}
          <div className="display" style={{ fontSize: 62, lineHeight: 0.9, marginTop: 6, overflowWrap: 'anywhere' }}>{e.artist}</div>
        </div>
      </Cover>

      <div style={{ position: 'relative', marginTop: -26, borderRadius: '28px 28px 0 0', background: 'var(--bg)', padding: '22px 20px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {past && (
          <button onClick={() => nav(`/memory/new?fromEvent=${e.id}`)} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, background: 'var(--grad)', color: '#fff', boxShadow: '0 16px 36px -16px rgba(255,46,136,.8)', textAlign: 'left' }}>
            <div className="grain" style={{ opacity: 0.25 }} />
            <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 22, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 18px var(--sans)' }}>Как всё прошло?</div>
              <div style={{ font: '500 14px var(--sans)', opacity: 0.92, marginTop: 2 }}>Превратите в воспоминание →</div>
            </div>
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
          <div className="card" style={tile}>
            {dated ? (
              <>
                <div className="mono-label" style={{ fontSize: 9 }}>{dow(e.date)}</div>
                <div className="display" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 6 }}>{dayNum(e.date)} {monShort(e.date)}</div>
                <div style={{ font: '500 11px var(--sans)', color: 'var(--tx3)' }}>{year(e.date)}</div>
              </>
            ) : (
              <button onClick={() => nav(`/event/${e.id}/edit`)} style={{ textAlign: 'left' }}>
                <div className="mono-label" style={{ fontSize: 9 }}>Дата</div>
                <div className="display" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 6 }}>—</div>
                <div style={{ font: '600 11px var(--sans)', color: 'var(--mag)' }}>Указать</div>
              </button>
            )}
          </div>
          <div className="card" style={tile}>
            <div className="mono-label" style={{ fontSize: 9 }}>Двери</div>
            <div className="display" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 6 }}>{e.doors || '—'}</div>
          </div>
          <div className="card" style={tile}>
            <div className="mono-label" style={{ fontSize: 9 }}>Начало</div>
            <div className="display" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 6, color: 'var(--mag)' }}>{e.show || '—'}</div>
          </div>
        </div>

        {e.venue && <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--s2)', color: 'var(--mag)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono-label" style={{ fontSize: 9 }}>Площадка</div>
            <div style={{ font: '600 15px var(--sans)', marginTop: 3 }}>{e.venue}</div>
          </div>
          {!past && (
            <button onClick={directions} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 16px', borderRadius: 22, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)', color: '#fff', font: '700 14px var(--sans)' }}>
              <Navigation size={16} fill="#fff" />Маршрут
            </button>
          )}
        </div>}

        {dated && !past && (
          <button className="card" onClick={() => addToCalendar(e)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'rgba(123,97,255,.18)', color: 'var(--vi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BellRing size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 15px var(--sans)' }}>Напомнить</div>
              <div style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>В календарь: за день и за 2 ч до дверей</div>
            </div>
            <ChevronRight size={20} color="var(--tx3)" />
          </button>
        )}

        {tickets?.map((t, i) => (
          <button key={t.id} className="card" onClick={() => nav(`/ticket/${t.id}`, { state: { from: `/event/${e.id}` } })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ticket size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 15px var(--sans)' }}>{tickets.length > 1 ? `Билет ${i + 1}` : 'Показать билет'}</div>
              <div className="mono ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx2)', marginTop: 3 }}>
                {t.seat.length ? t.seat.map((s) => `${s.k} ${s.v}`).join(' · ') : t.fileName || 'Билет'}
              </div>
            </div>
            <ChevronRight size={20} color="var(--tx3)" />
          </button>
        ))}
        {tickets && <AttachTicket label={tickets.length ? 'Добавить ещё билет' : 'Привязать билет'} onClick={() => openSheet('ticket', { eventId: e.id })} />}

        {e.friends && e.friends.length > 0 && (
          <div className="section" style={{ gap: 10 }}>
            <Label>С кем идёте</Label>
            <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex' }}>
                {e.friends.slice(0, 4).map((f) => <Avatar key={f.id} name={f.name} src={f.avatar} style={{ marginRight: -8, border: '2px solid var(--s1)' }} />)}
              </div>
              <div className="ellipsis" style={{ flex: 1, marginLeft: 8, font: '500 14px var(--sans)', color: 'var(--tx2)' }}>{e.friends.map((f) => f.name).join(', ')}</div>
            </div>
          </div>
        )}

        <div className="section" style={{ gap: 10 }}>
          <Label right={<button className="link" onClick={() => nav(`/event/${e.id}/edit`)}>Изменить</button>}>Заметки</Label>
          <div className="card" style={{ padding: 16, font: '400 15px/1.55 var(--sans)', textWrap: 'pretty', whiteSpace: 'pre-wrap', color: e.notes ? 'var(--tx)' : 'var(--tx3)' }}>
            {e.notes || 'Где встречаемся, что взять с собой, во сколько выходить…'}
          </div>
        </div>
      </div>
    </div>
  )
}
