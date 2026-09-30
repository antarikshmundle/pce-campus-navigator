/**
 * Campus AI — resolution of query phrases against the campus location data.
 * Pure functions. Place matching is the Stage 5 search index (exact, prefix,
 * word-prefix, typo tolerance, category/building fields); this layer only
 * decides between its results. Every answer is a real location record.
 */
import { SCORE, buildSearchIndex, normalize, searchIndex } from '../search/searchIndex.js'
import { fuzzyWordMatch } from '../search/fuzzy.js'
import { analyzeCampus } from '../map/geojson.js'

const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const wordsOf = (text) => (text ? normalize(text).split(' ').filter(Boolean) : [])

/** 'Sports ', 'Sport', 'sports' → 'sport' — categories are free text in the admin. */
export const categoryKey = (category) => wordsOf(category).map(singular).join(' ')

/**
 * Everyday words for categories that exist in the data. A word only maps to
 * a category if that category has places, so nothing here can invent one.
 */
const SYNONYMS = {
  food: ['food', 'canteen', 'cafe', 'cafeteria', 'eat', 'eating', 'restaurant', 'snack', 'coffee', 'tea', 'mess', 'lunch', 'breakfast'],
  sport: ['sport', 'game', 'athletic', 'athletics', 'play', 'playing'],
  bank: ['bank', 'banking'],
  parking: ['parking'],
  hall: ['hall'],
  office: ['office', 'administration', 'admin'],
  garden: ['garden'],
  ground: ['ground', 'field'],
  lake: ['lake', 'pond'],
  monument: ['monument', 'statue', 'memorial'],
  'spiritual place': ['temple', 'mandir', 'spiritual', 'worship', 'prayer'],
  academic: ['academic'],
  entry: ['entry', 'entrance', 'gate'],
  entrance: ['entrance', 'entry', 'gate'],
  exit: ['exit', 'gate'],
}

/**
 * Everything the assistant needs, built once per data load:
 * { locations, byId, index, groups: Map(key → { key, label, locations }), vocab: Map(word → Set(key)), outlierIds }
 */
export function buildAssistantData(locations) {
  const groups = new Map()
  const variants = new Map()
  for (const l of locations) {
    const key = categoryKey(l.category)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, { key, label: '', locations: [] })
    groups.get(key).locations.push(l)
    const v = variants.get(key) ?? new Map()
    const text = l.category.trim()
    v.set(text, (v.get(text) ?? 0) + 1)
    variants.set(key, v)
  }
  // Label = the spelling most places use ("Sports" over "Sport ").
  for (const [key, group] of groups) {
    group.label = [...variants.get(key)].sort((a, b) => b[1] - a[1])[0][0]
    group.locations.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  const vocab = new Map()
  const add = (word, key) => {
    if (!vocab.has(word)) vocab.set(word, new Set())
    vocab.get(word).add(key)
  }
  for (const key of groups.keys()) if (!key.includes(' ')) add(key, key)
  for (const [key, list] of Object.entries(SYNONYMS)) if (groups.has(key)) list.forEach((w) => add(singular(w), key))

  return {
    locations,
    byId: new Map(locations.map((l) => [l.id, l])),
    index: buildSearchIndex(locations),
    groups,
    vocab,
    outlierIds: analyzeCampus(locations).outlierIds,
  }
}

export const groupOf = (data, location) => data.groups.get(categoryKey(location.category))
export const categoryLabel = (data, location) => groupOf(data, location)?.label || location.category.trim()

/**
 * A phrase made only of category words ("sports", "canteens", "banks",
 * "gate") → { label, locations } or null. Includes places of those
 * categories plus places whose name has the word ("PCE CSE Parking" is filed
 * under Academic but is a parking).
 */
export function resolveCategory(target, data) {
  const terms = wordsOf(target).map(singular)
  if (!terms.length || !terms.every((t) => data.vocab.has(t))) return null
  const keys = new Set(terms.flatMap((t) => [...data.vocab.get(t)]))

  const byName = terms
    .flatMap((t) => searchIndex(data.index, t))
    .filter((r) => r.kind === 'name' && r.score >= SCORE.WORD_PREFIX)
    .map((r) => r.location)
  const inGroups = [...keys].flatMap((k) => data.groups.get(k).locations)
  const seen = new Set()
  const locations = [...byName, ...inGroups].filter((l) => !seen.has(l.id) && seen.add(l.id))
  const labels = [...keys].map((k) => data.groups.get(k).label)
  return { label: labels.join(' / '), keys: [...keys], locations }
}

