# Algorithms and Logic

Each section explains what the code actually does, where it lives, and how
to explain it in a viva. No accuracy percentages are claimed: none were
measured.

---

## 1. Campus search ranking (Stage 5)

**File:** `frontend/src/features/search/searchIndex.js` (+ `fuzzy.js`)

### Step 1: normalise text
`normalize()` lower-cases, removes accents (NFKD), turns `&` into " and ",
replaces every non-alphanumeric run with a space, and trims.
`"AI&DS Dept."` → `"ai and ds dept"`.

### Step 2: build the index once per data load
For each place (display name = official name without the "PRIYADARSHINI"
prefix):
- `name`: normalised display name
- `nameWords`: its words **plus singular stems** (`labs` → `lab`, but not
  `class` or `gas`)
- `fieldWords`: words of category, category label, building and floor
- `descWords`: words of the description

### Step 3: score every place against the query
The query is normalised and split into unique singularised terms. The
**first rule that matches decides the score** (tiers never overlap):

| Tier | Score | Rule |
|---|---|---|
| EXACT | 1000 | normalised name equals the query |
| PREFIX | 900 | name starts with the query |
| WORD_PREFIX | 800 | every term is the start of some name word (any order) |
| CONTAINS | 700 | query appears inside the name |
| ALL_TERMS | 500 | every term starts a name word **or** a field word, and at least one is in the name |
| FUZZY | 300 − 40 × typos (min 151) | every term matches exactly somewhere, or is a close spelling of a name word, and at least one fuzzy name hit |
| FIELD | 150 | every term matches only category/building/floor words |
| DESCRIPTION | 50 | every term starts some word, and the description is involved |
| – | no match | otherwise |

### Step 4: typo tolerance (`fuzzy.js`)
Optimal-string-alignment edit distance (insert, delete, substitute, swap two
adjacent letters), stopped early once it exceeds the allowed limit.
Allowed typos by term length: **≤ 4 letters: 0**, **5–7: 1**, **≥ 8: 2**.
Words shorter than 5 letters are never fuzzy-matched (so "lab" never
becomes "lap"). A term is compared with the whole word and with the word's
prefix of the same length (the user may still be typing).
`"libary"` (6 letters, 1 edit from "librar…") → matches "Library".

### Step 5: filter noise
If any result scored CONTAINS or better, fuzzy and description-only
results are dropped, so a real name match is not buried under guesses.

### Step 6: sort
1. Score (higher first)
2. Fewer words in the name (more specific: "Library" before "Library Parking")
3. Closer to the user, only if a position is known
4. Alphabetical

**Viva line:** "Search is a tiered scoring system. Exact and prefix name
matches always beat partial or typo matches, typos are allowed only for
longer words, and ties go to the shorter, closer name."

---

## 2. Geographic distance (Haversine)

**Files:** `frontend/src/utils/geo.js` (`distanceMeters`),
`backend/app/services/directions.py`, `backend/app/services/data_health.py`

```
a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
d = 2R · asin(√a)        R = 6,371,000 m
```
φ = latitude and λ = longitude, both in radians. This gives the
great-circle ("as the crow flies") distance on a sphere. At campus scale the
error from treating Earth as a sphere is negligible compared with GPS error.

**Walking time:** `minutes = max(1, ceil(meters / (1.3 m/s × 60)))`. The
same 1.3 m/s constant is used in frontend and backend, so both give the
same estimate. The UI always labels it as straight-line / direct.

---

## 3. Nearby sorting

**Files:** `features/discovery/proximity.js`, `features/nearby/nearbyService.js`

1. **Reference point:** the user's position if they tapped "Use my
   location" and are within 40 km of PCE; otherwise the **campus median**,
   the median latitude and median longitude of campus places excluding
   outliers. The median resists a single bad coordinate, unlike the mean.
2. **De-duplicate:** drop any OSM place within 40 m of a campus place (the
   campus record wins).
3. **Measure and sort:** Haversine distance to every place; sort ascending
   (campus lists break ties alphabetically).
4. **Limit:** Around PCE shows the nearest 20; Explore Nagpur shows all 34.

