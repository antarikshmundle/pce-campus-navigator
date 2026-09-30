# Module Breakdown

For each module: purpose, inputs, processing, output, technologies,
important files, key logic, and limitations. Algorithms are detailed in
[ALGORITHMS.md](ALGORITHMS.md).

---

## 1. Authentication

| | |
|---|---|
| **Purpose** | Restrict data editing and analytics to administrators |
| **Inputs** | Username + password (login form); bearer token on each admin request |
| **Processing** | bcrypt comparison with the stored hash → JWT (HS256, `sub`, `exp` 8 h) signed with `SECRET_KEY`; on every admin call `get_current_admin` decodes the token, checks the signature and expiry, loads the user and requires `is_active` |
| **Output** | `{ access_token, token_type: "bearer" }`, or 401/403 |
| **Technologies** | FastAPI security (`OAuth2PasswordBearer`), python-jose, bcrypt, pydantic-settings; React Router guard |
| **Files** | `backend/app/core/security.py`, `core/deps.py`, `routers/auth.py`, `db/seed.py`; `frontend/src/pages/AdminLogin.jsx`, `admin/adminApi.js` (`hasValidSession`, `tokenExpiry`), `lib/auth.js`, `App.jsx` (`RequireAuth`) |
| **Key logic** | Stateless tokens: the server keeps no session table, and a token is valid only if its signature matches the current secret and `exp` is in the future. The client reads `exp` only to redirect early; the server remains the authority. |
| **Limitations** | A fresh install seeds a default password that must be changed after setup (done and verified on this installation, Stage 13); no password-change UI; no login rate limit; token in `localStorage`; no logout-side revocation (tokens live until expiry); single role |

## 2. Campus Map

| | |
|---|---|
| **Purpose** | Show the 69 campus places on an interactive map |
| **Inputs** | Normalised locations; selected place; filters; map type; user position |
| **Processing** | Load Google Maps JS once → create map with Map ID → cluster markers with supercluster → render Advanced Markers with category icons → frame the campus from non-outlier coordinates; switch roadmap ↔ hybrid |
| **Output** | Interactive map with markers, clusters, selected pin, route line, user dot |
| **Technologies** | Google Maps JavaScript API, `@googlemaps/js-api-loader`, supercluster, lucide icons, custom schematic SVG fallback |
| **Files** | `features/map/CampusMap.jsx`, `MapProvider.jsx`, `mapConfig.js`, `geojson.js`, `google/{loader,engine,markers,camera,overlays,selectedMarker,config}.js`, `schematic/*`, `MapTypeToggle.jsx`, `MapControls.jsx`, `layout/MapLayout.jsx` |
| **Key logic** | Median-based campus centre; places > 3 km away are outliers (shown, not framed or routed); one persistent map shared by all map screens |
| **Limitations** | Needs a valid key and billing; vector styling needs WebGL (falls back to raster, where POIs may show); the browser key relies on HTTP-referrer restrictions (in place and verified in Stage 13; add the production origin when deploying) |

## 3. Search

| | |
|---|---|
| **Purpose** | Find a campus place quickly by typing or speaking |
| **Inputs** | Query text (or speech via Web Speech API, `en-IN`), optional category chip, optional user position |
| **Processing** | Index built once; tiered scoring (exact → prefix → word-prefix → contains → all-terms → fuzzy → field → description); noise filter; tie-breaks |
| **Output** | Ranked results with highlighted matches; dimmed non-matching markers; empty state for no match |
| **Technologies** | Plain JavaScript (no search library), React `useDeferredValue` |
| **Files** | `features/search/searchIndex.js`, `fuzzy.js`, `SearchBar.jsx`, `SearchResults.jsx`, `HighlightedText.jsx`, `CategoryChips.jsx`, `recentSearches.js`, `useSearchTracking.js`; `features/discovery/useDiscoveryState.js` |
| **Key logic** | Non-overlapping score tiers; length-dependent typo allowance (0/1/2) |
| **Limitations** | Only fields in the DB are searchable (no aliases/keywords field); home category chips match raw labels exactly; speech input only in browsers with Web Speech support |

## 4. Location Details

