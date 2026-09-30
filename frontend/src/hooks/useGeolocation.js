import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
// Live navigation: fresh fixes only, and a little more patience per fix.
const TRACKING_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }

const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/**
 * Continuous browser geolocation, started only by a deliberate `locate()`
 * or `track()` call so the permission prompt never appears unprompted.
 *
 * - locate(): start (or restart) the watch.
 * - track():  navigation mode — fresh high-accuracy fixes. Returns a release
 *             function; when the last tracker releases, the watch returns to
 *             what it was before (normal watch, or stopped and cleared).
 *
 * The watch pauses while the tab is hidden (battery) and stops when the
 * owning component unmounts.
 *
 * status:     idle | locating | ready | denied | unavailable
 * permission: granted | denied | prompt | unknown — read without prompting,
 *             so screens can explain a block before the user taps anything
 * position:   { lat, lng, accuracy, heading, speed, timestamp } | null
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('idle')
  const [tracking, setTracking] = useState(false)
  const [permission, setPermission] = useState('unknown')
  const watchId = useRef(null)
  const wanted = useRef(false)
  const trackers = useRef(0)
  const wantedBeforeTracking = useRef(false)

  const stopWatch = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const startWatch = useCallback(() => {
    if (watchId.current != null) return
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords
        setPosition({
          lat: c.latitude,
          lng: c.longitude,
          accuracy: c.accuracy,
          heading: Number.isFinite(c.heading) ? c.heading : null,
          speed: Number.isFinite(c.speed) ? c.speed : null,
          timestamp: pos.timestamp || Date.now(),
        })
        setStatus('ready')
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          wanted.current = false
          stopWatch()
          setPosition(null)
          setStatus('denied')
        } else {
          // A timeout/glitch after a good fix keeps the last known position
          // (callers can tell it's stale from `timestamp`).
          setStatus((s) => {
            if (s === 'ready') return s
            wanted.current = false
            stopWatch()
            return 'unavailable'
          })
        }
      },
      trackers.current > 0 ? TRACKING_OPTIONS : OPTIONS,
    )
  }, [stopWatch])

  const locate = useCallback(() => {
    if (!supported()) {
      setStatus('unavailable')
      return
    }
    wanted.current = true
    setStatus((s) => (s === 'ready' ? s : 'locating'))
    stopWatch()
    startWatch()
  }, [startWatch, stopWatch])

  const track = useCallback(() => {
    if (!supported()) {
      setStatus('unavailable')
      return () => {}
    }
    if (trackers.current === 0) wantedBeforeTracking.current = wanted.current
    trackers.current += 1
    setTracking(true)
    locate() // restarts the watch with TRACKING_OPTIONS

    let released = false
    return () => {
      if (released) return
      released = true
      trackers.current -= 1
      if (trackers.current > 0) return
      setTracking(false)
      stopWatch()
      if (wantedBeforeTracking.current && !document.hidden) {
        wanted.current = true
        startWatch() // back to the normal watch
      } else {
        wanted.current = wantedBeforeTracking.current
        if (!wanted.current) {
          setPosition(null)
          setStatus((s) => (s === 'denied' ? s : 'idle'))
        }
      }
    }
  }, [locate, startWatch, stopWatch])

  useEffect(() => {
    let status = null
    let cancelled = false
    const sync = () => !cancelled && setPermission(status.state)
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        status = s
        sync()
        s.addEventListener('change', sync)
      })
      .catch(() => {}) // unsupported: stays 'unknown'
    return () => {
      cancelled = true
      status?.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopWatch()
      else if (wanted.current) startWatch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopWatch()
    }
  }, [startWatch, stopWatch])

  return useMemo(
    () => ({ position, status, permission, locate, track, tracking, supported: supported() }),
    [position, status, permission, locate, track, tracking],
  )
}
