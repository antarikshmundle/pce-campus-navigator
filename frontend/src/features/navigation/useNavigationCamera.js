import { useCallback, useEffect, useRef, useState } from 'react'
import { useCampusMap } from '../map/MapProvider.jsx'
import { mapConfig } from '../map/mapConfig.js'
import { navConfig } from './navConfig.js'

const plain = (p) => ({ lat: p.lat, lng: p.lng })

/**
 * Camera during navigation, through the map abstraction only.
 * - follow (default): keeps the current position centred as fixes arrive
 * - dragging the map pauses follow; recenter() resumes it
 * - overview(): frames what's left of the route
 * - a new route (start / reroute) without a fix is framed as a whole
 */
export function useNavigationCamera({ route, remainingPath, position, arrived, destinationCoords }) {
  const { focusLocation, fitCoords, lastInteractionAt } = useCampusMap()
  const [following, setFollowing] = useState(true)
  const followSince = useRef(Date.now())

  useEffect(() => {
    if (lastInteractionAt > followSince.current) setFollowing(false)
  }, [lastInteractionAt])

  const latest = useRef({})
  latest.current = { position, remainingPath, destinationCoords }

  const frameRoute = useCallback(() => {
    const { position: p, remainingPath: path, destinationCoords: dest } = latest.current
    const coords = [...(path ?? []), ...(p ? [plain(p)] : []), ...(dest ? [dest] : [])]
    if (coords.length) fitCoords(coords, { maxZoom: mapConfig.routeMaxZoom })
  }, [fitCoords])

  useEffect(() => {
    if (route && (!latest.current.position || !following)) frameRoute()
    // Only when the route itself changes.
  }, [route])

  const lat = position?.lat
  const lng = position?.lng
  useEffect(() => {
    if (following && !arrived && lat != null) focusLocation({ lat, lng }, { zoom: navConfig.followZoom })
  }, [following, arrived, lat, lng, focusLocation])

  useEffect(() => {
    if (arrived && destinationCoords) focusLocation(destinationCoords, { zoom: mapConfig.focusZoom })
  }, [arrived])

  const recenter = useCallback(() => {
    followSince.current = Date.now()
    setFollowing(true)
    const p = latest.current.position
    if (p) focusLocation(plain(p), { zoom: navConfig.followZoom })
  }, [focusLocation])

  const overview = useCallback(() => {
    setFollowing(false)
    frameRoute()
  }, [frameRoute])

  return { following, recenter, overview }
}
