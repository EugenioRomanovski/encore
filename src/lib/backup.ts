import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8, type UnzipFile } from 'fflate'
import { db, type Media, type MediaKind, type Memory, type PlannedEvent, type Ticket } from './db'
import { downloadBlob } from './ics'
import { todayISO } from './format'

/*
 * Backup format 2: a ZIP archive.
 *   data.json            — manifest: memories, events, tickets and media metadata (always the first entry)
 *   Воспоминания/…, Планы/…, Билеты/…  — the photos, videos, ticket pages and PDFs as ordinary files
 *   .encore/thumbs/…     — preview images, so a restore doesn't have to regenerate them
 * Format 1 (a single JSON file with base64 data URLs) can still be restored.
 */

const MANIFEST = 'data.json'

/** An error whose message is meant for the user. */
class BackupError extends Error {}
const NOT_OURS = 'Это не резервная копия Encore'

interface MediaEntry {
  id: string
  kind: MediaKind
  takenAt?: number
  createdAt: number
  type: string
  size: number
  path: string
  thumb?: { path: string; type: string; size: number }
}

interface Manifest {
  app: 'encore'
  format: 2
  exportedAt: number
  memories: Memory[]
  events: PlannedEvent[]
  tickets: Ticket[]
  media: MediaEntry[]
}

export interface RestoreResult {
  memories: number
  events: number
  tickets: number
  media: number
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf',
}
const extOf = (type: string) => EXT[type.split(';')[0]] || 'bin'
const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'без названия'
const pad = (n: number) => String(n).padStart(2, '0')

/** Human-readable archive paths, so photos can be taken out of the backup without the app. */
function planPaths(media: Media[], memories: Memory[], events: PlannedEvent[], tickets: Ticket[]) {
  const byId = new Map(media.map((m) => [m.id, m]))
  const paths = new Map<string, string>()
  const used = new Set<string>()
  const take = (id: string, base: string) => {
    const m = byId.get(id)
    if (!m || paths.has(id)) return
    const ext = extOf(m.blob.type)
    let p = `${base}.${ext}`
    for (let i = 2; used.has(p.toLowerCase()); i++) p = `${base} (${i}).${ext}`
    used.add(p.toLowerCase())
    paths.set(id, p)
  }
  for (const m of memories) {
    const dir = `Воспоминания/${m.date} ${clean(m.artist)}`
    m.mediaIds.forEach((id, i) => take(id, `${dir}/${pad(i + 1)}`))
  }
  for (const e of events) if (e.coverId) take(e.coverId, `Планы/${e.date} ${clean(e.artist)}/обложка`)
  for (const t of tickets) {
    const dir = `Билеты/${t.date} ${clean(t.artist)}`
    t.pageIds.forEach((id, i) => take(id, `${dir}/страница ${i + 1}`))
    if (t.fileId) take(t.fileId, `${dir}/${clean((t.fileName || 'билет').replace(/\.[a-z0-9]{2,4}$/i, ''))}`)
  }
  for (const m of media) take(m.id, `Прочее/${m.id}`)
  return paths
}

export async function buildBackup(): Promise<Blob> {
  const [memories, events, tickets, ids] = await Promise.all([
    db.memories.toArray(),
    db.events.toArray(),
    db.tickets.toArray(),
    db.media.toCollection().primaryKeys(),
  ])
  // media metadata first (blobs stay disk-backed until read one by one below)
  const media = (await db.media.bulkGet(ids)).filter(Boolean) as Media[]
  const paths = planPaths(media, memories, events, tickets)
  const entries: MediaEntry[] = media.map((m) => ({
    id: m.id,
    kind: m.kind,
    takenAt: m.takenAt,
    createdAt: m.createdAt,
    type: m.blob.type,
    size: m.blob.size,
    path: paths.get(m.id)!,
    thumb: m.thumb ? { path: `.encore/thumbs/${m.id}.${extOf(m.thumb.type)}`, type: m.thumb.type, size: m.thumb.size } : undefined,
  }))
  const manifest: Manifest = { app: 'encore', format: 2, exportedAt: Date.now(), memories, events, tickets, media: entries }

  const chunks: Uint8Array[] = []
  let fail: (e: Error) => void = () => {}
  let finish: () => void = () => {}
  const done = new Promise<void>((res, rej) => ((finish = res), (fail = rej)))
  const zip = new Zip((err, data, final) => {
    if (err) return fail(err)
    chunks.push(data)
    if (final) finish()
  })
  const json = new ZipDeflate(MANIFEST, { level: 6 })
  zip.add(json)
  json.push(strToU8(JSON.stringify(manifest)), true)
  // photos/videos/PDFs are already compressed — store them as-is
  const store = async (path: string, blob: Blob) => {
    const f = new ZipPassThrough(path)
    zip.add(f)
    f.push(new Uint8Array(await blob.arrayBuffer()), true)
  }
  const byId = new Map(media.map((m) => [m.id, m]))
  for (const e of entries) {
    const m = byId.get(e.id)!
    await store(e.path, m.blob)
    if (e.thumb && m.thumb) await store(e.thumb.path, m.thumb)
  }
  zip.end()
  await done
  return new Blob(chunks as BlobPart[], { type: 'application/zip' })
}

