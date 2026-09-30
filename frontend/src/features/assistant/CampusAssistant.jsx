import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUp, Mic, RotateCcw, Sparkles, X } from 'lucide-react'
import { IconButton } from '../../ui/IconButton.jsx'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js'
import { cn } from '../../utils/cn.js'
import { AssistantMessage } from './AssistantMessage.jsx'
import { SuggestedQueries } from './SuggestedQueries.jsx'
import { DEFAULT_SUGGESTIONS } from './assistantService.js'

export const ASSISTANT_PANEL_ID = 'campus-assistant'

/**
 * px of this element hidden behind the on-screen keyboard (mobile), so the
 * input can sit just above it. Uses the visual viewport; 0 where unsupported.
 */
function useKeyboardInset(ref, active) {
  const [inset, setInset] = useState(0)
  useLayoutEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return undefined
    const update = () => {
      const bottom = ref.current?.offsetParent?.getBoundingClientRect().bottom ?? window.innerHeight
      setInset(Math.max(0, Math.round(bottom - (vv.offsetTop + vv.height))))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [ref, active])
  return inset
}

/**
 * Campus AI panel. Desktop: floating card on the right, map still visible.
 * Mobile: bottom sheet over a light scrim, input kept above the keyboard.
 * Esc closes; focus returns to what opened it.
 */
export function CampusAssistant({ assistant, isDesktop, returnFocusRef }) {
  const { open, setOpen, messages, send, runAction, clear, byId, locating } = assistant
  const [draft, setDraft] = useState('')
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const keyboard = useKeyboardInset(panelRef, open && !isDesktop)
  const speech = useSpeechRecognition({ onResult: (text) => send(text) })
  // Reduced motion: appear in place, no slide or fade.
  const transition = useReducedMotion() ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }

  const close = () => setOpen(false)

  // Focus the input on open; hand focus back on close. preventScroll: the
  // sheet is still sliding in, and the browser would otherwise scroll the
  // (overflow-hidden) map layout to reveal the input, shifting the whole app.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30)
      return () => clearTimeout(t)
    }
    returnFocusRef?.current?.focus?.()
    return undefined
  }, [open])

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, open])

  function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    send(draft)
    setDraft('')
  }

  // Esc closes from anywhere while open (focus may be on the map).
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, setOpen])

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  const panel = (
    <motion.section
      key="assistant"
      ref={panelRef}
      id={ASSISTANT_PANEL_ID}
      role="dialog"
      aria-modal={!isDesktop}
      aria-labelledby="campus-ai-title"
      initial={isDesktop ? { opacity: 0, y: 8 } : { y: '100%' }}
      animate={isDesktop ? { opacity: 1, y: 0 } : { y: 0 }}
      exit={isDesktop ? { opacity: 0, y: 8 } : { y: '100%' }}
      transition={transition}
      style={isDesktop ? undefined : { bottom: keyboard, maxHeight: `calc(100% - ${keyboard}px - 3rem)` }}
      className={cn(
        'pointer-events-auto absolute z-modal flex flex-col bg-surface',
        isDesktop
          ? 'bottom-4 right-4 h-[min(680px,calc(100%-2rem))] w-[420px] rounded-sheet shadow-float'
          : 'inset-x-0 h-[85%] rounded-t-sheet shadow-sheet',
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-navy text-accent">
          <Sparkles size={18} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="campus-ai-title" className="text-title text-fg">
            Campus AI
          </h2>
          <p className="truncate text-caption text-fg-secondary">Answers from the PCE campus directory</p>
        </div>
        {messages.length > 0 && (
          <IconButton icon={RotateCcw} label="Clear conversation" variant="ghost" size="sm" onClick={clear} />
        )}
        <IconButton icon={X} label="Close Campus AI" variant="ghost" size="sm" onClick={close} />
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="text-body text-fg">Ask about any place on campus — where it is, what’s nearby, how far it is, or how to get there.</p>
            <p className="mt-1 text-caption text-fg-secondary">Answers come only from the campus directory.</p>
            <SuggestedQueries suggestions={DEFAULT_SUGGESTIONS} onPick={send} className="mt-4" />
          </div>
        ) : (
          <ol role="log" aria-live="polite" aria-label="Conversation" className="space-y-4">
            {messages.map((m) => (
              <AssistantMessage
                key={m.id}
                message={m}
                byId={byId}
                onAction={runAction}
                onSuggestion={send}
                isLatest={m === lastAssistant}
                locating={locating}
              />
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <label htmlFor="campus-ai-input" className="sr-only">
          Ask Campus AI about a place
        </label>
        <input
          ref={inputRef}
          id="campus-ai-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a campus place…"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={300}
          className="h-11 min-w-0 flex-1 rounded-field bg-surface-alt px-3.5 text-body text-fg outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
        {speech.supported && (
          <IconButton
            icon={Mic}
            label={speech.listening ? 'Listening… tap to stop' : 'Ask by voice'}
            variant="ghost"
            active={speech.listening}
            onClick={speech.listening ? speech.stop : speech.start}
          />
        )}
        <IconButton type="submit" icon={ArrowUp} label="Send" variant="dark" disabled={!draft.trim()} />
      </form>
    </motion.section>
  )

  return (
    <AnimatePresence>
      {open && !isDesktop && (
        <motion.div
          key="scrim"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          onClick={close}
          className="absolute inset-0 z-modal bg-navy/30"
        />
      )}
      {open && panel}
    </AnimatePresence>
  )
}
