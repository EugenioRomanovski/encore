import { useEffect, useRef, useState } from 'react'
import { Portal } from '../components/Portal'
import { useNavigate } from 'react-router-dom'
import { Camera, Images, X } from 'lucide-react'
import { pickFiles } from '../lib/media'
import { canvasBlob } from '../lib/scan'
import { useUI } from '../store/ui'

export default function TicketScan() {
  const nav = useNavigate()
  const setScanRaw = useUI((s) => s.setScanRaw)
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Камера недоступна в этом браузере')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play().catch(() => {})
          setReady(true)
        }
      } catch {
        setError('Нет доступа к камере. Разрешите доступ в настройках браузера или сделайте фото.')
      }
    })()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const proceed = (b: Blob) => {
    setScanRaw(b)
    nav('/tickets/review', { replace: true })
  }

  const shoot = async () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    proceed(await canvasBlob(c, "image/jpeg", 0.92))
  }

  const fromFiles = async (capture?: boolean) => {
    const [f] = await pickFiles('image/*', false, capture ? 'environment' : undefined)
    if (f) proceed(f)
  }

  return (
    <Portal>
      <div className="fixed-col" style={{ top: 0, bottom: 0, zIndex: 60, background: '#000', color: '#fff', overflow: 'hidden', animation: 'enc-fade .3s ease' }}>
        <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ready ? 1 : 0, transition: 'opacity .3s' }} />
        {!ready && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 60% at 50% 45%,#4a3626 0%,#21180f 55%,#0a0806 100%)' }} />}

        <div style={{ position: 'absolute', top: 'calc(var(--sat) + 12px)', left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="glass-btn" style={{ background: 'rgba(255,255,255,.14)' }} aria-label="Закрыть" onClick={() => nav(-1)}><X size={22} /></button>
          <div style={{ font: '700 17px var(--sans)' }}>Скан билета</div>
          <div style={{ width: 44 }} />
        </div>

        {!error ? (
          <>
            <div style={{ position: 'absolute', top: 'calc(var(--sat) + 76px)', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 14px', borderRadius: 16, background: 'rgba(10,10,14,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', font: '600 13px var(--sans)', whiteSpace: 'nowrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: ready ? '#3DDC97' : '#F2A33A', boxShadow: `0 0 8px ${ready ? '#3DDC97' : '#F2A33A'}` }} />
              {ready ? 'Поместите билет в рамку' : 'Включаем камеру…'}
            </div>
            <div style={{ position: 'absolute', left: '50%', top: '46%', width: '64%', aspectRatio: '0.66', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '2.5px solid #FF2E88', background: 'rgba(255,46,136,.06)', boxShadow: '0 0 30px 4px rgba(255,46,136,.45),inset 0 0 30px rgba(255,46,136,.2), 0 0 0 2000px rgba(0,0,0,.35)' }} />
              <div style={{ position: 'absolute', left: -4, right: -4, height: 2, background: 'linear-gradient(90deg,transparent,#FF8A2B,transparent)', boxShadow: '0 0 14px 2px rgba(255,138,43,.8)', animation: 'enc-scan 1.8s ease-in-out infinite alternate' }} />
              {[{ left: -9, top: -9 }, { right: -9, top: -9 }, { left: -9, bottom: -9 }, { right: -9, bottom: -9 }].map((p, i) => (
                <div key={i} style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, background: '#fff', border: '3px solid #FF2E88', ...p }} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', left: 24, right: 24, top: '30%', textAlign: 'center' }}>
            <Camera size={40} style={{ opacity: 0.8 }} />
            <div style={{ font: '600 16px/1.45 var(--sans)', marginTop: 14 }}>{error}</div>
            <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => fromFiles(true)}><Camera size={20} />Сфотографировать билет</button>
          </div>
        )}

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '60px 40px calc(34px + var(--sab))', background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.85) 35%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 48 }} />
          <button aria-label="Снять" onClick={shoot} disabled={!ready} style={{ width: 78, height: 78, borderRadius: 39, border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.4 }}>
            <div style={{ width: 62, height: 62, borderRadius: 31, background: '#fff' }} />
          </button>
          <button aria-label="Из галереи" onClick={() => fromFiles()} style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Images size={22} /></button>
        </div>
      </div>
    </Portal>
  )
}
