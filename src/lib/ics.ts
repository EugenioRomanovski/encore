import type { PlannedEvent } from './db'
import { parseDate } from './format'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m)

function at(date: string, hm?: string) {
  const d = parseDate(date)
  const [h, m] = (hm || '19:00').split(':').map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

/** Calendar file with alarms the day before and 2 h before doors. */
export function buildIcs(e: PlannedEvent) {
  const start = at(e.date, e.show || e.doors)
  const doors = at(e.date, e.doors || e.show)
  const end = new Date(start.getTime() + 3 * 3600000)
  const minsBeforeDoors = Math.round((start.getTime() - doors.getTime()) / 60000) + 120
  const desc = [e.tour, e.doors && `Двери: ${e.doors}`, e.show && `Начало: ${e.show}`, e.notes].filter(Boolean).join('\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Encore//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@encore`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.artist)}`,
    `LOCATION:${esc(e.venue)}`,
    `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Завтра концерт: ' + e.artist)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Через 2 часа двери: ' + e.artist)}`,
    `TRIGGER:-PT${minsBeforeDoors}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function addToCalendar(e: PlannedEvent) {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' })
  downloadBlob(blob, `${e.artist.replace(/[^\p{L}\p{N}]+/gu, '-')}.ics`)
}
