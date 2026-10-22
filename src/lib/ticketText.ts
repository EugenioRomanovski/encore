import type { SeatField } from './db'

const RULES: [string, RegExp][] = [
  ['СЕКТОР', /(?:сектор|sector|sec\.?|block|блок)\s*[:№#]?\s*([A-ZА-Я0-9-]{1,6})/i],
  ['РЯД', /(?:ряд|row)\s*[:№#]?\s*([A-ZА-Я0-9-]{1,4})/i],
  ['МЕСТО', /(?:место|seat)\s*[:№#]?\s*([A-ZА-Я0-9-]{1,4})/i],
]

/** Best-effort read of section/row/seat from text extracted from a PDF ticket. */
export function readSeat(text: string): SeatField[] {
  const out: SeatField[] = []
  for (const [k, re] of RULES) {
    const m = text.match(re)
    if (m) out.push({ k, v: m[1].toUpperCase() })
  }
  if (!out.length && /танцпол|фан-?зона|general admission|\bGA\b|партер/i.test(text)) {
    out.push({ k: 'ВХОД', v: /фан-?зона/i.test(text) ? 'ФАН-ЗОНА' : 'ТАНЦПОЛ' })
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()

/** Does the ticket text mention this artist? */
export function textMentions(text: string, artist: string) {
  const a = norm(artist)
  return a.length > 1 && norm(text).includes(a)
}

// ---------- show details for a new event ----------

export interface TicketHints {
  artists: string[]
  tours: string[]
  venues: string[]
  /** YYYY-MM-DD, nearest upcoming first */
  dates: string[]
  doors?: string
  show?: string
}

const MONTHS: [RegExp, number][] = [
  [/^(янв|jan)/i, 1], [/^(фев|feb)/i, 2], [/^(мар|mar)/i, 3], [/^(апр|apr)/i, 4], [/^(ма[йя]|may)/i, 5], [/^(июн|jun)/i, 6],
  [/^(июл|jul)/i, 7], [/^(авг|aug)/i, 8], [/^(сен|sep)/i, 9], [/^(окт|oct)/i, 10], [/^(ноя|nov)/i, 11], [/^(дек|dec)/i, 12],
]
const monthOf = (w: string) => MONTHS.find(([re]) => re.test(w))?.[1]
const MONTH_WORD = '(январ[яь]|феврал[яь]|марта?|апрел[яь]|ма[йя]|июн[яь]|июл[яь]|августа?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь]|янв|фев|мар|апр|июн|июл|авг|сен|сент|окт|ноя|дек|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?'

const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function findDates(text: string): string[] {
  const out: string[] = []
  const now = new Date()
  const add = (v: string | null) => v && !out.includes(v) && out.push(v)
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(iso(+m[1], +m[2], +m[3]))
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g)) add(iso(+m[3], +m[2], +m[1]))
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?`, 'gi'))) {
    const mon = monthOf(m[2])
    if (mon) add(iso(m[3] ? +m[3] : now.getFullYear(), mon, +m[1]))
  }
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'gi'))) {
    const mon = monthOf(m[1])
    if (mon) add(iso(+m[3], mon, +m[2]))
  }
  const today = now.toISOString().slice(0, 10)
  // upcoming dates first (nearest), then past ones (latest) — a ticket is usually for a future show
  return out.sort((a, b) => (a >= today) !== (b >= today) ? (a >= today ? -1 : 1) : a >= today ? a.localeCompare(b) : b.localeCompare(a))
}

const TIME = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g
const hm = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`

function findTimes(lines: string[]) {
  let doors: string | undefined, show: string | undefined
  const all: string[] = []
  for (const l of lines) {
    for (const m of l.matchAll(TIME)) {
      const t = hm(m[1], m[2])
      if (!all.includes(t)) all.push(t)
      const before = l.slice(Math.max(0, (m.index || 0) - 30), m.index).toLowerCase()
      if (!doors && /(вход|двер|открыти|doors|entry|gates)/.test(before)) doors = t
      else if (!show && /(начало|старт|start|show|концерт|begin)/.test(before)) show = t
    }
  }
  const sorted = [...all].sort()
  if (!show && !doors && sorted.length >= 2) [doors, show] = [sorted[0], sorted[sorted.length - 1]]
  else if (!show && sorted.length) show = sorted.find((t) => t !== doors) || (doors ? undefined : sorted[0])
  return { doors, show }
}

const VENUE_WORD = /(арен|arena|клуб|club|стадион|stadium|холл|hall\b|(?<![а-яё])зал(?![а-яё])|театр|theat|дворец|(?<![а-яё])дк(?![а-яё])|центр|cent(?:er|re)|garden|academy|(?<![а-яё])парк(?![а-яё])|\bpark\b|лофт|loft|площадк|amphi|кремл|forum|форум|сцена|stage|(?<![а-яё])бар(?![а-яё]))/i
const NOISE = /(танцпол|партер|фан-?зона|балкон|амфитеатр|ложа|\bvip\b|general admission|\bga\b|билет|ticket|электрон|заказ|order|\bqr\b|штрих|barcode|сектор|sector|(?<![а-яё])ряд(?![а-яё])|\brow\b|место\s*\d|seat|цена|price|стоим|руб|₽|\$|€|сбор|комисс|оплат|payment|покупател|buyer|фио|name:|кассир|возврат|refund|правил|rules|www\.|http|@|\.ru\b|\.com\b|тел\.|phone|инн|огрн|\d{6,})/i
const clean = (s: string) => s.replace(/^[\s.,:;–—-]+|[\s.,:;–—-]+$/g, '').replace(/\s+/g, ' ').trim()
const hasDateOrTime = (s: string) => findDates(s).length > 0 || new RegExp(TIME.source).test(s)
const LABEL = /^(?:мероприятие|событие|концерт|артист|исполнитель|шоу|event|artist|performer|show|место проведения|площадка|venue|location|место|дата|date|время|time|начало|вход|doors)\s*[:\-–]/i
// no \b: JS word boundaries don't know Cyrillic
const TOUR = /(^|[^a-zа-яё])(tour|тур|турне)([^a-zа-яё]|$)/i
const unlabel = (s: string) => s.replace(LABEL, '')

function uniq(xs: string[], max: number) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of xs.map(clean)) {
    const k = x.toLowerCase()
    if (x.length < 2 || seen.has(k)) continue
    seen.add(k)
    out.push(x)
    if (out.length >= max) break
  }
  return out
}

/** Best-effort read of what the show is, where and when, from a PDF ticket's text. */
export function readHints(text: string, lines: { text: string; size: number }[] = []): TicketHints {
  const rows = lines.length ? lines.map((l) => l.text) : text.split('\n')
  const labelled = (re: RegExp) => rows.map((r) => r.match(re)?.[1]).filter(Boolean) as string[]

  const venues = uniq([
    ...labelled(/(?:место проведения|площадка|venue|location|место)\s*[:\-–]\s*(.{3,70})/i),
    ...rows.map(unlabel).filter((r) => VENUE_WORD.test(r) && r.length <= 70 && !NOISE.test(r) && !hasDateOrTime(r)).map((r) => r.split(/[,|]/)[0]),
  ], 3)

  const plain = (t: string) =>
    t.length >= 2 && t.length <= 60 && !LABEL.test(t) && !NOISE.test(t) && !hasDateOrTime(t) && !/^[\d\s.,:-]+$/.test(t) &&
    !venues.some((v) => t.toLowerCase().includes(v.toLowerCase()))
  const tours = uniq(rows.map(unlabel).filter((r) => TOUR.test(r) && r.length <= 60 && !NOISE.test(r) && !hasDateOrTime(r)), 2)
  const byLabel = labelled(/(?:мероприятие|событие|концерт|артист|исполнитель|шоу|event|artist|performer|show)\s*[:\-–]\s*(.{2,70})/i).filter((x) => !hasDateOrTime(x))
  // otherwise: the biggest text on the ticket
  const bySize = [...lines].filter((l) => plain(l.text) && !TOUR.test(l.text)).sort((a, b) => b.size - a.size).map((l) => l.text)
  const artists = uniq([...byLabel, ...bySize], 3)

  return { artists, tours, venues, dates: findDates(rows.join('\n')).slice(0, 3), ...findTimes(rows) }
}
