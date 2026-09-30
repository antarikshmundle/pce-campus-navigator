import { DiscoverySection } from '../discovery/DiscoverySection.jsx'
import { PlaceList } from '../discovery/PlaceList.jsx'
import { nearbyPlaces, placesInSameBuilding } from '../discovery/proximity.js'

const NEARBY_LIMIT = 4

/** Discovery from a place: same-building places + closest places (straight-line). */
export function RelatedPlaces({ place, locations, origin, onSelect }) {
  const sameBuilding = placesInSameBuilding(place, locations)
  const sameIds = new Set(sameBuilding.map((l) => l.id))
  const nearby = nearbyPlaces(place, locations, { limit: NEARBY_LIMIT + sameIds.size }).filter(
    (r) => !sameIds.has(r.location.id),
  ).slice(0, NEARBY_LIMIT)

  return (
    <>
      {sameBuilding.length > 0 && (
        <DiscoverySection title={`Also in ${place.building}`} headingId="same-building-heading">
          <PlaceList items={sameBuilding} origin={origin} onSelect={onSelect} label={`Also in ${place.building}`} />
        </DiscoverySection>
      )}
      {nearby.length > 0 && (
        <DiscoverySection
          title="Nearby"
          headingId="nearby-heading"
          caption="Approximate straight-line distance from this place — not walking distance."
        >
          <PlaceList items={nearby} onSelect={onSelect} label="Nearby places" />
        </DiscoverySection>
      )}
    </>
  )
}