| | |
|---|---|
| **Purpose** | Show everything known about one campus place |
| **Inputs** | `/place/:id`, campus data, user position |
| **Processing** | Look up by id; straight-line distance and time from the user (if located); same-building and nearest places; record a recent view and `PLACE_OPENED` |
| **Output** | Name, category, building, floor, directory note, walking estimate, related places, Save, Route |
| **Files** | `screens/LocationDetailScreen.jsx`, `features/place/LocationDetail.jsx`, `RelatedPlaces.jsx`, `features/discovery/proximity.js` |
| **Key logic** | Outlier places show "Map position is being verified" and cannot be routed |
| **Limitations** | No photos, hours or contact details (not in the data) |

## 5. Route Preview

| | |
|---|---|
| **Purpose** | Preview a walk between two campus points before going |
| **Inputs** | `from` (place id or my location), `to` (place id) |
| **Processing** | Validate endpoints (finite, distinct, ≤ 10 km) → 5-minute cache → Google `Route.computeRoutes` (walking, alternatives) → normalise; on any failure return a labelled direct-line route |
| **Output** | Distance/time, polyline, steps, route options; or the direct-line notice + Try again + Open in Google Maps |
| **Files** | `screens/RoutePreviewScreen.jsx`, `features/route/{routeService,useRoutePreview}.js`, `RouteEndpoints.jsx`, `RouteOptions.jsx`, `RouteSummary.jsx`, `features/navigation/routing/*` |
| **Key logic** | Device origins are re-requested only after 40 m of movement; failures are cached for 20 s only |
| **Limitations** | Routes API not enabled → preview always shows the direct-line estimate today |

## 6. Campus AI

| | |
|---|---|
| **Purpose** | Answer campus questions in natural language |
| **Inputs** | Typed/spoken text; campus data; position (if shared); short conversation context |
| **Processing** | Intent patterns → filler stripping → context/ordinal resolution → category/place/building resolution with the search index → templated, grounded answer → log to `/chat` |
| **Output** | Message, details, place cards, actions (Open, Navigate, Locate), suggestions; navigation opens the route |
| **Technologies** | Plain JavaScript regular expressions; FastAPI `/chat`; PostgreSQL `chat_logs` |
| **Files** | `features/assistant/*` (`assistantIntent.js`, `assistantResolver.js`, `assistantService.js`, `useCampusAssistant.js`, `CampusAssistant.jsx`, `AssistantFab.jsx`); `backend/app/routers/chat.py`, `services/chatbot.py` |
| **Key logic** | Deterministic: the same question with the same data always gives the same answer; honest "I don't have that" for hours/contact/fees |
| **Limitations** | Handles designed phrasings only; English only; no memory beyond the current panel; not a generative model |

## 7. Nearby Discovery

| | |
|---|---|
| **Purpose** | Find useful real places around PCE and attractions in Nagpur |
| **Inputs** | Tab (Around PCE / On campus / Explore Nagpur), chip, query, optional one-shot position |
| **Processing** | Choose source (live Overpass cell cache → snapshot) → remove campus duplicates (< 40 m) → Haversine sort → chip filter → limit 20 |
| **Output** | Lists and map pins with distance; place detail with address, coordinates, OSM source link, Open in Google Maps, Save |
| **Files** | `screens/NearbyScreen.jsx`, `NearbyPlaceScreen.jsx`, `features/nearby/*` |
| **Key logic** | External places are a separate data type (`source: external / nagpur`) and are never written to `locations` |
| **Limitations** | Straight-line distances; OSM coverage and freshness; public API rate limits; no ratings/hours/photos |

## 8. Saved Places

| | |
|---|---|
| **Purpose** | Let users keep places they use often without an account |
| **Inputs** | Save/unsave actions; stored JSON |
| **Processing** | Validate → de-duplicate → v2 JSON in `localStorage`; migrate old formats; sync between tabs via the `storage` event; undo on remove |
| **Output** | Saved list (campus + off-campus), save state on detail screens |
| **Files** | `features/saved/savedPlaces.js`, `SavedPlacesProvider.jsx`, `SaveButton.jsx`, `SavedPlaceRow.jsx`, `screens/SavedScreen.jsx` |
| **Limitations** | Per browser/device; cleared with browser data; max 200 |

## 9. Recent Places

| | |
|---|---|
| **Purpose** | Quick return to recently viewed places and recent search picks |
| **Inputs** | Place opened (detail screens); result chosen from search |
| **Processing** | Move to front, de-duplicate, cap (8 viewed / 5 search picks); ids of deleted places are dropped on read |
| **Output** | "Recent" on home and the Saved screen; clear buttons |
| **Files** | `features/saved/savedPlaces.js` (`pushRecent`, `readRecent`), `features/search/recentSearches.js` |
| **Limitations** | Device-local; recent searches store ids only, never typed text (by design) |

