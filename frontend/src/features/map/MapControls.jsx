import { LoaderCircle, Locate, LocateFixed, LocateOff, Minus, Plus, Scan } from 'lucide-react'
import { IconButton } from '../../ui/IconButton.jsx'
import { cn } from '../../utils/cn.js'

const LOCATE = {
  idle: { icon: Locate, label: 'Show my location' },
  locating: { icon: LoaderCircle, label: 'Finding your location…', spin: true },
  ready: { icon: LocateFixed, label: 'Centre on my location', active: true },
  denied: { icon: LocateOff, label: 'Location blocked — tap for details' },
  unavailable: { icon: LocateOff, label: 'Location unavailable — tap to retry' },
}

// Phones: 40px buttons that keep a 44px touch target via an invisible extension.
const PHONE_COMPACT = "max-md:relative max-md:h-10 max-md:w-10 max-md:after:absolute max-md:after:-inset-0.5 max-md:after:content-['']"

/** Floating zoom, whole-campus and current-location controls. */
export function MapControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut, onFitCampus, locateStatus, onLocate, className }) {
  const locate = LOCATE[locateStatus] ?? LOCATE.idle
  const LocateIcon = locate.icon

  return (
    <div className={cn('flex flex-col items-center gap-3 max-md:gap-2', className)}>
      {/* overflow-visible on phones so the zoom buttons' touch extension isn't clipped */}
      <div className="flex flex-col overflow-hidden rounded-pill bg-surface shadow-float max-md:overflow-visible">
        <IconButton icon={Plus} label="Zoom in" variant="ghost" onClick={onZoomIn} disabled={!canZoomIn} className={PHONE_COMPACT} />
        <span className="mx-auto h-px w-6 bg-line max-md:w-5" aria-hidden />
        <IconButton icon={Minus} label="Zoom out" variant="ghost" onClick={onZoomOut} disabled={!canZoomOut} className={PHONE_COMPACT} />
      </div>

      <IconButton icon={Scan} label="Show whole campus" onClick={onFitCampus} className={PHONE_COMPACT} />

      <IconButton
        label={locate.label}
        onClick={onLocate}
        disabled={locateStatus === 'locating'}
        active={locate.active}
        className={PHONE_COMPACT}
      >
        <LocateIcon size={20} strokeWidth={2} className={locate.spin ? 'animate-spin' : undefined} aria-hidden />
      </IconButton>
    </div>
  )
}
