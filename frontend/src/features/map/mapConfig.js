/**
 * Renderer-agnostic map settings. Campus bounds normally come from the
 * location data; defaultCenter/defaultZoom are only used before any load.
 *
 * Zoom levels use the Google Maps scale (256 px tiles).
 */
export const mapConfig = {
  // Priyadarshini College of Engineering, Nagpur (seed "Main campus" point).
  defaultCenter: { lat: 21.1015, lng: 79.0075 },
  defaultZoom: 16,
  minZoom: 15,
  maxZoom: 20,
  // Nearby (places across Nagpur): wider zoom-out and panning limits.
  areaMinZoom: 11,
  areaBounds: { south: 20.85, west: 78.75, north: 21.42, east: 79.35 },
  // Degrees added around the campus bounds to limit panning.
  maxBoundsMargin: 0.05,
  // Extra breathing room (px) around fitted content, on top of UI insets.
  fitPadding: 48,
  focusZoom: 19,
  routeMaxZoom: 19,
  // Category / whole-campus / current-location framing.
  areaZoom: 18,
  // Tiles must load within these windows or the map (first load) / map type
  // (after a switch) is treated as unavailable. The first load includes
  // script download and a cold renderer start, so it gets longer.
  initialTileTimeoutMs: 20000,
  tileTimeoutMs: 12000,
  cameraAnimationMs: 350,
  clusterRadius: 44,
  clusterMaxZoom: 18,
  labelMinZoom: 17.5,
  // Places further than this from the median of all places are treated as
  // outliers (likely data-entry errors): they keep their marker, but never
  // drive campus bounds, fitting or camera focus. Data is never altered.
  outlierRadiusM: 3000,
  // User-facing map types → Google map type ids. "Satellite" is hybrid so
  // aerial imagery keeps road and area labels.
  mapTypes: {
    standard: 'roadmap',
    satellite: 'hybrid',
  },
}
