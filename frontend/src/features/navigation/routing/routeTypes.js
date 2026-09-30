/**
 * Normalized route contract shared by the routing layer, the map and the
 * navigation screens. Nothing outside features/navigation/routing ever sees
 * a Google object.
 *
 * @typedef {{ lat: number, lng: number }} LatLng
 *
 * @typedef {{ kind: 'place', location: object } | { kind: 'device', coords: LatLng }} Endpoint
 *
 * @typedef {Object} RouteStep
 * @property {string} instruction          Google's text, or a safe generic phrase (never invented directions)
 * @property {boolean} instructionFromProvider  false when `instruction` is a generic fallback
 * @property {string|null} maneuver        provider maneuver, e.g. TURN_LEFT (uppercase, underscores)
 * @property {number} distanceMeters
 * @property {number} durationSeconds
 * @property {LatLng|null} startLocation
 * @property {LatLng|null} endLocation
 * @property {LatLng[]} path               may be empty
 *
 * @typedef {Object} NormalizedRoute
 * @property {string} id
 * @property {'google-walking'|'direct-line'} source
 * @property {Endpoint} origin
 * @property {Endpoint} destination
 * @property {number} distanceMeters
 * @property {number} durationSeconds
 * @property {LatLng[]} path               ≥ 2 points
 * @property {RouteStep[]} steps           empty for a direct-line estimate
 * @property {string[]} warnings           provider warnings, shown verbatim
 * @property {string[]} labels             provider route labels (DEFAULT_ROUTE, DEFAULT_ROUTE_ALTERNATE…)
 * @property {LatLng[][]} connectors       dotted joins between the places and a mapped path that stops short
 * @property {{ start: number, end: number }} gaps  meters between each place and the mapped path
 * @property {number} generatedAt          epoch ms
 * @property {string} externalUrl          Google Maps walking link (secondary fallback)
 *
 * @typedef {Object} RouteResult
 * @property {'ok'|'fallback'|'invalid'} status
 *   ok        routes[0] is a real walking route (alternatives follow, if any)
 *   fallback  routing failed; routes[0] is a direct-line estimate
 *   invalid   origin/destination unusable; routes is empty
 * @property {NormalizedRoute[]} routes
 * @property {string|null} failure         a ROUTE_FAILURE value when status isn't 'ok'
 */

export const ROUTE_SOURCE = {
  GOOGLE_WALKING: 'google-walking',
  DIRECT_LINE: 'direct-line',
}

export const ROUTE_FAILURE = {
  MISSING_KEY: 'missing-key', // no VITE_GOOGLE_MAPS_API_KEY
  NOT_ENABLED: 'not-enabled', // Routes API disabled / not allowed for this key
  DENIED: 'denied', // key rejected (referrer, billing)
  NO_ROUTE: 'no-route', // Google found no walking route
  NETWORK: 'network', // offline / request blocked
  TIMEOUT: 'timeout',
  INVALID_ENDPOINT: 'invalid-endpoint',
  UNAVAILABLE: 'unavailable', // anything else
}

export class RouteError extends Error {
  constructor(reason, detail) {
    super(detail || reason)
    this.reason = reason
  }
}

export const isWalkingRoute = (route) => route?.source === ROUTE_SOURCE.GOOGLE_WALKING

export const endpointCoords = (endpoint) => (endpoint.kind === 'place' ? endpoint.location.coords : endpoint.coords)
