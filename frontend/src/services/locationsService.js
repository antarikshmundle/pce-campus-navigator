/**
 * Location data access for the new UI.
 *
 * Wraps the existing transport in lib/api.js (unchanged) and normalizes
 * backend `LocationOut` records into the shape the UI works with, so
 * components never depend on raw API fields directly.
 */
import { api } from '../lib/api.js'

const INSTITUTION_PREFIX = /^PRIYADARSHINI\s*/i

/** "PRIYADARSHINI AI Lab" -> "AI Lab"; bare "PRIYADARSHINI" -> "Main Campus". */
export function toDisplayName(rawName) {
  const stripped = rawName.replace(INSTITUTION_PREFIX, '').trim()
  return stripped || 'Main Campus'
}

export function normalizeLocation(raw) {
  return {
    id: raw.id,
    // `name` is the backend identifier — /directions and /chat key on it.
    name: raw.name,
    displayName: toDisplayName(raw.name),
    category: raw.category || 'General',
    building: raw.building || null,
    floor: raw.floor || null,
    description: raw.description || null,
    imageUrl: raw.image_url || null,
    // Not in the backend schema yet; surfaced automatically once it is.
    hours: raw.operating_hours || null,
    coords: { lat: raw.latitude, lng: raw.longitude },
  }
}

export const locationsService = {
  async list() {
    const rows = await api.listLocations()
    return rows.map(normalizeLocation)
  },

  listCategories() {
    return api.listCategories()
  },
}
