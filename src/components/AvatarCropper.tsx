import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { blobToCanvas, canvasBlob } from '../lib/scan'
import { useBlobUrl } from '../lib/hooks'
import { Portal } from './Portal'
import { Spinner } from './ui'

const OUT = 400 // saved avatar size, px
const MAX_ZOOM = 4

interface View {
  s: number
  x: number
  y: number
}

/** Position and zoom a photo inside a round frame: drag to move, pinch / wheel / slider to zoom. */
export function AvatarCropper({ file, onCancel, onDone }: { file: Blob; onCancel: () => void; onDone: (square: Blob) => void }) {
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null)
  const [srcBlob, setSrcBlob] = useState<Blob | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [saving, setSaving] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const V = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 320, 320)

  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  useEffect(() => {
    // load once per file (onCancel is a new function on every parent render)
    blobToCanvas(file, 2000).then(async (c) => {
      setSrc(c)
      setSrcBlob(await canvasBlob(c, 'image/jpeg', 0.92))
    }, () => cancelRef.current())
  }, [file])

  const url = useBlobUrl(srcBlob)
  const minS = useMemo(() => (src ? V / Math.min(src.width, src.height) : 1), [src, V])

  // keep the photo covering the whole circle
  const clamp = (v: View): View => {
    if (!src) return v
    const s = Math.min(minS * MAX_ZOOM, Math.max(minS, v.s))
    const w = src.width * s, h = src.height * s
    return { s, x: Math.min(0, Math.max(V - w, v.x)), y: Math.min(0, Math.max(V - h, v.y)) }
  }

  useEffect(() => {
    if (src) setView(clamp({ s: minS, x: (V - src.width * minS) / 2, y: (V - src.height * minS) / 2 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, minS])

  /** zoom to scale `ns`, keeping the point (fx, fy) of the frame in place */
  const zoomAt = (v: View, ns: number, fx: number, fy: number) => clamp({ s: ns, x: fx - ((fx - v.x) * ns) / v.s, y: fy - ((fy - v.y) * ns) / v.s })

  const local = (e: { clientX: number; clientY: number }) => {
    const r = frame.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    frame.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointers.current
    const prev = ps.get(e.pointerId)
    if (!prev || !view) return
    const now = local(e)
    if (ps.size === 1) {
      setView(clamp({ ...view, x: view.x + now.x - prev.x, y: view.y + now.y - prev.y }))
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1]
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
      const d1 = Math.hypot(now.x - other.x, now.y - other.y)
      if (d0 > 0) setView(zoomAt(view, (view.s * d1) / d0, (now.x + other.x) / 2, (now.y + other.y) / 2))
    }
    ps.set(e.pointerId, now)
  }
  const onPointerUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId)

  const onWheel = (e: React.WheelEvent) => {
    if (!view) return
    const p = local(e)
    setView(zoomAt(view, view.s * Math.exp(-e.deltaY / 400), p.x, p.y))
  }

  const zoom = view ? view.s / minS : 1
  const setZoom = (z: number) => view && setView(zoomAt(view, minS * z, V / 2, V / 2))

  const save = async () => {
    if (!src || !view) return
    setSaving(true)
    const c = document.createElement('canvas')
    c.width = c.height = OUT
    const size = V / view.s
    c.getContext('2d')!.drawImage(src, -view.x / view.s, -view.y / view.s, size, size, 0, 0, OUT, OUT)
    onDone(await canvasBlob(c, 'image/jpeg', 0.88))
  }

  return (
    <Portal>
      <div className="fixed-col" role="dialog" aria-label="Обрезка фото" style={{ top: 0, bottom: 0, zIndex: 110, background: '#0B0B0F', color: '#fff', display: 'flex', flexDirection: 'column', animation: 'enc-fade .2s ease-out' }}>
        <div style={{ padding: 'calc(var(--sat) + 8px) 8px 0' }}>
          <div className="navbar-grid">
            <button className="nav-link" style={{ color: 'rgba(255,255,255,.7)' }} onClick={onCancel}>Отмена</button>
            <div className="navbar-title">Фото профиля</div>
            <button className="nav-link accent" style={{ color: '#FF4F9A' }} onClick={save} disabled={!view || saving}>Готово</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <div
            ref={frame}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            data-testid="avatar-frame"
            style={{ position: 'relative', width: V, height: V, overflow: 'hidden', touchAction: 'none', cursor: 'grab', borderRadius: 12 }}
          >
            {url && view && src ? (
              <img
                src={url}
                alt=""
                draggable={false}
                style={{ position: 'absolute', left: 0, top: 0, width: src.width, height: src.height, maxWidth: 'none', transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, userSelect: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
            )}
            {/* round frame: everything outside the circle is dimmed */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 9999px rgba(11,11,15,.68)', border: '2px solid rgba(255,255,255,.9)', pointerEvents: 'none' }} />
          </div>
          <div style={{ font: '500 13px var(--sans)', color: 'rgba(255,255,255,.6)' }}>Перетащите фото и увеличьте пальцами</div>
        </div>

        <div style={{ padding: '0 28px calc(28px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button aria-label="Уменьшить" onClick={() => setZoom(Math.max(1, zoom - 0.25))} style={{ display: 'flex', color: 'rgba(255,255,255,.8)' }}><Minus size={20} /></button>
            <input type="range" aria-label="Масштаб" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: '#FF2E88' }} />
            <button aria-label="Увеличить" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.25))} style={{ display: 'flex', color: 'rgba(255,255,255,.8)' }}><Plus size={20} /></button>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={!view || saving}>{saving ? <Spinner /> : 'Сохранить фото'}</button>
        </div>
      </div>
    </Portal>
  )
}
