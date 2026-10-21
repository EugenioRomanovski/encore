import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, Search, UserMinus, UserPlus, X } from 'lucide-react'
import { acceptFriend, refreshFriends, removeFriend, searchPeople, sendFriendRequest, useSocial, type Person } from '../lib/social'
import { useSync } from '../lib/sync'
import { pl } from '../lib/format'
import { Avatar, Label, Spinner } from '../components/ui'
import { useUI } from '../store/ui'

function Row({ p, children }: { p: Person; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
      <Avatar name={p.name} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ font: '600 15px var(--sans)' }}>{p.name}</div>
        <div className="ellipsis mono" style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>@{p.username}</div>
      </div>
      {children}
    </div>
  )
}

const pill = (accent: boolean) =>
  ({
    height: 34, padding: '0 14px', borderRadius: 17, display: 'flex', alignItems: 'center', gap: 6, font: '700 13px var(--sans)', flex: 'none',
    ...(accent ? { background: 'var(--grad)', color: '#fff' } : { background: 'var(--s2)', color: 'var(--tx2)' }),
  }) as const

export default function Friends() {
  const nav = useNavigate()
  const say = useUI((s) => s.say)
  const user = useSync((s) => s.user)
  const ready = useSync((s) => s.ready)
  const { profile, friends, incoming, outgoing } = useSocial()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (user) refreshFriends().catch(() => {})
  }, [user])

  useEffect(() => {
    if (q.replace(/^@/, '').trim().length < 2) return setResults(null)
    setSearching(true)
    const t = setTimeout(() => {
      searchPeople(q).then(setResults, () => setResults([])).finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  if (ready && !user) return <Navigate to="/account" replace />
  if (profile === null) return <Navigate to="/username?next=/friends" replace />

  const act = async (id: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(id)
    try {
      await fn()
      if (done) say(done)
    } catch {
      say('Нет связи — попробуйте ещё раз')
    } finally {
      setBusy(null)
    }
  }

  const relation = (p: Person) =>
    friends.some((f) => f.id === p.id) ? 'friend' : incoming.some((f) => f.id === p.id) ? 'incoming' : outgoing.some((f) => f.id === p.id) ? 'outgoing' : 'none'

  const request = (p: Person) =>
    act(p.id, async () => {
      const r = await sendFriendRequest(p.username)
      say(r === 'accepted' ? `Теперь вы друзья с @${p.username}` : r === 'requested' ? 'Запрос отправлен' : r === 'friends' ? 'Вы уже друзья' : 'Запрос уже отправлен')
    })

  const unfriend = (p: Person) => {
    if (!confirm(`Удалить ${p.name} (@${p.username}) из друзей?`)) return
    act(p.id, () => removeFriend(p.id), 'Удалено из друзей')
  }

  const actionFor = (p: Person) => {
    if (busy === p.id) return <Spinner dark />
    switch (relation(p)) {
      case 'friend':
        return <span style={{ ...pill(false), background: 'var(--okbg)', color: 'var(--ok)' }}><Check size={14} />Друзья</span>
      case 'incoming':
        return <button style={pill(true)} onClick={() => act(p.id, () => acceptFriend(p.id), `Теперь вы друзья с @${p.username}`)}><Check size={14} />Принять</button>
      case 'outgoing':
        return <button style={pill(false)} onClick={() => act(p.id, () => removeFriend(p.id), 'Запрос отменён')}>Отменить</button>
      default:
        return <button style={pill(true)} onClick={() => request(p)}><UserPlus size={14} />Добавить</button>
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 'calc(40px + var(--sab))' }}>
      <div className="navbar">
        <div className="navbar-grid">
          <button className="nav-link" style={{ color: 'var(--mag)' }} onClick={() => nav(-1)}><ChevronLeft size={20} />Назад</button>
          <div className="navbar-title">Друзья</div>
          <div />
        </div>
        <div style={{ padding: '8px 12px 4px' }}>
          <div className="field">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по имени пользователя" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
            {q && <button aria-label="Очистить" onClick={() => setQ('')} style={{ display: 'flex', color: 'var(--tx3)' }}><X size={18} /></button>}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {profile && (
          <div className="hint" style={{ textAlign: 'center' }}>
            Ваше имя пользователя — <b className="mono" style={{ color: 'var(--tx)' }}>@{profile.username}</b>. Назовите его другу, чтобы он вас нашёл.
          </div>
        )}

        {results !== null && (
          <div className="section" style={{ gap: 8 }}>
            <Label right={searching && <Spinner dark />}>Поиск</Label>
            {results.length ? (
              <div className="list">{results.map((p) => <Row key={p.id} p={p}>{actionFor(p)}</Row>)}</div>
            ) : (
              !searching && <div className="hint">Никого не нашли. Проверьте имя пользователя — оно пишется латиницей.</div>
            )}
          </div>
        )}

        {incoming.length > 0 && (
          <div className="section" style={{ gap: 8 }}>
            <Label>Запросы в друзья · {incoming.length}</Label>
            <div className="list">
              {incoming.map((p) => (
                <Row key={p.id} p={p}>
                  {busy === p.id ? <Spinner dark /> : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button aria-label="Отклонить" style={{ ...pill(false), padding: 0, width: 34, justifyContent: 'center' }} onClick={() => act(p.id, () => removeFriend(p.id), 'Запрос отклонён')}><X size={16} /></button>
                      <button style={pill(true)} onClick={() => act(p.id, () => acceptFriend(p.id), `Теперь вы друзья с @${p.username}`)}><Check size={14} />Принять</button>
                    </div>
                  )}
                </Row>
              ))}
            </div>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="section" style={{ gap: 8 }}>
            <Label>Отправленные запросы</Label>
            <div className="list">
              {outgoing.map((p) => (
                <Row key={p.id} p={p}>
                  {busy === p.id ? <Spinner dark /> : <button style={pill(false)} onClick={() => act(p.id, () => removeFriend(p.id), 'Запрос отменён')}>Отменить</button>}
                </Row>
              ))}
            </div>
          </div>
        )}

        <div className="section" style={{ gap: 8 }}>
          <Label>{friends.length ? pl(friends.length, ['друг', 'друга', 'друзей']) : 'Друзья'}</Label>
          {friends.length ? (
            <div className="list">
              {friends.map((p) => (
                <Row key={p.id} p={p}>
                  {busy === p.id ? <Spinner dark /> : (
                    <button aria-label={`Удалить ${p.name} из друзей`} onClick={() => unfriend(p)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}>
                      <UserMinus size={18} />
                    </button>
                  )}
                </Row>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 18, font: '400 14px/1.5 var(--sans)', color: 'var(--tx2)' }}>
              Пока никого. Найдите друга по имени пользователя — после этого его можно отмечать на концертах, и карточка концерта появится у него в Encore.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