Campus AI "near X" uses the same function with X's coordinates as the
reference and returns the 5 closest, excluding outliers, X itself and (for a
building) places inside that building.

---

## 4. Category filtering

**Campus (home map / search):** `useDiscoveryState` filters by the exact raw
category label (`l.category === category`). Map markers outside the filter
are dimmed. Search results are ranked first, then filtered.

**Campus AI categories:** `categoryKey()` normalises labels (`"Sports "`,
`"Sport"` → `sport`) so variant spellings form one group; a synonym table
maps everyday words to categories that exist (`canteen`, `cafe`, `eat` →
food; `temple` → spiritual place; `gate` → entry/entrance/exit). A word maps
to a category only if that category has places, so nothing is invented.

**Nearby (OSM):** each OSM element is classified by tags into a category id
(`amenity=cafe` → `cafe`, `highway=bus_stop` → `bus`, …; first match wins,
unclassifiable elements are dropped). Chips group category ids
(`food` = restaurant + fastfood + cafe). A chip is shown only if at least
one place has one of its categories.

---

## 5. Campus AI intent resolution

**Files:** `features/assistant/assistantIntent.js`, `assistantResolver.js`,
`assistantService.js`

### 5.1 Parse (`parseIntent`)
Clean the text (`what's` → `what is`, then `normalize`). Test pattern
families **in order**; the first match decides:

1. **Greeting / help:** whole-message patterns ("hi", "what can you do").
2. **Navigation:** "take me to", "directions to", "how do I get to", "navigate", …
3. **Nearby (me):** "near me", "nearest", "closest", "around here".
4. **Distance:** "how far", "distance", "how long"; also extracts
   "between A and B" or "from X".
5. **Nearby (place):** "near / around / next to <X>".
6. **Unavailable info:** timings/hours, phone/contact, fees/price/menu.
7. Otherwise **place lookup**.

The **target** is what remains after removing ~150 filler words ("where",
"is", "the", "campus", "please", …). Plural targets or words like
"all / list / which" mark the question as a **list** request.

### 5.2 Resolve (`resolveSubject`, `resolvePlace`, `resolveCategory`)
1. Pronoun or ordinal? Use conversation context (§6).
2. Answering a previous "which one?"? Match only among those candidates.
3. Is the whole target category words? → category result.
4. Else run the **Stage 5 search index**:
   - one top-scoring place → **found**;
   - several tied → prefer the one whose **last name word** is the term
     ("library" → Central Library, not Library Parking); then the one with
     the fewest words ("auditorium" → Auditorium, mention "New Auditorium");
   - still tied → **ambiguous** ("Which one do you mean?");
   - target names a recorded **building** → list places in it;
   - only descriptions mention it → "directory notes mention it";
   - nothing → **not found** plus "did you mean" places matching at least
     half of the words.

### 5.3 Answer
Templates are filled only from record fields. Distances come from §2. The
answer notes when a distance is straight-line and when a place's map
position is still being verified (outliers). Opening hours, phone numbers
and fees are **not in the data**, and the assistant says so rather than
guessing.

**Viva line:** "It is a rule-based natural-language interface: regular
expressions detect intent, a filler-word filter extracts the target, and
our own ranked search finds the record. Every answer is grounded in the
database. It cannot hallucinate a place because it can only return records
it found."

---

## 6. Contextual follow-up resolution

**File:** `assistantService.js` (`nextContext`, `resolveSubject`)

The assistant keeps a small context object:
`{ focusId, listIds, candidates, pendingIntent }`.

| After the answer… | Context becomes |
|---|---|
| one place shown | `focusId = that id`, `listIds = [id]` |
| a list shown | `listIds = ids`, `focusId = null` |
| "Which one?" asked | `candidates = ids`, `pendingIntent = intent` |
| not found / needs target | unchanged |

Follow-ups:
- **"it", "there", "that place"** → `focusId`, or the single item of the
  last list, or "which one?" if the list has several.
