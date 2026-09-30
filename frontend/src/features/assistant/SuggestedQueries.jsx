import { Chip } from '../../ui/Chip.jsx'
import { cn } from '../../utils/cn.js'

/** Tappable example / follow-up questions; tapping sends the question. */
export function SuggestedQueries({ suggestions, onPick, label = 'Suggested questions', className }) {
  if (!suggestions?.length) return null
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((s) => (
        <Chip key={s} onClick={() => onPick(s)} title={s} className="max-w-full">
          <span className="truncate">{s}</span>
        </Chip>
      ))}
    </div>
  )
}
