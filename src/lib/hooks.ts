import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Media } from './db'

export function useBlobUrl(blob?: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return url
}

export function useMedia(id?: string): Media | undefined {
  return useLiveQuery(() => (id ? db.media.get(id) : undefined), [id])
}

/** Object URL for a stored media item; `thumb` prefers the small preview. */
export function useMediaUrl(id?: string, thumb = true) {
  const m = useMedia(id)
  return useBlobUrl(m ? (thumb && m.thumb) || (m.kind === 'image' ? m.blob : m.thumb) : undefined)
}

/** Screen Wake Lock: keep the display on while a ticket is shown at the gate. */
export function useWakeLock(active = true) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) return lock.release()
        setOn(true)
        lock.addEventListener('release', () => setOn(false))
      } catch {
        setOn(false)
      }
    }
    req()
    const vis = () => document.visibilityState === 'visible' && req()
    document.addEventListener('visibilitychange', vis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', vis)
      lock?.release().catch(() => {})
    }
  }, [active])
  return on
}

export function useClickOutside(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const h = () => close()
    const t = setTimeout(() => document.addEventListener('click', h), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', h)
    }
  }, [open, close])
}
