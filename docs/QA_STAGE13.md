# Stage 13 — Final QA, Audit and Status

**Date:** 2026-09-30
**Environment:** Windows 11, Python 3.12.10, Node 24.20, PostgreSQL 18
(started manually with `pg_ctl`), Chrome (driven by Playwright,
`playwright-core` in a temporary folder, not a project dependency).
Backend `uvicorn app.main:app --port 8000`, frontend `npm run dev` (5173),
production build checked with `vite build` + `vite preview` (4173).

A database backup was taken before testing:
`backups/20260930-stage13-pre-pce_navigator.dump`.

**Final Stage 13 status: PASS** (2026-09-30). All findings raised during the
Stage 13 audit were resolved and re-verified: the canonical drift on ids
32/53/76 (§3), the default admin password and the Google Maps key
HTTP-referrer restriction (§4.1). Sections 1–2 record the original test
run; items marked *resolved* were fixed after it.

---

## 1. Final regression results

### 1.1 API and security (initial run: 42 checks, 41 pass, 1 fail; the fail is resolved, see §4.1)

| Check | Result |
|---|---|
| `GET /` health | PASS |
| `/locations` returns 69 rows, ids exactly 16–84, no duplicates | PASS |
| `/locations/999` → 404; `/locations/abc` → 422 | PASS |
| `/locations/categories` | PASS (18 raw labels) |
| `/chat` known place / unknown text / oversized field (422) / malformed JSON (422) | PASS |
| `/directions` unknown place → 404 | PASS |
| `/events` bad type, empty batch, > 20 events, bad OSM key → 422 | PASS |
| All 6 admin GET endpoints without token → 401 | PASS |
| Garbage token, expired token, unsigned token → 401 | PASS |
| Tokens signed with old/placeholder keys (`change-this-in-production`, `your-secret-key`, `replace-with-a-long-random-string`) → 401 | PASS |
| Valid signature but unknown user → 401 | PASS |
| POST/PATCH/DELETE `/locations` without token → 401 | PASS |
| Wrong password → 401 | PASS |
| Seed password rejected | Initial run: FAIL (default seed password still logged in). **Resolved:** re-test returns 401 (§4.1) |
| Token lifetime 8 h | PASS |
| All 6 admin endpoints with a valid token → 200 | PASS |
| CORS: foreign origin receives no `Access-Control-Allow-Origin` | PASS |

### 1.2 Running application (Chrome, 1366×768), 65 checks

| # | Flow | Result | Notes |
|---|---|---|---|
| 1 | Home | PASS | Google map rendered, search visible |
| 2 | Search | PASS | "library" ranked; "libary" (typo) found; unknown text → empty state |
| 3 | Campus location detail | PASS | `/place/33` Central Library |
| 4 | Route preview | PASS (by design) | Routes API disabled → "Walking route unavailable. Showing direct-line estimate." (2 min · 140 m direct), **Open in Google Maps** shown, Start navigation disabled with reason |
| 5 | Campus AI | PASS | lookup, "How far is it?" (context), category list, "the second one" → 2nd item, "take me there" → `/route?to=84`, unknown query, "library timings" → honest "don't have opening hours" |
| 6 | Nearby | PASS | loads; On-campus tab; search "hospital" |
| 7 | Around-PCE | PASS | 12 category chips; filter works |
| 8 | Explore Nagpur | PASS | 34 attractions |
| 9 | External place detail | PASS | `osm-n2683203421`, OSM attribution |
| 10 | Saved places | PASS | campus + external saved; v2 format |
| 11 | Recent places | PASS | |
| 12 | Profile | PASS | |
| 13 | Satellite | PASS | hybrid imagery |
| 14 | Admin login | PASS | no session → login; wrong password → error; login succeeds |
| 15 | Admin dashboard | PASS | |
| 16 | Campus locations | PASS | 69 rows |
| 17 | Categories | PASS | |
| 18 | Data health | PASS | Correctly reports **canonical drift** for ids 32, 53, 76 (see §3) |
| 19 | Search analytics | PASS | |
| 20 | AI analytics | PASS | |
| 21 | Place usage | PASS | |
| 22 | Nearby data (admin) | PASS | |
| 23 | Nagpur Explore admin view | PASS | |
| 24 | System status | PASS | Shows the default-password warning |

The one failure in the first automated run ("the second one") was a test
locator error (the label matched two elements); rerun with a precise
locator, the behaviour was correct.

