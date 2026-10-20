import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

const byFreq = (xs: string[]) => {
  const c = new Map<string, number>()
  xs.filter(Boolean).forEach((x) => c.set(x, (c.get(x) || 0) + 1))
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])
}

/** Previously used artists, venues, genres and companions — for autocomplete. */
export function useSuggestions() {
  return (
    useLiveQuery(async () => {
      const [ms, es] = await Promise.all([db.memories.toArray(), db.events.toArray()])
      return {
        artists: byFreq([...ms.map((m) => m.artist), ...es.map((e) => e.artist)]),
        venues: byFreq([...ms.map((m) => m.venue), ...es.map((e) => e.venue)]),
        genres: byFreq(ms.flatMap((m) => m.genres)),
        people: byFreq(ms.flatMap((m) => m.people)),
      }
    }, []) || { artists: [], venues: [], genres: [], people: [] }
  )
}
