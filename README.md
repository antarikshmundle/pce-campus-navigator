# PCE Campus Navigator

A map-first web application that helps students and visitors find places on the
Priyadarshini College of Engineering (PCE), Nagpur campus, get walking
estimates, ask a campus assistant in plain English, discover useful places
around the campus and in Nagpur, and keep a personal list of saved places. An
authenticated admin control centre lets staff maintain the campus directory
and monitor data quality and usage.

> Detailed documentation lives in [`docs/`](docs/):
> [Architecture](docs/ARCHITECTURE.md) · [Modules](docs/MODULES.md) ·
> [Technologies](docs/TECHNOLOGY.md) · [Algorithms](docs/ALGORITHMS.md) ·
> [Final QA (Stage 13)](docs/QA_STAGE13.md) · [Report outline](docs/REPORT_OUTLINE.md) ·
> [Viva preparation](docs/VIVA.md) · [Research background](docs/RESEARCH_BACKGROUND.md) ·
> [Demo script](docs/DEMO_SCRIPT.md)

---

## Project purpose

New students, parents and visitors regularly struggle to find departments,
labs, seminar halls, canteens, parking and offices on a large campus with
several buildings. This project turns the campus directory into an
interactive, searchable, mobile-friendly map with a conversational helper,
while keeping the data under the institution's control.

## Problem statement

- Campus places are spread over many buildings, and the names people use
  ("library", "AI & DS", "canteen") rarely match official names exactly.
- Generic map apps do not know internal campus places (department floors,
  seminar halls, clubs), and they mix in commercial listings.
- A static signboard or PDF map cannot answer questions, cannot measure
  distance from where you stand, and cannot be updated easily.
- Administrators have no view of what people search for, which places are
  missing, or whether the stored coordinates are correct.

## Objectives

1. Show all 69 canonical campus places on a real map (with satellite view).
2. Tolerant, ranked search (prefixes, word order, small typos, categories).
3. Place details with a straight-line walking estimate and route preview,
   with a hand-off to Google Maps for turn-by-turn walking.
4. A deterministic, grounded "Campus AI" assistant that answers only from
   stored data and never invents places.
5. Nearby discovery of real off-campus places (OpenStreetMap) around PCE and
   in Nagpur, kept separate from campus data.
6. Device-local saved and recently viewed places, with no user account.
7. A JWT-protected admin area for data maintenance, data-health auditing and
   anonymous usage analytics.

## Key features

| Area | What it does |
|---|---|
| Campus map | Google Maps JavaScript API (vector Map ID, custom style) with Map / Satellite (hybrid) toggle, clustered category markers; schematic fallback map if Google cannot load |
| Search | Live, ranked search over name, category, building, floor and description; typo tolerance; voice input (Web Speech API, where supported) |
| Place detail | Building, floor, directory note, straight-line distance/time, places in the same building and nearby, save button |
| Route preview | Choose start (place or "My location") and destination; requests a Google walking route; if the Routes API is unavailable it shows a clearly labelled **direct-line estimate** and an **Open in Google Maps** link |
| Campus AI | Rule-based intent parsing (lookup, category, nearby, distance, navigation, unavailable info), context follow-ups ("it", "the second one"), answers built only from records |
| Nearby | Three tabs: **Around PCE** (71 OSM places), **On campus** (69 places), **Explore Nagpur** (34 OSM attractions); category filters; live OSM lookup around the user with bundled snapshot fallback |
| Saved / Recent | Saved campus and off-campus places and recently viewed places in `localStorage` (versioned, migrated, validated) |
| Profile | Map view preference, voice guidance, motion preference, on-device data controls, admin link |
| Admin | Dashboard, campus locations CRUD, categories, data health + canonical audit, search analytics, AI analytics, place usage, Around-PCE / Nagpur snapshot health, system status |

## Technology stack

