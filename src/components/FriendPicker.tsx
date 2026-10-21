import { useNavigate } from 'react-router-dom'
import { Check, UserPlus } from 'lucide-react'
import type { FriendRef } from '../lib/db'
import { toFriendRef, useSocial } from '../lib/social'
import { useSync } from '../lib/sync'
import { Avatar } from './ui'

/** Pick Encore friends for a concert; tagged friends get the card in their app. */
export function FriendPicker({ value, onChange, lockedId }: { value: FriendRef[]; onChange: (v: FriendRef[]) => void; lockedId?: string }) {
  const nav = useNavigate()
  const user = useSync((s) => s.user)
  const friends = useSocial((s) => s.friends)
  if (!user) return null

  // friends first, then anyone already tagged who is no longer in the list
  const all: FriendRef[] = [...friends.map(toFriendRef), ...value.filter((v) => !friends.some((f) => f.id === v.id))]
  const on = (id: string) => value.some((v) => v.id === id)
  const toggle = (f: FriendRef) => {
    if (f.id === lockedId) return
    onChange(on(f.id) ? value.filter((v) => v.id !== f.id) : [...value, f])
  }

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', margin: '0 -20px', padding: '4px 20px 2px' }}>
      {all.map((f) => (
        <button key={f.id} type="button" onClick={() => toggle(f)} style={{ flex: 'none', width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: on(f.id) ? 1 : 0.5 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={f.name} size={52} style={{ boxShadow: on(f.id) ? '0 0 0 2px var(--bg),0 0 0 4px #FF2E88' : 'none' }} />
            {on(f.id) && (
              <div style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, background: 'var(--grad)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Check size={11} strokeWidth={3.5} />
              </div>
            )}
          </div>
          <span className="ellipsis" style={{ maxWidth: 60, font: '600 12px var(--sans)', color: 'var(--tx2)' }}>{f.name}</span>
        </button>
      ))}
      <button type="button" onClick={() => nav('/friends')} style={{ flex: 'none', width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, border: '1.5px dashed var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}>
          <UserPlus size={20} />
        </div>
        <span style={{ font: '500 12px var(--sans)', color: 'var(--tx3)' }}>{all.length ? 'Ещё' : 'Друзья'}</span>
      </button>
    </div>
  )
}
