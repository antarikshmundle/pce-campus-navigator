import { PlaceRow } from '../locations/PlaceRow.jsx'

/**
 * Plain list of places. `items` are locations, or { location, meters }
 * entries (straight-line distance shown per row).
 */
export function PlaceList({ items, origin, onSelect, label }) {
  return (
    <ul aria-label={label} className="space-y-0.5">
      {items.map((item) => {
        const location = item.location ?? item
        return (
          <li key={location.id}>
            <PlaceRow location={location} origin={origin} distanceMeters={item.meters} onSelect={onSelect} />
          </li>
        )
      })}
    </ul>
  )
}
