import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Image, MapPin, Plus, QrCode, ScanLine, ShieldCheck, Sparkles } from 'lucide-react'
import { db, type Ticket } from '../lib/db'
import { stampDow, todayISO } from '../lib/format'
import { TICKET_PAL } from '../lib/palette'
import { Notch, TicketArt } from '../components/ui'
import { useUI } from '../store/ui'

export const KIND: Record<Ticket['kind'], { label: string; Icon: typeof FileText }> = {
  pdf: { label: 'PDF', Icon: FileText },
  image: { label: 'ФОТО', Icon: Image },
  scan: { label: 'СКАН', Icon: ScanLine },
  demo: { label: 'ДЕМО', Icon: Sparkles },
}

function TicketCard({ t, mt, onTap }: { t: Ticket; mt: number; onTap: () => void }) {
  const p = TICKET_PAL[t.palette % TICKET_PAL.length]
  const k = KIND[t.kind]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}
      style={{ position: 'relative', cursor: 'pointer', width: '100%', height: 214, borderRadius: 22, color: '#fff', textAlign: 'left', transition: 'margin-top .45s var(--ease)', background: p.bg, marginTop: mt, boxShadow: `0 -8px 24px -12px rgba(0,0,0,.55),0 22px 44px -26px ${p.glow}` }}
    >
      <div className="grain" style={{ borderRadius: 22 }} />
      <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '500 10px var(--mono)', letterSpacing: '.18em', opacity: 0.8 }}>{stampDow(t.date)}{t.time ? ` · ${t.time}` : ''}</div>
          <div className="display ellipsis" style={{ fontSize: 30, lineHeight: 1, marginTop: 7 }}>{t.artist}</div>
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: 'rgba(0,0,0,.25)', font: '600 10px var(--mono)', letterSpacing: '.1em' }}>
          <k.Icon size={13} />{k.label}
        </div>
      </div>
      <div style={{ padding: '8px 18px 0', font: '500 13px var(--sans)', opacity: 0.88, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MapPin size={14} fill="#fff" stroke="rgba(0,0,0,.3)" style={{ flex: 'none' }} />
        <span className="ellipsis">{t.venue}</span>
      </div>
      <div style={{ position: 'absolute', left: 18, right: 18, top: 132, borderTop: '2px dashed rgba(255,255,255,.35)' }} />
      <Notch style={{ left: -11, top: 122 }} />
      <Notch style={{ right: -11, top: 122 }} />
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 36px', gap: 8, alignItems: 'end' }}>
        {[0, 1, 2].map((i) => {
          const s = t.seat[i]
          return (
            <div key={i} style={{ minWidth: 0 }}>
              {s && <>
                <div style={{ font: '500 9px var(--mono)', letterSpacing: '.16em', opacity: 0.7 }}>{s.k}</div>
                <div className="ellipsis" style={{ font: `700 ${s.v.length > 6 ? 14 : 18}px var(--sans)`, marginTop: 3 }}>{s.v}</div>
              </>}
            </div>
          )
        })}
        <QrCode size={30} style={{ opacity: 0.9 }} />
      </div>
    </div>
  )
}

export default function Tickets() {
  const nav = useNavigate()
  const openSheet = useUI((s) => s.openSheet)
  const [seg, setSeg] = useState<'up' | 'past'>('up')
  const [exp, setExp] = useState<string | null>(null)
  const all = useLiveQuery(() => db.tickets.orderBy('date').toArray(), [])
  const today = todayISO()
  // a ticket for a plan without a date yet counts as upcoming
  const up = (all || []).filter((t) => !t.date || t.date >= today)
  const past = (all || []).filter((t) => t.date && t.date < today).reverse()
  const list = seg === 'up' ? up : past

  return (
    <div className="screen with-tabs">
      <div className="hdr" style={{ paddingBottom: 12 }}>
        <div className="hdr-row">
          <div className="hdr-title">Билеты</div>
          <button className="icon-btn" aria-label="Добавить билет" onClick={() => openSheet('ticket')}><Plus size={22} /></button>
        </div>
        <div className="seg" style={{ margin: '0 20px' }}>
          <div className="seg-thumb" style={{ width: 'calc(50% - 3px)', left: seg === 'up' ? 3 : '50%' }} />
          <button className={seg === 'up' ? 'on' : ''} onClick={() => { setSeg('up'); setExp(null) }}>Предстоящие · {up.length}</button>
          <button className={seg === 'past' ? 'on' : ''} onClick={() => { setSeg('past'); setExp(null) }}>Прошедшие · {past.length}</button>
        </div>
      </div>

      {all && list.length === 0 ? (
        <div className="empty" style={{ paddingTop: 40 }}>
          <TicketArt title={seg === 'up' ? 'ADMIT ONE' : 'ARCHIVE'} sub={seg === 'up' ? 'ПОКА НЕТ БИЛЕТОВ' : 'АРХИВ КОРЕШКОВ'} />
          <div className="empty-title">{seg === 'up' ? 'Все билеты в одном месте' : 'Здесь будут прошедшие билеты'}</div>
          <div className="empty-text">PDF из почты, скриншот из приложения или бумажный билет — сканируйте и показывайте на входе.</div>
          {seg === 'up' && (
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => openSheet('ticket')}><Plus size={20} />Добавить билет</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: '500 10px var(--mono)', letterSpacing: '.16em', color: 'var(--tx3)', paddingBottom: 16 }}>
            <ShieldCheck size={14} />ХРАНЯТСЯ ТОЛЬКО НА ЭТОМ УСТРОЙСТВЕ
          </div>
          {list.map((t, i) => (
            <TicketCard
              key={t.id}
              t={t}
              mt={i === 0 ? 0 : list[i - 1].id === exp ? 14 : -150}
              onTap={() => {
                if (exp === t.id || i === list.length - 1) nav(`/ticket/${t.id}`, { state: { from: '/tickets' } })
                else setExp(t.id)
              }}
            />
          ))}
          {list.length > 1 && <div style={{ textAlign: 'center', font: '500 12px var(--sans)', color: 'var(--tx3)', paddingTop: 18 }}>Нажмите, чтобы раскрыть · ещё раз — чтобы открыть</div>}
        </div>
      )}
    </div>
  )
}
