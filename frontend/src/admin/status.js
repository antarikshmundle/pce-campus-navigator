import { CircleCheck, CircleSlash, Info, ScanEye, TriangleAlert } from 'lucide-react'

/**
 * The admin's only status vocabulary. Colour always comes with an icon and
 * a label, never alone.
 */
export const STATUS = {
  healthy: { label: 'Healthy', icon: CircleCheck, tone: 'text-success', bg: 'bg-success/10', ring: 'ring-success/25' },
  warning: { label: 'Warning', icon: TriangleAlert, tone: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/30' },
  needs_review: { label: 'Needs review', icon: ScanEye, tone: 'text-info', bg: 'bg-info/10', ring: 'ring-info/25' },
  unavailable: { label: 'Unavailable', icon: CircleSlash, tone: 'text-error', bg: 'bg-error/10', ring: 'ring-error/25' },
  info: { label: 'Info', icon: Info, tone: 'text-fg-secondary', bg: 'bg-surface-alt', ring: 'ring-line' },
}

const RANK = { healthy: 0, info: 0, needs_review: 1, warning: 2, unavailable: 3 }

export function worstStatus(statuses) {
  return statuses.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'healthy')
}

/** Location row flags (from /admin/insights/data-health) → short label + status. */
export const LOCATION_FLAGS = {
  needs_verification: { label: 'Needs verification', status: 'needs_review' },
  invalid_coordinates: { label: 'Invalid coordinates', status: 'warning' },
  missing_name: { label: 'No name', status: 'warning' },
  missing_category: { label: 'No category', status: 'warning' },
  name_whitespace: { label: 'Name spacing', status: 'needs_review' },
  category_variant: { label: 'Category variant', status: 'needs_review' },
  category_whitespace: { label: 'Category spacing', status: 'needs_review' },
  shared_coordinates: { label: 'Shared position', status: 'info' },
  missing_description: { label: 'No description', status: 'info' },
  missing_building: { label: 'No building', status: 'info' },
  missing_floor: { label: 'No floor', status: 'info' },
}

/** Worst status among a row's flags; optional-field flags alone keep a row healthy. */
export function rowStatus(flags = []) {
  return worstStatus(flags.map((f) => LOCATION_FLAGS[f]?.status ?? 'info'))
}
