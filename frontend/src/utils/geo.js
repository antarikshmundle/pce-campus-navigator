const EARTH_RADIUS_M = 6371000

// Mirrors backend/app/services/directions.py so client-side estimates match
// what the /directions endpoint returns.
const WALK_SPEED_MPS = 1.3

const toRad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance in meters between two {lat, lng} points. */
export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function walkingMinutes(meters) {
  return Math.max(1, Math.ceil(meters / (WALK_SPEED_MPS * 60)))
}

export function walkingSeconds(meters) {
  return meters / WALK_SPEED_MPS
}

/** Length in meters of a [{lat, lng}, …] polyline. */
export function pathLengthMeters(path) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i])
  return total
}

/** { meters, minutes } from origin to target, or null without an origin. */
export function travelEstimate(origin, target) {
  if (!origin || !target) return null
  const meters = distanceMeters(origin, target)
  return { meters, minutes: walkingMinutes(meters) }
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatMinutes(minutes) {
  return `${minutes} min`
}

/** "4 min", "1 h 5 min" — never "0 min". */
export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
