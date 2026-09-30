import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LoaderCircle, LocateFixed, LocateOff, MapPinOff, RotateCw, RouteOff, SignalZero } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { splitPath } from '../features/navigation/progress/routeProgress.js'
import { ROUTE_FAILURE } from '../features/navigation/routing/routeTypes.js'
import { useNavigationSession } from '../features/navigation/useNavigationSession.js'
import { useNavigationCamera } from '../features/navigation/useNavigationCamera.js'
import { useVoiceGuidance } from '../features/navigation/voice/useVoiceGuidance.js'
import { useNavigationAnnouncements } from '../features/navigation/voice/useNavigationAnnouncements.js'
import { GuidanceBanner, GuidanceCard } from '../features/navigation/ui/GuidanceCard.jsx'
import { NavHeader } from '../features/navigation/ui/NavHeader.jsx'
import { ArrivalCard, NavStatusCard, externalLinkAction } from '../features/navigation/ui/NavStatusCard.jsx'
import { MY_LOCATION } from '../features/route/RouteEndpoints.jsx'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { useBackNavigation } from '../hooks/useBackNavigation.js'
import { useIsDesktop } from '../hooks/useMediaQuery.js'
import { layout } from '../design/tokens.js'
import { Button } from '../ui/Button.jsx'

// Desktop: header + card column on the left, map to its right.
const DESKTOP_COLUMN_RIGHT = layout.gutter + layout.desktopPanelWidth

const ROUTE_FAILURE_MESSAGE = {
  [ROUTE_FAILURE.NETWORK]: 'You seem to be offline. Check your connection and try again.',
  [ROUTE_FAILURE.TIMEOUT]: 'The route request took too long. Try again.',
  [ROUTE_FAILURE.NO_ROUTE]: 'Google has no walking route to this place from here.',
}
const ROUTE_FAILURE_DEFAULT = "Walking directions aren't available right now."

/** Google Maps directions from the device's own location (no origin = "here"). */
const externalUrl = (dest) =>
  dest && `https://www.google.com/maps/dir/?api=1&destination=${dest.coords.lat},${dest.coords.lng}&travelmode=walking`

/**
 * /navigate?from=<id|me>&to=<id>[&alt=<n>] — live walking navigation on the
 * shared map. Full-screen ("immersive" map view): compact header on top,
 * guidance card at the bottom (mobile) or top-left (desktop).
 */
export default function NavigationScreen() {
  const [params] = useSearchParams()
  const { status } = useCampusData()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  // Endpoints are resolved from the campus data; wait for it on deep links.
  if (status === 'loading') return <NavigationFrame destinationName="…" body={<LoadingBody label="Loading campus…" />} />
  return <NavigationSession key={`${from}→${to}`} from={from} to={to} alt={Math.max(0, Number(params.get('alt')) || 0)} />
}

