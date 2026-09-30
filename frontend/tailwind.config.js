import { colors, fontSize, layoutSpacing, radius, shadow, zIndex } from './src/design/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // --- New design system (src/design/tokens.js) ---
        ...colors,

        // --- Legacy tokens: still used by the admin pages.
        // Remove once those screens move to the new system.
        ink: {
          DEFAULT: '#0F1B3D',
          light: '#1E2A5E',
          deep: '#0A1330',
        },
        signal: {
          DEFAULT: '#F2A93B',
          dark: '#D6901F',
        },
        canvas: '#FAFAF8',
        slate: {
          text: '#4B5264',
        },
        ok: '#2F9E67',
        alert: '#D6483F',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Legacy families (admin)
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize,
      borderRadius: {
        ...radius,
        // Legacy radii (admin)
        sm: '4px',
        DEFAULT: '8px',
        lg: '14px',
      },
      boxShadow: shadow,
      zIndex,
      spacing: layoutSpacing,
    },
  },
  plugins: [],
}
