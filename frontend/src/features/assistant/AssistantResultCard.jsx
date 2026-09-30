import { useState } from 'react'
import { PlaceRow } from '../locations/PlaceRow.jsx'

const COLLAPSED = 5

/**
 * Places in an answer, as the app's standard place rows. Straight-line
 * distances show only when the answer computed them (labelled by PlaceRow).
 * Tapping a row opens the place — or its route, for "which one do you want
 * to go to?".
 */
export function AssistantResultCard({ places, byId, rowAction, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const rows = places.map((p) => ({ ...p, location: byId.get(p.id) })).filter((p) => p.location)
  if (!rows.length) return null
  const shown = expanded ? rows : rows.slice(0, COLLAPSED)

  return (
    <div className="mt-2 overflow-hidden rounded-card border border-line bg-surface">
      {rowAction === 'navigate' && (
        <p className="px-3 pt-2 text-micro font-semibold uppercase tracking-wide text-fg-muted">Tap a place to open its route</p>
      )}
      <ul className="p-1">
        {shown.map(({ location, meters }) => (
          <li key={location.id}>
            <PlaceRow
              location={location}
              distanceMeters={meters}
              onSelect={(id) => onAction({ type: rowAction === 'navigate' ? 'navigate' : 'open_place', placeId: id })}
            />
          </li>
        ))}
      </ul>
      {rows.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="tap-transparent w-full border-t border-line py-2.5 text-caption font-semibold text-info hover:bg-surface-alt"
        >
          {expanded ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}
