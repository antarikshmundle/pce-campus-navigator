import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { useAdminResource } from '../AdminDataProvider.jsx'
import { Callout, Card, IdLinks, LoadState, PageHeader, RefreshButton, StatusBadge, satelliteUrl } from '../ui.jsx'

export default function DataHealthPage() {
  const health = useAdminResource('health')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash && health.data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, health.data])

  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Data health"
        description="Read-only audit of the campus locations and the canonical locations.json. Findings are observations; nothing is repaired or overwritten automatically."
        actions={<RefreshButton onClick={health.reload} busy={health.status === 'refreshing'} />}
      />
      <LoadState resource={health} label="data health">
        {(h) => <Report h={h} />}
      </LoadState>
    </>
  )
}

function Report({ h }) {
  const c = h.canonical
  return (
    <div className="space-y-5">
      <Card
        id="canonical"
        className="scroll-mt-20"
        title="Canonical data integrity"
        description="Database rows vs backend/app/db/data/locations.json, field by field, exact values."
        actions={<StatusBadge status={c.status} />}
      >
        {c.error ? (
          <p className="text-body-sm text-fg">{c.error}</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-body font-semibold text-fg">
              <ShieldCheck size={18} className={c.synchronized ? 'text-success' : 'text-warning'} aria-hidden />
              {c.synchronized
                ? `Canonical dataset is synchronized — ${c.matching} / ${c.canonical_count} locations match`
                : 'Database differs from the canonical dataset'}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Database rows', c.database_count],
                ['locations.json rows', c.canonical_count],
                ['Matching', c.matching],
                ['Mismatched', c.mismatched.length],
                ['Missing from DB', c.missing_in_db.length],
                ['Extra in DB', c.extra_in_db.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-field bg-surface-page px-3 py-2">
                  <dt className="text-caption text-fg-secondary">{label}</dt>
                  <dd className="text-title tabular-nums text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            {!c.synchronized && (
              <div className="mt-4 space-y-2 text-body-sm">
                {c.mismatched.length > 0 && (
                  <div>
                    <p className="font-semibold text-fg">Mismatched rows</p>
                    <ul className="mt-1 space-y-1">
                      {c.mismatched.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
                          <IdLinks ids={[m.id]} /> {m.fields.join(', ')} differ
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.missing_in_db.length > 0 && (
                  <p className="text-caption text-fg-secondary">
                    In locations.json but not in the database: <span className="font-mono">{c.missing_in_db.join(', ')}</span>
                  </p>
                )}
                {c.extra_in_db.length > 0 && (
                  <p className="text-caption text-fg-secondary">
                    In the database but not in locations.json: <IdLinks ids={c.extra_in_db} />
                  </p>
                )}
                <Callout className="mt-2">
                  This is an audit — the database is never overwritten from here. If the database is the intended truth, re-export it with{' '}
                  <code className="font-mono">python -m app.db.export_locations</code>; otherwise correct the rows by hand.
                </Callout>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Checks" description={`Expected ${h.expected.count} locations with IDs ${h.expected.ids[0]}–${h.expected.ids[1]}.`} actions={<StatusBadge status={h.status} />} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-body-sm">
            <thead className="bg-surface-page text-caption text-fg-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Check</th>
                <th scope="col" className="px-3 py-2 font-medium">Result</th>
                <th scope="col" className="px-3 py-2 font-medium">Affected IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {h.checks.map((c) => (
                <tr key={c.code} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-fg">{c.title}</td>
                  <td className="px-3 py-2 text-fg-secondary">
                    {c.detail}
                    {c.expected && <span className="text-fg-muted"> · expected {c.expected}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <IdLinks ids={c.affected_ids} max={14} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="suspicious" className="scroll-mt-20" title="Suspicious coordinates" description={`Places more than ${h.expected.outlier_radius_m / 1000} km from the median campus position. Values are preserved and shown exactly.`} actions={<StatusBadge status={h.suspicious.length ? 'needs_review' : 'healthy'} label={h.suspicious.length ? 'Needs verification' : undefined} />}>
        {h.suspicious.length === 0 ? (
          <p className="text-body-sm text-fg-secondary">None.</p>
        ) : (
          <ul className="space-y-3">
            {h.suspicious.map((s) => (
              <li key={s.id} className="rounded-field border border-info/25 bg-info/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <IdLinks ids={[s.id]} />
                    <span className="font-semibold text-fg">{s.name.trim()}</span>
                    <StatusBadge status="needs_review" label="Needs verification" />
                  </div>
                  <a href={satelliteUrl(s.latitude, s.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-caption font-semibold text-navy hover:underline">
                    Stored point on satellite <ExternalLink size={13} aria-hidden />
                  </a>
                </div>
                <p className="mt-1.5 font-mono text-caption text-fg">
                  {String(s.latitude)}, {String(s.longitude)}
                </p>
                <p className="mt-1 text-caption text-fg-secondary">{s.reasons.join(' · ')}. Not corrected automatically.</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Shared coordinate groups" description="Places stored at exactly the same point. Informational — rooms in one building often share a position." actions={<StatusBadge status="info" label={`${h.shared_coordinate_groups.length} groups`} />} bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {h.shared_coordinate_groups.map((g) => (
            <li key={`${g.latitude},${g.longitude}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-body-sm text-fg">{g.places.map((p) => `#${p.id} ${p.name.trim()}`).join('  ·  ')}</span>
              <span className="font-mono text-micro text-fg-muted">
                {g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}
              </span>
            </li>
          ))}
          {h.shared_coordinate_groups.length === 0 && <li className="px-4 py-3 text-body-sm text-fg-secondary">None.</li>}
        </ul>
      </Card>
    </div>
  )
}
