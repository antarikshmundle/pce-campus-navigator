import { forwardRef } from 'react'
import { cn } from '../utils/cn.js'

const VARIANTS = {
  primary: 'bg-accent text-navy hover:bg-accent-dark active:bg-accent-dark',
  dark: 'bg-navy text-white hover:bg-navy-800 active:bg-navy-700',
  secondary: 'bg-surface-alt text-fg hover:bg-line',
  ghost: 'bg-transparent text-fg hover:bg-surface-alt',
  // On/active state of a toggle (e.g. a saved place).
  selected: 'bg-accent-soft text-navy hover:bg-accent/25',
}

const SIZES = {
  sm: 'h-9 px-3 text-caption gap-1.5',
  md: 'h-11 px-4 text-body-sm gap-2',
  lg: 'h-12 px-5 text-body gap-2',
}

/** Renders an <a> when `href` is given (e.g. external links), otherwise a <button>. */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, className, children, href, ...props },
  ref,
) {
  const Tag = href ? 'a' : 'button'
  const tagProps = href ? { href } : { type: 'button' }

  return (
    <Tag
      ref={ref}
      {...tagProps}
      className={cn(
        'tap-transparent inline-flex items-center justify-center rounded-field font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />}
      {children}
    </Tag>
  )
})
