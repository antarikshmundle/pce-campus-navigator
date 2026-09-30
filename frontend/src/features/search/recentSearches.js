import { useCallback, useState } from 'react'

/**
 * On-device recent searches: the IDs of places the user opened from search.
 *
 * Deliberately minimal — never stores typed text, never records browsing
 * (marker taps, list browsing, direct links), max 5 entries, one-tap clear.
 * Every storage access is guarded: private mode / blocked storage simply
 * means no recents, never a broken page.
 */
const STORAGE_KEY = 'pce_recent_places'
const MAX_RECENTS = 5

function read() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(Number.isInteger).slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function write(ids) {
  try {
    if (ids.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — keep the in-memory list for this session */
  }
}

/** { ids, add(id), clear() } — most recent first. */
export function useRecentPlaceIds() {
  const [ids, setIds] = useState(read)

  const add = useCallback((id) => {
    setIds((current) => {
      const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENTS)
      write(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    write([])
    setIds([])
  }, [])

  return { ids, add, clear }
}