function NavigationSession({ from, to, alt }) {
  const { getById } = useCampusData()
  const { geo, mapOutlierIds } = useMapLayout()
  const navigate = useNavigate()
  const { state } = useLocation()
  const exit = useBackNavigation(`/route?${new URLSearchParams({ ...(from && { from }), to })}`)

  const destinationLoc = getById(Number(to))
  const destination = useMemo(
    () => (destinationLoc && !mapOutlierIds.has(destinationLoc.id) ? { kind: 'place', location: destinationLoc } : null),
    [destinationLoc, mapOutlierIds],
  )
  // `from` = a place starts the route there; "me" or anything unknown starts from GPS.
  const originLoc = from && from !== MY_LOCATION ? getById(Number(from)) : null
  const origin = useMemo(
    () => (originLoc && !mapOutlierIds.has(originLoc.id) ? { kind: 'place', location: originLoc } : null),
    [originLoc, mapOutlierIds],
  )

  const session = useNavigationSession({ origin, destination, geo, routeKey: state?.routeKey ?? null, routeIndex: alt })
  const voice = useVoiceGuidance()
  const destinationName = destinationLoc?.displayName ?? 'Destination'
  useNavigationAnnouncements(session, destinationName, voice.say)

  const { phase, route, prepared, progress } = session
  const split = useMemo(() => (prepared && progress ? splitPath(prepared, progress) : null), [prepared, progress])

  const camera = useNavigationCamera({
    route,
    remainingPath: split?.remaining ?? route?.path,
    position: geo.position,
    arrived: phase === 'arrived',
    destinationCoords: destinationLoc?.coords,
  })

  const mapRoute = useMemo(() => {
    if (!route || phase === 'arrived') return null
    return {
      geometry: { kind: 'walking-path', coordinates: split?.remaining ?? route.path },
      traveled: split?.traveled ?? null,
      connectors: route.connectors,
    }
  }, [route, split, phase])

  // --- Status line + body for the current phase
  const retry = { label: 'Try again', icon: RotateCw, variant: 'dark' }
  const leave = { label: 'Exit navigation', variant: 'ghost', onClick: exit }
  const link = externalLinkAction(externalUrl(destinationLoc))
  let status = null
  let body

  switch (phase) {
    case 'invalid':
      body = (
        <NavStatusCard
          icon={MapPinOff}
          title="Destination unavailable"
          message={
            destinationLoc
              ? "This place's map position is being verified, so walking directions aren't available yet."
              : "This place couldn't be found. It may have been removed."
          }
          actions={[{ ...leave, variant: 'dark' }]}
        />
      )
      break
    case 'gps-denied':
      status = { tone: 'error', label: 'No location' }
      body = (
        <NavStatusCard
          icon={LocateOff}
          title="Location access is blocked"
          message="Navigation needs your location. Allow location for this site in your browser settings, then try again."
          actions={[{ ...retry, onClick: session.retryGps }, link, leave].filter(Boolean)}
        />
      )
      break
    case 'gps-unavailable':
      status = { tone: 'error', label: 'No GPS' }
      body = (
        <NavStatusCard
          icon={LocateOff}
          title="Couldn't find your location"
          message={geo.supported ? 'Check that location services are on, then try again.' : "This browser can't share its location."}
          actions={[geo.supported && { ...retry, onClick: session.retryGps }, link, leave].filter(Boolean)}
        />
      )
      break
    case 'loading-route':
      status = { tone: 'idle', label: 'Routing…' }
      body = <LoadingBody label="Finding a walking route…" />
      break
    case 'route-unavailable':
      status = { tone: 'error', label: 'No route' }
      body = (
        <NavStatusCard
          icon={RouteOff}
          title="Walking route unavailable"
          message={ROUTE_FAILURE_MESSAGE[session.failure] ?? ROUTE_FAILURE_DEFAULT}
          actions={[{ ...retry, onClick: session.retryRoute }, link, leave].filter(Boolean)}
        />
      )
      break
    case 'arrived':
      status = { tone: 'ok', label: 'Arrived' }
      body = destinationLoc && <ArrivalCard destination={destinationLoc} onDone={() => navigate(`/place/${to}`, { replace: true })} />
      break
    default: {
      // waiting-gps | navigating
      const waiting = phase === 'waiting-gps'
      let banner = null
      if (waiting && !route) {
        status = { tone: 'idle', label: 'Locating…' }
        body = <LoadingBody label="Waiting for your location…" />
        break
      }
      if (waiting) {
        status = { tone: 'idle', label: 'Locating…' }
        banner = (
          <GuidanceBanner tone="info" icon={LocateFixed} title="Waiting for your location…">
            Guidance starts with the first GPS fix.
          </GuidanceBanner>
        )
      } else if (session.signalLost) {
        status = { tone: 'warn', label: 'GPS lost' }
        banner = (
          <GuidanceBanner icon={SignalZero} title="GPS signal lost">
            Showing your last known position.
          </GuidanceBanner>
        )
      } else if (session.offRoute) {
        status = { tone: 'warn', label: session.rerouting ? 'Rerouting…' : 'Off route' }
        let detail = 'A new route will be found shortly.'
        if (session.rerouting) detail = 'Finding a new route…'
        else if (session.farFromRoute) detail = "You're far from this route. Head back towards campus."
        else if (session.rerouteFailed) detail = "Couldn't update the route. Head back to the line."
        banner = <GuidanceBanner title="You're off route">{detail}</GuidanceBanner>
      } else {
        status = { tone: 'ok', label: 'On route' }
      }
      body = <GuidanceCard session={session} waiting={waiting} voice={voice} onOverview={camera.overview} banner={banner} />
    }
  }

  const canFollow = Boolean(geo.position) && phase !== 'arrived'
  return (
    <NavigationFrame
      destinationName={destinationName}
      status={status}
      onExit={exit}
      body={body}
      mapView={{
        selectedId: destinationLoc?.id ?? null,
        route: mapRoute,
        userLocation: phase === 'arrived' ? null : geo.position,
        onLocate: camera.recenter,
      }}
      recenter={canFollow && !camera.following ? camera.recenter : null}
    />
  )
}

