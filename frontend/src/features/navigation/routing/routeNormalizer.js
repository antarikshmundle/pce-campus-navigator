/**
 * Turns provider route objects into the NormalizedRoute contract
 * (routeTypes.js). Pure functions; the Google objects are only read.
 *
 * Instructions are never invented: a step shows Google's own text; if that
 * is missing, a phrase derived from Google's own maneuver code; if that is
 * missing too, a neutral "Continue along the route".
 */
import { distanceMeters, pathLengthMeters, walkingSeconds } from '../../../utils/geo.js'
import { navConfig } from '../navConfig.js'
import { ROUTE_SOURCE, endpointCoords } from './routeTypes.js'

/** Reads a getter that may throw (e.g. a field that wasn't requested). */
function read(obj, key) {
  try {
    return obj?.[key]
  } catch {
    return undefined
  }
}

const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)
const seconds = (ms) => (finite(ms) != null ? ms / 1000 : null)

/** Any Google/plain lat-lng shape → { lat, lng } (extra keys dropped: Google rejects them). */
export function toLatLng(value) {
  if (!value) return null
  const lat = typeof value.lat === 'function' ? value.lat() : value.lat
  const lng = typeof value.lng === 'function' ? value.lng() : value.lng
  return finite(lat) != null && finite(lng) != null ? { lat, lng } : null
}

const toPath = (list) => Array.from(list ?? [], toLatLng).filter(Boolean)

export function normalizeManeuver(maneuver) {
  if (!maneuver) return null
  const m = String(maneuver).trim().toUpperCase().replace(/-/g, '_')
  return m && m !== 'MANEUVER_UNSPECIFIED' ? m : null
}

// Wording for Google's own maneuver codes — used only when Google sent no text.
const MANEUVER_TEXT = {
  DEPART: 'Start walking',
  STRAIGHT: 'Continue straight',
  NAME_CHANGE: 'Continue',
  TURN_LEFT: 'Turn left',
  TURN_RIGHT: 'Turn right',
  TURN_SLIGHT_LEFT: 'Bear left',
  TURN_SLIGHT_RIGHT: 'Bear right',
  TURN_SHARP_LEFT: 'Turn sharp left',
  TURN_SHARP_RIGHT: 'Turn sharp right',
  UTURN_LEFT: 'Make a U-turn',
  UTURN_RIGHT: 'Make a U-turn',
  FORK_LEFT: 'Keep left at the fork',
  FORK_RIGHT: 'Keep right at the fork',
  RAMP_LEFT: 'Keep left',
  RAMP_RIGHT: 'Keep right',
  MERGE: 'Merge',
  ROUNDABOUT_LEFT: 'Go around the roundabout',
  ROUNDABOUT_RIGHT: 'Go around the roundabout',
}
export const GENERIC_INSTRUCTION = 'Continue along the route'

/** Plain text only. Legacy Directions sent HTML, so parse it inertly (no script runs). */
export function cleanInstruction(text) {
  if (!text) return ''
  let s = String(text)
  if (/[<&]/.test(s) && typeof DOMParser !== 'undefined') {
    s = new DOMParser().parseFromString(s.replace(/<(div|br)\b/gi, ' <$1'), 'text/html').body.textContent ?? ''
  }
  return s.replace(/\s+/g, ' ').trim()
}

export function normalizeStep(step) {
  const path = toPath(read(step, 'path'))
  const text = cleanInstruction(read(step, 'instructions'))
  const maneuver = normalizeManeuver(read(step, 'maneuver'))
  const meters = finite(read(step, 'distanceMeters')) ?? pathLengthMeters(path)
  return {
    instruction: text || MANEUVER_TEXT[maneuver] || GENERIC_INSTRUCTION,
    instructionFromProvider: Boolean(text),
    maneuver,
    distanceMeters: meters,
    durationSeconds: seconds(read(step, 'staticDurationMillis')) ?? walkingSeconds(meters),
    startLocation: toLatLng(read(step, 'startLocation')) ?? path[0] ?? null,
    endLocation: toLatLng(read(step, 'endLocation')) ?? path.at(-1) ?? null,
    path,
  }
}

/** Google Maps walking link. Without `from`, Google Maps starts from the device's live location. */
export function externalWalkingUrl(from, to) {
  const origin = from ? `&origin=${from.lat},${from.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lng}&travelmode=walking`
}

/** Dotted joins where the mapped path stops short of the actual places. */
function approach(path, from, to) {
  const start = distanceMeters(from, path[0])
  const end = distanceMeters(path.at(-1), to)
  const min = navConfig.connectorMinGapMeters
  const connectors = []
  if (start > min) connectors.push([from, path[0]])
  if (end > min) connectors.push([path.at(-1), to])
  return { gaps: { start, end }, connectors }
}

/**
 * Google `Route` → NormalizedRoute, or null when it has no usable geometry.
 * `index` 0 is Google's default route; higher ones are its alternatives.
 */
export function normalizeGoogleRoute(route, { origin, destination, index = 0 }) {
  const legs = Array.from(read(route, 'legs') ?? [])
  let path = toPath(read(route, 'path'))
  if (path.length < 2) path = legs.flatMap((leg) => toPath(read(leg, 'path')))
  if (path.length < 2) return null

  const steps = legs.flatMap((leg) => Array.from(read(leg, 'steps') ?? [], normalizeStep))
  const legMeters = legs.reduce((sum, leg) => sum + (finite(read(leg, 'distanceMeters')) ?? 0), 0)
  const meters = finite(read(route, 'distanceMeters')) ?? (legMeters || pathLengthMeters(path))
  if (!(meters > 0)) return null

  const from = toLatLng(endpointCoords(origin))
  const to = toLatLng(endpointCoords(destination))
  return {
    id: `google-${index}`,
    source: ROUTE_SOURCE.GOOGLE_WALKING,
    origin,
    destination,
    distanceMeters: meters,
    durationSeconds:
      seconds(read(route, 'durationMillis')) ?? seconds(read(route, 'staticDurationMillis')) ?? walkingSeconds(meters),
    path,
    steps,
    warnings: Array.from(read(route, 'warnings') ?? [], String).filter(Boolean),
    labels: Array.from(read(route, 'routeLabels') ?? [], String),
    ...approach(path, from, to),
    generatedAt: Date.now(),
    externalUrl: externalWalkingUrl(from, to),
  }
}

/** Straight line between the endpoints — an estimate, never a path to walk. */
export function directLineRoute({ origin, destination }) {
  const from = toLatLng(endpointCoords(origin))
  const to = toLatLng(endpointCoords(destination))
  const meters = distanceMeters(from, to)
  return {
    id: 'direct',
    source: ROUTE_SOURCE.DIRECT_LINE,
    origin,
    destination,
    distanceMeters: meters,
    durationSeconds: walkingSeconds(meters),
    path: [from, to],
    steps: [],
    warnings: [],
    labels: [],
    connectors: [],
    gaps: { start: 0, end: 0 },
    generatedAt: Date.now(),
    externalUrl: externalWalkingUrl(from, to),
  }
}
