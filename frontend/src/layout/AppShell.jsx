import { Outlet, useMatch } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { BottomNav } from './BottomNav.jsx'
import { NavRail } from './NavRail.jsx'

/**
 * User-facing app frame. Screens render into <main>, which always fills the
 * space above the mobile bottom bar; on desktop the nav floats over it.
 * Live navigation is full-screen: no app navigation while walking.
 */
export function AppShell() {
  const navigating = Boolean(useMatch('/navigate'))
  return (
    // "user": framer-motion animations respect prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <div className="app-root h-app flex w-full flex-col overflow-hidden bg-surface-page font-sans text-fg">
        <main className="relative min-h-0 flex-1">
          <Outlet />
        </main>
        {!navigating && (
          <>
            <BottomNav className="relative z-nav shrink-0 lg:hidden" />
            <NavRail className="absolute left-4 top-4 z-nav hidden lg:flex" />
          </>
        )}
      </div>
    </MotionConfig>
  )
}
