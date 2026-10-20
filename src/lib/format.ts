const WD = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
const MON = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК']
const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

/** Parse a YYYY-MM-DD string as a local date (no timezone shift). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function toHM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** "14 ИЮН 2025" — ticket-print style */
export const stamp = (s: string) => {
  const d = parseDate(s)
  return `${p2(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`
}
/** "СБ 14 ИЮН 2025" */
export const stampDow = (s: string) => `${WD[parseDate(s).getDay()]} ${stamp(s)}`
/** "СБ 14 ИЮН" */
export const stampShort = (s: string) => {
  const d = parseDate(s)
  return `${WD[d.getDay()]} ${p2(d.getDate())} ${MON[d.getMonth()]}`
}
export const dow = (s: string) => WD[parseDate(s).getDay()]
export const dowLong = (s: string) => WD_LONG[parseDate(s).getDay()]
export const monShort = (s: string) => MON[parseDate(s).getMonth()]
export const dayNum = (s: string) => p2(parseDate(s).getDate())
export const year = (s: string) => parseDate(s).getFullYear()
/** "14 июня 2025" */
export const longDate = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()} ${MON_GEN[d.getMonth()]} ${d.getFullYear()}`
}
/** "14 июня" */
export const dayMonth = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()} ${MON_GEN[d.getMonth()]}`
}

export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export const pl = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`

/** Whole days from today to the date (negative when in the past). */
export function daysUntil(s: string) {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return Math.round((parseDate(s).getTime() - t.getTime()) / 86400000)
}

export function relDays(n: number) {
  if (n === 0) return 'Сегодня'
  if (n === 1) return 'Завтра'
  if (n === -1) return 'Вчера'
  if (n > 0) return `Через ${pl(n, ['день', 'дня', 'дней'])}`
  return `${pl(-n, ['день', 'дня', 'дней'])} назад`
}

export const isPastDate = (s: string) => daysUntil(s) < 0

export function fileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export const RATING_LABELS = ['Нажмите, чтобы оценить', 'Так себе', 'Нормально', 'Хороший вечер', 'Очень понравилось', 'Незабываемо']