## 10. Navigation

| | |
|---|---|
| **Purpose** | Get the user to the destination |
| **Inputs** | Route result, GPS fixes, destination |
| **Processing** | Today: hand-off to Google Maps (`/maps/dir/?api=1&destination=…&travelmode=walking`). Built but inactive: in-app session with progress matching, off-route detection, rerouting limits, arrival, voice prompts (`speechSynthesis`, `en-IN`) |
| **Output** | External Google Maps navigation; in-app guidance only when a Google route exists |
| **Files** | `screens/NavigationScreen.jsx`, `features/navigation/*`, `hooks/useGeolocation.js` |
| **Limitations** | **Stage 7 is partial by design:** Routes API not enabled, so live in-app navigation cannot start; Google does not know internal footpaths |

## 11. Admin

| | |
|---|---|
| **Purpose** | Maintain the directory and observe the system |
| **Inputs** | Admin token; forms; filters in the URL |
| **Processing** | Lazy-loaded React app; cached resource hooks (`AdminDataProvider`); CRUD via `/locations`; insights via `/admin/insights/*` |
| **Output** | Dashboard, Locations (table, filters, drawer, validated add/edit/delete), Categories, Data health, Search/AI analytics, Place usage, Around PCE / Nagpur, System status |
| **Files** | `frontend/src/admin/*`, `components/LocationFormModal.jsx`; `backend/app/routers/admin_insights.py`, `admin_stats.py`, `locations.py` |
| **Limitations** | One role; no audit log of admin edits; no password change; edits to the DB do not update `locations.json` until `export_locations` is run |

## 12. Data Health

| | |
|---|---|
| **Purpose** | Detect data problems without changing data |
| **Inputs** | `locations` rows, `locations.json`, OSM snapshot |
| **Processing** | See ALGORITHMS §8 |
| **Output** | Status per check, affected ids, suspicious coordinates, variant groups, canonical sync report |
| **Files** | `backend/app/services/data_health.py`, `db/verify_locations.py`; `frontend/src/admin/pages/DataHealthPage.jsx`, `admin/osmHealth.js`, `pages/LocalDiscoveryPage.jsx` |
| **Limitations** | Detects, does not repair; the 3 km radius cannot catch small misplacements |

## 13. Analytics

| | |
|---|---|
| **Purpose** | Show what people search for and ask, and what they open |
| **Inputs** | Anonymous events from `lib/analytics.js`; `chat_logs` |
| **Processing** | Client: whitelist, de-duplicate within 2 s, batch (≤ 20, every 3 s, beacon on page hide), disabled on `/admin` and when Do Not Track is on. Server: validate, rate-limit, normalise search text, drop unknown ids, store. Admin: SQL `GROUP BY` summaries per day (Asia/Kolkata) |
| **Output** | Top searches, zero-result searches, opened/navigated places, nearby opens, AI resolved/unresolved, top AI places, query patterns |
| **Files** | `frontend/src/lib/analytics.js`, `features/search/useSearchTracking.js`; `backend/app/routers/events.py`, `admin_insights.py`, `models/usage_event.py`, `models/chat_log.py` |
| **Limitations** | Short history; in-memory rate limit resets on restart; no charts over long periods; QA traffic is indistinguishable from real use unless removed |

## 14. OSM Integration

| | |
|---|---|
| **Purpose** | Real off-campus places without paid APIs |
| **Inputs** | Overpass QL queries (`aroundQuery`, `nagpurQuery`) |
| **Processing** | POST to `overpass-api.de` with a 12 s timeout → classify by tags → keep named, in-bounds places → de-duplicate (same name + category within ~60 m) → app shape `{ key: osm-n…, name, category, coords, address }` |
| **Output** | External places for Nearby; the same code produced the bundled snapshot |
| **Files** | `features/nearby/providers/osm.js`, `nearbyService.js`, `data/osmSnapshot.json` |
| **Key logic** | Notability filter for Nagpur (parks, landmarks and places of worship need a Wikidata tag); one live request per ~100 m cell per session |
| **Limitations** | Fair-use limits; tags vary by mapper; snapshot dated 2026-09-24; ODbL attribution required (shown) |
