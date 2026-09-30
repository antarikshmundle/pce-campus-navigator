import { cn } from '../utils/cn.js'

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-control bg-surface-alt', className)} aria-hidden />
}
