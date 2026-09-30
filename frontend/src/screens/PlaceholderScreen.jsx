import { EmptyState } from '../ui/EmptyState.jsx'

/** Standard non-map page frame, used by screens not yet built out. */
export function PageFrame({ title, children }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] lg:pt-10">
        <h1 className="text-heading-lg text-fg">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export function PlaceholderScreen({ title, icon, message, description }) {
  return (
    <PageFrame title={title}>
      <div className="rounded-sheet bg-surface shadow-card">
        <EmptyState icon={icon} title={message} description={description} />
      </div>
    </PageFrame>
  )
}
