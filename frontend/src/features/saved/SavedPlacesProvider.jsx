import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useCampusData } from '../locations/CampusDataProvider.jsx'
import {
  RECENT_KEY,
  SAVED_KEY,
  addSaved,
  fromRecord,
  keyFor,
  normalizeExternalId,
  normalizeId,
  pushRecent,
  readRecent,
  readSaved,
  refKey,
  removeSaved,
  restoreSaved,
  toRecord,
  writeRecent,
  writeSaved,
} from './savedPlaces.js'

const SavedPlacesContext = createContext(null)

/** Campus id (number) or an off-campus place object → stored ref, or null. */
function toRef(value) {
  const id = normalizeId(value)
  if (id != null) return { source: 'campus', id }
  const extId = normalizeExternalId(value?.key)
  const place = extId && toRecord(value)
  return place ? { source: value.source === 'nagpur' ? 'nagpur' : 'external', id: extId, place } : null
}

/** A value's lookup key: campus id, off-campus key string, or a place object. */
const lookupKey = (value) => (typeof value === 'object' && value ? keyFor(value.key) : keyFor(value))

/**
 * Saved and recently viewed places for this device — campus and off-campus —
 * shared by every screen so a change shows everywhere at once.
 *
 * Storage is read once on start (and again only when another tab changes
 * it); each change writes only when the list actually changed.
 *
 * Campus IDs are checked against the canonical locations once they load:
 * unknown IDs are dropped. While locations are loading or failed to load,
 * nothing is dropped — a network error must never erase saved places.
 * Off-campus entries are validated on read (see savedPlaces.js).
 *
 * Methods take a campus id (number), or for off-campus places the place
 * object (save / toggle / recordVisit) or its key (isSaved / remove).
 */
export function SavedPlacesProvider({ children }) {
  const { locations, status } = useCampusData()
  const [saved, setSaved] = useState(readSaved)
  const [recent, setRecent] = useState(readRecent)
  const savedRef = useRef(saved)
  const recentRef = useRef(recent)

  const commitSaved = useCallback((next) => {
    if (next === savedRef.current) return
    savedRef.current = next
    setSaved(next)
    writeSaved(next)
  }, [])

  const commitRecent = useCallback((next) => {
    if (next === recentRef.current) return
    recentRef.current = next
    setRecent(next)
    writeRecent(next)
  }, [])

  // Another tab saved/unsaved something: adopt its lists.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SAVED_KEY || e.key === null) {
        savedRef.current = readSaved()
        setSaved(savedRef.current)
      }
      if (e.key === RECENT_KEY || e.key === null) {
        recentRef.current = readRecent()
        setRecent(recentRef.current)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations])
  const validated = status === 'ready' && locations.length > 0
  const known = useCallback((ref) => ref.source !== 'campus' || byId.has(ref.id), [byId])

  // Drop campus IDs that are no longer campus places.
  useEffect(() => {
    if (!validated) return
    const keptSaved = savedRef.current.filter(known)
    if (keptSaved.length !== savedRef.current.length) commitSaved(keptSaved)
    const keptRecent = recentRef.current.filter(known)
    if (keptRecent.length !== recentRef.current.length) commitRecent(keptRecent)
  }, [validated, known, commitSaved, commitRecent, saved, recent])

  const savedKeys = useMemo(() => new Set(saved.map(refKey)), [saved])
  const isSaved = useCallback((value) => savedKeys.has(lookupKey(value)), [savedKeys])

  const save = useCallback(
    (value) => {
      const ref = toRef(value)
      if (ref) commitSaved(addSaved(savedRef.current, ref))
    },
    [commitSaved],
  )

  /** Returns the removed record (for undo), or null. */
  const remove = useCallback(
    (value) => {
      const key = lookupKey(value)
      const record = savedRef.current.find((item) => refKey(item) === key) ?? null
      if (record) commitSaved(removeSaved(savedRef.current, key))
      return record
    },
    [commitSaved],
  )

  const restore = useCallback((record) => commitSaved(restoreSaved(savedRef.current, record)), [commitSaved])

  /** Returns true when the place is now saved. */
  const toggle = useCallback(
    (value) => {
      const key = lookupKey(value)
      if (!key) return false
      if (savedRef.current.some((item) => refKey(item) === key)) {
        remove(value)
        return false
      }
      save(value)
      return savedRef.current.some((item) => refKey(item) === key)
    },
    [save, remove],
  )

  const clear = useCallback(() => commitSaved([]), [commitSaved])

  /** A place was actually opened (a detail screen) — not hovered or listed. */
  const recordVisit = useCallback(
    (value) => {
      const ref = toRef(value)
      if (ref) commitRecent(pushRecent(recentRef.current, ref))
    },
    [commitRecent],
  )

  const clearRecent = useCallback(() => commitRecent([]), [commitRecent])

  // Resolved entries (only known places), most recent first:
  // { key, kind: 'campus', location } | { key, kind: 'external', place }
  const resolve = useCallback(
    (ref) => {
      if (ref.source === 'campus') {
        const location = byId.get(ref.id)
        return location ? { key: refKey(ref), kind: 'campus', location } : null
      }
      return { key: refKey(ref), kind: 'external', place: fromRecord(ref) }
    },
    [byId],
  )
  const savedEntries = useMemo(() => saved.map(resolve).filter(Boolean), [saved, resolve])
  const recentEntries = useMemo(() => recent.map(resolve).filter(Boolean), [recent, resolve])

  const value = useMemo(
    () => ({
      savedCount: saved.length,
      savedEntries,
      recentEntries,
      isSaved,
      save,
      remove,
      restore,
      toggle,
      clear,
      recordVisit,
      clearRecent,
    }),
    [saved.length, savedEntries, recentEntries, isSaved, save, remove, restore, toggle, clear, recordVisit, clearRecent],
  )

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext)
  if (!ctx) throw new Error('useSavedPlaces must be used inside <SavedPlacesProvider>')
  return ctx
}

/** Saved state of one place; false outside the provider (rows are shared UI). */
export function useIsSaved(id) {
  return useContext(SavedPlacesContext)?.isSaved(id) ?? false
}