### 1.3 Error states

| Scenario | Result |
|---|---|
| Backend unavailable (502) | PASS: "Check your connection and try again.", no stack trace |
| Network failure (aborted requests) | PASS: no stack trace |
| Google Maps unavailable (blocked) | PASS: schematic map + notice |
| OSM unavailable (Overpass 429) | PASS: snapshot shown, places still listed |
| Location permission denied | PASS: "Location blocked — tap for details"; Nearby explains and uses PCE |
| Invalid location `/place/9999`, `/place/abc` | PASS: "Place not found" |
| Invalid external place `/nearby/place/osm-n1` | PASS |
| Empty / unknown search | PASS |
| Unknown AI query | PASS |
| Unauthorized admin (no token) | PASS: redirected to login |
| Expired admin token | PASS: redirected to login |
| Forged admin token | PASS: server 401 → login |
| Malformed localStorage (bad JSON, hostile entries) | PASS: Saved and Home render |
| Stage 9 v1 saved data | PASS: migrated (2 items) |
| Missing OSM snapshot | Not simulated at run time (the snapshot is bundled at build time, so a missing file fails the build rather than the app). The admin snapshot-health code returns `unavailable` for a missing/invalid snapshot (code-reviewed). |
| Reduced motion | PASS: search and Nearby work |

### 1.4 Responsive QA

Pages: `/`, `/place/33`, `/route`, `/nearby`, `/nearby/place/…`, `/saved`,
`/profile`, `/admin`, `/admin/locations`, `/admin/health`,
`/admin/insights/ai`, `/admin/discovery/nearby`, `/admin/system` at
390×844, 412×915, 768×1024, 1366×768, 1440×900, 1920×1080.

- **Student app: no horizontal overflow at any size.**
- **Fixed during Stage 13:** `/admin/locations` overflowed the page by
  121 px at 768 px and 113 px at 1024 px. Cause: the table's screen-reader
  "Actions" header (`position: absolute`) escaped its `overflow-x-auto`
  wrapper. Fix: `relative` on the wrapper
  (`frontend/src/admin/pages/LocationsPage.jsx`). Re-tested: 0 px overflow
  at 768, 820, 1000, 1023 and 1024 px.
- Small targets: the bottom-sheet handle is 24 px tall but full width;
  admin tables use compact inline id/name links (18–20 px tall). Acceptable
  for a desktop admin tool, and noted.
- Keyboard: search reachable by Tab (after the map's own controls, 15 presses
  on desktop); results selectable with arrow keys + Enter.

---

## 2. Data integrity

| Check | Result |
|---|---|
| `locations` count = 69 | PASS |
| ids = 16–84, no duplicates, no unexpected rows | PASS |
| `locations.json` unchanged | PASS: SHA-256 identical to the 2026-09-24 canonical backup (`0d3976f4…3b91`) |
| No OSM places in `locations` | PASS |
| `usage_events` references only existing places | PASS |
| QA traffic did not modify locations | PASS (latest `updated_at` unchanged) |
| **Database matches `locations.json`** | **FAIL: 3 rows differ (see §3)** |
| ID 32 unchanged | **FAIL in the database** (JSON unchanged) |
| AgriVerse untouched | PASS: its database (`crop_ai_analyzer`) was never connected to |

---

## 3. Canonical drift (ids 32, 53, 76) — RESOLVED 2026-09-30

**Resolution:** the live edits were reviewed and accepted, and
`python -m app.db.export_locations` made them canonical. Only ids 32, 53 and
76 changed (66 rows identical); `verify_locations` reports the database
identical to `locations.json`, with 0 outliers. New `locations.json`
SHA-256: `e5d6020299da8fe4a5eac31499606c897e93443c9713045c319569d28574c46d`
(file on disk, CRLF) / `0500febedb830ea403841856f1b9a2bc31348c2b8bbc897ed8f6cc147fd0b3b7`
(LF content, as printed by the export). Previous file kept at
`backups/20260930-stage13-pre-export-locations.json` (`0d3976f4…3b91`).

The original finding follows for the record.

On **2026-09-30 between 01:23 and 01:25 IST**, after the Stage 11 backup
(which still matched `locations.json`), three rows were edited in the live
database, most likely through the admin dashboard:

