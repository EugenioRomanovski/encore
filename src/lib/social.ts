import { create } from 'zustand'
import type { FriendRef } from './db'
import { setAfterSync, supabase, useSync } from './sync'
import { useUI } from '../store/ui'

/*
 * Profiles, friends and concert cards shared between friends (Supabase tables: profiles,
 * friendships, shares; actions that touch two accounts go through RPC functions).
 * Everything here is cached in localStorage so the lists still show offline.
 */

export interface Profile {
  user_id: string
  username: string
  display_name: string
}

export interface Person {
  id: string
  username: string
  name: string
}

export interface SharePayload {
  artist: string
  tour?: string
  venue: string
  date: string
  time?: string
  doors?: string
  show?: string
  setlist?: string[]
  encoreAt?: number | null
  genres?: string[]
}

export interface Share {
  id: string
  kind: 'memory' | 'event'
  from: Person
  payload: SharePayload
  created_at: string
}

interface SocialState {
  /** undefined = not loaded yet, null = signed in but no username chosen */
  profile: Profile | null | undefined
  friends: Person[]
  incoming: Person[]
  outgoing: Person[]
  inbox: Share[]
}

const CACHE = 'encore.social'
const PENDING = 'encore.social.pending' // share status changes made offline

const read = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || '') as T
  } catch {
    return d
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}

const empty: SocialState = { profile: undefined, friends: [], incoming: [], outgoing: [], inbox: [] }
export const useSocial = create<SocialState>(() => ({ ...empty, ...read<Partial<SocialState>>(CACHE, {}) }))

function setSocial(p: Partial<SocialState>) {
  useSocial.setState(p)
  const { profile, friends, incoming, outgoing, inbox } = useSocial.getState()
  write(CACHE, { profile, friends, incoming, outgoing, inbox })
}

export const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$/
export const normalizeUsername = (s: string) => s.trim().replace(/^@/, '').toLowerCase()

export function usernameProblem(u: string): string | null {
  if (u.length < 3) return 'Минимум 3 символа'
  if (u.length > 24) return 'Максимум 24 символа'
  if (!/^[a-z0-9_.]+$/.test(u)) return 'Только латиница, цифры, «_» и «.»'
  if (!USERNAME_RE.test(u)) return 'Не может начинаться или заканчиваться точкой'
  return null
}

const toPerson = (p: Profile): Person => ({ id: p.user_id, username: p.username, name: p.display_name || p.username })
export const toFriendRef = (p: Person): FriendRef => ({ id: p.id, username: p.username, name: p.name })

// ---------- profile ----------

async function loadProfile(uid: string) {
  const { data, error } = await supabase.from('profiles').select('user_id,username,display_name').eq('user_id', uid).maybeSingle()
  if (error) throw error
  const profile = (data as Profile | null) ?? null
  setSocial({ profile })
  // the account's name wins on every device; a name typed before signing in fills an empty one
  const ui = useUI.getState()
  if (profile?.display_name) {
    if (profile.display_name !== ui.name) ui.setName(profile.display_name)
  } else if (profile && ui.name) {
    await supabase.from('profiles').update({ display_name: ui.name, updated_at: new Date().toISOString() }).eq('user_id', uid)
    setSocial({ profile: { ...profile, display_name: ui.name } })
  }
}

export async function isUsernameFree(username: string) {
  const me = useSync.getState().user?.id
  const { data, error } = await supabase.from('profiles').select('user_id').eq('username', username).maybeSingle()
  if (error) throw error
  return !data || data.user_id === me
}

export async function saveProfile(username: string, displayName: string) {
  const uid = useSync.getState().user?.id
  if (!uid) throw new Error('Войдите в аккаунт')
  const row = { user_id: uid, username, display_name: displayName.trim(), updated_at: new Date().toISOString() }
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' })
  if (error) {
    if (error.code === '23505') throw new Error('Это имя уже занято')
    throw error
  }
  setSocial({ profile: row })
  if (displayName.trim()) useUI.getState().setName(displayName.trim())
}

/** Keep the account's display name in step with the name edited in the profile header. */
export async function pushDisplayName(name: string) {
  const { profile } = useSocial.getState()
  const uid = useSync.getState().user?.id
  if (!uid || !profile) return
  setSocial({ profile: { ...profile, display_name: name } })
  await supabase.from('profiles').update({ display_name: name, updated_at: new Date().toISOString() }).eq('user_id', uid)
}

// ---------- friends ----------

