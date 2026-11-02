import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Merge, MapPin } from 'lucide-react'
import { setShareStatus, useSocial, type Share } from '../lib/social'
import { findMatch, mergeShareInto } from '../lib/merge'
import { useUI } from '../store/ui'
import { stampDow } from '../lib/format'
import { Avatar } from './ui'
import { FriendPhotos } from './FriendPhotos'

/** Concert cards friends tagged you on: "add it to your memories / plans". */
export function ShareInbox({ kind }: { kind: 'memory' | 'event' }) {
  // select the stable array, filter outside: a selector returning a new array re-renders forever
  const inbox = useSocial((s) => s.inbox)
  const items = inbox.filter((x) => x.kind === kind)
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((s) => <ShareCard key={s.id} s={s} kind={kind} />)}
    </div>
  )
}

function ShareCard({ s, kind }: { s: Share; kind: 'memory' | 'event' }) {
  const nav = useNavigate()
  const say = useUI((x) => x.say)
  // the same concert may already be here (added yourself, or an earlier card from this friend)
  const match = useLiveQuery(() => findMatch(s.payload), [s.id])

  const add = async () => {
    if (!match) return nav(`/${kind === 'memory' ? 'memory' : 'event'}/new?share=${s.id}`)
    const freshPhotos = (s.payload.photos || []).filter((x) => !(match.kind === 'memory' && match.rec.importedPhotos?.includes(x)))
    // photos to pick, or a plan turning into a memory: go through the form
    if (s.kind === 'memory' && match.kind === 'event') return nav(`/memory/new?fromEvent=${match.rec.id}&share=${s.id}`)
    if (s.kind === 'memory' && freshPhotos.length) return nav(`/memory/${match.rec.id}/edit?share=${s.id}`)
    await mergeShareInto(match, s)
    setShareStatus(s.id, 'added')
    say('Объединено с вашим концертом')
    nav(`/${match.kind}/${match.rec.id}`)
  }

  return (
        <div style={{ padding: 1.5, borderRadius: 22, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)', boxShadow: '0 14px 34px -18px rgba(255,46,136,.8)' }}>
          <div style={{ borderRadius: 20.5, background: 'var(--s1)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={s.from.name} src={s.from.avatar} size={34} />
              <div style={{ flex: 1, minWidth: 0, font: '500 13px/1.35 var(--sans)', color: 'var(--tx2)' }}>
                <b style={{ color: 'var(--tx)' }}>{s.from.name}</b> <span className="mono" style={{ fontSize: 12 }}>@{s.from.username}</span>
                <div>{kind === 'memory' ? 'отметил(а) вас на концерте' : 'зовёт вас на концерт'}</div>
              </div>
            </div>
            <div>
              <div className="display ellipsis" style={{ fontSize: 30, lineHeight: 1 }}>{s.payload.artist}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span className="stamp" style={{ borderColor: 'var(--line2)' }}>{stampDow(s.payload.date)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 13px var(--sans)', color: 'var(--tx2)', minWidth: 0 }}>
                  <MapPin size={14} color="var(--mag)" style={{ flex: 'none' }} /><span className="ellipsis">{s.payload.venue}</span>
                </span>
              </div>
            </div>
            {kind === 'memory' && !!s.payload.photos?.length && (
              <div>
                <FriendPhotos fromId={s.from.id} photos={s.payload.photos} videos={s.payload.videos} limit={4} />
                <div className="hint" style={{ marginTop: 6 }}>Фото можно добавить к своему воспоминанию</div>
              </div>
            )}
            {match && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1.35 var(--sans)', color: 'var(--tx2)' }}>
                <Merge size={16} color="var(--mag)" style={{ flex: 'none' }} />
                {match.kind === 'memory' ? 'У вас уже есть воспоминание об этом концерте' : 'Этот концерт уже у вас в планах'} — объединим их
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', background: 'var(--s2)' }} onClick={() => setShareStatus(s.id, 'dismissed')}>Скрыть</button>
              <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={add}>
                {match ? 'Объединить' : kind === 'memory' ? 'Добавить воспоминание' : 'Добавить в планы'}
              </button>
            </div>
          </div>
        </div>
  )
}
