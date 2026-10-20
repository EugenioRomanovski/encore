import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Maximize, RotateCw } from 'lucide-react'
import { applyFilter, blobToCanvas, canvasBlob, rotate90, warpQuad, type Filter, type Pt } from '../lib/scan'
import { useBlobUrl } from '../lib/hooks'
import { Spinner } from '../components/ui'
import { useUI } from '../store/ui'

const insetQuad = (w: number, h: number, k = 0.06): Pt[] => [
  { x: w * k, y: h * k },
  { x: w * (1 - k), y: h * k },
  { x: w * (1 - k), y: h * (1 - k) },
  { x: w * k, y: h * (1 - k) },
]

const FILTERS: { k: Filter; label: string; css: string }[] = [
  { k: 'orig', label: 'Оригинал', css: 'none' },
  { k: 'enh', label: 'Улучшенный', css: 'contrast(1.3) brightness(1.08) saturate(.9)' },
  { k: 'bw', label: 'Ч/Б', css: 'grayscale(1) contrast(1.5)' },
]

export default function TicketReview() {
  const nav = useNavigate()
  const { scanRaw, setScanRaw, setDraft, say } = useUI()
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null)
  const [srcBlob, setSrcBlob] = useState<Blob | null>(null)
  const [quad, setQuad] = useState<Pt[]>([])
  const [stage, setStage] = useState<'crop' | 'enhance'>('crop')
  const [warped, setWarped] = useState<HTMLCanvasElement | null>(null)
  const [filter, setFilter] = useState<Filter>('enh')
  const [out, setOut] = useState<Blob | null>(null)
  const [working, setWorking] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!scanRaw) {
      nav('/tickets/scan', { replace: true })
      return
    }
    blobToCanvas(scanRaw, 2400).then(async (c) => {
      setSrc(c)
      setQuad(insetQuad(c.width, c.height))
      setSrcBlob(await canvasBlob(c))
    }).catch(() => {
      say('Не удалось открыть изображение')
      nav(-1)
    })
  }, [scanRaw, nav, say])

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // filtered preview of the flattened ticket
  useEffect(() => {
    if (!warped) return
    let live = true
    setWorking(true)
    setTimeout(async () => {
      const b = await canvasBlob(applyFilter(warped, filter), 'image/jpeg', 0.9)
      if (live) {
        setOut(b)
        setWorking(false)
      }
    }, 10)
    return () => {
      live = false
    }
  }, [warped, filter])

  const srcUrl = useBlobUrl(srcBlob)
  const outUrl = useBlobUrl(out)
  const warpedBlob = useMemo(() => warped, [warped])

  const fit = useMemo(() => {
    if (!src || !box.w) return null
    const k = Math.min((box.w - 40) / src.width, (box.h - 40) / src.height)
    return { k, ox: (box.w - src.width * k) / 2, oy: (box.h - src.height * k) / 2, w: src.width * k, h: src.height * k }
  }, [src, box])

  const drag = (i: number) => (e: React.PointerEvent) => {
    if (!fit || !src) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const rect = area.current!.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(src.width, (ev.clientX - rect.left - fit.ox) / fit.k))
      const y = Math.max(0, Math.min(src.height, (ev.clientY - rect.top - fit.oy) / fit.k))
      setQuad((q) => q.map((p, j) => (j === i ? { x, y } : p)))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const rotate = async () => {
    if (!src) return
    const r = rotate90(src)
    setSrc(r)
    setQuad(insetQuad(r.width, r.height))
    setSrcBlob(await canvasBlob(r))
  }

  const next = () => {
    if (!src) return
    setWorking(true)
    setTimeout(() => {
      setWarped(warpQuad(src, quad))
      setStage('enhance')
    }, 10)
  }

  const retake = () => {
    setScanRaw(null)
    nav('/tickets/scan', { replace: true })
  }

  const use = () => {
    if (!out) return
    setDraft({ kind: 'scan', pages: [out], fileName: 'Скан бумажного билета', seat: [] })
    setScanRaw(null)
    nav('/tickets/assign', { replace: true })
  }

  const pts = fit ? quad.map((p) => ({ x: p.x * fit.k + fit.ox, y: p.y * fit.k + fit.oy })) : []

  return (
    <div className="fixed-col" style={{ top: 0, bottom: 0, zIndex: 60, background: '#0B0B0F', color: '#fff', display: 'flex', flexDirection: 'column', animation: 'enc-in .3s var(--ease)' }}>
      <div style={{ padding: 'calc(var(--sat) + 8px) 8px 0' }}>
        <div className="navbar-grid">
          <button className="nav-link" style={{ color: 'rgba(255,255,255,.7)' }} onClick={stage === 'crop' ? retake : () => setStage('crop')}>{stage === 'crop' ? 'Переснять' : 'Рамка'}</button>
          <div className="navbar-title">{stage === 'crop' ? 'Обрезка' : 'Улучшение'}</div>
          <button className="nav-link accent" style={{ color: '#FF4F9A' }} onClick={stage === 'crop' ? next : use} disabled={working || !src}>Далее</button>
        </div>
      </div>

      <div ref={area} style={{ position: 'relative', flex: 1, minHeight: 0, touchAction: 'none' }}>
        {stage === 'crop' && srcUrl && fit && (
          <>
            <img src={srcUrl} alt="" style={{ position: 'absolute', left: fit.ox, top: fit.oy, width: fit.w, height: fit.h }} />
            <svg width={box.w} height={box.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <path fillRule="evenodd" fill="rgba(0,0,0,.55)" d={`M${fit.ox},${fit.oy}h${fit.w}v${fit.h}h${-fit.w}Z M${pts.map((p) => `${p.x},${p.y}`).join(' L')}Z`} />
              <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(255,46,136,.08)" stroke="#FF2E88" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 10px rgba(255,46,136,.7))' }} />
            </svg>
            {pts.map((p, i) => (
              <div key={i} onPointerDown={drag(i)} style={{ position: 'absolute', left: p.x - 22, top: p.y - 22, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: 'grab' }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', border: '3px solid #FF2E88', boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} />
              </div>
            ))}
          </>
        )}
        {stage === 'enhance' && (
          <div style={{ position: 'absolute', inset: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {outUrl && <img src={outUrl} alt="Скан" style={{ maxWidth: '100%', maxHeight: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.6)', opacity: working ? 0.6 : 1, transition: 'opacity .2s' }} />}
          </div>
        )}
        {(working || !src) && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><Spinner /></div>}
      </div>

      <div style={{ padding: '14px 20px calc(24px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {stage === 'crop' ? (
          <>
            <div style={{ textAlign: 'center', font: '500 13px var(--sans)', color: 'rgba(255,255,255,.6)' }}>Перетащите углы на края билета</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, color: 'rgba(255,255,255,.85)' }}>
              <button onClick={rotate} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, font: '600 11px var(--sans)' }}><RotateCw size={22} />Повернуть</button>
              <button onClick={() => src && setQuad(insetQuad(src.width, src.height, 0))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, font: '600 11px var(--sans)' }}><Maximize size={22} />Весь кадр</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
              <button className="btn" style={{ height: 52, background: 'rgba(255,255,255,.1)', fontWeight: 600, fontSize: 15 }} onClick={retake}>Переснять</button>
              <button className="btn btn-primary" style={{ height: 52, fontSize: 15 }} onClick={next} disabled={working || !src}>Обрезать</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
              {FILTERS.map((f) => (
                <button key={f.k} onClick={() => setFilter(f.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <WarpThumb canvas={warpedBlob} css={f.css} on={filter === f.k} />
                  <span style={{ font: '600 12px var(--sans)', color: filter === f.k ? '#fff' : 'rgba(255,255,255,.55)' }}>{f.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
              <button className="btn" style={{ height: 52, background: 'rgba(255,255,255,.1)', fontWeight: 600, fontSize: 15 }} onClick={retake}>Переснять</button>
              <button className="btn btn-primary" style={{ height: 52, fontSize: 15 }} onClick={use} disabled={working || !out}>Использовать скан</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WarpThumb({ canvas, css, on }: { canvas: HTMLCanvasElement | null; css: string; on: boolean }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!canvas) return
    const c = document.createElement('canvas')
    const k = 144 / canvas.height
    c.width = Math.max(1, Math.round(canvas.width * k))
    c.height = 144
    c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height)
    setUrl(c.toDataURL('image/jpeg', 0.7))
  }, [canvas])
  return <div style={{ width: 56, height: 72, borderRadius: 10, background: url ? `#fff center/cover url("${url}")` : '#f6f0e4', filter: css, boxShadow: on ? '0 0 0 2px #FF2E88' : '0 0 0 1px rgba(255,255,255,.15)' }} />
}
