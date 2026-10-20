import { useNavigate } from 'react-router-dom'
import { Plus, QrCode } from 'lucide-react'
import type { Ticket } from '../lib/db'
import { stampDow } from '../lib/format'
import { TICKET_PAL } from '../lib/palette'
import { Notch } from './ui'

/** Compact linked-ticket stub used on memory/event detail screens. */
export function TicketStub({ t, from }: { t: Ticket; from: string }) {
  const nav = useNavigate()
  const p = TICKET_PAL[t.palette % TICKET_PAL.length]
  return (
    <button
      onClick={() => nav(`/ticket/${t.id}`, { state: { from } })}
      style={{ position: 'relative', display: 'flex', width: '100%', height: 100, borderRadius: 18, color: '#fff', background: p.bg, boxShadow: `0 16px 36px -20px ${p.glow}`, textAlign: 'left' }}
    >
      <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ font: '500 9px var(--mono)', letterSpacing: '.18em', opacity: 0.8 }}>{stampDow(t.date)}{t.time ? ` · ${t.time}` : ''}</div>
        <div className="display ellipsis" style={{ fontSize: 24, lineHeight: 1 }}>{t.artist}</div>
        <div className="ellipsis" style={{ font: '500 12px var(--sans)', opacity: 0.85 }}>{t.venue}</div>
      </div>
      <div style={{ borderLeft: '2px dashed rgba(255,255,255,.4)', margin: '12px 0' }} />
      <Notch style={{ right: 85, top: -11 }} />
      <Notch style={{ right: 85, bottom: -11 }} />
      <div style={{ width: 94, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <QrCode size={30} />
        <span style={{ font: '600 9px var(--mono)', letterSpacing: '.18em' }}>ОТКРЫТЬ</span>
      </div>
    </button>
  )
}

export function AttachTicket({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="dashed-btn" onClick={onClick}>
      <Plus size={20} />
      {label}
    </button>
  )
}
