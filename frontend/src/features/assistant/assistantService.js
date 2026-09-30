/**
 * Campus AI — deterministic, grounded answers.
 *
 * ask() is a pure function: (query, campus data, device location, short
 * conversation context) → { response, context }. Every place in a response
 * is a real location record, every distance is computed from stored
 * coordinates, and anything the data doesn't hold is said to be unavailable.
 *
 * Response {
 *   id, role: 'assistant'
 *   intent       place_lookup | category_search | nearby | navigation | distance | info_unavailable | greeting | help | unknown
 *   status       answered | ambiguous | not_found | needs_location | needs_target
 *   message      plain text
 *   details      [string]            extra lines, verbatim from the record (building, floor, notes)
 *   note         string | null       caveat (e.g. straight-line vs walking)
 *   places       [{ id, meters? }]   records shown as result rows
 *   rowAction    'open_place' | 'navigate'   what tapping a row does
 *   actions      [{ type: 'open_place' | 'navigate' | 'locate', placeId? }]
 *   suggestions  [string]            follow-up queries
 *   effect       { type: 'navigate', placeId } | null   performed right away (navigation intent)
 *   resolution   { intent, place_ids, resolved }       for chat_logs
 * }
 *
 * A future LLM provider could rephrase `message`, but places, distances and
 * actions must keep coming from here.
 */
import { api } from '../../lib/api.js'
import { distanceMeters, formatDistance, walkingMinutes } from '../../utils/geo.js'
import { SAME_SPOT_METERS, sortByDistance } from '../discovery/proximity.js'
import { INTENT, parseIntent } from './assistantIntent.js'
import { categoryLabel, didYouMean, matchAll, resolveCategory, resolvePlace } from './assistantResolver.js'

export const DEFAULT_SUGGESTIONS = [
  'Where is the AI & DS department?',
  'Find nearby canteens',
  'Show sports facilities',
  'Where is the library?',
  'Find banks on campus',
]

export const EMPTY_CONTEXT = { focusId: null, listIds: [], candidates: null, pendingIntent: null }

const NEARBY_LIMIT = 5
const STRAIGHT_LINE_NOTE = 'Straight-line distances from stored coordinates — walking routes can be longer.'

let nextId = 1
function reply(intent, fields) {
  const response = {
    id: `a${nextId++}`,
    role: 'assistant',
    intent,
    status: 'answered',
    message: '',
    details: [],
    note: null,
    places: [],
    rowAction: 'open_place',
    actions: [],
    suggestions: [],
    effect: null,
    ...fields,
  }
  const ids = response.places.map((p) => p.id)
  response.resolution = {
    intent,
    place_ids: ids.slice(0, 50),
    resolved: response.status === 'answered' || response.status === 'needs_location',
  }
  return response
}

const quote = (text) => `“${text}”`

// --- Wording, built only from record fields

function detailsOf(location) {
  const lines = []
  const where = [location.building && `Building: ${location.building.trim()}`, location.floor && `Floor: ${location.floor}`]
  if (where.some(Boolean)) lines.push(where.filter(Boolean).join(' · '))
  if (location.description) lines.push(`Campus directory note: “${location.description.trim()}”`)
  return lines
}

const VERIFYING = "Its map position is still being verified, so I can't place it on the map or route to it yet."

function placeActions(data, location) {
  return data.outlierIds.has(location.id)
    ? [{ type: 'open_place', placeId: location.id }]
    : [{ type: 'open_place', placeId: location.id }, { type: 'navigate', placeId: location.id }]
}

function describe(data, location, { intent = INTENT.PLACE_LOOKUP, alsoMatched = [] } = {}) {
  return reply(intent, {
    message: `${location.displayName} is on campus, listed under ${categoryLabel(data, location)}.`,
    details: detailsOf(location),
    note: data.outlierIds.has(location.id) ? VERIFYING : null,
    places: [{ id: location.id }],
    actions: placeActions(data, location),
    suggestions: [
      ...alsoMatched.slice(0, 2).map((l) => `Where is ${l.displayName}?`),
      `How far is it?`,
      `What is near ${location.displayName}?`,
    ].slice(0, 3),
  })
}

