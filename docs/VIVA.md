# Viva Preparation — PCE Campus Navigator

Answers are written in the first person, the way you would explain your own
project. Every answer matches the actual implementation. Where something
is not done, the answer says so.

---

# Part N — Question bank (64 questions)

## A. Project basics

**1. What is your project in one sentence?**
A web app that shows every PCE campus place on a real map, lets you search
or ask questions about them, shows useful places around the college and in
Nagpur, and gives admins tools to keep the data correct.

**2. Who are the users?**
Students (especially first-years), parents and visitors on the student
side, and college staff on the admin side.

**3. What problem does it solve?**
People don't know where departments, seminar halls or facilities are, and
Google Maps doesn't list internal campus places. Our app has the college's
own list of 69 places with building and floor details, and it understands
everyday names like "library" or "canteen".

**4. How many campus places are there and where does the data come from?**
69 places, ids 16 to 84. They are stored in PostgreSQL, and a canonical copy
is kept in `locations.json` so a fresh database can be seeded identically.

**5. What was the existing system?**
An older desktop kiosk app (pywebview) with the locations hard-coded in the
source, exact-substring voice matching and a wrong distance formula. We
rebuilt it as a full-stack web app.

**6. What are the main modules?**
Map, Search, Place details, Route preview, Campus AI, Nearby, Saved/Recent,
Profile, and the Admin area (locations, categories, data health,
analytics, local-discovery data, system status).

**7. Does it need login for students?**
No. Students use it without an account. Saved places are kept in the
browser. Only admins log in.

## B. Architecture

**8. Explain your architecture.**
Three tiers: a React single-page app in the browser, a FastAPI REST
backend, and a PostgreSQL database. The browser also talks directly to two
external services: Google Maps for the map and OpenStreetMap's Overpass API
for live nearby places.

**9. Why is some logic in the frontend and not the backend?**
Search and Campus AI work on only 69 records, which the app already loads
once. Doing them in the browser makes answers instant, and they keep
working even if the backend is slow. The backend stays the source of truth
for data, auth and analytics.

**10. Does the backend call Google or OpenStreetMap?**
No. Only the browser does. The backend only talks to PostgreSQL (and reads
`locations.json` for audits).

**11. How do frontend and backend communicate?**
JSON over HTTP at `/api/v1/...`. In development Vite proxies `/api` to port
8000, so both appear on one origin.

**12. What is the "persistent map"?**
The map screens (Explore, Place, Route, Nearby) are nested under one layout
component, so moving between them doesn't reload the map. Each screen just
tells the layout what to show.

**13. Where is state kept?**
In React context (campus data, saved places, map type), in the URL (selected
place, route endpoints, filters) and in localStorage (saved/recent places,
preferences). No Redux.

## C. React

**14. Why React?**
The UI has many parts that change together (search results, map markers,
bottom sheet, assistant). React's components and state make that
manageable, and it has a big ecosystem.

**15. What hooks did you use?**
`useState`, `useEffect`, `useMemo`, `useCallback`, `useContext`,
`useDeferredValue` (keeps typing smooth during search), and
`useSyncExternalStore` (shares the one-shot Nearby location).

**16. What is lazy loading in your app?**
Admin, Nearby and the Google map engine are loaded with `React.lazy` /
dynamic `import()`, so students never download admin code, and Nearby
data loads only when opened.

**17. How is routing done?**
React Router 6. Every screen has a URL, like `/place/33` or
`/route?from=63&to=33`, so links can be shared and the back button works.

**18. What is Tailwind and why use it?**
A utility CSS framework. Our design tokens (colours, spacing) feed the
Tailwind config, so every screen is consistent, and responsive classes make
mobile and desktop layouts easy.

## D. FastAPI

**19. Why FastAPI?**
It validates requests automatically with Pydantic, has dependency injection
(we use it for the DB session and admin auth) and generates interactive API
docs at `/docs`.

