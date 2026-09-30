import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildSearchIndex, searchIndex } from '../search/searchIndex.js'
import { useRecentPlaceIds } from '../search/recentSearches.js'
import { useSearchTracking } from '../search/useSearchTracking.js'
import { EVENTS, track } from '../../lib/analytics.js'

/**
 * The single owner of discovery state: search text, category filter,
 * marker-group list, keyboard-highlighted result and recent searches.
 * Owned by <MapLayout>; screens read it through the layout context.
 *
 * The selected place is NOT stored here — the URL (/place/:id) owns it.
 */
export function useDiscoveryState(locations, origin) {
  const navigate = useNavigate()
  const [query, setQueryState] = useState('')
  const [category, setCategoryState] = useState(null)
  const [groupIds, setGroupIds] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const recents = useRecentPlaceIds()

  // Index once per data load; rank against a deferred query so typing stays responsive.
  const index = useMemo(() => buildSearchIndex(locations), [locations])
  const deferredQuery = useDeferredValue(query)
  const searching = query.trim().length > 0

  const places = useMemo(
    () => (category ? locations.filter((l) => l.category === category) : locations),
    [locations, category],
  )
  const rank = useCallback(
    (text) => {
      const ranked = searchIndex(index, text, { origin })
      return category ? ranked.filter((r) => r.location.category === category) : ranked
    },
    [index, origin, category],
  )
  const results = useMemo(() => rank(deferredQuery), [rank, deferredQuery])
  const isStale = query !== deferredQuery
  // Anonymous search analytics (term + result count only).
  const commitSearch = useSearchTracking(EVENTS.SEARCH_SUBMITTED, deferredQuery, results.length, !isStale)

  const visibleIds = useMemo(() => {
    if (searching) return new Set(results.map((r) => r.location.id))
    if (category) return new Set(places.map((l) => l.id))
    return null
  }, [searching, results, category, places])

  const recentPlaces = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l]))
    return recents.ids.map((id) => byId.get(id)).filter(Boolean) // drop places since deleted
  }, [recents.ids, locations])

  // A different set of results invalidates the keyboard highlight (compare
  // ids, not identity: re-ranking the same places must not reset it).
  const resultsKey = results.map((r) => r.location.id).join(',')
  useEffect(() => setActiveIndex(-1), [resultsKey])

  const setQuery = useCallback((text) => {
    setQueryState(text)
    setGroupIds(null)
  }, [])

  const setCategory = useCallback((next) => {
    setCategoryState(next)
    setGroupIds(null)
  }, [])

  const moveActive = useCallback(
    (delta) => {
      if (!results.length) return
      setActiveIndex((i) => (i + delta + results.length) % results.length)
    },
    [results.length],
  )

  /** Open a place's detail. `fromSearch` records it as a recent search. */
  const openPlace = useCallback(
    (id, { fromSearch = false } = {}) => {
      if (fromSearch) recents.add(id)
      if (fromSearch && query.trim()) {
        commitSearch()
        track(EVENTS.SEARCH_RESULT_OPENED, { placeId: id, query })
      }
      navigate(`/place/${id}`)
    },
    [navigate, recents.add, query, commitSearch],
  )

  /**
   * Enter in the search box: open the highlighted result, else the top one.
   * If the displayed results still lag the typed text, rank the current
   * text instead — Enter must never open a result for an older query.
   */
  const openActiveResult = useCallback(() => {
    const target = isStale ? rank(query)[0] : (results[activeIndex] ?? results[0])
    if (target) openPlace(target.location.id, { fromSearch: true })
    return Boolean(target)
  }, [isStale, rank, query, results, activeIndex, openPlace])

  return useMemo(
    () => ({
      query,
      searching,
      isStale,
      category,
      places,
      results,
      visibleIds,
      activeIndex,
      groupIds,
      recentPlaces,
      setQuery,
      clearQuery: () => setQuery(''),
      setCategory,
      openGroup: setGroupIds,
      clearGroup: () => setGroupIds(null),
      moveActive,
      openPlace,
      openActiveResult,
      clearRecents: recents.clear,
    }),
    [
      query,
      searching,
      isStale,
      category,
      places,
      results,
      visibleIds,
      activeIndex,
      groupIds,
      recentPlaces,
      setQuery,
      setCategory,
      moveActive,
      openPlace,
      openActiveResult,
      recents.clear,
    ],
  )
}
