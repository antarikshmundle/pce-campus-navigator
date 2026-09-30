import { forwardRef } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { ASSISTANT_PANEL_ID } from './CampusAssistant.jsx'

/** Floating entry point for Campus AI (see CampusAssistant). */
export const AssistantFab = forwardRef(function AssistantFab({ onClick, expanded = false, className }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Ask Campus AI"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={expanded ? ASSISTANT_PANEL_ID : undefined}
      className={cn(
        'tap-transparent flex h-12 items-center gap-2 rounded-pill bg-navy pl-3.5 pr-4 text-body-sm font-semibold text-white shadow-float transition-colors hover:bg-navy-800',
        className,
      )}
    >
      <Sparkles size={18} strokeWidth={2.25} className="text-accent" aria-hidden />
      Ask AI
    </button>
  )
})
