import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, Info, LocateFixed, MapPin, Search, SearchX, X } from 'lucide-react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { useCampusMap } from '../features/map/MapProvider.jsx'
import { CategoryChips } from '../features/search/CategoryChips.jsx'
import { buildSearchIndex, searchIndex } from '../features/search/searchIndex.js'
import { PlaceList } from '../features/discovery/PlaceList.jsx'
import { DiscoverySection } from '../features/discovery/DiscoverySection.jsx'
import { NEARBY_CHIPS, getNearbyCategory } from '../features/nearby/nearbyCategories.js'
import { NearbyPlaceList } from '../features/nearby/NearbyPlaceRow.jsx'
import { searchNearby } from '../features/nearby/nearbySearch.js'
import { SNAPSHOT_INFO } from '../features/nearby/nearbyService.js'
import { locateOnce, useNearbyPlaces, useNearbyReference } from '../features/nearby/useNearbyPlaces.js'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { Chip } from '../ui/Chip.jsx'
import { Button } from '../ui/Button.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { cn } from '../utils/cn.js'
import { EVENTS } from '../lib/analytics.js'
import { useSearchTracking } from '../features/search/useSearchTracking.js'
import { distanceMeters, formatDistance } from '../utils/geo.js'

const NEARBY_PEEK = 300
const LIST_LIMIT = 20
const NAGPUR_TEASER = 4
const TABS = [
  { id: 'around', label: 'Around PCE' },
  { id: 'campus', label: 'On campus' },
  { id: 'nagpur', label: 'Explore Nagpur' },
]
// Chips are 36px tall visually; this invisible extension gives a 44px touch target.
const HIT_AREA = "relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']"
const EMPTY = new Set()

const LOCATION_MESSAGES = {
  denied: "Couldn't access your location. Showing places near PCE instead.",
  unavailable: "Couldn't determine your location. Showing places near PCE instead.",
}

/**
 * /nearby — local discovery in three clearly separate layers: around PCE
 * (OpenStreetMap), on campus (the 69 canonical places) and Nagpur city
 * attractions. Filters and search live in the URL so Back restores them.
 * Off-campus places open /nearby/place/:key; campus places /place/:id.
 */
