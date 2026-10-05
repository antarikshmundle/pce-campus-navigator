/** Titled block for discovery lists: heading, optional count/caption/action, content. */
export function DiscoverySection({ title, count, countNoun = 'places', caption, action, headingId, children }) {
  return (
    <section className="pb-4 max-md:pb-3" aria-labelledby={headingId}>
      <header className="flex min-h-11 items-center justify-between gap-2 px-4 pb-1">
        <h2 id={headingId} className="text-title text-fg">
          {title}
        </h2>
        <span className="flex items-center gap-1">
          {count != null && (
            <span className="text-caption text-fg-muted">
              {count} {count === 1 ? countNoun.replace(/s$/, '') : countNoun}
            </span>
          )}
          {action}
        </span>
      </header>
      {caption && <p className="px-4 pb-2 text-caption text-fg-muted">{caption}</p>}
      <div className="px-1">{children}</div>
    </section>
  )
}
