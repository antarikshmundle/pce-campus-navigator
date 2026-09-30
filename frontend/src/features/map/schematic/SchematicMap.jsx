import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { colors } from '../../../design/tokens.js'
import { cn } from '../../../utils/cn.js'
import { convexHull, createProjection } from './projection.js'
import { MapMarker, UserMarker } from './SchematicMarkers.jsx'

const SPRING = { type: 'spring', stiffness: 260, damping: 34 }
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * Schematic campus renderer — the fallback used by <CampusMap> when Google
 * Maps is unavailable (no/invalid key, offline, tiles fail). Draws real
 * location coordinates on a plain grid; needs no network beyond the locations API.
 *
 * Props
 * - locations      normalized locations (services/locationsService.js)
 * - frameCoords    coords the view is fitted to (campus without outliers);
 *                  defaults to every location
 * - selectedId     highlighted location id
 * - visibleIds     Set of ids to emphasise (others dimmed), or null for all
 * - userPosition   { lat, lng } or null
 * - routeLine      [{ lat, lng }, …] drawn dashed (direct-line estimate), or null
 * - zoom           number, 1 = fit campus
 * - focus          { key, coords|null } — changing `key` pans to coords (null = recenter)
 * - insets         px occupied by floating UI; the campus is fitted inside the rest
 */
export function SchematicMap({
  locations,
  frameCoords = null,
  selectedId,
  visibleIds = null,
  onSelect,
  userPosition = null,
  routeLine = null,
  zoom = 1,
  focus = null,
  insets = NO_INSETS,
  className,
}) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  const projection = useMemo(
    () => createProjection(frameCoords ?? locations.map((l) => l.coords), size, insets),
    // Depend on inset fields, not identity: callers usually pass a fresh object.
    [locations, frameCoords, size, insets.top, insets.right, insets.bottom, insets.left],
  )

  const markers = useMemo(
    () => (projection ? locations.map((loc) => ({ loc, pos: projection.toScreen(loc.coords) })) : []),
    [projection, locations],
  )

  // Campus outline from the framed coords only, so an outlier can't stretch it.
  const hullPath = useMemo(() => {
    if (!projection) return ''
    const hull = convexHull((frameCoords ?? locations.map((l) => l.coords)).map((c) => projection.toScreen(c)))
    return hull.length ? `M${hull.map((p) => `${p.x},${p.y}`).join('L')}Z` : ''
  }, [projection, frameCoords, locations])

  // --- Viewport: zoom is a scale around the fitted centre; pan is a translate.
  const zoomMV = useMotionValue(zoom)
  const counterScale = useTransform(zoomMV, (z) => 1 / z)
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const applied = useRef({ zoom, focusKey: undefined })

  useEffect(() => {
    if (!projection) return undefined
    const prev = applied.current
    let target

    if (focus?.key !== prev.focusKey) {
      // Pan so the focus point lands on the centre of the unobstructed area.
      if (focus?.coords) {
        const p = projection.toScreen(focus.coords)
        target = { x: -(p.x - projection.center.x) * zoom, y: -(p.y - projection.center.y) * zoom }
      } else {
        target = { x: 0, y: 0 }
      }
    } else {
      // Zoom only: keep whatever is under the centre in place.
      const ratio = zoom / prev.zoom
      target = { x: panX.get() * ratio, y: panY.get() * ratio }
    }
    applied.current = { zoom, focusKey: focus?.key }

    const running = [animate(zoomMV, zoom, SPRING), animate(panX, target.x, SPRING), animate(panY, target.y, SPRING)]
    return () => running.forEach((a) => a.stop())
  }, [zoom, focus?.key, projection])

  // Suppress the click that follows a drag, so panning never selects a pin.
  const dragging = useRef(false)

  const userPos = projection && userPosition ? projection.toScreen(userPosition) : null
  const routePath =
    projection && routeLine?.length > 1
      ? `M${routeLine.map((c) => projection.toScreen(c)).map((p) => `${p.x},${p.y}`).join('L')}`
      : null
  const bound = Math.max(size.width, size.height) * zoom * 0.6

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full touch-none overflow-hidden bg-surface-alt', className)}
      role="application"
      aria-label="Campus map"
    >
      <motion.div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ x: panX, y: panY }}
        drag
        dragMomentum={false}
        dragConstraints={{ left: -bound, right: bound, top: -bound, bottom: bound }}
        onDragStart={() => {
          dragging.current = true
        }}
        onDragEnd={() => {
          setTimeout(() => {
            dragging.current = false
          }, 0)
        }}
        onClickCapture={(e) => {
          if (dragging.current) e.stopPropagation()
        }}
      >
        {/* Background grid — pans with the map, doesn't scale. */}
        <div
          aria-hidden
          className="absolute -inset-[150%]"
          style={{
            backgroundImage: `linear-gradient(${colors.line} 1px, transparent 1px), linear-gradient(90deg, ${colors.line} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            opacity: 0.55,
          }}
        />

        {projection && (
          <motion.div
            className="absolute inset-0"
            style={{ scale: zoomMV, transformOrigin: `${projection.center.x}px ${projection.center.y}px` }}
          >
            {hullPath && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <path d={hullPath} fill={colors.line} stroke={colors.line} strokeWidth={92} strokeLinejoin="round" />
                <path d={hullPath} fill={colors.surface.DEFAULT} stroke={colors.surface.DEFAULT} strokeWidth={88} strokeLinejoin="round" />
              </svg>
            )}

            {routePath && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <path d={routePath} fill="none" stroke={colors.surface.DEFAULT} strokeWidth={8} strokeLinecap="round" />
                <path
                  d={routePath}
                  fill="none"
                  stroke={colors.navy[700]}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="2 8"
                />
              </svg>
            )}

            {markers.map(({ loc, pos }) => (
              <MapMarker
                key={loc.id}
                location={loc}
                position={pos}
                selected={loc.id === selectedId}
                dimmed={visibleIds ? !visibleIds.has(loc.id) : false}
                counterScale={counterScale}
                onSelect={onSelect}
              />
            ))}

            {userPos && <UserMarker position={userPos} counterScale={counterScale} />}
          </motion.div>
        )}
      </motion.div>

      <span
        className="pointer-events-none absolute rounded-control bg-surface/80 px-2 py-1 text-micro text-fg-muted"
        style={{ left: insets.left + 12, bottom: insets.bottom + 12 }}
      >
        Schematic campus view
      </span>
    </div>
  )
}
