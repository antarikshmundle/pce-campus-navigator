import { Bookmark, ChevronRight } from 'lucide-react'
import { getCategoryMeta } from './categoryMeta.js'
import { formatDistance, formatMinutes, travelEstimate } from '../../utils/geo.js'
import { cn } from '../../utils/cn.js'
import { Skeleton } from '../../ui/Skeleton.jsx'
import { HighlightedText } from '../search/HighlightedText.jsx'
import { SAME_SPOT_METERS } from '../discovery/proximity.js'
import { useIsSaved } from '../saved/SavedPlacesProvider.jsx'

/**
 * List row for a location.
 *
 * - default: a <button>
 * - `option`: an ARIA listbox option (search results). Focus stays in the
 *   search input; `active` marks the keyboard-highlighted row.
 *
 * Saved places carry a small filled bookmark after the name (`savedMark`).
 *
 * `icon` / `metaText` override the campus category display (off-campus places).
 *
 * Trailing info, when available: straight-line distance from another place
 * (`distanceMeters`), otherwise walk estimate from the user (`origin`).
 */
export function PlaceRow({
  location,
  origin,
  onSelect,
  selected = false,
  option = false,
  active = false,
  id,
  highlight,
  distanceMeters,
  savedMark = true,
  icon,
  metaText,
}) {
  const categoryMeta = getCategoryMeta(location.category)
  const Icon = icon ?? categoryMeta.icon
  const meta = metaText ?? [categoryMeta.label, location.building].filter(Boolean).join(' · ')
  const travel = distanceMeters == null ? travelEstimate(origin, location.coords) : null
  const emphasised = selected || active
  const saved = useIsSaved(location.id) && savedMark

  const content = (
    <>
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-field',
          selected ? 'bg-navy text-accent' : 'bg-surface-alt text-navy',
        )}
      >
        <Icon size={20} strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-body font-medium text-fg">
            <HighlightedText text={location.displayName} query={highlight} />
          </span>
          {saved && (
            <>
              <Bookmark size={14} strokeWidth={2.25} fill="currentColor" className="shrink-0 text-navy" aria-hidden />
              <span className="sr-only">(saved)</span>
            </>
          )}
        </span>
        <span className="block truncate text-caption text-fg-secondary">{meta}</span>
      </span>
      {distanceMeters != null && (
        <span className="shrink-0 text-right">
          <span className="block text-caption font-semibold text-fg">
            {distanceMeters < SAME_SPOT_METERS ? 'Same spot' : `≈ ${formatDistance(distanceMeters)}`}
          </span>
          <span className="block text-micro text-fg-muted">straight-line</span>
        </span>
      )}
      {travel && (
        <span className="shrink-0 text-right">
          <span className="block text-caption font-semibold text-fg">{formatMinutes(travel.minutes)}</span>
          <span className="block text-micro text-fg-muted">{formatDistance(travel.meters)}</span>
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-fg-muted" aria-hidden />
    </>
  )

  const className = cn(
    'tap-transparent flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors',
    emphasised ? 'bg-accent-soft' : 'hover:bg-surface-alt',
  )

  if (option) {
    return (
      <li
        id={id}
        role="option"
        aria-selected={active}
        className={className}
        // Keep focus in the search input so the combobox stays open.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(location.id)}
      >
        {content}
      </li>
    )
  }

  return (
    <button type="button" onClick={() => onSelect(location.id)} aria-current={selected || undefined} className={className}>
      {content}
    </button>
  )
}

export function PlaceRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="h-11 w-11 rounded-field" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}
