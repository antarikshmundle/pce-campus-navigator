# PCE Campus Navigator — Technical Architecture

This document describes the system as it is implemented (verified in Stage 13
against the code and the running application). Nothing here is planned-only
unless it is explicitly marked *not implemented*.

---

## 1. High-level architecture

```
                         User (phone / laptop browser)
                                     │
                                     ▼
┌─────────────────────────── React Frontend (Vite SPA) ───────────────────────────┐
│  Student app  /, /place/:id, /route, /navigate, /nearby, /saved, /profile       │
│  Admin app    /admin/login, /admin/*   (separate lazy-loaded chunk)             │
│                                                                                 │
│  in-browser logic: search ranking · Campus AI · Haversine distances ·            │
│                    OSM normalisation · saved-place storage                       │
└───────┬───────────────────────┬───────────────────────┬─────────────────────────┘
        │ REST / JSON           │ HTTPS (script + tiles)│ HTTPS POST (Overpass QL)
        │ /api/v1/*             │                       │
        ▼                       ▼                       ▼
┌──────────────────┐   ┌───────────────────────┐   ┌─────────────────────────────┐
│ FastAPI backend  │   │ Google Maps Platform  │   │ OpenStreetMap Overpass API  │
│ (Uvicorn :8000)  │   │ • Maps JavaScript API │   │ (live Nearby, only around   │
│                  │   │ • Map ID / styling    │   │  the user's own position)   │
│                  │   │ • Routes API (optional│   └─────────────────────────────┘
│                  │   │   — NOT enabled)      │
└────────┬─────────┘   └───────────────────────┘
         │ SQLAlchemy / psycopg2
         ▼
┌──────────────────┐        ┌────────────────────────────────────────────────┐
│ PostgreSQL       │        │ Local datasets shipped with the code           │
│ pce_navigator    │        │ • backend/app/db/data/locations.json (69 rows) │
│  locations       │        │ • frontend/.../nearby/data/osmSnapshot.json    │
│  admin_users     │        │   (71 Around-PCE + 34 Nagpur OSM places)       │
│  chat_logs       │        └────────────────────────────────────────────────┘
│  usage_events    │
└──────────────────┘
```

### Who talks to whom

| From | To | What |
|---|---|---|
| Browser | FastAPI | Locations, categories, admin login, admin CRUD, `/chat` logging, `/events` analytics, admin insights |
| Browser | Google Maps | Script load, map tiles, markers (Advanced Markers), satellite/hybrid imagery; the `routes` library on first route request |
| Browser | Overpass API | Live Nearby query (5 km radius) when the user has shared a position within 40 km of PCE |
| FastAPI | PostgreSQL | All persistence |
| FastAPI | `locations.json` | Read-only canonical comparison in Data Health / System status |
| FastAPI | Google / OSM | **Never.** The backend only builds a Google Maps URL string in the legacy `/directions` endpoint. |

In development the Vite dev server proxies `/api` to `http://localhost:8000`
(`frontend/vite.config.js`), so the browser uses one origin. In production
the same `/api` path must be proxied by the web server, or `CORS_ORIGINS`
must be extended (not yet configured; see Known limitations).

---

## 2. Frontend architecture

### 2.1 Entry and app shell

- `main.jsx` mounts `<App>` inside `React.StrictMode`.
- `App.jsx` defines all routes with React Router 6:
  - Student routes are wrapped in `CampusDataProvider` → `SavedPlacesProvider` → `AppShell`.
  - Map screens (`/`, `/place/:placeId`, `/route`, `/navigate`, `/nearby`,
    `/nearby/place/:placeKey`) are children of `MapLayout`, so **one map
    instance persists** while the user moves between them.
  - `/saved` and `/profile` are full-page screens without the map.
  - `/admin/*` is guarded by `RequireAuth` (token present and not expired)
    and lazy-loads `AdminApp`.
  - Unknown paths redirect to `/`.
- `AppShell` renders the bottom navigation bar (mobile) or navigation rail
  (desktop) from `layout/navItems.js`, and a framer-motion `MotionConfig`
  that respects the OS reduced-motion setting.

### 2.2 Map provider and map layout

- `features/map/MapProvider.jsx` holds the chosen map type
  (`standard` / `satellite`, persisted as `pce.mapType`) and a registry that
  lets screens reach the map.
- `layout/MapLayout.jsx` owns the map, the bottom sheet (mobile) / floating
  panel (desktop), discovery state (`useDiscoveryState`: search text,
  category filter, recents) and geolocation (`useGeolocation`). Screens
  declare what the map should show with `useMapView({...})`
  (`layout/mapLayoutContext.js`): selected place, visible ids, external
  places, route polyline, camera scope.