export default function NearbyScreen() {
  const { locations, categories, status } = useCampusData()
  const { mapOutlierIds } = useMapLayout()
  const { fitArea, mode: mapMode } = useCampusMap()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'around'
  const chipId = params.get('cat')
  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery.trim().length > 0

  const campus = useMemo(() => locations.filter((l) => !mapOutlierIds.has(l.id)), [locations, mapOutlierIds])
  const reference = useNearbyReference(locations, mapOutlierIds)
  const { around, nagpur, source, liveFailed } = useNearbyPlaces({ locations: campus, reference })
  const index = useMemo(() => buildSearchIndex(campus), [campus])

  function update(next) {
    const merged = { tab, cat: chipId, q: query, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([k, v]) => v && !(k === 'tab' && v === 'around'))), { replace: true })
  }

  // --- What's listed
  const chips = tab === 'campus' ? null : NEARBY_CHIPS[tab]
  const pool = tab === 'nagpur' ? nagpur : around
  const chipsWithPlaces = useMemo(
    () => chips?.filter((c) => !c.categories || pool.some((e) => c.categories.includes(e.place.category))) ?? null,
    [chips, pool],
  )
  const activeChip = chipsWithPlaces?.find((c) => c.id === chipId && c.categories) ?? null
  const external = useMemo(() => {
    const filtered = activeChip ? pool.filter((e) => activeChip.categories.includes(e.place.category)) : pool
    return tab === 'nagpur' ? filtered : filtered.slice(0, LIST_LIMIT)
  }, [pool, activeChip, tab])
  const campusList = useMemo(() => {
    const filtered = tab === 'campus' && chipId ? campus.filter((l) => l.category === chipId) : campus
    return filtered
      .map((l) => ({ location: l, meters: distanceMeters(reference.coords, l.coords) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, LIST_LIMIT)
  }, [campus, chipId, tab, reference.coords])

  // --- Search across all three layers
  const results = useMemo(() => {
    if (!searching) return null
    return {
      campus: searchIndex(index, deferredQuery).slice(0, 5).map((r) => r.location),
      around: searchNearby(around, deferredQuery, 8),
      nagpur: searchNearby(nagpur, deferredQuery, 5),
    }
  }, [searching, index, deferredQuery, around, nagpur])
  const resultTotal = results ? results.campus.length + results.around.length + results.nagpur.length : 0
  useSearchTracking(EVENTS.NEARBY_SEARCH, deferredQuery, resultTotal, query === deferredQuery)

  // --- Map: off-campus markers for what's listed; campus markers dimmed
  // unless campus places are what's listed.
  const externalPlaces = useMemo(() => {
    const shown = results ? [...results.around, ...results.nagpur] : tab === 'campus' ? [] : external
    return shown.map((e) => e.place)
  }, [results, tab, external])
  const visibleIds = useMemo(() => {
    if (results) return new Set(results.campus.map((l) => l.id))
    return tab === 'campus' ? new Set(campusList.map((e) => e.location.id)) : EMPTY
  }, [results, tab, campusList])

  useMapView({ externalPlaces, visibleIds, scope: 'area', peekHeight: NEARBY_PEEK, label: 'Nearby places', userLocation: reference.kind === 'you' ? reference.coords : null })

  // Frame what's listed (plus the reference point) when the selection
  // changes — once the live map is up, so its wider Nearby limits apply.
  const frameKey = `${tab}|${activeChip?.id}|${deferredQuery}|${reference.kind}|${status}|${source}|${mapMode}`
  const lastFrame = useRef(null)
  useEffect(() => {
    if (status !== 'ready' || mapMode !== 'ready' || lastFrame.current === frameKey) return
    lastFrame.current = frameKey
    const coords = [
      ...externalPlaces.slice(0, 12).map((p) => p.coords),
      ...(results ? results.campus : tab === 'campus' ? campusList.map((e) => e.location) : []).map((l) => l.coords),
    ]
    if (coords.length) fitArea([...coords, reference.coords], { maxZoom: 17 })
  }, [frameKey, status])

  const openExternal = (key) => navigate(`/nearby/place/${encodeURIComponent(key)}`)
  const openCampus = (id) => navigate(`/place/${id}`)
  const nearLabel = reference.kind === 'you' ? 'you' : 'PCE'

  // --- Notices (never raw errors)
  let notice = null
  if (reference.outOfArea) notice = "You're outside the Nagpur area. Showing places near PCE instead."
  else if (LOCATION_MESSAGES[reference.location.status]) notice = LOCATION_MESSAGES[reference.location.status]
  else if (liveFailed) notice = 'Live local discovery is unavailable right now. Showing available local data near PCE.'

  return (
    <div className="pb-6">
      <header className="px-4">
        <h1 className="text-heading text-fg">Nearby</h1>
        <div className="mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="flex items-center gap-1.5 text-body-sm text-fg-secondary" role="status">
            <MapPin size={16} className="shrink-0 text-fg-muted" aria-hidden />
            Showing places near {nearLabel}
            {source === 'loading' && <span className="text-fg-muted"> · updating…</span>}
          </p>
          {reference.kind !== 'you' && (
            <Button
              variant="secondary"
              size="md"
              icon={LocateFixed}
              onClick={locateOnce}
              disabled={reference.location.status === 'locating'}
            >
              {reference.location.status === 'locating' ? 'Locating…' : 'Use my location'}
            </Button>
          )}
        </div>
        {notice && (
          <p className="mt-2 flex items-start gap-2 rounded-field bg-accent-soft px-3 py-2.5 text-body-sm text-fg" role="status">
            <Info size={18} className="mt-px shrink-0 text-accent-dark" aria-hidden />
            {notice}
          </p>
        )}

        <div className="relative mt-3">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && query && (e.preventDefault(), update({ q: '' }))}
            placeholder="Search campus, nearby or Nagpur…"
            aria-label="Search nearby places"
            className="h-12 w-full rounded-field border border-line bg-surface pl-11 pr-12 text-body text-fg placeholder:text-fg-muted focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => update({ q: '' })}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-field text-fg-muted hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {!searching && (
        <>
          <div role="group" aria-label="Discovery area" className="mx-4 mt-3 flex rounded-pill bg-surface-alt p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => update({ tab: t.id, cat: null })}
                className={cn(
                  'tap-transparent h-11 flex-1 whitespace-nowrap rounded-pill px-2 text-caption font-semibold transition-colors',
                  tab === t.id ? 'bg-navy text-white' : 'text-fg-secondary hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'campus' ? (
            <CategoryChips className="mt-3 px-4 py-1" categories={categories} value={chipId} onChange={(c) => update({ cat: c })} />
          ) : (
            <div role="toolbar" aria-label="Filter by category" className="scrollbar-none mt-3 flex gap-2 overflow-x-auto px-4 py-1">
              {chipsWithPlaces.map((c) => (
                <Chip
                  key={c.id}
                  icon={c.icon}
                  selected={c.categories ? activeChip?.id === c.id : !activeChip}
                  className={HIT_AREA}
                  onClick={() => update({ cat: c.categories && activeChip?.id !== c.id ? c.id : null })}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-3">
        {status === 'error' && (tab === 'campus' || searching) && (
          <EmptyState compact tone="error" icon={CircleAlert} title="Campus places couldn't load" description="Places outside campus are still available." />
        )}
        {results ? (
          <SearchResultsView results={results} nearLabel={nearLabel} onExternal={openExternal} onCampus={openCampus} query={deferredQuery} />
        ) : tab === 'campus' ? (
          status === 'ready' && (
            <DiscoverySection title="On campus" count={campusList.length} caption={`Nearest to ${nearLabel} first · straight-line distance`}>
              <PlaceList items={campusList} onSelect={openCampus} label="Campus places" />
            </DiscoverySection>
          )
        ) : external.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="No places found for this category"
            action={
              <Button variant="secondary" size="md" onClick={() => update({ cat: null })}>
                Show all
              </Button>
            }
          />
        ) : tab === 'around' ? (
          <>
            <DiscoverySection title={`Near ${nearLabel}`} count={external.length} caption="Nearest first · straight-line distance">
              <NearbyPlaceList entries={external} onSelect={openExternal} label={`Places near ${nearLabel}`} />
            </DiscoverySection>
            {!activeChip && (
              <DiscoverySection
                title="Explore Nagpur"
                action={
                  <Button variant="ghost" size="md" onClick={() => update({ tab: 'nagpur', cat: null })}>
                    See all
                  </Button>
                }
              >
                <NagpurCards entries={nagpur.slice(0, NAGPUR_TEASER)} onSelect={openExternal} />
              </DiscoverySection>
            )}
          </>
        ) : (
          <DiscoverySection title="Explore Nagpur" count={external.length} caption="City attractions · straight-line distance">
            <NagpurCards entries={external} onSelect={openExternal} />
          </DiscoverySection>
        )}
      </div>

      <p className="px-4 pt-2 text-micro text-fg-muted">
        Places outside campus: {SNAPSHOT_INFO.attribution}
        {source === 'live' ? ' · live data' : ` · data as of ${SNAPSHOT_INFO.fetchedAt}`}. Ratings and opening hours aren't shown because
        they aren't verified.
      </p>
    </div>
  )
}

function SearchResultsView({ results, nearLabel, onExternal, onCampus, query }) {
  const total = results.campus.length + results.around.length + results.nagpur.length
  if (!total) {
    return <EmptyState compact icon={SearchX} title="No matches" description={`Nothing matches “${query.trim()}” on campus, nearby or in Nagpur.`} />
  }
  return (
    <>
      <p className="sr-only" role="status">
        {total} {total === 1 ? 'result' : 'results'}
      </p>
      {results.campus.length > 0 && (
        <DiscoverySection title="On campus" count={results.campus.length}>
          <PlaceList items={results.campus} onSelect={onCampus} label="Campus results" />
        </DiscoverySection>
      )}
      {results.around.length > 0 && (
        <DiscoverySection title={`Near ${nearLabel}`} count={results.around.length}>
          <NearbyPlaceList entries={results.around} onSelect={onExternal} label="Nearby results" />
        </DiscoverySection>
      )}
      {results.nagpur.length > 0 && (
        <DiscoverySection title="Explore Nagpur" count={results.nagpur.length}>
          <NearbyPlaceList entries={results.nagpur} onSelect={onExternal} label="Nagpur results" />
        </DiscoverySection>
      )}
    </>
  )
}

/** Attraction cards: two columns, icon + name + category + distance. */
function NagpurCards({ entries, onSelect }) {
  return (
    <ul aria-label="Nagpur attractions" className="grid grid-cols-2 gap-2 px-3">
      {entries.map(({ place, meters }) => {
        const category = getNearbyCategory(place.category)
        const Icon = category.icon
        return (
          <li key={place.key}>
            <button
              type="button"
              onClick={() => onSelect(place.key)}
              className="tap-transparent flex h-full min-h-[96px] w-full flex-col items-start gap-2 rounded-card border border-line bg-surface p-3 text-left transition-colors hover:bg-surface-alt"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-field bg-surface-alt text-navy">
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-body-sm font-semibold text-fg">{place.name}</span>
                <span className="block text-caption text-fg-secondary">
                  {category.label} · ≈ {formatDistance(meters)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
