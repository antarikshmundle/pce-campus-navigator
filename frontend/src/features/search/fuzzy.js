/**
 * Minimal typo tolerance for campus search — no dependency.
 *
 * Optimal-string-alignment distance (insert / delete / substitute /
 * adjacent transpose), bounded by `max` so it exits early and stays cheap.
 */
export function editDistance(a, b, max) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prevPrev = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)

  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prevPrev[j - 2] + 1)
      }
      row.push(d)
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return max + 1
    prevPrev = prev
    prev = row
  }
  return prev[b.length]
}

/**
 * Typos allowed for a search term of this length. Short terms get none:
 * one edit turns 3–4 letter words into different real words
 * ("lab" → "lap", "bank" → "back"), which reads as a wrong answer.
 */
export function allowedTypos(length) {
  if (length >= 8) return 2
  if (length >= 5) return 1
  return 0
}

/**
 * Edits needed for `term` to match `word`, comparing against the whole word
 * and against the word's prefix of similar length (the user may still be
 * typing). Returns null when it's not a close match.
 */
export function fuzzyWordMatch(term, word) {
  const max = allowedTypos(term.length)
  if (!max || word.length < 5) return null

  const whole = editDistance(term, word, max)
  const prefix = word.length > term.length ? editDistance(term, word.slice(0, term.length), max) : whole
  const best = Math.min(whole, prefix)
  return best <= max ? best : null
}
