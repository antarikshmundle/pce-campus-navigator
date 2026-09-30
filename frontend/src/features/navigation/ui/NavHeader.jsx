import { X } from 'lucide-react'
import { IconButton } from '../../../ui/IconButton.jsx'
import { cn } from '../../../utils/cn.js'

const TONES = {
  ok: 'bg-success',
  warn: 'bg-warning',
  error: 'bg-error',
  idle: 'bg-fg-muted',
}

/** Compact top bar: exit, destination, route status. */
export function NavHeader({ destinationName, status, onExit, className }) {
  return (
    <header className={cn('flex items-center gap-1 rounded-card bg-surface py-1.5 pl-1.5 pr-3 shadow-float', className)}>
      <IconButton icon={X} label="Exit navigation" variant="ghost" onClick={onExit} />
      <div className="min-w-0 flex-1">
        <p className="text-micro font-semibold uppercase tracking-wide text-fg-muted">Walking to</p>
        <p className="truncate text-title text-fg">{destinationName}</p>
      </div>
      {status && (
        <span role="status" className="flex shrink-0 items-center gap-1.5 text-caption font-medium text-fg-secondary">
          <span className={cn('h-2 w-2 rounded-pill', TONES[status.tone])} aria-hidden />
          {status.label}
        </span>
      )}
    </header>
  )
}
