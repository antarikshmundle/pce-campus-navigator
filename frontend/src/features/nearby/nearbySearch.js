import { normalize } from '../search/searchIndex.js'
import { getNearbyCategory } from './nearbyCategories.js'

/**
 * Search over off-campus places (campus places keep the Stage 5 index).
 * Ranking: exact name → name prefix → word prefix → substring → category
 * keyword; ties broken by distance.
 */
const KEYWORDS = {
  metro: ['metro', 'station', 'train'],
  bus: ['bus', 'stop', 'stand'],
  taxi: ['auto', 'cab', 'taxi', 'rickshaw'],
  railway: ['railway', 'train', 'station'],
  restaurant: ['restaurant', 'food', 'eat', 'dine', 'dhaba', 'lunch', 'dinner'],
  fastfood: ['fast food', 'food', 'snacks', 'burger', 'pizza'],
  cafe: ['cafe', 'coffee', 'tea', 'chai'],
  hospital: ['hospital', 'emergency', 'medical'],
  clinic: ['clinic', 'doctor', 'medical'],
  pharmacy: ['pharmacy', 'chemist', 'medical', 'medicine'],
  diagnostic: ['diagnostic', 'lab', 'pathology', 'test'],
  atm: ['atm', 'cash', 'money'],
  bank: ['bank', 'money'],
  grocery: ['grocery', 'kirana', 'supermarket', 'store', 'mart'],
  stationery: ['stationery', 'books', 'notebook'],
  printing: ['print', 'xerox', 'photocopy'],
  electronics: ['mobile', 'phone', 'electronics', 'computer', 'charger'],
  shop: ['shop', 'shopping'],
  petrol: ['petrol', 'fuel', 'diesel', 'pump'],
  hotel: ['hotel', 'stay', 'lodge'],
  hostel: ['hostel', 'pg', 'stay', 'accommodation'],
  police: ['police', 'emergency'],
  postoffice: ['post', 'courier'],
  attraction: ['attraction', 'tourist', 'sightseeing'],
  park: ['park', 'garden', 'zoo'],
  lake: ['lake', 'talao', 'dam'],
  museum: ['museum', 'science', 'gallery'],
  landmark: ['landmark', 'historic', 'fort', 'monument', 'heritage'],
  worship: ['temple', 'mosque', 'dargah', 'church', 'worship'],
  entertainment: ['mall', 'shopping', 'cinema', 'movie', 'fun'],
}

const SCORE = { exact: 100, prefix: 80, word: 60, substring: 45, category: 30 }

function score(place, q, words) {
  const name = normalize(place.name)
  if (name === q) return SCORE.exact
  if (name.startsWith(q)) return SCORE.prefix
  const nameWords = name.split(' ')
  if (words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) return SCORE.word
  if (q.length >= 3 && name.includes(q)) return SCORE.substring
  const keywords = [...(KEYWORDS[place.category] ?? []), normalize(getNearbyCategory(place.category).label)]
  if (keywords.some((k) => k === q || (q.length >= 3 && k.startsWith(q)) || words.some((w) => w.length >= 3 && k === w))) {
    return SCORE.category
  }
  return 0
}

/** entries: [{ place, meters }] → matching entries, best first. */
export function searchNearby(entries, rawQuery, limit = 10) {
  const q = normalize(rawQuery)
  if (!q) return []
  const words = q.split(' ').filter(Boolean)
  return entries
    .map((e) => ({ ...e, score: score(e.place, q, words) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.meters - b.meters)
    .slice(0, limit)
}
