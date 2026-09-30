import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { useCampusMapRegistry } from './MapProvider.jsx'
import { SchematicMap } from './schematic/SchematicMap.jsx'
import { hasGoogleMapsKey } from './google/config.js'
import { analyzeCampus, placesToGeoJSON } from './geojson.js'
import { mapConfig } from './mapConfig.js'
import { getCategoryMeta } from '../locations/categoryMeta.js'

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }
const SCHEMATIC_MAX_ZOOM = 4

/**
 * Screen-facing campus map. Declarative props in, events out; camera
 * actions go through useCampusMap(). Screens never see the renderer.
 *
 * Renderer: Google Maps (lazy-loaded engine) → schematic fallback when the
 * API key is missing or rejected, the API can't load, or tiles never arrive.
 *
 * Campus framing ignores outlier coordinates (see analyzeCampus): their
 * markers still render where stored, but the camera never jumps to them.
 *
 * Props
 * - locations       normalized locations
 * - selectedId      place drawn as the selected pin
 * - visibleIds      Set of emphasised ids (others dimmed) or null
 * - userLocation    { lat, lng, accuracy } or null
 * - route           { geometry: { kind, coordinates }, traveled?, alternatives?, connectors?, originMarker? }
 *                   or null (see google/overlays.js)
 * - mapType         'standard' | 'satellite'
 * - insets          px covered by floating UI (camera keeps content clear of it)
 * - externalPlaces  off-campus places [{ key, name, category, coords }] (Nearby); Google renderer only
 * - selectedExternalKey  highlighted off-campus place
 * - scope           'campus' | 'area' (Nearby: wider pan/zoom limits)
 * - onSelect(id), onSelectExternal(key), onSelectGroup(ids), onFallback(reason), onMapTypeUnavailable(mapType)
 */
