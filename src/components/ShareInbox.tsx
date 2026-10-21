import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { setShareStatus, useSocial } from '../lib/social'
import { stampDow } from '../lib/format'
import { Avatar } from './ui'

/** Concert cards friends tagged you on: "add it to your memories / plans". */
export function ShareInbox({ kind }: { kind: 'memory' | 'event' }) {
  const nav = useNavigate()
  // select the stable array, filter outside: a selector returning a new array re-renders forever
  const inbox = useSocial((s) => s.inbox)
  const items = inbox.filter((x) => x.kind === kind)
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((s) => (
        <div key={s.id} style={{ padding: 1.5, borderRadius: 22, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)', boxShadow: '0 14px 34px -18px rgba(255,46,136,.8)' }}>
          <div style={{ borderRadius: 20.5, background: 'var(--s1)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={s.from.name} size={34} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', background: 'var(--s2)' }} onClick={() => setShareStatus(s.id, 'dismissed')}>Скрыть</button>
              <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => nav(`/${kind === 'memory' ? 'memory' : 'event'}/new?share=${s.id}`)}>
                {kind === 'memory' ? 'Добавить воспоминание' : 'Добавить в планы'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
