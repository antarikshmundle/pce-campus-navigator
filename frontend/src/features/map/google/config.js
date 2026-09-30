/**
 * Google Maps settings from Vite env (see frontend/.env.example). Tiny and
 * dependency-free so <CampusMap> can check for a key without downloading
 * the Google engine chunk.
 *
 * The browser key is public by design — it is protected by HTTP-referrer and
 * API restrictions in Google Cloud, never by secrecy.
 */
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()

// Advanced markers require a Map ID. DEMO_MAP_ID works for development;
// production uses the project's own Map ID (with POIs hidden via cloud styling).
export const GOOGLE_MAPS_MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID'

export const hasGoogleMapsKey = () => GOOGLE_MAPS_API_KEY.length > 0
