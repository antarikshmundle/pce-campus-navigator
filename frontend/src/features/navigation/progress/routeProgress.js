/**
 * Client-side route progress: where a GPS fix is along a NormalizedRoute.
 * Pure functions, no framework or map code.
 *
 * Geometry runs in a local equirectangular projection (meters) centred on
 * the route. At campus scale its error is far below GPS error.
 */
const EARTH_RADIUS_M = 6371000
const RAD = Math.PI / 180

// Matching prefers the stretch just behind/ahead of the last position, so a
// route that doubles back on itself doesn't make progress jump.
const BACKTRACK_M = 30
const LOOKAHEAD_M = 250
const LOCAL_PREFERENCE_M = 15
// Within that stretch, meters of distance traded per meter along the route
// away from the last position (breaks ties between overlapping legs).
const CONTINUITY_WEIGHT = 0.05

function projector(refLat) {
  const kx = RAD * EARTH_RADIUS_M * Math.cos(refLat * RAD)
  const ky = RAD * EARTH_RADIUS_M
  return {
    toXY: (p) => ({ x: p.lng * kx, y: p.lat * ky }),
    toLatLng: (q) => ({ lat: q.y / ky, lng: q.x / kx }),
  }
}

/**
 * Closest point on the path, optionally within [minOffset, maxOffset] meters
 * along it. With `near`, points close to that offset are preferred.
 */
function closest(prep, p, minOffset = -Infinity, maxOffset = Infinity, near = null) {
  const { pts, cum } = prep
  let best = null
  let bestScore = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    if (cum[i + 1] < minOffset || cum[i] > maxOffset) continue
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
    const q = { x: a.x + t * dx, y: a.y + t * dy }
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    const offset = cum[i] + t * (cum[i + 1] - cum[i])
    const score = near == null ? d : d + CONTINUITY_WEIGHT * Math.abs(offset - near)
    if (score < bestScore) {
      bestScore = score
      best = { distance: d, point: q, segIndex: i, offset }
    }
  }
  return best
}

/**
 * Precomputes what progress needs: projected path, cumulative distance and
 * the offset (meters along the path) at which each step starts.
 */
export function prepareRoute(route) {
  const proj = projector(route.path[0].lat)
  const pts = route.path.map(proj.toXY)
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum.at(-1)
  const prep = { route, proj, pts, cum, total }

  // Steps are ordered, so each start is searched for from the previous one on.
  let from = 0
  prep.stepStarts = route.steps.map((step, i) => {
    if (i === 0) return 0
    const hit = step.startLocation && closest(prep, proj.toXY(step.startLocation), from)
    const offset = hit ? hit.offset : from + (route.steps[i - 1].distanceMeters ?? 0)
    from = Math.min(total, Math.max(from, offset))
    return from
  })
  // Google's distance vs. geometric length (they differ slightly).
  prep.scale = total > 0 ? route.distanceMeters / total : 1
  return prep
}

/**
 * Progress of `position` ({ lat, lng }) along a prepared route.
 * `hintOffset`: the previous result's offset, for stable matching.
 *
 * Returns {
 *   offset, segIndex, snapped      where on the path (geometric meters / segment / { lat, lng })
 *   distanceFromRoute              meters between the fix and the path
 *   stepIndex                      step being walked (-1 when the route has no steps)
 *   distanceToManeuver             meters to the start of the next step (or to the end)
 *   traveledMeters, remainingMeters, remainingSeconds, fraction
 * }
 */
export function computeProgress(prep, position, hintOffset = null) {
  const p = prep.proj.toXY(position)
  let best = closest(prep, p)
  if (hintOffset != null) {
    const local = closest(prep, p, hintOffset - BACKTRACK_M, hintOffset + LOOKAHEAD_M, hintOffset)
    if (local && local.distance <= best.distance + LOCAL_PREFERENCE_M) best = local
  }

  const { offset } = best
  const { stepStarts, total, scale, route } = prep
  let stepIndex = -1
  for (let i = 0; i < stepStarts.length; i++) if (stepStarts[i] <= offset + 1) stepIndex = i
  const nextStart = stepStarts[stepIndex + 1] ?? total
  const remaining = Math.max(0, total - offset)

  return {
    offset,
    segIndex: best.segIndex,
    snapped: prep.proj.toLatLng(best.point),
    distanceFromRoute: best.distance,
    stepIndex,
    distanceToManeuver: Math.max(0, nextStart - offset) * scale,
    traveledMeters: offset * scale,
    remainingMeters: remaining * scale,
    remainingSeconds: total > 0 ? route.durationSeconds * (remaining / total) : 0,
    fraction: total > 0 ? offset / total : 1,
  }
}

/** The path split at the matched point: { traveled, remaining }. */
export function splitPath(prep, progress) {
  const { path } = prep.route
  const cut = progress.segIndex + 1
  return {
    traveled: [...path.slice(0, cut), progress.snapped],
    remaining: [progress.snapped, ...path.slice(cut)],
  }
}
