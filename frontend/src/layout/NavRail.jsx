import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, isNavItemActive } from './navItems.js'
import { BrandMark } from './BrandMark.jsx'
import { cn } from '../utils/cn.js'

/**
 * Desktop primary navigation: a compact floating rail, not a sidebar —
 * the map still runs edge to edge underneath it.
 */
export function NavRail({ className }) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Primary"
      className={cn('flex w-rail flex-col items-center gap-2 rounded-sheet bg-surface py-3 shadow-float', className)}
    >
      <BrandMark className="mb-2" />
      {NAV_ITEMS.map((item) => {
        const { to, label, icon: Icon } = item
        const isActive = isNavItemActive(item, pathname)
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className="tap-transparent group flex w-full flex-col items-center gap-1 px-1 py-1.5"
          >
            <span
              className={cn(
                'flex h-9 w-11 items-center justify-center rounded-field transition-colors',
                isActive ? 'bg-accent-soft text-navy' : 'text-fg-secondary group-hover:bg-surface-alt group-hover:text-fg',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
            </span>
            <span className={cn('text-micro', isActive ? 'font-semibold text-fg' : 'text-fg-secondary')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
