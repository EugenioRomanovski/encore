import { db, type Memory, type PlannedEvent, type Ticket } from './db'
import { toISODate } from './format'

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

const now = Date.now()

const M = (m: Omit<Memory, 'createdAt' | 'updatedAt' | 'mediaIds' | 'encoreAt'> & { enc: number }): Memory => {
  const { enc, ...rest } = m
  return { ...rest, mediaIds: [], encoreAt: enc ? m.setlist.length - enc : null, createdAt: now, updatedAt: now }
}

export const DEMO_MEMORIES: Memory[] = [
  M({ id: 'demo-lcd', artist: 'LCD Soundsystem', tour: 'Primavera Sound 2026', venue: 'Parc del Fòrum', date: '2026-06-05', time: '23:30', rating: 5, genres: ['Dance-punk', 'Электроника', 'Фестиваль'], setlist: ['Dance Yrself Clean', 'I Can Change', 'Tribulations', 'Someone Great', 'Losing My Edge', 'All My Friends'], enc: 2, notes: 'На All My Friends уже светало. Незнакомые люди обнимались. Лучший фестивальный сет в моей жизни.', people: ['Женя', 'Аня'], palette: 0 }),
  M({ id: 'demo-jb', artist: 'Japanese Breakfast', tour: 'Jubilee Anniversary Tour', venue: 'Roundhouse', date: '2026-03-17', time: '20:00', rating: 4, genres: ['Инди-поп', 'Дрим-поп'], setlist: ['Paprika', 'Be Sweet', 'Kokomo, IN', 'Road Head', 'Slide Tackle', 'Diving Woman'], enc: 1, notes: 'Мишель ударила в гонг на Paprika — и весь зал подпрыгнул. Достали сет-лист у сцены.', people: ['Женя'], palette: 3 }),
  M({ id: 'demo-fdc', artist: 'Fontaines D.C.', tour: 'Romance Tour', venue: 'Alexandra Palace', date: '2025-11-08', time: '19:00', rating: 4, genres: ['Пост-панк', 'Рок'], setlist: ['Romance', 'Jackie Down the Line', 'Boys in the Better Land', 'Favourite', 'Starburster'], enc: 1, notes: 'На Starburster открылся слэм. Потерял кроссовок, нашёл кроссовок. Оно того стоило.', people: ['Тимур'], palette: 2 }),
  M({ id: 'demo-am', artist: 'Arctic Monkeys', tour: 'The Car Tour', venue: 'The O2 Arena', date: '2025-06-14', time: '19:30', rating: 5, genres: ['Инди-рок', 'Альт-рок'], setlist: ['Sculptures of Anything Goes', 'Brianstorm', 'Snap Out of It', 'Crying Lightning', 'Do I Wanna Know?', '505', 'I Wanna Be Yours', 'R U Mine?'], enc: 2, notes: 'Алекс вышел в том самом белом костюме, и арена сошла с ума на Brianstorm. К 505 голоса уже не было. Тимур плакал на Do I Wanna Know? (он отрицает).', people: ['Женя', 'Тимур', 'Аня'], palette: 0 }),
  M({ id: 'demo-be', artist: 'Billie Eilish', tour: 'Hit Me Hard and Soft Tour', venue: 'Accor Arena', date: '2025-05-22', time: '20:00', rating: 5, genres: ['Альт-поп', 'Электропоп'], setlist: ['CHIHIRO', 'LUNCH', 'bad guy', 'BIRDS OF A FEATHER', 'Happier Than Ever'], enc: 1, notes: 'Сцена-куб. Двадцать тысяч человек поют BIRDS OF A FEATHER.', people: ['Аня'], palette: 1 }),
  M({ id: 'demo-ma', artist: 'Massive Attack', tour: 'Mezzanine XXV', venue: 'Zénith Paris', date: '2024-10-03', time: '20:30', rating: 4, genres: ['Трип-хоп'], setlist: ['Risingson', 'Angel', 'Inertia Creeps', 'Teardrop', 'Unfinished Sympathy'], enc: 1, notes: 'Teardrop вживую. Четыре минуты не дышал.', people: ['Тимур'], palette: 5 }),
  M({ id: 'demo-bg', artist: 'boygenius', tour: 'The Tour', venue: 'Forest Hills Stadium', date: '2024-08-12', time: '19:00', rating: 5, genres: ['Инди-рок', 'Фолк'], setlist: ['$20', 'Not Strong Enough', 'Cool About It', 'Satanist', 'Me & My Dog'], enc: 1, notes: 'Летний ливень прямо перед Not Strong Enough. Никто не ушёл.', people: ['Женя', 'Аня'], palette: 4 }),
]

export const DEMO_EVENTS: PlannedEvent[] = [
  { id: 'demo-ti', artist: 'Tame Impala', tour: 'Deadbeat Tour', venue: 'Madison Square Garden', date: inDays(12), doors: '18:30', show: '20:00', notes: 'Встречаемся с Женей у входа в 17:45. До открытия дверей — очередь за мерчем, взять тур-постер.', palette: 2, createdAt: now },
  { id: 'demo-wl', artist: 'Wet Leg', tour: 'Moisturizer Tour', venue: 'O2 Academy Brixton', date: inDays(25), doors: '19:00', show: '20:30', notes: 'Танцпол — приехать пораньше, чтобы встать у сцены.', palette: 4, createdAt: now },
  { id: 'demo-ls', artist: 'Little Simz', tour: 'Lotus Tour', venue: 'Roundhouse', date: inDays(47), doors: '19:00', show: '21:00', notes: 'Предпродажа в пятницу в 10:00 — поставить будильник.', palette: 5, createdAt: now },
  { id: 'demo-bi', artist: 'Bon Iver', tour: 'SABLE, fABLE Tour', venue: 'Royal Albert Hall', date: inDays(90), doors: '18:45', show: '19:30', notes: 'Сидячий концерт. Ужин где-нибудь рядом до начала?', palette: 2, createdAt: now },
  { id: 'demo-kh', artist: 'Khruangbin', tour: 'A La Sala Tour', venue: 'Zénith Paris', date: inDays(106), doors: '19:00', show: '20:30', notes: 'Поезд в среду утром.', palette: 1, createdAt: now },
  { id: 'demo-ph', artist: 'Phoenix', tour: 'Alpha Zulu Tour', venue: 'Adrenaline Stadium', date: inDays(-2), doors: '19:00', show: '20:00', notes: 'Взять беруши.', palette: 0, createdAt: now },
]

