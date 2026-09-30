/**
 * Camera math for the Google engine. Google Maps has no global padding and
 * no flyTo, so framing "the part of the map not covered by UI" is done here
 * in Web Mercator world coordinates (256 px at zoom 0).
 */
const TILE = 256
const MAX_LAT = 85.05112878

function toWorld({ lat, lng }) {
  const s = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180)
  return {
    x: TILE * (0.5 + lng / 360),
    y: TILE * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)),
  }
}

function fromWorld({ x, y }) {
  const n = Math.PI - (2 * Math.PI * y) / TILE
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lng: (x / TILE - 0.5) * 360,
  }
}

/**
 * Map centre that puts `coords` in the middle of the unobstructed area.
 * `insets` are px covered by floating UI on each side.
 */
export function centerFor(coords, zoom, insets) {
  const scale = 2 ** zoom
  const p = toWorld(coords)
  const dx = (insets.left - insets.right) / 2
  const dy = (insets.top - insets.bottom) / 2
  return fromWorld({ x: p.x - dx / scale, y: p.y - dy / scale })
}

/**
 * { center, zoom } fitting `coordsList` inside the viewport minus padding.
 * `wholeZoom`: raster maps can't show fractional zoom, so round down to keep
 * everything in view.
 */
export function fitFor(coordsList, { width, height }, padding, { minZoom, maxZoom, wholeZoom = false }) {
  const pts = coordsList.map(toWorld)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  const availW = Math.max(1, width - padding.left - padding.right)
  const availH = Math.max(1, height - padding.top - padding.bottom)
  const fit = Math.log2(Math.min(spanX ? availW / spanX : Infinity, spanY ? availH / spanY : Infinity))
  const fitted = Math.min(maxZoom, Number.isFinite(fit) ? fit : maxZoom)
  const zoom = Math.max(minZoom, wholeZoom ? Math.floor(fitted) : fitted)
  const mid = fromWorld({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 })
  return { center: centerFor(mid, zoom, padding), zoom }
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * Moves the camera to { center, zoom }. Eased on vector maps; instant with
 * reduced motion or on raster maps (which can't render fractional zoom).
 * Returns a cancel function.
 */
export function moveCamera(map, target, { durationMs, smooth }) {
  if (!smooth || prefersReducedMotion()) {
    map.moveCamera(target)
    return () => {}
  }
  const from = { center: map.getCenter().toJSON(), zoom: map.getZoom() }
  // Interpolate in world space at zoom 0 so pans stay straight on screen.
  const a = toWorld(from.center)
  const b = toWorld(target.center)
  const start = performance.now()
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / durationMs)
    const k = ease(t)
    map.moveCamera({
      center: fromWorld({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }),
      zoom: from.zoom + (target.zoom - from.zoom) * k,
    })
    if (t < 1) frame = requestAnimationFrame(step)
  })
  return () => cancelAnimationFrame(frame)
}