| id | Field | `locations.json` / Stage 11 | Database now |
|---|---|---|---|
| 32 PCE IIOT Department | latitude | 21.10187255677898 | 21.101749938973132 |
| 32 | longitude | 21.10187255677898 (known bad) | 79.00756992004821 |
| 32 | floor | `''` | `'2'` |
| 53 PCE First Year Parking | category | `parking` | `Parking` |
| 76 Architecture Parking | category | `parking` | `Parking` |

The new id 32 position is on campus, and the category edits remove a
case variant, so these look like intentional corrections. Stage 13 did
**not** revert or export them. Choose one:

- **Accept the corrections** (make them canonical), after verifying id 32 in
  Satellite view:
  `cd backend && python -m app.db.export_locations && python -m app.db.verify_locations`
- **Restore the locked canonical values**: re-apply the three rows from
  `locations.json` via the admin dashboard, or restore
  `backups/20260929-stage11-pre-pce_navigator.dump`.

Until then, Data Health and System status correctly show
*canonical: not synchronized*. Note: with the corrected coordinates, id 32
is no longer an outlier, so the "Map position is being verified" message
no longer appears for it.

---

## 4. Security

| Item | Status |
|---|---|
| `SECRET_KEY` not a placeholder | PASS: 64 characters, not a known placeholder |
| Real secrets absent from `.env.example` files | PASS: placeholders only |
| Frontend example env uses placeholders | PASS |
| DB password not committed | PASS: only in git-ignored `backend/.env` |
| Admin routes require authentication | PASS |
| Expired / old-key / forged tokens rejected | PASS |
| Unauthorized admin APIs return 401 | PASS |
| Admin password is not the default seed password | **PASS (resolved 2026-09-30).** Initial audit: FAIL, `changeme123` still worked. Changed and verified; see §4.1 |
| Google browser key HTTP-referrer restricted | **PASS (resolved 2026-09-30).** Initial audit: FAIL, the key loaded the Maps API from arbitrary foreign origins. Restriction applied in Google Cloud Console and verified; see §4.1. API restrictions (which Google APIs the key may call) cannot be verified from outside the Console |
| DB role | Hardening recommendation: backend connects as the `postgres` superuser |
| `.gitignore` | Fixed in Stage 13: now excludes `node_modules/`, `frontend/dist/` (which embeds the browser key), `backend/venv/`, `__pycache__/` |
| Login rate limiting | Hardening recommendation: not implemented |

Both security items that blocked a clean Stage 13 pass are resolved. The
remaining rows marked *hardening recommendation* (together with §7 items
16–18) are not blocking for this project; address them before a public
deployment.

### 4.1 Final security re-test (2026-09-30)

Performed after the admin password change and the Google key restriction.
No application code, configuration or location data was changed during the
re-test. No credential, hash, token or key was printed or recorded.

| Check | Result |
|---|---|
| `changeme123` via `POST /auth/login` | **PASS**: HTTP 401 |
| Stored admin hash no longer matches the seed password | **PASS** |
| Stored admin hash differs from the pre-QA backup (`backups/20260930-stage13-pre-pce_navigator.dump`) | **PASS** |
| Password change committed (re-read in a new DB session) against `pce_navigator` | **PASS** |
| Fresh login with the new password | **PASS**: HTTP 200 with a bearer token (verified inside the password-entry process; the password never passed through logs or chat) |
| Admin account present and active; exactly one admin user | **PASS** |
| Wrong password | **PASS**: 401 |
| Garbage, expired, unsigned and unknown-user tokens | **PASS**: 401 each |
| Tokens signed with the three old placeholder keys | **PASS**: 401 each |
| All 6 admin GET endpoints without a token | **PASS**: 401 each |
| POST / PATCH / DELETE `/locations` without a token | **PASS**: 401 each |
| Valid current-key admin token (positive control) | **PASS**: 200 |
| System status `default_admin_password` / `default_secret_key` | **PASS**: both `false`; overall security status `healthy` |
| Maps key from `http://localhost:5173` and `http://127.0.0.1:5173` | **PASS**: API loads |
| Maps key from two foreign origins | **PASS**: blocked with `RefererNotAllowedMapError` |
| Real app on `localhost:5173` | **PASS**: Google map renders, no schematic fallback |
| Data integrity after re-test: DB ↔ `locations.json` identical, 69 rows, ids 16–84, 0 outliers, `locations.json` SHA-256 unchanged (`e5d60202…c46d`) | **PASS** |
| `chat_logs` / `usage_events` unchanged by the re-test (29 / 20 rows) | **PASS** |
| AgriVerse database (`crop_ai_analyzer`) never connected to | **PASS** |