async function loadFriends(uid: string) {
  const { data, error } = await supabase.from('friendships').select('requester,addressee,status')
  if (error) throw error
  const rows = (data || []) as { requester: string; addressee: string; status: string }[]
  const other = (r: (typeof rows)[number]) => (r.requester === uid ? r.addressee : r.requester)
  const ids = [...new Set(rows.map(other))]
  const people = new Map<string, Person>()
  if (ids.length) {
    const { data: ps, error: e2 } = await supabase.from('profiles').select('user_id,username,display_name').in('user_id', ids)
    if (e2) throw e2
    for (const p of (ps || []) as Profile[]) people.set(p.user_id, toPerson(p))
  }
  const pick = (f: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(f).map((r) => people.get(other(r))).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name, 'ru')) as Person[]
  setSocial({
    friends: pick((r) => r.status === 'accepted'),
    incoming: pick((r) => r.status === 'pending' && r.addressee === uid),
    outgoing: pick((r) => r.status === 'pending' && r.requester === uid),
  })
}

export async function searchPeople(q: string): Promise<Person[]> {
  const u = normalizeUsername(q).replace(/[^a-z0-9_.]/g, '')
  if (u.length < 2) return []
  const me = useSync.getState().user?.id
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,username,display_name')
    .like('username', `${u}%`)
    .order('username')
    .limit(20)
  if (error) throw error
  return ((data || []) as Profile[]).filter((p) => p.user_id !== me).map(toPerson)
}

export type RequestResult = 'requested' | 'accepted' | 'pending' | 'friends' | 'self' | 'not_found'

export async function sendFriendRequest(username: string): Promise<RequestResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_username: username })
  if (error) throw error
  await refreshFriends()
  return data as RequestResult
}

export async function acceptFriend(id: string) {
  const { error } = await supabase.rpc('accept_friend_request', { p_requester: id })
  if (error) throw error
  await refreshFriends()
}

/** Decline an incoming request, cancel an outgoing one, or remove a friend. */
export async function removeFriend(id: string) {
  const uid = useSync.getState().user?.id
  if (!uid) return
  const { error } = await supabase.from('friendships').delete().or(`and(requester.eq.${uid},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${uid})`)
  if (error) throw error
  await refreshFriends()
}

export async function refreshFriends() {
  const uid = useSync.getState().user?.id
  if (uid) await loadFriends(uid)
}

// ---------- shared concerts ----------

async function flushPendingStatuses() {
  const pending = read<Record<string, 'added' | 'dismissed'>>(PENDING, {})
  for (const [id, status] of Object.entries(pending)) {
    const { error } = await supabase.from('shares').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    delete pending[id]
    write(PENDING, pending)
  }
}

async function loadInbox(uid: string) {
  await flushPendingStatuses()
  const { data, error } = await supabase
    .from('shares')
    .select('id,kind,from_user,payload,created_at')
    .eq('to_user', uid)
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  const rows = (data || []) as { id: string; kind: 'memory' | 'event'; from_user: string; payload: SharePayload; created_at: string }[]
  const known = new Map(useSocial.getState().friends.map((f) => [f.id, f]))
  const missing = [...new Set(rows.map((r) => r.from_user))].filter((id) => !known.has(id))
  if (missing.length) {
    const { data: ps } = await supabase.from('profiles').select('user_id,username,display_name').in('user_id', missing)
    for (const p of (ps || []) as Profile[]) known.set(p.user_id, toPerson(p))
  }
  setSocial({
    inbox: rows.map((r) => ({ id: r.id, kind: r.kind, payload: r.payload, created_at: r.created_at, from: known.get(r.from_user) || { id: r.from_user, username: 'friend', name: 'Друг' } })),
  })
}

/** Mark a shared card as added or hidden; works offline (sent on the next sync). */
export function setShareStatus(id: string, status: 'added' | 'dismissed') {
  setSocial({ inbox: useSocial.getState().inbox.filter((s) => s.id !== id) })
  const pending = read<Record<string, 'added' | 'dismissed'>>(PENDING, {})
  pending[id] = status
  write(PENDING, pending)
  flushPendingStatuses().catch(() => {})
}

export const findShare = (id: string | null) => (id ? useSocial.getState().inbox.find((s) => s.id === id) : undefined)

// ---------- lifecycle ----------

export async function refreshSocial(uid: string) {
  await loadProfile(uid)
  await loadFriends(uid)
  await loadInbox(uid)
}

let started = false
export function initSocial() {
  if (started) return
  started = true
  // social lists are secondary: a failure there must not mark the data sync as failed
  setAfterSync((uid) => refreshSocial(uid).catch((e) => console.warn('social refresh failed', e)))
  // signed out or switched account: forget the cached lists
  let last = useSync.getState().user?.id
  useSync.subscribe((s) => {
    const id = s.user?.id
    if (!s.ready || id === last) return
    if (last) setSocial({ ...empty })
    last = id
  })
}
