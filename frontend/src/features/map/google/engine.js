/**
 * Google Maps campus map engine — together with loader.js, the ONLY code
 * that touches google.maps.
 *
 * (Route requests live in features/navigation/routing/googleRouteService.js.)
 *
 * Framework-free: <CampusMap> drives it through the returned object and
 * receives events through `onEvent(type, payload)`:
 *   ready                        first tiles are on screen
 *   fatal          { reason, detail } unusable (auth / tiles) → caller falls back
 *   select         { id }        a place marker was tapped
 *   select-external { key }      an off-campus place marker was tapped
 *   group          { ids }       a group that can't be split by zooming was tapped
 *   zoom           { zoom, min, max } after every zoom change
 *   maptype-failed { mapType }   imagery for that map type never arrived
 *   interaction                  the user started dragging the map
 *
 * Loaded lazily (dynamic import) so the app shell never waits for it.
 */
import Supercluster from 'supercluster'
import { mapConfig } from '../mapConfig.js'
import { GOOGLE_MAPS_MAP_ID } from './config.js'
import { loadGoogleMaps, onAuthFailure } from './loader.js'
import { centerFor, fitFor, moveCamera } from './camera.js'
import { createClusterElement, createExternalElement, createOriginElement, createPlaceElement, createUserElement } from './markers.js'
import { createAccuracyCircle, createRouteOverlay } from './overlays.js'
import { createSelectedMarkerElement } from './selectedMarker.js'

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }
const CAMERA_REPLAY_MS = 2000
const Z = { dimmed: 1, place: 2, external: 2, cluster: 3, origin: 4, user: 5, selected: 6 }
const toLatLng = ([lng, lat]) => ({ lat, lng })

