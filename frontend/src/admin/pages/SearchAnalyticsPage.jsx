import { Info, MousePointerClick, Search, SearchX } from 'lucide-react'
import { useAdminResource } from '../AdminDataProvider.jsx'
import { BarList, Callout, Card, LoadState, PageHeader, RefreshButton, StatCard, formatDateTime } from '../ui.jsx'

export const TRACKING_NOTE =
  'Anonymous events, recorded from Stage 11 onwards: search term (normalized, max 80 characters, long digit runs and emails removed), result count, campus place id or OpenStreetMap id. No user, device, IP address or position is stored. Browsers with Do Not Track send nothing.'

export default function SearchAnalyticsPage() {
  const usage = useAdminResource('usage')
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Search analytics"
        description="What students search for on the map and in Nearby. A search is counted once the text settles for 1.5 s, not per keystroke."
        actions={<RefreshButton onClick={usage.reload} busy={usage.status === 'refreshing'} />}
      />
      <LoadState resource={usage} label="search analytics">
        {(u) => <SearchInsights u={u} />}
      </LoadState>
    </>
  )
}

function SearchInsights({ u }) {
  if (!u.available) {
    return <Callout icon={Info}>The usage_events table does not exist yet. It is created when the backend starts.</Callout>
  }
  const s = u.search
  const hasSearches = s.submitted > 0 || s.result_opens.length > 0 || u.nearby.searches.length > 0
  return (
    <div className="space-y-5">
      <Callout icon={Info}>{TRACKING_NOTE}</Callout>
      {!hasSearches ? (
        <Card>
          <p className="text-body-sm text-fg-secondary">No search activity recorded yet. Historical searches before Stage 11 were never stored, so there is nothing to show from earlier.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Search} label="Campus searches" value={s.submitted} sub={`since ${formatDateTime(u.first_at)}`} />
            <StatCard icon={SearchX} label="No-result searches" value={s.zero_result} sub={s.submitted ? `${s.zero_result} of ${s.submitted}` : undefined} />
            <StatCard icon={MousePointerClick} label="Results opened" value={u.by_type.SEARCH_RESULT_OPENED ?? 0} sub="places opened from search results" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Most searched terms">
              <BarList rows={s.top_queries.map((q) => ({ key: q.text, label: q.text, value: q.count, hint: q.results === 0 ? 'no results' : undefined }))} />
            </Card>
            <Card title="Searches with no results" description="Terms nothing on campus matched — candidates for new places or wording.">
              <BarList rows={s.zero_result_queries.map((q) => ({ key: q.text, label: q.text, value: q.count }))} empty="None recorded." />
            </Card>
            <Card title="Opened from search results">
              <BarList rows={s.result_opens.map((p) => ({ key: p.id, label: p.name?.trim() ?? `#${p.id} (deleted)`, value: p.count, to: `/admin/locations?id=${p.id}` }))} empty="None recorded." />
            </Card>
            <Card title="Nearby searches" description="Searches on the Nearby screen (campus, around PCE and Nagpur together).">
              <BarList rows={u.nearby.searches.map((q) => ({ key: q.text, label: q.text, value: q.count, hint: q.results === 0 ? 'no results' : undefined }))} empty="None recorded." />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
