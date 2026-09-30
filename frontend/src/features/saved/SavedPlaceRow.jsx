import { Navigation } from 'lucide-react'
import { PlaceRow } from '../locations/PlaceRow.jsx'
import { NearbyPlaceRow } from '../nearby/NearbyPlaceRow.jsx'
import { IconButton } from '../../ui/IconButton.jsx'
import { BookmarkFilled } from './SaveButton.jsx'

/**
 * A saved place: the standard place row (opens the place) followed by
 * Navigate and Remove. `entry` is a resolved saved entry — campus
 * ({ kind: 'campus', location }) or off-campus ({ kind: 'external', place }).
 * The row's own bookmark mark is redundant here.
 */
export function SavedPlaceRow({ entry, onOpen, onNavigate, onRemove }) {
  const campus = entry.kind === 'campus'
  const name = campus ? entry.location.displayName : entry.place.name
  return (
    <li className="flex items-center gap-1 pr-2">
      <div className="min-w-0 flex-1">
        {campus ? (
          <PlaceRow location={entry.location} onSelect={() => onOpen(entry)} savedMark={false} />
        ) : (
          <NearbyPlaceRow place={entry.place} onSelect={() => onOpen(entry)} />
        )}
      </div>
      <IconButton
        icon={Navigation}
        label={campus ? `Navigate to ${name}` : `Navigate to ${name} in Google Maps (opens in a new tab)`}
        variant="ghost"
        onClick={() => onNavigate(entry)}
      />
      <IconButton label={`Remove ${name} from saved places`} variant="ghost" onClick={() => onRemove(entry)}>
        <BookmarkFilled size={20} strokeWidth={2} className="text-navy" aria-hidden />
      </IconButton>
    </li>
  )
}
