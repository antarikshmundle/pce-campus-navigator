import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { locationsService } from '../../services/locationsService.js'

const CampusDataContext = createContext(null)

/**
 * Loads campus locations + categories once and shares them across every
 * user-facing screen (home, search, nearby, saved…).
 */
export function CampusDataProvider({ children }) {
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const [locs, cats] = await Promise.all([locationsService.list(), locationsService.listCategories()])
      setLocations(locs)
      setCategories(cats)
      setStatus('ready')
    } catch (e) {
      // Raw transport errors ("Unexpected token '<'…") mean nothing to users.
      console.error('Failed to load campus data:', e)
      setError('Check your connection and try again.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(
    () => ({
      locations,
      categories,
      status,
      error,
      reload: load,
      getById: (id) => locations.find((l) => l.id === id) || null,
    }),
    [locations, categories, status, error, load],
  )

  return <CampusDataContext.Provider value={value}>{children}</CampusDataContext.Provider>
}

export function useCampusData() {
  const ctx = useContext(CampusDataContext)
  if (!ctx) throw new Error('useCampusData must be used inside <CampusDataProvider>')
  return ctx
}
