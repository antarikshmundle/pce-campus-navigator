import { useState } from 'react'
import { Building, Clock, Footprints, Navigation } from 'lucide-react'
import { getCategoryMeta } from '../locations/categoryMeta.js'
import { formatDistance, formatMinutes, travelEstimate } from '../../utils/geo.js'
import { Button } from '../../ui/Button.jsx'
import { SaveButton } from '../saved/SaveButton.jsx'

/**
 * Location detail content — backend fields only. Hierarchy: name →
 * category → building/floor → walk estimate → Navigate (primary) → Save
 * toggle → image / description / hours when present.
 */
export function LocationDetail({ location, origin, onNavigate, onRequestLocation, locating }) {
  const { icon: Icon, label } = getCategoryMeta(location.category)
  const travel = travelEstimate(origin, location.coords)
  const [imageFailed, setImageFailed] = useState(false)
  const whereabouts = [location.building, location.floor && `Floor ${location.floor}`].filter(Boolean).join(' · ')

  return (
    <article className="px-4 pb-4" aria-labelledby="place-title">
      <header className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-navy text-accent">
          <Icon size={22} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="place-title" className="text-heading text-fg">
            {location.displayName}
          </h1>
          <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-micro font-semibold uppercase text-navy">
            <Icon size={12} strokeWidth={2.5} aria-hidden />
            {label}
          </span>
        </div>
      </header>

      <dl className="mt-3 space-y-1.5 text-body-sm">
        {whereabouts && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <Building size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <dd className="text-fg">{whereabouts}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <dt className="sr-only">Walking estimate</dt>
          <Footprints size={16} className="shrink-0 text-fg-muted" aria-hidden />
          <dd>
            {travel ? (
              <span className="text-fg">
                <strong className="font-semibold">{formatMinutes(travel.minutes)}</strong> walk ·{' '}
                {formatDistance(travel.meters)}
                <span className="text-fg-muted"> · direct-line estimate</span>
              </span>
            ) : (
              <span className="text-fg-secondary">
                Distance shows when you're on campus.{' '}
                <button
                  type="button"
                  onClick={onRequestLocation}
                  disabled={locating}
                  className="-my-3 inline-flex min-h-11 items-center font-medium text-info hover:underline disabled:opacity-50"
                >
                  {locating ? 'Locating…' : 'Use my location'}
                </button>
              </span>
            )}
          </dd>
        </div>
        {location.hours && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Hours</dt>
            <Clock size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <dd className="text-fg">{location.hours}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex gap-2">
        <Button icon={Navigation} size="lg" className="flex-1" onClick={onNavigate}>
          Navigate
        </Button>
        <SaveButton key={location.id} location={location} />
      </div>

      {location.imageUrl && !imageFailed && (
        <img
          src={location.imageUrl}
          alt={`Photo of ${location.displayName}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="mt-5 aspect-[16/9] w-full rounded-card bg-surface-alt object-cover"
        />
      )}

      {location.description && (
        <section className="mt-5" aria-labelledby="place-about">
          <h2 id="place-about" className="text-caption font-semibold uppercase tracking-wide text-fg-muted">
            About
          </h2>
          <p className="mt-1.5 text-body text-fg">{location.description}</p>
        </section>
      )}
    </article>
  )
}
