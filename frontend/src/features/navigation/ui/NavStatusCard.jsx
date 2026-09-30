import { CircleCheck, ExternalLink } from 'lucide-react'
import { Button } from '../../../ui/Button.jsx'

/**
 * Blocking state instead of guidance (no GPS, no route, bad destination…).
 * actions: [{ label, onClick?, href?, icon?, variant? }]
 */
export function NavStatusCard({ icon: Icon, title, message, actions = [], busy = false }) {
  return (
    <section aria-live="polite" aria-busy={busy}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-surface-alt text-fg-secondary">
          <Icon size={22} strokeWidth={2} className={busy ? 'animate-spin' : undefined} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-title text-fg">{title}</h2>
          {message && <p className="mt-0.5 text-body-sm text-fg-secondary">{message}</p>}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {actions.map(({ label, icon, variant = 'secondary', href, onClick }) => (
            <Button
              key={label}
              variant={variant}
              size={variant === 'primary' ? 'lg' : 'md'}
              icon={icon}
              className="w-full"
              onClick={onClick}
              {...(href ? { href, target: '_blank', rel: 'noreferrer' } : {})}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}

export function ArrivalCard({ destination, onDone }) {
  const where = [destination.building, destination.floor && `Floor ${destination.floor}`].filter(Boolean).join(' · ')
  return (
    <section aria-live="assertive">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-success/10 text-success">
          <CircleCheck size={26} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-heading text-fg">You've arrived</h2>
          <p className="truncate text-body text-fg">{destination.displayName}</p>
          {where && <p className="text-caption text-fg-secondary">{where}</p>}
        </div>
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={onDone}>
        Done
      </Button>
    </section>
  )
}

export const externalLinkAction = (href) => href && { label: 'Open in Google Maps', icon: ExternalLink, variant: 'ghost', href }
