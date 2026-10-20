import { CheckCircle2 } from 'lucide-react'
import { useUI } from '../store/ui'
import { Spinner } from './ui'

export function Toast() {
  const toast = useUI((s) => s.toast)
  if (!toast) return null
  return (
    <div className="toast fixed-col" role="status">
      <div>
        <CheckCircle2 size={18} color="var(--ok)" />
        {toast}
      </div>
    </div>
  )
}

export function Busy() {
  const busy = useUI((s) => s.busy)
  if (!busy) return null
  return (
    <div className="backdrop" style={{ zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: 'var(--s2)', font: '600 15px var(--sans)' }}>
        <Spinner dark />
        {busy}
      </div>
    </div>
  )
}
