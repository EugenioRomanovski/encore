import { useState } from 'react'
import { Portal } from '../components/Portal'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, QrCode } from 'lucide-react'
import { ph } from '../lib/palette'
import { loadDemo } from '../lib/demo'
import { useUI } from '../store/ui'

const SLIDES = [
  { t: 'Вспоминайте концерты', b: 'Фото, сет-листы и заметки с каждого концерта, на котором вы были, — ваш личный архив.' },
  { t: 'Не пропускайте шоу', b: 'Обратный отсчёт до следующего концерта, напоминание до открытия дверей и все планы в одном месте.' },
  { t: 'Все билеты в одном месте', b: 'PDF, скриншоты и бумажные билеты. Всегда под рукой на входе — даже без интернета.' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const setOnboarded = useUI((s) => s.setOnboarded)
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const finish = (demo?: boolean) => {
    setOnboarded()
    if (demo) loadDemo()
    nav('/', { replace: true })
  }

  return (
    <Portal>
      <div className="fixed-col" style={{ top: 0, bottom: 0, background: 'var(--bg)', overflow: 'hidden', animation: 'enc-fade .35s ease' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '64%', transition: 'background .5s', background: ph([0, 1, 2][i]) }}>
          <div className="grain" style={{ opacity: 0.24 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 45%,var(--bg) 98%)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%,-50%)', width: 260, height: 220 }}>
            {i === 0 && (
              <div style={{ position: 'absolute', left: 15, top: 0, width: 230, padding: '12px 12px 16px', borderRadius: 14, background: '#F7F4EE', transform: 'rotate(-5deg)', boxShadow: '0 30px 60px -20px rgba(0,0,0,.7)', animation: 'enc-fade .4s ease' }}>
                <div style={{ height: 150, borderRadius: 8, background: 'radial-gradient(70% 55% at 30% 25%,#FF2E88,transparent 65%),radial-gradient(60% 50% at 80% 40%,#FF7A2F,transparent 60%),#160c12' }} />
                <div className="display" style={{ fontSize: 24, lineHeight: 1, color: '#16131A', marginTop: 12 }}>Arctic Monkeys</div>
                <div style={{ font: '600 9px var(--mono)', letterSpacing: '.16em', color: 'rgba(22,19,26,.6)', marginTop: 4 }}>14 ИЮН 2025 · THE O2</div>
              </div>
            )}
            {i === 1 && (
              <div style={{ position: 'absolute', left: 5, top: 20, width: 250, padding: 20, borderRadius: 24, background: 'rgba(14,14,18,.55)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,.14)', color: '#fff', transform: 'rotate(3deg)', animation: 'enc-fade .4s ease' }}>
                <div style={{ font: '600 9px var(--mono)', letterSpacing: '.18em', opacity: 0.7 }}>СЛЕДУЮЩИЙ · TAME IMPALA</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 10 }}>
                  <span className="display" style={{ fontSize: 92, lineHeight: 0.8, background: 'linear-gradient(170deg,#FFD0E4,#FF2E88 45%,#FF8A2B)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>12</span>
                  <span className="display" style={{ fontSize: 28, lineHeight: 1 }}>дней</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, font: '600 12px var(--sans)' }}><BellRing size={15} color="#FF8A2B" />Напомним за 2 ч до дверей</div>
              </div>
            )}
            {i === 2 && (
              <div style={{ animation: 'enc-fade .4s ease' }}>
                <div style={{ position: 'absolute', left: 0, top: 10, width: 250, height: 150, borderRadius: 20, background: 'linear-gradient(135deg,#6B4EFF,#B592FF)', transform: 'rotate(-10deg)', boxShadow: '0 20px 40px -16px rgba(0,0,0,.6)' }} />
                <div style={{ position: 'absolute', left: 20, top: 36, width: 250, height: 150, borderRadius: 20, background: 'linear-gradient(135deg,#FF2E88,#FF7A2F)', transform: 'rotate(4deg)', boxShadow: '0 26px 50px -16px rgba(255,46,136,.6)', color: '#fff', padding: 16 }}>
                  <div style={{ font: '600 9px var(--mono)', letterSpacing: '.18em', opacity: 0.85 }}>ВС 01 НОЯ 2026</div>
                  <div className="display" style={{ fontSize: 28, lineHeight: 1, marginTop: 6 }}>Tame Impala</div>
                  <div style={{ position: 'absolute', left: 16, right: 16, top: 92, borderTop: '2px dashed rgba(255,255,255,.4)' }} />
                  <div style={{ position: 'absolute', left: 16, bottom: 14, font: '700 13px var(--sans)' }}>СЕКТОР 104 · РЯД F</div>
                  <QrCode size={28} style={{ position: 'absolute', right: 14, bottom: 10 }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => finish()} style={{ position: 'absolute', top: 'calc(var(--sat) + 14px)', right: 16, height: 36, padding: '0 14px', borderRadius: 18, background: 'rgba(20,18,26,.42)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#fff', font: '600 14px var(--sans)' }}>
          Пропустить
        </button>
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 'calc(var(--sab) + 24px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.2em', color: 'var(--mag)' }}>0{i + 1} / 03</div>
            <div className="display" style={{ fontSize: 50, lineHeight: 0.95, marginTop: 12, textWrap: 'balance' }}>{s.t}</div>
            <div style={{ font: '400 16px/1.5 var(--sans)', color: 'var(--tx2)', marginTop: 12, textWrap: 'pretty' }}>{s.b}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((k) => <div key={k} style={{ height: 7, borderRadius: 4, transition: 'width .3s', width: k === i ? 22 : 7, background: k === i ? 'var(--grad)' : 'var(--line2)' }} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" style={{ height: 56 }} onClick={() => (i < 2 ? setI(i + 1) : finish())}>
              {i < 2 ? 'Дальше' : 'Начать'}<ArrowRight size={20} />
            </button>
            {i === 2 && <button className="link" style={{ height: 36 }} onClick={() => finish(true)}>Посмотреть на демо-данных</button>}
          </div>
        </div>
      </div>
    </Portal>
  )
}
