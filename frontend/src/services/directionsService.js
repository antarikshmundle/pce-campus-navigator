/**
 * Wraps the existing POST /api/v1/directions call (lib/api.js, unchanged).
 *
 * Backend contract: locations are identified by NAME, and the response has
 * a Haversine-based time estimate, text steps and a Google Maps deep link —
 * no distance and no path geometry.
 */
import { api } from '../lib/api.js'

export const directionsService = {
  async getDirections(fromName, toName) {
    const res = await api.getDirections(fromName, toName)
    return {
      fromName: res.from_location,
      toName: res.to_location,
      estimatedMinutes: res.estimated_minutes,
      steps: res.steps,
      speechText: res.speech_text,
      externalUrl: res.maps_url,
    }
  },
}
