import Dexie, { type Table } from 'dexie'

export type MediaKind = 'image' | 'video' | 'file'

/** A stored photo, video or ticket page. Blobs live in IndexedDB. */
export interface Media {
  id: string
  blob: Blob
  thumb?: Blob
  kind: MediaKind
  takenAt?: number
  createdAt: number
}

/** A friend (Encore account) tagged on a concert — a snapshot, so it shows offline. */
export interface FriendRef {
  id: string
  username: string
  name: string
  avatar?: string
}

/** Set when a record was created from a friend's shared card (so it is not shared back to them). */
export interface ShareOrigin {
  shareId: string
  userId: string
  username: string
}

export interface Memory {
  id: string
  artist: string
  tour?: string
  venue: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time?: string
  rating: number
  notes: string
  people: string[]
  genres: string[]
  setlist: string[]
  /** Index of the first encore song in `setlist`, or null when there was no encore. */
  encoreAt: number | null
  mediaIds: string[]
  coverId?: string
  friends?: FriendRef[]
  sharedFrom?: ShareOrigin
  /** Show this memory's photos to tagged friends (default: yes). */
  sharePhotos?: boolean
  /** Ids (in the friend's account) of photos already copied from `sharedFrom`. */
  importedPhotos?: string[]
  palette: number
  createdAt: number
  updatedAt: number
}

export interface PlannedEvent {
  id: string
  artist: string
  tour?: string
  venue: string
  date: string
  doors?: string
  show?: string
  notes: string
  coverId?: string
  friends?: FriendRef[]
  sharedFrom?: ShareOrigin
  palette: number
  createdAt: number
}

export type TicketKind = 'pdf' | 'image' | 'scan' | 'demo'

export interface SeatField {
  k: string
  v: string
}

/** A barcode on a ticket page: its box as fractions of the page (quiet zone included) and what it encodes. */
export interface TicketCode {
  page: number
  x: number
  y: number
  w: number
  h: number
  format: string
  text: string
  linear: boolean
}

export interface Ticket {
  id: string
  kind: TicketKind
  /** Rendered page images (media ids), in order. */
  pageIds: string[]
  /** Original file (e.g. the PDF), when there is one. */
  fileId?: string
  fileName?: string
  fileSize?: number
  eventId?: string
  memoryId?: string
  artist: string
  tour?: string
  venue: string
  date: string
  time?: string
  seat: SeatField[]
  code?: string
  /** barcodes / QR codes found on the pages; undefined = not looked for yet */
  codes?: TicketCode[]
  palette: number
  createdAt: number
}

class EncoreDB extends Dexie {
  media!: Table<Media, string>
  memories!: Table<Memory, string>
  events!: Table<PlannedEvent, string>
  tickets!: Table<Ticket, string>
  outbox!: Table<OutboxItem, string>

  constructor() {
    super('encore')
    this.version(1).stores({
      media: 'id, createdAt',
      memories: 'id, date, artist, venue',
      events: 'id, date',
      tickets: 'id, date, eventId, memoryId',
    })
    this.version(2).stores({
      outbox: 'key, at',
    })
  }
}

export const db = new EncoreDB()

// ---------- change tracking for cloud sync ----------

export const SYNCED_TABLES = ['memories', 'events', 'tickets', 'media'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

/** A local change waiting to be pushed: the current row (or its absence) is what gets sent. */
export interface OutboxItem {
  key: string
  table: SyncedTable
  id: string
  at: number
}

export const isDemoId = (id: string) => id.startsWith('demo-')
export const outboxKey = (table: SyncedTable, id: string) => `${table}:${id}`

type Tx = { on: (e: 'complete', fn: () => void) => void } & { __remote?: boolean; __changes?: Map<string, OutboxItem> }

let outboxListener: () => void = () => {}
export const setOutboxListener = (fn: () => void) => (outboxListener = fn)

/** Mark a transaction as applying data from the cloud, so it isn't echoed back. */
export const markRemote = (tx: unknown) => ((tx as Tx).__remote = true)

function track(table: SyncedTable, id: unknown, tx: unknown) {
  const t = tx as Tx
  if (typeof id !== 'string' || isDemoId(id) || t.__remote) return
  if (!t.__changes) {
    const changes = new Map<string, OutboxItem>()
    t.__changes = changes
    // hooks can't write other tables mid-transaction; record the changes once it commits
    t.on('complete', () => {
      db.outbox.bulkPut([...changes.values()]).then(() => outboxListener(), () => {})
    })
  }
  const key = outboxKey(table, id)
  t.__changes.set(key, { key, table, id, at: Date.now() })
}

for (const table of SYNCED_TABLES) {
  const tb = db.table(table)
  tb.hook('creating', function (key, obj, tx) {
    track(table, key ?? (obj as { id?: string }).id, tx)
  })
  tb.hook('updating', function (_mods, key, _obj, tx) {
    track(table, key, tx)
  })
  tb.hook('deleting', function (key, _obj, tx) {
    track(table, key, tx)
  })
}

/** Queue every local (non-demo) row for upload — used when an account is first connected on this device. */
export async function enqueueAll() {
  const now = Date.now()
  const items: OutboxItem[] = []
  for (const table of SYNCED_TABLES) {
    for (const id of (await db.table(table).toCollection().primaryKeys()) as string[]) {
      if (!isDemoId(id)) items.push({ key: outboxKey(table, id), table, id, at: now })
    }
  }
  await db.outbox.bulkPut(items)
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export async function deleteMedia(ids: (string | undefined)[]) {
  const list = ids.filter(Boolean) as string[]
  if (list.length) await db.media.bulkDelete(list)
}

export async function deleteMemory(m: Memory) {
  await db.transaction('rw', db.memories, db.media, db.tickets, async () => {
    await deleteMedia(m.mediaIds)
    await db.tickets.where('memoryId').equals(m.id).modify({ memoryId: undefined })
    await db.memories.delete(m.id)
  })
}

export async function deleteEvent(e: PlannedEvent) {
  await db.transaction('rw', db.events, db.media, db.tickets, async () => {
    await deleteMedia([e.coverId])
    await db.tickets.where('eventId').equals(e.id).modify({ eventId: undefined })
    await db.events.delete(e.id)
  })
}

export async function deleteTicket(t: Ticket) {
  await db.transaction('rw', db.tickets, db.media, async () => {
    await deleteMedia([...t.pageIds, t.fileId])
    await db.tickets.delete(t.id)
  })
}

/** Clear everything on this device only — marked remote so the deletions are never pushed to the cloud. */
export async function wipeAll() {
  await db.transaction('rw', [db.media, db.memories, db.events, db.tickets, db.outbox], async (tx) => {
    markRemote(tx)
    await Promise.all([db.media.clear(), db.memories.clear(), db.events.clear(), db.tickets.clear(), db.outbox.clear()])
  })
}