- `features/map/CampusMap.jsx` chooses the renderer: if a Google key is
  configured it lazy-imports `google/engine.js` + `markerIcons.js`;
  otherwise, or on load/auth/tile failure, it renders `schematic/SchematicMap.jsx`
  with a notice.
- `google/loader.js` loads the Maps JS API once (`core`, `maps`, `marker`
  libraries) through `@googlemaps/js-api-loader`, listens for
  `gm_authFailure`, and loads the `routes` library separately on demand.
- `google/engine.js` creates the map with the configured Map ID, builds
  clusters with `supercluster`, and renders Advanced Markers with category
  icons; `camera.js` frames the campus and honours reduced motion.
- `geojson.js` → `analyzeCampus()` computes the median campus centre and
  flags outliers (> 3 km); outliers stay visible but never drive framing or
  routing.

### 2.3 Feature-based modules (`src/features/`)

| Folder | Responsibility |
|---|---|
| `locations/` | `CampusDataProvider` (fetch once, share), `categoryMeta` (icons/labels), `PlaceRow` |
| `search/` | `searchIndex.js` (index + ranking), `fuzzy.js` (bounded edit distance), `SearchBar` (text + voice), `SearchResults`, `recentSearches.js`, `useSearchTracking.js` |
| `discovery/` | `useDiscoveryState` (single owner of search/filter state), `proximity.js` (distance sorting), `PlaceList` |
| `home/` | `HomePanel` (recent, explore list, category groups) |
| `place/` | `LocationDetail`, `RelatedPlaces` (same building, nearby) |
| `route/` | `routeService` (Google route or direct-line fallback, 5-min cache), `useRoutePreview`, endpoint pickers |
| `navigation/` | Live navigation: `routing/` (Google route service, normaliser, types), `progress/routeProgress.js`, `useNavigationSession`, camera, voice guidance, UI cards, `navConfig.js` thresholds |
| `assistant/` | Campus AI: `assistantIntent.js` (parsing), `assistantResolver.js` (matching), `assistantService.js` (answers + context), `useCampusAssistant`, UI |
| `nearby/` | `providers/osm.js` (Overpass queries + normalisation), `nearbyService.js` (snapshot/live, registry, de-duplication), `useNearbyPlaces` (one-shot location), `nearbySearch.js`, `nearbyCategories.js`, `externalLinks.js`, `data/osmSnapshot.json` |
| `saved/` | `savedPlaces.js` (storage format, migration, validation), `SavedPlacesProvider`, `SaveButton`, `SavedPlaceRow` |

### 2.4 Screens (`src/screens/`)

`ExploreScreen`, `LocationDetailScreen`, `RoutePreviewScreen`,
`NavigationScreen`, `NearbyScreen` (lazy), `NearbyPlaceScreen` (lazy),
`SavedScreen`, `ProfileScreen`. `pages/AdminLogin.jsx` is the admin sign-in.

### 2.5 Shared components

`ui/` (BottomSheet, Button, Chip, EmptyState, IconButton, Notice,
PanelHeader, Skeleton), `layout/` (AppShell, BottomNav, NavRail, BrandMark),
`design/tokens.js` (colours, spacing, layout sizes feeding
`tailwind.config.js`), `hooks/` (useGeolocation, useMediaQuery,
useSpeechRecognition, useBackNavigation), `utils/geo.js` (Haversine,
walking time, formatting), `utils/cn.js`.

### 2.6 State management

There is no global state library. State is held in:

| Where | What |
|---|---|
| React context | Campus data (`CampusDataProvider`), saved/recent places (`SavedPlacesProvider`), map type + registry (`MapProvider`), map layout (`mapLayoutContext`), admin data cache (`AdminDataProvider`) |
| Module-level stores | One-shot Nearby location (`useSyncExternalStore` in `useNearbyPlaces.js`), route cache (`routeService`), live OSM cache, analytics queue |
| URL | Selected place (`/place/:id`), route endpoints (`/route?from=&to=`), navigation (`/navigate?from=&to=&alt=`), Nearby tab/category/query (`?tab=&cat=&q=`), admin filters and pagination |
| `localStorage` | See 2.7 |

### 2.7 localStorage keys

| Key | Content |
|---|---|
| `pce-navigator:saved-places` | `{ version: 2, items: [{ source, id, savedAt, place? }] }`, max 200 |
| `pce-navigator:recent-place-ids` | `{ version: 2, items: [{ source, id, place? }] }`, max 8 (recently viewed) |
| `pce_recent_places` | Array of up to 5 campus ids opened from search (recent searches; no typed text) |
| `pce.mapType` | `standard` or `satellite` |
| `pce.navVoiceMuted` | Voice guidance preference |
| `pce_admin_token` | Admin JWT (admin only) |

