/**
 * Tunables for routing and live navigation. Every threshold that affects
 * what the user sees or how often Google is called lives here.
 */
export const navConfig = {
  // --- Routing requests (cost control)
  // Give up on a Google route request after this long.
  routeRequestTimeoutMs: 15000,
  // Reuse a successful route for the same origin/destination for this long
  // (preview → navigation → back costs one request, not three).
  routeCacheTtlMs: 5 * 60 * 1000,
  // A failed request is only remembered briefly so a retry can succeed.
  failedRouteCacheTtlMs: 20 * 1000,
  // Route preview with "My location" as the start: only ask for a new route
  // after the device has moved this far from the last requested origin.
  previewOriginMoveMeters: 40,
  // Never ask Google for a walk longer than this (bad data / far off campus).
  maxRouteDistanceMeters: 10000,

  // --- Route progress / off-route
  OFF_ROUTE_THRESHOLD_METERS: 50,
  // GPS error widens the off-route threshold by up to this much.
  offRouteAccuracyAllowanceMeters: 25,
  // Fixes worse than this don't drive off-route or arrival decisions.
  poorAccuracyMeters: 60,
  // Off route for this long before the UI says so (filters GPS jitter).
  offRouteConfirmMs: 5000,

  // --- Rerouting (cost control)
  minRerouteIntervalMs: 30 * 1000,
  // Only reroute again after moving this far from the last reroute origin.
  rerouteMinMovementMeters: 25,
  maxReroutesPerSession: 8,
  // Further than this from the route: don't reroute (likely not on campus).
  rerouteMaxDistanceMeters: 2000,

  // --- Arrival
  ARRIVAL_THRESHOLD_METERS: 25,

  // --- GPS
  // No fix for this long while navigating → "GPS signal lost".
  staleFixMs: 20 * 1000,

  // --- Map
  followZoom: 18.5,
  // A mapped route that starts/ends further than this from the actual
  // place is joined to it with a dotted "not a mapped path" connector.
  connectorMinGapMeters: 15,

  // --- Voice
  // Speak the upcoming maneuver again when it is this close.
  maneuverPromptMeters: 30,
}
