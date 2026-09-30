import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/**
 * Web Speech API voice input (Chrome / Edge), as a reusable hook.
 */
export function useSpeechRecognition({ lang = 'en-IN', onResult }) {
  const [listening, setListening] = useState(false)
  const recognizerRef = useRef(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => () => recognizerRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!Recognition || listening) return
    const recognizer = new Recognition()
    recognizer.lang = lang
    recognizer.interimResults = false
    recognizer.maxAlternatives = 1
    recognizer.onresult = (event) => onResultRef.current?.(event.results[0][0].transcript)
    recognizer.onerror = () => setListening(false)
    recognizer.onend = () => setListening(false)
    recognizerRef.current = recognizer
    setListening(true)
    recognizer.start()
  }, [lang, listening])

  const stop = useCallback(() => recognizerRef.current?.stop(), [])

  return { supported: Boolean(Recognition), listening, start, stop }
}
