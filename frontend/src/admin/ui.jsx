import { Link } from 'react-router-dom'
import { CircleSlash, RefreshCw } from 'lucide-react'
import { cn } from '../utils/cn.js'
import { STATUS } from './status.js'

export function StatusBadge({ status = 'info', label, className }) {
  const s = STATUS[status] ?? STATUS.info
  const Icon = s.icon
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-semibold text-fg ring-1 ring-inset', s.bg, s.ring, className)}>
      <Icon size={13} strokeWidth={2.5} className={s.tone} aria-hidden />
      {label ?? s.label}
    </span>
  )
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-micro font-semibold uppercase tracking-wide text-fg-muted">{eyebrow}</p>}
        <h1 className="text-heading text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-body-sm text-fg-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ title, description, actions, children, className, bodyClassName, id }) {
  return (
    <section id={id} className={cn('min-w-0 rounded-card border border-line bg-surface shadow-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-body font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-caption text-fg-secondary">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/** A single headline number. `value` null → "Not available" (never a made-up 0). */
export function StatCard({ label, value, sub, icon: Icon, status, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-caption font-medium text-fg-secondary">
          {Icon && <Icon size={15} className="text-fg-muted" aria-hidden />}
          {label}
        </span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className={cn('mt-2 font-semibold tabular-nums text-fg', value == null ? 'text-body text-fg-muted' : 'text-heading-lg')}>
        {value ?? 'Not available'}
      </div>
      {sub && <div className="mt-1 text-caption text-fg-secondary">{sub}</div>}
    </>
  )
  const cls = 'block min-w-0 rounded-card border border-line bg-surface p-4 shadow-card'
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:border-navy/30 focus-visible:outline-accent')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/**
 * Ranked horizontal bars, one hue, value labels always visible (no colour-only
 * reading). rows: [{ key, label, value, hint?, to? }]
 */
export function BarList({ rows, unit = '', empty = 'No data recorded yet.', max: maxProp }) {
  if (!rows?.length) return <p className="text-body-sm text-fg-muted">{empty}</p>
  const max = maxProp ?? Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const label = r.to ? (
          <Link to={r.to} className="truncate text-fg hover:underline">
            {r.label}
          </Link>
        ) : (
          <span className="truncate text-fg">{r.label}</span>
        )
        return (
          <li key={r.key ?? r.label} title={`${r.label}: ${r.value}${unit}${r.hint ? ` · ${r.hint}` : ''}`}>
            <div className="flex items-baseline justify-between gap-3 text-body-sm">
              {label}
              <span className="shrink-0 tabular-nums text-fg-secondary">
                {r.value}
                {unit}
                {r.hint && <span className="ml-1 text-fg-muted">· {r.hint}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-pill bg-surface-alt">
              <div className="h-1.5 rounded-pill bg-navy-700" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function LoadState({ resource, children, label = 'data' }) {
  if (resource.status === 'loading' || resource.status === 'idle') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={`Loading ${label}`}>
        <div className="h-24 animate-pulse rounded-card bg-surface-alt" />
        <div className="h-48 animate-pulse rounded-card bg-surface-alt" />
      </div>
    )
  }
  if (resource.status === 'error' && !resource.data) {
    return <ErrorPanel error={resource.error} onRetry={resource.reload} label={label} />
  }
  return (
    <>
      {resource.status === 'error' && <ErrorPanel compact error={resource.error} onRetry={resource.reload} label={label} />}
      {children(resource.data)}
    </>
  )
}

export function ErrorPanel({ error, onRetry, label, compact }) {
  return (
    <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-card border border-error/25 bg-error/5 px-4', compact ? 'mb-4 py-2.5' : 'py-5')}>
      <div className="flex items-start gap-2.5">
        <CircleSlash size={18} className="mt-0.5 shrink-0 text-error" aria-hidden />
        <div>
          <p className="text-body-sm font-semibold text-fg">
            {error?.unavailable ? 'Backend unavailable' : `Couldn't load ${label}`}
          </p>
          <p className="text-caption text-fg-secondary">
            {error?.unavailable ? 'The API server is not responding. Nothing is shown rather than stale or invented figures.' : error?.message}
          </p>
        </div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-caption font-semibold text-fg hover:bg-surface-alt">
          <RefreshCw size={14} aria-hidden /> Retry
        </button>
      )}
    </div>
  )
}

export function RefreshButton({ onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-caption font-semibold text-fg hover:bg-surface-alt disabled:opacity-60"
    >
      <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} aria-hidden /> Refresh
    </button>
  )
}

export function Callout({ icon: Icon, children, tone = 'neutral', className }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-field px-3 py-2.5 text-body-sm', tone === 'accent' ? 'bg-accent-soft text-fg' : 'bg-surface-alt text-fg-secondary', className)}>
      {Icon && <Icon size={16} className={cn('mt-0.5 shrink-0', tone === 'accent' ? 'text-accent-dark' : 'text-fg-muted')} aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Location ids as links to their detail in the locations table. */
export function IdLinks({ ids, max = 30 }) {
  if (!ids?.length) return <span className="text-fg-muted">—</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.slice(0, max).map((id) => (
        <Link key={id} to={`/admin/locations?id=${id}`} className="rounded-control bg-surface-alt px-1.5 py-0.5 font-mono text-micro text-fg hover:bg-line">
          {id}
        </Link>
      ))}
      {ids.length > max && <span className="text-micro text-fg-muted">+{ids.length - max} more</span>}
    </span>
  )
}

/** Makes leading/trailing spaces visible: "Food " → Food␣ */
export function Spaced({ text }) {
  if (text == null || text === '') return <span className="text-fg-muted">—</span>
  const lead = text.length - text.trimStart().length
  const trail = text.length - text.trimEnd().length
  return (
    <span>
      {lead > 0 && <span className="text-info" title={`${lead} leading space(s)`}>{'␣'.repeat(lead)}</span>}
      {text.trim()}
      {trail > 0 && <span className="text-info" title={`${trail} trailing space(s)`}>{'␣'.repeat(trail)}</span>}
    </span>
  )
}

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'
export const formatDate = (iso) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00+05:30`).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—'

export const satelliteUrl = (lat, lng) => `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},19z/data=!3m1!1e3`
