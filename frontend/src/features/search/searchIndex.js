/**
 * Campus search: index built once per data load, ranked matching per query.
 * Pure functions — no React, no map, no network — so the ranking can be
 * tested in isolation and later swapped for a server search.
 *
 * Only real fields are searched: display name (campus prefix stripped —
 * the same "alias" the backend chatbot uses), category, building, and
 * description at the lowest weight. The backend has no alias/keyword field.
 */
import { getCategoryMeta } from '../locations/categoryMeta.js'
import { distanceMeters } from '../../utils/geo.js'
import { fuzzyWordMatch } from './fuzzy.js'

/**
 * Score tiers. Tiers never overlap, so exact and strong name matches
 * always outrank fuzzy, field-only and description matches.
 */
export const SCORE = {
  EXACT: 1000,
  PREFIX: 900,
  WORD_PREFIX: 800,
  CONTAINS: 700,
  ALL_TERMS: 500,
  FUZZY: 300, // minus 40 per typo, never below FIELD
  FIELD: 150,
  DESCRIPTION: 50,
}

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// "labs" → "lab", "sports" → "sport"; leaves "class", "gas" and short words alone.
const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const words = (text) => (text ? normalize(text).split(' ').filter(Boolean) : [])
const withStems = (list) => [...new Set(list.flatMap((w) => [w, singular(w)]))]
const startsAny = (list, term) => list.some((w) => w.startsWith(term))

export function buildSearchIndex(locations) {
  return locations.map((location) => {
    const nameWords = words(location.displayName)
    return {
      location,
      name: normalize(location.displayName),
      nameWords: withStems(nameWords),
      wordCount: nameWords.length,
      fieldWords: withStems([
        ...words(location.category),
        ...words(getCategoryMeta(location.category).label),
        ...words(location.building),
        ...words(location.floor),
      ]),
      descWords: withStems(words(location.description)),
    }
  })
}

function scoreEntry(entry, query, terms) {
  const { name, nameWords, fieldWords, descWords } = entry

  if (name === query) return { score: SCORE.EXACT, kind: 'name' }
  if (name.startsWith(query)) return { score: SCORE.PREFIX, kind: 'name' }
  if (terms.every((t) => startsAny(nameWords, t))) return { score: SCORE.WORD_PREFIX, kind: 'name' }
  if (name.includes(query)) return { score: SCORE.CONTAINS, kind: 'name' }

  const inName = terms.map((t) => startsAny(nameWords, t))
  const inFields = terms.map((t) => startsAny(fieldWords, t))

  if (terms.every((_, i) => inName[i] || inFields[i])) {
    // At least one term names the place → a real (mixed) match; otherwise field-only.
    return inName.some(Boolean) ? { score: SCORE.ALL_TERMS, kind: 'mixed' } : { score: SCORE.FIELD, kind: 'field' }
  }

  // Typo tolerance: every term must match somewhere, and at least one
  // term must be a close spelling of a name word.
  let typos = 0
  let fuzzyNameHit = false
  const allMatched = terms.every((t, i) => {
    if (inName[i] || inFields[i]) return true
    const best = nameWords.reduce((acc, w) => {
      const d = fuzzyWordMatch(t, w)
      return d != null && (acc == null || d < acc) ? d : acc
    }, null)
    if (best == null) return false
    typos += best
    fuzzyNameHit = true
    return true
  })
  if (allMatched && fuzzyNameHit) {
    return { score: Math.max(SCORE.FIELD + 1, SCORE.FUZZY - 40 * typos), kind: 'fuzzy' }
  }

  const everywhere = [...nameWords, ...fieldWords, ...descWords]
  if (descWords.length && terms.every((t) => startsAny(everywhere, t))) {
    return { score: SCORE.DESCRIPTION, kind: 'description' }
  }
  return null
}

/**
 * Ranked results for `rawQuery`: [{ location, score, kind }].
 * Tie-breaks: fewer name words (more specific), then closer to `origin`
 * (only when provided), then alphabetical.
 */
export function searchIndex(index, rawQuery, { origin = null } = {}) {
  const query = normalize(rawQuery)
  if (!query) return []
  const terms = [...new Set(query.split(' ').map(singular))]

  const scored = []
  for (const entry of index) {
    const match = scoreEntry(entry, query, terms)
    if (match) scored.push({ entry, ...match })
  }

  // With a strong name match present, typo guesses and description hits are
  // noise — drop them rather than list them under the real answer.
  const strong = scored.some((r) => r.score >= SCORE.CONTAINS)
  const kept = strong ? scored.filter((r) => r.kind !== 'fuzzy' && r.kind !== 'description') : scored

  const dist = (r) => (origin ? distanceMeters(origin, r.entry.location.coords) : 0)
  kept.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.wordCount - b.entry.wordCount ||
      dist(a) - dist(b) ||
      a.entry.location.displayName.localeCompare(b.entry.location.displayName),
  )

  return kept.map(({ entry, score, kind }) => ({ location: entry.location, score, kind }))
}

/**
 * Character ranges in `text` to emphasise for `rawQuery`: the whole query
 * where it appears, otherwise each term at the start of a word.
 * Returns [[start, end], …] sorted and non-overlapping.
 */
export function matchRanges(text, rawQuery) {
  const lower = text.toLowerCase()
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []

  const whole = lower.indexOf(query)
  if (whole !== -1) return [[whole, whole + query.length]]

  const ranges = []
  for (const term of query.split(/\s+/).filter((t) => t.length > 0)) {
    const re = new RegExp(`(^|[^a-z0-9])(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')
    let m
    while ((m = re.exec(lower))) {
      const start = m.index + m[1].length
      ranges.push([start, start + m[2].length])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  return ranges.filter((r, i) => i === 0 || r[0] >= ranges[i - 1][1])
}
