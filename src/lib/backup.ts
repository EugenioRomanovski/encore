import { db, type Media } from './db'
import { downloadBlob } from './ics'
import { todayISO } from './format'

const toDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

const fromDataUrl = async (s: string) => (await fetch(s)).blob()

export async function exportBackup() {
  const [media, memories, events, tickets] = await Promise.all([
    db.media.toArray(),
    db.memories.toArray(),
    db.events.toArray(),
    db.tickets.toArray(),
  ])
  const mediaOut = []
  for (const m of media) {
    mediaOut.push({ ...m, blob: await toDataUrl(m.blob), thumb: m.thumb ? await toDataUrl(m.thumb) : undefined })
  }
  const json = JSON.stringify({ app: 'encore', version: 1, exportedAt: Date.now(), memories, events, tickets, media: mediaOut })
  downloadBlob(new Blob([json], { type: 'application/json' }), `encore-backup-${todayISO()}.json`)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'encore') throw new Error('Это не резервная копия Encore')
  const media: Media[] = []
  for (const m of data.media || []) {
    media.push({ ...m, blob: await fromDataUrl(m.blob), thumb: m.thumb ? await fromDataUrl(m.thumb) : undefined })
  }
  await db.transaction('rw', db.media, db.memories, db.events, db.tickets, async () => {
    await db.media.bulkPut(media)
    await db.memories.bulkPut(data.memories || [])
    await db.events.bulkPut(data.events || [])
    await db.tickets.bulkPut(data.tickets || [])
  })
  return { memories: (data.memories || []).length, events: (data.events || []).length, tickets: (data.tickets || []).length }
}
