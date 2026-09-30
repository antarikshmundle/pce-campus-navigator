import { useMemo } from 'react'
import { Bot, CircleCheck, CircleHelp, Info, MessagesSquare } from 'lucide-react'
import { INTENT, parseIntent } from '../../features/assistant/assistantIntent.js'
import { useAdminResource } from '../AdminDataProvider.jsx'
import { BarList, Callout, Card, LoadState, PageHeader, RefreshButton, StatCard, formatDate, formatDateTime } from '../ui.jsx'

const SMALL_SAMPLE = 50

export const INTENT_LABELS = {
  [INTENT.PLACE_LOOKUP]: 'Place lookup',
  [INTENT.NAVIGATION]: 'Navigation',
  [INTENT.NEARBY]: 'Nearby',
  [INTENT.DISTANCE]: 'Distance',
  [INTENT.INFO_UNAVAILABLE]: 'Hours / contact / fees',
  [INTENT.GREETING]: 'Greeting',
  [INTENT.HELP]: 'Help',
  [INTENT.UNKNOWN]: 'Unrecognized',
}

export default function AIAnalyticsPage() {
  const ai = useAdminResource('ai')
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="AI analytics"
        description="Campus AI usage from the existing chat_logs table. Counts are exact; there is no accuracy score because no evaluation data exists."
        actions={<RefreshButton onClick={ai.reload} busy={ai.status === 'refreshing'} />}
      />
      <LoadState resource={ai} label="AI analytics">
        {(a) => <AI a={a} />}
      </LoadState>
    </>
  )
}

function AI({ a }) {
  // chat_logs has no intent column: classify the stored text with the same
  // deterministic parser Campus AI uses, weighted by how often it was asked.
  const intents = useMemo(() => {
    const counts = {}
    for (const p of a.patterns) {
      const intent = parseIntent(p.text).intent
      counts[intent] = (counts[intent] ?? 0) + p.count
    }
    return Object.entries(counts)
      .map(([intent, value]) => ({ key: intent, label: INTENT_LABELS[intent] ?? intent, value }))
      .sort((x, y) => y.value - x.value)
  }, [a.patterns])
  const classified = intents.reduce((s, i) => s + i.value, 0)

  if (!a.total) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-body-sm text-fg-secondary">
          <Bot size={18} aria-hidden /> No AI queries recorded yet.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MessagesSquare} label="Recorded AI queries" value={a.total} sub={`${formatDateTime(a.first_at)} – ${formatDateTime(a.last_at)}`} />
        <StatCard icon={CircleCheck} label="Resolved" value={a.resolved} sub="answered with a campus place or a direct reply" />
        <StatCard icon={CircleHelp} label="Unresolved" value={a.unresolved} sub="no confident match" />
        <StatCard icon={Bot} label="Distinct questions" value={a.distinct_patterns} sub="ignoring case, spacing and end punctuation" />
      </div>

      {a.total < SMALL_SAMPLE && (
        <Callout icon={Info} tone="accent">
          {a.total} recorded AI {a.total === 1 ? 'query' : 'queries'} — too few for trends. Logs also include any test traffic; chat_logs has no marker to tell it apart.
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Queries by day" description={`Calendar days in ${a.timezone}`}>
          <BarList rows={a.by_day.map((d) => ({ key: d.day, label: formatDate(d.day), value: d.total, hint: `${d.resolved} resolved` }))} />
        </Card>
        <Card title="Query intent" description={`Classified from the stored text with the Campus AI intent parser (${classified} of ${a.total} queries${a.patterns_truncated ? ', top patterns only' : ''}).`}>
          <BarList rows={intents} />
        </Card>
        <Card title="Most referenced places" description="Place named in the log entry when the answer was one campus place.">
          <BarList
            rows={a.top_places.map((p) => ({ key: p.name, label: p.name.trim(), value: p.count, to: p.id ? `/admin/locations?id=${p.id}` : undefined }))}
            empty="No single-place answers recorded."
          />
        </Card>
        <Card title="Recent unresolved queries" description="What people asked that Campus AI couldn't match — candidates for new places or wording.">
          {a.recent_unresolved.length === 0 ? (
            <p className="text-body-sm text-fg-muted">None.</p>
          ) : (
            <ul className="space-y-1.5">
              {a.recent_unresolved.map((q, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-body-sm">
                  <span className="min-w-0 break-words font-mono text-caption text-fg">“{q.text}”</span>
                  <span className="shrink-0 text-micro text-fg-muted">{formatDateTime(q.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Common questions" description="Grouped ignoring case, spacing and trailing punctuation." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body-sm">
            <thead className="bg-surface-page text-caption text-fg-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Question</th>
                <th scope="col" className="px-3 py-2 font-medium">Intent</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Asked</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Resolved</th>
                <th scope="col" className="px-3 py-2 font-medium">Last asked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.patterns.map((p) => (
                <tr key={p.text}>
                  <td className="px-3 py-2 text-fg">{p.text}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-fg-secondary">{INTENT_LABELS[parseIntent(p.text).intent] ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">{p.resolved}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-caption text-fg-secondary">{formatDateTime(p.last_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
