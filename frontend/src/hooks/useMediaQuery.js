import { useEffect, useState } from 'react'
import { layout } from '../design/tokens.js'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const useIsDesktop = () => useMediaQuery(`(min-width: ${layout.lgBreakpoint}px)`)
export const useIsPhone = () => useMediaQuery(`(max-width: ${layout.mdBreakpoint - 1}px)`)
