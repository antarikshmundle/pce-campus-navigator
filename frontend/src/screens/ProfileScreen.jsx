import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, ChevronRight, Info, Layers, ShieldCheck, Sparkles, Trash2, Volume2 } from 'lucide-react'
import { PageFrame } from './PlaceholderScreen.jsx'
import { MapTypeToggle } from '../features/map/MapTypeToggle.jsx'
import { readMapType, writeMapType } from '../features/map/MapProvider.jsx'
import { readMuted, speechSupported, writeMuted } from '../features/navigation/voice/useVoiceGuidance.js'
import { useSavedPlaces } from '../features/saved/SavedPlacesProvider.jsx'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { Button } from '../ui/Button.jsx'
import { cn } from '../utils/cn.js'
import { version } from '../../package.json'

const LINKS = [
  {
    to: '/admin',
    icon: ShieldCheck,
    title: 'Admin dashboard',
    description: 'Manage campus locations (sign-in required)',
  },
]

const card = 'divide-y divide-line overflow-hidden rounded-sheet bg-surface shadow-card'

function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="mb-3 text-caption font-semibold uppercase tracking-wide text-fg-muted">
      {children}
    </h2>
  )
}

function RowIcon({ icon: Icon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-surface-alt text-navy">
      <Icon size={20} aria-hidden />
    </span>
  )
}

function RowText({ id, title, description }) {
  return (
    <span className="min-w-0 flex-1">
      <span id={id} className="block text-body font-medium text-fg">
        {title}
      </span>
      {description && <span className="block text-caption text-fg-secondary">{description}</span>}
    </span>
  )
}

function Switch({ checked, onChange, disabled, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="tap-transparent -m-1.5 flex h-11 w-14 shrink-0 items-center justify-center rounded-pill disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={cn('flex h-7 w-12 items-center rounded-pill p-0.5 transition-colors', checked ? 'bg-navy' : 'bg-line')}>
        <span
          className={cn(
            'h-6 w-6 rounded-pill bg-surface shadow-pin transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  )
}

/**
 * Profile: device preferences, what's stored on this device, about, admin.
 * No accounts and no personal details — everything here is per device.
 */
export default function ProfileScreen() {
  const [mapType, setMapType] = useState(readMapType)
  const [voiceOn, setVoiceOn] = useState(() => !readMuted())
  const voiceSupported = speechSupported()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { savedCount, recentEntries, clear, clearRecent } = useSavedPlaces()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const hasDeviceData = savedCount > 0 || recentEntries.length > 0
  const cancelRef = useRef(null)
  const clearRowRef = useRef(null)
  const confirmOpened = useRef(false)

  // Keep keyboard focus on the control that replaced the one just pressed.
  useEffect(() => {
    if (confirmingClear) cancelRef.current?.focus()
    else if (confirmOpened.current) clearRowRef.current?.focus()
    confirmOpened.current = confirmingClear
  }, [confirmingClear])

  function changeMapType(next) {
    setMapType(next)
    writeMapType(next)
  }

  function changeVoice(on) {
    setVoiceOn(on)
    writeMuted(!on)
  }

  function clearDeviceData() {
    clear()
    clearRecent()
    setConfirmingClear(false)
  }

  return (
    <PageFrame title="Profile">
      <section aria-labelledby="prefs-heading" className="mt-8 first:mt-0">
        <SectionTitle id="prefs-heading">Preferences</SectionTitle>
        <div className={card}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <RowIcon icon={Layers} />
            <RowText id="pref-map-type" title="Map view" description="How the campus map opens" />
            {/* The map's floating toggle, flattened for a settings card; own line on phones. */}
            <div className="basis-full pl-[52px] sm:basis-auto sm:pl-0 [&>div]:inline-flex [&>div]:bg-surface-alt [&>div]:shadow-none">
              <MapTypeToggle value={mapType} onChange={changeMapType} />
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <RowIcon icon={Volume2} />
            <RowText
              id="pref-voice"
              title="Voice guidance"
              description={
                voiceSupported ? 'Spoken directions during live navigation' : 'Not available in this browser'
              }
            />
            <Switch checked={voiceSupported && voiceOn} onChange={changeVoice} disabled={!voiceSupported} labelledBy="pref-voice" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <RowIcon icon={Sparkles} />
            <RowText
              title="Motion"
              description={
                reducedMotion
                  ? 'Reduced — following your device setting'
                  : 'Standard — follows your device’s reduced-motion setting'
              }
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="device-heading" className="mt-8 first:mt-0">
        <SectionTitle id="device-heading">On this device</SectionTitle>
        <div className={card}>
          <Link to="/saved" className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt">
            <RowIcon icon={Bookmark} />
            <RowText
              title="Saved places"
              description={
                savedCount ? `${savedCount} saved · ${recentEntries.length} recently viewed` : 'Nothing saved yet'
              }
            />
            <ChevronRight size={18} className="text-fg-muted" aria-hidden />
          </Link>
          {hasDeviceData &&
            (confirmingClear ? (
              <div className="px-4 py-3.5">
                <div role="group" aria-labelledby="clear-confirm-text">
                  <p id="clear-confirm-text" className="text-body-sm text-fg">
                    Remove all saved and recently viewed places from this device?
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button ref={cancelRef} variant="ghost" size="md" onClick={() => setConfirmingClear(false)}>
                      Cancel
                    </Button>
                    <Button variant="dark" size="md" icon={Trash2} onClick={clearDeviceData}>
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                ref={clearRowRef}
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-left text-body font-medium text-error hover:bg-surface-alt"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-error/10">
                  <Trash2 size={20} aria-hidden />
                </span>
                Clear saved and recent places
              </button>
            ))}
        </div>
        <p className="mt-2 px-1 text-caption text-fg-muted">
          Saved and recently viewed places stay in this browser — campus places as IDs, off-campus places as their public name and map position. Never sent to a server.
        </p>
      </section>

      <section aria-labelledby="about-heading" className="mt-8 first:mt-0">
        <SectionTitle id="about-heading">About</SectionTitle>
        <div className={card}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <RowIcon icon={Info} />
            <RowText title="PCE Campus Navigator" description={`Version ${version}`} />
          </div>
        </div>
      </section>

      <section aria-labelledby="admin-heading" className="mt-8 first:mt-0">
        <SectionTitle id="admin-heading">Admin</SectionTitle>
        <ul className={card}>
          {LINKS.map(({ to, icon, title, description }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt">
                <RowIcon icon={icon} />
                <RowText title={title} description={description} />
                <ChevronRight size={18} className="text-fg-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  )
}
