import { Info, LoaderCircle, LocateFixed, MapPin, Navigation, RotateCw } from 'lucide-react'
import { Button } from '../../ui/Button.jsx'
import { AssistantResultCard } from './AssistantResultCard.jsx'
import { SuggestedQueries } from './SuggestedQueries.jsx'

const ACTIONS = {
  navigate: { label: 'Navigate', icon: Navigation, variant: 'primary' },
  open_place: { label: 'Open place', icon: MapPin, variant: 'secondary' },
  locate: { label: 'Use my location', icon: LocateFixed, variant: 'secondary' },
  retry_data: { label: 'Try again', icon: RotateCw, variant: 'secondary' },
}

export function AssistantMessage({ message, byId, onAction, onSuggestion, isLatest, locating }) {
  if (message.role === 'user') {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-card rounded-br-control bg-navy px-3.5 py-2 text-body text-white">
          <span className="sr-only">You: </span>
          {message.text}
        </p>
      </li>
    )
  }

  const actions = (message.actions ?? []).filter((a) => ACTIONS[a.type])
  // A single-place answer shows its row once, with the actions under it.
  const places = message.places ?? []

  return (
    <li className="max-w-full">
      <p className="text-body text-fg">
        <span className="sr-only">Campus AI: </span>
        {message.message}
      </p>
      {message.details?.map((line) => (
        <p key={line} className="mt-1 text-caption text-fg-secondary">
          {line}
        </p>
      ))}

      {byId && places.length > 0 && (
        <AssistantResultCard places={places} byId={byId} rowAction={message.rowAction} onAction={onAction} />
      )}

      {message.note && (
        <p className="mt-2 flex gap-1.5 text-caption text-fg-secondary">
          <Info size={14} className="mt-px shrink-0 text-info" aria-hidden />
          <span>{message.note}</span>
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => {
            const { label, icon, variant } = ACTIONS[action.type]
            const busy = action.type === 'locate' && locating
            return (
              <Button
                key={`${action.type}-${action.placeId ?? ''}`}
                size="sm"
                variant={variant}
                icon={busy ? LoaderCircle : icon}
                disabled={busy}
                onClick={() => onAction(action)}
              >
                {busy ? 'Locating…' : label}
              </Button>
            )
          })}
        </div>
      )}

      {isLatest && <SuggestedQueries suggestions={message.suggestions} onPick={onSuggestion} label="Follow-up questions" className="mt-3" />}
    </li>
  )
}
