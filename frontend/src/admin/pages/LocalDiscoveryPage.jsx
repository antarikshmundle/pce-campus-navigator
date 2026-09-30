import { useMemo, useState } from 'react'
import { ExternalLink, Info, Search, Terminal } from 'lucide-react'
import { sourceUrl } from '../../features/nearby/externalLinks.js'
import { distanceMeters, formatDistance } from '../../utils/geo.js'
import { useSnapshotReport } from '../AdminDataProvider.jsx'
import { OSM_FLAG_LABELS } from '../osmHealth.js'
import { worstStatus } from '../status.js'
import { BarList, Callout, Card, LoadState, PageHeader, StatusBadge, formatDate } from '../ui.jsx'

const PAGE = 40

export default function LocalDiscoveryPage({ layer }) {
  const snapshot = useSnapshotReport()
  return (
    <>
      <PageHeader
        eyebrow="Local discovery"
        title={layer === 'nagpur' ? 'Nagpur explore' : 'Nearby data'}
        description="Off-campus places from OpenStreetMap, bundled with the app (Stage 10). Kept separate from the campus locations table; nothing here is edited or refreshed from the browser."
      />
      <LoadState resource={snapshot} label="the local discovery snapshot">
        {() =>
          snapshot.report?.status === 'unavailable' ? (
            <Card>
              <p className="text-body-sm text-fg">The bundled snapshot could not be read. The student Nearby screen would have no fallback data.</p>
            </Card>
          ) : (
            <Discovery report={snapshot.report} layer={layer} />
          )
        }
      </LoadState>
    </>
  )
}

function Discovery({ report, layer }) {
  const { meta, layers } = report
  const data = layers[layer]
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.places ?? [])
      .filter((p) => (!needle || `${p.name} ${p.address ?? ''} ${p.key}`.toLowerCase().includes(needle)) && (!cat || p.category === cat))
      .map((p) => ({ ...p, meters: meta.center && p.coords ? distanceMeters(meta.center, p.coords) : null }))
      .sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity))
  }, [data, q, cat, meta.center])

  const layerChecks = report.checks.filter((c) => c.code === 'metadata' || c.keys.length === 0 || c.keys.some((k) => data?.places.some((p) => p.key === k)))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Local discovery snapshot" className="lg:col-span-1" actions={<StatusBadge status={report.status} />}>
          <dl className="space-y-1.5 text-body-sm">
            {[
              ['Source', meta.provider === 'osm' ? 'OpenStreetMap' : meta.provider ?? '—'],
              ['Attribution', meta.attribution ?? '—'],
              ['Snapshot', formatDate(meta.fetchedAt)],
              ['Around PCE', `${layers.around?.count ?? 0} records${meta.radiusM ? ` · ${meta.radiusM / 1000} km radius` : ''}`],
              ['Nagpur explore', `${layers.nagpur?.count ?? 0} records`],
              ['Live provider', 'OpenStreetMap (Overpass) — queried by student devices around their own position; not checked from Admin'],
              ['Fallback', 'Bundled snapshot · enabled'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[112px_1fr] gap-2">
                <dt className="text-fg-secondary">{k}</dt>
                <dd className="text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <Callout icon={Terminal} className="mt-4">
            Refreshing is a manual maintainer step (<code className="font-mono">node build-snapshot.mjs</code>, Stage 10). That script is not part of this
            repository yet, and there is deliberately no refresh button here.
          </Callout>
        </Card>

        <Card title={`${data?.label} health`} className="lg:col-span-2" actions={<StatusBadge status={worstStatus(layerChecks.map((c) => c.status))} />} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {layerChecks.map((c) => {
              const keys = c.keys.filter((k) => data?.places.some((p) => p.key === k))
              return (
                <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={keys.length || c.code === 'metadata' ? c.status : 'healthy'} />
                    <span className="text-body-sm font-medium text-fg">{c.title}</span>
                  </span>
                  <span className="text-caption text-fg-secondary">{c.code === 'metadata' ? c.detail : keys.length ? `${keys.length} record(s)` : 'None'}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Categories" description={`${data?.categories.length} categories in this layer`}>
          <BarList rows={(data?.categories ?? []).map((c) => ({ key: c.id, label: c.label, value: c.count }))} />
        </Card>

        <Card className="lg:col-span-2" bodyClassName="p-0" title={`${data?.label} places`} description={`${rows.length} of ${data?.count} shown · nearest to the snapshot centre first`}>
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <label className="relative min-w-[180px] flex-1">
              <span className="sr-only">Search places</span>
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden />
              <input value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} type="search" placeholder="Search name, address, OSM id" className="h-9 w-full rounded-control border border-line pl-8 pr-2.5 text-body-sm outline-none focus:border-navy" />
            </label>
            <select aria-label="Category" value={cat} onChange={(e) => (setCat(e.target.value), setLimit(PAGE))} className="h-9 rounded-control border border-line bg-surface px-2.5 text-body-sm">
              <option value="">All categories</option>
              {(data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-body-sm">
              <thead className="bg-surface-page text-caption text-fg-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2 font-medium">Distance</th>
                  <th scope="col" className="px-3 py-2 font-medium">Coordinates</th>
                  <th scope="col" className="px-3 py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, limit).map((p) => {
                  const url = sourceUrl(p)
                  const flags = report.flags[p.key] ?? []
                  return (
                    <tr key={p.key} className="align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-fg">{p.name || <span className="text-fg-muted">(no name)</span>}</div>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-micro text-fg-muted hover:text-fg hover:underline">
                            {p.key} <ExternalLink size={11} aria-hidden />
                          </a>
                        ) : (
                          <span className="font-mono text-micro text-fg-muted">{p.key}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-fg-secondary">{data.categories.find((c) => c.id === p.category)?.label ?? p.category ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-fg-secondary">{p.meters != null ? formatDistance(p.meters) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-micro text-fg-secondary">
                        {p.coords ? `${p.coords.lat}, ${p.coords.lng}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <StatusBadge key={f} status={f === 'shared_coords' || f === 'campus_overlap' ? 'info' : ['outside_radius', 'outside_nagpur', 'layer_mismatch'].includes(f) ? 'needs_review' : 'warning'} label={OSM_FLAG_LABELS[f] ?? f} />
                          ))}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-fg-secondary">
                      No places match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-9 rounded-control border border-line px-3 text-caption font-semibold hover:bg-surface-alt">
                Show more ({rows.length - limit} left)
              </button>
            </div>
          )}
        </Card>
      </div>

      <Callout icon={Info}>
        No ratings, opening hours or Google Places data are shown — the snapshot holds only what OpenStreetMap publishes (name, category, position, address when
        present).
      </Callout>
    </div>
  )
}