const headWord = (location) => singular(wordsOf(location.displayName).at(-1) ?? '')
const wordCount = (location) => wordsOf(location.displayName).length

/**
 * Best place for `target` → one of
 *   { status: 'found', location, alsoMatched: [location…] }
 *   { status: 'building', building, locations }   phrase names a building, not a place
 *   { status: 'ambiguous', options: [location…] }  several equally good matches
 *   { status: 'mentions', options }                only descriptions mention it
 *   { status: 'none' }
 * `candidates`: limit matching to these ids (follow-up to "which one?").
 */
export function resolvePlace(target, data, { candidates = null } = {}) {
  let results = searchIndex(data.index, target)
  if (candidates) results = results.filter((r) => candidates.includes(r.location.id))
  if (!results.length) return { status: 'none' }

  const top = results[0]
  // "AI & DS building": the phrase names a recorded building, not one place.
  if (top.score < SCORE.WORD_PREFIX && !candidates) {
    const building = buildingNamed(target, data)
    if (building) return { status: 'building', ...building }
  }
  if (top.kind === 'field') {
    const hits = results.filter((r) => r.kind === 'field').map((r) => r.location)
    const buildings = new Set(hits.map((l) => normalize(l.building ?? '')))
    if (buildings.size === 1 && !buildings.has('')) return { status: 'building', building: hits[0].building.trim(), locations: hits }
    return { status: 'ambiguous', options: hits }
  }
  if (top.kind === 'description') return { status: 'mentions', options: results.map((r) => r.location) }

  const tier = results.filter((r) => r.score === top.score).map((r) => r.location)
  if (tier.length === 1) return { status: 'found', location: tier[0], alsoMatched: [] }

  // "library": Central Library (a library) beats Library Parking (a parking).
  // Typos count too ("libary").
  const terms = wordsOf(target).map(singular)
  const isHead = (l) => {
    const head = headWord(l)
    return terms.some((t) => t === head || fuzzyWordMatch(t, head) != null)
  }
  const heads = tier.filter(isHead)
  const pool = heads.length ? heads : tier
  if (pool.length === 1) return { status: 'found', location: pool[0], alsoMatched: [] }

  // "auditorium": PCE Auditorium over PCE New Auditorium — but mention the other.
  const fewest = Math.min(...pool.map(wordCount))
  const shortest = pool.filter((l) => wordCount(l) === fewest)
  if (shortest.length === 1) {
    return { status: 'found', location: shortest[0], alsoMatched: pool.filter((l) => l !== shortest[0]) }
  }
  return { status: 'ambiguous', options: pool }
}

/**
 * The one recorded building whose name contains every word of `target`
 * → { building, locations } (all places recorded in it), or null.
 */
function buildingNamed(target, data) {
  const terms = wordsOf(target).map(singular)
  if (!terms.length) return null
  const matches = new Map()
  for (const l of data.locations) {
    if (!l.building) continue
    const words = wordsOf(l.building).map(singular)
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) continue
    const key = words.join(' ')
    if (!matches.has(key)) matches.set(key, { building: l.building.trim(), locations: [] })
    matches.get(key).locations.push(l)
  }
  return matches.size === 1 ? [...matches.values()][0] : null
}

/**
 * Close-but-not-matching places for a miss: places matched by at least half
 * of the words (never fewer than one). Offered as "did you mean", never
 * answered as found.
 */
export function didYouMean(target, data) {
  const terms = wordsOf(target).filter((t) => t.length >= 3)
  if (!terms.length) return []
  const hits = new Map()
  for (const term of terms) {
    for (const r of searchIndex(data.index, term)) {
      if (r.kind === 'description') continue
      const h = hits.get(r.location.id) ?? { location: r.location, count: 0 }
      h.count += 1
      hits.set(r.location.id, h)
    }
  }
  const needed = Math.max(1, Math.ceil(terms.length / 2))
  return [...hits.values()]
    .filter((h) => h.count >= needed)
    .sort((a, b) => b.count - a.count || a.location.displayName.localeCompare(b.location.displayName))
    .slice(0, 3)
    .map((h) => h.location)
}

/** Every name match for a phrase, best first (for lists: "seminar halls"). */
export function matchAll(target, data) {
  return searchIndex(data.index, target)
    .filter((r) => r.kind !== 'description')
    .map((r) => r.location)
}
