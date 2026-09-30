import { useMemo } from 'react'
import { GOOGLE_MAPS_MAP_ID, hasGoogleMapsKey } from '../../features/map/google/config.js'
import { useAdminResource, useSnapshotReport } from '../AdminDataProvider.jsx'
import { tokenExpiry } from '../adminApi.js'
import { Card, PageHeader, RefreshButton, StatusBadge, formatDate, formatDateTime } from '../ui.jsx'

/**
 * Real state only. Secrets are never displayed: the Maps key and Map ID are
 * reported as present/absent, backend security as booleans.
 */
export default function SystemStatusPage() {
  const system = useAdminResource('system')
  const snapshot = useSnapshotReport()
  const s = system.data
  const down = system.status === 'error'
  const pending = !s && !down

  const rows = useMemo(() => {
    const out = []
    const add = (label, status, detail) => out.push({ label, status, detail })
    const wait = pending ? 'Checking…' : null

    if (down) {
      add('Backend reachable', 'unavailable', system.error?.message ?? 'No response')
      add('Database reachable', 'unavailable', 'Unknown while the backend is down')
    } else {
      add('Backend reachable', pending ? 'info' : 'healthy', wait ?? `API responded · ${formatDateTime(s.backend.time)} IST`)
      add('Database reachable', pending ? 'info' : s.database.status, wait ?? (s.database.status === 'healthy' ? `PostgreSQL ${s.database.version} · database “${s.database.name}”` : 'Query failed'))
    }
    if (s?.locations) {
      add('Campus location count', s.locations.status, `${s.locations.count} (expected 69)`)
      add(
        'Canonical dataset',
        s.canonical.status,
        s.canonical.error ?? (s.canonical.synchronized ? `Synchronized — ${s.canonical.matching} / ${s.canonical.canonical_count} match` : `${s.canonical.matching} / ${s.canonical.canonical_count} match`),
      )
      add('Campus AI endpoint', s.ai.status, `${s.ai.endpoint_registered ? 'POST /chat registered' : 'POST /chat missing'} · ${s.ai.logs} logged queries · last ${formatDateTime(s.ai.last_query_at)}`)
      add('Usage events', s.events.status, s.events.table ? `usage_events table present · ${s.events.count} events` : 'usage_events table missing')
    }

    if (snapshot.report && snapshot.report.status !== 'unavailable') {
      const r = snapshot.report
      add('Local discovery snapshot', r.status === 'healthy' || r.status === 'info' ? 'healthy' : r.status, `Available · ${r.layers.around?.count ?? 0} around PCE + ${r.layers.nagpur?.count ?? 0} Nagpur · ${formatDate(r.meta.fetchedAt)}`)
    } else if (snapshot.status === 'error' || snapshot.report?.status === 'unavailable') {
      add('Local discovery snapshot', 'unavailable', 'Bundled snapshot could not be loaded')
    } else add('Local discovery snapshot', 'info', 'Checking…')
    add('Live OpenStreetMap lookup', 'info', 'Runs on student devices only; not checked from Admin. Falls back to the snapshot when unavailable.')

    add(
      'Google Maps configuration',
      hasGoogleMapsKey() ? 'healthy' : 'warning',
      hasGoogleMapsKey()
        ? `Configured · ${GOOGLE_MAPS_MAP_ID === 'DEMO_MAP_ID' ? "Google's demo Map ID" : 'custom Map ID'}`
        : 'Not configured — the student map uses the schematic fallback',
    )
    add('Cloud billing status', 'info', 'Managed in Google Cloud Console (cannot be checked from the app)')
    add('Google Routes API', 'info', 'Stage 7 partial by design — external Google Maps navigation is used')

    if (s?.security) {
      const issues = [
        s.security.default_admin_password && 'the admin account still accepts the seed default password',
        s.security.default_secret_key && 'SECRET_KEY is a placeholder value, so session tokens could be forged',
      ].filter(Boolean)
      add('Admin security', s.security.status, issues.length ? `Change now: ${issues.join('; ')}.` : 'No default credentials detected')
    }
    const exp = tokenExpiry()
    add('Your admin session', 'info', exp ? `Expires ${formatDateTime(new Date(exp * 1000).toISOString())} IST (${s?.security?.token_lifetime_minutes ?? '—'} min lifetime)` : 'Active')
    return out
  }, [s, down, pending, system.error, snapshot.report, snapshot.status])

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="System status"
        description="Checked when you open this page or press Refresh — no background polling. No keys, passwords or connection strings are ever shown."
        actions={<RefreshButton onClick={system.reload} busy={system.status === 'refreshing' || system.status === 'loading'} />}
      />
      <Card bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_130px_1fr] sm:items-center sm:gap-3">
              <span className="text-body-sm font-semibold text-fg">{r.label}</span>
              <span>
                <StatusBadge status={r.status} />
              </span>
              <span className="text-body-sm text-fg-secondary">{r.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-caption text-fg-muted">
        Settings: there are no admin-configurable settings yet — credentials and API keys are managed in the server <code className="font-mono">.env</code> and Google
        Cloud Console, never from this panel.
      </p>
    </>
  )
}
