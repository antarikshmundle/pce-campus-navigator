/**
 * DOM content for the Google advanced markers. Styling lives in index.css
 * (`.map-*`), keyed off data attributes on the map container:
 *   data-map-type="standard|satellite"  stronger rings/labels over imagery
 *   data-labels="true"                  place names shown (zoomed in)
 *
 * Centred markers are shifted down by half their height, because advanced
 * markers anchor their content's bottom-centre on the coordinate.
 */

/** Unselected place: white disc + navy category glyph, name below. */
export function createPlaceElement({ name, iconSvg, dimmed }) {
  const root = document.createElement('div')
  root.className = dimmed ? 'map-place map-place--dimmed' : 'map-place'

  const disc = document.createElement('span')
  disc.className = 'map-place__disc'
  disc.innerHTML = iconSvg // trusted: generated locally from Lucide icons

  root.append(disc)
  if (!dimmed) {
    const label = document.createElement('span')
    label.className = 'map-place__label'
    label.textContent = name
    root.append(label)
  }
  return root
}

/** Off-campus place: rounded square (shape, not only colour, sets it apart) + glyph. */
export function createExternalElement({ name, iconSvg }) {
  const root = document.createElement('div')
  root.className = 'map-place map-place--external'
  const disc = document.createElement('span')
  disc.className = 'map-place__disc'
  disc.innerHTML = iconSvg // trusted: generated locally from Lucide icons
  const label = document.createElement('span')
  label.className = 'map-place__label'
  label.textContent = name
  root.append(disc, label)
  return root
}

// Full class names so Tailwind keeps these component classes in the build.
const CLUSTER_SIZE = { sm: 'map-cluster map-cluster--sm', md: 'map-cluster map-cluster--md', lg: 'map-cluster map-cluster--lg' }

/** Cluster bubble; size steps match the previous renderer (17 / 20 / 24 px radius). */
export function createClusterElement(count) {
  const root = document.createElement('div')
  root.className = CLUSTER_SIZE[count >= 10 ? 'lg' : count >= 5 ? 'md' : 'sm']
  root.textContent = String(count)
  return root
}

export function createUserElement() {
  const root = document.createElement('div')
  root.className = 'map-user'
  return root
}

export function createOriginElement() {
  const root = document.createElement('div')
  root.className = 'map-origin'
  return root
}
