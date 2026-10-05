/**
 * PCE Navigator design tokens — single source of truth.
 * Consumed by tailwind.config.js; import directly only when a value is
 * needed in JS (e.g. inline SVG fills on the map).
 */

export const colors = {
  navy: {
    DEFAULT: '#0B1220',
    800: '#111B2E',
    700: '#17233A',
  },
  accent: {
    DEFAULT: '#FFB000',
    dark: '#E39A00',
    soft: '#FFF4D6',
  },
  surface: {
    DEFAULT: '#FFFFFF',
    page: '#F7F8FA',
    alt: '#F1F3F5',
  },
  line: '#E5E7EB',
  fg: {
    DEFAULT: '#111827',
    secondary: '#6B7280',
    muted: '#9CA3AF',
  },
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#2563EB',
}

/**
 * Map palette — derived only from the locked brand palette above.
 * The base map itself is Google's (roadmap / hybrid); these colour the campus
 * layer drawn on top: markers, clusters, labels, route and current position.
 */
export const mapPalette = {
  labelStrong: colors.fg.DEFAULT,
  labelHalo: colors.surface.DEFAULT,
  marker: colors.navy.DEFAULT,
  markerIcon: colors.navy.DEFAULT,
  markerSurface: colors.surface.DEFAULT,
  markerAccent: colors.accent.DEFAULT,
  cluster: colors.navy.DEFAULT,
  clusterText: colors.surface.DEFAULT,
  route: colors.navy[700],
  routeCasing: colors.surface.DEFAULT,
  routeAlternative: colors.fg.muted,
  routeTraveled: colors.fg.muted,
  user: colors.info,
  userHalo: colors.surface.DEFAULT,
}

// [size, { lineHeight, letterSpacing, fontWeight }]
export const fontSize = {
  display: ['36px', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
  'display-lg': ['40px', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '700' }],
  heading: ['24px', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '600' }],
  'heading-lg': ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
  title: ['17px', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
  body: ['15px', { lineHeight: '1.5' }],
  'body-sm': ['14px', { lineHeight: '1.45' }],
  'body-lg': ['16px', { lineHeight: '1.5' }],
  caption: ['13px', { lineHeight: '1.4' }],
  micro: ['11px', { lineHeight: '1.3', letterSpacing: '0.02em' }],
}

export const radius = {
  control: '8px', // small: inputs inside cards, tags
  field: '12px', // medium: buttons, list rows
  card: '16px', // cards, floating panels
  sheet: '20px', // large cards, bottom sheets
  pill: '999px',
}

export const shadow = {
  // Subtle, layered — never heavy drop shadows.
  card: '0 1px 2px rgba(11,18,32,0.04), 0 2px 8px rgba(11,18,32,0.05)',
  float: '0 2px 4px rgba(11,18,32,0.06), 0 8px 24px rgba(11,18,32,0.10)',
  sheet: '0 -2px 8px rgba(11,18,32,0.04), 0 -12px 32px rgba(11,18,32,0.08)',
  pin: '0 2px 6px rgba(11,18,32,0.25)',
}

export const zIndex = {
  map: '0',
  overlay: '10',
  sheet: '20',
  nav: '30',
  modal: '40',
}

const GUTTER = 16
const RAIL_WIDTH = 72
const DESKTOP_PANEL_WIDTH = 400
const DESKTOP_PANEL_LEFT = GUTTER + RAIL_WIDTH + GUTTER

export const layout = {
  gutter: GUTTER,
  bottomNavHeight: 64,
  railWidth: RAIL_WIDTH,
  lgBreakpoint: 1024, // matches Tailwind's default `lg`
  mdBreakpoint: 768, // matches Tailwind's default `md`; below it = phone

  // Desktop: floating column (search, chips, panel) to the right of the rail.
  desktopPanelWidth: DESKTOP_PANEL_WIDTH,
  desktopPanelLeft: DESKTOP_PANEL_LEFT,
  desktopMapLeft: DESKTOP_PANEL_LEFT + DESKTOP_PANEL_WIDTH + GUTTER, // first px of open map

  // Mobile: floating search + chips at the top, sheet peek at the bottom.
  mobileTopOverlay: 128,
  mobileSheetPeek: 216,
  // Phones (< md): compact search bar (50px) and chips (32px), tighter sheet.
  phoneTopOverlay: 118,
  phoneSheetPeek: 200,
}

const px = (n) => `${n}px`

/** Layout values exposed as Tailwind spacing (w-rail, lg:left-panel-left, …). */
export const layoutSpacing = {
  nav: px(layout.bottomNavHeight),
  rail: px(layout.railWidth),
  panel: px(layout.desktopPanelWidth),
  'panel-left': px(layout.desktopPanelLeft),
  'map-left': px(layout.desktopMapLeft),
}
