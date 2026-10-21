import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Contrast, Download, MapPin, Pencil, Sparkles, Trash2, Upload } from 'lucide-react'
import { db, wipeAll } from '../lib/db'
import { pl, year } from '../lib/format'
import { exportBackup, importBackup } from '../lib/backup'
import { DEMO_MEMORIES, hasOwnConcerts, loadDemo, removeDemo } from '../lib/demo'
import { pickFiles } from '../lib/media'
import { initials } from '../lib/palette'
import { useUI } from '../store/ui'
import { AccountCard } from '../components/AccountCard'
import { FriendsCard } from '../components/FriendsCard'
import { pushDisplayName, removeAvatar, setAvatar, useMyAvatar, useSocial } from '../lib/social'
import { squareImage } from '../lib/media'
import { useState } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import { signOutAndWipe, useSync } from '../lib/sync'

export default function Profile() {
  const { theme, setTheme, name, setName, say, setBusy } = useUI()
  const stats = useLiveQuery(async () => {
    const ms = await db.memories.toArray()
    const count = (key: (m: (typeof ms)[number]) => string) => {
      const c = new Map<string, { n: number; first: string }>()
      for (const m of ms) {
        const k = key(m)
        const cur = c.get(k)
        c.set(k, { n: (cur?.n || 0) + 1, first: cur && cur.first < m.date ? cur.first : m.date })
      }
      return [...c.entries()].sort((a, b) => b[1].n - a[1].n)
    }
    const artists = count((m) => m.artist)
    const venues = count((m) => m.venue)
    const since = ms.length ? Math.min(...ms.map((m) => year(m.date))) : null
    const demo = await db.memories.get(DEMO_MEMORIES[0].id)
    return { total: ms.length, artists, venues, since, demo: !!demo, own: await hasOwnConcerts() }
  }, [])

  const username = useSocial((s) => s.profile?.username)
  const avatar = useMyAvatar()
  const [avatarSheet, setAvatarSheet] = useState(false)

  const pickAvatar = async () => {
    setAvatarSheet(false)
    const [f] = await pickFiles('image/*')
    if (!f) return
    setBusy('Сохраняем фото…')
    try {
      await setAvatar(await squareImage(f))
      say('Фото профиля обновлено')
    } catch (e) {
      console.warn(e)
      say('Фото сохранено на устройстве — в аккаунт загрузим при следующей синхронизации')
    } finally {
      setBusy(null)
    }
  }

  const dropAvatar = async () => {
    setAvatarSheet(false)
    try {
      await removeAvatar()
      say('Фото удалено')
    } catch {
      say('Нет связи — попробуйте ещё раз')
    }
  }

  const editName = () => {
    const n = prompt('Как вас зовут?', name)
    if (n === null) return
    setName(n.trim())
    pushDisplayName(n.trim()).catch(() => {})
  }

  const doExport = async () => {
    setBusy('Готовим копию…')
    try {
      await exportBackup()
    } finally {
      setBusy(null)
    }
  }

  const doImport = async () => {
    const [f] = await pickFiles('application/zip,.zip,application/json,.json')
    if (!f) return
    setBusy('Восстанавливаем…')
    try {
      const r = await importBackup(f)
      say(`Восстановлено: ${pl(r.memories, ['воспоминание', 'воспоминания', 'воспоминаний'])}, ${pl(r.events, ['план', 'плана', 'планов'])}, ${pl(r.tickets, ['билет', 'билета', 'билетов'])}`)
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    } finally {
      setBusy(null)
    }
  }

  const signedIn = useSync((s) => !!s.user)

  const wipe = async () => {
    if (signedIn) {
      if (!confirm('Выйти и удалить все данные с этого устройства? В облаке они останутся и вернутся, когда вы снова войдёте.')) return
      setBusy('Выходим…')
      try {
        await signOutAndWipe(wipeAll)
      } finally {
        setBusy(null)
      }
      return say('Устройство очищено')
    }
    if (!confirm('Удалить все воспоминания, планы и билеты с этого устройства? Это нельзя отменить.')) return
    await wipeAll()
    say('Все данные удалены')
  }

  const top = stats?.artists[0]
  const maxVenue = stats?.venues[0]?.[1].n || 1

  return (
    <div className="screen with-tabs">
      <div style={{ padding: 'calc(var(--sat) + 20px) 20px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setAvatarSheet(true)} aria-label="Фото профиля" style={{ position: 'relative', width: 72, height: 72, borderRadius: 36, padding: 3, background: 'linear-gradient(135deg,#FF2E88,#FF8A2B)', flex: 'none' }}>
            <div className="display" style={{ width: '100%', height: '100%', borderRadius: 33, background: 'var(--s2)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, overflow: 'hidden' }}>
              {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name ? initials(name) : '★'}
            </div>
            <div style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, background: 'var(--s1)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx)' }}>
              <Camera size={13} />
            </div>
          </button>
          <button onClick={editName} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="ellipsis" style={{ font: '800 24px/1.1 var(--sans)', letterSpacing: '-.02em', color: name ? 'var(--tx)' : 'var(--tx3)' }}>{name || 'Как вас зовут?'}</div>
            {username && <div className="mono ellipsis" style={{ fontSize: 13, color: 'var(--mag)', marginTop: 4 }}>@{username}</div>}
            <div className="mono-label" style={{ letterSpacing: '.12em', marginTop: 5 }}>{stats?.since ? `НА КОНЦЕРТАХ С ${stats.since}` : 'ДОБАВЬТЕ ПЕРВЫЙ КОНЦЕРТ'}</div>
          </button>
          <button className="icon-btn" aria-label="Изменить имя" onClick={editName}><Pencil size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { n: stats?.total ?? 0, l: ['концерт', 'концерта', 'концертов'] as [string, string, string], g: true },
            { n: stats?.artists.length ?? 0, l: ['артист', 'артиста', 'артистов'] as [string, string, string] },
            { n: stats?.venues.length ?? 0, l: ['площадка', 'площадки', 'площадок'] as [string, string, string] },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className={'display' + (s.g ? ' grad-text' : '')} style={{ fontSize: 40, lineHeight: 1 }}>{s.n}</div>
              <div style={{ font: '500 13px var(--sans)', color: 'var(--tx2)', marginTop: 6 }}>{pl(s.n, s.l).replace(/^\d+ /, '').replace(/^./, (c) => c.toUpperCase())}</div>
            </div>
          ))}
        </div>

        {top && (
          <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, background: 'linear-gradient(110deg,#2a0f1c,#1a1a22 70%)', border: '1px solid var(--line)', color: '#fff' }}>
            <div style={{ width: 60, height: 60, flex: 'none', borderRadius: 16, background: 'radial-gradient(70% 60% at 30% 25%,#FF2E88,transparent 65%),radial-gradient(60% 50% at 80% 40%,#FF7A2F,transparent 60%),#160c12' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '500 10px var(--mono)', letterSpacing: '.16em', color: 'rgba(255,255,255,.6)' }}>ЧАЩЕ ВСЕГО</div>
              <div className="display ellipsis" style={{ fontSize: 26, lineHeight: 1, marginTop: 5 }}>{top[0]}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div className="display" style={{ fontSize: 34, lineHeight: 1, color: '#FF8A2B' }}>×{top[1].n}</div>
              <div style={{ font: '500 11px var(--sans)', color: 'rgba(255,255,255,.6)' }}>с {year(top[1].first)}</div>
            </div>
          </div>
        )}

        {stats && stats.venues.length > 0 && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: '700 16px var(--sans)' }}>Любимые площадки</span>
              <span className="mono-label" style={{ fontSize: 10, letterSpacing: '.14em' }}>{pl(stats.venues.length, ['площадка', 'площадки', 'площадок'])}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {stats.venues.slice(0, 5).map(([v, s], i) => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? 'var(--grad2)' : 'var(--s2)', color: i === 0 ? '#fff' : 'var(--mag)' }}><MapPin size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="ellipsis" style={{ font: '600 14px var(--sans)' }}>{v}</span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--tx3)', flex: 'none' }}>×{s.n}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--s2)', marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(s.n / maxVenue) * 100}%`, borderRadius: 2, background: 'linear-gradient(90deg,#FF2E88,#FF8A2B)', boxShadow: '0 0 8px rgba(255,46,136,.6)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="mono-label" style={{ padding: '4px 4px 0' }}>Друзья</span>
          <FriendsCard />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="mono-label" style={{ padding: '4px 4px 0' }}>Аккаунт</span>
          <AccountCard />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="mono-label" style={{ padding: '4px 4px 0' }}>Настройки</span>
          <div className="list">
            <div className="list-row">
              <div className="list-ico" style={{ background: 'rgba(255,46,136,.16)', color: 'var(--mag)' }}><Contrast size={18} /></div>
              <div style={{ flex: 1 }} className="list-title">Оформление</div>
              <div style={{ display: 'flex', height: 32, padding: 2, borderRadius: 9, background: 'var(--s2)' }}>
                {(['dark', 'light'] as const).map((t) => (
                  <button key={t} onClick={() => setTheme(t)} style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 7, font: '600 13px var(--sans)', background: theme === t ? 'var(--seg)' : 'transparent' }}>
                    {t === 'dark' ? 'Тёмное' : 'Светлое'}
                  </button>
                ))}
              </div>
            </div>
            <button className="list-row" onClick={doExport}>
              <div className="list-ico" style={{ background: 'rgba(123,97,255,.18)', color: 'var(--vi)' }}><Download size={18} /></div>
              <div style={{ flex: 1 }}><div className="list-title">Резервная копия</div><div className="list-sub">Файл .zip на этом устройстве: фото, видео, билеты</div></div>
              <ChevronRight size={20} color="var(--tx3)" />
            </button>
            <button className="list-row" onClick={doImport}>
              <div className="list-ico" style={{ background: 'rgba(61,220,151,.16)', color: 'var(--ok)' }}><Upload size={18} /></div>
              <div style={{ flex: 1 }}><div className="list-title">Восстановить из копии</div><div className="list-sub">Файл копии .zip</div></div>
              <ChevronRight size={20} color="var(--tx3)" />
            </button>
            {/* demo data is offered only until the first own concert; once loaded it can always be removed */}
            {stats && (stats.demo || !stats.own) && (
              <button className="list-row" onClick={() => (stats.demo ? removeDemo().then(() => say('Демо-данные убраны')) : loadDemo().then(() => say('Демо-данные загружены')))}>
                <div className="list-ico" style={{ background: 'rgba(255,138,43,.16)', color: '#FF8A2B' }}><Sparkles size={18} /></div>
                <div style={{ flex: 1 }} className="list-title">{stats.demo ? 'Убрать демо-данные' : 'Загрузить демо-данные'}</div>
                <ChevronRight size={20} color="var(--tx3)" />
              </button>
            )}
            <button className="list-row" onClick={wipe}>
              <div className="list-ico" style={{ background: 'rgba(255,90,95,.14)', color: 'var(--danger)' }}><Trash2 size={18} /></div>
              <div style={{ flex: 1, color: 'var(--danger)' }} className="list-title">{signedIn ? 'Выйти и очистить устройство' : 'Удалить все данные'}</div>
            </button>
          </div>
          <div className="hint" style={{ padding: '6px 4px 0' }}>
            {signedIn
              ? 'Концерты синхронизируются с облаком (кроме демо-данных). Резервная копия — отдельный файл .zip: он сохраняется только на этом устройстве, в облако не попадает.'
              : 'Без аккаунта концерты хранятся только на этом устройстве. Резервная копия .zip тоже сохраняется только на нём — перенесите файл в iCloud Drive или на компьютер, чтобы не потерять его вместе с телефоном.'}
          </div>
          <div className="mono" style={{ textAlign: 'center', fontSize: 10, fontWeight: 500, letterSpacing: '.16em', color: 'var(--tx3)', padding: '14px 0 0' }}>ENCORE 0.1</div>
        </div>
      </div>
      {avatarSheet && (
        <>
          <div className="backdrop" onClick={() => setAvatarSheet(false)} />
          <div className="sheet fixed-col" role="dialog" aria-label="Фото профиля">
            <div className="sheet-grip" />
            <div className="sheet-title" style={{ padding: '0 4px 14px' }}>Фото профиля</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="sheet-row" onClick={pickAvatar}>
                <div className="sheet-ico" style={{ background: 'linear-gradient(135deg,#FF2E88,#FF8A2B)' }}><ImagePlus size={22} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 16px var(--sans)' }}>{avatar ? 'Выбрать другое фото' : 'Выбрать фото'}</div>
                  <div style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>Из галереи или с камеры</div>
                </div>
              </button>
              {avatar && (
                <button className="sheet-row" onClick={dropAvatar}>
                  <div className="sheet-ico" style={{ background: 'rgba(255,90,95,.16)', color: 'var(--danger)' }}><Trash2 size={22} /></div>
                  <div style={{ flex: 1, font: '700 16px var(--sans)', color: 'var(--danger)' }}>Удалить фото</div>
                </button>
              )}
              <button className="btn btn-secondary" style={{ background: 'var(--s2)', marginTop: 4 }} onClick={() => setAvatarSheet(false)}>Отмена</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
