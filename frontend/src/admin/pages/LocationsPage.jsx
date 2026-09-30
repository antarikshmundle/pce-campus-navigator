import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import LocationFormModal from '../../components/LocationFormModal.jsx'
import { useAdminResource, useInvalidate } from '../AdminDataProvider.jsx'
import { LOCATION_FLAGS, rowStatus } from '../status.js'
import { Card, ErrorPanel, IdLinks, LoadState, PageHeader, RefreshButton, Spaced, StatusBadge, formatDateTime, satelliteUrl } from '../ui.jsx'
import { cn } from '../../utils/cn.js'

const PAGE_SIZE = 25
const NONE = '__none__'
const FLAG_FILTERS = [
  ['', 'Any status'],
  ['attention', 'Needs attention'],
  ['needs_verification', 'Needs verification'],
  ['name_whitespace', 'Name spacing'],
  ['category_variant', 'Category variant'],
  ['category_whitespace', 'Category spacing'],
  ['shared_coordinates', 'Shared position'],
  ['missing_building', 'No building'],
  ['missing_description', 'No description'],
]

/** "16-20, 32" → Set of ids; null when empty or unparsable. */
function parseIds(text) {
  const ids = new Set()
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (!m) return null
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])]
    for (let i = Math.min(a, b); i <= Math.max(a, b) && ids.size < 1000; i++) ids.add(i)
  }
  return ids.size ? ids : null
}