**20. What are routers, services, models and schemas?**
Routers define endpoints; services hold logic (chatbot matching, directions
estimate, data-health checks); models are SQLAlchemy table classes; schemas
are Pydantic classes that validate input and shape output.

**21. What happens if someone sends invalid data?**
Pydantic rejects it with HTTP 422 before our code runs. For example, a
batch of 21 events, an unknown event type, or a malformed OSM key.

**22. How is the admin check implemented?**
A dependency `get_current_admin` reads the bearer token, verifies it, loads
the admin user and checks it's active. Every admin route depends on it, and
the whole insights router has it at router level.

## E. PostgreSQL

**23. Which tables are there?**
`locations`, `admin_users`, `chat_logs` and `usage_events`.

**24. Why is there no foreign key from usage_events to locations?**
So deleting a location never deletes its history. Instead, the events
endpoint checks that the place id exists before inserting.

**25. How did you create the tables?**
SQLAlchemy `create_all` in the seed script (and on startup for
`usage_events`). We haven't set up Alembic migrations yet; that's future work.

**26. What is locations.json?**
The canonical snapshot of the locations table. The seed loads it only into an
empty table; `export_locations` rewrites it from the database with a
round-trip check; the Data Health page compares the two field by field.

## F. Google Maps

**27. How is Google Maps integrated?**
With the Maps JavaScript API, loaded once through Google's loader. We use a
Map ID with a custom style that hides business POIs, Advanced Markers with
category icons, clustering with supercluster, and a Map/Satellite toggle
(satellite = hybrid imagery with labels).

**28. What happens with too many markers?**
They're clustered. supercluster groups nearby markers into one bubble at
low zoom.

**29. What if the Google key is missing or wrong?**
Google calls `gm_authFailure` or the script fails to load, and we switch to a
built-in schematic campus map with a notice. We tested this by blocking
Google's servers.

**30. What is an "outlier" place?**
A place more than 3 km from the median campus position, which is probably a
data-entry error. It keeps its marker but doesn't affect map framing or
routing, and its page says its position is being verified.

## G. OpenStreetMap

**31. What is OpenStreetMap?**
A free, community-built world map with an open licence (ODbL). We use its
Overpass API to query places by tags, like `amenity=cafe`.

**32. What does Nearby show?**
Three tabs: Around PCE (71 OSM places within about 5 km), On campus (the 69
campus places), and Explore Nagpur (34 OSM attractions), with category chips.

**33. Live or stored data?**
Both. A snapshot fetched on 2026-09-24 is bundled with the app. If the user
shares their location near PCE, we also query Overpass live. On any failure
we show the snapshot.

**34. How do you avoid showing a campus place twice?**
Any OSM place within 40 m of a campus place is dropped, and the campus
record is shown instead.

## H. Campus AI

**35. How does Campus AI work?**
First it detects the intent (lookup, list, nearby, distance, navigation, or
information we don't have) using regular expressions. Then it removes
filler words to get the target, finds the place with our own search ranking,
and fills an answer template using only the database record.

**36. Give example questions it can answer.**
"Where is the library?", "Show sports facilities", "Nearest canteen",
"How far is it?", "What is near the admin block?", "Take me to the AI & DS
department", "What are the library timings?" (it honestly says it doesn't
have hours).

**37. How does it understand "it" or "the second one"?**
It keeps a small context: the last place shown, the last list, and any
"which one?" options. "It" means the last place; "the second one" means
item 2 of the last list.

**38. Is every AI query saved?**
Yes. The query and how it was resolved are posted to `/chat` and stored in
`chat_logs`, which feeds the admin AI analytics. No location or device
data is sent.

**39. Can it give a wrong place?**
It can only return places that exist in the database, and when several
match equally it asks which one. So it can misunderstand a question, but it
can't invent a place.

## I. Search algorithm

**40. How is search ranked?**
Scores in tiers: exact name 1000, name starts with the query 900, every word
starts a name word 800, name contains the query 700, all words found in name
or fields 500, typo match about 300, category/building-only match 150,
description-only 50. Ties go to shorter names, then closer places, then
alphabetical order.

