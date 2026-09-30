import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GitCompareArrows, Info } from 'lucide-react'
import { useAdminResource } from '../AdminDataProvider.jsx'
import { Callout, Card, IdLinks, LoadState, PageHeader, RefreshButton, Spaced, StatusBadge } from '../ui.jsx'

export default function CategoriesPage() {
  const health = useAdminResource('health')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash && health.data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, health.data])

  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Categories"
        description="Every category and building label exactly as stored, with the locations using it. Possible variants are suggestions for manual review — nothing is merged or renamed automatically."
        actions={<RefreshButton onClick={health.reload} busy={health.status === 'refreshing'} />}
      />
      <LoadState resource={health} label="categories">
        {(h) => (
          <div className="space-y-6">
            <Labels analysis={h.categories} field="category" noun="category" />
            <div id="buildings" className="scroll-mt-20">
              <Labels analysis={h.buildings} field="building" noun="building" />
            </div>
          </div>
        )}
      </LoadState>
    </>
  )
}

function Labels({ analysis, field, noun }) {
  const Noun = noun[0].toUpperCase() + noun.slice(1)
  return (
    <>
      <Card
        title={`Possible ${noun} variants`}
        description={`${analysis.variant_groups.length} group(s) that may name the same thing. Review manually; fix a label by editing its locations.`}
        actions={<StatusBadge status={analysis.variant_groups.length ? 'needs_review' : 'healthy'} />}
      >
        {analysis.variant_groups.length === 0 ? (
          <p className="text-body-sm text-fg-secondary">No variants detected.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.variant_groups.map((g, i) => (
              <div key={i} className="rounded-field border border-line p-3">
                <div className="flex items-center gap-2 text-caption text-fg-secondary">
                  <GitCompareArrows size={15} className="text-info" aria-hidden />
                  {g.reasons.join(' · ')}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.labels.map((l) => (
                    <li key={l.label} className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/admin/locations?${field}=${encodeURIComponent(l.label)}`} className="rounded-control bg-surface-alt px-2 py-0.5 font-mono text-caption text-fg hover:bg-line">
                        “<Spaced text={l.label} />”
                      </Link>
                      <span className="text-caption text-fg-secondary">
                        {l.count} location{l.count === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        className="mt-4"
        bodyClassName="p-0"
        title={`${Noun} labels`}
        description={`${analysis.distinct} distinct labels as stored · ${analysis.distinct_normalized} if case and spacing were ignored${analysis.missing_ids.length ? ` · ${analysis.missing_ids.length} location(s) without a ${noun}` : ''}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body-sm">
            <thead className="bg-surface-page text-caption text-fg-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{Noun}</th>
                <th scope="col" className="px-3 py-2 font-medium">Locations</th>
                <th scope="col" className="px-3 py-2 font-medium">IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {analysis.labels.map((l) => (
                <tr key={l.label}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link to={`/admin/locations?${field}=${encodeURIComponent(l.label)}`} className="font-medium text-fg hover:underline">
                      <Spaced text={l.label} />
                    </Link>
                    {l.whitespace && <StatusBadge className="ml-2" status="needs_review" label="Spacing" />}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-fg-secondary">{l.count}</td>
                  <td className="px-3 py-2">
                    <IdLinks ids={l.ids} max={16} />
                  </td>
                </tr>
              ))}
              {analysis.missing_ids.length > 0 && (
                <tr>
                  <td className="px-3 py-2 italic text-fg-muted">(none)</td>
                  <td className="px-3 py-2 tabular-nums text-fg-secondary">{analysis.missing_ids.length}</td>
                  <td className="px-3 py-2">
                    <IdLinks ids={analysis.missing_ids} max={16} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line p-3">
          <Callout icon={Info}>␣ marks a leading or trailing space stored in the label.</Callout>
        </div>
      </Card>
    </>
  )
}
