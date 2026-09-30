import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { distanceMeters } from '../../utils/geo.js'
import { routeService } from '../route/routeService.js'
import { navConfig as C } from './navConfig.js'
import { computeProgress, prepareRoute } from './progress/routeProgress.js'
import { endpointCoords, isWalkingRoute } from './routing/routeTypes.js'

const plain = (p) => ({ lat: p.lat, lng: p.lng })

function cachedRoute(routeKey, routeIndex, destination) {
  const cached = routeKey ? routeService.getCached(routeKey) : null
  if (cached?.status !== 'ok' || !destination) return null
  const route = cached.routes[routeIndex] ?? cached.routes[0]
  return isWalkingRoute(route) && route.destination.location?.id === destination.location.id ? route : null
}

/**
 * State of one live-navigation trip.
 *
 * - origin       place Endpoint for the first route, or null to start from the first GPS fix
 * - destination  place Endpoint, or null when it's unknown / unusable
 * - geo          the shared useGeolocation() instance
 * - routeKey     Route Preview's request key: its cached route is reused if still fresh
 * - routeIndex   which of the preview's routes was chosen
 *
 * GPS is tracked from mount until arrival or unmount. Routes are requested
 * once at start and then only by rerouting, which is debounced and rate
 * limited (see navConfig) — never on every GPS update.
 *
 * phase: invalid | gps-denied | gps-unavailable | loading-route | route-unavailable
 *        | waiting-gps | navigating | arrived
 */
