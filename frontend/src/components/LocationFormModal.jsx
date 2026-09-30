import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, TriangleAlert, X } from 'lucide-react'
import { distanceMeters } from '../utils/geo.js'

const FIELDS = ['name', 'category', 'building', 'floor', 'latitude', 'longitude', 'description', 'image_url']
const EMPTY = { name: '', category: '', latitude: '', longitude: '', building: '', floor: '', description: '', image_url: '' }
const MAX = { name: 150, category: 80, building: 120, floor: 40, image_url: 300 }
const CANONICAL_IDS = [16, 84]
const OUTLIER_M = 3000

const toForm = (loc) =>
  Object.fromEntries(FIELDS.map((f) => [f, loc?.[f] == null ? '' : String(loc[f])]))

const key = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Add / edit one location. Edits send only the fields that changed, exactly
 * as typed — nothing is trimmed or normalized behind the admin's back.
 * Errors block saving; warnings only inform.
 *
 * context: { center: {latitude, longitude} | null, categories: [label], buildings: [label] }
 */
export default function LocationFormModal({ open, initial, onClose, onSave, saving, error, context = {} }) {
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setForm(initial ? toForm(initial) : EMPTY)
    setTouched(false)
  }, [initial, open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { errors, warnings, changes } = useMemo(() => validate(form, initial, context), [form, initial, context])

  if (!open) return null

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length || (initial && !Object.keys(changes).length)) return
    onSave(changes)
  }

  const input = 'w-full rounded-control border border-line bg-surface px-3 py-2 text-body-sm text-fg outline-none focus:border-navy focus:ring-2 focus:ring-navy/15'
  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={`loc-${name}`} className="mb-1 block text-caption font-medium text-fg-secondary">
        {label}
      </label>
      <input id={`loc-${name}`} value={form[name]} onChange={set(name)} className={input} aria-invalid={Boolean(touched && errors[name])} {...props} />
      {touched && errors[name] && <p className="mt-1 text-micro text-error">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-navy/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="loc-form-title">
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-card bg-surface shadow-float sm:rounded-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id="loc-form-title" className="text-title text-fg">
            {initial ? `Edit location #${initial.id}` : 'Add location'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-control text-fg-secondary hover:bg-surface-alt">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {initial && (
            <p className="text-caption text-fg-secondary">
              ID <span className="font-mono text-fg">{initial.id}</span> is fixed and can't be changed.
            </p>
          )}
          {field('name', 'Name', { required: true, maxLength: MAX.name, autoFocus: !initial })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('category', 'Category', { required: true, maxLength: MAX.category, list: 'loc-categories' })}
            {field('building', 'Building', { maxLength: MAX.building, list: 'loc-buildings' })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {field('floor', 'Floor', { maxLength: MAX.floor })}
            {field('latitude', 'Latitude', { required: true, inputMode: 'decimal', className: `${input} font-mono` })}
            {field('longitude', 'Longitude', { required: true, inputMode: 'decimal', className: `${input} font-mono` })}
          </div>
          <div>
            <label htmlFor="loc-description" className="mb-1 block text-caption font-medium text-fg-secondary">
              Description
            </label>
            <textarea id="loc-description" value={form.description} onChange={set('description')} rows={3} className={input} />
          </div>
          {field('image_url', 'Image URL', { maxLength: MAX.image_url, type: 'url' })}

          <datalist id="loc-categories">
            {(context.categories ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <datalist id="loc-buildings">
            {(context.buildings ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-field bg-accent-soft px-3 py-2.5">
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-caption text-fg">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0 text-accent-dark" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          <span className="mr-auto text-caption text-fg-muted">
            {initial ? `${Object.keys(changes).length} field(s) changed` : ''}
          </span>
          <button type="button" onClick={onClose} className="h-10 rounded-control border border-line px-4 text-body-sm font-semibold text-fg hover:bg-surface-alt">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (initial && !Object.keys(changes).length)}
            className="h-10 rounded-control bg-navy px-4 text-body-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function validate(form, initial, { center, categories = [] }) {
  const errors = {}
  const warnings = []

  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!form.category.trim()) errors.category = 'Category is required.'
  for (const [f, max] of Object.entries(MAX)) if (form[f].length > max) errors[f] = `At most ${max} characters.`

  const lat = form.latitude.trim() === '' ? NaN : Number(form.latitude)
  const lng = form.longitude.trim() === '' ? NaN : Number(form.longitude)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = 'Latitude must be a number between -90 and 90.'
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = 'Longitude must be a number between -180 and 180.'

  if (form.name !== form.name.trim()) warnings.push('Name has leading or trailing spaces.')
  if (form.category && !categories.includes(form.category)) {
    const same = categories.find((c) => key(c) === key(form.category))
    warnings.push(same ? `“${form.category}” differs from the existing category “${same}” only by case or spacing.` : `“${form.category}” is a new category label.`)
  }
  if (!errors.latitude && !errors.longitude) {
    if (lat === lng) warnings.push('Latitude equals longitude — likely a copy/paste slip.')
    if (center) {
      const d = distanceMeters({ lat: center.latitude, lng: center.longitude }, { lat, lng })
      if (d > OUTLIER_M) warnings.push(`This point is ${(d / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} km from the campus centre — it will be flagged "Needs verification".`)
    }
  }

  // Payload: typed values, only what changed when editing.
  const value = (f) => {
    if (f === 'latitude') return lat
    if (f === 'longitude') return lng
    if (f === 'name' || f === 'category') return form[f]
    return form[f] === '' ? (initial && initial[f] === '' ? '' : null) : form[f]
  }
  const changes = {}
  for (const f of FIELDS) {
    const v = value(f)
    if (!initial || (initial[f] ?? null) !== v) changes[f] = v
  }
  if (initial && Object.keys(changes).length && initial.id >= CANONICAL_IDS[0] && initial.id <= CANONICAL_IDS[1]) {
    warnings.push('This is a canonical record: after saving, the database will differ from locations.json until it is re-exported (python -m app.db.export_locations).')
  }
  if (!initial) warnings.push('A new location gets the next free ID and is not part of locations.json until re-exported.')
  return { errors, warnings, changes }
}
