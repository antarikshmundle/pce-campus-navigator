import { Chip } from '../../ui/Chip.jsx'
import { formatDistance, formatDuration } from '../../utils/geo.js'
import { isWalkingRoute } from '../navigation/routing/routeTypes.js'

/**
 * Fastest / Shortest choice — only between real routes Google returned.
 * Nothing is shown when there is a single route (alternatives are never faked).
 */
export function RouteOptions({ routes, selectedIndex, onSelect }) {
  const real = (routes ?? []).filter(isWalkingRoute)
  if (real.length < 2) return null

  // Compare what the user sees (whole minutes, 10 m), and only name a route
  // Fastest / Shortest when it alone is best — ties say nothing.
  const minutes = real.map((r) => Math.round(r.durationSeconds / 60))
  const meters = real.map((r) => Math.round(r.distanceMeters / 10))
  const uniqueBest = (values, i) => values[i] === Math.min(...values) && values.filter((v) => v === values[i]).length === 1

  return (
    <div className="px-4">
      <div role="group" aria-label="Route options" className="scrollbar-none flex gap-2 overflow-x-auto">
        {real.map((r, i) => {
          const labels = [uniqueBest(minutes, i) && 'Fastest', uniqueBest(meters, i) && 'Shortest'].filter(Boolean)
          // Otherwise: Google's own default route vs. its alternatives.
          const name = labels.length ? labels.join(' · ') : i === 0 ? 'Suggested' : 'Alternative'
          return (
            <Chip
              key={r.id}
              selected={i === selectedIndex}
              onClick={() => onSelect(i)}
              title={`${formatDuration(r.durationSeconds)} · ${formatDistance(r.distanceMeters)}`}
            >
              {name} · {formatDuration(r.durationSeconds)}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
