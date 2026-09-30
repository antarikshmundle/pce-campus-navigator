/**
 * Converts app data (normalized locations) into GeoJSON and campus extents
 * for the map renderers. Renderer-agnostic and side-effect free.
 */
import { getCategoryMeta } from '../locations/categoryMeta.js'
import { distanceMeters } from '../../utils/geo.js'
import { mapConfig } from './mapConfig.js'

const toLngLat = (c) => [c.lng, c.lat]
const collection = (features) => ({ type: 'FeatureCollection', features })

export function placesToGeoJSON(locations, { visibleIds = null, excludeId = null } = {}) {
  return collection(
    locations
      .filter((l) => l.id !== excludeId) // the selected place is drawn as its own marker
      .map((l) => ({
        type: 'Feature',
        id: l.id,
        geometry: { type: 'Point', coordinates: toLngLat(l.coords) },
        properties: {
          id: l.id,
          name: l.displayName,
          iconKey: getCategoryMeta(l.category).key,
          dimmed: visibleIds ? !visibleIds.has(l.id) : false,
        },
      })),
  )
}

/** [[west, south], [east, north]] around all coords, or null. */
function boundsOf(coordsList) {
  if (!coordsList.length) return null
  const lngs = coordsList.map((c) => c.lng)
  const lats = coordsList.map((c) => c.lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Campus extent that a single bad coordinate can't distort.
 *
 * Returns { center, bounds, coreCoords, outlierIds, contains(coords) } where
 * outliers are places further than `radiusM` from the median position.
 * The data itself is untouched — outliers are only kept out of framing.
 */
export function analyzeCampus(locations, radiusM = mapConfig.outlierRadiusM) {
  if (!locations.length) {
    return { center: null, bounds: null, coreCoords: [], outlierIds: new Set(), contains: () => true }
  }
  const center = {
    lat: median(locations.map((l) => l.coords.lat)),
    lng: median(locations.map((l) => l.coords.lng)),
  }
  const contains = (coords) => distanceMeters(center, coords) <= radiusM
  const core = locations.filter((l) => contains(l.coords))
  const outlierIds = new Set(locations.filter((l) => !contains(l.coords)).map((l) => l.id))
  const coreCoords = core.map((l) => l.coords)
  return { center, bounds: boundsOf(coreCoords), coreCoords, outlierIds, contains }
}
