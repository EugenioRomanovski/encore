import { useEffect, useState } from 'react'
import { Check, Play } from 'lucide-react'
import { friendThumbUrls } from '../lib/social'
import { ph } from '../lib/palette'

/** Grid of a friend's concert photos (signed preview links); optionally selectable. */
export function FriendPhotos({ fromId, photos, videos = [], selected, onToggle, limit }: {
  fromId: string
  photos: string[]
  videos?: string[]
  selected?: Set<string>
  onToggle?: (id: string) => void
  limit?: number
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)
  const key = photos.join(',')

  useEffect(() => {
    let live = true
    if (!photos.length) return
    friendThumbUrls(fromId, photos).then(
      (u) => live && setUrls(u),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, key])

  const shown = limit ? photos.slice(0, limit) : photos
  const more = limit ? photos.length - shown.length : 0

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${limit ? Math.min(limit, 4) : 3},1fr)`, gap: 3 }}>
        {shown.map((id, i) => {
          const on = selected?.has(id)
          const url = urls[id]
          return (
            <button
              key={id}
              type="button"
              disabled={!onToggle}
              onClick={() => onToggle?.(id)}
              aria-pressed={selected ? on : undefined}
              aria-label={videos.includes(id) ? 'Видео друга' : 'Фото друга'}
              style={{
                position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: limit ? 10 : 0,
                background: url ? `#111 center/cover url("${url}")` : ph(i),
                boxShadow: on ? 'inset 0 0 0 3px #FF2E88' : undefined,
                opacity: selected && !on ? 0.55 : 1,
              }}
            >
              {videos.includes(id) && <div style={{ position: 'absolute', left: 6, bottom: 6, color: '#fff', display: 'flex' }}><Play size={15} fill="#fff" /></div>}
              {selected && (
                <div style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: on ? 'var(--grad)' : 'rgba(0,0,0,.25)' }}>
                  {on && <Check size={13} strokeWidth={3.5} />}
                </div>
              )}
              {i === shown.length - 1 && more > 0 && (
                <div className="display" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', background: 'rgba(0,0,0,.45)' }}>+{more}</div>
              )}
            </button>
          )
        })}
      </div>
      {failed && <div className="hint" style={{ marginTop: 6 }}>Не удалось загрузить превью — нет связи?</div>}
    </>
  )
}
