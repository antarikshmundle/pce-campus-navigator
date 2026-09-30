/**
 * Campus AI — intent parsing. Pure functions over the query text only; it
 * knows nothing about places (see assistantResolver.js for that).
 *
 * parseIntent(text) → {
 *   intent:  navigation | distance | nearby | place_lookup | info_unavailable | greeting | help
 *   target:  what the user is asking about, filler removed ('' when none)
 *   anchor:  nearby "around <X>" / distance "from <X>" — another place ('' when none)
 *   ref:     'pronoun' ("it", "there") | ordinal index (0 = "the first one") | null
 *   list:    phrased as a list ("all", "which … are", plurals)
 *   asked:   for info_unavailable: what was asked (hours, contact…)
 * }
 */
import { normalize } from '../search/searchIndex.js'

export const INTENT = {
  PLACE_LOOKUP: 'place_lookup',
  CATEGORY_SEARCH: 'category_search',
  NEARBY: 'nearby',
  NAVIGATION: 'navigation',
  DISTANCE: 'distance',
  INFO_UNAVAILABLE: 'info_unavailable',
  GREETING: 'greeting',
  HELP: 'help',
  UNKNOWN: 'unknown',
}

// Order matters: the first family that matches decides the intent.
const NAVIGATION = [
  /\b(take|bring|guide|walk|lead) (me|us) (to|towards|till|there)\b/,
  /\b(go|get) there\b/,
  /\bnavigate( me| us)?( to| towards)?\b/,
  /\b(directions?|route|way|path) (to|for|towards)\b/,
  /\bhow (do|can|should|would) (i|we) (get|go|reach|walk|come) (to)?\b/,
  /\bhow (to|do you) (get|go|reach|walk) (to)?\b/,
  /\b(get|go|walk|head) to\b/,
  /\bshow me the way\b/,
  /\bdirections?\b/,
]
const NEARBY_ME = /\b(near|around|close to|nearby|next to) (me|here|us|my location|my position|where i am)\b|\bnearby\b|\bnearest\b|\bclosest\b|\bnear me\b|\baround here\b/
const NEARBY_PLACE = /\b(?:near|around|close to|next to|beside|nearby|surrounding) (?:the )?(.+)$/
const DISTANCE = [/\bhow far\b/, /\bdistance\b/, /\bhow (long|many minutes|much time)\b/]
const DISTANCE_FROM = /\bfrom (?:the )?(.+)$/
const DISTANCE_BETWEEN = /\bbetween (?:the )?(.+?) and (?:the )?(.+)$/
const UNAVAILABLE = [
  {
    re: /\b(timings?|hours|opening|closing|schedule|what time)\b|\bwhen (does|do|is|will)\b.*\b(open|close)|\bis\b.*\bopen (now|today)\b/,
    asked: 'opening hours',
  },
  { re: /\b(phone|contact|number|email|call)\b/, asked: 'contact details' },
  { re: /\b(fees?|price|cost|menu)\b/, asked: 'fees or prices' },
]
// The question words themselves, removed to leave the place ("when does the library open").
const UNAVAILABLE_WORDS = new Set(
  'timing timings hours hour opening closing schedule open opens close closes closed now today phone contact number email call fee fees price cost menu'.split(' '),
)
const GREETING =/^(hi|hello|hey|hii+|good (morning|afternoon|evening)|namaste|thanks?|thank you|ok|okay|cool)( there| you)?$/
const HELP = /^(help|what can you do|how does this work|who are you|what are you)$/

// Words that carry no place meaning in a question.
const FILLER = new Set(
  (
    'a an the is are was were be am do does did can could would will should shall may might ' +
    'what whats which who where wheres when how why tell me show find locate list give get see look looking ' +
    'for about of on in at to from into by with please pls plz kindly i we you us my our your want need like ' +
    'there here campus college pce priyadarshini s all any some every available located location situated ' +
    'place places spot spots facilities facility facilitie option options area areas service services ' +
    'something anything stuff information info details detail know way route go going reach head walk ' +
    'far distance long many much minutes time take bring guide lead navigate directions direction ' +
    'near nearby around close closest nearest next beside surrounding and or also just exactly again ' +
    'hi hello hey okay ok thanks thank one ones'
  ).split(' '),
)

