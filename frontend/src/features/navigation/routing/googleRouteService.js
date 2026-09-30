/**
 * Google walking routes via the Maps JavaScript API "routes" library
 * (Route.computeRoutes, backed by the Routes API — not the legacy
 * DirectionsService). The only routing code that touches google.maps.
 *
 * Requires, in the key's Google Cloud project: Maps JavaScript API AND
 * Routes API enabled, and both allowed in the key's API restrictions.
 *
 * Loaded lazily by routeService, so the app shell never downloads it.
 */
import { loadRoutesLibrary } from '../../map/google/loader.js'
import { navConfig } from '../navConfig.js'
import { normalizeGoogleRoute, toLatLng } from './routeNormalizer.js'
import { ROUTE_FAILURE, RouteError, endpointCoords } from './routeTypes.js'

// Only what the app reads (the field list also keeps the response small).
const FIELDS = ['path', 'legs', 'distanceMeters', 'durationMillis', 'staticDurationMillis', 'warnings', 'routeLabels']

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new RouteError(ROUTE_FAILURE.TIMEOUT, `No route response within ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/** Google error → ROUTE_FAILURE. Google's own message is kept as the detail. */
function classify(err) {
  if (err instanceof RouteError) return err
  const code = String(err?.code ?? '')
  const text = `${code} ${err?.name ?? ''} ${err?.message ?? ''}`
  let reason = ROUTE_FAILURE.UNAVAILABLE
  if (/SERVICE_DISABLED|has not been used|is disabled|not activated|API_KEY_SERVICE_BLOCKED|not authorized to use this (service|API)/i.test(text)) {
    reason = ROUTE_FAILURE.NOT_ENABLED
  } else if (/PERMISSION_DENIED|REQUEST_DENIED|API_KEY|referer|referrer|billing/i.test(text)) {
    reason = ROUTE_FAILURE.DENIED
  } else if (/NOT_FOUND|ZERO_RESULTS|no route/i.test(text)) {
    reason = ROUTE_FAILURE.NO_ROUTE
  } else if (/MapsNetworkError|NetworkError|Failed to fetch|network/i.test(text)) {
    reason = ROUTE_FAILURE.NETWORK
  }
  return new RouteError(reason, err?.message ?? code)
}

const isFieldError = (err) => /INVALID_ARGUMENT/i.test(String(err?.code ?? err?.message)) && /field/i.test(String(err?.message))

/**
 * Walking routes between two Endpoints → NormalizedRoute[] (Google's default
 * route first, then any alternatives it returned). Throws RouteError.
 */
export async function getWalkingRoutes({ origin, destination, alternatives = true }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new RouteError(ROUTE_FAILURE.NETWORK, 'Browser is offline')
  }

  let Route
  try {
    ;({ Route } = await loadRoutesLibrary())
  } catch (err) {
    throw new RouteError(err?.reason === 'missing-key' ? ROUTE_FAILURE.MISSING_KEY : ROUTE_FAILURE.NETWORK, err?.message)
  }

  const request = (fields) =>
    withTimeout(
      Route.computeRoutes({
        // Plain { lat, lng }: device positions also carry `accuracy`, which Google rejects.
        origin: toLatLng(endpointCoords(origin)),
        destination: toLatLng(endpointCoords(destination)),
        travelMode: 'WALKING',
        computeAlternativeRoutes: alternatives,
        fields,
      }),
      navConfig.routeRequestTimeoutMs,
    )

  let response
  try {
    response = await request(FIELDS)
  } catch (err) {
    // A renamed field must not take routing down: retry once with all fields.
    if (!isFieldError(err)) throw classify(err)
    console.warn('[routing] field list rejected, retrying with all fields:', err?.message)
    try {
      response = await request(['*'])
    } catch (retryErr) {
      throw classify(retryErr)
    }
  }

  const routes = Array.from(response?.routes ?? [])
    .map((route, index) => normalizeGoogleRoute(route, { origin, destination, index }))
    .filter(Boolean)
  if (!routes.length) throw new RouteError(ROUTE_FAILURE.NO_ROUTE, 'Google returned no usable walking route')
  return routes
}
