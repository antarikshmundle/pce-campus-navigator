import { cn } from '../utils/cn.js'

/**
 * Selectable pill. `elevated` adds a shadow for chips floating directly
 * over the map; flat chips are for use inside panels.
 */
export function Chip({ icon: Icon, selected = false, elevated = false, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'tap-transparent inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-caption font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface',
        selected
          ? 'bg-navy text-white'
          : cn('bg-surface text-fg hover:bg-surface-alt', elevated ? 'shadow-card' : 'border border-line'),
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          size={15}
          strokeWidth={2.25}
          className={selected ? 'text-accent' : 'text-fg-secondary'}
          aria-hidden
        />
      )}
      {children}
    </button>
  )
}
