import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bot,
  Compass,
  HeartPulse,
  LayoutDashboard,
  Landmark,
  LogOut,
  MapPin,
  Menu,
  MousePointerClick,
  Search,
  Server,
  Tags,
  X,
} from 'lucide-react'
import { auth } from '../lib/auth.js'
import { cn } from '../utils/cn.js'

export const ADMIN_NAV = [
  { items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    group: 'Data',
    items: [
      { to: '/admin/locations', label: 'Campus locations', icon: MapPin },
      { to: '/admin/categories', label: 'Categories', icon: Tags },
      { to: '/admin/health', label: 'Data health', icon: HeartPulse },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/admin/insights/search', label: 'Search analytics', icon: Search },
      { to: '/admin/insights/ai', label: 'AI analytics', icon: Bot },
      { to: '/admin/insights/places', label: 'Place usage', icon: MousePointerClick },
    ],
  },
  {
    group: 'Local discovery',
    items: [
      { to: '/admin/discovery/nearby', label: 'Nearby data', icon: Compass },
      { to: '/admin/discovery/nagpur', label: 'Nagpur explore', icon: Landmark },
    ],
  },
  { group: 'System', items: [{ to: '/admin/system', label: 'System status', icon: Server }] },
]

function Nav({ onNavigate }) {
  return (
    <nav aria-label="Admin" className="space-y-5">
      {ADMIN_NAV.map((section, i) => (
        <div key={section.group ?? i}>
          {section.group && <p className="mb-1.5 px-3 text-micro font-semibold uppercase tracking-wide text-white/40">{section.group}</p>}
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2.5 rounded-control px-3 text-body-sm transition-colors',
                      isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} className={isActive ? 'text-accent' : 'text-white/50'} aria-hidden />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-navy">
        <Activity size={17} strokeWidth={2.5} aria-hidden />
      </span>
      <div className="leading-tight">
        <div className="text-micro font-semibold uppercase tracking-wide text-accent">PCE Navigator</div>
        <div className="text-body-sm font-semibold text-white">Admin</div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function signOut() {
    auth.clearToken()
    navigate('/admin/login')
  }

  const signOutButton = (
    <button type="button" onClick={signOut} className="flex h-9 w-full items-center gap-2.5 rounded-control px-3 text-body-sm text-white/60 hover:bg-white/5 hover:text-white">
      <LogOut size={16} aria-hidden /> Sign out
    </button>
  )

  return (
    <div className="min-h-screen bg-surface-page font-sans text-fg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-nav hidden w-60 flex-col bg-navy px-3 py-5 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <div className="mt-7 flex-1 overflow-y-auto">
          <Nav />
        </div>
        {signOutButton}
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-nav flex h-14 items-center justify-between bg-navy px-4 lg:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-control text-white hover:bg-white/10">
          <Menu size={20} aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-modal lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close admin menu" className="flex h-10 w-10 items-center justify-center rounded-control text-white hover:bg-white/10">
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <Nav onNavigate={() => setOpen(false)} />
            </div>
            {signOutButton}
          </div>
        </div>
      )}

      <main className="px-4 py-5 sm:px-6 lg:ml-60 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1280px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