Every read is wrapped in `try/catch` and validated; blocked or corrupted
storage degrades to an empty in-memory list.

---

## 3. Backend architecture

### 3.1 FastAPI application

`app/main.py` creates the app (title from settings), adds `CORSMiddleware`
(`http://localhost:5173`, `http://localhost:3000`), includes six routers
under `/api/v1`, and on startup creates the `usage_events` table if it does
not exist (`checkfirst=True`; nothing is altered or dropped). `GET /` is a
health check.

### 3.2 Routers

| Router | Endpoints | Notes |
|---|---|---|
| `locations.py` | `GET /locations`, `GET /locations/categories`, `GET /locations/{id}`, `POST`, `PATCH`, `DELETE` | Writes require `get_current_admin`; duplicate names rejected on create |
| `auth.py` | `POST /auth/login` | bcrypt verify → JWT; 401 for bad credentials, 403 for disabled account |
| `chat.py` | `POST /chat`, `POST /directions` | `/chat` runs the legacy rapidfuzz matcher and writes a `chat_logs` row; if `client_resolution` is sent, the log records what the in-browser Campus AI answered (ids re-checked in the DB) |
| `events.py` | `POST /events` | Whitelisted types, ≤ 20 per batch, 120 events/min/client in memory, search text normalised (emails removed, 6+ digit numbers masked, casefold, 80 chars), unknown place ids dropped |
| `admin_stats.py` | `GET /admin/stats/overview` | Legacy summary (kept for compatibility) |
| `admin_insights.py` | `GET /admin/insights/summary`, `/data-health`, `/ai`, `/usage`, `/system` | Router-level `Depends(get_current_admin)`; read-only SQL aggregates |

### 3.3 Services

| Service | Purpose |
|---|---|
| `chatbot.py` | Strip campus prefix → alias; strip filler words; `rapidfuzz.process.extract` with `token_set_ratio`; threshold 60 |
| `directions.py` | Haversine distance ÷ 1.3 m/s → minutes; Google Maps `dir/?api=1` walking URL; templated steps |
| `data_health.py` | Pure functions: count, id range, duplicate ids, missing fields, whitespace, category/building variant groups, invalid and suspicious coordinates (> 3 km from median), shared coordinates, field-by-field comparison with `locations.json`. Never writes. |

### 3.4 Models and schemas

SQLAlchemy models in `app/models/` (see §4). Pydantic schemas in
`app/schemas/` validate every request: `LocationCreate/Update/Out`,
`AdminLogin`, `Token`, `ChatQuery` (+ `ClientResolution` with length
limits), `UsageEventIn` (Literal event types, regex for OSM keys),
`UsageEventBatch` (1–20 events).

### 3.5 Authentication

- `core/security.py`: `bcrypt.hashpw/checkpw`; `jose.jwt.encode/decode`
  with `SECRET_KEY` and HS256; tokens contain `sub` and `exp`.
- `core/deps.py`: `OAuth2PasswordBearer` extracts the bearer token;
  `get_current_admin` decodes it, loads the `AdminUser` by username and
  requires `is_active`. Any failure → `401 Could not validate credentials`.
- Settings come from `backend/.env` through `pydantic-settings`.

### 3.6 Admin endpoints and events

Admin insight endpoints compute every figure from stored rows at request
time (`COUNT`, `GROUP BY`, day buckets in `Asia/Kolkata`). They do not
cache, estimate, or write. `/events` is the only public write path apart
from `/chat` logging.

---

## 4. Database architecture

Actual tables in `pce_navigator` (verified with `information_schema`):

### `locations`
| Column | Type | Notes |
|---|---|---|
| id | integer PK | Canonical ids 16–84 are preserved from `locations.json` |
| name | varchar(150) unique, indexed | Official name (may include "PRIYADARSHINI" prefix) |
| category | varchar(80) | Free text (e.g. Academic, Sports, Food, Parking) |
| latitude, longitude | float | WGS84 |
| building | varchar(120) null | |
| floor | varchar(40) null | |
| description | text null | Shown as "Campus directory note" |
| image_url | varchar(300) null | Currently unused by the UI |
| created_at, updated_at | timestamptz | `updated_at` changes on edit |

### `admin_users`
id, username (unique), hashed_password (bcrypt), is_active, created_at.

### `chat_logs`
id, query_text, matched_location (name, null if none/many), match_score
(rapidfuzz score or null for client-resolved), was_resolved, created_at.

### `usage_events`
id, event_type (indexed), place_id (campus id, validated on insert, no FK),
external_key (`osm-[nwr]<id>`), query_text (normalised, ≤ 80), result_count,
detail (`in_app | google_maps | campus | around | nagpur`), created_at (indexed).