export function CampusMap({
  locations,
  selectedId = null,
  visibleIds = null,
  userLocation = null,
  route = null,
  externalPlaces = null,
  selectedExternalKey = null,
  scope = 'campus',
  mapType = 'standard',
  insets = NO_INSETS,
  onSelect,
  onSelectExternal,
  onSelectGroup,
  onFallback,
  onMapTypeUnavailable,
  className,
}) {
  const registry = useCampusMapRegistry()
  const [mode, setMode] = useState(() => (hasGoogleMapsKey() ? 'loading' : 'fallback'))
  const [engine, setEngine] = useState(null)
  const [icons, setIcons] = useState(null)
  const containerRef = useRef(null)
  const pendingRef = useRef(null) // camera op issued before the engine exists
  const fallbackReason = useRef(mode === 'fallback' ? 'missing-key' : null)
  const cameraTouched = useRef(false) // a screen already moved the camera

  const campus = useMemo(() => analyzeCampus(locations), [locations])

  // Latest props for callbacks created once.
  const latest = useRef({})
  latest.current = { onSelect, onSelectExternal, onSelectGroup, onFallback, onMapTypeUnavailable, campus, mapType }

  // Schematic viewport (used only in fallback mode).
  const [schematicZoom, setSchematicZoom] = useState(1)
  const [schematicFocus, setSchematicFocus] = useState(null)

  // --- Engine lifecycle
  const isFallback = mode === 'fallback'
  useEffect(() => {
    if (isFallback) return undefined
    let cancelled = false
    let instance = null

    function fallBack(reason, detail) {
      if (cancelled) return
      cancelled = true // an engine still being created is destroyed on arrival
      console.warn('[CampusMap] using schematic fallback:', reason, detail ?? '')
      instance?.destroy()
      instance = null
      fallbackReason.current = reason
      setEngine(null)
      setMode('fallback')
    }

    function handleEvent(type, payload) {
      if (type === 'ready') setMode('ready')
      else if (type === 'fatal') fallBack(payload.reason, payload.detail)
      else if (type === 'select') latest.current.onSelect?.(payload.id)
      else if (type === 'select-external') latest.current.onSelectExternal?.(payload.key)
      else if (type === 'group') latest.current.onSelectGroup?.(payload.ids)
      else if (type === 'maptype-failed') latest.current.onMapTypeUnavailable?.(payload.mapType)
      else if (type === 'interaction') registry.setState((s) => ({ ...s, lastInteractionAt: Date.now() }))
      else if (type === 'zoom') {
        registry.setState((s) => ({
          ...s,
          canZoomIn: payload.zoom < payload.max - 0.01,
          canZoomOut: payload.zoom > payload.min + 0.01,
        }))
      }
    }

    Promise.all([import('./google/engine.js'), import('./markerIcons.js')])
      .then(async ([engineModule, iconModule]) => {
        const builtIcons = iconModule.buildMarkerIcons()
        const created = await engineModule.createCampusMapEngine({
          container: containerRef.current,
          icons: builtIcons,
          onEvent: handleEvent,
          mapType: latest.current.mapType,
        })
        if (cancelled) {
          created.destroy()
          return
        }
        instance = created
        if (pendingRef.current) {
          pendingRef.current(instance)
          pendingRef.current = null
        }
        setIcons(builtIcons)
        setEngine(instance)
      })
      .catch((err) => fallBack(err?.reason ?? 'engine-load', err?.message))

    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [isFallback, registry])

  useEffect(() => {
    registry.setState((s) => ({ ...s, mode }))
    if (mode === 'fallback') latest.current.onFallback?.(fallbackReason.current)
  }, [mode, registry])

  // --- Controller (registered before children's effects run)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const engineRef = useRef(engine)
  engineRef.current = engine

  useLayoutEffect(() => {
    const withEngine = (op) => {
      cameraTouched.current = true
      if (engineRef.current) op(engineRef.current)
      else pendingRef.current = op
    }
    const inCampus = (coords) => latest.current.campus.contains(coords)
    const schematic = () => modeRef.current === 'fallback'
    const showWholeCampus = () => {
      setSchematicZoom(1)
      setSchematicFocus({ key: Date.now(), coords: null })
    }

    registry.register({
      focus(coords, opts) {
        if (!inCampus(coords)) return // outlier coordinate: never move the camera there
        if (schematic()) {
          setSchematicZoom((z) => Math.max(z, 2))
          setSchematicFocus({ key: Date.now(), coords })
        } else withEngine((e) => e.focus(coords, opts))
      },
      fitCoords(list, opts) {
        const onCampus = list.filter(inCampus)
        if (!onCampus.length) return
        if (schematic()) showWholeCampus()
        else withEngine((e) => e.fitCoords(onCampus, opts))
      },
      // Nearby: anywhere in the area; the schematic map only covers campus.
      focusArea(coords, opts) {
        if (!schematic()) withEngine((e) => e.focus(coords, opts))
      },
      fitArea(list, opts) {
        if (list.length && !schematic()) withEngine((e) => e.fitCoords(list, opts))
      },
      fitCampus() {
        if (schematic()) showWholeCampus()
        else withEngine((e) => e.fitCoords(latest.current.campus.coreCoords, { maxZoom: mapConfig.areaZoom }))
      },
      zoomIn() {
        if (schematic()) setSchematicZoom((z) => Math.min(SCHEMATIC_MAX_ZOOM, z + 1))
        else engineRef.current?.zoomIn()
      },
      zoomOut() {
        if (schematic()) setSchematicZoom((z) => Math.max(1, z - 1))
        else engineRef.current?.zoomOut()
      },
    })
    return () => registry.register(null)
  }, [registry])

  useEffect(() => {
    if (mode !== 'fallback') return
    registry.setState((s) => ({ ...s, canZoomIn: schematicZoom < SCHEMATIC_MAX_ZOOM, canZoomOut: schematicZoom > 1 }))
  }, [mode, schematicZoom, registry])

  // --- Data → engine
  const placesData = useMemo(
    () => placesToGeoJSON(locations, { visibleIds, excludeId: selectedId }),
    [locations, visibleIds, selectedId],
  )
  const selected = useMemo(() => {
    const loc = locations.find((l) => l.id === selectedId)
    if (!loc || !icons) return null
    const { key } = getCategoryMeta(loc.category)
    return { coords: loc.coords, name: loc.displayName, iconSvg: icons[key].selected }
  }, [locations, selectedId, icons])

  useEffect(() => engine?.setPlaces(placesData), [engine, placesData])
  useEffect(() => engine?.setSelected(selected), [engine, selected])
  useEffect(() => engine?.setUser(userLocation), [engine, userLocation])
  useEffect(() => engine?.setRoute(route), [engine, route])
  useEffect(() => engine?.setMapType(mapType), [engine, mapType])
  useEffect(() => engine?.setExternal(externalPlaces ?? [], selectedExternalKey), [engine, externalPlaces, selectedExternalKey])
  // Back from Nearby: campus limits again, and the campus framed unless the
  // new screen already moved the camera.
  useEffect(() => {
    engine?.setScope(scope, (e) => e.fitCoords(latest.current.campus.coreCoords, { maxZoom: mapConfig.areaZoom }))
  }, [engine, scope])
  useEffect(
    () => engine?.setInsets(insets),
    [engine, insets.top, insets.right, insets.bottom, insets.left],
  )

  // Campus bounds + first fit once both the engine and data exist.
  const didInitialFit = useRef(false)
  useEffect(() => {
    if (!engine || !campus.coreCoords.length) return
    engine.setCampusBounds(campus.bounds)
    if (!didInitialFit.current) {
      didInitialFit.current = true
      if (!cameraTouched.current) engine.fitCoords(campus.coreCoords, { maxZoom: mapConfig.areaZoom })
    }
  }, [engine, campus])

  if (mode === 'fallback') {
    return (
      <SchematicMap
        className={className}
        locations={locations}
        frameCoords={campus.coreCoords}
        selectedId={selectedId}
        visibleIds={visibleIds}
        onSelect={onSelect}
        userPosition={userLocation}
        routeLine={route?.geometry.coordinates ?? null}
        zoom={schematicZoom}
        focus={schematicFocus}
        insets={insets}
      />
    )
  }

  return (
    <div className={cn('overflow-hidden bg-surface-alt', className)}>
      <div ref={containerRef} className="h-full w-full" />

      {mode === 'loading' && (
        <div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }}
        >
          <span className="flex items-center gap-2 rounded-pill bg-surface px-3.5 py-2 text-caption text-fg-secondary shadow-card">
            <LoaderCircle size={16} className="animate-spin text-fg-muted" aria-hidden />
            Loading map…
          </span>
        </div>
      )}
    </div>
  )
}
