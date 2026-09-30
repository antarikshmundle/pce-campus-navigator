/**
 * DOM element for the selected place: label pill + navy pin with amber glyph.
 * Rendered as an AdvancedMarkerElement so it sits above the other markers and
 * can carry an accessible name.
 */
export function createSelectedMarkerElement({ name, iconSvg }) {
  const root = document.createElement('div')
  root.className = 'pointer-events-none flex flex-col items-center'
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', `Selected: ${name}`)

  const label = document.createElement('span')
  label.className =
    'mb-1.5 max-w-[220px] truncate whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 text-caption font-semibold text-fg shadow-float'
  label.textContent = name

  const pin = document.createElement('span')
  pin.className =
    'flex h-10 w-10 items-center justify-center rounded-pill border-[3px] border-surface bg-navy text-accent shadow-pin'
  pin.innerHTML = iconSvg // trusted: generated locally from Lucide icons

  const tip = document.createElement('span')
  tip.className = '-mt-1.5 h-3 w-3 rotate-45 bg-navy'

  root.append(label, pin, tip)
  return root
}
