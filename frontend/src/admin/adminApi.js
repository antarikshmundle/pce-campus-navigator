/**
 * Admin-only reads (Stage 11 insights). CRUD keeps using lib/api.js.
 * Errors are typed so the UI can tell "signed out" from "backend down".
 */
import { auth } from '../lib/auth.js'

const BASE = '/api/v1'

export class AuthError extends Error {}
export class BackendUnavailableError extends Error {}

async function get(path) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${auth.getToken()}` } })
  } catch {
    throw new BackendUnavailableError('Backend unreachable')
  }
  if (res.status === 401) throw new AuthError('Session expired')
  // The dev proxy answers 5xx when the API server is down.
  if (res.status >= 500) throw new BackendUnavailableError(`Backend unavailable (HTTP ${res.status})`)
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`)
  return res.json()
}

export const adminApi = {
  summary: () => get('/admin/insights/summary'),
  health: () => get('/admin/insights/data-health'),
  ai: () => get('/admin/insights/ai'),
  usage: () => get('/admin/insights/usage'),
  system: () => get('/admin/insights/system'),
  // Public list, already used by the student app; includes every field.
  locations: async () => {
    let res
    try {
      res = await fetch(`${BASE}/locations`)
    } catch {
      throw new BackendUnavailableError('Backend unreachable')
    }
    if (res.status >= 500) throw new BackendUnavailableError(`Backend unavailable (HTTP ${res.status})`)
    if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`)
    const rows = await res.json()
    return rows.sort((a, b) => a.id - b.id)
  },
}

/** Seconds-since-epoch expiry from the JWT payload, or null if unreadable. */
export function tokenExpiry(token = auth.getToken()) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export function hasValidSession() {
  const token = auth.getToken()
  if (!token) return false
  const exp = tokenExpiry(token)
  if (exp !== null && exp * 1000 <= Date.now()) {
    auth.clearToken()
    return false
  }
  return true
}
