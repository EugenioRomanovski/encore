import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, DoorOpen, ImagePlus, MapPin, Mic, Music, Sparkles, X } from 'lucide-react'
import { db, deleteMedia, uid, type FriendRef, type PlannedEvent, type ShareOrigin } from '../lib/db'
import { pickFiles, saveImageAsMedia } from '../lib/media'
import { longDate, todayISO } from '../lib/format'
import { paletteFor } from '../lib/palette'
import { useSuggestions } from '../lib/suggest'
import { Cover } from '../components/Cover'
import { Label, Spinner } from '../components/ui'
import { FriendPicker } from '../components/FriendPicker'
import { findShare, setShareStatus } from '../lib/social'
import { useSync } from '../lib/sync'
import { useUI } from '../store/ui'

export default function EventForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const returnTo = (loc.state as { returnTo?: string } | null)?.returnTo
  const [params] = useSearchParams()
  const shareId = params.get('share')
  const { say, setBusy } = useUI()
  // creating a plan for a ticket being added: offer what was read from the ticket
  const draft = useUI((s) => s.draft)
  const hints = !id && returnTo?.startsWith('/tickets/assign') ? draft?.hints : undefined
  const hasHints = !!hints && (hints.artists.length + hints.tours.length + hints.venues.length + hints.dates.length > 0 || !!hints.doors || !!hints.show)
  const sugg = useSuggestions()
  const editing = !!id

  const [orig, setOrig] = useState<PlannedEvent | null>(null)
  const [artist, setArtist] = useState('')
  const [tour, setTour] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState('')
  const [doors, setDoors] = useState('')
  const [show, setShow] = useState('')
  const [notes, setNotes] = useState('')
  const [coverId, setCoverId] = useState<string | undefined>()
  const [newCovers, setNewCovers] = useState<string[]>([])
  const [loadingCover, setLoadingCover] = useState(false)
  const [friends, setFriends] = useState<FriendRef[]>([])
  const [origin, setOrigin] = useState<ShareOrigin | undefined>()

  useEffect(() => {
    if (!editing) {
      // a friend invited us: start from their plan, with them as company
      const sh = findShare(shareId)
      if (sh) {
        const p = sh.payload
        setArtist(p.artist); setTour(p.tour || ''); setVenue(p.venue); setDate(p.date)
        setDoors(p.doors || ''); setShow(p.show || '')
        setFriends([{ id: sh.from.id, username: sh.from.username, name: sh.from.name }])
        setOrigin({ shareId: sh.id, userId: sh.from.id, username: sh.from.username })
      }
      return
    }
    db.events.get(id!).then((e) => {
      if (!e) return nav('/upcoming', { replace: true })
      setOrig(e)
      setArtist(e.artist); setTour(e.tour || ''); setVenue(e.venue); setDate(e.date)
      setDoors(e.doors || ''); setShow(e.show || ''); setNotes(e.notes); setCoverId(e.coverId)
      setFriends(e.friends || []); setOrigin(e.sharedFrom)
    })
  }, [id, editing, shareId, nav])

  const pickCover = async () => {
    const [f] = await pickFiles('image/*')
    if (!f) return
    setLoadingCover(true)
    try {
      const mid = await saveImageAsMedia(f, 1600)
      setNewCovers((c) => [...c, mid])
      setCoverId(mid)
    } finally {
      setLoadingCover(false)
    }
  }

  // only the name is required; venue, date and times can be filled in later
  const valid = !!artist.trim()

  const cancel = async () => {
    await deleteMedia(newCovers)
    if (history.length > 1) nav(-1)
    else nav('/upcoming')
  }

  const save = async () => {
    if (!valid) return
    setBusy('Сохраняем…')
    try {
      const e: PlannedEvent = {
        id: orig?.id || uid(),
        artist: artist.trim(),
        tour: tour.trim() || undefined,
        venue: venue.trim(),
        date,
        doors: doors || undefined,
        show: show || undefined,
        notes: notes.trim(),
        coverId,
        friends: friends.length ? friends : undefined,
        sharedFrom: origin,
        palette: orig?.palette ?? paletteFor(artist),
        createdAt: orig?.createdAt || Date.now(),
      }
      const unused = [orig?.coverId, ...newCovers].filter((x) => x && x !== coverId)
      await db.transaction('rw', db.events, db.tickets, db.media, async () => {
        await db.events.put(e)
        await deleteMedia(unused)
        await db.tickets.where('eventId').equals(e.id).modify({ artist: e.artist, venue: e.venue, date: e.date, time: e.show, tour: e.tour })
      })
      if (shareId && origin) setShareStatus(shareId, 'added')
      say(editing ? 'Изменения сохранены' : friends.length ? 'Концерт запланирован — друзья увидят его у себя' : 'Концерт запланирован')
      if (returnTo) nav(returnTo, { replace: true, state: { selectEventId: e.id } })
      else nav(`/event/${e.id}`, { replace: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen">
      <div className="navbar">
        <div className="navbar-grid">
          <button className="nav-link" onClick={cancel}>Отмена</button>
          <div className="navbar-title">{editing ? 'Редактирование' : 'Новый концерт'}</div>
          <button className="nav-link accent" onClick={save} disabled={!valid}>Готово</button>
        </div>
      </div>
      <datalist id="artists">{sugg.artists.map((a) => <option key={a} value={a} />)}</datalist>
      <datalist id="venues">{sugg.venues.map((a) => <option key={a} value={a} />)}</datalist>

      <div style={{ padding: '14px 20px calc(40px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Cover id={coverId} palette={paletteFor(artist || 'encore')} full onClick={pickCover} style={{ height: 180, borderRadius: 20, cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', font: '600 15px var(--sans)', background: coverId ? 'rgba(0,0,0,.25)' : undefined }}>
            {loadingCover ? <Spinner /> : <><ImagePlus size={20} />{coverId ? 'Заменить фото' : 'Фото артиста — необязательно'}</>}
          </div>
          {coverId && (
            <button aria-label="Убрать фото" onClick={(ev) => { ev.stopPropagation(); setCoverId(undefined) }} className="glass-btn" style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36 }}>
              <X size={18} />
            </button>
          )}
        </Cover>

        {hasHints && (
          <div style={{ padding: 1.5, borderRadius: 20, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)' }}>
            <div style={{ borderRadius: 18.5, background: 'var(--s1)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 18, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={18} /></div>
              <div style={{ flex: 1, font: '400 13px/1.4 var(--sans)', color: 'var(--tx2)' }}>
                <div style={{ font: '700 15px var(--sans)', color: 'var(--tx)' }}>Мы прочитали билет</div>
                Нажмите на вариант под полем или заполните всё сразу
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 'none', height: 36, padding: '0 12px', fontSize: 13 }}
                onClick={() => {
                  // fill only what's still empty
                  if (!artist && hints!.artists[0]) setArtist(hints!.artists[0])
                  if (!tour && hints!.tours[0]) setTour(hints!.tours[0])
                  if (!venue && hints!.venues[0]) setVenue(hints!.venues[0])
                  if (!date && hints!.dates[0]) setDate(hints!.dates[0])
                  if (!doors && hints!.doors) setDoors(hints!.doors)
                  if (!show && hints!.show) setShow(hints!.show)
                }}
              >
                Заполнить
              </button>
            </div>
          </div>
        )}

        <div className="section" style={{ gap: 8 }}>
          <Label>Название</Label>
          <div className="field"><Mic size={20} /><input list="artists" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Артист или концерт" autoCapitalize="words" /></div>
          <FromTicket values={hints?.artists} current={artist} onPick={setArtist} />
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Тур или фестиваль</Label>
          <div className="field"><Music size={20} /><input value={tour} onChange={(e) => setTour(e.target.value)} placeholder="Необязательно" /></div>
          <FromTicket values={hints?.tours} current={tour} onPick={setTour} />
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Площадка</Label>
          <div className="field"><MapPin size={20} /><input list="venues" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Клуб, арена, стадион… — необязательно" /></div>
          <FromTicket values={hints?.venues} current={venue} onPick={setVenue} />
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Дата</Label>
          <div className="field"><CalendarDays size={20} /><input type="date" value={date} min={editing || hints ? undefined : todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
          <FromTicket values={hints?.dates} current={date} onPick={setDate} format={longDate} />
          {!date && !hints?.dates.length && <div className="hint">Необязательно — можно указать позже</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="section" style={{ gap: 8 }}>
            <Label>Двери</Label>
            <div className="field"><DoorOpen size={20} /><input type="time" value={doors} onChange={(e) => setDoors(e.target.value)} /></div>
            <FromTicket values={hints?.doors ? [hints.doors] : undefined} current={doors} onPick={setDoors} />
          </div>
          <div className="section" style={{ gap: 8 }}>
            <Label>Начало</Label>
            <div className="field"><Music size={20} /><input type="time" value={show} onChange={(e) => setShow(e.target.value)} /></div>
            <FromTicket values={hints?.show ? [hints.show] : undefined} current={show} onPick={setShow} />
          </div>
        </div>
        <FriendsSection value={friends} onChange={setFriends} />
        <div className="section" style={{ gap: 8 }}>
          <Label>Заметки</Label>
          <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Где встречаемся, что взять с собой…" />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!valid}>{editing ? 'Сохранить изменения' : 'Запланировать'}</button>
      </div>
    </div>
  )
}

function FriendsSection({ value, onChange }: { value: FriendRef[]; onChange: (v: FriendRef[]) => void }) {
  const signedIn = useSync((s) => !!s.user)
  if (!signedIn) return null
  return (
    <div className="section" style={{ gap: 8 }}>
      <Label>С кем идёте</Label>
      <FriendPicker value={value} onChange={onChange} />
    </div>
  )
}

/** Values read from the ticket, offered under a field ("из билета"). */
function FromTicket({ values, current, onPick, format }: { values?: string[]; current: string; onPick: (v: string) => void; format?: (v: string) => string }) {
  const left = (values || []).filter((v) => v.toLowerCase() !== current.trim().toLowerCase())
  if (!left.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="auto-badge"><Sparkles size={11} />ИЗ БИЛЕТА</span>
      {left.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} style={{ maxWidth: '100%', height: 30, padding: '0 12px', borderRadius: 15, border: '1px solid rgba(255,46,136,.45)', background: 'var(--af)', color: 'var(--tx)', font: '500 13px var(--sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {format ? format(v) : v}
        </button>
      ))}
    </div>
  )
}
