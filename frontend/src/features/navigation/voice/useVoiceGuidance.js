import { useCallback, useEffect, useMemo, useState } from 'react'

const MUTED_KEY = 'pce.navVoiceMuted'

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Per-device preference, also read/written by Profile.
export function readMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMuted(muted) {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    /* preference just won't persist */
  }
}

function cancelSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

/**
 * Optional spoken guidance (browser speech synthesis). Silently unavailable
 * where the browser has no speech support. Mute is remembered per device.
 *
 * say(text): speaks now, replacing anything still being spoken — the newest
 * instruction is always the relevant one.
 */
export function useVoiceGuidance() {
  const supported = speechSupported()
  const [muted, setMuted] = useState(readMuted)

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m
      if (next) cancelSpeech()
      writeMuted(next)
      return next
    })
  }, [])

  const say = useCallback(
    (text) => {
      if (!supported || muted || !text) return
      try {
        const synth = window.speechSynthesis
        synth.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'en-IN'
        synth.speak(utterance)
      } catch {
        /* speech failed (e.g. no voices) — guidance stays on screen */
      }
    },
    [supported, muted],
  )

  // Leaving navigation (or hiding the tab) stops any sentence mid-way.
  useEffect(() => {
    const onVisibility = () => document.hidden && cancelSpeech()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelSpeech()
    }
  }, [])

  return useMemo(() => ({ supported, muted, toggleMuted, say }), [supported, muted, toggleMuted, say])
}