Procedure used to change the admin password (no UI exists; the new
password is typed at a hidden prompt and is not echoed):

```bash
cd backend
python -c "import getpass; from app.db.session import SessionLocal; from app.models.admin_user import AdminUser; from app.core.security import hash_password; db=SessionLocal(); a=db.query(AdminUser).filter_by(username='admin').one(); a.hashed_password=hash_password(getpass.getpass('New admin password: ')); db.commit(); print('updated')"
```

For the actual change, the same steps ran in a separate console window with
two safety checks added: confirm the connected database is `pce_navigator`,
and require the password twice.

Key restriction path (applied): Google Cloud Console → Credentials → the browser key →
Application restrictions: *Websites* (`http://localhost:5173/*`,
`http://127.0.0.1:5173/*`, and the production origin) → API restrictions:
*Maps JavaScript API* (+ *Routes API* if enabled).

---

## 5. Performance

| Item | Finding |
|---|---|
| Production build | Succeeds (`vite build`, 2441 modules, 5.4 s) |
| Main chunk | 512 kB minified / **164 kB gzip** (Vite warns > 500 kB). Largest contributors: framer-motion/motion-dom, app code, React Router, react-dom |
| Lazy chunks | AdminApp 87 kB, NearbyScreen 11 kB, NearbyPlaceScreen 5 kB, osmSnapshot 17 kB, Google engine 21 kB, markerIcons 70 kB, googleRouteService 2 kB |
| Admin lazy-loaded | Yes: never downloaded by the student app |
| Nearby lazy-loaded | Yes, including the OSM snapshot |
| CSS | 35 kB / 7 kB gzip |
| Images/assets | None bundled (`public/` empty; icons are SVG components) |
| Duplicate API calls | None in production: one `/locations` + one `/locations/categories` per page load (dev doubles them because of React StrictMode) |
| Map re-renders | One persistent map instance across map screens |
| Unused dependencies | Frontend: none. Backend: `alembic`, `python-multipart` unused (not removed) |
| Console errors (normal use) | Only the browser's automatic `/favicon.ico` 404 (no favicon in the project) |
| Console warnings (dev only) | React Router v7 future-flag warnings; in headless Chrome only, "Vector Map failed, falling back to Raster" (no GPU) |

No optimisation was made: the bundle is acceptable for this project, and
reducing framer-motion would mean rewriting the sheet/animation layer.

---

## 6. QA data added to analytics

Stage 13 testing created **14 `chat_logs` rows (ids > 15)** and **20
`usage_events` rows** (the table was empty before). To remove them before a
demo so analytics show only real usage:

```sql
DELETE FROM chat_logs WHERE id > 15;
DELETE FROM usage_events;   -- all current rows were created by Stage 13 QA
```

---

## 7. Final known limitations

**Configuration / external services**
1. Google Maps requires a billing-enabled project and a valid key; without it the schematic map is used.
2. Google Routes API is not enabled, so there is no Google walking route and no in-app live navigation; a labelled direct-line estimate and Open in Google Maps are used instead (Stage 7 partial by design).
3. Google's walking data does not include internal campus footpaths.
4. The public Overpass API has fair-use rate limits; OSM coverage varies; the bundled snapshot is dated 2026-09-24.

**Functional**
5. Nearby and Campus AI distances are straight-line (Haversine), not walking distance.
6. Saved and recent places are device/browser-local; no sync, lost when site data is cleared.
7. Campus AI is rule-based (no external LLM); it understands designed phrasings only, English only.
8. No opening hours, contact details, photos or events in the data.
9. Analytics history is short (since Stage 11), anonymous, and includes QA traffic unless removed (§6).
10. Single admin role, no password-change UI, no audit log of admin edits.
11. Keyboard users reach search after the map's own focusable controls on desktop.

**Engineering**
12. No automated test suite in the repository; no CI.
13. No database migrations (Alembic unused); schema via `create_all`.
14. No deployment configuration (Docker/hosting, production CORS/proxy, HTTPS).
15. Main JS chunk 164 kB gzip.

**Security**
16. ~~Default seeded admin password still valid~~: resolved and verified (§4.1). Fresh installations still seed a default password that must be changed after setup.
17. ~~Google browser key not referrer-restricted~~: resolved and verified (§4.1). API restrictions are not externally verifiable.
18. Hardening recommendations (not blocking): backend uses the PostgreSQL superuser; no login rate limiting; admin JWT in `localStorage`; no password-change UI.

