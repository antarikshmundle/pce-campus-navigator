const BASE = '/api/v1'

function authHeaders() {
  const token = localStorage.getItem('pce_admin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* no json body */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // --- Public ---
  listLocations: (category) =>
    fetch(`${BASE}/locations${category ? `?category=${encodeURIComponent(category)}` : ''}`).then(handle),
  listCategories: () => fetch(`${BASE}/locations/categories`).then(handle),
  // `clientResolution` (optional): how Campus AI resolved the query, for chat_logs.
  chat: (message, clientResolution) =>
    fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientResolution ? { message, client_resolution: clientResolution } : { message }),
    }).then(handle),
  getDirections: (from_location, to_location) =>
    fetch(`${BASE}/directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_location, to_location }),
    }).then(handle),

  // --- Admin ---
  login: (username, password) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handle),
  statsOverview: () =>
    fetch(`${BASE}/admin/stats/overview`, { headers: authHeaders() }).then(handle),
  createLocation: (payload) =>
    fetch(`${BASE}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    }).then(handle),
  updateLocation: (id, payload) =>
    fetch(`${BASE}/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteLocation: (id) =>
    fetch(`${BASE}/locations/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(handle),
}
