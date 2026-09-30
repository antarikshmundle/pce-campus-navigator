import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../utils/cn.js'

/**
 * Transient floating message (e.g. "Location permission denied").
 * `notice` is `{ id, text }` or null; auto-dismisses after `duration` ms.
 */
export function Notice({ notice, onDismiss, duration = 4000, className, style }) {
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [notice, onDismiss, duration])

  return (
    <div className={cn('pointer-events-none flex justify-center', className)} style={style} role="status" aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-pill bg-navy py-2 pl-4 pr-2 text-caption text-white shadow-float"
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="flex h-7 w-7 items-center justify-center rounded-pill text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X size={14} aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
