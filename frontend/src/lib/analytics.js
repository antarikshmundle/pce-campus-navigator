/**
 * Anonymous usage events for admin Search / Place analytics (Stage 11).
 *
 * track(type, fields) queues an event; the queue is sent in small batches to
 * POST /api/v1/events. Fire-and-forget: failures are dropped, never retried
 * or surfaced, and the app never waits on it.
 *
 * Privacy: only the event type, a campus place id, a public OpenStreetMap
 * key, a search term (+ result count) and a tiny qualifier are ever sent —
 * never position, device, identity, saved places or AI conversations
 * (Campus AI queries are already logged by /chat). Honors Do Not Track.
 * Admin pages never emit events.
 */
const ENDPOINT = '/api/v1/events'
const FLUSH_MS = 3000
const MAX_BATCH = 20
const DEDUPE_MS = 2000 // StrictMode double effects, double taps

export const EVENTS = {
  SEARCH_SUBMITTED: 'SEARCH_SUBMITTED',
  SEARCH_RESULT_OPENED: 'SEARCH_RESULT_OPENED',
  PLACE_OPENED: 'PLACE_OPENED',
  NAVIGATION_REQUESTED: 'NAVIGATION_REQUESTED',
  NEARBY_SEARCH: 'NEARBY_SEARCH',
  NEARBY_PLACE_OPENED: 'NEARBY_PLACE_OPENED',
}

let queue = []
let timer = null
const lastSeen = new Map()

function disabled() {
  if (typeof window === 'undefined') return true
  if (window.location.pathname.startsWith('/admin')) return true
  return navigator.doNotTrack === '1' || window.doNotTrack === '1'
}

function send(events, { beacon = false } = {}) {
  const body = JSON.stringify({ events })
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch {
    /* analytics is best-effort */
  }
}

export function flush(options) {
  clearTimeout(timer)
  timer = null
  while (queue.length) send(queue.splice(0, MAX_BATCH), options)
}

/**
 * fields: { placeId?, externalKey?, query?, resultCount?, detail? }
 */
export function track(type, { placeId, externalKey, query, resultCount, detail } = {}) {
  if (!EVENTS[type] || disabled()) return
  const event = {
    type,
    ...(Number.isInteger(placeId) && { place_id: placeId }),
    ...(externalKey && { external_key: externalKey }),
    ...(query && { query: String(query).trim().slice(0, 200) }),
    ...(Number.isInteger(resultCount) && { result_count: resultCount }),
    ...(detail && { detail }),
  }
  const signature = JSON.stringify(event)
  const now = Date.now()
  if (now - (lastSeen.get(signature) ?? 0) < DEDUPE_MS) return
  lastSeen.set(signature, now)
  if (lastSeen.size > 200) lastSeen.clear()

  queue.push(event)
  if (queue.length >= MAX_BATCH) flush()
  else if (!timer) timer = setTimeout(flush, FLUSH_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flush({ beacon: true }))
}
