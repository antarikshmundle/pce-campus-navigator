/**
 * Local discovery service: the UI's only way to get off-campus places.
 * Providers stay behind it (providers/osm.js today; a Google Places provider
 * could slot in here once that API and billing are enabled).
 *
 * Sources, in order:
 *   1. Live OpenStreetMap (Overpass) — only around the user's own location,
 *      once per ~100 m cell per session (public API, fair-use rate limits).
 *   2. Bundled OSM snapshot (data/osmSnapshot.json) — real OSM data around PCE
 *      and Nagpur attractions, fetched on a stated date. Used for PCE, and
 *      whenever the live provider fails. Never invented or edited by hand.
 *
 * Campus places never come from here — the 69 canonical locations do.
 */
import snapshot from './data/osmSnapshot.json'
import { aroundQuery, normalizeOsm, OSM_ATTRIBUTION, runOverpass } from './providers/osm.js'
import { distanceMeters } from '../../utils/geo.js'
import { mapConfig } from '../map/mapConfig.js'

export const SNAPSHOT_INFO = { fetchedAt: snapshot.fetchedAt, attribution: OSM_ATTRIBUTION }
const LIVE_RADIUS_M = 5000
// An off-campus place this close to a campus place is the same place.
const CAMPUS_DUPLICATE_M = 40

// Every place loaded this session, for detail lookups by key.
const registry = new Map()
const register = (list) => list.forEach((p) => registry.set(p.key, p))
register(snapshot.around)
register(snapshot.nagpur)

export const snapshotAround = () => snapshot.around
export const nagpurPlaces = () => snapshot.nagpur
export const findPlace = (key) => registry.get(key) ?? null

const liveCache = new Map() // cell → Promise<places>

/** Live places around `center`. Rejects on any provider failure (caller falls back). */
export function fetchLiveAround(center) {
  const cell = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`
  if (!liveCache.has(cell)) {
    const request = runOverpass(aroundQuery(center, LIVE_RADIUS_M)).then((elements) => {
      const places = normalizeOsm(elements)
      if (!places.length) throw new Error('Live provider returned no places')
      register(places)
      return places
    })
    // A failed request may be retried later (e.g. after a rate limit).
    request.catch((err) => {
      console.warn('[nearby] live provider unavailable:', err?.message)
      liveCache.delete(cell)
    })
    liveCache.set(cell, request)
  }
  return liveCache.get(cell)
}

/**
 * Campus reference point: the median position of the canonical campus places
 * (excluding coordinates flagged as outliers) — the same point the snapshot
 * was built around. Before data loads: the configured campus centre.
 */
export function campusCenter(locations, outlierIds = new Set()) {
  const pts = locations.filter((l) => !outlierIds.has(l.id)).map((l) => l.coords)
  if (!pts.length) return mapConfig.defaultCenter
  const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  return { lat: median(pts.map((p) => p.lat)), lng: median(pts.map((p) => p.lng)) }
}

/** Drop off-campus places that duplicate a canonical campus place. */
export function withoutCampusDuplicates(places, campusLocations) {
  return places.filter((p) => !campusLocations.some((l) => distanceMeters(p.coords, l.coords) < CAMPUS_DUPLICATE_M))
}

/** Places with `meters` from `reference`, nearest first. */
export function byDistance(places, reference) {
  return places.map((p) => ({ place: p, meters: distanceMeters(reference, p.coords) })).sort((a, b) => a.meters - b.meters)
}

export { navigateUrl, openInMapsUrl, sourceUrl } from './externalLinks.js'