**41. How does typo tolerance work?**
An edit distance that counts inserted, deleted, replaced or swapped letters.
Words of 5–7 letters may have 1 typo and 8+ letters 2 typos; short words
none, because "lab" to "lap" would be a wrong answer.

**42. Why not a library like Fuse.js?**
With 69 records, a small custom scorer lets us control exactly which match
beats which. It also has no extra dependency, and the Campus AI reuses it.

## J. Authentication and security

**43. How does admin login work?**
The password is checked against a bcrypt hash. If it's correct, the server
returns a JWT signed with a secret key and valid for 8 hours. The browser
sends it as a bearer token on admin requests.

**44. What is a JWT?**
A signed token with three parts: header, payload (who the user is and when
the token expires) and signature. The server can trust it without a session
table because only the server knows the signing key.

**45. What did you test for security?**
No token, garbage token, expired token, unsigned token, tokens signed with
old placeholder keys, and a valid signature for a non-existent user all get
401. Writes without a token get 401. A foreign origin gets no CORS
permission.

**46. Is the project fully secure?**
It's secure for a campus project, but not fully hardened for public
deployment. Our Stage 13 audit found two real problems: the admin password
was still the seeded default, and the Google browser key wasn't
referrer-restricted. We fixed both and re-tested: the old password now gets
401, and the key is blocked from other websites. What's left is hardening:
the DB uses the superuser role, and there's no login rate limit.

**47. Why bcrypt?**
It's deliberately slow and salted, so even if the database leaked, passwords
would be hard to crack.

## K. LocalStorage

**48. What is stored in localStorage?**
Saved places, recently viewed places, recent search picks (ids only), map
type, voice preference, and for admins the token.

**49. What if the stored data is corrupted?**
Every read is in try/catch and validated. Bad JSON or strange entries are
ignored, and the app shows an empty list instead of crashing. We tested this.

**50. What was the Stage 9 → Stage 10 migration?**
Stage 9 stored only campus ids (version 1). Stage 10 added off-campus places,
so version 2 stores `source` and, for OSM places, a small public record. Old
data is converted when read.

## L. REST APIs

**51. What is REST?**
A style where URLs name resources and HTTP methods say what to do: GET
reads, POST creates, PATCH updates, DELETE removes. Status codes report the
result (200, 201, 204, 401, 404, 422).

**52. List your main endpoints.**
`GET /locations`, `GET /locations/{id}`, admin `POST/PATCH/DELETE
/locations`, `POST /auth/login`, `POST /chat`, `POST /events`, and the admin
`GET /admin/insights/summary|data-health|ai|usage|system`.

**53. Why is /events public?**
Students aren't logged in, but we still want anonymous search analytics.
It's kept narrow: only whitelisted event types, at most 20 per batch, a
per-client rate limit, and search text cleaned (emails removed, long
numbers masked).

## M. Admin analytics

**54. What does the admin dashboard show?**
Real counts: locations, categories, buildings, AI queries (resolved and
unresolved), usage events, snapshot status, data-health status and
canonical sync.

**55. What is Data Health?**
Read-only checks on the locations: count = 69, ids 16–84, duplicates, missing
fields, extra spaces, category spelling variants, invalid or suspicious
coordinates, shared coordinates, and a comparison with `locations.json`.
It reports problems but never fixes them automatically.