const T = (t: Omit<Ticket, 'pageIds' | 'createdAt' | 'kind'> & { kind?: Ticket['kind'] }): Ticket => ({ kind: 'demo', pageIds: [], createdAt: now, ...t })

export const DEMO_TICKETS: Ticket[] = [
  T({ id: 'demo-t-ti', eventId: 'demo-ti', artist: 'Tame Impala', tour: 'Deadbeat Tour', venue: 'Madison Square Garden', date: inDays(12), time: '20:00', seat: [{ k: 'СЕКТОР', v: '104' }, { k: 'РЯД', v: 'F' }, { k: 'МЕСТО', v: '12' }], code: 'ENC 7F3K 2291 0104', palette: 0, fileName: 'tame-impala-msg.pdf' }),
  T({ id: 'demo-t-wl', eventId: 'demo-wl', artist: 'Wet Leg', tour: 'Moisturizer Tour', venue: 'O2 Academy Brixton', date: inDays(25), time: '20:30', seat: [{ k: 'ВХОД', v: 'ТАНЦПОЛ' }, { k: 'ЗОНА', v: 'A' }, { k: 'ВОРОТА', v: 'B' }], code: 'ENC 2WL9 7781 0033', palette: 1, fileName: 'IMG_4471.png' }),
  T({ id: 'demo-t-bi', eventId: 'demo-bi', artist: 'Bon Iver', tour: 'SABLE, fABLE Tour', venue: 'Royal Albert Hall', date: inDays(90), time: '19:30', seat: [{ k: 'ПАРТЕР', v: 'K' }, { k: 'РЯД', v: '8' }, { k: 'МЕСТО', v: '21' }], code: 'ENC 0BI4 1180 2121', palette: 2, fileName: 'Скан бумажного билета' }),
  T({ id: 'demo-t-am', memoryId: 'demo-am', artist: 'Arctic Monkeys', tour: 'The Car Tour', venue: 'The O2 Arena', date: '2025-06-14', time: '19:30', seat: [{ k: 'БЛОК', v: '112' }, { k: 'РЯД', v: 'M' }, { k: 'МЕСТО', v: '34' }], code: 'ENC 9AM1 4406 1123', palette: 5, fileName: 'arctic-monkeys-o2.pdf' }),
  T({ id: 'demo-t-be', memoryId: 'demo-be', artist: 'Billie Eilish', tour: 'Hit Me Hard and Soft Tour', venue: 'Accor Arena', date: '2025-05-22', time: '20:00', seat: [{ k: 'ВХОД', v: 'ТАНЦПОЛ' }, { k: 'ВОРОТА', v: '3' }, { k: 'ЗОНА', v: 'GA' }], code: 'ENC 4BE2 0522 7710', palette: 3, fileName: 'IMG_2210.png' }),
  T({ id: 'demo-t-fdc', memoryId: 'demo-fdc', artist: 'Fontaines D.C.', tour: 'Romance Tour', venue: 'Alexandra Palace', date: '2025-11-08', time: '19:00', seat: [{ k: 'ВХОД', v: 'ТАНЦПОЛ' }, { k: 'ЗОНА', v: 'B' }, { k: 'ДВЕРЬ', v: 'W' }], code: 'ENC 6FD8 1108 0090', palette: 4, fileName: 'Скан бумажного билета' }),
]

export async function loadDemo() {
  await db.transaction('rw', db.memories, db.events, db.tickets, async () => {
    await db.memories.bulkPut(DEMO_MEMORIES)
    await db.events.bulkPut(DEMO_EVENTS)
    await db.tickets.bulkPut(DEMO_TICKETS)
  })
}

export async function removeDemo() {
  await db.transaction('rw', db.memories, db.events, db.tickets, async () => {
    await db.memories.bulkDelete(DEMO_MEMORIES.map((m) => m.id))
    await db.events.bulkDelete(DEMO_EVENTS.map((m) => m.id))
    await db.tickets.bulkDelete(DEMO_TICKETS.map((m) => m.id))
  })
}

/** Deterministic pseudo-QR (from the design) shown for demo tickets that have no real file. */
export const DEMO_QR: boolean[] = (() => {
  let s = 11
  const r = () => ((s = (s * 9301 + 49297) % 233280), s / 233280)
  const f = (x: number, y: number, ox: number, oy: number) => {
    const dx = x - ox, dy = y - oy
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
  }
  const o: boolean[] = []
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      let v = f(x, y, 0, 0)
      if (v === null) v = f(x, y, 18, 0)
      if (v === null) v = f(x, y, 0, 18)
      if (v === null) v = (x <= 7 && y <= 7) || (x >= 17 && y <= 7) || (x <= 7 && y >= 17) ? false : r() < 0.5
      o.push(v)
    }
  return o
})()
