import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExternalLink, LocateFixed, Navigation } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { useCampusMap } from '../features/map/MapProvider.jsx'
import { mapConfig } from '../features/map/mapConfig.js'
import { MY_LOCATION, RouteEndpoints } from '../features/route/RouteEndpoints.jsx'
import { RouteSummary, RouteSteps } from '../features/route/RouteSummary.jsx'
import { RouteOptions } from '../features/route/RouteOptions.jsx'
import { useRoutePreview } from '../features/route/useRoutePreview.js'
import { endpointCoords, isWalkingRoute } from '../features/navigation/routing/routeTypes.js'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { useBackNavigation } from '../hooks/useBackNavigation.js'
import { PanelHeader } from '../ui/PanelHeader.jsx'
import { Button } from '../ui/Button.jsx'
import { EVENTS, track } from '../lib/analytics.js'

const ROUTE_PEEK = 340

/**
 * /route?from=<id|me>&to=<id>[&alt=<n>] — route preview.
 * Real Google walking route when available (alt = chosen alternative),
 * otherwise a clearly labelled direct-line estimate. Start → /navigate.
 */
export default function RoutePreviewScreen() {
  const [params, setParams] = useSearchParams()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const alt = Math.max(0, Number(params.get('alt')) || 0)
  const { locations, getById } = useCampusData()
  const { origin, geo, mapOutlierIds } = useMapLayout()
  const { fitCoords, focusLocation } = useCampusMap()
  const navigate = useNavigate()
  const goBack = useBackNavigation()

  // Places with an unverified (far off-campus) coordinate can't be routed.
  const place = (id) => {
    const loc = getById(Number(id))
    return loc && !mapOutlierIds.has(loc.id) ? { kind: 'place', location: loc } : null
  }

  const originEndpoint = useMemo(() => {
    if (from === MY_LOCATION) return origin ? { kind: 'device', coords: origin } : null
    return place(from)
  }, [from, origin, getById, mapOutlierIds])

  const destination = useMemo(() => place(to), [to, getById, mapOutlierIds])
  const destinationLoc = getById(Number(to))

  const { status, result, key, retry } = useRoutePreview(originEndpoint, destination)
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
    peekHeight: ROUTE_PEEK,
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
  }

  const needsLocation = from === MY_LOCATION && !origin

  // Start needs a real walking route, a destination and usable device location.
  let startBlocker = null
  if (!destination) startBlocker = 'Choose a destination to start.'
  else if (!route || status === 'loading') startBlocker = null
  else if (!walking) startBlocker = 'Live navigation needs a walking route. Use Google Maps instead.'
  if (!geo.supported) startBlocker = "Your browser can't share its location, so live navigation isn't available."
  else if (geo.status === 'denied' || geo.permission === 'denied') {
    startBlocker = 'Allow location access in your browser settings to start navigation.'
  }
  const canStart = Boolean(destination && walking && status === 'ready' && !startBlocker)

  function start() {
    const query = new URLSearchParams({ ...(from && { from }), to, ...(selected && { alt: String(selected) }) })
    track(EVENTS.NAVIGATION_REQUESTED, { placeId: destinationLoc?.id, detail: 'in_app' })
    navigate(`/navigate?${query}`, { state: { routeKey: key } })
  }

  return (
    <div className="space-y-4 pb-6">
      <PanelHeader title="Route preview" onBack={goBack} />

      <RouteEndpoints
        locations={locations}
        from={from}
        to={to}
        canUseMyLocation={Boolean(origin)}
        onChange={update}
        onSwap={() => update({ from: to, to: from })}
      />

      {needsLocation && (
        <div className="mx-4 flex items-center justify-between gap-3 rounded-field bg-surface-alt px-3 py-2.5">
          <p className="text-body-sm text-fg-secondary">
            {geo.status === 'ready' ? "You're not on campus — pick a starting place." : 'Your location is needed as the start.'}
          </p>
          {geo.status !== 'ready' && (
            <Button size="sm" variant="secondary" icon={LocateFixed} onClick={geo.locate} disabled={geo.status === 'locating'}>
              {geo.status === 'locating' ? 'Locating…' : 'Locate'}
            </Button>
          )}
        </div>
      )}

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
      />

      <RouteOptions routes={routes} selectedIndex={selected} onSelect={(i) => update({ from, to, alt: i ? String(i) : '' })} />

      <div className="space-y-2 px-4">
        <Button
          icon={Navigation}
          size="lg"
          className="w-full"
          disabled={!canStart}
          onClick={start}
          aria-describedby={startBlocker ? 'start-nav-hint' : undefined}
        >
          Start navigation
        </Button>
        {startBlocker && (
          <p id="start-nav-hint" className="text-center text-micro text-fg-muted">
            {startBlocker}
          </p>
        )}
        {route?.externalUrl && (
          <Button
            href={route.externalUrl}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            size="md"
            icon={ExternalLink}
            className="w-full text-fg-secondary"
            onClick={() => track(EVENTS.NAVIGATION_REQUESTED, { placeId: destinationLoc?.id, detail: 'google_maps' })}
          >
            Open in Google Maps
          </Button>
        )}
      </div>

      {walking && <RouteSteps steps={route.steps} />}
    </div>
  )
}
