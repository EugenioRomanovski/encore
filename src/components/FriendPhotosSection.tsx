import { useEffect, useState } from 'react'
import { db, type Memory } from '../lib/db'
import { fetchShare, importFriendPhotos, type Share } from '../lib/social'
import { useSync } from '../lib/sync'
import { FriendPhotos } from './FriendPhotos'
import { Label, Spinner } from './ui'
import { useUI } from '../store/ui'

/** On a memory created from a friend's card: their photos not copied yet, with "add". */
export function FriendPhotosSection({ m }: { m: Memory }) {
  const say = useUI((s) => s.say)
  const signedIn = useSync((s) => !!s.user)
  const [card, setCard] = useState<Share | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const origin = m.sharedFrom

  useEffect(() => {
    if (!origin || !signedIn) return
    let live = true
    fetchShare(origin.shareId).then((c) => live && setCard(c), () => {})
    return () => {
      live = false
    }
  }, [origin, signedIn])

  const done = new Set(m.importedPhotos || [])
  const left = (card?.payload.photos || []).filter((id) => !done.has(id))
  useEffect(() => setSel(new Set(left)), [left.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!origin || !card || !left.length) return null
  const name = m.friends?.find((f) => f.id === origin.userId)?.name || `@${origin.username}`

  const add = async () => {
    const ids = left.filter((id) => sel.has(id))
    if (!ids.length) return
    setBusy(true)
    try {
      const copied = await importFriendPhotos(card.from.id, ids, card.payload.videos)
      await db.transaction('rw', db.media, db.memories, async () => {
        await db.media.bulkPut(copied)
        const cur = (await db.memories.get(m.id))!
        const mediaIds = [...cur.mediaIds, ...copied.map((x) => x.id)]
        await db.memories.update(m.id, {
          mediaIds,
          coverId: cur.coverId || mediaIds[0],
          importedPhotos: [...(cur.importedPhotos || []), ...ids],
          updatedAt: Date.now(),
        })
      })
      say(`Добавлено фото: ${copied.length}`)
    } catch {
      say('Не удалось загрузить фото — нет связи?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section">
      <Label right={<button className="link" onClick={() => setSel(sel.size ? new Set() : new Set(left))}>{sel.size ? 'Снять все' : 'Выбрать все'}</button>}>
        Фото от {name} · {left.length}
      </Label>
      <div style={{ margin: '0 -20px' }}>
        <FriendPhotos fromId={card.from.id} photos={left} videos={card.payload.videos} selected={sel} onToggle={(id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })} />
      </div>
      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={add} disabled={busy || !sel.size}>
        {busy ? <Spinner /> : `Добавить в моё воспоминание · ${sel.size}`}
      </button>
    </div>
  )
}
