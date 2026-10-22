import { createClient, type User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { dropBroken, readBytes } from './media'
import { db, enqueueAll, isDemoId, markRemote, outboxKey, setOutboxListener, type Media, type Memory, type OutboxItem, type PlannedEvent, type SyncedTable } from './db'

/*
 * Cloud sync with Supabase.
 * - IndexedDB stays the source of truth for the UI; the app works offline and without an account.
 * - Dexie hooks (db.ts) put every local change into `outbox`; push sends the current row (or a tombstone).
 * - Rows live in `public.records` (one per memory / event / ticket / media item, JSON in `data`);
 *   photo, video, PDF and preview bytes live in the private `media` bucket under `<user_id>/<media_id>`.
 * - Pull is incremental by the server-side `updated_at`; a local change that hasn't been pushed yet wins.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://uvuifuyozscfcowuxdtr.supabase.co'
// publishable key: safe in the browser, access is enforced by RLS
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_gD0M11LHLg4PJWxA8rKatQ_zn69qbw_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'encore.auth' },
})

type Kind = 'memory' | 'event' | 'ticket' | 'media'
const KIND: Record<SyncedTable, Kind> = { memories: 'memory', events: 'event', tickets: 'ticket', media: 'media' }
const TABLE: Record<Kind, SyncedTable> = { memory: 'memories', event: 'events', ticket: 'tickets', media: 'media' }
const BUCKET = 'media'

interface Row {
  kind: Kind
  id: string
  data: unknown
  deleted: boolean
  updated_at?: string
}

interface MediaMeta {
  kind: Media['kind']
  type: string
  size: number
  takenAt?: number
  createdAt: number
  thumbType?: string
}

export type SyncStatus = 'off' | 'syncing' | 'idle' | 'offline' | 'error'

interface SyncState {
  ready: boolean
  user: User | null
  status: SyncStatus
  lastSync: number | null
  pending: number
  downloading: number
  error: string | null
}

export const useSync = create<SyncState>(() => ({
  ready: false,
  user: null,
  status: 'off',
  lastSync: null,
  pending: 0,
  downloading: 0,
  error: null,
}))

const set = (p: Partial<SyncState>) => useSync.setState(p)
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}
const OWNER = 'encore.sync.owner'
const cursorKey = (uid: string) => `encore.sync.${uid}.cursor`
const lastKey = (uid: string) => `encore.sync.${uid}.last`
const path = (uid: string, id: string, thumb = false) => `${uid}/${id}${thumb ? '.thumb' : ''}`

const isNetworkError = (e: unknown) => e instanceof TypeError || /fetch|network|Load failed/i.test(String((e as Error)?.message))

// ---------- push ----------

async function ack(items: OutboxItem[]) {
  // drop only entries that weren't changed again while we were uploading
  await db.transaction('rw', db.outbox, async () => {
    for (const it of items) {
      const cur = await db.outbox.get(it.key)
      if (cur && cur.at === it.at) await db.outbox.delete(it.key)
    }
  })
}

async function upsert(uid: string, rows: Row[]) {
  if (!rows.length) return
  const { error } = await supabase.from('records').upsert(
    rows.map((r) => ({ user_id: uid, kind: r.kind, id: r.id, data: r.data, deleted: r.deleted })),
    { onConflict: 'user_id,kind,id' },
  )
  if (error) throw error
}

async function upload(p: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(p, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
  if (error) throw error
}

const tooLarge = (e: unknown) => {
  const x = e as { statusCode?: string | number; status?: number; message?: string }
  return String(x?.statusCode ?? x?.status) === '413' || /maximum allowed size|too large/i.test(String(x?.message))
}

interface PushReport {
  tooLarge: number
  failed: number
  /** ticket originals that could no longer be read on this device and were dropped */
  dropped: string[]
  /** photos/videos whose bytes are gone on this device — kept locally as they are, not retried */
  unreadable: number
}

function reportMessage(r: PushReport) {
  const out: string[] = []
  if (r.dropped.length) out.push(`Оригинал билета «${r.dropped.join('», «')}» не читался на устройстве и убран — страницы билета сохранены.`)
  if (r.unreadable) out.push(`Не читаются на устройстве файлов: ${r.unreadable} — в облако они не попадут.`)
  if (r.tooLarge) out.push(`Слишком большие для облака файлы: ${r.tooLarge}. Они остаются на устройстве.`)
  if (r.failed) out.push(`Не удалось загрузить файлов: ${r.failed}. Попробуем ещё раз при следующей синхронизации.`)
  return out.join(' ') || null
}

/** What a friend receives when tagged on a concert: the facts of the show, never photos or notes. */
async function sharePayload(kind: 'memory' | 'event', r: Memory | PlannedEvent) {
  const base = { artist: r.artist, tour: r.tour, venue: r.venue, date: r.date }
  if (kind === 'event') {
    const e = r as PlannedEvent
    return { ...base, doors: e.doors, show: e.show }
  }
  const m = r as Memory
  // photo ids listed here are exactly what storage RLS lets the friend read ("media: read photos shared with me")
  const media = m.sharePhotos === false ? [] : ((await db.media.bulkGet(m.mediaIds)).filter(Boolean) as Media[])
  return {
    ...base, time: m.time, setlist: m.setlist, encoreAt: m.encoreAt, genres: m.genres,
    photos: media.map((x) => x.id),
    videos: media.filter((x) => x.kind === 'video').map((x) => x.id),
  }
}

