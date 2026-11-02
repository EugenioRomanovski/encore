import { db, deleteMedia, isDemoId, type FriendRef, type Memory, type PlannedEvent, type ShareOrigin } from './db'
import { norm } from './ticketText'
import type { Share } from './social'

/*
 * The same concert can end up here twice: a friend tags you on a show you already added yourself,
 * or a friend's plan arrives first and later their memory of it. Same date + same artist = same concert.
 */

export function sameConcert(a: { artist: string; date: string }, b: { artist: string; date: string }) {
  if (!a.date || a.date !== b.date) return false
  const x = norm(a.artist), y = norm(b.artist)
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))
}

export type Match = { kind: 'memory'; rec: Memory } | { kind: 'event'; rec: PlannedEvent }

/** Your own memory or plan for the concert a friend's card is about (memories first). */
export async function findMatch(c: { artist: string; date: string }, exceptId?: string): Promise<Match | undefined> {
  if (!c.date) return undefined
  const ok = <T extends { id: string; artist: string; date: string }>(r: T) => r.id !== exceptId && !isDemoId(r.id) && sameConcert(r, c)
  const mem = (await db.memories.where('date').equals(c.date).toArray()).find(ok)
  if (mem) return { kind: 'memory', rec: mem }
  const ev = (await db.events.where('date').equals(c.date).toArray()).find(ok)
  if (ev) return { kind: 'event', rec: ev }
  return undefined
}

const addFriend = (list: FriendRef[] | undefined, f: FriendRef) => (list?.some((x) => x.id === f.id) ? list : [...(list || []), f])
const union = (a: string[] = [], b: string[] = []) => [...a, ...b.filter((x) => !a.includes(x))]
const joinNotes = (a: string, b: string) => {
  const x = a.trim(), y = b.trim()
  return !x ? y : !y || x.includes(y) ? x : y.includes(x) ? y : `${x}\n\n${y}`
}

export const friendOf = (s: Share): FriendRef => ({ id: s.from.id, username: s.from.username, name: s.from.name, avatar: s.from.avatar })
export const originOf = (s: Share): ShareOrigin => ({ shareId: s.id, userId: s.from.id, username: s.from.username })

/** Fold a friend's card into a concert you already have: they join the company, empty fields are filled in. */
export async function mergeShareInto(m: Match, s: Share) {
  const p = s.payload
  if (m.kind === 'event') {
    const e = m.rec
    await db.events.put({
      ...e,
      tour: e.tour || p.tour,
      venue: e.venue || p.venue,
      doors: e.doors || p.doors,
      show: e.show || p.show || p.time,
      friends: addFriend(e.friends, friendOf(s)),
      // keeps us from sending the card straight back to the friend who sent it
      sharedFrom: e.sharedFrom || originOf(s),
    })
  } else {
    const r = m.rec
    const keepSetlist = r.setlist.length > 0 || !p.setlist?.length
    await db.memories.put({
      ...r,
      tour: r.tour || p.tour,
      venue: r.venue || p.venue,
      time: r.time || p.time || p.show,
      genres: union(r.genres, p.genres),
      setlist: keepSetlist ? r.setlist : p.setlist!,
      encoreAt: keepSetlist ? r.encoreAt : (p.encoreAt ?? null),
      friends: addFriend(r.friends, friendOf(s)),
      sharedFrom: r.sharedFrom || originOf(s),
      updatedAt: Date.now(),
    })
  }
}

/** Duplicates of this memory / plan already on the device. */
export function findDuplicates<T extends { id: string; artist: string; date: string }>(table: 'memories' | 'events', r: T): Promise<T[]> {
  if (!r.date || isDemoId(r.id)) return Promise.resolve([])
  return (db[table].where('date').equals(r.date).toArray() as Promise<unknown[]>).then((xs) =>
    (xs as T[]).filter((x) => x.id !== r.id && !isDemoId(x.id) && sameConcert(x, r)),
  )
}

/** Merge `other` into `keep` (photos, company, notes, tickets) and delete `other`; the photos are kept. */
export async function mergeMemories(keep: Memory, other: Memory) {
  await db.transaction('rw', db.memories, db.tickets, async () => {
    const setlist = keep.setlist.length ? keep.setlist : other.setlist
    const media = union(keep.mediaIds, other.mediaIds)
    let friends = keep.friends
    for (const f of other.friends || []) friends = addFriend(friends, f)
    await db.memories.put({
      ...keep,
      tour: keep.tour || other.tour,
      venue: keep.venue || other.venue,
      time: keep.time || other.time,
      rating: Math.max(keep.rating, other.rating),
      notes: joinNotes(keep.notes, other.notes),
      people: union(keep.people, other.people),
      genres: union(keep.genres, other.genres),
      setlist,
      encoreAt: keep.setlist.length ? keep.encoreAt : other.encoreAt,
      mediaIds: media,
      coverId: keep.coverId || other.coverId || media[0],
      friends,
      sharedFrom: keep.sharedFrom || other.sharedFrom,
      importedPhotos: keep.importedPhotos || other.importedPhotos ? union(keep.importedPhotos, other.importedPhotos) : undefined,
      createdAt: Math.min(keep.createdAt, other.createdAt),
      updatedAt: Date.now(),
    })
    await db.tickets.where('memoryId').equals(other.id).modify({ memoryId: keep.id })
    await db.memories.delete(other.id)
  })
}

export async function mergeEvents(keep: PlannedEvent, other: PlannedEvent) {
  await db.transaction('rw', db.events, db.tickets, db.media, async () => {
    let friends = keep.friends
    for (const f of other.friends || []) friends = addFriend(friends, f)
    await db.events.put({
      ...keep,
      tour: keep.tour || other.tour,
      venue: keep.venue || other.venue,
      doors: keep.doors || other.doors,
      show: keep.show || other.show,
      notes: joinNotes(keep.notes, other.notes),
      coverId: keep.coverId || other.coverId,
      friends,
      sharedFrom: keep.sharedFrom || other.sharedFrom,
      createdAt: Math.min(keep.createdAt, other.createdAt),
    })
    await db.tickets.where('eventId').equals(other.id).modify({ eventId: keep.id })
    if (other.coverId && keep.coverId && other.coverId !== keep.coverId) await deleteMedia([other.coverId])
    await db.events.delete(other.id)
  })
}
