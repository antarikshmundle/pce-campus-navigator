import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth.js'
import { AuthError, BackendUnavailableError, adminApi } from './adminApi.js'
import { analyzeSnapshot } from './osmHealth.js'

/**
 * One cache for every admin section. Each resource loads the first time a
 * section asks for it (lazy), is shared by every section after that, and is
 * refetched only on an explicit refresh or after a location edit — no polling.
 */
const LOADERS = {
  summary: adminApi.summary,
  health: adminApi.health,
  locations: adminApi.locations,
  ai: adminApi.ai,
  usage: adminApi.usage,
  system: adminApi.system,
  // Bundled OSM snapshot (Stage 10): loaded as its own chunk, never fetched from OSM.
  snapshot: async () => {
    const mod = await import('../features/nearby/data/osmSnapshot.json')
    return mod.default
  },
}

const AdminDataContext = createContext(null)
const IDLE = { status: 'idle', data: null, error: null }

export function AdminDataProvider({ children }) {
  const [state, setState] = useState({})
  const inflight = useRef({})
  const navigate = useNavigate()

  const load = useCallback(
    (key) => {
      if (inflight.current[key]) return inflight.current[key]
      setState((s) => ({ ...s, [key]: { ...(s[key] ?? IDLE), status: s[key]?.data ? 'refreshing' : 'loading', error: null } }))
      const p = LOADERS[key]()
        .then((data) => setState((s) => ({ ...s, [key]: { status: 'ready', data, error: null, loadedAt: Date.now() } })))
        .catch((error) => {
          if (error instanceof AuthError) {
            auth.clearToken()
            navigate('/admin/login', { replace: true, state: { expired: true } })
            return
          }
          setState((s) => ({
            ...s,
            [key]: {
              status: 'error',
              data: s[key]?.data ?? null,
              error: { message: error.message, unavailable: error instanceof BackendUnavailableError },
            },
          }))
        })
        .finally(() => {
          delete inflight.current[key]
        })
      inflight.current[key] = p
      return p
    },
    [navigate],
  )

  const value = useMemo(() => ({ state, load }), [state, load])
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

function useAdminData() {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminResource must be used inside <AdminDataProvider>')
  return ctx
}

/** { status, data, error, reload } — loads on first use. */
export function useAdminResource(key) {
  const { state, load } = useAdminData()
  const entry = state[key] ?? IDLE
  useEffect(() => {
    if (entry.status === 'idle') load(key)
  }, [key, entry.status, load])
  return { ...entry, reload: () => load(key) }
}

/** Refetch several resources (e.g. after a location changes). Only those already loaded. */
export function useInvalidate() {
  const { state, load } = useAdminData()
  return useCallback(
    (keys) => keys.forEach((k) => state[k] && state[k].status !== 'idle' && load(k)),
    [state, load],
  )
}

/** Snapshot + its health report (memoized per snapshot/locations). */
export function useSnapshotReport() {
  const snapshot = useAdminResource('snapshot')
  const locations = useAdminResource('locations')
  const report = useMemo(
    () => (snapshot.data ? analyzeSnapshot(snapshot.data, { campus: locations.data }) : null),
    [snapshot.data, locations.data],
  )
  return { ...snapshot, report }
}
