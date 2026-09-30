/** Links out for off-campus places. Kept light: the Saved screen uses them too. */
// External maps. Coordinates, not names, so the pin is exactly this place.
const ll = (p) => `${p.coords.lat},${p.coords.lng}`
export const navigateUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${ll(p)}`
export const openInMapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${ll(p)}`
const OSM_TYPES = { n: 'node', w: 'way', r: 'relation' }
export function sourceUrl(p) {
  const m = /^osm-([nwr])(\d+)$/.exec(p.key)
  return m ? `https://www.openstreetmap.org/${OSM_TYPES[m[1]]}/${m[2]}` : null
}
