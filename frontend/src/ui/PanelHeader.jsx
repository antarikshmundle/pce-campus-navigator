import { ArrowLeft } from 'lucide-react'
import { IconButton } from './IconButton.jsx'

/** Header row for panel screens: back button + title. */
export function PanelHeader({ title, onBack, backLabel = 'Back' }) {
  return (
    <div className="flex items-center gap-1 px-2 pb-1">
      <IconButton icon={ArrowLeft} label={backLabel} variant="ghost" size="md" onClick={onBack} />
      {title && <h2 className="text-title text-fg">{title}</h2>}
    </div>
  )
}