export async function exportBackup() {
  downloadBlob(await buildBackup(), `encore-backup-${todayISO()}.zip`)
}

async function saveRecords(m: Pick<Manifest, 'memories' | 'events' | 'tickets'>) {
  await db.transaction('rw', db.memories, db.events, db.tickets, async () => {
    await db.memories.bulkPut(m.memories || [])
    await db.events.bulkPut(m.events || [])
    await db.tickets.bulkPut(m.tickets || [])
  })
}

async function restoreZip(file: Blob): Promise<RestoreResult> {
  const before = new Set(await db.media.toCollection().primaryKeys())
  const written: string[] = []
  let manifest: Manifest | null = null
  let byPath = new Map<string, { entry: MediaEntry; thumb: boolean }>()
  const got = new Set<string>()
  const earlyThumbs = new Map<string, Blob>()
  const queue: { name: string; data: Uint8Array }[] = []
  let streamError: Error | null = null

  const unzip = new Unzip((f: UnzipFile) => {
    const parts: Uint8Array[] = []
    f.ondata = (err, data, final) => {
      if (err) return void (streamError = err)
      parts.push(data)
      if (final) {
        const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
        let o = 0
        for (const p of parts) (all.set(p, o), (o += p.length))
        queue.push({ name: f.name, data: all })
      }
    }
    f.start()
  })
  unzip.register(UnzipInflate)

  const process = async () => {
    while (queue.length) {
      const { name, data } = queue.shift()!
      if (!manifest) {
        if (name !== MANIFEST) throw new BackupError(NOT_OURS)
        const m = JSON.parse(strFromU8(data))
        if (m?.app !== 'encore' || m.format !== 2) throw new BackupError(NOT_OURS)
        manifest = m as Manifest
        byPath = new Map()
        for (const e of manifest.media) {
          byPath.set(e.path, { entry: e, thumb: false })
          if (e.thumb) byPath.set(e.thumb.path, { entry: e, thumb: true })
        }
        continue
      }
      const hit = byPath.get(name)
      if (!hit) continue // unknown file (e.g. added by the user) — ignore
      const { entry, thumb } = hit
      const expected = thumb ? entry.thumb!.size : entry.size
      if (data.length !== expected) throw new BackupError(`Архив повреждён: ${name}`)
      const blob = new Blob([data as BlobPart], { type: thumb ? entry.thumb!.type : entry.type })
      if (thumb) {
        // the preview normally follows its file; keep it aside if the order was changed
        if (!(await db.media.update(entry.id, { thumb: blob })) || !got.has(entry.path)) earlyThumbs.set(entry.id, blob)
      } else {
        const m: Media = { id: entry.id, blob, thumb: earlyThumbs.get(entry.id), kind: entry.kind, takenAt: entry.takenAt, createdAt: entry.createdAt }
        await db.media.put(m)
        if (!before.has(entry.id)) written.push(entry.id)
      }
      got.add(name)
    }
  }

  try {
    const reader = file.stream().getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      unzip.push(value)
      if (streamError) throw streamError
      await process()
    }
    unzip.push(new Uint8Array(0), true)
    if (streamError) throw streamError
    await process()
    if (!manifest) throw new BackupError(NOT_OURS)
    const m = manifest as Manifest
    const missing = [...byPath.keys()].filter((p) => !got.has(p))
    if (missing.length) throw new BackupError(`Архив повреждён: не хватает файлов (${missing.length})`)
    await saveRecords(m)
    return { memories: m.memories.length, events: m.events.length, tickets: m.tickets.length, media: m.media.length }
  } catch (e) {
    // don't leave half-restored files behind
    if (written.length) await db.media.bulkDelete(written)
    throw e instanceof BackupError ? e : new BackupError('Не удалось прочитать архив')
  }
}

/** Format 1: a JSON file with base64 data URLs (backups made before the ZIP format). */
async function restoreJson(file: Blob): Promise<RestoreResult> {
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new BackupError(NOT_OURS)
  }
  if (data?.app !== 'encore') throw new BackupError(NOT_OURS)
  const fromDataUrl = async (s: string) => (await fetch(s)).blob()
  const media: Media[] = []
  for (const m of data.media || []) {
    media.push({ ...m, blob: await fromDataUrl(m.blob), thumb: m.thumb ? await fromDataUrl(m.thumb) : undefined })
  }
  await db.media.bulkPut(media)
  await saveRecords(data)
  return { memories: (data.memories || []).length, events: (data.events || []).length, tickets: (data.tickets || []).length, media: media.length }
}

export async function importBackup(file: Blob): Promise<RestoreResult> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b ? restoreZip(file) : restoreJson(file)
}
