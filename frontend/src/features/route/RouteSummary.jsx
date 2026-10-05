import { Footprints, Info, RotateCw, TriangleAlert } from 'lucide-react'
import { formatDistance, formatDuration } from '../../utils/geo.js'
import { isWalkingRoute } from '../navigation/routing/routeTypes.js'
import { ManeuverIcon } from '../navigation/ui/ManeuverIcon.jsx'
import { Skeleton } from '../../ui/Skeleton.jsx'
import { cn } from '../../utils/cn.js'

// Gaps smaller than this between a place and the mapped path aren't worth a note.
const GAP_NOTE_METERS = 30

/**
 * Time / distance headline, labelled as a Google walking route or a direct-line estimate.
 * `headline={false}`: only the notes (the time/distance is shown elsewhere, e.g. the mobile Start bar).
 */
export function RouteSummary({ status, result, route, destinationName, onRetry, headline = true }) {
  if (status === 'loading' && !route) {
    if (!headline) return null
    return (
      <div className="space-y-2 px-4" aria-busy="true">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }
  if (result?.status === 'invalid') {
    return (
      <p className="mx-4 flex gap-1.5 rounded-control bg-warning/10 px-2.5 py-2 text-caption text-fg">
        <TriangleAlert size={14} className="mt-px shrink-0 text-warning" aria-hidden />
        A walking route can't be planned between these places.
      </p>
    )
  }
  if (!route) return null

  const walking = isWalkingRoute(route)
  const endGap = route.gaps?.end ?? 0

  return (
    <div className="px-4" aria-live="polite">
      {headline && (
        <p className="flex items-baseline gap-2">
          <span className="text-heading-lg text-fg">{formatDuration(route.durationSeconds)}</span>
          <span className="text-body text-fg-secondary">
            walk · {formatDistance(route.distanceMeters)}
            {!walking && ' direct'}
          </span>
        </p>
      )}

      {walking ? (
        <p className={cn('flex gap-1.5 text-caption text-fg-secondary', headline && 'mt-1.5')}>
          <Footprints size={14} className="mt-px shrink-0 text-fg-muted" aria-hidden />
          <span>
            Google walking route. It follows mapped roads and paths, so it may not include every campus shortcut.
            {endGap > GAP_NOTE_METERS &&
              ` The mapped path ends about ${formatDistance(endGap)} from ${destinationName ?? 'the destination'} (dotted).`}
          </span>
        </p>
      ) : (
        <div className={cn('rounded-control bg-warning/10 px-2.5 py-2 text-caption text-fg', headline && 'mt-2')}>
          <p className="flex gap-1.5">
            <Info size={14} className="mt-px shrink-0 text-warning" aria-hidden />
            <span>
              <strong className="font-semibold">Walking route unavailable. Showing direct-line estimate.</strong> The dashed
              line shows direction only — not the path to walk.
            </span>
          </p>
          {onRetry && status !== 'loading' && (
            <button
              type="button"
              onClick={onRetry}
              className="-mb-1 ml-5 mt-1 inline-flex min-h-9 items-center gap-1.5 font-medium text-info hover:underline"
            >
              <RotateCw size={13} aria-hidden />
              Try again
            </button>
          )}
        </div>
      )}

      {route.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {route.warnings.map((w) => (
            <li key={w} className="flex gap-1.5 rounded-control bg-warning/10 px-2.5 py-2 text-caption text-fg">
              <TriangleAlert size={14} className="mt-px shrink-0 text-warning" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Google's walking steps, in order. `activeIndex` highlights the current one (navigation). */
export function RouteSteps({ steps, activeIndex = -1, title = 'Directions', className }) {
  if (!steps?.length) return null
  return (
    <section className={cn('px-4', className)}>
      {title && <h3 className="text-caption font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>}
      <ol className="mt-2 space-y-1">
        {steps.map((step, i) => (
          <li
            key={i}
            aria-current={i === activeIndex ? 'step' : undefined}
            className={cn(
              'flex gap-3 rounded-field px-2 py-1.5 text-body-sm',
              i === activeIndex ? 'bg-accent-soft text-fg' : i < activeIndex ? 'text-fg-muted' : 'text-fg',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-surface-alt text-navy">
              <ManeuverIcon maneuver={step.maneuver} size={16} />
            </span>
            <span className="min-w-0 flex-1 pt-1">{step.instruction}</span>
            {step.distanceMeters >= 1 && (
              <span className="shrink-0 pt-1 text-caption text-fg-secondary">{formatDistance(step.distanceMeters)}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
