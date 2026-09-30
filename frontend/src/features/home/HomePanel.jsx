import { CircleAlert, MapPinOff, RefreshCw, SearchX, X } from 'lucide-react'
import { PlaceRowSkeleton } from '../locations/PlaceRow.jsx'
import { getCategoryMeta } from '../locations/categoryMeta.js'
import { DiscoverySection } from '../discovery/DiscoverySection.jsx'
import { PlaceList } from '../discovery/PlaceList.jsx'
import { sortByDistance } from '../discovery/proximity.js'
import { SearchResults } from '../search/SearchResults.jsx'
import { EmptyState } from '../../ui/EmptyState.jsx'
import { Button } from '../../ui/Button.jsx'
import { IconButton } from '../../ui/IconButton.jsx'

/**
 * Explore panel (mobile bottom sheet / desktop floating card). One of:
 * loading · error · marker group · search results · no results · browse
 * (recent searches + all/category places).
 */
export function HomePanel({ status, error, onRetry, discovery, group, origin }) {
  const { query, searching, isStale, category, places, results, activeIndex, recentPlaces } = discovery
  const categoryLabel = category ? getCategoryMeta(category).label : null
  const open = (id) => discovery.openPlace(id)

  if (status === 'loading') {
    return (
      <DiscoverySection title="Loading campus…">
        <div aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <PlaceRowSkeleton key={i} />
          ))}
        </div>
      </DiscoverySection>
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={CircleAlert}
        tone="error"
        compact
        title="Couldn't load campus places"
        description={error}
        action={
          <Button variant="secondary" size="md" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        }
      />
    )
  }

  // Markers too close to separate on the map (e.g. shared coordinates).
  if (group?.length) {
    return (
      <DiscoverySection
        title="Places at this spot"
        count={group.length}
        action={<IconButton icon={X} label="Close" variant="ghost" onClick={discovery.clearGroup} />}
      >
        <PlaceList items={group} origin={origin} onSelect={open} label="Places at this spot" />
      </DiscoverySection>
    )
  }

  if (searching) {
    if (!results.length && !isStale) {
      return (
        <EmptyState
          icon={SearchX}
          compact
          title="No matches"
          description={
            categoryLabel
              ? `Nothing in ${categoryLabel} matches “${query.trim()}”.`
              : `Nothing on campus matches “${query.trim()}”. Try a department, lab or landmark.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {categoryLabel && (
                <Button variant="secondary" size="md" onClick={() => discovery.setCategory(null)}>
                  Search all categories
                </Button>
              )}
              <Button variant="ghost" size="md" onClick={discovery.clearQuery}>
                Clear search
              </Button>
            </div>
          }
        />
      )
    }
    return (
      <DiscoverySection
        title={categoryLabel ? `Results in ${categoryLabel}` : 'Results'}
        count={results.length}
        countNoun="results"
      >
        <div className={isStale ? 'opacity-60 transition-opacity' : undefined}>
          <SearchResults
            results={results}
            query={query}
            activeIndex={activeIndex}
            origin={origin}
            onSelect={(id) => discovery.openPlace(id, { fromSearch: true })}
          />
        </div>
      </DiscoverySection>
    )
  }

  if (!places.length) {
    return (
      <EmptyState
        icon={MapPinOff}
        compact
        title={`No places in ${categoryLabel ?? 'this category'}`}
        action={
          <Button variant="secondary" size="md" onClick={() => discovery.setCategory(null)}>
            Show all places
          </Button>
        }
      />
    )
  }

  // Sort by distance only when the device position is reliable (on campus).
  const browseItems = origin ? sortByDistance(places, origin).map((r) => r.location) : places

  return (
    <>
      {!category && recentPlaces.length > 0 && (
        <DiscoverySection
          title="Recent"
          headingId="recent-heading"
          action={
            <Button variant="ghost" size="md" onClick={discovery.clearRecents} aria-label="Clear recent searches">
              Clear
            </Button>
          }
        >
          <PlaceList
            items={recentPlaces}
            origin={origin}
            onSelect={(id) => discovery.openPlace(id, { fromSearch: true })}
            label="Recent searches"
          />
        </DiscoverySection>
      )}
      <DiscoverySection
        title={categoryLabel ?? 'Explore campus'}
        count={places.length}
        caption={origin ? 'Nearest first · approximate straight-line distance' : undefined}
      >
        <PlaceList items={browseItems} origin={origin} onSelect={open} label={categoryLabel ?? 'All places'} />
      </DiscoverySection>
    </>
  )
}
