import { useNavigate } from 'react-router-dom'
import { AtSign, ChevronRight, Users } from 'lucide-react'
import { useSocial } from '../lib/social'
import { useSync } from '../lib/sync'
import { pl } from '../lib/format'
import { Avatar } from './ui'

/** Profile block: friends, pending requests, or a prompt to pick a username first. */
export function FriendsCard() {
  const nav = useNavigate()
  const user = useSync((s) => s.user)
  const { profile, friends, incoming } = useSocial()

  if (!user) {
    return (
      <button className="card" onClick={() => nav('/account?mode=signup')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', width: '100%' }}>
        <div className="list-ico" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(123,97,255,.18)', color: 'var(--vi)' }}><Users size={20} /></div>
        <div style={{ flex: 1, font: '400 13px/1.4 var(--sans)', color: 'var(--tx2)' }}>
          <div style={{ font: '700 15px var(--sans)', color: 'var(--tx)' }}>Друзья</div>
          С аккаунтом можно добавлять друзей и отмечать их на концертах
        </div>
        <ChevronRight size={20} color="var(--tx3)" />
      </button>
    )
  }

  if (profile === null) {
    return (
      <button className="card" onClick={() => nav('/username?next=/friends')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', width: '100%' }}>
        <div className="list-ico" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--grad2)', color: '#fff' }}><AtSign size={20} /></div>
        <div style={{ flex: 1, font: '400 13px/1.4 var(--sans)', color: 'var(--tx2)' }}>
          <div style={{ font: '700 15px var(--sans)', color: 'var(--tx)' }}>Выберите имя пользователя</div>
          По нему друзья найдут вас в Encore
        </div>
        <ChevronRight size={20} color="var(--tx3)" />
      </button>
    )
  }

  return (
    <button className="card" onClick={() => nav('/friends')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', width: '100%' }}>
      {friends.length ? (
        <div style={{ display: 'flex', flex: 'none' }}>
          {friends.slice(0, 3).map((f) => <Avatar key={f.id} name={f.name} src={f.avatar} size={36} style={{ marginRight: -10, border: '2px solid var(--s1)' }} />)}
        </div>
      ) : (
        <div className="list-ico" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(123,97,255,.18)', color: 'var(--vi)' }}><Users size={20} /></div>
      )}
      <div style={{ flex: 1, minWidth: 0, marginLeft: friends.length ? 10 : 0 }}>
        <div style={{ font: '700 15px var(--sans)' }}>{friends.length ? pl(friends.length, ['друг', 'друга', 'друзей']) : 'Найти друзей'}</div>
        <div className="ellipsis" style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>
          {friends.length ? friends.map((f) => f.name).join(', ') : 'Поиск по имени пользователя'}
        </div>
      </div>
      {incoming.length > 0 && (
        <span style={{ flex: 'none', minWidth: 22, height: 22, padding: '0 7px', borderRadius: 11, background: 'var(--grad)', color: '#fff', font: '700 12px/22px var(--sans)', textAlign: 'center' }} aria-label={`Запросов: ${incoming.length}`}>
          {incoming.length}
        </span>
      )}
      <ChevronRight size={20} color="var(--tx3)" />
    </button>
  )
}
