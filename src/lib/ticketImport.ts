import { resizeImage } from './media'
import { readSeat } from './ticketText'
import { db, uid, type Media, type Ticket } from './db'
import type { TicketDraft } from '../store/ui'
import { paletteFor } from './palette'

export async function draftFromPdf(file: File): Promise<TicketDraft> {
  // pdf.js is heavy — load it only when a PDF is actually imported
  const { renderPdf } = await import('./pdf')
  const { pages, text } = await renderPdf(file)
  return { kind: 'pdf', pages, file, fileName: file.name, fileSize: file.size, text, seat: readSeat(text) }
}

export async function draftFromImage(file: File): Promise<TicketDraft> {
  // keep tickets large so QR / barcodes stay scannable
  const page = await resizeImage(file, 2400, 'image/jpeg', 0.92)
  return { kind: 'image', pages: [page], fileName: file.name || 'Изображение', fileSize: file.size, seat: [] }
}

export interface TicketInfo {
  artist: string
  tour?: string
  venue: string
  date: string
  time?: string
  eventId?: string
  memoryId?: string
}

/** Persist a draft as a ticket: page images + original file go to the media table. */
export async function saveDraft(d: TicketDraft, info: TicketInfo, seat: Ticket['seat']): Promise<string> {
  const now = Date.now()
  const pageMedia: Media[] = []
  for (const p of d.pages) {
    pageMedia.push({ id: uid(), blob: p, thumb: await resizeImage(p, 640, 'image/jpeg', 0.8), kind: 'image', createdAt: now })
  }
  const fileMedia: Media | undefined = d.file ? { id: uid(), blob: d.file, kind: 'file', createdAt: now } : undefined
  const t: Ticket = {
    id: uid(),
    kind: d.kind,
    pageIds: pageMedia.map((m) => m.id),
    fileId: fileMedia?.id,
    fileName: d.fileName,
    fileSize: d.fileSize,
    ...info,
    seat: seat.filter((s) => s.v.trim()),
    palette: paletteFor(info.artist + info.date) % 6,
    createdAt: now,
  }
  await db.transaction('rw', db.media, db.tickets, async () => {
    await db.media.bulkPut(fileMedia ? [...pageMedia, fileMedia] : pageMedia)
    await db.tickets.put(t)
  })
  return t.id
}