| Layer | Technology (version from lock/requirements) |
|---|---|
| Frontend | React 18.3, React Router 6.26, Vite 5.4, Tailwind CSS 3.4, JavaScript (ES modules, JSX) |
| UI libraries | framer-motion (animation), lucide-react (icons), supercluster (marker clustering), @googlemaps/js-api-loader |
| Backend | Python 3.12, FastAPI 0.115, Uvicorn 0.30, Pydantic 2.9 / pydantic-settings 2.5 |
| Database | PostgreSQL (tested on 18), SQLAlchemy 2.0 ORM, psycopg2 |
| Auth | JWT (HS256) via python-jose, bcrypt password hashing, OAuth2 bearer scheme |
| Matching | rapidfuzz (legacy `/chat` fuzzy matcher); the Campus AI and search ranking run in the browser |
| External services | Google Maps JavaScript API (+ Map ID); Routes API (optional, currently **not enabled**); OpenStreetMap Overpass API (live Nearby lookups) |
| Browser APIs | Geolocation, localStorage, Web Speech (recognition + synthesis), Permissions API |

Listed in `requirements.txt` but not imported anywhere: `alembic`,
`python-multipart` (kept for future migrations / form uploads).

## System architecture

```
                 ┌────────────────────────────── Browser ──────────────────────────────┐
  User  ───────▶ │ React SPA (Vite)                                                     │
                 │  ├─ Map layer ──────────────▶ Google Maps JS API (tiles, markers)    │
                 │  ├─ Route preview ─────────▶ Google Routes API (optional)            │
                 │  ├─ Nearby (live) ─────────▶ OpenStreetMap Overpass API              │
                 │  ├─ Nearby (fallback) ─────  bundled osmSnapshot.json                │
                 │  ├─ Campus AI / Search ────  in-browser, over loaded campus data     │
                 │  └─ Saved / Recent ────────  localStorage                            │
                 └──────────────┬───────────────────────────────────────────────────────┘
                                │ REST/JSON  /api/v1/*  (Vite dev proxy → :8000)
                 ┌──────────────▼───────────────┐
                 │ FastAPI (Uvicorn)            │
                 │  routers → services → models │
                 └──────────────┬───────────────┘
                                │ SQLAlchemy
                 ┌──────────────▼───────────────┐
                 │ PostgreSQL  pce_navigator    │
                 │ locations · admin_users ·    │
                 │ chat_logs · usage_events     │
                 └──────────────────────────────┘
```

The backend never calls Google or OpenStreetMap; those are browser-side. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

### Frontend architecture (summary)

- `App.jsx`: routes; `CampusDataProvider` (loads locations once) and
  `SavedPlacesProvider` wrap the student app; `AppShell` holds navigation
  (bottom bar on mobile, rail on desktop).
- `MapLayout`: one persistent map instance shared by Explore, Place,
  Route, Navigate and Nearby screens; screens describe what the map should
  show via `useMapView`.
- `features/*`: feature modules (`search`, `assistant`, `map`, `nearby`,
  `saved`, `route`, `navigation`, `discovery`, `place`, `locations`).
- `screens/*`: one component per route. `ui/*`: shared primitives.
- `admin/*`: separate lazy-loaded chunk; never downloaded by students.
- State: React context + hooks; URL query parameters for shareable state
  (`/route?from=&to=`, search, admin filters); `localStorage` for saved,
  recent and preferences.

### Backend architecture (summary)

- `app/main.py`: FastAPI app, CORS, router registration, startup creates
  the `usage_events` table if it is missing.
- `app/routers/`: `locations`, `auth`, `chat` (+ `/directions`), `events`,
  `admin_stats`, `admin_insights`.
- `app/services/`: `chatbot` (rapidfuzz matcher), `directions` (Haversine
  estimate + Google Maps link), `data_health` (read-only audits).
- `app/models/` (SQLAlchemy) and `app/schemas/` (Pydantic).
- `app/core/`: settings from `.env`, bcrypt/JWT helpers, `get_current_admin`.
- `app/db/`: session, `seed.py`, `export_locations.py`, `verify_locations.py`,
  canonical `data/locations.json`.

## Database

| Table | Purpose |
|---|---|
| `locations` | The 69 canonical campus places (ids 16–84): name, category, latitude, longitude, building, floor, description, image_url, timestamps |
| `admin_users` | Admin accounts: username, bcrypt hash, is_active |
| `chat_logs` | Every Campus AI / chat query with matched place and resolved flag |
| `usage_events` | Anonymous events: search submitted/opened, place opened, navigation requested, nearby search/opened (no user, IP, device or position stored) |