const listText = (n, label) => (n === 1 ? `There is 1 place listed under ${label} on campus:` : `There are ${n} places listed under ${label} on campus:`)

function notFound(intent, target, data) {
  const close = target && data ? didYouMean(target, data) : []
  return reply(intent, {
    status: 'not_found',
    message: target
      ? `I couldn't find a campus place matching ${quote(target)}.${close.length ? ' Did you mean one of these?' : ''}`
      : "I couldn't find a campus place matching that.",
    places: close.map((l) => ({ id: l.id })),
    suggestions: close.length ? [] : DEFAULT_SUGGESTIONS.slice(0, 3),
  })
}

// A building stands in for "a place" by its first recorded place with a verified position.
const buildingAnchor = (data, building) => building.locations.find((l) => !data.outlierIds.has(l.id)) ?? building.locations[0]

function whichOne(intent, options, { origin, verb = 'mean' } = {}) {
  const places = (origin ? sortByDistance(options, origin) : options.map((location) => ({ location }))).map(
    ({ location, meters }) => ({ id: location.id, ...(meters != null && { meters }) }),
  )
  return reply(intent, {
    status: 'ambiguous',
    message: `I found ${options.length} places that could match. Which one do you ${verb}?`,
    places,
    note: origin ? STRAIGHT_LINE_NOTE : null,
    rowAction: intent === INTENT.NAVIGATION ? 'navigate' : 'open_place',
  })
}

// --- Target resolution shared by lookup / distance / navigation

/**
 * The single place a query is about, using conversation context for
 * "it" / "the second one" and for replies to "which one?".
 * → { location } | { response } (a clarification / not-found reply) | { category }
 */
function resolveSubject(parsed, data, context, intent, { origin } = {}) {
  const fromIds = (ids) => ids.map((id) => data.byId.get(id)).filter(Boolean)

  if (parsed.ref != null) {
    const pool = fromIds(context.candidates ?? context.listIds)
    if (typeof parsed.ref === 'number') {
      const location = parsed.ref === -1 ? pool.at(-1) : pool[parsed.ref]
      if (location) return { location }
      return { response: reply(intent, { status: 'needs_target', message: "I don't have a list to pick that from. Which place do you mean?", suggestions: DEFAULT_SUGGESTIONS.slice(0, 3) }) }
    }
    const focus = context.focusId != null ? data.byId.get(context.focusId) : null
    if (focus) return { location: focus }
    if (pool.length === 1) return { location: pool[0] }
    if (pool.length > 1) return { response: whichOne(intent, pool, { origin }) }
    return { response: reply(intent, { status: 'needs_target', message: 'Which place do you mean?', suggestions: DEFAULT_SUGGESTIONS.slice(0, 3) }) }
  }

  if (!parsed.target) {
    const ask = intent === INTENT.NAVIGATION ? 'Where would you like to go?' : 'Which place are you looking for?'
    return { response: reply(intent, { status: 'needs_target', message: ask, suggestions: DEFAULT_SUGGESTIONS.slice(0, 3) }) }
  }

  // A reply to "which one do you mean?" is matched against those options first.
  if (context.candidates) {
    const within = resolvePlace(parsed.target, data, { candidates: context.candidates })
    if (within.status === 'found') return { location: within.location, followUp: true }
  }

  const category = resolveCategory(parsed.target, data)
  if (category) {
    if (category.locations.length === 1 && !parsed.list) return { location: category.locations[0] }
    return { category }
  }

  const found = resolvePlace(parsed.target, data)
  switch (found.status) {
    case 'found':
      return { location: found.location, alsoMatched: found.alsoMatched }
    case 'building':
      return { building: found }
    case 'ambiguous':
    case 'mentions':
      return { options: found.options, mentions: found.status === 'mentions' }
    default:
      return { response: notFound(intent, parsed.target, data) }
  }
}

