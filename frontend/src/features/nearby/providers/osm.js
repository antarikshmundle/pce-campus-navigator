/**
 * OpenStreetMap provider (Overpass API) — the ONLY code that knows OSM tags
 * or the Overpass URL. Used live in the browser (no key, no billing) and by
 * the script that builds the bundled snapshot, so both produce identical data.
 *
 * Output is the app's external-place shape:
 *   { key, source: 'external' | 'nagpur', provider: 'osm', name, category, coords: { lat, lng }, address }
 * Only facts present in OSM are kept — no ratings, hours, reviews or photos.
 * Data © OpenStreetMap contributors, ODbL.
 */
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'

// Nagpur region: anything outside is invalid for this app.
export const NAGPUR_BOUNDS = { south: 20.95, west: 78.85, north: 21.32, east: 79.25 }

/** OSM tags → category id (first match wins). */
function classify(t) {
  const name = t.name ?? ''
  if (t.railway === 'station' || t.railway === 'halt' || t.public_transport === 'station') {
    if (t.station === 'subway' || t.station === 'light_rail' || /metro/i.test(`${name} ${t.network ?? ''} ${t.operator ?? ''}`)) return 'metro'
    if (t.railway) return 'railway'
  }
  if (t.highway === 'bus_stop' || t.amenity === 'bus_station') return 'bus'
  if (t.amenity === 'taxi') return 'taxi'
  const byAmenity = {
    cafe: 'cafe', restaurant: 'restaurant', fast_food: 'fastfood', food_court: 'fastfood',
    hospital: 'hospital', clinic: 'clinic', doctors: 'clinic', pharmacy: 'pharmacy',
    atm: 'atm', bank: 'bank', fuel: 'petrol', police: 'police', post_office: 'postoffice',
  }
  if (byAmenity[t.amenity]) return byAmenity[t.amenity]
  if (t.healthcare === 'laboratory' || t.healthcare === 'diagnostic') return 'diagnostic'
  const byShop = {
    supermarket: 'grocery', convenience: 'grocery', greengrocer: 'grocery', chemist: 'pharmacy',
    stationery: 'stationery', books: 'stationery', copyshop: 'printing',
    mobile_phone: 'electronics', electronics: 'electronics', computer: 'electronics',
    mall: 'shop', department_store: 'shop', clothes: 'shop',
  }
  if (byShop[t.shop]) return byShop[t.shop]
  if (t.tourism === 'hotel' || t.tourism === 'guest_house') return 'hotel'
  if (t.tourism === 'hostel') return 'hostel'
  return null
}

/** City attractions: OSM tags → category id. */
function classifyAttraction(t) {
  if (t.tourism === 'museum' || t.tourism === 'gallery') return 'museum'
  if (t.natural === 'water' || t.water === 'lake' || t.water === 'reservoir') return 'lake'
  if (t.leisure === 'park' || t.leisure === 'garden' || t.tourism === 'zoo' || t.boundary === 'protected_area') return 'park'
  if (t.amenity === 'place_of_worship') return 'worship'
  if (t.shop === 'mall' || t.amenity === 'cinema' || t.tourism === 'theme_park') return 'entertainment'
  if (t.historic) return 'landmark'
  if (t.tourism === 'attraction' || t.tourism === 'viewpoint') return 'attraction'
  return null
}

function address(t) {
  if (t['addr:full']) return t['addr:full']
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
  return [street, t['addr:suburb'] ?? t['addr:place'], t['addr:city']].filter(Boolean).join(', ') || null
}

const inBounds = ({ lat, lng }, b = NAGPUR_BOUNDS) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east

const TYPE_CODE = { node: 'n', way: 'w', relation: 'r' }

/**
 * Overpass elements → external places. Drops unnamed or unclassifiable
 * elements, invalid / out-of-region coordinates, and duplicates (same name
 * + category within 60 m, e.g. a shop mapped as both a node and a building).
 */
export function normalizeOsm(elements, { layer = 'around' } = {}) {
  const out = []
  const seen = new Map()
  for (const el of Array.isArray(elements) ? elements : []) {
    const t = el?.tags
    const name = t?.name?.trim() || t?.['name:en']?.trim()
    if (!name || !TYPE_CODE[el.type]) continue
    const category = layer === 'nagpur' ? classifyAttraction(t) : classify(t)
    if (!category) continue
    const coords = { lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon }
    if (!inBounds(coords)) continue
    const dupKey = `${category}|${name.toLowerCase().replace(/\s+/g, ' ')}`
    const near = seen.get(dupKey)
    if (near && Math.abs(near.lat - coords.lat) < 0.0006 && Math.abs(near.lng - coords.lng) < 0.0006) continue
    seen.set(dupKey, coords)
    out.push({
      key: `osm-${TYPE_CODE[el.type]}${el.id}`,
      source: layer === 'nagpur' ? 'nagpur' : 'external',
      provider: 'osm',
      name,
      category,
      coords: { lat: Number(coords.lat.toFixed(6)), lng: Number(coords.lng.toFixed(6)) },
      address: address(t),
    })
  }
  return out
}

/** Overpass QL: useful named places within `radius` m of `center`. */
export function aroundQuery({ lat, lng }, radius) {
  const a = `(around:${radius},${lat},${lng})`
  return `[out:json][timeout:25];
(
  nwr${a}[amenity~"^(cafe|restaurant|fast_food|food_court|hospital|clinic|doctors|pharmacy|atm|bank|fuel|police|post_office|bus_station|taxi)$"][name];
  node${a}[highway=bus_stop][name];
  nwr${a}[shop~"^(supermarket|convenience|greengrocer|chemist|stationery|books|copyshop|mobile_phone|electronics|computer|mall|department_store)$"][name];
  nwr${a}[tourism~"^(hotel|guest_house|hostel)$"][name];
  nwr${a}[healthcare~"^(laboratory|diagnostic)$"][name];
  nwr(around:${radius * 2},${lat},${lng})[railway~"^(station|halt)$"][name];
);
out center tags;`
}

/**
 * Overpass QL: city attractions in Nagpur, selected by tags — not hand-picked
 * from memory. Parks, landmarks and places of worship must have a Wikidata
 * link (notability); water bodies must be named as lakes/talaos/dams.
 */
export function nagpurQuery() {
  const { south, west, north, east } = NAGPUR_BOUNDS
  const b = `(${south},${west},${north},${east})`
  return `[out:json][timeout:60];
(
  nwr${b}[tourism~"^(museum|gallery|zoo|theme_park|attraction)$"][name];
  nwr${b}[leisure~"^(park|garden)$"][name][wikidata];
  nwr${b}[natural=water][name~"lake|talao|talav|tank|sagar|dam",i];
  nwr${b}[historic][name][wikidata];
  nwr${b}[amenity=place_of_worship][name][wikidata];
  nwr${b}[shop=mall][name~"mall",i];
);
out center tags;`
}

/** POST a query to Overpass; rejects on HTTP errors, timeouts and malformed JSON. */
export async function runOverpass(query, { timeoutMs = 12000, fetchImpl = fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
    const json = await res.json()
    if (!Array.isArray(json?.elements)) throw new Error('Overpass: malformed response')
    return json.elements
  } finally {
    clearTimeout(timer)
  }
}
