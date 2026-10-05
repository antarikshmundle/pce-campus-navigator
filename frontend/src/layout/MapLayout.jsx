import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { CampusMap } from '../features/map/CampusMap.jsx'
import { CampusMapProvider, useCampusMap } from '../features/map/MapProvider.jsx'
import { MapControls } from '../features/map/MapControls.jsx'
import { MapTypeToggle } from '../features/map/MapTypeToggle.jsx'
import { analyzeCampus } from '../features/map/geojson.js'
import { mapConfig } from '../features/map/mapConfig.js'
import { SearchBar } from '../features/search/SearchBar.jsx'
import { CategoryChips } from '../features/search/CategoryChips.jsx'
import { SEARCH_LISTBOX_ID, searchOptionId } from '../features/search/SearchResults.jsx'
import { useDiscoveryState } from '../features/discovery/useDiscoveryState.js'
import { AssistantFab } from '../features/assistant/AssistantFab.jsx'
import { CampusAssistant } from '../features/assistant/CampusAssistant.jsx'
import { useCampusAssistant } from '../features/assistant/useCampusAssistant.js'
import { BottomSheet } from '../ui/BottomSheet.jsx'
import { Notice } from '../ui/Notice.jsx'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { useIsDesktop, useIsPhone } from '../hooks/useMediaQuery.js'
import { distanceMeters } from '../utils/geo.js'
import { layout } from '../design/tokens.js'
import { DEFAULT_MAP_VIEW, MapLayoutContext } from './mapLayoutContext.js'

// Further than this from every known location = treat the user as off campus.
const ON_CAMPUS_RADIUS_M = 1500
// Width of the right-hand control column (44px buttons + gutters).
const CONTROLS_INSET = 64
const MOBILE_TOP_COMPACT = layout.gutter

const DESKTOP_INSETS = {
  top: layout.gutter,
  right: CONTROLS_INSET + layout.gutter,
  bottom: layout.gutter,
  left: layout.desktopMapLeft,
}

const OFF_CAMPUS = "You're not on campus — your location and distances appear once you are."

const FALLBACK_NOTICE = {
  'missing-key': 'The live map isn’t set up yet — showing the campus view.',
  auth: 'The live map is unavailable — showing the campus view.',
}
const FALLBACK_NOTICE_DEFAULT = "Couldn't load the map — showing the offline campus view."

/**
 * Persistent map frame for Explore, Location Detail, Route Preview and
 * Navigation.
 * One map instance survives navigation between them; each screen renders
 * into the panel (mobile bottom sheet / desktop floating card) and declares
 * what the map shows via useMapView().
 *
 * Mobile: the map ends where the peeked sheet begins, so the Google logo and
 * terms (which must stay visible) are never covered.
 *
 * Immersive screens (view.chrome === 'immersive', i.e. live navigation) get
 * no sheet/panel: they render their own floating UI in a layer over the map.
 */
export default function MapLayout() {
  return (
    <CampusMapProvider>
      <MapLayoutFrame />
    </CampusMapProvider>
  )
}