const PRONOUN = /^(it|there|that|this|them|those|these|that one|this one|that place|this place|same place|same)$/
const ORDINALS = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 }
const LIST_WORDS = /\b(all|list|which|every|any)\b|\bwhat \w+ are\b|\bare there\b/

// "What's", "where’s" → "what is"; then the shared search normalizer.
const clean = (text) => normalize(text.replace(/['’]s\b/gi, ' is'))

/** The meaningful words of `q`, as a phrase. */
export function stripFiller(q) {
  return q
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .join(' ')
}

function reference(q) {
  const rest = q
    .split(' ')
    .filter((w) => !['the', 'one', 'is', 'how', 'far', 'take', 'me', 'to', 'open', 'show', 'navigate', 'go', 'where', 'what', 'about'].includes(w))
    .join(' ')
  if (rest in ORDINALS) return ORDINALS[rest]
  if (rest === 'last') return -1
  return null
}

// A plural word in the target ("canteens", "banks") reads as "show me the list".
const isPlural = (target) => target.split(' ').some((w) => w.length > 3 && w.endsWith('s') && !w.endsWith('ss'))

/** Target phrase, keeping pronouns so the resolver can use context. */
function targetOf(q) {
  const kept = stripFiller(q)
  if (kept) return kept
  const pronoun = q.split(' ').find((w) => PRONOUN.test(w))
  return pronoun ?? ''
}

export function parseIntent(text) {
  const q = clean(text ?? '')
  const base = { intent: INTENT.UNKNOWN, target: '', anchor: '', ref: null, list: false, asked: null, query: q }
  if (!q) return base

  if (GREETING.test(q)) return { ...base, intent: INTENT.GREETING }
  if (HELP.test(q)) return { ...base, intent: INTENT.HELP }

  const listWords = LIST_WORDS.test(q)
  const ordinal = reference(q)
  const withRef = (parsed) => {
    const target = parsed.target
    const ref = ordinal != null ? ordinal : PRONOUN.test(target) || (!target && /\b(it|there|that|this)\b/.test(q)) ? 'pronoun' : null
    return { ...base, list: listWords || isPlural(target), ...parsed, target: ref != null ? '' : target, ref }
  }

  if (NAVIGATION.some((re) => re.test(q))) return withRef({ intent: INTENT.NAVIGATION, target: targetOf(q) })

  if (NEARBY_ME.test(q)) {
    // "nearest canteen", "what is near me" — the rest is an optional category/place filter.
    return { ...base, list: true, intent: INTENT.NEARBY, target: stripFiller(q.replace(NEARBY_ME, ' ')) }
  }

  if (DISTANCE.some((re) => re.test(q))) {
    const between = q.match(DISTANCE_BETWEEN)
    if (between) return withRef({ intent: INTENT.DISTANCE, target: stripFiller(between[1]), anchor: stripFiller(between[2]) })
    const from = q.match(DISTANCE_FROM)
    const fromText = from ? stripFiller(from[1]) : ''
    const fromMe = !from || !fromText || PRONOUN.test(fromText) || /\b(me|here|my location)\b/.test(from[1])
    const main = from ? q.slice(0, from.index) : q
    return withRef({ intent: INTENT.DISTANCE, target: targetOf(main), anchor: fromMe ? '' : fromText })
  }

  const around = q.match(NEARBY_PLACE)
  if (around) {
    const anchor = stripFiller(around[1])
    if (anchor) return { ...base, list: true, intent: INTENT.NEARBY, anchor, target: stripFiller(q.slice(0, around.index)) }
  }

  const unavailable = UNAVAILABLE.find(({ re }) => re.test(q))
  if (unavailable) {
    const target = targetOf(q)
      .split(' ')
      .filter((w) => !UNAVAILABLE_WORDS.has(w))
      .join(' ')
    return withRef({ intent: INTENT.INFO_UNAVAILABLE, target, asked: unavailable.asked })
  }

  return withRef({ intent: INTENT.PLACE_LOOKUP, target: targetOf(q) })
}
