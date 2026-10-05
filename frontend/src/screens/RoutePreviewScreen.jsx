import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navigation } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { useCampusMap } from '../features/map/MapProvider.jsx'
import { mapConfig } from '../features/map/mapConfig.js'
import { MY_LOCATION, RouteEndpoints } from '../features/route/RouteEndpoints.jsx'
import { OriginStatus, myLocationNote, originNeedsAttention } from '../features/route/OriginStatus.jsx'
import { RouteSummary, RouteSteps } from '../features/route/RouteSummary.jsx'
import { RouteOptions } from '../features/route/RouteOptions.jsx'
import { useRoutePreview } from '../features/route/useRoutePreview.js'
import { nearestPlace } from '../features/discovery/proximity.js'
import { endpointCoords, isWalkingRoute } from '../features/navigation/routing/routeTypes.js'
import { externalWalkingUrl } from '../features/navigation/routing/routeNormalizer.js'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { useBackNavigation } from '../hooks/useBackNavigation.js'
import { useIsDesktop } from '../hooks/useMediaQuery.js'
import { PanelHeader } from '../ui/PanelHeader.jsx'
import { Button } from '../ui/Button.jsx'
import { formatDistance, formatDuration } from '../utils/geo.js'
import { EVENTS, track } from '../lib/analytics.js'

// Mobile peek: pickers, location status and the sticky Start bar (incl. the iPhone
// home-indicator inset) — the map keeps the rest.
const ROUTE_PEEK = 358
// Taller only while the location row asks the user to act (blocked, off campus…),
// so its "choose a starting point" action is never under the Start bar.
const ROUTE_PEEK_ATTENTION = 428

/**
 * /route?from=<id|me>&to=<id>[&alt=<n>] — route preview.
 * Without `from`, the start is the device's current location (as `from=me`);
 * `from=<id>` is a manually chosen campus place, always available instead.
 * Real Google walking route when available (alt = chosen alternative),
 * otherwise a clearly labelled direct-line estimate. Start hands the walk off
 * to Google Maps — there is no in-app turn-by-turn here.
 */