// --- Intent handlers

function lookup(parsed, data, context, env) {
  const subject = resolveSubject(parsed, data, context, INTENT.PLACE_LOOKUP, env)
  if (subject.response) return subject.response
  if (subject.location) return describe(data, subject.location, { alsoMatched: subject.alsoMatched })
  if (subject.category) {
    const { label, locations } = subject.category
    return reply(INTENT.CATEGORY_SEARCH, {
      message: listText(locations.length, label),
      places: locations.map((l) => ({ id: l.id })),
      suggestions: ['Find nearby ' + label.toLowerCase(), 'What is near me?'].slice(0, 2),
    })
  }
  if (subject.building) {
    const { building, locations } = subject.building
    return reply(INTENT.PLACE_LOOKUP, {
      message: `${building} isn't listed as a place of its own, but ${locations.length} ${locations.length === 1 ? 'place is' : 'places are'} recorded in it:`,
      places: locations.map((l) => ({ id: l.id })),
    })
  }
  const { options, mentions } = subject
  if (mentions) {
    return reply(INTENT.PLACE_LOOKUP, {
      message: `No place is named ${quote(parsed.target)}, but ${options.length === 1 ? "this place's" : "these places'"} directory notes mention it:`,
      places: options.map((l) => ({ id: l.id })),
    })
  }
  if (parsed.list) {
    return reply(INTENT.CATEGORY_SEARCH, {
      message: `I found ${options.length} places matching ${quote(parsed.target)}:`,
      places: options.map((l) => ({ id: l.id })),
    })
  }
  return whichOne(INTENT.PLACE_LOOKUP, options)
}

function needsLocation(intent, env, subject) {
  const { location, data } = env
  let message
  if (location.status === 'ready' && !location.onCampus) {
    message = "You don't seem to be on campus right now, so I can't work out distances from where you are."
  } else if (location.status === 'denied') {
    message = 'Location access is blocked, so I can’t see where you are. You can allow it in your browser settings.'
  } else if (!location.supported) {
    message = "This browser can't share its location, so I can't see where you are."
  } else {
    message = intent === INTENT.NEARBY ? 'I need your location to find what’s near you.' : 'I need your location to tell how far that is from you.'
  }
  const canLocate = location.supported && location.status !== 'denied' && !(location.status === 'ready' && !location.onCampus)
  // Without a position, still say what the data knows about the place.
  if (subject) message += ` ${subject.displayName} is on campus, listed under ${categoryLabel(data, subject)}.`
  return reply(intent, {
    status: 'needs_location',
    message,
    details: subject ? detailsOf(subject) : [],
    places: subject ? [{ id: subject.id }] : [],
    actions: [...(canLocate ? [{ type: 'locate' }] : []), ...(subject ? [{ type: 'open_place', placeId: subject.id }] : [])],
    suggestions: intent === INTENT.NEARBY ? ['Show sports facilities', 'Find canteens', 'Where is the library?'] : [],
  })
}

