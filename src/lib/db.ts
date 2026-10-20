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
  palette: number
  createdAt: number
}

export type TicketKind = 'pdf' | 'image' | 'scan' | 'demo'

export interface SeatField {
  k: string
  v: string
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
  palette: number
  createdAt: number
}

class EncoreDB extends Dexie {
  media!: Table<Media, string>
  memories!: Table<Memory, string>
  events!: Table<PlannedEvent, string>
  tickets!: Table<Ticket, string>

  constructor() {
    super('encore')
    this.version(1).stores({
      media: 'id, createdAt',
      memories: 'id, date, artist, venue',
      events: 'id, date',
      tickets: 'id, date, eventId, memoryId',
    })
  }
}

export const db = new EncoreDB()

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

export async function wipeAll() {
  await db.transaction('rw', db.media, db.memories, db.events, db.tickets, async () => {
    await Promise.all([db.media.clear(), db.memories.clear(), db.events.clear(), db.tickets.clear()])
  })
}
