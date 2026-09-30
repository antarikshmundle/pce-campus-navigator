import { Bookmark, Compass, MapPinned, UserRound } from 'lucide-react'

/** Primary user destinations — shared by the mobile bottom bar and desktop rail. */
export const NAV_ITEMS = [
  // Place detail and route preview are part of the Explore (map) flow.
  { to: '/', label: 'Explore', icon: Compass, activeFor: ['/place/', '/route'] },
  { to: '/nearby', label: 'Nearby', icon: MapPinned },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function isNavItemActive(item, pathname) {
  if (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)) return true
  return Boolean(item.activeFor?.some((prefix) => pathname.startsWith(prefix)))
}
