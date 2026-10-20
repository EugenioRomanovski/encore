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
