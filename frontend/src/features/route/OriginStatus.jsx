import { LoaderCircle, LocateFixed, LocateOff, MapPinOff, TriangleAlert } from 'lucide-react'
import { navConfig } from '../navigation/navConfig.js'
import { formatDistance } from '../../utils/geo.js'
import { Button } from '../../ui/Button.jsx'
import { cn } from '../../utils/cn.js'

// Closer than this, "You're near X" needs no distance.
const AT_PLACE_METERS = 30

const isBlocked = (geo) => geo.status === 'denied' || (geo.permission === 'denied' && geo.status !== 'ready')

/**
 * Short label for the "My current location" option, or null when it's usable.
 * `origin` is the on-campus position from MapLayout (null off campus).
 */
export function myLocationNote(geo, origin) {
  if (!geo.supported || geo.status === 'unavailable') return 'unavailable'
  if (isBlocked(geo)) return 'blocked'
  if (geo.status === 'locating') return 'locating…'
  if (geo.status === 'ready' && !origin) return 'off campus'
  return null
}

/** True when OriginStatus shows a message the user should act on (the mobile sheet makes room for it). */
export function originNeedsAttention(geo, origin) {
  if (!geo.supported || isBlocked(geo) || geo.status === 'unavailable') return true
  return geo.status === 'ready' && (!origin || origin.accuracy > navConfig.poorAccuracyMeters)
}

/**
 * State of "My current location" as the route start, under the pickers:
 * where the user is (nearest campus place), or what's stopping it — always
 * with a way to the manual start picker (`onChooseStart`).
 *
 * - near: { location, meters } nearest campus place to `origin`, or null
 */
export function OriginStatus({ geo, origin, near, onLocate, onChooseStart }) {
  const choose = <ActionLink onClick={onChooseStart}>Choose a starting point instead</ActionLink>

  if (!geo.supported) {
    return (
      <Row icon={LocateOff} tone="warn" actions={choose}>
        This browser can't share its location.
      </Row>
    )
  }
  if (isBlocked(geo)) {
    return (
      <Row icon={LocateOff} tone="warn" actions={choose}>
        Location access is blocked in your browser.
      </Row>
    )
  }
  if (geo.status === 'unavailable') {
    return (
      <Row
        icon={LocateOff}
        tone="warn"
        actions={
          <>
            <ActionLink onClick={onLocate}>Try again</ActionLink>
            {choose}
          </>
        }
      >
        Couldn't get your exact location.
      </Row>
    )
  }
  if (geo.status === 'locating') {
    return (
      <Row icon={LoaderCircle} spin>
        Finding your location…
      </Row>
    )
  }
  if (geo.status === 'idle') {
    return (
      <div className="px-4">
        <Button variant="secondary" size="md" icon={LocateFixed} onClick={onLocate} className="w-full">
          Use my current location
        </Button>
      </div>
    )
  }
  if (!origin) {
    return (
      <Row icon={MapPinOff} actions={choose}>
        You're off campus. Google Maps can still guide you from here.
      </Row>
    )
  }

  const lowAccuracy = origin.accuracy > navConfig.poorAccuracyMeters
  return (
    <div className="space-y-2">
      {near && (
        <p role="status" className="flex items-center gap-2 px-4 text-body-sm text-fg-secondary">
          <LocateFixed size={16} strokeWidth={2.25} className="shrink-0 text-info" aria-hidden />
          <span className="min-w-0">
            You're near <span className="font-semibold text-fg">{near.location.displayName}</span>
            {near.meters >= AT_PLACE_METERS && <span className="text-fg-muted"> · {formatDistance(near.meters)} away</span>}
          </span>
        </p>
      )}
      {lowAccuracy && (
        <Row icon={TriangleAlert} tone="warn" actions={choose}>
          Location accuracy is low (±{Math.round(origin.accuracy)} m). Choose a starting point if needed.
        </Row>
      )}
    </div>
  )
}

function Row({ icon: Icon, spin = false, tone = 'neutral', actions, children }) {
  const warn = tone === 'warn'
  return (
    <div
      role="status"
      className={cn('mx-4 flex gap-2 rounded-field px-3 py-2.5 text-body-sm', warn ? 'bg-warning/10 text-fg' : 'bg-surface-alt text-fg-secondary')}
    >
      <Icon
        size={16}
        strokeWidth={2.25}
        className={cn('mt-0.5 shrink-0', warn ? 'text-warning' : 'text-fg-muted', spin && 'animate-spin')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p>{children}</p>
        {actions && <div className="-mb-1.5 mt-0.5 flex flex-wrap gap-x-4">{actions}</div>}
      </div>
    </div>
  )
}

function ActionLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center font-medium text-info hover:underline">
      {children}
    </button>
  )
}