/** Send (or refresh) the concert card to tagged friends; the server skips anyone who isn't a friend. */
async function shareWithFriends(item: OutboxItem, rec: Memory | PlannedEvent | undefined) {
  if (!rec || (item.table !== 'memories' && item.table !== 'events')) return
  const to = (rec.friends || []).map((f) => f.id).filter((id) => id !== rec.sharedFrom?.userId)
  if (!to.length) return
  const kind = item.table === 'memories' ? 'memory' : 'event'
  const { error } = await supabase.rpc('share_concert', { p_to: to, p_kind: kind, p_source: rec.id, p_payload: await sharePayload(kind, rec) })
  if (error) throw error
}

/** Pushes local changes; reports media files that could not be uploaded. */
async function push(uid: string): Promise<PushReport> {
  // files first: by the time a memory (and the card sent to friends) arrives, its photos are there
  const items = (await db.outbox.orderBy('at').toArray()).sort((a, b) => Number(a.table !== 'media') - Number(b.table !== 'media'))
  const report: PushReport = { tooLarge: 0, failed: 0, dropped: [], unreadable: 0 }
  const batch: { item: OutboxItem; row: Row }[] = []
  const flush = async () => {
    await upsert(uid, batch.map((b) => b.row))
    await ack(batch.map((b) => b.item))
    batch.length = 0
  }
  for (const item of items) {
    const kind = KIND[item.table]
    if (item.table === 'media') {
      const m = await db.media.get(item.id)
      try {
        // read the bytes first: a file whose bytes were lost would otherwise go up empty and fail forever
        const bytes = m && (await readBytes(m.blob))
        if (m && !bytes) {
          console.warn('media unreadable on this device', m.id)
          const name = await dropBroken(m)
          if (name) report.dropped.push(name)
          else report.unreadable++
        } else if (m && bytes) {
          await upload(path(uid, m.id), new Blob([bytes], { type: m.blob.type }))
          if (m.thumb) await upload(path(uid, m.id, true), m.thumb)
          const meta: MediaMeta = { kind: m.kind, type: m.blob.type, size: bytes.byteLength, takenAt: m.takenAt, createdAt: m.createdAt, thumbType: m.thumb?.type }
          await upsert(uid, [{ kind, id: m.id, data: meta, deleted: false }])
        } else {
          await supabase.storage.from(BUCKET).remove([path(uid, item.id), path(uid, item.id, true)])
          await upsert(uid, [{ kind, id: item.id, data: null, deleted: true }])
        }
        await ack([item])
      } catch (e) {
        if (isNetworkError(e)) throw e
        console.warn('media upload failed', item.id, e)
        if (tooLarge(e)) report.tooLarge++
        else report.failed++
      }
      continue
    }
    const rec = await db.table(item.table).get(item.id)
    await shareWithFriends(item, rec)
    batch.push({ item, row: rec ? { kind, id: item.id, data: rec, deleted: false } : { kind, id: item.id, data: null, deleted: true } })
    if (batch.length >= 200) await flush()
  }
  await flush()
  return report
}

// ---------- pull ----------

async function applyRows(rows: Row[]) {
  const pending = new Set((await db.outbox.toCollection().primaryKeys()) as string[])
  await db.transaction('rw', [db.memories, db.events, db.tickets, db.media], async (tx) => {
    markRemote(tx)
    for (const r of rows) {
      const table = TABLE[r.kind]
      if (!table || isDemoId(r.id) || pending.has(outboxKey(table, r.id))) continue
      if (r.deleted) await db.table(table).delete(r.id)
      else if (r.kind !== 'media') await db.table(table).put(r.data)
      // media rows: bytes are fetched by downloadMissing()
    }
  })
}

async function pull(uid: string) {
  const saved = ls.get(cursorKey(uid))
  // small overlap: rows committed slightly out of timestamp order are not missed (re-applying is harmless)
  let from = saved ? new Date(new Date(saved).getTime() - 60_000).toISOString() : '1970-01-01T00:00:00Z'
  let newest = saved
  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('kind,id,data,deleted,updated_at')
      .gt('updated_at', from)
      .order('updated_at', { ascending: true })
      .limit(1000)
    if (error) throw error
    const rows = (data || []) as Row[]
    if (!rows.length) break
    await applyRows(rows)
    newest = rows[rows.length - 1].updated_at!
    from = newest
    if (rows.length < 1000) break
  }
  if (newest) ls.set(cursorKey(uid), newest)
}

