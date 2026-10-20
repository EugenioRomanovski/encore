import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronLeft, Clock, ImagePlus, MapPin, Mic, Play, Sparkles, X } from 'lucide-react'
import { db, deleteMedia, uid, type Media, type Memory } from '../lib/db'
import { prepareMedia, pickFiles } from '../lib/media'
import { RATING_LABELS, longDate, toHM, toISODate, todayISO } from '../lib/format'
import { paletteFor } from '../lib/palette'
import { useBlobUrl, useMediaUrl } from '../lib/hooks'
import { useSuggestions } from '../lib/suggest'
import { ChipsInput } from '../components/ChipsInput'
import { Avatar, Label, Spinner, Stars } from '../components/ui'
import { useUI } from '../store/ui'

interface Item {
  id: string
  /** Set for newly picked files that are not in the DB yet. */
  media?: Media
}

const ENCORE_MARK = /^(—|-{2,3}|бис|на бис|encore)$/i

function setlistToText(list: string[], encoreAt: number | null) {
  const lines = [...list]
  if (encoreAt !== null) lines.splice(encoreAt, 0, '—')
  return lines.join('\n')
}

function textToSetlist(text: string): { setlist: string[]; encoreAt: number | null } {
  const setlist: string[] = []
  let encoreAt: number | null = null
  for (const raw of text.split('\n')) {
    const l = raw.trim().replace(/^\d+[.)]\s*/, '')
    if (!l) continue
    if (ENCORE_MARK.test(l)) {
      if (encoreAt === null) encoreAt = setlist.length
      continue
    }
    setlist.push(l)
  }
  if (encoreAt !== null && encoreAt >= setlist.length) encoreAt = null
  return { setlist, encoreAt }
}

function Thumb({ item, n, cover, onRemove }: { item: Item; n: number; cover: boolean; onRemove: () => void }) {
  const fresh = useBlobUrl(item.media?.thumb)
  const stored = useMediaUrl(item.media ? undefined : item.id)
  const url = fresh || stored
  const isVideo = item.media?.kind === 'video'
  return (
    <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: url ? `#111 center/cover url("${url}")` : 'var(--s2)', boxShadow: cover ? 'inset 0 0 0 3px #FF2E88' : undefined }}>
      {isVideo && <div style={{ position: 'absolute', left: 6, bottom: 6, color: '#fff', display: 'flex' }}><Play size={16} fill="#fff" /></div>}
      <div style={{ position: 'absolute', top: 7, left: 7, minWidth: 24, height: 24, borderRadius: 12, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', font: '700 12px var(--sans)', background: 'var(--grad)', padding: '0 6px' }}>
        {cover ? 'Обложка' : n}
      </div>
      <button type="button" aria-label="Убрать" onClick={onRemove} style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} />
      </button>
    </div>
  )
}