function MapLayoutFrame() {
  const { locations, categories, status: dataStatus, reload: reloadData } = useCampusData()
  const map = useCampusMap()
  const isDesktop = useIsDesktop()
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isExplore = Boolean(useMatch({ path: '/', end: true }))
  const isRoutePreview = Boolean(useMatch('/route'))
  const geo = useGeolocation()

  const [view, setView] = useState(DEFAULT_MAP_VIEW)
  const immersive = view.chrome === 'immersive'
  const [sheetSnap, setSheetSnap] = useState('peek')
  const [notice, setNotice] = useState(null)

  const searchInputRef = useRef(null)
  const asideRef = useRef(null)

  const showNotice = useCallback((text) => setNotice({ id: Date.now(), text }), [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  // Each screen starts with its sheet at peek, scrolled to the top.
  useEffect(() => {
    setSheetSnap('peek')
    if (asideRef.current) asideRef.current.scrollTop = 0
  }, [pathname])

  // --- Location: only used when the device is actually on campus.
  const origin = useMemo(() => {
    if (!geo.position || !locations.length) return null
    const nearest = Math.min(...locations.map((l) => distanceMeters(geo.position, l.coords)))
    return nearest <= ON_CAMPUS_RADIUS_M ? geo.position : null
  }, [geo.position, locations])

  // Places whose stored coordinate is far off campus (likely a data-entry
  // error, e.g. a longitude typed as the latitude). Kept as-is in the data.
  const mapOutlierIds = useMemo(() => analyzeCampus(locations).outlierIds, [locations])

  // Campus AI: one session per visit, shared by every map screen.
  const assistant = useCampusAssistant({ locations, dataStatus, reloadData, origin, geo })
  const assistantFabRef = useRef(null)

  // Discovery (search, category, groups, recents) — one owner, survives
  // a round trip to place detail. The selected place lives in the URL.
  const discovery = useDiscoveryState(locations, origin)

  // Category change → frame the matching places; clearing it → whole campus.
  // (Typing never moves the camera; it only dims non-matching markers.)
  const prevCategory = useRef(discovery.category)
  useEffect(() => {
    if (prevCategory.current === discovery.category) return
    prevCategory.current = discovery.category
    if (!discovery.category) {
      map.fitCampus()
      return
    }
    const coords = discovery.places.map((l) => l.coords)
    if (coords.length === 1) map.focusLocation(coords[0], { zoom: mapConfig.areaZoom })
    else if (coords.length > 1) map.fitCoords(coords, { maxZoom: mapConfig.areaZoom })
  }, [discovery.category, discovery.places, map.fitCampus, map.fitCoords, map.focusLocation])

  // React to locate outcomes once per transition (position updates only move the dot).
  // Navigation owns its own GPS messaging and camera while it tracks; Route
  // Preview explains location state inline and frames the route itself.
  const prevGeoStatus = useRef(geo.status)
  useEffect(() => {
    const prev = prevGeoStatus.current
    prevGeoStatus.current = geo.status
    if (prev === geo.status || geo.tracking || isRoutePreview) return
    if (geo.status === 'denied') showNotice('Location access is blocked. Allow it in your browser settings.')
    else if (geo.status === 'unavailable') showNotice("Couldn't determine your location. Tap to retry.")
    else if (geo.status === 'ready') {
      if (origin) map.focusLocation(origin, { zoom: mapConfig.areaZoom })
      else showNotice(OFF_CAMPUS)
    }
  }, [geo.status, geo.tracking, isRoutePreview, origin, map.focusLocation, showNotice])

  function handleLocate() {
    if (immersive && view.onLocate) view.onLocate()
    else if (geo.status === 'denied') showNotice('Location access is blocked. Allow it in your browser settings.')
    else if (geo.status === 'ready') {
      if (origin) map.focusLocation(origin, { zoom: mapConfig.areaZoom })
      else showNotice(OFF_CAMPUS)
    } else geo.locate()
  }

  // --- Map events
  const { openPlace, openGroup: showGroup } = discovery
  const openGroup = useCallback(
    (ids) => {
      showGroup(ids)
      if (!isExplore) navigate('/')
    },
    [showGroup, isExplore, navigate],
  )
  const openExternal = useCallback((key) => navigate(`/nearby/place/${encodeURIComponent(key)}`), [navigate])
  const handleFallback = useCallback(
    (reason) => showNotice(FALLBACK_NOTICE[reason] ?? FALLBACK_NOTICE_DEFAULT),
    [showNotice],
  )
  const { setMapType } = map
  const handleMapTypeUnavailable = useCallback(
    (type) => {
      const other = type === 'satellite' ? 'standard' : 'satellite'
      showNotice(
        type === 'satellite'
          ? 'Satellite view is unavailable right now — showing the map.'
          : 'The map view is unavailable right now — showing satellite.',
      )
      setMapType(other)
    },
    [showNotice, setMapType],
  )

  // --- Search
  function handleQueryChange(text) {
    discovery.setQuery(text)
    if (text.trim()) setSheetSnap('expanded')
  }
  // Escape: text → clear + collapse; empty → dismiss keyboard / focus.
  function handleSearchEscape() {
    if (discovery.query) discovery.clearQuery()
    else searchInputRef.current?.blur()
    setSheetSnap('peek')
  }
  const activeResult = discovery.results[discovery.activeIndex]

  const context = useMemo(
    () => ({
      setView,
      sheetSnap,
      setSheetSnap,
      showNotice,
      geo,
      origin,
      discovery,
      mapOutlierIds,
    }),
    [sheetSnap, showNotice, geo, origin, discovery, mapOutlierIds],
  )

  // Height of the floating search + chips on mobile (more compact on phones).
  const topOverlay = isPhone ? layout.phoneTopOverlay : layout.mobileTopOverlay
  const overlay = view.overlayInsets ?? { top: 0, left: 0 }
  let insets
  if (immersive) {
    insets = isDesktop
      ? { top: layout.gutter, right: CONTROLS_INSET + layout.gutter, bottom: layout.gutter, left: overlay.left + layout.gutter }
      : { top: overlay.top + 8, right: CONTROLS_INSET, bottom: 0, left: 8 }
  } else {
    insets = isDesktop
      ? DESKTOP_INSETS
      : {
          top: isExplore ? topOverlay : MOBILE_TOP_COMPACT,
          right: CONTROLS_INSET,
          bottom: 0, // the map already ends above the peeked sheet
          left: 8,
        }
  }
  const mobileTop = `max(1rem, env(safe-area-inset-top))`
  const noticeTop = immersive
    ? `${overlay.top + 8}px`
    : `calc(max(1rem, env(safe-area-inset-top)) + ${isExplore ? topOverlay - 12 : 0}px)`

  return (
    <MapLayoutContext.Provider value={context}>
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 top-0" style={{ bottom: isDesktop ? 0 : view.peekHeight }}>
          <CampusMap
            className="absolute inset-0"
            locations={locations}
            selectedId={view.selectedId}
            visibleIds={view.visibleIds}
            route={view.route}
            userLocation={immersive ? view.userLocation : (view.userLocation ?? origin)}
            externalPlaces={view.externalPlaces}
            selectedExternalKey={view.selectedExternalKey}
            scope={view.scope}
            mapType={map.mapType}
            insets={insets}
            onSelect={openPlace}
            onSelectExternal={openExternal}
            onSelectGroup={openGroup}
            onFallback={handleFallback}
            onMapTypeUnavailable={handleMapTypeUnavailable}
          />
        </div>

        {/* Map | Satellite — not offered by the schematic fallback. Mobile: top-left,
            because the right-hand control column can reach the chips on short phones. */}
        {map.mode !== 'fallback' &&
          !(immersive && !isDesktop) &&
          (isDesktop ? (
            <MapTypeToggle value={map.mapType} onChange={map.setMapType} className="absolute right-4 top-4 z-overlay" />
          ) : (
            <MapTypeToggle
              variant="compact"
              value={map.mapType}
              onChange={map.setMapType}
              className="absolute left-4 z-overlay"
              style={{ top: `calc(${mobileTop} + ${isExplore ? topOverlay - 4 : 0}px)` }}
            />
          ))}

        {/* Search + filters (explore only) and the desktop panel */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-overlay flex flex-col gap-3 pt-[max(1rem,env(safe-area-inset-top))] lg:bottom-4 lg:left-panel-left lg:right-auto lg:w-panel lg:pt-4">
          {isExplore && (
            <>
              <div className="pointer-events-auto shrink-0 px-4 lg:px-0">
                <SearchBar
                  ref={searchInputRef}
                  value={discovery.query}
                  onChange={handleQueryChange}
                  onSubmit={discovery.openActiveResult}
                  onClear={discovery.clearQuery}
                  onEscape={handleSearchEscape}
                  onNavigate={discovery.moveActive}
                  onFocus={() => !isDesktop && setSheetSnap('expanded')}
                  listboxId={SEARCH_LISTBOX_ID}
                  expanded={discovery.searching && discovery.results.length > 0}
                  activeOptionId={activeResult && searchOptionId(activeResult.location.id)}
                />
              </div>
              <CategoryChips
                className="pointer-events-auto -my-1 shrink-0 px-4 py-1 lg:px-0"
                categories={categories}
                value={discovery.category}
                onChange={discovery.setCategory}
                elevated
              />
            </>
          )}
          {isDesktop && !immersive && (
            <aside
              ref={asideRef}
              aria-label={view.label}
              className="pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-sheet bg-surface pt-3 shadow-float"
            >
              <Outlet />
            </aside>
          )}
        </div>

        <Notice
          notice={notice}
          onDismiss={dismissNotice}
          className="absolute inset-x-4 z-modal lg:left-map-left lg:!top-4"
          style={{ top: noticeTop }}
        />

        {/* Immersive screens draw their own floating UI; children opt into pointer events. */}
        {immersive && (
          <div className="pointer-events-none absolute inset-0 z-sheet">
            <Outlet />
          </div>
        )}

        {/* Map controls (+ AI entry point on explore) */}
        <div
          className="absolute right-4 z-overlay flex flex-col items-end gap-3"
          style={{ bottom: isDesktop ? 24 : view.peekHeight + 16 }}
        >
          {/* Immersive on mobile: the top-left corner belongs to the screen's header. */}
          {immersive && !isDesktop && map.mode !== 'fallback' && (
            <MapTypeToggle variant="compact" value={map.mapType} onChange={map.setMapType} className="relative" />
          )}
          <MapControls
            canZoomIn={map.canZoomIn}
            canZoomOut={map.canZoomOut}
            onZoomIn={map.zoomIn}
            onZoomOut={map.zoomOut}
            onFitCampus={map.fitCampus}
            locateStatus={geo.status}
            onLocate={handleLocate}
          />
          {isExplore && (
            <AssistantFab ref={assistantFabRef} expanded={assistant.open} onClick={() => assistant.setOpen(true)} />
          )}
        </div>

        <CampusAssistant assistant={assistant} isDesktop={isDesktop} returnFocusRef={assistantFabRef} />

        {!isDesktop && !immersive && (
          <BottomSheet
            label={view.label}
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            peekHeight={view.peekHeight}
            peekScroll={view.peekScroll}
            scrollKey={pathname}
            className="absolute inset-x-0 bottom-0 z-sheet h-[calc(100%_-_88px_-_env(safe-area-inset-top))]"
          >
            <Outlet />
          </BottomSheet>
        )}
      </div>
    </MapLayoutContext.Provider>
  )
}