export default function LocationsPage() {
  const locations = useAdminResource('locations')
  const health = useAdminResource('health')
  const invalidate = useInvalidate()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState(null) // null | { initial }
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')

  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const building = params.get('building') ?? ''
  const flag = params.get('flag') ?? ''
  const idsText = params.get('ids') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const openId = params.get('id') ? Number(params.get('id')) : null

  const setParam = useCallback(
    (next) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) v === '' || v == null ? p.delete(k) : p.set(k, v)
          if (!('page' in next)) p.delete('page')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const rows = locations.data ?? []
  const flags = health.data?.row_flags ?? {}
  const idSet = useMemo(() => (idsText ? parseIds(idsText) : null), [idsText])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle && !`${r.id} ${r.name} ${r.description ?? ''} ${r.building ?? ''}`.toLowerCase().includes(needle)) return false
      if (category && r.category !== category) return false
      if (building === NONE ? r.building?.trim() : building && r.building !== building) return false
      if (idSet && !idSet.has(r.id)) return false
      const f = flags[r.id] ?? []
      if (flag === 'attention' ? !['warning', 'needs_review'].includes(rowStatus(f)) : flag && !f.includes(flag)) return false
      return true
    })
  }, [rows, q, category, building, idSet, flag, flags])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const labels = (field) => {
    const counts = new Map()
    rows.forEach((r) => r[field]?.trim() && counts.set(r[field], (counts.get(r[field]) ?? 0) + 1))
    return [...counts].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }) || a[0].localeCompare(b[0]))
  }
  const categoryOptions = useMemo(() => labels('category'), [rows])
  const buildingOptions = useMemo(() => labels('building'), [rows])
  const formContext = useMemo(
    () => ({ center: health.data?.center ?? null, categories: categoryOptions.map(([c]) => c), buildings: buildingOptions.map(([b]) => b) }),
    [health.data, categoryOptions, buildingOptions],
  )

  const selected = openId != null ? rows.find((r) => r.id === openId) ?? null : null
  const filtersActive = q || category || building || flag || idsText

  async function save(payload) {
    setSaving(true)
    setFormError('')
    try {
      if (modal.initial) await api.updateLocation(modal.initial.id, payload)
      else await api.createLocation(payload)
      setModal(null)
      invalidate(['locations', 'health', 'summary', 'system'])
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(loc) {
    const canonical = loc.id >= 16 && loc.id <= 84
    const msg = `Delete #${loc.id} “${loc.name.trim()}”? This can't be undone.${canonical ? '\n\nThis is one of the canonical campus records: the database will no longer match locations.json.' : ''}`
    if (!window.confirm(msg)) return
    setActionError('')
    try {
      await api.deleteLocation(loc.id)
      setParam({ id: '' })
      invalidate(['locations', 'health', 'summary', 'system'])
    } catch (e) {
      setActionError(e.message)
    }
  }

  const select = 'h-9 rounded-control border border-line bg-surface px-2.5 text-body-sm text-fg outline-none focus:border-navy'

  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Campus locations"
        description="The places shown on the student map and used by Campus AI. IDs are fixed; edits are sent exactly as typed."
        actions={
          <>
            <RefreshButton onClick={() => (locations.reload(), health.reload())} busy={locations.status === 'refreshing'} />
            <button type="button" onClick={() => (setFormError(''), setModal({ initial: null }))} className="inline-flex h-9 items-center gap-1.5 rounded-control bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-800">
              <Plus size={15} aria-hidden /> Add location
            </button>
          </>
        }
      />
      {actionError && <ErrorPanel compact error={{ message: actionError }} label="the change" />}

      <LoadState resource={locations} label="locations">
        {() => (
          <div>
            <Card bodyClassName="p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <label className="relative min-w-[200px] flex-1">
                  <span className="sr-only">Search locations</span>
                  <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setParam({ q: e.target.value })}
                    placeholder="Search name, description, building, ID"
                    className="h-9 w-full rounded-control border border-line bg-surface pl-8 pr-2.5 text-body-sm outline-none focus:border-navy"
                  />
                </label>
                <select aria-label="Category" value={category} onChange={(e) => setParam({ category: e.target.value })} className={select}>
                  <option value="">All categories</option>
                  {categoryOptions.map(([c, n]) => (
                    <option key={c} value={c}>
                      {c.trim()}
                      {c !== c.trim() ? ' ␣' : ''} ({n})
                    </option>
                  ))}
                </select>
                <select aria-label="Building" value={building} onChange={(e) => setParam({ building: e.target.value })} className={cn(select, 'max-w-[190px]')}>
                  <option value="">All buildings</option>
                  <option value={NONE}>(no building)</option>
                  {buildingOptions.map(([b, n]) => (
                    <option key={b} value={b}>
                      {b.trim()}
                      {b !== b.trim() ? ' ␣' : ''} ({n})
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Filter by ID or range"
                  value={idsText}
                  onChange={(e) => setParam({ ids: e.target.value })}
                  placeholder="IDs e.g. 16-20, 32"
                  className={cn('h-9 w-44 rounded-control border bg-surface px-2.5 font-mono text-caption outline-none focus:border-navy', idsText && !idSet ? 'border-error' : 'border-line')}
                />
                <select aria-label="Status" value={flag} onChange={(e) => setParam({ flag: e.target.value })} className={select}>
                  {FLAG_FILTERS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                {filtersActive && (
                  <button type="button" onClick={() => setParam({ q: '', category: '', building: '', flag: '', ids: '' })} className="inline-flex h-9 items-center gap-1 rounded-control px-2 text-caption font-semibold text-fg-secondary hover:bg-surface-alt">
                    <X size={14} aria-hidden /> Clear
                  </button>
                )}
              </div>

              {/* relative: keeps the table's sr-only header inside the scroller (no page-wide overflow) */}
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-body-sm">
                  <thead className="bg-surface-page text-caption text-fg-secondary">
                    <tr>
                      {['ID', 'Name', 'Category', 'Building', 'Floor', 'Latitude', 'Longitude', 'Status'].map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((r) => {
                      const f = flags[r.id] ?? []
                      const status = rowStatus(f)
                      const main = f.find((x) => LOCATION_FLAGS[x]?.status === status && status !== 'healthy')
                      return (
                        <tr key={r.id} className={cn('hover:bg-surface-page', openId === r.id && 'bg-accent-soft/60')}>
                          <td className="px-3 py-2 font-mono text-caption text-fg-secondary">{r.id}</td>
                          <td className="max-w-[260px] px-3 py-2">
                            <button type="button" onClick={() => setParam({ id: r.id, page: current })} className="text-left font-medium text-fg hover:underline">
                              <Spaced text={r.name} />
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-fg-secondary">
                            <Spaced text={r.category} />
                          </td>
                          <td className="px-3 py-2 text-fg-secondary">
                            <Spaced text={r.building} />
                          </td>
                          <td className="px-3 py-2 text-fg-secondary">
                            <Spaced text={r.floor} />
                          </td>
                          <td className="px-3 py-2 font-mono text-caption text-fg-secondary">{r.latitude.toFixed(6)}</td>
                          <td className="px-3 py-2 font-mono text-caption text-fg-secondary">{r.longitude.toFixed(6)}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {health.data ? <StatusBadge status={status} label={main ? LOCATION_FLAGS[main].label : undefined} /> : <span className="text-fg-muted">…</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <button type="button" onClick={() => (setFormError(''), setModal({ initial: r }))} aria-label={`Edit ${r.name.trim()}`} className="inline-flex h-8 w-8 items-center justify-center rounded-control text-fg-secondary hover:bg-surface-alt hover:text-fg">
                              <Pencil size={15} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-fg-secondary">
                          {rows.length ? 'No locations match these filters.' : 'No locations in the database.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-caption text-fg-secondary">
                <span>
                  {filtered.length === rows.length ? `${rows.length} locations` : `${filtered.length} of ${rows.length} locations`}
                  {filtered.length > PAGE_SIZE && ` · page ${current} of ${pages}`}
                </span>
                {pages > 1 && (
                  <div className="flex gap-1">
                    <button type="button" disabled={current <= 1} onClick={() => setParam({ page: current - 1 })} aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-control border border-line disabled:opacity-40">
                      <ChevronLeft size={15} aria-hidden />
                    </button>
                    <button type="button" disabled={current >= pages} onClick={() => setParam({ page: current + 1 })} aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-control border border-line disabled:opacity-40">
                      <ChevronRight size={15} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </Card>

            {openId != null && (
              <LocationDetailPanel
                location={selected}
                id={openId}
                health={health.data}
                onClose={() => setParam({ id: '', page: current })}
                onEdit={() => (setFormError(''), setModal({ initial: selected }))}
                onDelete={() => remove(selected)}
              />
            )}
          </div>
        )}
      </LoadState>

      <LocationFormModal
        open={Boolean(modal)}
        initial={modal?.initial ?? null}
        onClose={() => setModal(null)}
        onSave={save}
        saving={saving}
        error={formError}
        context={formContext}
      />
    </>
  )
}

const FLAG_HELP = {
  needs_verification: 'Stored position is far from campus. The value is preserved; verify it on satellite imagery and correct it by hand if wrong.',
  name_whitespace: 'The name has leading or trailing spaces (shown as ␣).',
  category_variant: 'The category label looks like a variant of another label (case, spacing or plural).',
  category_whitespace: 'The category label has leading or trailing spaces.',
  shared_coordinates: 'Another place has exactly the same coordinates — normal for rooms in one building.',
  missing_description: 'No description recorded.',
  missing_building: 'No building recorded.',
  missing_floor: 'No floor recorded.',
  invalid_coordinates: 'Latitude/longitude out of range or missing.',
}

function LocationDetailPanel({ location, id, health, onClose, onEdit, onDelete }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role=dialog]') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Overlay drawer at every width, so the table keeps its full width.
  const wrap = 'fixed inset-y-0 right-0 z-modal w-full overflow-y-auto border-l border-line bg-surface shadow-float sm:w-[400px]'
  if (!location) {
    return (
      <aside className={wrap} aria-label="Location details">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-body font-semibold">Location #{id}</h2>
          <button type="button" onClick={onClose} aria-label="Close details" className="flex h-9 w-9 items-center justify-center rounded-control hover:bg-surface-alt">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="p-4 text-body-sm text-fg-secondary">No location with this ID exists in the database.</p>
      </aside>
    )
  }

  const flags = health?.row_flags?.[location.id] ?? []
  const mismatch = health?.canonical?.mismatched?.find((m) => m.id === location.id)
  const inCanonical = health && !health.canonical?.extra_in_db?.includes(location.id)
  const shared = health?.shared_coordinate_groups?.find((g) => g.places.some((p) => p.id === location.id))
  const suspicious = health?.suspicious?.find((s) => s.id === location.id)

  const row = (label, value) => (
    <div className="grid grid-cols-[96px_1fr] gap-2 py-1.5">
      <dt className="text-caption text-fg-secondary">{label}</dt>
      <dd className="min-w-0 break-words text-body-sm text-fg">{value}</dd>
    </div>
  )

  return (
    <aside className={wrap} aria-label="Location details">
      <div className="sticky top-0 flex items-start justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-micro text-fg-muted">#{location.id}</p>
          <h2 className="text-title text-fg">{location.name.trim()}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control hover:bg-surface-alt">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {health ? <StatusBadge status={rowStatus(flags)} /> : null}
          {health && (
            <StatusBadge
              status={mismatch ? 'warning' : inCanonical ? 'healthy' : 'info'}
              label={mismatch ? 'Differs from locations.json' : inCanonical ? 'Matches locations.json' : 'Not in locations.json'}
            />
          )}
        </div>

        {suspicious && (
          <div className="rounded-field border border-info/25 bg-info/5 p-3 text-body-sm">
            <p className="font-semibold text-fg">Needs verification</p>
            <p className="mt-1 text-caption text-fg-secondary">{suspicious.reasons.join(' · ')}. The stored value is preserved.</p>
          </div>
        )}

        <dl className="divide-y divide-line">
          {row('Name', <Spaced text={location.name} />)}
          {row('Category', <Spaced text={location.category} />)}
          {row('Building', <Spaced text={location.building} />)}
          {row('Floor', <Spaced text={location.floor} />)}
          {row('Latitude', <span className="font-mono text-caption">{String(location.latitude)}</span>)}
          {row('Longitude', <span className="font-mono text-caption">{String(location.longitude)}</span>)}
          {row('Description', location.description?.trim() ? location.description : <span className="text-fg-muted">—</span>)}
          {row('Image URL', location.image_url || <span className="text-fg-muted">—</span>)}
          {row('Created', formatDateTime(location.created_at))}
          {row('Updated', formatDateTime(location.updated_at))}
        </dl>

        {mismatch && <p className="text-caption text-warning">Fields differing from locations.json: {mismatch.fields.join(', ')}</p>}

        {flags.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-caption font-semibold text-fg">Observations</h3>
            <ul className="space-y-1.5">
              {flags.map((f) => (
                <li key={f} className="flex items-start gap-2 text-caption text-fg-secondary">
                  <StatusBadge status={LOCATION_FLAGS[f]?.status ?? 'info'} label={LOCATION_FLAGS[f]?.label ?? f} />
                  <span className="pt-0.5">{FLAG_HELP[f]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shared && (
          <p className="text-caption text-fg-secondary">
            Same position as: <IdLinks ids={shared.places.filter((p) => p.id !== location.id).map((p) => p.id)} />
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="button" onClick={onEdit} className="inline-flex h-9 items-center gap-1.5 rounded-control bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-800">
            <Pencil size={14} aria-hidden /> Edit
          </button>
          <a href={satelliteUrl(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-caption font-semibold text-fg hover:bg-surface-alt">
            <ExternalLink size={14} aria-hidden /> Satellite view
          </a>
          <button type="button" onClick={onDelete} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-caption font-semibold text-error hover:bg-error/5">
            <Trash2 size={14} aria-hidden /> Delete
          </button>
        </div>
      </div>
    </aside>
  )
}