export default function RoutePreviewScreen() {
  const [params, setParams] = useSearchParams()
  const from = params.get('from') || MY_LOCATION
  const to = params.get('to') ?? ''
  const alt = Math.max(0, Number(params.get('alt')) || 0)
  const usingDevice = from === MY_LOCATION
  const { locations, getById } = useCampusData()
  const { origin, geo, mapOutlierIds } = useMapLayout()
  const { fitCoords, focusLocation } = useCampusMap()
  const isDesktop = useIsDesktop()
  const goBack = useBackNavigation()
  const originRef = useRef(null)

  // Places with an unverified (far off-campus) coordinate can't be routed.
  const place = (id) => {
    const loc = getById(Number(id))
    return loc && !mapOutlierIds.has(loc.id) ? { kind: 'place', location: loc } : null
  }

  const originEndpoint = useMemo(() => {
    if (usingDevice) return origin ? { kind: 'device', coords: origin } : null
    return place(from)
  }, [usingDevice, from, origin, getById, mapOutlierIds])

  const destination = useMemo(() => place(to), [to, getById, mapOutlierIds])
  const destinationLoc = getById(Number(to))

  // Current location is the default start: when the browser already allows
  // it, find it right away; otherwise OriginStatus offers a button (no
  // unprompted permission popup).
  const { locate } = geo
  useEffect(() => {
    if (usingDevice && geo.status === 'idle' && geo.permission === 'granted') locate()
  }, [usingDevice, geo.status, geo.permission, locate])

  // "You're near …": closest verified campus place to the on-campus position.
  const routable = useMemo(() => locations.filter((l) => !mapOutlierIds.has(l.id)), [locations, mapOutlierIds])
  const near = useMemo(() => (usingDevice && origin ? nearestPlace(routable, origin) : null), [usingDevice, origin, routable])

  const { status, result, retry } = useRoutePreview(originEndpoint, destination)
  const routes = result?.routes ?? []
  const selected = routes[alt] ? alt : 0
  const route = routes[selected] ?? null
  const walking = isWalkingRoute(route)

  const mapRoute = useMemo(() => {
    if (!route) return null
    return {
      geometry: { kind: walking ? 'walking-path' : 'direct-line', coordinates: route.path },
      alternatives: routes.filter((r, i) => i !== selected && isWalkingRoute(r)).map((r) => r.path),
      connectors: route.connectors,
      originMarker: route.origin.kind === 'place' ? route.origin.location.coords : null,
    }
  }, [route, routes, selected, walking])

  useMapView({
    selectedId: destinationLoc?.id ?? null,
    route: mapRoute,
    peekHeight: usingDevice && originNeedsAttention(geo, origin) ? ROUTE_PEEK_ATTENTION : ROUTE_PEEK,
    peekScroll: true,
    label: 'Route preview',
  })

  // Frame the whole route; with only a destination, focus it.
  useEffect(() => {
    if (route) fitCoords([...route.path, endpointCoords(route.origin), endpointCoords(route.destination)], { maxZoom: mapConfig.routeMaxZoom })
    else if (destinationLoc) focusLocation(destinationLoc.coords, { zoom: mapConfig.focusZoom })
  }, [route, destinationLoc?.id, fitCoords, focusLocation])

  function update(next) {
    setParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)),
      { replace: true },
    )
    // Switching the start to "My current location" is a deliberate tap: locate now.
    if (next.from === MY_LOCATION && from !== MY_LOCATION && (geo.status === 'idle' || geo.status === 'unavailable')) locate()
  }

  // Manual fallback: bring the user to the existing start picker.
  const chooseStart = useCallback(() => {
    const el = originRef.current
    if (!el) return
    el.focus()
    try {
      el.showPicker?.()
    } catch {
      /* not supported for selects in this browser: focus is enough */
    }
  }, [])

  // Start opens Google Maps. From the current location the link has no
  // origin, so Google Maps uses the live device position (never a stale fix);
  // from a manual start it names that place. It needs no route, so it works
  // while the preview loads, after a routing failure, and off campus.
  const manualStart = originEndpoint?.kind === 'place' ? originEndpoint.location.coords : null
  const startUrl = destination ? externalWalkingUrl(usingDevice ? null : manualStart, destination.location.coords) : null
  const startBlocker = destination ? null : 'Choose a destination to start.'

  const startButton = startUrl ? (
    <Button
      href={startUrl}
      target="_blank"
      rel="noreferrer"
      icon={Navigation}
      size="lg"
      className={isDesktop ? 'w-full' : 'min-w-0 flex-1'}
      onClick={() => track(EVENTS.NAVIGATION_REQUESTED, { placeId: destinationLoc?.id, detail: 'google_maps' })}
    >
      Start navigation
    </Button>
  ) : (
    <Button
      icon={Navigation}
      size="lg"
      className={isDesktop ? 'w-full' : 'min-w-0 flex-1'}
      disabled
      aria-describedby={startBlocker ? 'start-nav-hint' : undefined}
    >
      Start navigation
    </Button>
  )
  const hint = startBlocker && (
    <p id="start-nav-hint" className={isDesktop ? 'text-center text-micro text-fg-muted' : 'text-caption text-fg-secondary'}>
      {startBlocker}
    </p>
  )

  return (
    <div className="space-y-3 lg:space-y-4 lg:pb-6">
      <PanelHeader title="Route preview" onBack={goBack} />

      <RouteEndpoints
        locations={locations}
        from={from}
        to={to}
        myLocationNote={myLocationNote(geo, origin)}
        originRef={originRef}
        onChange={update}
        onSwap={() => update({ from: to, to: from })}
      />

      {usingDevice && <OriginStatus geo={geo} origin={origin} near={near} onLocate={locate} onChooseStart={chooseStart} />}

      {destinationLoc && !destination && (
        <p className="mx-4 rounded-field bg-accent-soft px-3 py-2.5 text-body-sm text-fg">
          This place's map position is being verified, so routes to it aren't available yet.
        </p>
      )}

      <RouteSummary
        status={status}
        result={result}
        route={route}
        destinationName={destinationLoc?.displayName}
        onRetry={retry}
        headline={isDesktop}
      />

      <RouteOptions routes={routes} selectedIndex={selected} onSelect={(i) => update({ from, to, alt: i ? String(i) : '' })} />

      {isDesktop && (
        <div className="space-y-2 px-4">
          {startButton}
          {hint}
        </div>
      )}

      {walking && <RouteSteps steps={route.steps} />}

      {/* Mobile: Start stays pinned to the bottom of the sheet (peeked or expanded), with the route's time beside it. */}
      {!isDesktop && (
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {route ? (
            <div className="shrink-0" aria-live="polite">
              <p className="text-title text-fg">{formatDuration(route.durationSeconds)}</p>
              <p className="text-caption text-fg-secondary">
                {formatDistance(route.distanceMeters)} {walking ? 'walk' : 'direct'}
              </p>
            </div>
          ) : status === 'loading' ? (
            <p className="shrink-0 text-caption text-fg-secondary">Finding route…</p>
          ) : (
            hint
          )}
          {startButton}
        </div>
      )}
    </div>
  )
}
