import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router-dom'
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

const TAB_PATHS = ['/', '/upcoming', '/tickets', '/profile']

function Layout() {
  const loc = useLocation()
  const theme = useUI((s) => s.theme)
  const onboarded = useUI((s) => s.onboarded)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E0E12' : '#F7F4EF')
  }, [theme])

  if (!onboarded && loc.pathname !== '/welcome') return <Navigate to="/welcome" replace />

  return (
    <>
      <Outlet />
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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