Tables are created with SQLAlchemy `create_all` (no Alembic migrations yet).

## Map system

Google Maps JavaScript API loaded on demand (`features/map/google/loader.js`)
with the `maps`, `marker` and `core` libraries; the `routes` library loads
only when a route is requested. Markers are Advanced Markers clustered with
supercluster. Places more than 3 km from the median campus position are
treated as outliers: shown, but excluded from framing and routing. If the key
is missing or rejected, or Google cannot load, the app switches to a built-in
schematic campus map with a notice.

## Campus AI

A deterministic assistant (`features/assistant/`), not an external LLM:
regular-expression intent families → filler-word stripping → place
resolution through the same ranked search index → answer templates filled
only from record fields. It keeps short context (last focused place, last
list, pending "which one?") for follow-ups. Each query is logged to
`chat_logs` via `POST /api/v1/chat` for admin analytics.

## Nearby / OSM

Off-campus data comes only from OpenStreetMap. A bundled snapshot
(`features/nearby/data/osmSnapshot.json`, fetched 2026-09-24, 71 Around-PCE
and 34 Nagpur places) is always available. When the user shares a location
within 40 km of PCE, the app queries the Overpass API live (5 km radius,
cached per ~100 m cell per session) and falls back to the snapshot on any
failure. External places are never written to the `locations` table.

## Admin system

`/admin/*`, lazy-loaded, behind a client-side session check and server-side
JWT checks on every admin API call. Pages: Dashboard, Campus locations
(filter, detail drawer, validated add/edit/delete), Categories (variant
suggestions, never auto-merged), Data health (count, id range, duplicates,
missing fields, whitespace, category variants, invalid/suspicious
coordinates, shared coordinates, canonical JSON comparison), Search
analytics, AI analytics, Place usage, Around PCE / Explore Nagpur snapshot
health, System status (booleans only, no secrets).

## Authentication

`POST /api/v1/auth/login` checks the bcrypt hash and returns a JWT
(HS256, `sub` = username, `exp` = 8 hours). Admin routes depend on
`get_current_admin`, which rejects missing, malformed, expired, wrongly
signed and unknown-user tokens with **401**. The frontend stores the token in
`localStorage`, redirects to `/admin/login` when it is missing or expired,
and never sends analytics from admin pages.

## Saved places

`features/saved/savedPlaces.js`: version-2 JSON under
`pce-navigator:saved-places` (max 200) and `pce-navigator:recent-place-ids`
(max 8). Campus places are stored by id only; off-campus places store a
minimal public record (name, category, lat/lng, address). Old Stage 9
formats are migrated on read; malformed data reads as empty. Data is per
browser/device. There is no account sync.

## Navigation

Route preview requests a Google walking route through the Maps JS `routes`
library (Routes API). **The Routes API is not enabled for this project**, so
the preview shows a labelled direct-line estimate and offers **Open in Google
Maps** for real turn-by-turn walking. The in-app live navigation screen
(`/navigate`, GPS progress, off-route detection, voice) is built but can
only start with a Google walking route, so it is not available in the
current configuration (Stage 7: partial by design).

## Data flow (short)

- **Search:** keystroke → in-browser ranking over loaded locations → result
  opens `/place/:id`; an anonymous `SEARCH_SUBMITTED` event is sent after the
  text settles.
- **AI query:** text → `parseIntent` → resolver/handlers → answer card;
  query + resolution posted to `/chat` for `chat_logs`.
- **Nearby:** snapshot (or live Overpass result) → drop campus duplicates
  (< 40 m) → Haversine sort → category filter.
- **Save:** button → provider state → `localStorage` (v2).
- **Admin analytics:** admin page → `GET /admin/insights/*` → SQL aggregates
  over `chat_logs`, `usage_events`, `locations` + `locations.json`.

## API structure

