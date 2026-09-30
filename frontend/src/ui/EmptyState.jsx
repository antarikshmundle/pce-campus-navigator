import { cn } from '../utils/cn.js'

/** `compact` fits inside a peeking bottom sheet (~200px). */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', compact = false, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-3' : 'py-8', className)}>
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-card',
            compact ? 'mb-2 h-10 w-10' : 'mb-3 h-12 w-12',
            tone === 'error' ? 'bg-error/10 text-error' : 'bg-surface-alt text-fg-secondary',
          )}
        >
          <Icon size={compact ? 20 : 22} strokeWidth={2} aria-hidden />
        </div>
      )}
      <p className="text-title text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-body-sm text-fg-secondary">{description}</p>}
      {action && <div className={compact ? 'mt-3' : 'mt-4'}>{action}</div>}
    </div>
  )
}
