import { PlaceRow } from '../locations/PlaceRow.jsx'
import { getNearbyCategory } from './nearbyCategories.js'

/** Short address: first two comma parts are enough in a list. */
const shortAddress = (address) => address?.split(',').slice(0, 2).join(',').trim() || null

/**
 * An off-campus place in the app's standard place row: category icon, name,
 * "category · short address", straight-line distance. `meters` optional.
 */
export function NearbyPlaceRow({ place, meters, onSelect }) {
  const category = getNearbyCategory(place.category)
  return (
    <PlaceRow
      location={{ id: place.key, displayName: place.name, category: '', coords: place.coords }}
      icon={category.icon}
      metaText={[category.label, shortAddress(place.address)].filter(Boolean).join(' · ')}
      distanceMeters={meters}
      onSelect={onSelect}
    />
  )
}

export function NearbyPlaceList({ entries, onSelect, label }) {
  return (
    <ul aria-label={label} className="space-y-0.5">
      {entries.map(({ place, meters }) => (
        <li key={place.key}>
          <NearbyPlaceRow place={place} meters={meters} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
