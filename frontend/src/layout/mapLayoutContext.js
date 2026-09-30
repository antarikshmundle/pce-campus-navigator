import { createContext, useContext, useEffect } from 'react'
import { layout } from '../design/tokens.js'

export const MapLayoutContext = createContext(null)

/**
 * What the shared map shows for the active map screen.
 *
 * chrome: 'panel'     the screen renders into the bottom sheet / desktop panel
 *         'immersive' the screen draws its own floating UI over a full map
 *                     (live navigation). Then also:
 *   userLocation   position to draw instead of the on-campus location
 *   overlayInsets  { top, left } px covered by the screen's floating UI
 *   onLocate       what the locate control does
 * peekHeight: mobile px below the map (sheet peek, or the immersive bottom card)
 *
 * Nearby: externalPlaces / selectedExternalKey (off-campus layer) and
 * scope 'area' (wider pan/zoom limits). userLocation, when set on a panel
 * screen, replaces the on-campus location dot.
 */
export const DEFAULT_MAP_VIEW = {
  selectedId: null,
  visibleIds: null,
  route: null,
  peekHeight: layout.mobileSheetPeek,
  label: 'Places',
  chrome: 'panel',
  userLocation: null,
  overlayInsets: null,
  onLocate: null,
  externalPlaces: null,
  selectedExternalKey: null,
  scope: 'campus',
}

/**
 * Shared state for screens rendered inside <MapLayout>:
 * { setView, sheetSnap, setSheetSnap, showNotice, geo, origin, discovery, mapOutlierIds }
 * (`discovery` = useDiscoveryState: search, category, groups, recents;
 * `mapOutlierIds` = places whose stored coordinate is far off campus).
 */
export function useMapLayout() {
  const ctx = useContext(MapLayoutContext)
  if (!ctx) throw new Error('useMapLayout must be used inside <MapLayout>')
  return ctx
}

/**
 * Declare what the map should display while this screen is mounted.
 * Pass memoized values — each change re-applies the view.
 */
export function useMapView({
  selectedId = null,
  visibleIds = null,
  route = null,
  peekHeight,
  label,
  chrome = 'panel',
  userLocation = null,
  overlayInsets = null,
  onLocate = null,
  externalPlaces = null,
  selectedExternalKey = null,
  scope = 'campus',
}) {
  const { setView } = useMapLayout()
  useEffect(() => {
    setView({
      selectedId,
      visibleIds,
      route,
      peekHeight: peekHeight ?? DEFAULT_MAP_VIEW.peekHeight,
      label: label ?? DEFAULT_MAP_VIEW.label,
      chrome,
      userLocation,
      overlayInsets,
      onLocate,
      externalPlaces,
      selectedExternalKey,
      scope,
    })
  }, [setView, selectedId, visibleIds, route, peekHeight, label, chrome, userLocation, overlayInsets, onLocate, externalPlaces, selectedExternalKey, scope])
}