function LoadingBody({ label }) {
  return <NavStatusCard icon={LoaderCircle} busy title={label} />
}

/**
 * Layout for the immersive navigation UI. Measures what it covers so the map
 * keeps the route and position in the visible area.
 */
function NavigationFrame({ destinationName, status, onExit, body, mapView = {}, recenter }) {
  const isDesktop = useIsDesktop()
  const fallbackExit = useBackNavigation('/')
  const headerRef = useRef(null)
  const cardRef = useRef(null)
  const [box, setBox] = useState({ top: 0, card: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      const header = headerRef.current
      const card = cardRef.current
      const parent = header?.offsetParent
      const top = parent ? header.getBoundingClientRect().bottom - parent.getBoundingClientRect().top : 0
      setBox((b) => {
        const next = { top: Math.round(top), card: card ? Math.round(card.offsetHeight) : 0 }
        return next.top === b.top && next.card === b.card ? b : next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (headerRef.current) ro.observe(headerRef.current)
    if (cardRef.current) ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [isDesktop])

  const overlayInsets = useMemo(
    () => ({ top: isDesktop ? 0 : box.top, left: isDesktop ? DESKTOP_COLUMN_RIGHT : 0 }),
    [isDesktop, box.top],
  )
  const onLocate = useCallback(() => mapView.onLocate?.(), [mapView.onLocate])

  useMapView({
    selectedId: mapView.selectedId ?? null,
    route: mapView.route ?? null,
    peekHeight: isDesktop ? 0 : box.card,
    label: 'Navigation',
    chrome: 'immersive',
    userLocation: mapView.userLocation ?? null,
    overlayInsets,
    onLocate,
  })

  const header = (
    <div ref={headerRef} className="pointer-events-auto">
      <NavHeader destinationName={destinationName} status={status} onExit={onExit ?? fallbackExit} />
    </div>
  )
  const recenterButton = recenter && (
    <Button variant="dark" size="md" icon={LocateFixed} onClick={recenter} className="pointer-events-auto shadow-float">
      Recenter
    </Button>
  )

  if (isDesktop) {
    return (
      <>
        <div className="absolute bottom-4 left-4 top-4 flex w-panel flex-col gap-3">
          {header}
          <div
            ref={cardRef}
            className="pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-sheet bg-surface p-4 shadow-float"
          >
            {body}
          </div>
        </div>
        {recenterButton && (
          <div className="absolute bottom-6 flex justify-center" style={{ left: DESKTOP_COLUMN_RIGHT + layout.gutter, right: 80 }}>
            {recenterButton}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))]">{header}</div>
      {recenterButton && (
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: box.card + 16 }}>
          {recenterButton}
        </div>
      )}
      <div
        ref={cardRef}
        className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto overscroll-contain rounded-t-sheet bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-sheet"
      >
        {body}
      </div>
    </>
  )
}