export async function createCampusMapEngine({ container, icons, onEvent, mapType = 'standard' }) {
  const { core, maps, marker: markerLib } = await loadGoogleMaps()
  const { AdvancedMarkerElement } = markerLib

  const map = new maps.Map(container, {
    mapId: GOOGLE_MAPS_MAP_ID,
    center: mapConfig.defaultCenter,
    zoom: mapConfig.defaultZoom,
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    mapTypeId: mapConfig.mapTypes[mapType],
    // Our own controls replace Google's; the Google logo + terms stay (required).
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    keyboardShortcuts: true,
    clickableIcons: false,
    isFractionalZoomEnabled: true,
    // Rotation / tilt arrive with live navigation; keep the map north-up.
    tilt: 0,
    heading: 0,
    tiltInteractionEnabled: false,
    headingInteractionEnabled: false,
  })
  container.dataset.mapType = mapType

  let destroyed = false
  let failed = false
  let ready = false
  let insets = NO_INSETS
  let lastCamera = null // { op, at } — re-applied if the padding/size changes right after
  let cancelAnimation = () => {}
  let places = { index: null, dimmed: [] }
  let selectedMarker = null
  let userMarker = null
  let originMarker = null
  const rendered = new Map() // key → AdvancedMarkerElement
  const externalRendered = new Map() // off-campus place key → AdvancedMarkerElement
  let externalSelected = null
  // 'campus': panning limited to campus, min zoom from mapConfig.
  // 'area': Nearby — places across Nagpur, so wider limits.
  let scope = 'campus'
  // Requested before the first tiles arrived; applied once they have.
  let pendingScope = null
  let pendingExternal = null
  let campusRestriction = null
  const minZoom = () => (scope === 'area' ? mapConfig.areaMinZoom : mapConfig.minZoom)
  const failedTypes = new Set()
  const listeners = []
  const route = createRouteOverlay(maps, core)
  const accuracy = createAccuracyCircle(maps)

  const on = (event, fn) => listeners.push(map.addListener(event, fn))
  const smooth = () => Boolean(maps.RenderingType) && map.getRenderingType?.() === maps.RenderingType.VECTOR

  function fail(reason, detail) {
    if (failed || destroyed) return
    failed = true
    onEvent('fatal', { reason, detail })
  }
  const stopAuthWatch = onAuthFailure(() => fail('auth', 'Google Maps rejected the API key (key, referrer, API or billing)'))

  // --- Tile watchdog: the active map type must deliver tiles in time.
  let tileTimer = null
  function watchTiles(type) {
    clearTimeout(tileTimer)
    const timeoutMs = ready ? mapConfig.tileTimeoutMs : mapConfig.initialTileTimeoutMs
    tileTimer = setTimeout(function check() {
      if (destroyed || failed) return
      if (document.hidden) {
        tileTimer = setTimeout(check, timeoutMs) // don't blame the network for a background tab
        return
      }
      if (!ready) {
        fail('timeout', `No map tiles within ${timeoutMs}ms`)
        return
      }
      failedTypes.add(type)
      const other = type === 'standard' ? 'satellite' : 'standard'
      if (failedTypes.has(other)) fail('tiles', 'Neither map type could load')
      else onEvent('maptype-failed', { mapType: type })
    }, timeoutMs)
  }
  watchTiles(mapType)

  on('tilesloaded', () => {
    clearTimeout(tileTimer)
    failedTypes.delete(container.dataset.mapType)
    if (!ready) {
      ready = true
      onEvent('ready')
      if (pendingScope) engine.setScope(...pendingScope)
      if (pendingExternal) engine.setExternal(...pendingExternal)
      pendingScope = pendingExternal = null
    }
  })
  on('idle', renderPlaces)

  on('zoom_changed', emitZoom)
  on('dragstart', () => {
    cancelAnimation()
    onEvent('interaction')
  })

  const resizeObserver = new ResizeObserver(replayRecentCamera)
  resizeObserver.observe(container)

  function emitZoom() {
    const zoom = map.getZoom()
    container.dataset.labels = String(zoom >= mapConfig.labelMinZoom)
    onEvent('zoom', { zoom, min: minZoom(), max: mapConfig.maxZoom })
  }
  emitZoom()

  // --- Places: clustered markers + unclustered dimmed ones, keyed for reuse.
  function addMarker(key, { position, content, zIndex, title, onClick }) {
    const m = new AdvancedMarkerElement({ map, position, content, zIndex, title, gmpClickable: Boolean(onClick) })
    if (onClick) m.addEventListener('gmp-click', onClick)
    rendered.set(key, m)
  }

  function renderPlaces() {
    if (destroyed) return
    const b = map.getBounds()
    if (!b) return
    const wanted = new Map()
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    // A little margin so markers don't pop in at the viewport edge.
    const padLng = (ne.lng() - sw.lng()) * 0.25
    const padLat = (ne.lat() - sw.lat()) * 0.25
    const bbox = [sw.lng() - padLng, sw.lat() - padLat, ne.lng() + padLng, ne.lat() + padLat]

    for (const f of places.dimmed) wanted.set(`d:${f.properties.id}`, { feature: f, kind: 'dimmed' })
    for (const f of places.index?.getClusters(bbox, Math.floor(map.getZoom())) ?? []) {
      if (f.properties.cluster) {
        const [lng, lat] = f.geometry.coordinates
        wanted.set(`c:${lng},${lat},${f.properties.point_count}`, { feature: f, kind: 'cluster' })
      } else {
        wanted.set(`p:${f.properties.id}`, { feature: f, kind: 'place' })
      }
    }

    for (const [key, m] of rendered) {
      if (!wanted.has(key)) {
        m.map = null
        rendered.delete(key)
      }
    }
    for (const [key, { feature: f, kind }] of wanted) {
      if (rendered.has(key)) continue
      const position = toLatLng(f.geometry.coordinates)
      if (kind === 'cluster') {
        addMarker(key, {
          position,
          content: createClusterElement(f.properties.point_count),
          zIndex: Z.cluster,
          title: `${f.properties.point_count} places`,
          onClick: () => openCluster(f),
        })
      } else {
        const { id, name, iconKey } = f.properties
        addMarker(key, {
          position,
          content: createPlaceElement({ name, iconSvg: icons[iconKey].marker, dimmed: kind === 'dimmed' }),
          zIndex: kind === 'dimmed' ? Z.dimmed : Z.place,
          title: name,
          onClick: () => onEvent('select', { id }),
        })
      }
    }
  }

  function openCluster(f) {
    const index = places.index
    if (!index) return
    try {
      const zoom = index.getClusterExpansionZoom(f.properties.cluster_id)
      if (zoom > mapConfig.clusterMaxZoom) {
        // Points too close to separate (e.g. identical coordinates): let the UI list them.
        const leaves = index.getLeaves(f.properties.cluster_id, 100, 0)
        onEvent('group', { ids: leaves.map((l) => l.properties.id) })
      } else {
        const coords = toLatLng(f.geometry.coordinates)
        camera(() => go({ center: centerFor(coords, zoom, insets), zoom }))
      }
    } catch {
      /* cluster vanished mid-interaction (data update) — ignore */
    }
  }

  // --- Camera. Ops are remembered briefly so a panel resize right after a
  // screen change re-frames against the new unobstructed area.
  function go(target) {
    cancelAnimation()
    cancelAnimation = moveCamera(map, target, { durationMs: mapConfig.cameraAnimationMs, smooth: smooth() })
  }
  function camera(op) {
    lastCamera = { op, at: performance.now() }
    op()
  }
  function replayRecentCamera() {
    if (lastCamera && performance.now() - lastCamera.at < CAMERA_REPLAY_MS) lastCamera.op()
  }
  const viewport = () => ({ width: container.clientWidth, height: container.clientHeight })
  const padded = () => ({
    top: insets.top + mapConfig.fitPadding,
    right: insets.right + mapConfig.fitPadding,
    bottom: insets.bottom + mapConfig.fitPadding,
    left: insets.left + mapConfig.fitPadding,
  })

  const engine = {
    /** Features flagged `dimmed` render faded and never join clusters. */
    setPlaces(fc) {
      const index = new Supercluster({
        radius: mapConfig.clusterRadius,
        maxZoom: mapConfig.clusterMaxZoom,
        extent: 256, // Google's tile size, so `radius` is in screen px
      })
      index.load(fc.features.filter((f) => !f.properties.dimmed))
      places = { index, dimmed: fc.features.filter((f) => f.properties.dimmed) }
      // Cluster keys depend on the index; drop them so they're rebuilt.
      for (const [key, m] of rendered) {
        if (key.startsWith('c:')) {
          m.map = null
          rendered.delete(key)
        }
      }
      renderPlaces()
    },
    /** `sel`: { coords, name, iconSvg } or null */
    setSelected(sel) {
      if (selectedMarker) selectedMarker.map = null
      selectedMarker = sel
        ? new AdvancedMarkerElement({
            map,
            position: sel.coords,
            content: createSelectedMarkerElement(sel),
            zIndex: Z.selected,
          })
        : null
    },
    /** `position`: { lat, lng, accuracy } or null */
    setUser(position) {
      accuracy.set(map, position)
      if (!position) {
        if (userMarker) userMarker.map = null
        userMarker = null
        return
      }
      const latLng = { lat: position.lat, lng: position.lng }
      if (userMarker) userMarker.position = latLng
      else userMarker = new AdvancedMarkerElement({ map, position: latLng, content: createUserElement(), zIndex: Z.user, title: 'Your location' })
    },
    /**
     * `r`: { geometry: { kind, coordinates }, traveled?, alternatives?, connectors?, originMarker? }
     * or null — see createRouteOverlay. Called on every GPS fix while
     * navigating, so existing shapes and markers are updated in place.
     */
    setRoute(r) {
      route.set(map, r ?? null)
      if (!r?.originMarker) {
        if (originMarker) originMarker.map = null
        originMarker = null
      } else if (originMarker) {
        originMarker.position = r.originMarker
      } else {
        originMarker = new AdvancedMarkerElement({ map, position: r.originMarker, content: createOriginElement(), zIndex: Z.origin })
      }
    },
    /** Limit panning to the campus area (bounds: [[w, s], [e, n]]). */
    setCampusBounds(bounds) {
      if (!bounds) return
      const m = mapConfig.maxBoundsMargin
      campusRestriction = {
        latLngBounds: { west: bounds[0][0] - m, south: bounds[0][1] - m, east: bounds[1][0] + m, north: bounds[1][1] + m },
        strictBounds: false,
      }
      if (scope === 'campus') map.setOptions({ restriction: campusRestriction })
    },
    /**
     * 'campus' | 'area' — see `scope` above. `reframe` runs when returning to
     * campus unless a screen just moved the camera itself.
     */
    setScope(next, reframe) {
      // Limits change only after the first render (see pendingScope).
      if (!ready) {
        pendingScope = [next, reframe]
        return
      }
      if (next === scope) return
      const leavingArea = scope === 'area'
      scope = next
      map.setOptions({
        minZoom: minZoom(),
        restriction: scope === 'area' ? { latLngBounds: mapConfig.areaBounds, strictBounds: false } : campusRestriction,
      })
      emitZoom()
      if (leavingArea && reframe && !(lastCamera && performance.now() - lastCamera.at < CAMERA_REPLAY_MS)) reframe(engine)
    },
    /**
     * Off-campus places, drawn as their own layer (rounded-square markers) so
     * campus markers are never touched. Markers are reused by key.
     * `places`: [{ key, name, category, coords }]; `selectedKey`: highlighted one.
     */
    setExternal(places, selectedKey = null) {
      // Like the campus layer (drawn on 'idle'), no markers before the first render.
      if (!ready) {
        pendingExternal = [places, selectedKey]
        return
      }
      const iconFor = (category) => icons[`ext:${category}`] ?? icons['ext:other']
      const wanted = new Map(places.filter((p) => p.key !== selectedKey).map((p) => [p.key, p]))
      for (const [key, m] of externalRendered) {
        if (!wanted.has(key)) {
          m.map = null
          externalRendered.delete(key)
        }
      }
      for (const [key, p] of wanted) {
        if (externalRendered.has(key)) continue
        const m = new AdvancedMarkerElement({
          map,
          position: p.coords,
          content: createExternalElement({ name: p.name, iconSvg: iconFor(p.category).marker }),
          zIndex: Z.external,
          title: p.name,
          gmpClickable: true,
        })
        m.addEventListener('gmp-click', () => onEvent('select-external', { key }))
        externalRendered.set(key, m)
      }
      if (externalSelected) externalSelected.map = null
      const sel = selectedKey ? places.find((p) => p.key === selectedKey) : null
      externalSelected = sel
        ? new AdvancedMarkerElement({
            map,
            position: sel.coords,
            content: createSelectedMarkerElement({ name: sel.name, iconSvg: iconFor(sel.category).selected }),
            zIndex: Z.selected,
          })
        : null
    },
    /** Screen area covered by floating UI; all camera moves respect it. */
    setInsets(next) {
      if (['top', 'right', 'bottom', 'left'].every((k) => next[k] === insets[k])) return
      insets = { ...next }
      replayRecentCamera()
    },
    setMapType(type) {
      if (container.dataset.mapType === type) return
      container.dataset.mapType = type
      map.setMapTypeId(mapConfig.mapTypes[type])
      watchTiles(type)
    },

    focus(coords, { zoom } = {}) {
      camera(() => {
        const z = Math.max(map.getZoom(), zoom ?? mapConfig.focusZoom)
        go({ center: centerFor(coords, z, insets), zoom: z })
      })
    },
    fitCoords(list, { maxZoom = mapConfig.routeMaxZoom } = {}) {
      if (!list.length) return
      if (list.length === 1) {
        engine.focus(list[0], { zoom: maxZoom })
        return
      }
      camera(() => go(fitFor(list, viewport(), padded(), { minZoom: minZoom(), maxZoom, wholeZoom: !smooth() })))
    },
    zoomIn() {
      go({ center: map.getCenter().toJSON(), zoom: Math.min(mapConfig.maxZoom, map.getZoom() + 1) })
    },
    zoomOut() {
      go({ center: map.getCenter().toJSON(), zoom: Math.max(minZoom(), map.getZoom() - 1) })
    },

    destroy() {
      destroyed = true
      clearTimeout(tileTimer)
      cancelAnimation()
      stopAuthWatch()
      resizeObserver.disconnect()
      listeners.forEach((l) => l.remove())
      for (const m of rendered.values()) m.map = null
      rendered.clear()
      for (const m of externalRendered.values()) m.map = null
      externalRendered.clear()
      for (const m of [selectedMarker, userMarker, originMarker, externalSelected]) if (m) m.map = null
      route.remove()
      accuracy.remove()
    },
  }

  return engine
}
