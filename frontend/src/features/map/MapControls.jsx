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

/** Floating zoom, whole-campus and current-location controls. */
export function MapControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut, onFitCampus, locateStatus, onLocate, className }) {
  const locate = LOCATE[locateStatus] ?? LOCATE.idle
  const LocateIcon = locate.icon

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex flex-col overflow-hidden rounded-pill bg-surface shadow-float">
        <IconButton icon={Plus} label="Zoom in" variant="ghost" onClick={onZoomIn} disabled={!canZoomIn} />
        <span className="mx-auto h-px w-6 bg-line" aria-hidden />
        <IconButton icon={Minus} label="Zoom out" variant="ghost" onClick={onZoomOut} disabled={!canZoomOut} />
      </div>

      <IconButton icon={Scan} label="Show whole campus" onClick={onFitCampus} />

      <IconButton
        label={locate.label}
        onClick={onLocate}
        disabled={locateStatus === 'locating'}
        active={locate.active}
      >
        <LocateIcon size={20} strokeWidth={2} className={locate.spin ? 'animate-spin' : undefined} aria-hidden />
      </IconButton>
    </div>
  )
}
