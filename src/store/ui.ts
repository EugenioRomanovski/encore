import { create } from 'zustand'
import type { SeatField, TicketKind } from '../lib/db'
import type { TicketHints } from '../lib/ticketText'

export type Theme = 'dark' | 'light'
export type SheetKind = null | 'plus' | 'ticket'

/** A ticket being added, before it is assigned to a concert and saved. */
export interface TicketDraft {
  kind: Exclude<TicketKind, 'demo'>
  pages: Blob[]
  file?: Blob
  fileName?: string
  fileSize?: number
  text?: string
  seat: SeatField[]
  /** show title / venue / date / times read from the ticket, offered when creating a new event */
  hints?: TicketHints
}

/** Where a new ticket should be attached by default. */
export interface TicketTarget {
  eventId?: string
  memoryId?: string
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}

interface UI {
  theme: Theme
  setTheme: (t: Theme) => void
  name: string
  setName: (n: string) => void
  onboarded: boolean
  setOnboarded: () => void
  sheet: SheetKind
  openSheet: (s: SheetKind, target?: TicketTarget) => void
  target: TicketTarget
  toast: string | null
  say: (t: string) => void
  draft: TicketDraft | null
  setDraft: (d: TicketDraft | null) => void
  scanRaw: Blob | null
  setScanRaw: (b: Blob | null) => void
  busy: string | null
  setBusy: (b: string | null) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUI = create<UI>((set) => ({
  theme: (ls.get('encore.theme') as Theme) || 'dark',
  setTheme: (theme) => {
    ls.set('encore.theme', theme)
    set({ theme })
  },
  name: ls.get('encore.name') || '',
  setName: (name) => {
    ls.set('encore.name', name)
    set({ name })
  },
  onboarded: ls.get('encore.onboarded') === '1',
  setOnboarded: () => {
    ls.set('encore.onboarded', '1')
    set({ onboarded: true })
  },
  sheet: null,
  target: {},
  // closing keeps the target: the add-ticket flow continues on other screens after the sheet closes
  openSheet: (sheet, target) => set((s) => ({ sheet, target: sheet === null ? s.target : (target ?? {}) })),
  toast: null,
  say: (toast) => {
    clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 2400)
  },
  draft: null,
  setDraft: (draft) => set({ draft }),
  scanRaw: null,
  setScanRaw: (scanRaw) => set({ scanRaw }),
  busy: null,
  setBusy: (busy) => set({ busy }),
}))