**56. What do search analytics show?**
Most searched terms, searches with no results (which tells us what's missing),
places opened from search, most opened and most navigated places, and
nearby searches.

**57. Is any personal data collected?**
No. There's no user id, IP address, device information or position. Admin
pages send no events, and Do Not Track is honoured.

## N. Testing

**58. How did you test the project?**
In the running app: a Python script tested 42 API and security cases, and a
Playwright script drove Chrome through all 24 flows, the error cases and six
screen sizes. There's no unit-test suite in the repo; that's a limitation.

**59. Did testing find any bugs?**
Yes. At tablet width the admin locations page scrolled sideways because a
hidden table header escaped its scroll box. I fixed it and re-tested. Testing
also found that three location rows had been edited after Stage 11.

**60. How did you test failures?**
By blocking the backend, blocking Google, making OpenStreetMap return
"rate limited", denying location, corrupting localStorage, and using
expired or forged admin tokens. Each case showed a friendly message, never
a stack trace.

## O. Limitations

**61. What are the main limitations?**
No in-app turn-by-turn navigation (Routes API not enabled), straight-line
distances, saved places only on one device, a rule-based assistant, OSM
coverage and rate limits, and remaining hardening work (least-privilege DB
role, login rate limiting).

**62. What's missing from the data?**
Opening hours, contact numbers, photos and events. The assistant says so
instead of guessing.

## P. Future scope

**63. What would you add next?**
Enable the Routes API or a campus footpath graph for in-app walking
directions; indoor floor guidance; an admin password change and roles;
migrations, tests and deployment; optional account sync.

**64. Could you add a real LLM?**
Yes, but only to rephrase answers. Places, distances and actions would
still come from the deterministic core, so it could never invent a place.

---

# Part O — Difficult / challenge questions (22)

**1. Why React instead of plain HTML/CSS/JS?**
Our UI has a shared map, a draggable sheet, live search results, an
assistant and saved-state icons that must all stay in sync. In plain JS I'd
write the DOM updates by hand for each change. React lets me describe the
UI for a given state and updates the DOM for me. It also gives us routing
and lazy loading. The trade-off is a larger bundle (164 kB gzip main chunk).

**2. Why FastAPI and not Django or Flask?**
We only need a JSON API, not server-rendered pages or Django's admin.
FastAPI gives request validation and API docs automatically, which Flask
doesn't, with far less setup than Django.

**3. Why PostgreSQL?**
Relational data with fixed fields, reliable transactions, and strong SQL for
analytics: time-zone day grouping, `FILTER` counts and regex normalisation.
It's free and open source.

**4. Why not Firebase?**
We wanted the college to own the data and schema, use standard SQL for
analytics, and avoid vendor lock-in and usage billing for the database. We
also don't need real-time sync or user accounts, which are Firebase's main
strengths.

**5. Why Google Maps for the base map but OpenStreetMap for Nearby?**
Google gives the best imagery and roads around the campus, and a style that
hides commercial POIs. For listing shops, hospitals or bus stops, Google
Places needs extra billing, while OSM data is free and open. So we use each
where it's strongest.

**6. Why call it "AI" if it's rule-based?**
It's AI in the classic sense: a rule-based natural-language interface, like
early expert systems or ELIZA. It interprets intent, keeps conversational
context and gives grounded answers. We clearly say it's deterministic and
not an LLM. That was a deliberate choice: it's predictable, free, works
without internet access to an AI service, and can never invent a place.

**7. How does fuzzy search work, exactly?**
We compute the edit distance between the typed word and each name word,
counting inserts, deletes, replacements and swaps of neighbouring letters,
and stop early once it's too big. We allow 1 typo for 5–7 letter words and 2
for 8+. A typo match scores 300 minus 40 per typo, always below real name
matches.

**8. How do you calculate distance? Why not Pythagoras on lat/lng?**
With the Haversine formula, which gives the great-circle distance on a
sphere of radius 6371 km. A degree of longitude is shorter than a degree of
latitude at Nagpur's latitude, so plain Pythagoras on degrees is wrong. The
old kiosk did exactly that.

**9. Why are external places separated from campus locations?**
Campus locations are official, admin-maintained and canonical (69 fixed ids).
OSM places are third-party, change over time and have a different licence.
Mixing them would corrupt the canonical dataset and the data-health checks.
So OSM places have their own key format (`osm-n123`) and are never written
to the `locations` table. We verified that in Stage 13.

**10. Why wasn't ID 32 automatically corrected?**
Its longitude equalled its latitude, clearly a data-entry error, but a
program can't know the true position. An automatic "fix" would look
correct while possibly being wrong. So the system flags it, keeps it off
routing and framing, and leaves the correction to a human who checks the
satellite view. (That's what happened: it was corrected by hand through the admin
page. Data Health then flagged that the database no longer matched the
canonical file. We reviewed the new position against the other places in
the same building and exported it as canonical.)

**11. Why doesn't navigation happen inside the app?**
The in-app navigation code exists: GPS progress, off-route detection,
rerouting and voice. But it needs Google walking routes from the Routes API,
which isn't enabled for our project (it needs billing setup). So the app
shows a clearly labelled direct-line estimate and opens Google Maps for the
real walk. We don't pretend the straight line is a path.

**12. What happens if the Google Maps API fails?**
If the script can't load, the key is rejected, or tiles don't load in time,
the app switches to a schematic campus map with a notice. Search, AI,
details, Nearby lists and saved places keep working. We tested it by
blocking Google.

**13. What happens if OSM fails?**
The live query has a 12-second timeout. On any error, including a 429 rate
limit, the bundled snapshot is shown. The failure isn't cached, so a later
retry can succeed. Tested by returning 429.

**14. How is admin authentication protected?**
bcrypt-hashed passwords; JWTs signed with a 64-character secret that expire
after 8 hours; server checks on every admin request (signature, expiry,
user exists and is active). The client-side guard is only for convenience;
the server is the real gate. The seeded default password was changed and
verified in Stage 13. What's still missing is login rate limiting.

**15. Why is the Google Maps key visible in the browser?**
Every browser map needs the key in the page. Google designed browser keys to
be public and protected by restrictions: allowed website origins and allowed
APIs. Our Stage 13 audit found that the key had no referrer restriction.
We added one and re-tested: it loads on our localhost addresses and is
rejected from other websites with `RefererNotAllowedMapError`. So a copied
key is useless on someone else's site.

**16. What prevents users from calling admin APIs directly?**
The server, not the UI. Each admin endpoint requires a valid, unexpired
token signed with our secret for an active admin; otherwise it returns 401.
We tested no token, forged, expired, old-key and unknown-user tokens.

**17. How is saved data persisted, and what are the risks?**
In the browser's localStorage as versioned JSON. It survives reloads and
restarts but lives on that browser only, and it's cleared with site data.
There's no server copy, which is also a privacy advantage: we store nothing
about the user.

**18. Why is user location not continuously tracked?**
Privacy and battery. Location is requested only when the user taps
"Show my location" or "Use my location". The map's watch pauses when the tab
is hidden, Nearby takes one reading, and positions are never sent to our
server or stored. Continuous tracking would only be needed for live
navigation.

**19. How do you know your search or AI is accurate?**
I didn't measure an accuracy percentage, so I don't claim one. I tested
specific cases (exact names, typos, categories, follow-ups, unknown
queries), and the admin AI analytics show resolved and unresolved queries,
so unanswered questions can be reviewed and improved.

**20. What if two admins edit at the same time?**
There's no locking or version check, so the last save wins. There's only one
admin role now; for multiple admins I'd add an `updated_at` check to reject
stale edits, plus an audit log.

**21. Your main bundle is over 500 kB. Isn't that slow?**
It's 164 kB gzipped. Admin, Nearby, the OSM snapshot and the Google engine
are split into separate lazy chunks. The biggest part is the animation
library. Replacing it is possible future optimisation, but not worth
rewriting the UI at this stage.

**22. What are the limitations of your system?**
No in-app routing (Routes API off), straight-line distances, device-local
saved places, a rule-based assistant, OSM coverage and rate limits, no
hours/contacts in the data, no automated tests or migrations, no deployment
setup, and remaining security hardening (superuser DB role, no login rate
limit). The two security problems found in Stage 13 (default admin password,
unrestricted key) are fixed and re-tested. Everything is documented.
