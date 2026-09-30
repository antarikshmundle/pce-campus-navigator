/**
 * Read-only health checks for the bundled local-discovery snapshot
 * (features/nearby/data/osmSnapshot.json, Stage 10). Pure: reports issues,
 * never edits the data, never contacts OpenStreetMap.
 */
import { NEARBY_CATEGORIES } from '../features/nearby/nearbyCategories.js'
import { NAGPUR_BOUNDS } from '../features/nearby/providers/osm.js'
import { distanceMeters } from '../utils/geo.js'
import { worstStatus } from './status.js'

const LAYERS = { around: 'Around PCE', nagpur: 'Explore Nagpur' }
const KEY_RE = /^osm-[nwr]\d+$/
// Same rule the student app uses to hide an external place that duplicates a campus place.
const CAMPUS_DUPLICATE_M = 40
// Mirrors providers/osm.js aroundQuery: stations are fetched within twice the radius.
const STATION_CATEGORIES = new Set(['metro', 'railway'])
const radiusFor = (category, radiusM) => radiusM * (STATION_CATEGORIES.has(category) ? 2 : 1)

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const validCoords = (c) => c && isNum(c.lat) && isNum(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && !(c.lat === 0 && c.lng === 0)
const inBounds = (c, b) => c.lat >= b.south && c.lat <= b.north && c.lng >= b.west && c.lng <= b.east

export function analyzeSnapshot(snapshot, { campus } = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { status: 'unavailable', meta: null, layers: {}, checks: [], flags: {} }
  }
  const meta = {
    provider: snapshot.provider ?? null,
    attribution: snapshot.attribution ?? null,
    fetchedAt: snapshot.fetchedAt ?? null,
    version: snapshot.version ?? null,
    center: validCoords(snapshot.center) ? snapshot.center : null,
    radiusM: isNum(snapshot.radiusM) ? snapshot.radiusM : null,
  }

  const flags = {} // key → [codes]
  const flag = (key, code) => (flags[key] ??= []).push(code)
  const found = {}
  const add = (code, key) => (found[code] ??= []).push(key)

  const layers = {}
  const seenKeys = new Map()
  const coordGroups = new Map()
  let malformedCount = 0

  for (const [layer, label] of Object.entries(LAYERS)) {
    const list = Array.isArray(snapshot[layer]) ? snapshot[layer] : null
    if (!list) {
      layers[layer] = { label, count: 0, missing: true, categories: [], places: [] }
      add('missing_layer', layer)
      continue
    }
    const categoryCounts = {}
    const places = []
    list.forEach((p, i) => {
      if (!p || typeof p !== 'object') {
        malformedCount += 1
        add('malformed', `${layer}[${i}]`)
        return
      }
      const key = typeof p.key === 'string' ? p.key : `${layer}[${i}]`
      places.push({ ...p, key, layer })

      if (!KEY_RE.test(p.key ?? '') || p.provider !== 'osm' || typeof p.source !== 'string') {
        add('malformed', key)
        flag(key, 'malformed')
      }
      if (!p.name || !String(p.name).trim()) {
        add('missing_name', key)
        flag(key, 'missing_name')
      }
      if (!p.coords) {
        add('missing_coords', key)
        flag(key, 'missing_coords')
      } else if (!validCoords(p.coords)) {
        add('invalid_coords', key)
        flag(key, 'invalid_coords')
      } else {
        const ck = `${p.coords.lat},${p.coords.lng}`
        coordGroups.set(ck, [...(coordGroups.get(ck) ?? []), key])
        if (layer === 'around' && meta.center && meta.radiusM && distanceMeters(meta.center, p.coords) > radiusFor(p.category, meta.radiusM) * 1.05) {
          add('outside_radius', key)
          flag(key, 'outside_radius')
        }
        if (layer === 'nagpur' && !inBounds(p.coords, NAGPUR_BOUNDS)) {
          add('outside_nagpur', key)
          flag(key, 'outside_nagpur')
        }
        if (campus?.length && campus.some((l) => isNum(l.latitude) && distanceMeters({ lat: l.latitude, lng: l.longitude }, p.coords) < CAMPUS_DUPLICATE_M)) {
          add('campus_overlap', key)
          flag(key, 'campus_overlap')
        }
      }
      if (!p.category) {
        add('missing_category', key)
        flag(key, 'missing_category')
      } else if (!NEARBY_CATEGORIES[p.category]) {
        add('unsupported_category', key)
        flag(key, 'unsupported_category')
      } else if (NEARBY_CATEGORIES[p.category].layer !== layer) {
        add('layer_mismatch', key)
        flag(key, 'layer_mismatch')
      }
      categoryCounts[p.category ?? '(none)'] = (categoryCounts[p.category ?? '(none)'] ?? 0) + 1

      if (seenKeys.has(key)) {
        add('duplicate_keys', key)
        flag(key, 'duplicate_key')
      } else seenKeys.set(key, layer)
    })
    layers[layer] = {
      label,
      count: list.length,
      categories: Object.entries(categoryCounts)
        .map(([id, count]) => ({ id, label: NEARBY_CATEGORIES[id]?.label ?? id, count }))
        .sort((a, b) => b.count - a.count),
      places,
    }
  }

  const sharedCoords = [...coordGroups.values()].filter((keys) => keys.length > 1)
  sharedCoords.flat().forEach((k) => flag(k, 'shared_coords'))

  const check = (code, title, status, detail, keys = found[code] ?? []) => ({
    code,
    title,
    status: keys.length ? status : 'healthy',
    detail: keys.length ? detail(keys.length) : 'None',
    keys,
  })
  const checks = [
    {
      code: 'metadata',
      title: 'Snapshot metadata',
      status: meta.fetchedAt && meta.provider === 'osm' && meta.attribution ? 'healthy' : 'warning',
      detail: meta.fetchedAt ? `Provider ${meta.provider ?? '—'}, fetched ${meta.fetchedAt}` : 'Fetch date or provider missing',
      keys: [],
    },
    check('missing_layer', 'Missing layers', 'warning', (c) => `${c} layer(s) absent`),
    check('malformed', 'Malformed records', 'warning', (c) => `${c} record(s) with a bad key, provider or source${malformedCount ? `; ${malformedCount} not an object` : ''}`),
    check('missing_name', 'Missing name', 'warning', (c) => `${c} record(s)`),
    check('missing_coords', 'Missing coordinates', 'warning', (c) => `${c} record(s)`),
    check('invalid_coords', 'Invalid coordinates', 'warning', (c) => `${c} out of range`),
    check('duplicate_keys', 'Duplicate provider IDs', 'warning', (c) => `${c} repeated OSM id(s)`),
    check('missing_category', 'Missing category', 'warning', (c) => `${c} record(s)`),
    check('unsupported_category', 'Unsupported category', 'warning', (c) => `${c} record(s) with a category the app can't show`),
    check('layer_mismatch', 'Category in the wrong layer', 'needs_review', (c) => `${c} record(s)`),
    check('outside_radius', 'Outside the snapshot radius', 'needs_review', (c) => `${c} Around-PCE record(s) beyond the query radius (${meta.radiusM} m; stations ${meta.radiusM * 2} m)`),
    check('outside_nagpur', 'Outside Nagpur bounds', 'needs_review', (c) => `${c} Nagpur record(s)`),
    check('shared_coords', 'Duplicate coordinates', 'info', () => `${sharedCoords.length} group(s) share an exact position`, sharedCoords.flat()),
    check('campus_overlap', 'Overlaps a campus place', 'info', (c) => `${c} record(s) within ${CAMPUS_DUPLICATE_M} m of a campus place — hidden in the app, campus record shown instead`),
  ]

  return {
    status: worstStatus(checks.map((c) => c.status)),
    meta,
    layers,
    checks,
    flags,
    sharedCoords,
  }
}

export const OSM_FLAG_LABELS = {
  malformed: 'Malformed',
  missing_name: 'No name',
  missing_coords: 'No coordinates',
  invalid_coords: 'Invalid coordinates',
  outside_radius: 'Outside radius',
  outside_nagpur: 'Outside Nagpur',
  campus_overlap: 'Overlaps campus',
  missing_category: 'No category',
  unsupported_category: 'Unsupported category',
  layer_mismatch: 'Wrong layer',
  duplicate_key: 'Duplicate id',
  shared_coords: 'Shared position',
}
