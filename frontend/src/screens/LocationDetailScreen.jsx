import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleAlert, MapPinOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { useCampusMap } from '../features/map/MapProvider.jsx'
import { mapConfig } from '../features/map/mapConfig.js'
import { useSavedPlaces } from '../features/saved/SavedPlacesProvider.jsx'
import { LocationDetail } from '../features/place/LocationDetail.jsx'
import { RelatedPlaces } from '../features/place/RelatedPlaces.jsx'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { useBackNavigation } from '../hooks/useBackNavigation.js'
import { useIsDesktop } from '../hooks/useMediaQuery.js'
import { PanelHeader } from '../ui/PanelHeader.jsx'
import { EVENTS, track } from '../lib/analytics.js'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Button } from '../ui/Button.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const DETAIL_PEEK = 272

/** /place/:placeId — details for one location, focused on the map. */
export default function LocationDetailScreen() {
  const { placeId } = useParams()
  const id = Number(placeId)
  const { status, locations, getById, reload } = useCampusData()
  const { origin, geo, discovery, mapOutlierIds } = useMapLayout()
  const { focusLocation } = useCampusMap()
  const { recordVisit } = useSavedPlaces()
  const navigate = useNavigate()
  const goBack = useBackNavigation()
  const isDesktop = useIsDesktop()
  const location = getById(id)
  // Stored coordinate is far off campus: keep the camera where it is.
  const positionUnverified = Boolean(location && mapOutlierIds.has(location.id))

  useMapView({ selectedId: location ? id : null, peekHeight: DETAIL_PEEK, label: 'Place details' })

  useEffect(() => {
    if (location && !positionUnverified) focusLocation(location.coords, { zoom: mapConfig.focusZoom })
  }, [location?.id, location?.coords.lat, location?.coords.lng, positionUnverified, focusLocation])

  // An actually opened place (any entry: search, marker, AI, Saved, link) is a recent.
  useEffect(() => {
    if (location) recordVisit(location.id)
  }, [location?.id, recordVisit])
  useEffect(() => {
    if (location) track(EVENTS.PLACE_OPENED, { placeId: location.id })
  }, [location?.id])

  // Desktop: Escape behaves like Back — unless focus is in a form control
  // (e.g. a select), which owns its own Escape.
  useEffect(() => {
    if (!isDesktop) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target.closest?.('input, select, textarea')) return
      goBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDesktop, goBack])

  let body
  let related = null
  if (status === 'loading') {
    body = (
      <div className="space-y-3 px-4 pb-6" aria-busy="true">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full rounded-field" />
      </div>
    )
  } else if (status === 'error') {
    body = (
      <EmptyState
        compact
        tone="error"
        icon={CircleAlert}
        title="Couldn't load this place"
        description="Check your connection and try again."
        action={
          <Button variant="secondary" size="md" icon={RefreshCw} onClick={reload}>
            Try again
          </Button>
        }
      />
    )
  } else if (!location) {
    body = (
      <EmptyState
        compact
        icon={MapPinOff}
        title="Place not found"
        description="It may have been removed or renamed."
        action={
          <Button variant="secondary" size="md" onClick={() => navigate('/', { replace: true })}>
            Back to map
          </Button>
        }
      />
    )
  } else {
    const from = origin ? '&from=me' : ''
    body = (
      <>
        {positionUnverified && (
          <p role="status" className="mx-4 mb-3 flex items-start gap-2 rounded-field bg-accent-soft px-3 py-2.5 text-body-sm text-fg">
            <TriangleAlert size={18} className="mt-px shrink-0 text-accent-dark" aria-hidden />
            Map position is being verified
          </p>
        )}
        <LocationDetail
          location={location}
          origin={origin}
          locating={geo.status === 'locating'}
          onRequestLocation={geo.locate}
          onNavigate={() => navigate(`/route?to=${location.id}${from}`)}
        />
      </>
    )
    related = <RelatedPlaces place={location} locations={locations} origin={origin} onSelect={discovery.openPlace} />
  }

  return (
    <div>
      <PanelHeader onBack={goBack} backLabel="Back to places" />
      {body}
      {related}
    </div>
  )
}