Relationships are intentionally loose: `chat_logs.matched_location` stores a
name and `usage_events.place_id` an id without a foreign key, so deleting a
location never deletes history. No user, device, IP address or position is
stored in any table.

The canonical dataset `backend/app/db/data/locations.json` mirrors
`locations` field by field. `seed.py` loads it only into an empty table;
`export_locations.py` writes it from the DB with a verified round-trip;
`verify_locations.py` and the Data Health page compare the two, read-only.

---

## 5. Data flows

### 5.1 Search
1. `CampusDataProvider` fetches `GET /locations` and `/locations/categories` once.
2. `buildSearchIndex` normalises each place once per data load.
3. Each keystroke updates `query`; ranking runs on a deferred copy
   (`useDeferredValue`) so typing stays responsive.
4. `searchIndex()` scores, filters and sorts (see ALGORITHMS.md §1); an
   optional category chip narrows results; the map dims non-matching markers.
5. Selecting a result navigates to `/place/:id`, adds the id to recent
   searches, and queues `SEARCH_RESULT_OPENED`. After the text is stable for
   1.5 s, `SEARCH_SUBMITTED` (term + result count) is queued. Events are
   sent in batches to `POST /events` every 3 s (or on page hide).

### 5.2 AI query
1. The user types or speaks a question in the Campus AI panel.
2. `ask()` → `parseIntent()` → handler (lookup / nearby / distance /
   navigation / unavailable) → `resolveSubject()` using the search index and
   conversation context.
3. The answer card shows only real records, distances computed from stored
   coordinates, and actions (Open place / Navigate / Use my location).
4. Fire-and-forget `POST /chat` with the query and `client_resolution`
   (intent, place ids, resolved) → one `chat_logs` row.
5. A navigation answer navigates the app to `/route?to=<id>`.

### 5.3 Nearby discovery
1. Reference point = user position (only after "Use my location", one
   shot, within 40 km) or the campus median.
2. Places: live Overpass result for that ~100 m cell if available, otherwise
   the bundled snapshot; Nagpur attractions always from the snapshot.
3. Remove off-campus places within 40 m of a campus place, compute
   Haversine distance, sort nearest first, apply the category chip, show up
   to 20 (Around PCE) or all (Nagpur).
4. Opening a place → `/nearby/place/osm-…` and a `NEARBY_PLACE_OPENED` event.

### 5.4 Save place
Save button → `SavedPlacesProvider.toggle` → `addSaved()` (campus: id only;
external: minimal validated record) → `writeSaved()` (`version: 2`) →
other tabs update via the `storage` event. Removing offers undo.

### 5.5 Navigation
1. `/route?from=&to=` resolves endpoints (place id or "me" = GPS).
2. `routeService.getRoutes()` checks the 5-minute cache, rejects invalid or
   > 10 km requests, and lazy-loads `googleRouteService` → Routes API.
3. Currently the Routes API returns *disabled*, so the result is
   `status: 'fallback'` with a direct-line route; the UI says
   "Walking route unavailable. Showing direct-line estimate.", disables
   "Start navigation", and shows **Open in Google Maps**
   (`https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`).
4. With a Google route (if enabled later), `/navigate` would track GPS,
   compute progress, detect off-route and reroute within the limits in
   `navConfig.js`.

### 5.6 Admin analytics
Admin page → `adminApi.get('/admin/insights/…')` with the bearer token →
router dependency validates the JWT → SQL aggregates over `chat_logs`,
`usage_events`, `locations` (+ `locations.json` for integrity) → JSON →
cards and tables. OSM snapshot health (`admin/osmHealth.js`) runs in the
browser over the bundled snapshot. A 401 sends the admin back to sign-in;
network/5xx errors show "Backend unavailable".

---

## 6. Failure handling (verified in Stage 13)

| Failure | Behaviour |
|---|---|
| Backend down / 5xx | Student app: "Check your connection and try again." with retry; admin: "Backend unavailable" |
| Network error | Same friendly messages; no stack traces in the UI |
| Google Maps blocked / key rejected | Schematic campus map + notice |
| Routes API disabled | Direct-line estimate + Google Maps link; live navigation disabled with an explanation |
| Overpass error / 429 | Snapshot shown; failure not cached so a later retry can succeed |
| Location denied | Locate button shows "Location blocked — tap for details"; Nearby explains and uses the PCE reference |
| Invalid place id / OSM key | "Place not found" state |
| Malformed localStorage | Treated as empty; app renders normally |
| Expired / forged admin token | Client redirects to `/admin/login`; server returns 401 |
