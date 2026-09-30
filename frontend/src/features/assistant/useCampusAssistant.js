import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildAssistantData } from './assistantResolver.js'
import { EMPTY_CONTEXT, ask, logQuery } from './assistantService.js'

let nextUserId = 1

/**
 * One Campus AI session, owned by <MapLayout> so the conversation survives
 * moving between Explore, place detail and route preview. Nothing is
 * persisted: closing the tab ends it.
 *
 * Actions reuse the app's own routes: /place/:id (map focuses the place) and
 * /route?to=:id (the existing route flow, with "My location" as the start
 * when the device is on campus).
 */
export function useCampusAssistant({ locations, dataStatus, reloadData, origin, geo }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const context = useRef(EMPTY_CONTEXT)
  const waitingForLocation = useRef(null) // query to answer again once a position arrives

  const data = useMemo(() => (locations.length ? buildAssistantData(locations) : null), [locations])

  const env = useMemo(
    () => ({
      data,
      origin,
      location: { status: geo.status, onCampus: Boolean(origin), supported: geo.supported !== false },
    }),
    [data, origin, geo.status, geo.supported],
  )
  const latestEnv = useRef(env)
  latestEnv.current = env

  const openPlace = useCallback(
    (id) => {
      setOpen(false)
      navigate(`/place/${id}`)
    },
    [navigate],
  )
  const openRoute = useCallback(
    (id) => {
      setOpen(false)
      navigate(`/route?to=${id}${latestEnv.current.origin ? '&from=me' : ''}`)
    },
    [navigate],
  )

  const answer = useCallback(
    (text, { log = true } = {}) => {
      const current = latestEnv.current
      if (!current.data) {
        const failed = dataStatus === 'error'
        setMessages((m) => [
          ...m,
          {
            id: `s${nextUserId++}`,
            role: 'assistant',
            status: 'unavailable',
            message: failed
              ? "I can't reach the campus directory right now, so I can't answer place questions. Try again in a moment."
              : 'The campus directory is still loading — ask again in a moment.',
            details: [],
            places: [],
            actions: failed ? [{ type: 'retry_data' }] : [],
            suggestions: [],
          },
        ])
        return
      }
      const { response, context: next } = ask(text, current, context.current)
      context.current = next
      setMessages((m) => [...m, response])
      if (log) logQuery(text, response.resolution)
      waitingForLocation.current = response.status === 'needs_location' && response.actions.some((a) => a.type === 'locate') ? text : null
      if (response.effect?.type === 'navigate') openRoute(response.effect.placeId)
    },
    [dataStatus, openRoute],
  )

  const send = useCallback(
    (raw) => {
      const text = raw.trim()
      if (!text) return
      setMessages((m) => [...m, { id: `u${nextUserId++}`, role: 'user', text }])
      answer(text)
    },
    [answer],
  )

  // "Use my location" → answer the waiting question as soon as a position arrives.
  useEffect(() => {
    const pending = waitingForLocation.current
    if (!pending) return
    if (origin) {
      waitingForLocation.current = null
      answer(pending, { log: false })
    } else if (['denied', 'unavailable'].includes(geo.status) || (geo.status === 'ready' && !origin)) {
      waitingForLocation.current = null
      answer(pending, { log: false }) // explains why it still can't
    }
  }, [origin, geo.status, answer])

  const runAction = useCallback(
    (action) => {
      if (action.type === 'open_place') openPlace(action.placeId)
      else if (action.type === 'navigate') openRoute(action.placeId)
      else if (action.type === 'locate') geo.locate()
      else if (action.type === 'retry_data') reloadData()
    },
    [openPlace, openRoute, geo, reloadData],
  )

  const clear = useCallback(() => {
    setMessages([])
    context.current = EMPTY_CONTEXT
    waitingForLocation.current = null
  }, [])

  return useMemo(
    () => ({
      open,
      setOpen,
      messages,
      send,
      runAction,
      clear,
      byId: data?.byId ?? null,
      locating: geo.status === 'locating',
    }),
    [open, messages, send, runAction, clear, data, geo.status],
  )
}