/** Media referenced by local records but not on this device yet (e.g. added on another phone). */
async function missingMediaIds() {
  const [ms, es, ts] = await Promise.all([db.memories.toArray(), db.events.toArray(), db.tickets.toArray()])
  const want = new Set<string>()
  ms.forEach((m) => m.mediaIds.forEach((id) => want.add(id)))
  es.forEach((e) => e.coverId && want.add(e.coverId))
  ts.forEach((t) => { t.pageIds.forEach((id) => want.add(id)); if (t.fileId) want.add(t.fileId) })
  const have = new Set((await db.media.toCollection().primaryKeys()) as string[])
  return [...want].filter((id) => !have.has(id) && !isDemoId(id))
}

async function download(p: string, type?: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(p)
  if (error) throw error
  return type && data.type !== type ? new Blob([data], { type }) : data
}

async function downloadMissing(uid: string) {
  const ids = await missingMediaIds()
  if (!ids.length) return
  set({ downloading: ids.length })
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase.from('records').select('id,data,deleted').eq('kind', 'media').in('id', ids.slice(i, i + 100))
      if (error) throw error
      for (const r of (data || []) as Row[]) {
        if (r.deleted || !r.data) continue
        const meta = r.data as MediaMeta
        try {
          const blob = await download(path(uid, r.id), meta.type)
          const thumb = meta.thumbType ? await download(path(uid, r.id, true), meta.thumbType).catch(() => undefined) : undefined
          await db.transaction('rw', db.media, async (tx) => {
            markRemote(tx)
            await db.media.put({ id: r.id, blob, thumb, kind: meta.kind, takenAt: meta.takenAt, createdAt: meta.createdAt })
          })
        } catch (e) {
          if (isNetworkError(e)) throw e
          console.warn('media download failed', r.id, e)
        }
        set({ downloading: Math.max(0, useSync.getState().downloading - 1) })
      }
    }
  } finally {
    set({ downloading: 0 })
  }
}

// ---------- orchestration ----------

// extra work after each sync (profile, friends, shared concerts) — registered by social.ts
let afterSync: (uid: string) => Promise<void> = async () => {}
export const setAfterSync = (fn: (uid: string) => Promise<void>) => (afterSync = fn)

let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

async function refreshPending() {
  set({ pending: await db.outbox.count() })
}

async function syncOnce() {
  const user = useSync.getState().user
  if (!user) return refreshPending()
  if (!navigator.onLine) return set({ status: 'offline' })
  set({ status: 'syncing', error: null })
  try {
    const message = reportMessage(await push(user.id))
    await pull(user.id)
    await downloadMissing(user.id)
    await afterSync(user.id)
    const now = Date.now()
    ls.set(lastKey(user.id), String(now))
    set({ status: message ? 'error' : 'idle', lastSync: now, error: message })
  } catch (e) {
    console.warn('sync failed', e)
    if (isNetworkError(e) || !navigator.onLine) set({ status: 'offline' })
    else set({ status: 'error', error: (e as Error)?.message || 'Ошибка синхронизации' })
  } finally {
    await refreshPending()
  }
}

export function syncNow(): Promise<void> {
  clearTimeout(timer)
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await syncOnce()
    } while (again)
  })().finally(() => (running = null))
  return running
}

export function requestSync(delay = 1500) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

async function onUser(user: User | null) {
  const prev = useSync.getState().user
  set({ user, ready: true, status: user ? useSync.getState().status : 'off', lastSync: user ? Number(ls.get(lastKey(user.id))) || null : null })
  if (!user || prev?.id === user.id) return refreshPending()
  // first time this account is used on this device: upload what's already here, download everything
  if (ls.get(OWNER) !== user.id) {
    await enqueueAll()
    ls.del(cursorKey(user.id))
    ls.set(OWNER, user.id)
  }
  void syncNow()
}

let started = false
export function initSync() {
  if (started) return
  started = true
  setOutboxListener(() => {
    void refreshPending()
    if (useSync.getState().user) requestSync()
  })
  supabase.auth.getSession().then(({ data }) => onUser(data.session?.user ?? null))
  supabase.auth.onAuthStateChange((_event, session) => {
    // defer: calling supabase from inside this callback can deadlock the auth client
    setTimeout(() => void onUser(session?.user ?? null), 0)
  })
  window.addEventListener('online', () => requestSync(0))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && requestSync(0))
  setInterval(() => document.visibilityState === 'visible' && useSync.getState().user && requestSync(0), 60_000)
}

// ---------- auth ----------

/** Email a one-time code. `signup` creates the account if needed; sign-in only works for existing accounts. */
export async function sendCode(email: string, signup: boolean) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: signup, emailRedirectTo: location.origin } })
  if (error) throw error
}

export async function verifyCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

/** Push what's left, then sign out. Local data stays on the device. */
export async function signOut() {
  if (navigator.onLine) await syncNow().catch(() => {})
  await supabase.auth.signOut()
}

/** Sign out and clear this device; the cloud copy stays and comes back on the next sign-in. */
export async function signOutAndWipe(wipe: () => Promise<void>) {
  const uid = useSync.getState().user?.id
  await signOut()
  await wipe()
  if (uid) ls.del(cursorKey(uid))
  ls.del(OWNER)
}