- **"the second one", "3rd", "last"** → `listIds[index]` (or candidates).
- **A short reply to "which one?"** ("the CSE one") is matched only among
  `candidates`, and keeps the **pending intent** (a reply to "which one do
  you want to go to?" still navigates).

Verified in Stage 13: "Show sports facilities" → list; "the second one" →
the second listed place; "take me there" → `/route?to=<that id>`.

---

## 7. Route progress (implemented; inactive while the Routes API is off)

**File:** `features/navigation/progress/routeProgress.js`

1. **Project** the route to a flat local plane in metres (equirectangular
   around the route's first point). At campus scale the error is far below
   GPS error.
2. **Prepare:** cumulative distance along the polyline; the offset where
   each Google step starts.
3. **Match a GPS fix:** for every segment, project the point onto it
   (clamped dot product), measure the perpendicular distance, and take the
   closest. With a previous offset, prefer segments from 30 m behind to
   250 m ahead of it (continuity weight 0.05), so a path that doubles back
   does not make progress jump.
4. **Outputs:** distance from route, current step, distance to next
   maneuver, travelled / remaining metres (scaled to Google's distance),
   remaining time.
5. **Session rules** (`navConfig.js`): off-route if > 50 m (+ up to 25 m for
   GPS accuracy) for 5 s; arrival within 25 m; fixes worse than 60 m are
   ignored for decisions; reroute at most every 30 s, after 25 m of
   movement, max 8 per trip.

---

## 8. Data health validation

**Backend:** `app/services/data_health.py`; **snapshot:** `frontend/src/admin/osmHealth.js`

Campus checks (each labelled *warning*, *needs_review* or *info*, and the
worst one wins):
- **Count** = 69; **id set** = 16–84 exactly; **duplicate ids**
- **Missing** name/category (warning), description/building/floor (info)
- **Leading/trailing whitespace** in names (needs review)
- **Category variants:** labels grouped case-/space-insensitively and by
  similarity (singular/plural, one label extends the other, shared stem ≥ 4
  letters) using union-find; *suggested only, never merged*
- **Invalid coordinates:** non-numeric, NaN, out of ±90/±180, or (0,0)
- **Suspicious coordinates:** > 3 km from the median position (e.g. the
  original id 32, whose longitude equalled its latitude)
- **Shared coordinates:** informational (rooms in one building)
- **Canonical integrity:** field-by-field exact comparison of every DB row
  with `locations.json`: matching, mismatched (with field names), missing,
  extra, duplicate ids → *synchronized* true/false

OSM snapshot checks: metadata present, layers present, key format
`osm-[nwr]<digits>`, names, coordinates, duplicates, unsupported category,
category in the wrong layer, outside the query radius, outside Nagpur bounds,
shared positions, overlap with a campus place.

Nothing is auto-corrected; the admin decides. This is why id 32 was never
"fixed" automatically: a program cannot know the true position, and a
wrong automatic fix would look trustworthy.

---

## 9. Saved-place storage and migration

**File:** `features/saved/savedPlaces.js`

- **Format v2:** `{ version: 2, items: [...] }`, most recent first.
  Campus: `{ source: "campus", id, savedAt }`. External:
  `{ source: "external" | "nagpur", id: "osm-n123", savedAt, place: { name, category, lat, lng, address } }`.
- **Why store a record for external places?** OSM places are not in our
  database, and the live result may not be loaded next time, so the minimum
  public facts travel with the saved item. Campus places store only the id,
  so details always come from the live database.
- **Migration on read:** bare arrays `[33, 54]`, Stage 9 v1
  `{ version: 1, items: [{ id, savedAt }] }` and `{ version: 1, ids: [...] }`
  are read as campus places; the next write saves v2.
- **Validation:** ids must be positive safe integers (numeric strings
  accepted); external keys must match `^[a-z]+-[a-z0-9]{1,40}$`;
  coordinates must be inside the Nagpur bounds; strings are length-capped;
  unknown sources are dropped; duplicates are removed.
- **Robustness:** every `localStorage` call is wrapped in `try/catch`; bad
  JSON → empty list; blocked storage → in-memory only for this visit.
- **Limits:** 200 saved, 8 recently viewed.

Verified in Stage 13: v1 data with two campus ids migrated to two saved
rows; corrupted JSON and hostile entries rendered as an empty/clean list.