function nearby(parsed, data, context, env) {
  const usable = (list) => list.filter((l) => !data.outlierIds.has(l.id))

  // Optional filter: "nearby canteens", "seminar halls near the library".
  let pool = data.locations
  let filterLabel = null
  if (parsed.target) {
    const category = resolveCategory(parsed.target, data)
    pool = category ? category.locations : matchAll(parsed.target, data)
    filterLabel = category ? category.label.toLowerCase() : parsed.target
    if (!pool.length) return notFound(INTENT.NEARBY, parsed.target, data)
  }

  if (parsed.anchor) {
    const subject = resolveSubject({ ...parsed, target: parsed.anchor, ref: null, list: false }, data, context, INTENT.NEARBY)
    if (subject.response) return subject.response
    if (subject.options || subject.category) return whichOne(INTENT.NEARBY, subject.options ?? subject.category.locations)
    const anchor = subject.location ?? buildingAnchor(data, subject.building)
    const name = subject.location ? anchor.displayName : subject.building.building
    if (data.outlierIds.has(anchor.id)) return reply(INTENT.NEARBY, { status: 'answered', message: `${anchor.displayName}: ${VERIFYING}`, places: [{ id: anchor.id }] })
    const inBuilding = subject.building ? subject.building.locations.map((l) => l.id) : []
    const around = sortByDistance(usable(pool).filter((l) => l.id !== anchor.id && !inBuilding.includes(l.id)), anchor.coords).slice(0, NEARBY_LIMIT)
    return reply(INTENT.NEARBY, {
      message: filterLabel ? `Closest ${filterLabel} to ${name}:` : `Places closest to ${name}:`,
      places: around.map(({ location, meters }) => ({ id: location.id, meters })),
      note: STRAIGHT_LINE_NOTE,
    })
  }

  if (!env.origin) return needsLocation(INTENT.NEARBY, env)
  const closest = sortByDistance(usable(pool), env.origin).slice(0, NEARBY_LIMIT)
  return reply(INTENT.NEARBY, {
    message: filterLabel ? `Closest ${filterLabel} to you:` : 'Here’s what’s closest to you:',
    places: closest.map(({ location, meters }) => ({ id: location.id, meters })),
    note: STRAIGHT_LINE_NOTE,
  })
}

function distance(parsed, data, context, env) {
  const subject = resolveSubject(parsed, data, context, INTENT.DISTANCE, env)
  if (subject.response) return subject.response
  if (subject.options || subject.category) return whichOne(INTENT.DISTANCE, subject.options ?? subject.category.locations, env)
  const place = subject.location ?? buildingAnchor(data, subject.building)
  if (data.outlierIds.has(place.id)) return reply(INTENT.DISTANCE, { message: `${place.displayName}: ${VERIFYING}`, places: [{ id: place.id }], actions: placeActions(data, place) })

  let from = env.origin
  let fromName = 'you'
  if (parsed.anchor) {
    const other = resolveSubject({ ...parsed, target: parsed.anchor, ref: null, list: false }, data, EMPTY_CONTEXT, INTENT.DISTANCE)
    if (other.response) return other.response
    if (!other.location) return whichOne(INTENT.DISTANCE, other.options ?? other.category?.locations ?? other.building.locations)
    if (data.outlierIds.has(other.location.id)) return reply(INTENT.DISTANCE, { message: `${other.location.displayName}: ${VERIFYING}`, places: [{ id: other.location.id }] })
    from = other.location.coords
    fromName = other.location.displayName
  }
  if (!from) return needsLocation(INTENT.DISTANCE, env, place)

  const meters = distanceMeters(from, place.coords)
  const message =
    meters < SAME_SPOT_METERS
      ? `${place.displayName} is right there — within about ${SAME_SPOT_METERS} m of ${fromName === 'you' ? 'you' : fromName}.`
      : `${place.displayName} is about ${formatDistance(meters)} from ${fromName} in a straight line.`
  return reply(INTENT.DISTANCE, {
    message,
    note: `Straight-line distance, not the walking route — on foot that's roughly ${walkingMinutes(meters)} min or more. Open the route for the actual path.`,
    places: [{ id: place.id, meters }],
    actions: placeActions(data, place),
  })
}

function navigation(parsed, data, context, env) {
  const subject = resolveSubject(parsed, data, context, INTENT.NAVIGATION, env)
  if (subject.response) return subject.response

  let options = subject.options ?? subject.category?.locations ?? subject.building?.locations ?? null
  if (options) {
    options = options.filter((l) => !data.outlierIds.has(l.id))
    // "take me to the nearest canteen": with a position, the closest one.
    if (env.origin && /\b(nearest|closest)\b/.test(parsed.query) && options.length) {
      return navigateTo(data, sortByDistance(options, env.origin)[0].location)
    }
    return whichOne(INTENT.NAVIGATION, options, { origin: env.origin, verb: 'want to go to' })
  }
  return navigateTo(data, subject.location)
}