export function useNavigationSession({ origin, destination, geo, routeKey = null, routeIndex = 0 }) {
  const [route, setRoute] = useState(() => cachedRoute(routeKey, routeIndex, destination))
  const [routeState, setRouteState] = useState(() => (route ? 'ready' : 'loading')) // loading | ready | failed | invalid
  const [failure, setFailure] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState(null)
  const [arrived, setArrived] = useState(false)
  const [offRoute, setOffRoute] = useState(false)
  const [farFromRoute, setFarFromRoute] = useState(false)
  const [rerouting, setRerouting] = useState(false)
  const [rerouteFailed, setRerouteFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const { position } = geo
  const positionRef = useRef(position)
  positionRef.current = position
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true // StrictMode re-mounts
    return () => {
      mounted.current = false
    }
  }, [])

  // --- GPS: high-accuracy tracking for the whole trip.
  const releaseGps = useRef(null)
  const { track } = geo
  useEffect(() => {
    releaseGps.current = track()
    return () => {
      releaseGps.current?.()
      releaseGps.current = null
    }
  }, [track])
  const retryGps = useCallback(() => {
    releaseGps.current?.()
    releaseGps.current = track()
  }, [track])

  // --- First route (unless the preview's cached one was reused).
  const needsFix = !origin && !position
  const originId = origin?.location.id ?? null
  const destinationId = destination?.location.id ?? null
  useEffect(() => {
    if (route) return undefined
    if (!destination) {
      setRouteState('invalid')
      return undefined
    }
    if (!origin && !positionRef.current) return undefined // start from GPS: wait for the first fix
    let stale = false
    const from = origin ?? { kind: 'device', coords: plain(positionRef.current) }
    setRouteState('loading')
    routeService.getRoutes({ origin: from, destination, alternatives: false, fresh: attempt > 0 }).then((result) => {
      if (stale) return
      if (result.status === 'ok') {
        setRoute(result.routes[0])
        setRouteState('ready')
      } else {
        setFailure(result.failure)
        setRouteState(result.status === 'invalid' ? 'invalid' : 'failed')
      }
    })
    return () => {
      stale = true
    }
    // Endpoints are identified by id; `needsFix` releases the wait for a GPS start.
  }, [route, originId, destinationId, needsFix, attempt])

  const retryRoute = useCallback(() => {
    setFailure(null)
    setRouteState('loading')
    setAttempt((n) => n + 1)
  }, [])

  const prepared = useMemo(() => (route ? prepareRoute(route) : null), [route])

  // --- Progress, arrival, off-route and rerouting — once per GPS fix.
  const hint = useRef(null)
  const reroute = useRef({ offSince: null, lastAt: 0, lastFrom: null, count: 0, inFlight: false })

  useEffect(() => {
    hint.current = null
    reroute.current.offSince = null
    setOffRoute(false)
    setFarFromRoute(false)
  }, [prepared])

  useEffect(() => {
    if (!prepared || !position || arrived) return
    const pr = computeProgress(prepared, position, hint.current)
    hint.current = pr.offset
    setProgress(pr)

    // Poor fixes still move the dot, but decide nothing.
    if (position.accuracy > C.poorAccuracyMeters) return

    const dest = endpointCoords(destination)
    const toDestination = distanceMeters(position, dest)
    const endGap = prepared.route.gaps?.end ?? 0
    if (
      toDestination <= C.ARRIVAL_THRESHOLD_METERS ||
      (pr.remainingMeters <= C.ARRIVAL_THRESHOLD_METERS && toDestination <= C.ARRIVAL_THRESHOLD_METERS + endGap)
    ) {
      setArrived(true)
      return
    }

    const far = pr.distanceFromRoute > C.rerouteMaxDistanceMeters
    setFarFromRoute(far)
    const threshold = C.OFF_ROUTE_THRESHOLD_METERS + Math.min(position.accuracy ?? 0, C.offRouteAccuracyAllowanceMeters)
    const s = reroute.current
    if (pr.distanceFromRoute <= threshold) {
      s.offSince = null
      setOffRoute(false)
      setRerouteFailed(false)
      return
    }

    const t = Date.now()
    s.offSince ??= t
    if (t - s.offSince < C.offRouteConfirmMs) return // debounce GPS jitter
    setOffRoute(true)

    // Reroute only when every cost guard allows it.
    if (far || s.inFlight || s.count >= C.maxReroutesPerSession) return
    if (t - s.lastAt < C.minRerouteIntervalMs) return
    if (s.lastFrom && distanceMeters(s.lastFrom, position) < C.rerouteMinMovementMeters) return

    const from = plain(position)
    Object.assign(s, { inFlight: true, lastAt: t, lastFrom: from, count: s.count + 1 })
    setRerouting(true)
    routeService
      .getRoutes({ origin: { kind: 'device', coords: from }, destination, alternatives: false, fresh: true })
      .then((result) => {
        s.inFlight = false
        if (!mounted.current) return
        setRerouting(false)
        if (result.status === 'ok') {
          setRoute(result.routes[0])
          setRerouteFailed(false)
        } else {
          setRerouteFailed(true) // keep the old route on screen
        }
      })
  }, [position, prepared, arrived, destination])

  // Arrival ends the trip: stop GPS right away.
  useEffect(() => {
    if (!arrived) return
    releaseGps.current?.()
    releaseGps.current = null
  }, [arrived])

  // Notice when fixes stop arriving (signal lost, tab was hidden…).
  useEffect(() => {
    if (arrived) return undefined
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [arrived])

  let phase
  if (routeState === 'invalid') phase = 'invalid'
  else if (arrived) phase = 'arrived'
  else if (geo.status === 'denied') phase = 'gps-denied'
  else if (!geo.supported || (geo.status === 'unavailable' && !position)) phase = 'gps-unavailable'
  else if (routeState === 'failed') phase = 'route-unavailable'
  else if (!route) phase = !origin && !position ? 'waiting-gps' : 'loading-route'
  else if (!position || !progress) phase = 'waiting-gps'
  else phase = 'navigating'

  // What to do next: Google's next step, or arriving at the destination.
  const endGap = route?.connectors?.length && route.gaps.end > C.connectorMinGapMeters ? route.gaps.end : 0
  const upcoming = useMemo(() => {
    if (!route) return null
    const stepIndex = progress?.stepIndex ?? 0
    const remaining = (progress ? progress.remainingMeters : route.distanceMeters) + endGap
    const next = route.steps[stepIndex + 1]
    if (next) {
      const distance = progress ? progress.distanceToManeuver : (route.steps[0]?.distanceMeters ?? remaining)
      return { kind: 'step', index: stepIndex + 1, instruction: next.instruction, maneuver: next.maneuver, distanceMeters: distance }
    }
    const name = destination?.location.displayName ?? 'your destination'
    return { kind: 'arrive', index: route.steps.length, instruction: `Arrive at ${name}`, maneuver: 'ARRIVE', distanceMeters: remaining }
  }, [route, progress, endGap, destination])

  return {
    phase,
    route,
    prepared,
    progress,
    upcoming,
    currentStep: route?.steps[progress?.stepIndex ?? 0] ?? null,
    remainingMeters: route ? (progress ? progress.remainingMeters : route.distanceMeters) + endGap : null,
    remainingSeconds: route ? (progress ? progress.remainingSeconds : route.durationSeconds) : null,
    offRoute,
    farFromRoute,
    rerouting,
    rerouteFailed,
    weakSignal: Boolean(position && position.accuracy > C.poorAccuracyMeters),
    signalLost: Boolean(position && !arrived && now - position.timestamp > C.staleFixMs),
    failure,
    retryRoute,
    retryGps,
  }
}
