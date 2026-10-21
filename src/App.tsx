import { useEffect, useRef } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigationType } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { Sheets } from './components/Sheets'
import { Busy, Toast } from './components/Overlays'
import { useUI } from './store/ui'
import Memories from './screens/Memories'
import MemoryDetail from './screens/MemoryDetail'
import MemoryForm from './screens/MemoryForm'
import Upcoming from './screens/Upcoming'
import EventDetail from './screens/EventDetail'
import EventForm from './screens/EventForm'
import Tickets from './screens/Tickets'
import TicketDetail from './screens/TicketDetail'
import TicketAssign from './screens/TicketAssign'
import TicketScan from './screens/TicketScan'
import TicketReview from './screens/TicketReview'
import Profile from './screens/Profile'
import Onboarding from './screens/Onboarding'
import Account from './screens/Account'
import Username from './screens/Username'
import Friends from './screens/Friends'

const TAB_PATHS = ['/', '/upcoming', '/tickets', '/profile']
// full-screen layers that are position:fixed — they must not sit inside a transform
const FULLSCREEN = ['/tickets/scan', '/tickets/review', '/welcome']

function transitionFor(from: string, to: string, type: string) {
  if (FULLSCREEN.includes(to) || FULLSCREEN.includes(from)) return 'route-fade'
  if (TAB_PATHS.includes(from) && TAB_PATHS.includes(to)) return 'route-fade'
  if (type === 'REPLACE') return 'route-fade'
  return type === 'POP' ? 'route-pop' : 'route-push'
}

function Layout() {
  const loc = useLocation()
  const theme = useUI((s) => s.theme)
  const onboarded = useUI((s) => s.onboarded)
  const navType = useNavigationType()
  // decided once per path change, so unrelated re-renders can't restart or cut the animation
  const route = useRef<{ path: string; cls?: string }>({ path: loc.pathname })
  if (route.current.path !== loc.pathname) {
    route.current = { path: loc.pathname, cls: transitionFor(route.current.path, loc.pathname, navType) }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E0E12' : '#F7F4EF')
  }, [theme])

  if (!onboarded && loc.pathname !== '/welcome') return <Navigate to="/welcome" replace />

  return (
    <>
      <div key={loc.pathname} className={route.current.cls}>
        <Outlet />
      </div>
      {TAB_PATHS.includes(loc.pathname) && <TabBar />}
      <Sheets />
      <Toast />
      <Busy />
      <ScrollRestoration />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Memories /> },
      { path: '/memory/new', element: <MemoryForm /> },
      { path: '/memory/:id', element: <MemoryDetail /> },
      { path: '/memory/:id/edit', element: <MemoryForm key="edit" /> },
      { path: '/upcoming', element: <Upcoming /> },
      { path: '/event/new', element: <EventForm /> },
      { path: '/event/:id', element: <EventDetail /> },
      { path: '/event/:id/edit', element: <EventForm key="edit" /> },
      { path: '/tickets', element: <Tickets /> },
      { path: '/tickets/assign', element: <TicketAssign /> },
      { path: '/tickets/scan', element: <TicketScan /> },
      { path: '/tickets/review', element: <TicketReview /> },
      { path: '/ticket/:id', element: <TicketDetail /> },
      { path: '/profile', element: <Profile /> },
      { path: '/welcome', element: <Onboarding /> },
      { path: '/account', element: <Account /> },
      { path: '/username', element: <Username /> },
      { path: '/friends', element: <Friends /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
