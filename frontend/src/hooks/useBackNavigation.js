import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Back within the app when there is in-app history; otherwise (deep link,
 * fresh tab) go to `fallback` instead of leaving the site.
 */
export function useBackNavigation(fallback = '/') {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback, { replace: true })
  }, [location.key, navigate, fallback])
}
