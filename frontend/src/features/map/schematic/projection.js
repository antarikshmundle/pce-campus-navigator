/**
 * Local equirectangular projection for the schematic campus map.
 * Accurate enough at campus scale (< 2 km); replaced wholesale when a real
 * tile map is plugged in behind <CampusMap>.
 */

const DEG = Math.PI / 180
const MIN_AREA = 80

/**
 * Fit `coordsList` into the unobstructed part of a `size` viewport
 * (the viewport minus `insets` occupied by floating UI).
 * Returns null until there is something to fit.
 */
export function createProjection(coordsList, size, insets, padding = 40) {
  if (!coordsList.length || !size.width || !size.height) return null

  const lat0 = coordsList.reduce((sum, c) => sum + c.lat, 0) / coordsList.length
  const kx = Math.cos(lat0 * DEG)
  const toWorld = (c) => ({ x: c.lng * kx, y: -c.lat })

  const world = coordsList.map(toWorld)
  const xs = world.map((p) => p.x)
  const ys = world.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const area = {
    left: insets.left + padding,
    top: insets.top + padding,
    width: Math.max(MIN_AREA, size.width - insets.left - insets.right - padding * 2),
    height: Math.max(MIN_AREA, size.height - insets.top - insets.bottom - padding * 2),
  }

  const scale = Math.min(area.width / Math.max(maxX - minX, 1e-9), area.height / Math.max(maxY - minY, 1e-9))
  const worldCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  const center = { x: area.left + area.width / 2, y: area.top + area.height / 2 }

  /** Screen position at zoom 1 (zoom is applied as a transform around `center`). */
  const toScreen = (coords) => {
    const w = toWorld(coords)
    return {
      x: center.x + (w.x - worldCenter.x) * scale,
      y: center.y + (w.y - worldCenter.y) * scale,
    }
  }

  return { center, toScreen }
}

/** Andrew's monotone-chain convex hull of screen points. */
export function convexHull(points) {
  if (points.length < 3) return points
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const build = (list) => {
    const out = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...build(pts), ...build([...pts].reverse())]
}
