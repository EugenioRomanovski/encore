import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, DoorOpen, ImagePlus, MapPin, Mic, Music, X } from 'lucide-react'
import { db, deleteMedia, uid, type PlannedEvent } from '../lib/db'
import { pickFiles, saveImageAsMedia } from '../lib/media'
import { todayISO } from '../lib/format'
import { paletteFor } from '../lib/palette'
import { useSuggestions } from '../lib/suggest'
import { Cover } from '../components/Cover'
import { Label, Spinner } from '../components/ui'
import { useUI } from '../store/ui'

export default function EventForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const returnTo = (loc.state as { returnTo?: string } | null)?.returnTo
  const { say, setBusy } = useUI()
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

  useEffect(() => {
    if (!editing) return
    db.events.get(id!).then((e) => {
      if (!e) return nav('/upcoming', { replace: true })
      setOrig(e)
      setArtist(e.artist); setTour(e.tour || ''); setVenue(e.venue); setDate(e.date)
      setDoors(e.doors || ''); setShow(e.show || ''); setNotes(e.notes); setCoverId(e.coverId)
    })
  }, [id, editing, nav])

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

  const valid = artist.trim() && venue.trim() && date

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
        palette: orig?.palette ?? paletteFor(artist),
        createdAt: orig?.createdAt || Date.now(),
      }
      const unused = [orig?.coverId, ...newCovers].filter((x) => x && x !== coverId)
      await db.transaction('rw', db.events, db.tickets, db.media, async () => {
        await db.events.put(e)
        await deleteMedia(unused)
        await db.tickets.where('eventId').equals(e.id).modify({ artist: e.artist, venue: e.venue, date: e.date, time: e.show, tour: e.tour })
      })
      say(editing ? 'Изменения сохранены' : 'Концерт запланирован')
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

        <div className="section" style={{ gap: 8 }}>
          <Label>Артист</Label>
          <div className="field"><Mic size={20} /><input list="artists" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Кого идёте смотреть?" autoCapitalize="words" /></div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Тур или фестиваль</Label>
          <div className="field"><Music size={20} /><input value={tour} onChange={(e) => setTour(e.target.value)} placeholder="Необязательно" /></div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Площадка</Label>
          <div className="field"><MapPin size={20} /><input list="venues" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Клуб, арена, стадион…" /></div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Дата</Label>
          <div className="field"><CalendarDays size={20} /><input type="date" value={date} min={editing ? undefined : todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="section" style={{ gap: 8 }}>
            <Label>Двери</Label>
            <div className="field"><DoorOpen size={20} /><input type="time" value={doors} onChange={(e) => setDoors(e.target.value)} /></div>
          </div>
          <div className="section" style={{ gap: 8 }}>
            <Label>Начало</Label>
            <div className="field"><Music size={20} /><input type="time" value={show} onChange={(e) => setShow(e.target.value)} /></div>
          </div>
        </div>
        <div className="section" style={{ gap: 8 }}>
          <Label>Заметки</Label>
          <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Где встречаемся, что взять с собой…" />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!valid}>{editing ? 'Сохранить изменения' : 'Запланировать'}</button>
      </div>
    </div>
  )
}
