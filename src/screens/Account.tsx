import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Cloud, Mail } from 'lucide-react'
import { sendCode, useSync, verifyCode } from '../lib/sync'
import { Spinner } from '../components/ui'
import { useUI } from '../store/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Supabase project setting "Email OTP length" (currently 8); the form auto-submits at exactly this length
const CODE_LENGTH = 8

function authError(e: unknown) {
  const m = String((e as Error)?.message || e)
  if (/signups? not allowed|user not found/i.test(m)) return 'NO_ACCOUNT'
  if (/rate limit|too many|security purposes/i.test(m)) return 'Слишком много попыток. Подождите минуту и попробуйте снова.'
  if (/expired|invalid|token/i.test(m)) return 'Код не подошёл или устарел. Проверьте письмо или запросите новый.'
  if (/fetch|network|Load failed/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.'
  return m
}

export default function Account() {
  const nav = useNavigate()
  const say = useUI((s) => s.say)
  const user = useSync((s) => s.user)
  const [params, setParams] = useSearchParams()
  const signup = params.get('mode') === 'signup'
  const setSignup = (v: boolean) => {
    setParams(v ? { mode: 'signup' } : {}, { replace: true })
    setError(null)
  }
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const codeInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      say('Вы вошли — синхронизация включена')
      nav('/profile', { replace: true })
    }
  }, [user, nav, say])

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return setError('Проверьте адрес почты')
    setBusy(true)
    setError(null)
    try {
      await sendCode(e, signup)
      setEmail(e)
      setStep('code')
      setCode('')
      setCooldown(60)
      setTimeout(() => codeInput.current?.focus(), 50)
    } catch (err) {
      setError(authError(err))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (value = code) => {
    const token = value.replace(/\D/g, '')
    if (token.length < CODE_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, token)
    } catch (err) {
      setError(authError(err))
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="navbar">
        <div className="navbar-grid">
          <button className="nav-link" style={{ color: 'var(--mag)' }} onClick={() => (step === 'code' ? (setStep('email'), setError(null)) : nav(-1))}>
            <ChevronLeft size={20} />{step === 'code' ? 'Почта' : 'Назад'}
          </button>
          <div className="navbar-title">Аккаунт</div>
          <div />
        </div>
      </div>

      <div style={{ padding: '24px 20px calc(40px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 36px -14px rgba(255,46,136,.8)' }}>
          {step === 'email' ? <Cloud size={30} /> : <Mail size={30} />}
        </div>
        {step === 'email' ? (
          <>
            <div className="seg">
              <div className="seg-thumb" style={{ width: 'calc(50% - 3px)', left: signup ? '50%' : 3 }} />
              <button className={signup ? '' : 'on'} onClick={() => setSignup(false)}>Вход</button>
              <button className={signup ? 'on' : ''} onClick={() => setSignup(true)}>Регистрация</button>
            </div>
            <div>
              <div style={{ font: '800 26px/1.15 var(--sans)', letterSpacing: '-.025em' }}>{signup ? 'Создайте аккаунт' : 'С возвращением'}</div>
              <div style={{ font: '400 15px/1.5 var(--sans)', color: 'var(--tx2)', marginTop: 8 }}>
                {signup
                  ? 'Нужна только почта — без пароля. Воспоминания, планы, фото и билеты будут сохраняться в облаке и появятся на любом телефоне, где вы войдёте.'
                  : 'Введите почту, с которой регистрировались, — пришлём код для входа.'}
              </div>
            </div>
            <div className="field">
              <Mail size={20} />
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="you@example.com" enterKeyHint="send" />
            </div>
            {error === 'NO_ACCOUNT' ? (
              <div style={{ font: '500 14px/1.4 var(--sans)', color: 'var(--danger)' }}>
                Аккаунта с этой почтой нет.{' '}
                <button className="link" style={{ fontSize: 14 }} onClick={() => setSignup(true)}>Зарегистрироваться</button>
              </div>
            ) : (
              error && <div style={{ font: '500 14px/1.4 var(--sans)', color: 'var(--danger)' }}>{error}</div>
            )}
            <button className="btn btn-primary" onClick={send} disabled={busy || !email.trim()}>{busy ? <Spinner /> : signup ? 'Зарегистрироваться' : 'Получить код'}</button>
            <div className="hint">Аккаунт не обязателен: без него всё хранится только на этом устройстве. Концерты, которые уже есть здесь, после входа загрузятся в аккаунт.</div>
          </>
        ) : (
          <>
            <div>
              <div style={{ font: '800 26px/1.15 var(--sans)', letterSpacing: '-.025em' }}>{signup ? 'Подтвердите почту' : 'Введите код из письма'}</div>
              <div style={{ font: '400 15px/1.5 var(--sans)', color: 'var(--tx2)', marginTop: 8 }}>Отправили на <b style={{ color: 'var(--tx)' }}>{email}</b>. Письмо может попасть в «Спам».</div>
            </div>
            <input
              ref={codeInput}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
                setCode(v)
                if (v.length === CODE_LENGTH) verify(v)
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={'•'.repeat(CODE_LENGTH)}
              aria-label="Код из письма"
              className="display"
              style={{ height: 72, borderRadius: 18, background: 'var(--s1)', border: '1px solid var(--line)', outline: 'none', textAlign: 'center', fontSize: 40, letterSpacing: '.3em', color: 'var(--tx)', padding: '0 0 0 .3em' }}
            />
            {error && <div style={{ font: '500 14px/1.4 var(--sans)', color: 'var(--danger)' }}>{error}</div>}
            <button className="btn btn-primary" onClick={() => verify()} disabled={busy || code.length < CODE_LENGTH}>{busy ? <Spinner /> : signup ? 'Создать аккаунт' : 'Войти'}</button>
            <button className="link" style={{ alignSelf: 'center', opacity: cooldown ? 0.5 : 1 }} disabled={!!cooldown || busy} onClick={send}>
              {cooldown ? `Отправить ещё раз через ${cooldown} с` : 'Отправить код ещё раз'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
