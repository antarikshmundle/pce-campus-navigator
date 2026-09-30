/**
 * Route abstraction. Screens depend only on the RouteResult / NormalizedRoute
 * contract (features/navigation/routing/routeTypes.js) and never on Google.
 *
 * Strategy:
 *   1. Google walking routes (Maps JS "routes" library → Routes API)
 *   2. If that fails: a direct-line estimate, returned with status 'fallback'
 *      so the UI labels it as an estimate — never as a path to walk.
 *
 * Results are cached briefly per origin/destination so preview → navigation
 * → back costs one Google request, not three. The legacy backend
 * /directions endpoint (services/directionsService.js) is left untouched; its
 * templated text isn't walking directions, so it is no longer shown here.
 */
import { distanceMeters } from '../../utils/geo.js'
import { navConfig } from '../navigation/navConfig.js'
import { directLineRoute } from '../navigation/routing/routeNormalizer.js'
import { ROUTE_FAILURE, RouteError, endpointCoords } from '../navigation/routing/routeTypes.js'

export { endpointCoords }

const cache = new Map() // key → { at, ttl, promise, result }

const validCoords = (c) =>
  c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180

/** Stable identity of a route request. Device origins are keyed to ~10 m. */
export function routeKey(origin, destination) {
  const part = (ep) => {
    if (!ep) return 'none'
    if (ep.kind === 'place') return `place:${ep.location.id}`
    const c = endpointCoords(ep)
    return `device:${c.lat.toFixed(4)},${c.lng.toFixed(4)}`
  }
  return `${part(origin)}→${part(destination)}`
}

async function compute({ origin, destination, alternatives }) {
  const from = endpointCoords(origin)
  const to = endpointCoords(destination)
  if (!validCoords(from) || !validCoords(to) || distanceMeters(from, to) < 1) {
    return { status: 'invalid', routes: [], failure: ROUTE_FAILURE.INVALID_ENDPOINT }
  }
  // Far beyond a campus walk (e.g. a mistyped coordinate): don't pay for a request.
  if (distanceMeters(from, to) > navConfig.maxRouteDistanceMeters) {
    return { status: 'invalid', routes: [], failure: ROUTE_FAILURE.INVALID_ENDPOINT }
  }

  try {
    const { getWalkingRoutes } = await import('../navigation/routing/googleRouteService.js')
    const routes = await getWalkingRoutes({ origin, destination, alternatives })
    return { status: 'ok', routes, failure: null }
  } catch (err) {
    const reason = err instanceof RouteError ? err.reason : ROUTE_FAILURE.UNAVAILABLE
    console.warn('[routing] walking route unavailable:', reason, err?.message ?? '')
    return { status: 'fallback', routes: [directLineRoute({ origin, destination })], failure: reason }
  }
}

/**
 * RouteResult for two Endpoints. Never rejects.
 * - alternatives: ask Google for alternative routes too
 * - fresh:        skip the cache (rerouting from a new position)
 */
function getRoutes({ origin, destination, alternatives = true, fresh = false }) {
  const key = `${routeKey(origin, destination)}|${alternatives ? 'alt' : 'one'}`
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < hit.ttl) return hit.promise

  const entry = { at: Date.now(), ttl: navConfig.routeCacheTtlMs, result: null }
  entry.promise = compute({ origin, destination, alternatives }).then((result) => {
    entry.result = result
    if (result.status !== 'ok') entry.ttl = navConfig.failedRouteCacheTtlMs
    return result
  })
  cache.set(key, entry)
  return entry.promise
}

/** A settled, unexpired result for `key` (from routeKey), or null. Synchronous. */
function getCached(key) {
  for (const suffix of ['alt', 'one']) {
    const hit = cache.get(`${key}|${suffix}`)
    if (hit?.result && Date.now() - hit.at < hit.ttl) return hit.result
  }
  return null
}

export const routeService = { getRoutes, getCached, routeKey }
