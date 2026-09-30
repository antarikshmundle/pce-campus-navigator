import { useCallback, useEffect, useRef, useState } from 'react'
import { distanceMeters } from '../../utils/geo.js'
import { navConfig } from '../navigation/navConfig.js'
import { endpointCoords, routeService } from './routeService.js'

/**
 * RouteResult for the preview. A device origin moves continuously, so a new
 * route is only requested after it moves `previewOriginMoveMeters` from the
 * position the current route was requested for.
 *
 * status: idle (missing endpoint) | loading | ready
 * result: RouteResult (see routeTypes.js) | null
 * key:    routeService key of the request `result` belongs to
 */
export function useRoutePreview(origin, destination) {
  const [state, setState] = useState({ status: 'idle', result: null, key: null })
  const [attempt, setAttempt] = useState(0)
  const anchor = useRef(null)
  const forceFresh = useRef(false)

  let requestOrigin = origin
  if (origin?.kind === 'device') {
    const c = endpointCoords(origin)
    if (!anchor.current || distanceMeters(anchor.current, c) > navConfig.previewOriginMoveMeters) anchor.current = c
    requestOrigin = { kind: 'device', coords: anchor.current }
  } else {
    anchor.current = null
  }

  const key = origin && destination ? routeService.routeKey(requestOrigin, destination) : null
  const latest = useRef(null)
  latest.current = { origin: requestOrigin, destination }

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle', result: null, key: null })
      return undefined
    }
    let stale = false
    const { origin: o, destination: d } = latest.current
    const fresh = forceFresh.current
    forceFresh.current = false
    setState((s) => ({ ...s, status: 'loading' }))
    routeService.getRoutes({ origin: o, destination: d, fresh }).then((result) => {
      if (!stale) setState({ status: 'ready', result, key })
    })
    return () => {
      stale = true
    }
  }, [key, attempt])

  const retry = useCallback(() => {
    forceFresh.current = true
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry }
}
