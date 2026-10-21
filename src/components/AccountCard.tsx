import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { signOut, syncNow, useSync } from '../lib/sync'
import { pl } from '../lib/format'
import { Spinner } from './ui'
import { useUI } from '../store/ui'

function ago(t: number | null) {
  if (!t) return 'ещё не было'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return 'только что'
  const m = Math.round(s / 60)
  if (m < 60) return `${pl(m, ['минуту', 'минуты', 'минут'])} назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${pl(h, ['час', 'часа', 'часов'])} назад`
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function AccountCard() {
  const nav = useNavigate()
  const say = useUI((s) => s.say)
  const { ready, user, status, lastSync, pending, downloading, error } = useSync()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!ready) return null

  if (!user) {
    return (
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cloud size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 15px var(--sans)' }}>Синхронизация выключена</div>
            <div style={{ font: '400 13px/1.4 var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>С аккаунтом концерты, фото и билеты хранятся в облаке и есть на всех устройствах</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', background: 'var(--s2)' }} onClick={() => nav('/account')}>Войти</button>
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => nav('/account?mode=signup')}>Зарегистрироваться</button>
        </div>
      </div>
    )
  }

  const line =
    status === 'syncing'
      ? downloading
        ? `Загружаем фото · осталось ${downloading}`
        : 'Синхронизация…'
      : status === 'offline'
        ? `Нет сети — синхронизируем, когда появится${pending ? ` · ждут ${pending}` : ''}`
        : status === 'error'
          ? error || 'Ошибка синхронизации'
          : pending
            ? `Ждут отправки: ${pending}`
            : `Синхронизировано ${ago(lastSync)}`

  const logout = async () => {
    if (!confirm('Выйти из аккаунта? Данные останутся на этом устройстве, но перестанут синхронизироваться.')) return
    await signOut()
    say('Вы вышли из аккаунта')
  }

  return (
    <div className="list">
      <div className="list-row">
        <div className="list-ico" style={{ background: status === 'error' ? 'rgba(255,90,95,.14)' : 'var(--okbg)', color: status === 'error' ? 'var(--danger)' : 'var(--ok)' }}>
          {status === 'offline' ? <CloudOff size={18} /> : <Cloud size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="list-title ellipsis">{user.email}</div>
          <div className="list-sub" style={{ color: status === 'error' ? 'var(--danger)' : undefined }}>{line}</div>
        </div>
        <button aria-label="Синхронизировать сейчас" onClick={() => syncNow()} disabled={status === 'syncing'} style={{ width: 40, height: 40, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx2)' }}>
          {status === 'syncing' ? <Spinner dark /> : <RefreshCw size={19} />}
        </button>
      </div>
      <button className="list-row" onClick={logout}>
        <div className="list-ico" style={{ background: 'var(--s2)', color: 'var(--tx2)' }}><LogOut size={18} /></div>
        <div style={{ flex: 1 }} className="list-title">Выйти из аккаунта</div>
      </button>
    </div>
  )
}