Base path `/api/v1`. Interactive docs: `http://localhost:8000/docs`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` (root, no prefix) | – | Health check |
| GET | `/locations[?category=]` | – | All locations (sorted by name) |
| GET | `/locations/categories` | – | Distinct category labels |
| GET | `/locations/{id}` | – | One location (404 if unknown) |
| POST | `/locations` | Admin | Create location |
| PATCH | `/locations/{id}` | Admin | Partial update |
| DELETE | `/locations/{id}` | Admin | Delete |
| POST | `/auth/login` | – | Username + password → JWT |
| POST | `/chat` | – | Legacy fuzzy reply + logs query to `chat_logs` |
| POST | `/directions` | – | Haversine estimate + Google Maps link (legacy, not used by the new UI) |
| POST | `/events` | – | Anonymous usage events (≤ 20 per batch, whitelisted types, in-memory rate limit) |
| GET | `/admin/stats/overview` | Admin | Legacy chatbot stats |
| GET | `/admin/insights/summary` | Admin | Dashboard summary |
| GET | `/admin/insights/data-health` | Admin | Data health + canonical audit |
| GET | `/admin/insights/ai` | Admin | AI analytics from `chat_logs` |
| GET | `/admin/insights/usage` | Admin | Search / place / nearby analytics from `usage_events` |
| GET | `/admin/insights/system` | Admin | System status (booleans only for security) |

## Folder structure

```
pce-campus-navigator/
├── backend/
│   ├── app/
│   │   ├── core/        config.py, security.py, deps.py
│   │   ├── db/          session.py, seed.py, export_locations.py, verify_locations.py, data/locations.json
│   │   ├── models/      location.py, admin_user.py, chat_log.py, usage_event.py
│   │   ├── routers/     locations, auth, chat, events, admin_stats, admin_insights
│   │   ├── schemas/     Pydantic request/response models
│   │   ├── services/    chatbot.py, directions.py, data_health.py
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── admin/       AdminApp, layout, pages/, osmHealth.js, adminApi.js
│   │   ├── features/    assistant, discovery, home, locations, map, navigation, nearby, place, route, saved, search
│   │   ├── screens/     Explore, LocationDetail, RoutePreview, Navigation, Nearby, NearbyPlace, Saved, Profile
│   │   ├── layout/      AppShell, MapLayout, BottomNav, NavRail
│   │   ├── ui/          BottomSheet, Button, Chip, Notice, …
│   │   ├── hooks/ lib/ services/ utils/ design/
│   │   └── App.jsx, main.jsx
│   ├── package.json, vite.config.js, tailwind.config.js
│   └── .env.example
├── docs/                architecture, modules, viva, report, QA …
└── backups/             local DB dumps (git-ignored)
```

## Installation

Prerequisites: Python 3.12, Node.js 18+ (tested on 24), PostgreSQL 14+
(tested on 18), a Google Cloud project with the Maps JavaScript API enabled
(optional: the app works with a schematic map without it).

### Environment variables

`backend/.env` (copy from `backend/.env.example`, never commit):

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | `postgresql://<user>:<password>@localhost:5432/pce_navigator` (URL-encode special characters in the password) |
| `SECRET_KEY` | Long random string for signing JWTs, e.g. `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Admin token lifetime (default 480) |

`frontend/.env.local` (copy from `frontend/.env.example`, never commit):

| Variable | Meaning |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Browser key (Maps JavaScript API; Routes API optional) |
| `VITE_GOOGLE_MAPS_MAP_ID` | JavaScript vector Map ID with POIs hidden; empty = `DEMO_MAP_ID` |

### Database setup

```sql
CREATE DATABASE pce_navigator;
CREATE USER pce_user WITH PASSWORD '<choose-a-password>';
GRANT ALL PRIVILEGES ON DATABASE pce_navigator TO pce_user;
-- PostgreSQL 15+: also allow creating tables in the public schema
\c pce_navigator
GRANT ALL ON SCHEMA public TO pce_user;
```

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp; then edit values
python -m app.db.seed            # creates tables, loads locations.json only if empty, creates admin
```

The seed creates user `admin` with a default password printed once. **Sign in
and change it immediately** (see Security notes: no password-change screen
exists yet).

### Running the backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --port 8000          # add --reload while developing
```

### Running the frontend

```bash
cd frontend
npm install
copy .env.example .env.local     # then set the Google values
npm run dev                      # http://localhost:5173  (proxies /api → :8000)
npm run build                    # production build in frontend/dist
```

Open `http://localhost:5173` for the student app and `/admin` for the admin
area.

