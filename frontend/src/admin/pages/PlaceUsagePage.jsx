import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Info, Smartphone } from 'lucide-react'
import { useAdminResource, useSnapshotReport } from '../AdminDataProvider.jsx'
import { BarList, Callout, Card, LoadState, PageHeader, RefreshButton, StatusBadge } from '../ui.jsx'
import { TRACKING_NOTE } from './SearchAnalyticsPage.jsx'

export default function PlaceUsagePage() {
  const usage = useAdminResource('usage')
  const ai = useAdminResource('ai')
  const snapshot = useSnapshotReport()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, usage.data])

  // OSM key → name, from the bundled snapshot (live-only places show their id).
  const osmName = (key) => {
    const layers = snapshot.report?.layers
    const hit = layers && [...(layers.around?.places ?? []), ...(layers.nagpur?.places ?? [])].find((p) => p.key === key)
    return hit?.name ?? key
  }

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Place usage"
        description="Which places are opened, navigated to and referenced by Campus AI — server-side records only."
        actions={<RefreshButton onClick={() => (usage.reload(), ai.reload())} busy={usage.status === 'refreshing'} />}
      />
      <div className="space-y-5">
        <LoadState resource={usage} label="place usage">
          {(u) =>
            !u.available ? (
              <Callout icon={Info}>The usage_events table does not exist yet.</Callout>
            ) : (
              <div className="space-y-5">
                <Callout icon={Info}>{TRACKING_NOTE}</Callout>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card title="Most opened campus places" description="Place detail screens opened (any entry: search, map, AI, Saved, link).">
                    <BarList rows={u.places.opened.map((p) => ({ key: p.id, label: p.name?.trim() ?? `#${p.id} (deleted)`, value: p.count, to: `/admin/locations?id=${p.id}` }))} empty="No places opened since tracking started." />
                  </Card>
                  <Card
                    title="Most navigated destinations"
                    description={`Navigation started in the app or handed to Google Maps${
                      Object.keys(u.places.navigation_modes).length
                        ? ` (${Object.entries(u.places.navigation_modes).map(([m, n]) => `${n} ${m === 'in_app' ? 'in-app' : m === 'google_maps' ? 'Google Maps' : m}`).join(', ')})`
                        : ''
                    }.`}
                  >
                    <BarList rows={u.places.navigated.map((p) => ({ key: p.id, label: p.name?.trim() ?? `#${p.id} (deleted)`, value: p.count, to: `/admin/locations?id=${p.id}` }))} empty="No navigation requests recorded." />
                  </Card>
                  <Card title="Opened nearby places" description="Off-campus OpenStreetMap places opened from Nearby.">
                    <BarList rows={u.nearby.opened.map((p) => ({ key: `${p.key}-${p.layer}`, label: osmName(p.key), value: p.count, hint: p.layer === 'nagpur' ? 'Nagpur' : 'around PCE' }))} empty="None recorded." />
                  </Card>
                  <LoadState resource={ai} label="AI references">
                    {(a) => (
                      <Card title="Most referenced by Campus AI" description="From chat_logs (all recorded AI queries).">
                        <BarList rows={a.top_places.map((p) => ({ key: p.name, label: p.name.trim(), value: p.count, to: p.id ? `/admin/locations?id=${p.id}` : undefined }))} empty="None recorded." />
                      </Card>
                    )}
                  </LoadState>
                </div>
              </div>
            )
          }
        </LoadState>

        <Card id="device-local" className="scroll-mt-20" title="Device-local saved & recent places" actions={<StatusBadge status="info" label="Not on server" />}>
          <div className="flex items-start gap-3">
            <Smartphone size={20} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
            <p className="text-body-sm text-fg-secondary">
              Saved places and recently viewed places (Stage 9) live only in each student's browser storage. They are never uploaded, so the admin
              cannot see or count them — this is intentional. The figures above are server analytics only.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
