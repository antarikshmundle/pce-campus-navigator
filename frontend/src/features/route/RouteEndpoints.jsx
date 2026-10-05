import { ArrowUpDown, ChevronDown, CircleDot, MapPin } from 'lucide-react'
import { IconButton } from '../../ui/IconButton.jsx'

export const MY_LOCATION = 'me'

/**
 * Origin / destination pickers. Values are 'me' (device location), a
 * location id as string, or '' (unset). Native selects: accessible and
 * thumb-friendly on mobile (16px text, so iOS doesn't zoom on focus).
 *
 * "My location" is always offered as the start, even before a GPS fix;
 * `myLocationNote` (e.g. 'locating…') explains its current state.
 * `originRef` lets the screen focus the start picker (manual fallback).
 */
export function RouteEndpoints({ locations, from, to, myLocationNote, originRef, onChange, onSwap }) {
  return (
    <div className="flex items-center gap-2 px-4">
      <div className="min-w-0 flex-1 space-y-2">
        <EndpointSelect
          label="Starting point"
          icon={CircleDot}
          value={from}
          placeholder="Choose a starting point"
          onChange={(v) => onChange({ from: v, to })}
          locations={locations}
          disabledId={to}
          myLocationNote={myLocationNote}
          selectRef={originRef}
          withMyLocation
        />
        <EndpointSelect
          label="Destination"
          icon={MapPin}
          value={to}
          placeholder="Choose a destination"
          onChange={(v) => onChange({ from, to: v })}
          locations={locations}
          disabledId={from}
        />
      </div>
      <IconButton
        icon={ArrowUpDown}
        label="Swap start and destination"
        variant="ghost"
        onClick={onSwap}
        // Destination can't be "my location", so a device origin can't be swapped.
        disabled={!from || !to || from === MY_LOCATION}
      />
    </div>
  )
}

function EndpointSelect({ label, icon: Icon, value, placeholder, onChange, locations, disabledId, withMyLocation, myLocationNote, selectRef }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy" aria-hidden />
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full appearance-none truncate rounded-field bg-surface-alt pl-9 pr-9 text-body-lg text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {withMyLocation && (
          <option value={MY_LOCATION}>{myLocationNote ? `My current location (${myLocationNote})` : 'My current location'}</option>
        )}
        {locations.map((l) => (
          <option key={l.id} value={String(l.id)} disabled={String(l.id) === disabledId}>
            {l.displayName}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden />
    </label>
  )
}
