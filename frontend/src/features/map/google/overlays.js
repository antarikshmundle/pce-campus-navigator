/**
 * Route lines + current-position accuracy circle (Google vector shapes).
 * Colours come from the locked map palette.
 */
import { mapPalette as P } from '../../../design/tokens.js'

const Z = { alternative: 1, casing: 3, traveled: 4, line: 5, connector: 5 }

/** Keeps polylines on/off the map without recreating them. */
function show(line, map, path, options = {}) {
  if (!path || path.length < 2) {
    line.setMap(null)
    return
  }
  line.setOptions({ path, ...options })
  if (line.getMap() !== map) line.setMap(map)
}

/** A growable set of identically styled polylines. */
function linePool(create) {
  const lines = []
  return {
    render(map, paths) {
      paths.forEach((path, i) => {
        lines[i] ??= create()
        show(lines[i], map, path)
      })
      for (let i = paths.length; i < lines.length; i++) lines[i].setMap(null)
    },
    remove() {
      lines.forEach((l) => l.setMap(null))
    },
  }
}

/**
 * Route overlay. `route` (all but geometry optional):
 *   geometry     { kind: 'walking-path' | 'direct-line', coordinates }  solid vs dotted
 *   traveled     [{lat,lng}…]    already walked (navigation), drawn muted
 *   alternatives [[{lat,lng}…]…] other real routes, drawn muted underneath
 *   connectors   [[{lat,lng}…]…] joins to places the mapped path doesn't reach, dotted
 *
 * A 'direct-line' estimate is dotted so it never reads as a real walking path.
 */
export function createRouteOverlay(maps, core) {
  const polyline = (options) => new maps.Polyline({ path: [], clickable: false, ...options })
  const dots = (color) => ({
    strokeOpacity: 0,
    icons: [
      {
        icon: { path: core.SymbolPath.CIRCLE, scale: 2.5, fillColor: color, fillOpacity: 1, strokeOpacity: 0 },
        offset: '0',
        repeat: '11px',
      },
    ],
  })

  const casing = polyline({ strokeColor: P.routeCasing, strokeOpacity: 1, strokeWeight: 10, zIndex: Z.casing })
  const line = polyline({ zIndex: Z.line })
  const traveled = polyline({ strokeColor: P.routeTraveled, strokeOpacity: 1, strokeWeight: 5, zIndex: Z.traveled })
  const alternatives = linePool(() =>
    polyline({ strokeColor: P.routeAlternative, strokeOpacity: 0.9, strokeWeight: 6, zIndex: Z.alternative }),
  )
  const connectors = linePool(() => polyline({ zIndex: Z.connector, ...dots(P.route) }))
  const solid = { strokeColor: P.route, strokeOpacity: 1, strokeWeight: 5, icons: [] }

  return {
    set(map, route) {
      const coords = route?.geometry?.coordinates
      if (!coords || coords.length < 2) {
        this.remove()
        return
      }
      const walked = route.traveled?.length > 1 ? route.traveled : null
      show(casing, map, walked ? [...walked, ...coords] : coords)
      show(line, map, coords, route.geometry.kind === 'walking-path' ? solid : dots(P.route))
      show(traveled, map, walked)
      alternatives.render(map, route.alternatives ?? [])
      connectors.render(map, route.connectors ?? [])
    },
    remove() {
      ;[casing, line, traveled].forEach((l) => l.setMap(null))
      alternatives.remove()
      connectors.remove()
    },
  }
}

export function createAccuracyCircle(maps) {
  const circle = new maps.Circle({
    clickable: false,
    fillColor: P.user,
    fillOpacity: 0.12,
    strokeColor: P.user,
    strokeOpacity: 0.35,
    strokeWeight: 1,
    zIndex: 0,
  })
  return {
    set(map, position) {
      if (!position || !(position.accuracy > 0)) {
        circle.setMap(null)
        return
      }
      // Google rejects literals with extra keys (accuracy), so pass lat/lng only.
      circle.setCenter({ lat: position.lat, lng: position.lng })
      circle.setRadius(position.accuracy)
      circle.setMap(map)
    },
    remove() {
      circle.setMap(null)
    },
  }
}
