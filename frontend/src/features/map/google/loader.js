/**
 * Loads the Google Maps JavaScript API once, with only the libraries the
 * campus map needs: "core" (SymbolPath — always part of the API anyway),
 * "maps" (Map, Polyline, Circle) and "marker" (AdvancedMarkerElement).
 * The "routes" library (Route.computeRoutes → Routes API) is loaded
 * separately, on the first route request. No Places / Geocoding.
 *
 * Failures are reported as MapLoadError with a `reason`:
 *   missing-key   VITE_GOOGLE_MAPS_API_KEY is not set
 *   engine-load   the script/libraries could not be downloaded (offline, blocked)
 *   auth          key invalid, referrer not allowed, API not enabled, billing
 *                 (reported asynchronously through onAuthFailure)
 */
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey } from './config.js'

class MapLoadError extends Error {
  constructor(reason, detail) {
    super(detail || reason)
    this.reason = reason
  }
}

let loading = null
let authFailed = false
const authListeners = new Set()

/** Google calls window.gm_authFailure for key / referrer / API / billing errors. */
export function onAuthFailure(listener) {
  if (authFailed) queueMicrotask(listener)
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

export function loadGoogleMaps() {
  if (!hasGoogleMapsKey()) {
    return Promise.reject(new MapLoadError('missing-key', 'Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local'))
  }
  if (!loading) {
    window.gm_authFailure = () => {
      authFailed = true
      authListeners.forEach((listener) => listener())
    }
    setOptions({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' })
    loading = Promise.all([importLibrary('core'), importLibrary('maps'), importLibrary('marker')])
      .then(([core, maps, marker]) => ({ core, maps, marker }))
      .catch((err) => {
        throw new MapLoadError('engine-load', err?.message)
      })
  }
  return loading
}

let routesLoading = null

/**
 * The "routes" library, loaded on first use. Unlike the map libraries a
 * failure isn't cached, so a later route request can try again.
 */
export function loadRoutesLibrary() {
  if (!routesLoading) {
    routesLoading = loadGoogleMaps()
      .then(() => importLibrary('routes'))
      .catch((err) => {
        routesLoading = null
        throw err instanceof MapLoadError ? err : new MapLoadError('engine-load', err?.message)
      })
  }
  return routesLoading
}
