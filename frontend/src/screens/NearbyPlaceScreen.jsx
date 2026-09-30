import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Footprints, Globe, MapPin, MapPinOff, Navigation } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { useCampusMap } from '../features/map/MapProvider.jsx'
import { getNearbyCategory } from '../features/nearby/nearbyCategories.js'
import { SNAPSHOT_INFO, findPlace, navigateUrl, openInMapsUrl, sourceUrl } from '../features/nearby/nearbyService.js'
import { useNearbyReference } from '../features/nearby/useNearbyPlaces.js'
import { useSavedPlaces } from '../features/saved/SavedPlacesProvider.jsx'
import { SaveButton } from '../features/saved/SaveButton.jsx'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { useBackNavigation } from '../hooks/useBackNavigation.js'
import { PanelHeader } from '../ui/PanelHeader.jsx'
import { Button } from '../ui/Button.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { distanceMeters, formatDistance } from '../utils/geo.js'
import { EVENTS, track } from '../lib/analytics.js'

const DETAIL_PEEK = 280

/**
 * /nearby/place/:placeKey — an off-campus place. Deliberately simpler than
 * campus detail: only what the data source actually provides (name,
 * category, address, position). Directions open in Google Maps — in-app
 * routes cover campus places only.
 */
export default function NearbyPlaceScreen() {
  const { placeKey } = useParams()
  const key = decodeURIComponent(placeKey ?? '')
  const { locations } = useCampusData()
  const { mapOutlierIds } = useMapLayout()
  const { focusArea, mode: mapMode } = useCampusMap()
  const { savedEntries, recentEntries, recordVisit } = useSavedPlaces()
  const navigate = useNavigate()
  const goBack = useBackNavigation('/nearby')
  const reference = useNearbyReference(locations, mapOutlierIds)

  // Loaded data first; saved / recent records keep working if it's gone.
  const place = useMemo(() => {
    const stored = [...savedEntries, ...recentEntries].find((e) => e.kind === 'external' && e.place.key === key)
    return findPlace(key) ?? stored?.place ?? null
  }, [key, savedEntries, recentEntries])

  const externalPlaces = useMemo(() => (place ? [place] : null), [place])
  useMapView({
    externalPlaces,
    selectedExternalKey: place?.key ?? null,
    scope: 'area',
    peekHeight: DETAIL_PEEK,
    label: 'Place details',
    userLocation: reference.kind === 'you' ? reference.coords : null,
  })

  useEffect(() => {
    if (place) recordVisit(place)
  }, [place?.key])
  const layer = place?.source === 'nagpur' ? 'nagpur' : 'around'
  useEffect(() => {
    if (place) track(EVENTS.NEARBY_PLACE_OPENED, { externalKey: place.key, detail: layer })
  }, [place?.key])
  // Once the live map is up (its wider Nearby limits apply from then).
  useEffect(() => {
    if (place && mapMode === 'ready') focusArea(place.coords, { zoom: 17 })
  }, [place?.key, mapMode])

  if (!place) {
    return (
      <div>
        <PanelHeader onBack={goBack} backLabel="Back to nearby" />
        <EmptyState
          compact
          icon={MapPinOff}
          title="Place not found"
          description="It isn't in the current local data."
          action={
            <Button variant="secondary" size="md" onClick={() => navigate('/nearby', { replace: true })}>
              Back to Nearby
            </Button>
          }
        />
      </div>
    )
  }

  const category = getNearbyCategory(place.category)
  const Icon = category.icon
  const meters = distanceMeters(reference.coords, place.coords)
  const osmUrl = sourceUrl(place)

  return (
    <div>
      <PanelHeader onBack={goBack} backLabel="Back to nearby" />
      <article className="px-4 pb-6" aria-labelledby="place-title">
        <header className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border-2 border-accent-dark bg-surface text-navy">
            <Icon size={22} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="place-title" className="text-heading text-fg">
              {place.name}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-micro font-semibold uppercase text-navy">
                <Icon size={12} strokeWidth={2.5} aria-hidden />
                {category.label}
              </span>
              <span className="inline-flex items-center rounded-pill bg-surface-alt px-2 py-0.5 text-micro font-semibold uppercase text-fg-secondary">
                {place.source === 'nagpur' ? 'Nagpur attraction' : 'Outside campus'}
              </span>
            </div>
          </div>
        </header>

        <dl className="mt-3 space-y-1.5 text-body-sm">
          {place.address && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Address</dt>
              <MapPin size={16} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
              <dd className="text-fg">{place.address}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="sr-only">Distance</dt>
            <Footprints size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <dd className="text-fg">
              <strong className="font-semibold">≈ {formatDistance(meters)}</strong> from {reference.kind === 'you' ? 'you' : 'PCE'}
              <span className="text-fg-muted"> · straight-line</span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Coordinates</dt>
            <Globe size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <dd className="text-fg-secondary">
              {place.coords.lat.toFixed(5)}, {place.coords.lng.toFixed(5)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex gap-2">
          <Button
            href={navigateUrl(place)}
            target="_blank"
            rel="noreferrer"
            icon={Navigation}
            size="lg"
            className="flex-1"
            aria-label={`Navigate to ${place.name} in Google Maps (opens in a new tab)`}
            onClick={() => track(EVENTS.NAVIGATION_REQUESTED, { externalKey: place.key, detail: 'google_maps' })}
          >
            Navigate
          </Button>
          <SaveButton key={place.key} place={place} />
        </div>
        <p className="mt-2 text-caption text-fg-muted">Directions open in Google Maps. In-app routes cover campus places.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button href={openInMapsUrl(place)} target="_blank" rel="noreferrer" variant="ghost" size="md" icon={ExternalLink}>
            Open in Google Maps
          </Button>
          {osmUrl && (
            <Button href={osmUrl} target="_blank" rel="noreferrer" variant="ghost" size="md" icon={ExternalLink}>
              View source
            </Button>
          )}
        </div>
        <p className="mt-3 text-micro text-fg-muted">
          Source: {SNAPSHOT_INFO.attribution}. Details can be incomplete or out of date.
        </p>
      </article>
    </div>
  )
}
