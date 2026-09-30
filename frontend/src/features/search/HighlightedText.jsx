import { matchRanges } from './searchIndex.js'

/** Renders `text` with the parts matching `query` emphasised (no colour change — weight only). */
export function HighlightedText({ text, query }) {
  const ranges = query ? matchRanges(text, query) : []
  if (!ranges.length) return text

  const parts = []
  let cursor = 0
  ranges.forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={start} className="bg-transparent font-semibold text-fg">
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}
