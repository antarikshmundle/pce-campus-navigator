/**
 * Proximity helpers for discovery lists (future Nearby screen, detail page).
 * All distances are straight-line (Haversine) between known coordinates —
 * callers must present them as approximate, never as walking distance.
 */
import { distanceMeters } from '../../utils/geo.js'

// Places closer than this are effectively at the same point (shared coordinates).
export const SAME_SPOT_METERS = 15

/** [{ location, meters }] sorted nearest first. */
export function sortByDistance(locations, origin) {
  return locations
    .map((location) => ({ location, meters: distanceMeters(origin, location.coords) }))
    .sort((a, b) => a.meters - b.meters || a.location.displayName.localeCompare(b.location.displayName))
}

/** The `limit` places closest to `place`, excluding itself. */
export function nearbyPlaces(place, locations, { limit = 5 } = {}) {
  return sortByDistance(
    locations.filter((l) => l.id !== place.id),
    place.coords,
  ).slice(0, limit)
}

/** Other places recorded in the same building (exact field match only). */
export function placesInSameBuilding(place, locations) {
  if (!place.building) return []
  return locations.filter((l) => l.id !== place.id && l.building === place.building)
}
