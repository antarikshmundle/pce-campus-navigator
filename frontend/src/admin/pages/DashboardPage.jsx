import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Building2, Compass, DatabaseZap, HeartPulse, MapPin, MousePointerClick, Smartphone, Tags } from 'lucide-react'
import { useAdminResource, useSnapshotReport } from '../AdminDataProvider.jsx'
import { Card, IdLinks, LoadState, PageHeader, RefreshButton, StatCard, StatusBadge, formatDate, formatDateTime } from '../ui.jsx'

const ATTENTION_LINKS = {
  suspicious_coordinates: '/admin/health#suspicious',
  category_variants: '/admin/categories',
  name_whitespace: '/admin/locations?flag=name_whitespace',
}

export default function DashboardPage() {
  const summary = useAdminResource('summary')
  const snapshot = useSnapshotReport()

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live figures from the campus database, locations.json, AI logs, anonymous usage events and the bundled local-discovery snapshot. Nothing here is estimated."
        actions={<RefreshButton onClick={() => (summary.reload(), snapshot.reload())} busy={summary.status === 'refreshing'} />}
      />
      <LoadState resource={summary} label="dashboard">
        {(s) => <Dashboard s={s} snapshot={snapshot} />}
      </LoadState>
    </>
  )
}

function Dashboard({ s, snapshot }) {
  const L = s.locations
  const report = snapshot.report
  const around = report?.layers.around?.count
  const nagpur = report?.layers.nagpur?.count
  const events = s.events
  const searches = events?.by_type?.SEARCH_SUBMITTED ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MapPin}
          label="Campus locations"
          value={L.total}
          sub={L.total ? `IDs ${L.min_id}–${L.max_id}` : 'No rows'}
          status={L.total === 69 ? 'healthy' : 'warning'}
          to="/admin/locations"
        />
        <StatCard
          icon={Tags}
          label="Categories"
          value={L.categories}
          sub={`${L.categories_normalized} after ignoring case/spacing · ${L.category_variant_groups} possible variant group${L.category_variant_groups === 1 ? '' : 's'}`}
          to="/admin/categories"
        />
        <StatCard
          icon={Building2}
          label="Buildings / areas"
          value={L.buildings}
          sub={`distinct labels · ${L.without_building} location${L.without_building === 1 ? '' : 's'} without a building`}
          to="/admin/categories#buildings"
        />
        <StatCard
          icon={HeartPulse}
          label="Data health"
          value={s.health.attention.length ? `${s.health.attention.length} to review` : 'All clear'}
          sub={s.canonical.synchronized ? `${s.canonical.matching} / ${s.canonical.canonical_count} synchronized with locations.json` : 'Database differs from locations.json'}
          status={s.health.status}
          to="/admin/health"
        />
        <StatCard
          icon={Bot}
          label="AI queries"
          value={s.ai.total}
          sub={s.ai.total ? `${s.ai.resolved} resolved · ${s.ai.unresolved} unresolved · last ${formatDateTime(s.ai.last_at)}` : 'No queries recorded yet'}
          to="/admin/insights/ai"
        />
        <StatCard
          icon={MousePointerClick}
          label="Search & discovery events"
          value={events ? events.total : null}
          sub={events ? (events.total ? `${searches} searches · since ${formatDateTime(events.since)}` : 'Tracking is on; no events recorded yet') : 'Event table missing'}
          to="/admin/insights/search"
        />
        <StatCard
          icon={Compass}
          label="Nearby local places"
          value={report ? around + nagpur : snapshot.status === 'error' ? null : '…'}
          sub={report ? `${around} around PCE · ${nagpur} Nagpur · OSM snapshot ${formatDate(report.meta.fetchedAt)}` : snapshot.status === 'error' ? 'Snapshot unavailable' : 'Loading snapshot'}
          status={report?.status}
          to="/admin/discovery/nearby"
        />
        <StatCard
          icon={Smartphone}
          label="Saved / recent places"
          value={null}
          sub="Stored only on each student's device — not sent to the server"
          to="/admin/insights/places#device-local"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Needs attention"
          description="Observations from the data-health checks. Nothing is corrected automatically."
          actions={<StatusBadge status={s.health.status} />}
        >
          {s.health.attention.length === 0 ? (
            <p className="text-body-sm text-fg-secondary">No warnings or review items.</p>
          ) : (
            <ul className="divide-y divide-line">
              {s.health.attention.map((a) => (
                <li key={a.code} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-body-sm font-semibold text-fg">{a.title}</span>
                    </div>
                    <p className="mt-1 text-caption text-fg-secondary">{a.detail}</p>
                    <div className="mt-1.5">
                      <IdLinks ids={a.ids} max={12} />
                    </div>
                  </div>
                  <Link to={ATTENTION_LINKS[a.code] ?? '/admin/health'} className="inline-flex items-center gap-1 text-caption font-semibold text-navy hover:underline">
                    Review <ArrowRight size={13} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Canonical dataset" description="Database vs backend/app/db/data/locations.json" actions={<StatusBadge status={s.canonical.status} />}>
          <div className="flex items-start gap-2.5">
            <DatabaseZap size={18} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
            <div>
              <p className="text-body-sm font-semibold text-fg">
                {s.canonical.error
                  ? s.canonical.error
                  : s.canonical.synchronized
                    ? 'Canonical dataset is synchronized'
                    : 'Database differs from the canonical dataset'}
              </p>
              {!s.canonical.error && (
                <p className="mt-1 text-caption text-fg-secondary">
                  {s.canonical.matching} of {s.canonical.canonical_count} canonical rows match exactly · {s.canonical.database_count} rows in the database
                </p>
              )}
            </div>
          </div>
          <Link to="/admin/health#canonical" className="mt-3 inline-flex items-center gap-1 text-caption font-semibold text-navy hover:underline">
            Open integrity report <ArrowRight size={13} aria-hidden />
          </Link>
        </Card>
      </div>

      <p className="text-micro text-fg-muted">Generated {formatDateTime(s.generated_at)} IST</p>
    </div>
  )
}
