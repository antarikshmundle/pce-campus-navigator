import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, CircleAlert, Compass, RefreshCw } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { PlaceRow, PlaceRowSkeleton } from '../features/locations/PlaceRow.jsx'
import { NearbyPlaceRow } from '../features/nearby/NearbyPlaceRow.jsx'
import { navigateUrl } from '../features/nearby/externalLinks.js'
import { useSavedPlaces } from '../features/saved/SavedPlacesProvider.jsx'
import { SavedPlaceRow } from '../features/saved/SavedPlaceRow.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Button } from '../ui/Button.jsx'
import { PageFrame } from './PlaceholderScreen.jsx'

const card = 'overflow-hidden rounded-sheet bg-surface shadow-card'

/**
 * /saved — places saved on this device (most recently saved first) and the
 * places recently opened, campus and off-campus. Campus places reuse
 * /place/:id and /route?to=<id>; off-campus ones /nearby/place/:key and
 * Google Maps directions. Nothing here duplicates those screens.
 */
export default function SavedScreen() {
  const { status, reload } = useCampusData()
  const { savedCount, savedEntries, recentEntries, remove, restore, clearRecent } = useSavedPlaces()
  const navigate = useNavigate()
  // Last removal, offered for undo (the row disappears immediately).
  const [removed, setRemoved] = useState(null)
  const undoRef = useRef(null)

  useEffect(() => {
    if (removed) undoRef.current?.focus()
  }, [removed])

  const open = (entry) =>
    navigate(entry.kind === 'campus' ? `/place/${entry.location.id}` : `/nearby/place/${encodeURIComponent(entry.place.key)}`)
  // Campus: no device position is known off the map screens; the route
  // screen asks for a start. Off-campus: directions in Google Maps.
  function route(entry) {
    if (entry.kind === 'campus') navigate(`/route?to=${entry.location.id}`)
    else window.open(navigateUrl(entry.place), '_blank', 'noopener,noreferrer')
  }
  const nameOf = (entry) => (entry.kind === 'campus' ? entry.location.displayName : entry.place.name)

  function handleRemove(entry) {
    const record = remove(entry.kind === 'campus' ? entry.location.id : entry.place.key)
    if (record) setRemoved({ record, name: nameOf(entry) })
  }

  function handleUndo() {
    restore(removed.record)
    setRemoved(null)
  }

  let savedContent
  if (status === 'loading' && savedCount > 0) {
    savedContent = (
      <div className={`${card} p-1`} aria-busy="true" aria-label="Loading saved places">
        {Array.from({ length: Math.min(savedCount, 4) }, (_, i) => (
          <PlaceRowSkeleton key={i} />
        ))}
      </div>
    )
  } else if (status === 'error' && savedCount > 0) {
    // Saved IDs are kept: they come back once the places load.
    savedContent = (
      <div className={card}>
        <EmptyState
          tone="error"
          icon={CircleAlert}
          title="Couldn't load your saved places"
          description="They're still saved on this device. Check your connection and try again."
          action={
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={reload}>
              Try again
            </Button>
          }
        />
      </div>
    )
  } else if (savedEntries.length > 0) {
    savedContent = (
      <ul aria-label="Saved places" className={`${card} divide-y divide-line p-1`}>
        {savedEntries.map((entry) => (
          <SavedPlaceRow
            key={entry.key}
            entry={entry}
            onOpen={open}
            onNavigate={route}
            onRemove={handleRemove}
          />
        ))}
      </ul>
    )
  } else {
    savedContent = (
      <div className={card}>
        <EmptyState
          icon={Bookmark}
          title="Save places you use often"
          description="Bookmark a place on campus or nearby to find it quickly later."
          action={
            <Button size="md" icon={Compass} onClick={() => navigate('/')}>
              Explore campus
            </Button>
          }
        />
      </div>
    )
  }

  const count = status === 'ready' ? savedEntries.length : null

  return (
    <PageFrame title="Saved places">
      <p className="-mt-4 mb-4 text-body-sm text-fg-secondary">
        {count == null
          ? 'Saved on this device'
          : `${count} ${count === 1 ? 'place' : 'places'} · saved on this device`}
      </p>

      {savedContent}

      <div role="status" aria-live="polite">
        {removed && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-field bg-surface-alt py-1 pl-4 pr-1">
            <p className="min-w-0 text-body-sm text-fg">
              Removed <span className="font-semibold">{removed.name}</span> from saved places
            </p>
            <Button ref={undoRef} variant="ghost" size="md" onClick={handleUndo} className="text-info">
              Undo
            </Button>
          </div>
        )}
      </div>

      {status === 'ready' && recentEntries.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-places-heading">
          <header className="mb-2 flex min-h-11 items-center justify-between gap-2">
            <h2 id="recent-places-heading" className="text-title text-fg">
              Recently viewed
            </h2>
            <Button variant="ghost" size="md" onClick={clearRecent} aria-label="Clear recently viewed places">
              Clear
            </Button>
          </header>
          <div className={`${card} p-1`}>
            <ul aria-label="Recently viewed places" className="space-y-0.5">
              {recentEntries.map((entry) => (
                <li key={entry.key}>
                  {entry.kind === 'campus' ? (
                    <PlaceRow location={entry.location} onSelect={() => open(entry)} />
                  ) : (
                    <NearbyPlaceRow place={entry.place} onSelect={() => open(entry)} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </PageFrame>
  )
}
