import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, isNavItemActive } from './navItems.js'
import { cn } from '../utils/cn.js'

/** Mobile/tablet primary navigation. Hidden at `lg` where NavRail takes over. */
export function BottomNav({ className }) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Primary"
      className={cn('border-t border-line bg-surface pb-safe', className)}
    >
      <ul className="mx-auto flex h-nav max-w-md items-stretch max-md:h-14">
        {NAV_ITEMS.map((item) => {
          const { to, label, icon: Icon } = item
          const isActive = isNavItemActive(item, pathname)
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className="tap-transparent group flex h-full flex-col items-center justify-center gap-1 max-md:gap-0.5"
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-pill transition-colors',
                    isActive ? 'bg-accent-soft text-navy' : 'text-fg-muted group-hover:text-fg-secondary',
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                </span>
                <span className={cn('text-micro', isActive ? 'font-semibold text-fg' : 'text-fg-secondary')}>
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
