import { useState } from 'react'
import { ChevronDown, ChevronUp, Route, SignalLow, TriangleAlert, Volume2, VolumeX } from 'lucide-react'
import { formatDistance, formatDuration } from '../../../utils/geo.js'
import { cn } from '../../../utils/cn.js'
import { IconButton } from '../../../ui/IconButton.jsx'
import { RouteSteps } from '../../route/RouteSummary.jsx'
import { ManeuverIcon } from './ManeuverIcon.jsx'

function maneuverDistance(meters) {
  if (meters < 10) return 'Now'
  return formatDistance(meters)
}

function arrivalClock(seconds) {
  return new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-micro uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="truncate text-body font-semibold text-fg">{value}</dd>
    </div>
  )
}

/** Warning / info strip at the top of the card. */
export function GuidanceBanner({ tone = 'warn', icon: Icon = TriangleAlert, title, children }) {
  return (
    <div
      role="alert"
      className={cn('mb-3 flex gap-2 rounded-field px-3 py-2.5', tone === 'warn' ? 'bg-warning/10' : 'bg-surface-alt')}
    >
      <Icon size={18} className={cn('mt-px shrink-0', tone === 'warn' ? 'text-warning' : 'text-fg-secondary')} aria-hidden />
      <div className="min-w-0 text-body-sm">
        <p className="font-semibold text-fg">{title}</p>
        {children && <p className="text-fg-secondary">{children}</p>}
      </div>
    </div>
  )
}

/**
 * Turn-by-turn card: next maneuver, distance to it, remaining time /
 * distance / arrival time, voice + overview controls and the step list.
 */
export function GuidanceCard({ session, waiting, voice, onOverview, banner }) {
  const [showSteps, setShowSteps] = useState(false)
  const { upcoming, route, progress, remainingMeters, remainingSeconds, weakSignal } = session
  if (!upcoming || !route) return null

  return (
    <section aria-label="Navigation guidance">
      {banner}
      {!banner && weakSignal && (
        <GuidanceBanner tone="info" icon={SignalLow} title="Weak GPS signal">
          Your position may be off by more than 60 m.
        </GuidanceBanner>
      )}

      <div className="flex items-center gap-4" aria-live="polite" aria-atomic="true">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-navy text-accent">
          <ManeuverIcon maneuver={upcoming.maneuver} size={34} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-heading-lg text-fg">{waiting ? formatDistance(upcoming.distanceMeters) : maneuverDistance(upcoming.distanceMeters)}</p>
          <p className="line-clamp-2 text-title text-fg">{upcoming.instruction}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-field bg-surface-alt">
        <Stat label="Remaining" value={formatDuration(remainingSeconds)} />
        <Stat label="Distance" value={formatDistance(remainingMeters)} />
        <Stat label="Arrival" value={arrivalClock(remainingSeconds)} />
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSteps((v) => !v)}
          aria-expanded={showSteps}
          className="tap-transparent flex h-11 flex-1 items-center justify-center gap-1.5 rounded-field bg-surface-alt text-body-sm font-semibold text-fg hover:bg-line"
        >
          {showSteps ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
          {showSteps ? 'Hide steps' : `All steps (${route.steps.length})`}
        </button>
        <IconButton icon={Route} label="Show whole route" variant="ghost" className="bg-surface-alt" onClick={onOverview} />
        {voice.supported && (
          <IconButton
            icon={voice.muted ? VolumeX : Volume2}
            label={voice.muted ? 'Unmute voice guidance' : 'Mute voice guidance'}
            aria-pressed={voice.muted}
            variant="ghost"
            className="bg-surface-alt"
            onClick={voice.toggleMuted}
          />
        )}
      </div>

      {showSteps && (
        <RouteSteps
          steps={route.steps}
          activeIndex={progress?.stepIndex ?? 0}
          title={null}
          className="-mx-2 mt-2 max-h-[38vh] overflow-y-auto overscroll-contain px-0 lg:max-h-[45vh]"
        />
      )}

      <p className="mt-3 text-micro text-fg-muted">
        Google walking route · follows mapped roads and paths, which may not include every campus shortcut.
      </p>
    </section>
  )
}
