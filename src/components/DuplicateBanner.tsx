import { useLiveQuery } from 'dexie-react-hooks'
import { Merge } from 'lucide-react'
import { db, type Memory, type PlannedEvent } from '../lib/db'
import { findDuplicates, mergeEvents, mergeMemories } from '../lib/merge'
import { useUI } from '../store/ui'

/** "This concert is here twice" — offered when another memory / plan has the same date and artist. */
export function DuplicateBanner(props: { kind: 'memory'; rec: Memory } | { kind: 'event'; rec: PlannedEvent }) {
  const say = useUI((s) => s.say)
  const { rec } = props
  const table = props.kind === 'memory' ? 'memories' : 'events'
  const dups = useLiveQuery(() => findDuplicates(table, rec), [table, rec.id, rec.artist, rec.date])
  if (!dups?.length) return null

  const merge = async () => {
    // this one stays; the others' photos, company, notes and tickets move into it
    for (const d of dups) {
      if (props.kind === 'memory') await mergeMemories((await db.memories.get(rec.id))!, d as Memory)
      else await mergeEvents((await db.events.get(rec.id))!, d as PlannedEvent)
    }
    say('Объединено')
  }

  return (
    <div className="card" data-testid="duplicate-banner" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid rgba(255,46,136,.35)' }}>
      <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--af)', color: 'var(--mag)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Merge size={20} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '600 15px var(--sans)' }}>Этот концерт у вас {dups.length > 1 ? `${dups.length + 1} раза` : 'дважды'}</div>
        <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>Объединим фото, друзей, заметки и билеты в одну карточку</div>
      </div>
      <button className="btn btn-primary btn-sm" style={{ flex: 'none' }} onClick={merge}>Объединить</button>
    </div>
  )
}

