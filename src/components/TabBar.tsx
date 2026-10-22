import { NavLink } from 'react-router-dom'
import { BookImage, CalendarDays, Plus, Ticket, User } from 'lucide-react'
import { useUI } from '../store/ui'
import { useSocial } from '../lib/social'
import { useSync } from '../lib/sync'

const TABS = [
  { to: '/', label: 'Воспоминания', Icon: BookImage, end: true },
  { to: '/upcoming', label: 'Скоро', Icon: CalendarDays },
  null,
  { to: '/tickets', label: 'Билеты', Icon: Ticket },
  { to: '/profile', label: 'Профиль', Icon: User },
] as const

export function TabBar() {
  const sheet = useUI((s) => s.sheet)
  const openSheet = useUI((s) => s.openSheet)
  // incoming friend requests → dot on the Profile tab
  const requests = useSocial((s) => s.incoming.length)
  const signedIn = useSync((s) => !!s.user)
  const alert = signedIn && requests > 0
  return (
    <nav className="tabbar fixed-col" aria-label="Разделы">
      {TABS.map((t) =>
        t ? (
          <NavLink
            key={t.to}
            to={t.to}
            end={'end' in t}
            className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
            onClick={() => openSheet(null)}
            aria-label={t.to === '/profile' && alert ? `${t.label}: запросы в друзья (${requests})` : undefined}
          >
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', display: 'flex' }}>
                  <t.Icon size={24} strokeWidth={isActive ? 2.3 : 1.8} />
                  {t.to === '/profile' && alert && <span className="tab-dot" />}
                </span>
                <span>{t.label}</span>
              </>
            )}
          </NavLink>
        ) : (
          <div key="fab" style={{ display: 'flex', justifyContent: 'center' }}>
            <button className={'fab' + (sheet === 'plus' ? ' open' : '')} aria-label="Создать" onClick={() => openSheet(sheet === 'plus' ? null : 'plus')}>
              <Plus size={30} strokeWidth={2.6} />
            </button>
          </div>
        ),
      )}
    </nav>
  )
}
