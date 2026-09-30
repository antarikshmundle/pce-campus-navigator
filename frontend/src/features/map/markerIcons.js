/**
 * Renders the category Lucide icons to SVG strings for the map engine
 * (place markers + the selected-place marker). Loaded lazily
 * together with the engine, so react-dom/server stays out of the main bundle.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { listCategoryIcons } from '../locations/categoryMeta.js'
import { listNearbyCategoryIcons } from '../nearby/nearbyCategories.js'
import { mapPalette } from '../../design/tokens.js'

const svg = (Icon, size, color) => renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth: 2.25 }))

const entry = (Icon) => ({ marker: svg(Icon, 16, mapPalette.markerIcon), selected: svg(Icon, 18, mapPalette.markerAccent) })

/** { [iconKey]: { marker: navy svg, selected: amber svg } }; off-campus categories as `ext:<id>`. */
export function buildMarkerIcons() {
  return Object.fromEntries([
    ...listCategoryIcons().map(([key, Icon]) => [key, entry(Icon)]),
    ...listNearbyCategoryIcons().map(([id, Icon]) => [`ext:${id}`, entry(Icon)]),
  ])
}
