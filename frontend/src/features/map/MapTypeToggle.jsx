import { Map as MapIcon, Satellite } from 'lucide-react'
import { IconButton } from '../../ui/IconButton.jsx'
import { cn } from '../../utils/cn.js'

const OPTIONS = [
  { id: 'standard', label: 'Map', icon: MapIcon },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
]

/**
 * Map | Satellite switch.
 * - segmented (desktop): labelled two-option pill
 * - compact (mobile): one 44px button that switches to the other type
 */
export function MapTypeToggle({ value, onChange, variant = 'segmented', disabled = false, className, style }) {
  if (variant === 'compact') {
    const next = OPTIONS.find((o) => o.id !== value)
    return (
      <IconButton
        icon={next.icon}
        label={next.id === 'satellite' ? 'Show satellite view' : 'Show map view'}
        onClick={() => onChange(next.id)}
        disabled={disabled}
        className={className}
        style={style}
      />
    )
  }

  return (
    <div role="group" aria-label="Map type" className={cn('flex rounded-pill bg-surface p-1 shadow-float', className)} style={style}>
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => !active && onChange(id)}
            className={cn(
              'tap-transparent flex h-11 items-center gap-2 rounded-pill px-4 text-body-sm font-semibold transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-navy text-white' : 'text-fg-secondary hover:bg-surface-alt hover:text-fg',
            )}
          >
            <Icon size={18} strokeWidth={2} className={active ? 'text-accent' : undefined} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
