# Technologies Used

Only technologies present in `package.json`, `requirements.txt` or the code
are listed. Each entry covers what it is, why the project uses it, how it
is used, and its main advantages and limitations.

---

### JavaScript (ES2020+, ES modules, JSX)
- **What:** The programming language of the browser.
- **Why:** All the interactive logic (search, Campus AI, distances, storage) runs in the browser, so answers are instant and work even if the backend is slow.
- **How:** Feature modules under `frontend/src/features/`, many written as pure functions (e.g. `searchIndex.js`, `assistantService.js`).
- **Advantages:** Runs everywhere, no install; one language for UI and client logic.
- **Limitations:** Dynamically typed (no TypeScript here), so mistakes appear at run time, and there is no automated test suite to catch them.

### React 18
- **What:** A library for building UIs from components that re-render when state changes.
- **Why:** The app has many views sharing one map and live-updating lists; component state is simpler than manual DOM updates.
- **How:** Function components + hooks (`useState`, `useMemo`, `useDeferredValue`, `useSyncExternalStore`), context providers for shared data, `lazy`/`Suspense` for code splitting.
- **Advantages:** Reusable components, a large ecosystem, predictable rendering.
- **Limitations:** Bundle size; the app is client-rendered (no server-side rendering), so the first paint needs JavaScript.

### React Router 6
- **What:** Client-side routing for React.
- **Why:** Every screen has a real URL (`/place/33`, `/route?from=63&to=33`), so links are shareable and the back button works.
- **How:** `BrowserRouter`, nested routes (`MapLayout` keeps the map), `useSearchParams` for filters, `Navigate` for guards.
- **Advantages:** URL is the source of truth for selection and filters.
- **Limitations:** Dev console shows v7 "future flag" warnings (harmless); a production server must return `index.html` for deep links.

### Vite 5
- **What:** Dev server and production bundler.
- **Why:** Fast start and hot reload; simple env handling (`VITE_*`); built-in proxy.
- **How:** `npm run dev` (port 5173, proxies `/api` to 8000), `npm run build` (splits Admin, Nearby, the OSM snapshot, the Google engine and the routes service into separate chunks).
- **Advantages:** Fast; code splitting with `import()`.
- **Limitations:** Main chunk is 512 kB minified / 164 kB gzip (framer-motion is the largest dependency).

### Tailwind CSS 3
- **What:** Utility-first CSS framework.
- **Why:** Consistent spacing/colours from design tokens, responsive classes (`sm:`, `lg:`), no separate CSS files per component.
- **How:** `tailwind.config.js` reads `src/design/tokens.js`; PostCSS + Autoprefixer build it.
- **Advantages:** Small final CSS (35 kB, 7 kB gzip); easy responsive design.
- **Limitations:** Long class lists in JSX.

### framer-motion
- **What:** Animation library for React.
- **Why:** Draggable bottom sheet, panel transitions, assistant animations.
- **How:** `MotionConfig` in `AppShell` (respects reduced motion), `motion` components in `BottomSheet`, `CampusAssistant`, `Notice`, the schematic map.
- **Advantages:** Physics-based gestures; reduced-motion support.
- **Limitations:** Largest dependency in the main bundle.

### lucide-react
- **What:** Open-source SVG icon set as React components.
- **Why:** Consistent icons for categories, navigation and actions; also rendered to SVG strings for map markers.
- **Advantages:** Tree-shakable; only used icons are bundled.
- **Limitations:** Generic icons, not PCE-specific.

### supercluster
- **What:** Fast point-clustering library.
- **Why:** 69 markers overlap at low zoom; clusters keep the map readable.
- **How:** `google/engine.js` builds a cluster index (radius 44 px, up to zoom 18).
- **Limitations:** Clusters by screen distance, not buildings.

### @googlemaps/js-api-loader
- **What:** Official helper to load the Google Maps script.
- **Why:** Loads libraries on demand (`maps`, `marker`, `core`, later `routes`) and reports load errors.

### Google Maps JavaScript API (with a Map ID)
- **What:** Google's interactive web map.
- **Why:** Accurate base map and satellite imagery of the campus surroundings, familiar to users.
- **How:** Vector map with a cloud Map ID/style (POIs hidden), Advanced Markers, hybrid satellite, auth-failure detection with schematic fallback.
- **Advantages:** High-quality imagery and roads; reliable.
- **Limitations:** Needs billing and a key; usage costs beyond the free tier; the browser key is visible, so it must be referrer/API-restricted; internal campus paths are not mapped.

