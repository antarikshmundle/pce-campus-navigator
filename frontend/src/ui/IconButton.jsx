import { forwardRef } from 'react'
import { cn } from '../utils/cn.js'

const VARIANTS = {
  // Floating map controls: white chip over the map.
  float: 'bg-surface text-fg shadow-float hover:bg-surface-alt',
  ghost: 'bg-transparent text-fg-secondary hover:bg-surface-alt hover:text-fg',
  accent: 'bg-accent text-navy shadow-float hover:bg-accent-dark',
  dark: 'bg-navy text-white shadow-float hover:bg-navy-800',
}

// All sizes ≥ 40px; `md`/`lg` meet the 44px touch-target guideline.
const SIZES = {
  sm: 'h-10 w-10',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
}

const ICON_SIZES = { sm: 18, md: 20, lg: 22 }

/** Icon-only button. `label` is required: it becomes the accessible name. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'float', size = 'md', shape = 'circle', active = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'tap-transparent inline-flex shrink-0 items-center justify-center transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        shape === 'circle' ? 'rounded-pill' : 'rounded-field',
        VARIANTS[variant],
        SIZES[size],
        active && 'text-info',
        className,
      )}
      {...props}
    >
      {children ?? <Icon size={ICON_SIZES[size]} strokeWidth={2} aria-hidden />}
    </button>
  )
})
