/** Stage-light colour triplets used for photo placeholders: [light A, light B, base]. */
export const PAL: [string, string, string][] = [
  ['#FF2E88', '#FF7A2F', '#2a0f1c'],
  ['#7B61FF', '#FF2E88', '#130f2a'],
  ['#FF8A2B', '#7B61FF', '#1a1210'],
  ['#FF4FA0', '#3A2E8A', '#170d14'],
  ['#A99BFF', '#FF8A2B', '#151628'],
  ['#FF5A4E', '#FF2E88', '#1c0e14'],
]

/** Ticket face gradients and their glow colour. */
export const TICKET_PAL: { bg: string; glow: string }[] = [
  { bg: 'linear-gradient(135deg,#FF2E88 0%,#FF7A2F 100%)', glow: 'rgba(255,46,136,.6)' },
  { bg: 'linear-gradient(135deg,#6B4EFF 0%,#B592FF 100%)', glow: 'rgba(123,97,255,.6)' },
  { bg: 'linear-gradient(135deg,#3A1C3F 0%,#E0531F 100%)', glow: 'rgba(224,83,31,.5)' },
  { bg: 'linear-gradient(135deg,#5B3BD6 0%,#FF2E88 100%)', glow: 'rgba(123,97,255,.5)' },
  { bg: 'linear-gradient(135deg,#C2410C 0%,#FF9F43 100%)', glow: 'rgba(255,138,43,.5)' },
  { bg: 'linear-gradient(135deg,#2B2B36 0%,#5A2448 100%)', glow: 'rgba(255,46,136,.35)' },
]

export const TAG_COLORS = ['#6B4EFF', '#E0247A', '#D4561A']
export const PERSON_COLORS = ['#E0247A', '#6B4EFF', '#E0651F', '#0F8F5B', '#B4387A', '#3A6BD6']

export function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const paletteFor = (s: string) => hashStr(s.toLowerCase()) % PAL.length

/** Concert-light placeholder gradient (from the design's `ph()`). */
export function ph(i: number, shift = 0) {
  const [a0, b0, base] = PAL[((i % PAL.length) + PAL.length) % PAL.length]
  const [a, b] = shift % 2 ? [b0, a0] : [a0, b0]
  return `conic-gradient(from 166deg at 50% -6%, transparent 0deg, rgba(255,255,255,.11) 5deg, transparent 11deg, transparent 17deg, rgba(255,255,255,.08) 21deg, transparent 27deg), radial-gradient(70% 55% at 22% 20%, ${a} 0%, transparent 64%), radial-gradient(60% 50% at 84% 32%, ${b} 0%, transparent 62%), radial-gradient(100% 50% at 50% 108%, #000 20%, transparent 72%), linear-gradient(172deg, ${base} 0%, #07070A 100%)`
}

export const glow = (i: number) => PAL[i % PAL.length][0] + 'AA'

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export const personColor = (name: string) => PERSON_COLORS[hashStr(name) % PERSON_COLORS.length]
