import { motion } from 'framer-motion'
import { getCategoryMeta } from '../../locations/categoryMeta.js'
import { cn } from '../../../utils/cn.js'

/**
 * A location pin. Rendered inside the zoomed map layer, so it receives the
 * inverse zoom (`counterScale`) to keep a constant on-screen size.
 */
export function MapMarker({ location, position, selected, dimmed, counterScale, onSelect }) {
  const { icon: Icon } = getCategoryMeta(location.category)

  return (
    <motion.div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        scale: counterScale,
        zIndex: selected ? 2 : 1,
        transformOrigin: '0 0',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(location.id)}
        aria-label={location.displayName}
        aria-pressed={selected}
        className={cn(
          'tap-transparent group absolute flex -translate-x-1/2 flex-col items-center transition-opacity',
          selected ? '-translate-y-full' : '-translate-y-1/2',
          dimmed && !selected && 'opacity-35',
        )}
      >
        {selected ? (
          <>
            <span className="mb-1.5 whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 text-caption font-semibold text-fg shadow-float">
              {location.displayName}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-pill border-[3px] border-surface bg-navy text-accent shadow-pin">
              <Icon size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="-mt-1 h-2.5 w-2.5 rotate-45 bg-navy" aria-hidden />
          </>
        ) : (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-pill border-2 border-surface bg-surface text-navy shadow-pin transition-transform group-hover:scale-110">
              <Icon size={15} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="pointer-events-none absolute top-full mt-1 hidden whitespace-nowrap rounded-control bg-navy px-2 py-0.5 text-micro font-medium text-white group-hover:block">
              {location.displayName}
            </span>
          </>
        )}
      </button>
    </motion.div>
  )
}

export function UserMarker({ position, counterScale }) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: position.x, top: position.y, scale: counterScale, transformOrigin: '0 0', zIndex: 3 }}
      aria-label="Your location"
    >
      <span className="absolute -left-6 -top-6 h-12 w-12 animate-ping rounded-pill bg-info/20" />
      <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-pill border-[3px] border-surface bg-info shadow-pin" />
    </motion.div>
  )
}