export default function MemoryForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const fromEvent = params.get('fromEvent')
  const nav = useNavigate()
  const { say, setBusy } = useUI()
  const sugg = useSuggestions()
  const editing = !!id

  const [step, setStep] = useState<'pick' | 'form'>(editing ? 'form' : 'pick')
  const [loaded, setLoaded] = useState(!editing && !fromEvent)
  const [items, setItems] = useState<Item[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [processing, setProcessing] = useState(0)
  const [orig, setOrig] = useState<Memory | null>(null)

  const [artist, setArtist] = useState('')
  const [tour, setTour] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [autoDate, setAutoDate] = useState(false)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [setlist, setSetlist] = useState('')

  useEffect(() => {
    ;(async () => {
      if (editing) {
        const m = await db.memories.get(id!)
        if (!m) return nav('/', { replace: true })
        setOrig(m)
        setItems(m.mediaIds.map((x) => ({ id: x })))
        setArtist(m.artist); setTour(m.tour || ''); setVenue(m.venue); setDate(m.date); setTime(m.time || '')
        setRating(m.rating); setNotes(m.notes); setPeople(m.people); setGenres(m.genres)
        setSetlist(setlistToText(m.setlist, m.encoreAt))
      } else if (fromEvent) {
        const e = await db.events.get(fromEvent)
        if (e) {
          setArtist(e.artist); setTour(e.tour || ''); setVenue(e.venue); setDate(e.date); setTime(e.show || '')
          setNotes(e.notes)
        }
      }
      setLoaded(true)
    })()
  }, [id, fromEvent, editing, nav])

  const fresh = items.filter((i) => i.media)
  const taken = useMemo(() => fresh.map((i) => i.media!.takenAt).filter(Boolean).sort() as number[], [fresh])

  // auto-fill date & time from the photos' EXIF, unless the user already set them
  useEffect(() => {
    if (!taken.length || editing) return
    if (!date || autoDate) {
      const d = new Date(taken[0])
      setDate(toISODate(d))
      if (!time || autoDate) setTime(toHM(d))
      setAutoDate(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken.join(',')])

  const addPhotos = async () => {
    const files = await pickFiles('image/*,video/*', true)
    if (!files.length) return
    setProcessing(files.length)
    const out: Item[] = []
    for (const f of files) {
      try {
        const media = await prepareMedia(f)
        out.push({ id: media.id, media })
      } catch (e) {
        console.error(e)
      }
      setProcessing((n) => n - 1)
    }
    setItems((xs) => [...xs, ...out])
    if (out.length < files.length) say('Некоторые файлы не удалось открыть')
  }

  const removeItem = (it: Item) => {
    setItems((xs) => xs.filter((x) => x.id !== it.id))
    if (!it.media) setRemoved((r) => [...r, it.id])
  }

  const valid = artist.trim() && venue.trim() && date

  const save = async () => {
    if (!valid) return
    setBusy('Сохраняем…')
    try {
      const { setlist: sl, encoreAt } = textToSetlist(setlist)
      const now = Date.now()
      const mem: Memory = {
        id: orig?.id || uid(),
        artist: artist.trim(),
        tour: tour.trim() || undefined,
        venue: venue.trim(),
        date,
        time: time || undefined,
        rating,
        notes: notes.trim(),
        people,
        genres,
        setlist: sl,
        encoreAt,
        mediaIds: items.map((i) => i.id),
        coverId: items[0]?.id,
        palette: orig?.palette ?? paletteFor(artist),
        createdAt: orig?.createdAt || now,
        updatedAt: now,
      }
      await db.transaction('rw', db.media, db.memories, db.tickets, db.events, async () => {
        if (fresh.length) await db.media.bulkPut(fresh.map((i) => i.media!))
        await deleteMedia(removed)
        await db.memories.put(mem)
        await db.tickets.where('memoryId').equals(mem.id).modify({ artist: mem.artist, venue: mem.venue, date: mem.date, tour: mem.tour })
        if (fromEvent) {
          const e = await db.events.get(fromEvent)
          await db.tickets.where('eventId').equals(fromEvent).modify((t) => {
            t.memoryId = mem.id
            delete t.eventId
          })
          if (e) {
            await deleteMedia([e.coverId])
            await db.events.delete(e.id)
          }
        }
      })
      say(editing ? 'Изменения сохранены' : 'Воспоминание сохранено')
      nav(`/memory/${mem.id}`, { replace: true })
    } catch (e) {
      console.error(e)
      say('Не удалось сохранить — мало места?')
    } finally {
      setBusy(null)
    }
  }

  const cancel = () => (history.length > 1 ? nav(-1) : nav('/'))
  const title = editing ? 'Редактирование' : 'Новое воспоминание'

  const header = (
    <div className="navbar">
      <div className="navbar-grid">
        {step === 'pick' || editing ? (
          <button className="nav-link" onClick={cancel}>Отмена</button>
        ) : (
          <button className="nav-link" onClick={() => setStep('pick')}><ChevronLeft size={20} />Фото</button>
        )}
        <div className="navbar-title">{title}</div>
        {step === 'pick' ? (
          <button className="nav-link accent" onClick={() => setStep('form')} disabled={processing > 0}>Далее</button>
        ) : (
          <button className="nav-link accent" onClick={save} disabled={!valid}>Готово</button>
        )}
      </div>
      {!editing && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px 0' }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#FF2E88,#FF8A2B)' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: step === 'form' ? 'linear-gradient(90deg,#FF2E88,#FF8A2B)' : 'var(--line2)' }} />
        </div>
      )}
    </div>
  )

  if (!loaded) return <div className="screen">{header}</div>

  if (step === 'pick') {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '14px 20px 16px' }}>
          <div style={{ font: '800 26px/1.1 var(--sans)', letterSpacing: '-.025em' }}>Начните с фото</div>
          <div style={{ font: '400 15px/1.45 var(--sans)', color: 'var(--tx2)', marginTop: 6 }}>Выберите снимки с того вечера — мы прочитаем из них дату и время, остальное допишете сами.</div>
        </div>
        <div style={{ padding: '0 20px 14px' }}>
          <button className="dashed-btn" style={{ minHeight: 96, flexDirection: 'column', gap: 6 }} onClick={addPhotos} disabled={processing > 0}>
            {processing > 0 ? <Spinner dark /> : <ImagePlus size={26} color="var(--mag)" />}
            {processing > 0 ? `Обрабатываем… осталось ${processing}` : items.length ? 'Добавить ещё' : 'Выбрать фото и видео'}
          </button>
        </div>
        {items.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px 10px' }}>
              <span className="mono-label">Выбрано · {items.length}</span>
              <span className="hint">Первое фото станет обложкой</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3 }}>
              {items.map((it, i) => <Thumb key={it.id} item={it} n={i + 1} cover={i === 0} onRemove={() => removeItem(it)} />)}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div className="sticky-cta">
          <button className="btn btn-primary" onClick={() => setStep('form')} disabled={processing > 0}>
            {items.length ? `Продолжить · ${items.length} фото` : 'Продолжить без фото'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    )
  }

  const takenRange = taken.length
    ? `${taken.length} фото сняты ${longDate(toISODate(new Date(taken[0])))}, ${toHM(new Date(taken[0]))}${taken.length > 1 ? '–' + toHM(new Date(taken[taken.length - 1])) : ''}.`
    : ''

  return (
    <div className="screen">
      {header}
      <datalist id="artists">{sugg.artists.map((a) => <option key={a} value={a} />)}</datalist>
      <datalist id="venues">{sugg.venues.map((a) => <option key={a} value={a} />)}</datalist>
      <div style={{ padding: '14px 20px calc(40px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {autoDate && taken.length > 0 && (
          <div style={{ padding: 1.5, borderRadius: 20, background: 'linear-gradient(110deg,#FF2E88,#FF8A2B)', boxShadow: '0 14px 34px -18px rgba(255,46,136,.8)' }}>
            <div style={{ borderRadius: 18.5, background: 'var(--s1)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 18, background: 'var(--grad2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={18} /></div>
              <div>
                <div style={{ font: '700 15px/1.3 var(--sans)' }}>Мы нашли дату по вашим фото</div>
                <div style={{ font: '400 13px/1.45 var(--sans)', color: 'var(--tx2)', marginTop: 3 }}>{takenRange}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ flex: 'none', width: 64, height: 64, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <Thumb item={it} n={i + 1} cover={false} onRemove={() => removeItem(it)} />
            </div>
          ))}
          <button onClick={addPhotos} aria-label="Добавить фото" style={{ flex: 'none', width: 64, height: 64, borderRadius: 12, border: '1.5px dashed var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}>
            {processing > 0 ? <Spinner dark /> : <ImagePlus size={22} />}
          </button>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Артист</Label>
          <div className="field"><Mic size={20} /><input list="artists" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Кого вы видели?" autoCapitalize="words" /></div>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Тур или фестиваль</Label>
          <div className="field"><input value={tour} onChange={(e) => setTour(e.target.value)} placeholder="Необязательно" /></div>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Площадка</Label>
          <div className="field"><MapPin size={20} /><input list="venues" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Клуб, арена, стадион…" /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <div className="section" style={{ gap: 8 }}>
            <div className="field-label"><span className="mono-label">Дата</span>{autoDate && <span className="auto-badge"><Sparkles size={12} />ИЗ ФОТО</span>}</div>
            <div className={'field' + (autoDate ? ' auto' : '')}><CalendarDays size={20} /><input type="date" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setAutoDate(false) }} /></div>
          </div>
          <div className="section" style={{ gap: 8 }}>
            <span className="mono-label">Время</span>
            <div className={'field' + (autoDate ? ' auto' : '')}><Clock size={20} /><input type="time" value={time} onChange={(e) => { setTime(e.target.value); setAutoDate(false) }} /></div>
          </div>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Оценка</Label>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 6px 4px', borderRadius: 14 }}>
            <Stars value={rating} size={30} off="var(--line2)" onSet={setRating} />
            <span style={{ font: '600 13px var(--sans)', color: 'var(--tx2)', paddingRight: 6, textAlign: 'right' }}>{RATING_LABELS[rating]}</span>
          </div>
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Заметки</Label>
          <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Момент, который хочется запомнить…" />
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>С кем ходили</Label>
          <ChipsInput values={people} onChange={setPeople} placeholder="Имя друга" suggestions={sugg.people} render={(v) => <><Avatar name={v} size={26} /><span>{v}</span></>} />
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Жанры</Label>
          <ChipsInput values={genres} onChange={setGenres} placeholder="Инди-рок, техно…" suggestions={sugg.genres} />
        </div>

        <div className="section" style={{ gap: 8 }}>
          <Label>Сет-лист</Label>
          <textarea className="textarea" rows={6} value={setlist} onChange={(e) => setSetlist(e.target.value)} placeholder={'Каждая песня с новой строки\n—\nСтрока «—» отделяет бис'} />
        </div>

        <button className="btn btn-primary" onClick={save} disabled={!valid}>{editing ? 'Сохранить изменения' : 'Сохранить воспоминание'}</button>
        {!valid && <div className="hint" style={{ textAlign: 'center', marginTop: -10 }}>Заполните артиста, площадку и дату</div>}
      </div>
    </div>
  )
}
