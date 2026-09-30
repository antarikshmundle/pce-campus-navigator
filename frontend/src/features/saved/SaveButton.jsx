import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { Button } from '../../ui/Button.jsx'
import { useSavedPlaces } from './SavedPlacesProvider.jsx'

/** Lucide bookmark, filled: the "saved" state wherever it appears. */
export function BookmarkFilled(props) {
  return <Bookmark {...props} fill="currentColor" />
}

/**
 * Save / Saved toggle — a campus `location` or an off-campus `place`
 * (Nearby). Render with a key per place.
 * Changes instantly; the button text is the visible confirmation, and a
 * polite live region tells screen-reader users.
 */
export function SaveButton({ location, place, size = 'lg', className }) {
  const { isSaved, toggle } = useSavedPlaces()
  const target = place ?? location.id
  const saved = isSaved(place ? place.key : location.id)
  const name = place ? place.name : location.displayName
  // Announced only after a tap, never on arrival.
  const [announcement, setAnnouncement] = useState('')

  function handleClick() {
    setAnnouncement(toggle(target) ? `${name} saved` : `${name} removed from saved places`)
  }

  return (
    <>
      <Button
        icon={saved ? BookmarkFilled : Bookmark}
        variant={saved ? 'selected' : 'secondary'}
        size={size}
        className={className}
        onClick={handleClick}
        aria-label={saved ? `Remove ${name} from saved places` : `Save ${name}`}
      >
        {saved ? 'Saved' : 'Save'}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
