import { useCallback, useEffect, useRef } from 'react'
import { track } from '../../lib/analytics.js'

const SETTLE_MS = 1500
const MIN_LENGTH = 2

/**
 * Search is live (no submit step), so a search counts once the text has
 * stayed the same for SETTLE_MS — not on every keystroke. The same text is
 * not counted twice in a row. Returns `commit()` to count the current text
 * right away (e.g. when a result is opened before it settled).
 */
export function useSearchTracking(eventType, query, resultCount, ready = true) {
  const last = useRef('')
  const pending = useRef(null)
  const text = query.trim()

  pending.current = ready && text.length >= MIN_LENGTH ? { text, resultCount } : null

  useEffect(() => {
    if (!pending.current) return undefined
    const t = setTimeout(() => {
      const p = pending.current
      if (p && p.text !== last.current) {
        last.current = p.text
        track(eventType, { query: p.text, resultCount: p.resultCount })
      }
    }, SETTLE_MS)
    return () => clearTimeout(t)
  }, [eventType, text, resultCount, ready])

  return useCallback(() => {
    const p = pending.current
    if (p && p.text !== last.current) {
      last.current = p.text
      track(eventType, { query: p.text, resultCount: p.resultCount })
    }
  }, [eventType])
}
