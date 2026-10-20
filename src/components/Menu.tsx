import { useCallback, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useClickOutside } from '../lib/hooks'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

export function Menu({ items, glass }: { items: MenuItem[]; glass?: boolean }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, close)
  return (
    <div style={{ position: 'relative' }}>
      <button className={glass ? 'glass-btn' : 'icon-btn'} aria-label="Ещё" onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div className="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button key={it.label} className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick() }}>
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