function navigateTo(data, location) {
  if (data.outlierIds.has(location.id)) {
    return reply(INTENT.NAVIGATION, { message: `${location.displayName}: ${VERIFYING}`, places: [{ id: location.id }], actions: [{ type: 'open_place', placeId: location.id }] })
  }
  return reply(INTENT.NAVIGATION, {
    message: `Opening the route to ${location.displayName}.`,
    places: [{ id: location.id }],
    actions: placeActions(data, location),
    effect: { type: 'navigate', placeId: location.id },
  })
}

function unavailableInfo(parsed, data, context, env) {
  if (!parsed.target && parsed.ref == null) {
    return reply(INTENT.INFO_UNAVAILABLE, { message: `I don't have ${parsed.asked} — the campus data doesn't include them.` })
  }
  const subject = resolveSubject(parsed, data, context, INTENT.INFO_UNAVAILABLE, env)
  if (subject.response) return subject.response
  if (!subject.location) return lookup(parsed, data, context, env)
  const location = subject.location
  if (parsed.asked === 'opening hours' && location.hours) {
    return reply(INTENT.PLACE_LOOKUP, { message: `${location.displayName}: ${location.hours}`, places: [{ id: location.id }], actions: placeActions(data, location) })
  }
  return reply(INTENT.INFO_UNAVAILABLE, {
    message: `I don't have ${parsed.asked} for ${location.displayName} — that isn't in the campus data.`,
    details: detailsOf(location),
    places: [{ id: location.id }],
    actions: placeActions(data, location),
  })
}

const HANDLERS = {
  [INTENT.PLACE_LOOKUP]: lookup,
  [INTENT.NEARBY]: nearby,
  [INTENT.DISTANCE]: distance,
  [INTENT.NAVIGATION]: navigation,
  [INTENT.INFO_UNAVAILABLE]: unavailableInfo,
}

/**
 * Answer one query.
 * env: { data (buildAssistantData), origin ({lat,lng} on campus, or null),
 *        location: { status, onCampus, supported } }
 */
export function ask(text, env, context = EMPTY_CONTEXT) {
  const parsed = parseIntent(text)

  if (parsed.intent === INTENT.GREETING || parsed.intent === INTENT.HELP) {
    const response = reply(parsed.intent, {
      message:
        'I’m Campus AI. I can find PCE places, list what’s in a category, show what’s near you, give straight-line distances and open routes — all from the campus directory.',
      suggestions: DEFAULT_SUGGESTIONS,
    })
    return { response, context }
  }
  if (parsed.intent === INTENT.UNKNOWN) return { response: notFound(INTENT.UNKNOWN, ''), context }

  // A short reply to "which one do you want to go to?" keeps that intent.
  let intent = parsed.intent
  if (intent === INTENT.PLACE_LOOKUP && context.pendingIntent && context.candidates) {
    const within = parsed.target ? resolvePlace(parsed.target, env.data, { candidates: context.candidates }) : null
    if (within?.status === 'found' || typeof parsed.ref === 'number') intent = context.pendingIntent
  }

  const response = HANDLERS[intent](parsed, env.data, context, env)
  return { response, context: nextContext(context, response) }
}

function nextContext(context, response) {
  const ids = response.places.map((p) => p.id)
  if (response.status === 'ambiguous') {
    return { ...context, candidates: ids, pendingIntent: response.intent, listIds: ids, focusId: null }
  }
  if (response.status === 'needs_target' || response.status === 'not_found') return context
  if (ids.length === 1) return { focusId: ids[0], listIds: ids, candidates: null, pendingIntent: null }
  if (ids.length > 1) return { focusId: null, listIds: ids, candidates: null, pendingIntent: null }
  return { ...context, candidates: null, pendingIntent: null }
}

/**
 * Records the query and how it was resolved in chat_logs (existing POST
 * /chat). Fire-and-forget: the answer never depends on it. No location or
 * device data is sent.
 */
export function logQuery(text, resolution) {
  return api.chat(text.slice(0, 500), resolution).catch(() => {
    /* logging is best-effort */
  })
}