### Google Routes API (optional, not enabled)
- **What:** Google's routing service (walking routes, steps, alternatives).
- **How:** Called through the Maps JS `routes` library (`Route.computeRoutes`) only when the user previews a route.
- **Status:** Returns "API disabled" for this project, so the direct-line fallback is used.

### OpenStreetMap + Overpass API
- **What:** OSM is a free, community-edited world map (ODbL licence); Overpass is its read-only query API.
- **Why:** Real nearby places (food, transport, health, ATMs, shops, attractions) with no key or billing.
- **How:** `providers/osm.js` sends Overpass QL, classifies by tags and normalises; the same code built the bundled snapshot.
- **Advantages:** Free, open, no vendor lock-in.
- **Limitations:** Public servers rate-limit; coverage varies by area; no ratings/hours/photos.

### Browser Geolocation API
- **What:** Browser access to the device position (GPS/Wi-Fi), with user permission.
- **How:** Map "Show my location" uses `watchPosition` (paused while the tab is hidden); Nearby uses a single `getCurrentPosition`; the Permissions API is read without prompting.
- **Limitations:** Needs HTTPS in production (localhost is allowed); accuracy varies; the user may deny it.

### localStorage (Web Storage API)
- **What:** Small key-value storage in the browser, per origin.
- **Why:** Saved places, recent places and preferences without user accounts.
- **How:** Versioned JSON with validation and migration (`savedPlaces.js`).
- **Limitations:** Per device/browser; cleared with site data; synchronous; readable by any script on the page.

### Web Speech API
- **What:** Browser speech recognition and speech synthesis.
- **How:** Voice search / voice questions (`useSpeechRecognition`, `en-IN`) and spoken navigation prompts (`speechSynthesis`).
- **Limitations:** Recognition is not available in all browsers (mainly Chromium-based).

### Python 3.12
- **What:** The backend language.
- **Why:** Readable, strong web and data libraries.

### FastAPI
- **What:** Modern Python web framework for APIs.
- **Why:** Automatic request validation with Pydantic, dependency injection for DB sessions and auth, auto-generated `/docs`.
- **How:** Six routers under `/api/v1`; `Depends(get_db)`, `Depends(get_current_admin)`.
- **Advantages:** Fast to write, typed, self-documenting.
- **Limitations:** Endpoints here are synchronous (`def`), so each request holds a worker thread (fine at campus scale).

### Uvicorn
- **What:** ASGI server that runs FastAPI (`uvicorn app.main:app --port 8000`).

### Pydantic 2 / pydantic-settings
- **What:** Data validation using Python type hints; settings from environment/`.env`.
- **How:** Request/response schemas (length limits, Literal event types, regex keys); `Settings` in `core/config.py`.
- **Advantages:** Invalid input is rejected with 422 before code runs.

### SQLAlchemy 2 + psycopg2
- **What:** Python ORM and the PostgreSQL driver.
- **How:** Declarative models; queries with `func.count`, `group_by`, `filter`; engine with `pool_pre_ping`.
- **Advantages:** No hand-written SQL strings for CRUD; parameterised queries prevent SQL injection.
- **Limitations:** Schema created with `create_all`; no migrations yet.

### PostgreSQL
- **What:** Open-source relational database.
- **Why:** Reliable, ACID transactions, strong SQL (time zones, `regexp_replace`, `FILTER` aggregates used in analytics).
- **How:** Four tables (see ARCHITECTURE §4).
- **Limitations:** Needs a running server; currently accessed as the superuser (should be a limited role).

### REST API (architectural style)
- **What:** Resources addressed by URLs, standard HTTP methods (GET/POST/PATCH/DELETE), JSON bodies and status codes (200, 201, 202, 204, 401, 404, 422).
- **Why:** Simple and cacheable; any client can use it.

### JWT (JSON Web Token) via python-jose
- **What:** Signed token `header.payload.signature` (RFC 7519).
- **How:** HS256, claims `sub` and `exp`; sent as `Authorization: Bearer …`.
- **Advantages:** Stateless; no session table.
- **Limitations:** Cannot be revoked before expiry without extra infrastructure; the payload is readable (not encrypted); security depends on keeping `SECRET_KEY` secret.

### bcrypt
- **What:** Slow, salted password-hashing function.
- **Why:** Stored hashes resist brute force even if the database leaks.

### rapidfuzz
- **What:** Fast fuzzy string matching (Levenshtein-based ratios).
- **How:** Legacy `/chat` reply (`token_set_ratio`, threshold 60). The Campus AI answer shown to users comes from the frontend logic.

### python-dotenv
- Used indirectly by pydantic-settings to read `backend/.env`.

### Present but unused
`alembic` (migrations, not set up) and `python-multipart` (form parsing,
not needed by the JSON API) are listed in `requirements.txt` only.
