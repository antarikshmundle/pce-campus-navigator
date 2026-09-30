import { createContext, useContext, useMemo, useRef, useState } from 'react'

const MapContext = createContext(null)

const MAP_TYPE_KEY = 'pce.mapType'

// Per-device preference; storage can be unavailable (private mode, blocked).
// Also read/written by Profile, which lives outside the map screens.
export function readMapType() {
  try {
    return localStorage.getItem(MAP_TYPE_KEY) === 'satellite' ? 'satellite' : 'standard'
  } catch {
    return 'standard'
  }
}

export function writeMapType(mapType) {
  try {
    localStorage.setItem(MAP_TYPE_KEY, mapType)
  } catch {
    /* preference just won't persist */
  }
}

const INITIAL_STATE = {
  mode: 'loading', // loading | ready | fallback
  canZoomIn: true,
  canZoomOut: true,
  lastInteractionAt: 0, // when the user last dragged the map (navigation pauses follow)
}

/**
 * Hosts the camera controller for the single <CampusMap> below it.
 * Screens talk to the map only through useCampusMap(); whichever renderer
 * is active (Google Maps or schematic fallback) registers the implementation.
 */
export function CampusMapProvider({ children }) {
  const controllerRef = useRef(null)
  const [state, setState] = useState(() => ({ ...INITIAL_STATE, mapType: readMapType() }))

  // Stable identities: screens can list these in effect deps without
  // re-running on every zoom-state change.
  const controls = useMemo(() => {
    const call = (method) => (...args) => controllerRef.current?.[method](...args)
    return {
      /** Fly to a point: (coords, { zoom? }) */
      focusLocation: call('focus'),
      /** Fit several points: ([coords…], { maxZoom? }) */
      fitCoords: call('fitCoords'),
      /** Show the whole campus. */
      fitCampus: call('fitCampus'),
      /** Nearby: focus / fit anywhere in the area, not only on campus. */
      focusArea: call('focusArea'),
      fitArea: call('fitArea'),
      zoomIn: call('zoomIn'),
      zoomOut: call('zoomOut'),
      /** 'standard' | 'satellite' — camera, markers and screen state are kept. */
      setMapType(mapType) {
        setState((s) => ({ ...s, mapType }))
        writeMapType(mapType)
      },
    }
  }, [])

  const registry = useMemo(
    () => ({
      register: (controller) => {
        controllerRef.current = controller
      },
      setState,
    }),
    [],
  )

  const value = useMemo(() => ({ state, controls, registry }), [state, controls, registry])

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}

function useMapContext() {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('Map hooks must be used inside <CampusMapProvider>')
  return ctx
}

/** Controller abstraction for screens: camera actions + map status. */
export function useCampusMap() {
  const { state, controls } = useMapContext()
  return useMemo(() => ({ ...controls, ...state }), [controls, state])
}

/** Internal: used by <CampusMap> to plug in the active renderer. */
export function useCampusMapRegistry() {
  return useMapContext().registry
}
