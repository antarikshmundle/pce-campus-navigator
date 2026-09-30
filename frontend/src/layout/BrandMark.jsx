import { Navigation2 } from 'lucide-react'
import { cn } from '../utils/cn.js'

export function BrandMark({ className }) {
  return (
    <span
      className={cn('flex h-10 w-10 items-center justify-center rounded-field bg-navy', className)}
      aria-label="PCE Navigator"
      role="img"
    >
      <Navigation2 size={20} className="fill-accent text-accent" aria-hidden />
    </span>
  )
}
