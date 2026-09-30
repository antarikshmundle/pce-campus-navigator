import { PlaceRow } from '../locations/PlaceRow.jsx'

export const SEARCH_LISTBOX_ID = 'campus-search-results'
export const searchOptionId = (placeId) => `campus-search-option-${placeId}`

/**
 * Search results as an ARIA listbox owned by the search combobox.
 * Focus stays in the input; `activeIndex` is the keyboard-highlighted row.
 */
export function SearchResults({ results, query, activeIndex, origin, onSelect }) {
  return (
    <>
      <ul id={SEARCH_LISTBOX_ID} role="listbox" aria-label="Search results" className="space-y-0.5">
        {results.map(({ location }, i) => (
          <PlaceRow
            key={location.id}
            option
            id={searchOptionId(location.id)}
            active={i === activeIndex}
            location={location}
            origin={origin}
            highlight={query}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
    </>
  )
}
