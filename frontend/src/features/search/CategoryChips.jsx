import { LayoutGrid } from 'lucide-react'
import { Chip } from '../../ui/Chip.jsx'
import { getCategoryMeta } from '../locations/categoryMeta.js'
import { cn } from '../../utils/cn.js'

// Chips are 36px tall visually (32px on phones); this invisible extension
// gives a 44px touch target either way.
const HIT_AREA =
  "relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] max-md:h-8 max-md:gap-1 max-md:px-3 max-md:after:-inset-y-1.5"

/**
 * Horizontally scrolling category filter. `value` null = all.
 * Categories come from the API (GET /locations/categories) — never invented.
 */
export function CategoryChips({ categories, value, onChange, elevated = false, className }) {
  return (
    <div
      role="toolbar"
      aria-label="Filter by category"
      className={cn('scrollbar-none flex gap-2 overflow-x-auto max-md:gap-1.5', className)}
    >
      <Chip
        icon={LayoutGrid}
        selected={value === null}
        elevated={elevated}
        className={HIT_AREA}
        onClick={() => onChange(null)}
      >
        All
      </Chip>
      {categories.map((cat) => {
        const meta = getCategoryMeta(cat)
        return (
          <Chip
            key={cat}
            icon={meta.icon}
            selected={value === cat}
            elevated={elevated}
            className={HIT_AREA}
            onClick={() => onChange(value === cat ? null : cat)}
          >
            {meta.label}
          </Chip>
        )
      })}
    </div>
  )
}
