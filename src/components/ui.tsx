import { Star } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { initials, personColor, TAG_COLORS } from '../lib/palette'

export function Stars({ value, size = 16, off = 'rgba(255,255,255,.28)', onSet }: { value: number; size?: number; off?: string; onSet?: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: onSet ? 0 : 1 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const s = <Star size={size} fill={i <= value ? '#FF8A2B' : off} color={i <= value ? '#FF8A2B' : off} strokeWidth={1} />
        return onSet ? (
          <button key={i} type="button" onClick={() => onSet(i === value ? 0 : i)} aria-label={`${i} из 5`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {s}
          </button>
        ) : (
          <span key={i}>{s}</span>
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} />
}

export function Avatar({ name, size = 36, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: personColor(name), fontSize: size * 0.34, ...style }}>
      {initials(name)}
    </div>
  )
}

export function Tag({ label, i }: { label: string; i: number }) {
  return (
    <div className="tag" style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }}>
      {label}
    </div>
  )
}

export function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-head">
      <span className="mono-label">{children}</span>
      {right}
    </div>
  )
}

/** Perforated ticket-stub notch (the half-circle cut-outs). */
export function Notch({ style }: { style: CSSProperties }) {
  return <div style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, background: 'var(--bg)', ...style }} />
}

/** Empty-state illustration: two stacked ticket stubs from the design. */
export function TicketArt({ title = '??/??', sub = 'ВАШ СЛЕДУЮЩИЙ КОНЦЕРТ' }: { title?: string; sub?: string }) {
  return (
    <div style={{ position: 'relative', width: 240, height: 180 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,46,136,.28),transparent 65%)' }} />
      <div style={{ position: 'absolute', left: 22, top: 34, width: 180, height: 104, borderRadius: 16, border: '1.5px dashed var(--line2)', background: 'var(--s1)', transform: 'rotate(-9deg)' }} />
      <div style={{ position: 'absolute', left: 36, top: 40, width: 180, height: 104, borderRadius: 16, background: 'linear-gradient(135deg,#FF2E88,#FF8A2B)', transform: 'rotate(5deg)', boxShadow: '0 20px 40px -14px rgba(255,46,136,.7)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 126, top: 10, bottom: 10, borderLeft: '2px dashed rgba(255,255,255,.5)' }} />
        <Notch style={{ left: 115, top: -11 }} />
        <Notch style={{ left: 115, bottom: -11 }} />
        <div className="display" style={{ position: 'absolute', left: 16, top: 20, fontSize: 30, lineHeight: 1, color: '#fff' }}>{title}</div>
        <div style={{ position: 'absolute', left: 16, top: 58, right: 60, font: '600 8px var(--mono)', letterSpacing: '.16em', color: 'rgba(255,255,255,.85)' }}>{sub}</div>
        <div style={{ position: 'absolute', left: 142, top: 38, width: 24, height: 24, borderRadius: 12, border: '2px solid rgba(255,255,255,.8)' }} />
      </div>
    </div>
  )
}

export function Spinner({ dark }: { dark?: boolean }) {
  return <div className={'spinner' + (dark ? ' dark' : '')} />
}
