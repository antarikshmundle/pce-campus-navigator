import { forwardRef } from 'react'
import { Mic, Search, X } from 'lucide-react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js'
import { cn } from '../../utils/cn.js'

/**
 * Floating search field with clear + optional voice input.
 *
 * Implements the ARIA combobox pattern when `listboxId` is given: focus
 * stays in the input, ↑/↓ move the highlighted result (`activeOptionId`),
 * Enter submits, Escape is handled explicitly (native type="search" Escape
 * behaviour differs between browsers, so it is always prevented).
 */
export const SearchBar = forwardRef(function SearchBar(
  {
    value,
    onChange,
    onFocus,
    onSubmit,
    onClear,
    onEscape,
    onNavigate,
    listboxId,
    expanded = false,
    activeOptionId,
    placeholder = 'Search buildings, labs, places',
    className,
  },
  ref,
) {
  const voice = useSpeechRecognition({ onResult: (text) => onChange(text) })

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!onNavigate) return
      e.preventDefault() // keep the caret in place
      onNavigate(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Escape') {
      e.preventDefault() // suppress the browser's own clear-on-Escape
      onEscape?.()
    }
  }

  function clear() {
    if (onClear) onClear()
    else onChange('')
    ref?.current?.focus()
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(value)
      }}
      className={cn(
        'flex h-14 items-center gap-1 rounded-card bg-surface pl-4 pr-1.5 shadow-float max-md:h-[50px] max-md:pl-3.5 max-md:pr-1',
        'ring-accent/60 transition-shadow focus-within:ring-2',
        className,
      )}
    >
      <Search size={20} strokeWidth={2.25} className="shrink-0 text-fg-secondary" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        placeholder={voice.listening ? 'Listening…' : placeholder}
        aria-label="Search campus"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        {...(listboxId && {
          role: 'combobox',
          'aria-autocomplete': 'list',
          'aria-controls': listboxId,
          'aria-expanded': expanded,
          'aria-activedescendant': activeOptionId || undefined,
        })}
        // The whole bar shows focus (focus-within ring), so no second outline here.
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-body-lg text-fg outline-none focus-visible:outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
      />

      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="tap-transparent flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-fg-secondary hover:bg-surface-alt"
        >
          <X size={18} aria-hidden />
        </button>
      )}

      {voice.supported && (
        <button
          type="button"
          onClick={voice.listening ? voice.stop : voice.start}
          aria-label={voice.listening ? 'Stop voice search' : 'Search by voice'}
          aria-pressed={voice.listening}
          className={cn(
            'tap-transparent flex h-11 w-11 shrink-0 items-center justify-center rounded-field transition-colors',
            voice.listening ? 'bg-error text-white' : 'text-fg-secondary hover:bg-surface-alt hover:text-fg',
          )}
        >
          <Mic size={20} strokeWidth={2} className={voice.listening ? 'animate-pulse' : undefined} aria-hidden />
        </button>
      )}
    </form>
  )
})
