import { useEffect, useRef, useState } from 'react'
import { Portal } from './Portal'
import { X } from 'lucide-react'
import { useBlobUrl, useMedia } from '../lib/hooks'

function Slide({ id }: { id: string }) {
  const m = useMedia(id)
  const url = useBlobUrl(m?.blob)
  const poster = useBlobUrl(m?.thumb)
  return (
    <div style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {m?.kind === 'video' ? (
        <video src={url} poster={poster} controls playsInline style={{ maxWidth: '100%', maxHeight: '100%' }} />
      ) : url ? (
        <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      ) : null}
    </div>
  )
}

export function PhotoViewer({ ids, start, onClose }: { ids: string[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(start)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = start * el.clientWidth
  }, [start])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <Portal>
      <div className="fixed-col" style={{ top: 0, bottom: 0, zIndex: 100, background: '#000', animation: 'enc-fade .2s ease' }}>
        <div
          ref={ref}
          onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory' }}
        >
          {ids.map((id) => (
            <Slide key={id} id={id} />
          ))}
        </div>
        <div style={{ position: 'absolute', top: 'calc(var(--sat) + 12px)', left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '.16em' }}>{i + 1} / {ids.length}</span>
          <button className="glass-btn" onClick={onClose} aria-label="Закрыть">
            <X size={22} />
          </button>
        </div>
      </div>
    </Portal>
  )
}
