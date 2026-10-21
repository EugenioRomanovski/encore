import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AtSign, Check, ChevronLeft, User, X } from 'lucide-react'
import { isUsernameFree, normalizeUsername, saveProfile, usernameProblem, useSocial } from '../lib/social'
import { useSync } from '../lib/sync'
import { Label, Spinner } from '../components/ui'
import { useUI } from '../store/ui'

export default function Username() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const { name, say } = useUI()
  const user = useSync((s) => s.user)
  const profile = useSocial((s) => s.profile)
  const [username, setUsername] = useState(profile?.username || '')
  const [display, setDisplay] = useState(profile?.display_name || name)
  const [free, setFree] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/account', { replace: true })
  }, [user, nav])

  useEffect(() => {
    if (profile?.username && !username) setUsername(profile.username)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username])

  const problem = username ? usernameProblem(username) : null
  useEffect(() => {
    setFree(null)
    if (!username || problem || username === profile?.username) return
    setChecking(true)
    const t = setTimeout(() => {
      isUsernameFree(username).then(setFree, () => setFree(null)).finally(() => setChecking(false))
    }, 350)
    return () => {
      clearTimeout(t)
      setChecking(false)
    }
  }, [username, problem, profile?.username])

  const same = username === profile?.username
  const canSave = !!username && !problem && (same || free === true) && !busy

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveProfile(username, display)
      say(profile ? 'Профиль обновлён' : `Вы — @${username}`)
      nav(next || '/profile', { replace: true })
    } catch (e) {
      setError((e as Error).message || 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="navbar">
        <div className="navbar-grid">
          <button className="nav-link" style={{ color: 'var(--mag)' }} onClick={() => nav(-1)}><ChevronLeft size={20} />Назад</button>
          <div className="navbar-title">Имя пользователя</div>
          <button className="nav-link accent" onClick={save} disabled={!canSave}>Готово</button>
        </div>
      </div>
      <div style={{ padding: '20px 20px calc(40px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ font: '800 26px/1.15 var(--sans)', letterSpacing: '-.025em' }}>{profile ? 'Ваш профиль' : 'Как вас найти?'}</div>
          <div style={{ font: '400 15px/1.5 var(--sans)', color: 'var(--tx2)', marginTop: 8 }}>По имени пользователя друзья находят вас и добавляют в друзья. Его видят все, у кого есть Encore.</div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Имя пользователя</Label>
          <div className="field" style={{ borderColor: problem || free === false ? 'var(--danger)' : free ? 'var(--ok)' : undefined }}>
            <AtSign size={20} />
            <input value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_.]/g, ''))} placeholder="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={24} />
            {checking ? <Spinner dark /> : free === true || (same && username) ? <Check size={20} color="var(--ok)" /> : free === false ? <X size={20} color="var(--danger)" /> : null}
          </div>
          <div className="hint" style={{ color: problem || free === false ? 'var(--danger)' : undefined }}>
            {problem || (free === false ? 'Это имя уже занято' : 'Латиница, цифры, «_» и «.», от 3 до 24 символов')}
          </div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Имя</Label>
          <div className="field"><User size={20} /><input value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Как вас зовут" maxLength={60} /></div>
          <div className="hint">Так вас увидят друзья. Синхронизируется на всех ваших устройствах.</div>
        </div>
        {error && <div style={{ font: '500 14px/1.4 var(--sans)', color: 'var(--danger)' }}>{error}</div>}
        <button className="btn btn-primary" onClick={save} disabled={!canSave}>{busy ? <Spinner /> : 'Сохранить'}</button>
      </div>
    </div>
  )
}
