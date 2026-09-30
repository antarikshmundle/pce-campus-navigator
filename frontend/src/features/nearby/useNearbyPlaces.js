import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { distanceMeters } from '../../utils/geo.js'
import {
  byDistance,
  campusCenter,
  fetchLiveAround,
  nagpurPlaces,
  snapshotAround,
  withoutCampusDuplicates,
} from './nearbyService.js'

// Beyond this from PCE the user isn't in the area our data covers.
const LOCAL_RADIUS_M = 40000

/*
 * One-shot device location for Nearby: asked only when the user taps
 * "Use my location", never watched, kept in memory only (not stored).
 * Shared by the Nearby list and detail screens.
 */
let locationState = { status: 'idle', position: null } // idle | locating | ready | denied | unavailable
const subscribers = new Set()
const setLocationState = (next) => {
  locationState = next
  subscribers.forEach((fn) => fn())
}

export function locateOnce() {
  if (!('geolocation' in navigator)) {
    setLocationState({ status: 'unavailable', position: null })
    return
  }
  setLocationState({ ...locationState, status: 'locating' })
  navigator.geolocation.getCurrentPosition(
    (pos) => setLocationState({ status: 'ready', position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } }),
    (err) => setLocationState({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', position: null }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  )
}

export function useNearbyLocation() {
  return useSyncExternalStore(
    useCallback((fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    }, []),
    () => locationState,
  )
}

/**
 * Where distances are measured from: the user's position when known and
 * local, otherwise the PCE campus reference point.
 * { coords, kind: 'you' | 'pce', location, outOfArea }
 */
export function useNearbyReference(locations, outlierIds) {
  const location = useNearbyLocation()
  const pce = useMemo(() => campusCenter(locations, outlierIds), [locations, outlierIds])
  return useMemo(() => {
    const pos = location.status === 'ready' ? location.position : null
    const outOfArea = Boolean(pos && distanceMeters(pos, pce) > LOCAL_RADIUS_M)
    const you = pos && !outOfArea
    return { coords: you ? { lat: pos.lat, lng: pos.lng } : pce, kind: you ? 'you' : 'pce', location, outOfArea, pce }
  }, [location, pce])
}

/**
 * Off-campus places around the reference point + Nagpur attractions, each
 * with straight-line `meters`, nearest first. Distances are computed once
 * per reference / data change, not per render.
 *
 * around.source: 'snapshot' | 'live' | 'loading'; around.liveFailed when the
 * live provider was tried and failed (the snapshot is shown instead).
 */
export function useNearbyPlaces({ locations, reference }) {
  const [live, setLive] = useState({ key: null, places: null, failed: false })
  const refKey = reference.kind === 'you' ? `${reference.coords.lat.toFixed(3)},${reference.coords.lng.toFixed(3)}` : null

  useEffect(() => {
    if (!refKey) return undefined
    let cancelled = false
    setLive((s) => (s.key === refKey ? s : { key: refKey, places: null, failed: false }))
    fetchLiveAround(reference.coords)
      .then((places) => !cancelled && setLive({ key: refKey, places, failed: false }))
      .catch(() => !cancelled && setLive({ key: refKey, places: null, failed: true }))
    return () => {
      cancelled = true
    }
  }, [refKey])

  const liveHere = refKey && live.key === refKey ? live : null
  const source = liveHere?.places ? 'live' : refKey && !liveHere?.failed ? 'loading' : 'snapshot'
  const rawAround = liveHere?.places ?? snapshotAround()

  const around = useMemo(
    () => byDistance(withoutCampusDuplicates(rawAround, locations), reference.coords),
    [rawAround, locations, reference.coords],
  )
  const nagpur = useMemo(() => byDistance(nagpurPlaces(), reference.coords), [reference.coords])

  return { around, nagpur, source, liveFailed: Boolean(liveHere?.failed) }
}