**Data**
19. ~~Database and `locations.json` out of sync for ids 32, 53, 76~~: resolved (§3). Id 32 is now the only row with a `floor` value; others keep floor details in the description.

---

## 8. Remaining manual checks

1. In a normal (GPU) Chrome window: confirm the vector Map ID styling hides POIs (headless Chrome fell back to raster, where POIs show).
2. On a phone on campus: location accuracy, "near me" answers, Nearby live lookup.
3. ~~Google Cloud Console: add referrer restrictions~~: done and verified (§4.1). Still to confirm in the Console: API restrictions and budget alerts.
4. ~~Change the admin password~~: done and verified (§4.1).
5. ~~Decide the id 32/53/76 question~~: accepted and exported (§3). Optionally confirm id 32's position in Satellite view.
6. Optionally clear QA analytics (§6).
7. Voice input and voice guidance in a real browser with a microphone/speaker.
8. Screen-reader spot check (NVDA/TalkBack) of search, sheet and assistant.

---

## 9. Files changed in Stage 13

| File | Change |
|---|---|
| `frontend/src/admin/pages/LocationsPage.jsx` | `relative` on the table scroller (responsive overflow fix) |
| `.gitignore` | Ignore dependency and build folders |
| `README.md` | Rewritten |
| `backend/README.md` | Updated to the current API |
| `docs/*.md` | New: ARCHITECTURE, MODULES, TECHNOLOGY, ALGORITHMS, QA_STAGE13, REPORT_OUTLINE, VIVA, RESEARCH_BACKGROUND, DEMO_SCRIPT |

No APIs or Google/OSM architecture were changed. Data and security
operations performed at the owner's request after review:

| Operation | Effect |
|---|---|
| `python -m app.db.export_locations` | `locations.json` updated for ids 32, 53, 76 only (§3); previous file in `backups/20260930-stage13-pre-export-locations.json` |
| Admin password change | `admin_users.hashed_password` for `admin` only (§4.1) |
| Google key restriction | Applied by the owner in Google Cloud Console (no project file changed) |
| Documentation | QA, README, MODULES, VIVA, REPORT_OUTLINE and DEMO_SCRIPT updated to the final verified state |

---

## 10. Final project status

| Stage | Status | Important notes |
|---|---|---|
| 1–4 | Completed (historical) | Foundation: full-stack rebuild from the pywebview kiosk, FastAPI + PostgreSQL, React/Tailwind shell, admin CRUD. Statuses were not recorded in the Stage 13 brief; not re-graded |
| 5 | Completed (historical) | Ranked campus search (tiers, typo tolerance), in use and verified in Stage 13 |
| 5.5 | PASS / LOCKED | 69 canonical locations, ids 16–84, `locations.json` canonical; reviewed corrections to ids 32/53/76 exported 2026-09-30, DB and JSON synchronized |
| 6 | PASS / LOCKED | Google Maps JS API, Map ID, styling, satellite |
| 7 | PARTIAL BY DESIGN | In-app navigation built; Routes API not enabled; external Google Maps navigation used |
| 8 | PASS / LOCKED | Deterministic Campus AI |
| 9 | PASS / LOCKED | Saved, Recent, Profile; v1 → v2 migration verified |
| 10 | PASS / LOCKED | Nearby & local discovery: 69 campus, 71 Around-PCE, 34 Nagpur; live OSM + snapshot fallback verified |
| 11 | PASS WITH ONE DEFERRED SECURITY ITEM | Admin intelligence verified. The deferred seed-password item was resolved and verified on 2026-09-30 during Stage 13 (§4.1); the historical Stage 11 status is kept as recorded |
| 12 | **NOT COMPLETED** | Status as assessed at the Stage 13 audit: no production-hardening changes had been made. The two items that blocked Stage 13 (default admin password, unrestricted browser key) were resolved and verified during Stage 13 (§4.1). Other hardening work remains open: password-change flow, login rate limiting, deployment config, least-privilege DB role |
| 13 | **PASS** | QA run in the live app; no critical functional regression; all Stage 13 findings resolved and re-verified: canonical drift on ids 32/53/76 (§3), default admin password changed, Google key referrer restriction (§4.1); documentation, architecture and viva preparation complete |
