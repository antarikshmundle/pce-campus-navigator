/**
 * On-device persistence for saved and recently viewed places.
 *
 * Campus places are stored by canonical location ID only (details always
 * come from CampusDataProvider). Off-campus places (Nearby) have no campus
 * record, so they carry a minimal public record of the place itself —
 * name, category, coordinates, address — never anything about the user.
 *
 * Formats (version 2, most recent first):
 *   pce-navigator:saved-places     { "version": 2, "items": [
 *       { "source": "campus", "id": 33, "savedAt": 1760000001000 },
 *       { "source": "external", "id": "osm-n123", "savedAt": 1760000000000,
 *         "place": { "name": "…", "category": "cafe", "lat": 21.1, "lng": 79.0, "address": null } } ] }
 *   pce-navigator:recent-place-ids { "version": 2, "items": [{ "source": "campus", "id": 54 }, …] }
 * `source` is "campus", "external" (around PCE) or "nagpur" (city attraction).
 *
 * Older data is migrated on read: Stage 9 v1 ({ version: 1, items: [{ id, savedAt }] }
 * and { version: 1, ids: [...] }) and bare ID arrays are campus places.
 * Missing, malformed or unknown data reads as an empty list, and every access
 * is guarded: blocked storage means in-memory lists for this visit, never a broken page.
 */
import { NAGPUR_BOUNDS } from '../nearby/providers/osm.js'

export const SAVED_KEY = 'pce-navigator:saved-places'
export const RECENT_KEY = 'pce-navigator:recent-place-ids'
const VERSION = 2
export const MAX_RECENT = 8
// Far above realistic use — only guards against runaway storage.
const MAX_SAVED = 200
const EXTERNAL_SOURCES = new Set(['external', 'nagpur'])

/** Canonical campus IDs are positive integers; numeric strings are accepted. */
export function normalizeId(value) {
  const id = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Off-campus place keys look like "osm-n123". */
export function normalizeExternalId(value) {
  return typeof value === 'string' && /^[a-z]+-[a-z0-9]{1,40}$/i.test(value) ? value : null
}

/** Stable map key for any place reference. */
export const refKey = (ref) => (ref.source === 'campus' ? `c:${ref.id}` : `x:${ref.id}`)

/** A number / numeric string is a campus place; any other valid key is off-campus. */
export function keyFor(value) {
  const campus = normalizeId(value)
  if (campus != null) return `c:${campus}`
  const ext = normalizeExternalId(value)
  return ext ? `x:${ext}` : null
}

function validRecord(p) {
  if (!p || typeof p.name !== 'string' || !p.name.trim() || typeof p.category !== 'string') return null
  const { lat, lng } = p
  const b = NAGPUR_BOUNDS
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < b.south || lat > b.north || lng < b.west || lng > b.east) return null
  return {
    name: p.name.trim().slice(0, 200),
    category: p.category.slice(0, 40),
    lat,
    lng,
    address: typeof p.address === 'string' ? p.address.slice(0, 300) : null,
  }
}

/** External place (app shape) → minimal stored record. */
export function toRecord(place) {
  return validRecord({ name: place?.name, category: place?.category, lat: place?.coords?.lat, lng: place?.coords?.lng, address: place?.address })
}

/** Stored ref → external place (app shape), or null. */
export function fromRecord(ref) {
  const p = ref.place
  return p
    ? { key: ref.id, source: ref.source, provider: ref.id.split('-')[0], name: p.name, category: p.category, coords: { lat: p.lat, lng: p.lng }, address: p.address }
    : null
}

/** Any stored entry → { source, id, place? } or null. */
function toRef(entry) {
  const source = entry?.source ?? 'campus'
  if (source === 'campus') {
    const id = normalizeId(entry?.id ?? entry)
    return id == null ? null : { source, id }
  }
  if (!EXTERNAL_SOURCES.has(source)) return null
  const id = normalizeExternalId(entry.id)
  const place = validRecord(entry.place)
  return id && place ? { source, id, place } : null
}

function uniqueRefs(entries) {
  const seen = new Set()
  const out = []
  for (const entry of entries) {
    const ref = toRef(entry)
    if (!ref || seen.has(refKey(ref))) continue
    seen.add(refKey(ref))
    out.push({ ref, entry })
  }
  return out
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full — keep the in-memory state for this visit */
  }
}

// --- Saved places: [{ source, id, savedAt, place? }], most recently saved first.

export function readSaved() {
  const data = readJson(SAVED_KEY)
  let entries = null
  if (Array.isArray(data)) entries = data.map((id) => ({ id }))
  else if (data?.version === 1 || data?.version === VERSION) entries = data.items
  if (!Array.isArray(entries)) return []
  const items = uniqueRefs(entries).map(({ ref, entry }) => ({
    ...ref,
    savedAt: Number.isFinite(entry?.savedAt) && entry.savedAt > 0 ? entry.savedAt : 0,
  }))
  // Stable sort: entries without a timestamp keep their stored order.
  return items.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED)
}

export function writeSaved(items) {
  writeJson(SAVED_KEY, items.length ? { version: VERSION, items } : null)
}

export function addSaved(items, ref, savedAt = Date.now()) {
  if (items.some((item) => refKey(item) === refKey(ref))) return items
  return [{ ...ref, savedAt }, ...items].slice(0, MAX_SAVED)
}

export function removeSaved(items, key) {
  return items.some((item) => refKey(item) === key) ? items.filter((item) => refKey(item) !== key) : items
}

/** Put a removed record back where its timestamp belongs (undo). */
export function restoreSaved(items, record) {
  if (items.some((item) => refKey(item) === refKey(record))) return items
  return [...items, record].sort((a, b) => b.savedAt - a.savedAt)
}

// --- Recently viewed places: [{ source, id, place? }], most recent first.

export function readRecent() {
  const data = readJson(RECENT_KEY)
  let entries = null
  if (Array.isArray(data)) entries = data
  else if (data?.version === 1) entries = data.ids
  else if (data?.version === VERSION) entries = data.items
  return Array.isArray(entries) ? uniqueRefs(entries).map(({ ref }) => ref).slice(0, MAX_RECENT) : []
}

export function writeRecent(items) {
  writeJson(RECENT_KEY, items.length ? { version: VERSION, items } : null)
}

export function pushRecent(items, ref) {
  if (items[0] && refKey(items[0]) === refKey(ref)) return items
  return [ref, ...items.filter((x) => refKey(x) !== refKey(ref))].slice(0, MAX_RECENT)
}