### Data maintenance commands

```bash
cd backend
python -m app.db.verify_locations --links   # read-only: outliers, shared coords, DB ↔ JSON drift
python -m app.db.export_locations           # DB → locations.json (verified round-trip)
pg_dump -Fc -d pce_navigator -f ../backups/YYYYMMDD-HHMM-pce_navigator.dump
```

## Testing

There is no automated unit-test suite in the repository. Stage 13 QA was
performed against the running application:

- an API/security script (42 checks: data counts, 404/422 handling, event
  validation, 401 on every admin route for missing/garbage/expired/
  wrongly-signed/unknown-user tokens, CORS);
- a browser script (Playwright driving Chrome) covering all 24 user and admin
  flows, error states (backend down, network failure, Google blocked, OSM
  rate-limited, location denied, malformed localStorage, Stage 9 migration)
  and reduced motion;
- a responsive sweep at 390×844, 412×915, 768×1024, 1366×768, 1440×900 and
  1920×1080.

Final status: **PASS**. All findings were resolved and re-verified.
Results, including the original failures and how they were resolved, are in
[docs/QA_STAGE13.md](docs/QA_STAGE13.md).

## Known limitations

- Google Routes API is not enabled → no Google walking route, no in-app live
  navigation; the direct-line estimate and Google Maps hand-off are used.
- Maps depend on Google billing/configuration; without it the schematic map
  is shown.
- Nearby distances are straight-line (Haversine), not walking distance.
- The public Overpass API has fair-use rate limits; OSM coverage around PCE
  is uneven, and the snapshot is only as current as its fetch date.
- Saved and recent places are per browser/device, with no sync.
- Campus AI is rule-based: it handles the phrasings it was designed for and
  says so when it cannot answer; it does not "understand" arbitrary language.
- Analytics history is short (collection began at Stage 11) and anonymous.
- No automated test suite, no database migrations (Alembic unused), single
  admin role.
- The legacy `/directions` endpoint and `admin/stats/overview` remain for
  compatibility but are not used by the new UI.

## Security notes

- Secrets live only in `backend/.env` and `frontend/.env.local`, both
  git-ignored; the `.env.example` files contain placeholders only.
- `SECRET_KEY` has been rotated to a 64-character random value; tokens
  signed with earlier/placeholder keys are rejected.
- **Admin password:** the default seeded password has been changed on this
  installation, and the change was verified in Stage 13 (the seed password now
  returns 401). New installations still seed a default password: change it
  right after setup. There is no password-change UI; see
  [docs/QA_STAGE13.md §4](docs/QA_STAGE13.md#4-security) for the procedure.
- **Google browser key:** HTTP-referrer restrictions are in place and were
  verified in Stage 13 (loads on localhost; blocked from other origins with
  `RefererNotAllowedMapError`). A browser key is always visible to users;
  these restrictions are what protect it. Add the production origin when
  deploying, and keep API restrictions to the Maps JavaScript API
  (+ Routes API if enabled).
- The backend currently connects as the PostgreSQL superuser; use a
  dedicated least-privilege role in production.
- The admin JWT is kept in `localStorage`; any XSS would expose it. React
  escapes rendered text and `dangerouslySetInnerHTML` is not used; the only
  `innerHTML` writes are map-marker icons built from bundled Lucide SVG,
  never from data or user input.
- `/events` and `/chat` are public by design; `/events` has an in-memory
  per-client rate limit, and `/chat` has none.
- There is no login rate limiting / lockout yet.

## Future scope

- Enable the Google Routes API (with quotas) to activate the existing in-app
  walking navigation, or add a campus footpath graph for internal paths.
- Indoor/floor-level guidance for multi-floor buildings.
- Admin password change, multiple admin roles, login rate limiting,
  httpOnly-cookie sessions.
- Alembic migrations, automated unit/integration tests, CI, Docker
  deployment.
- Optional account sync for saved places; PWA/offline mode.
- Periodic snapshot refresh for OSM data; event timings and opening hours
  as new location fields.
- An optional LLM layer that rephrases Campus AI answers while places,
  distances and actions keep coming from the deterministic core.
