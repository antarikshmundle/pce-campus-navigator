# Project Report — Outline and Ready Content

Title: **PCE Campus Navigator: A Map-Based Smart Campus Navigation and
Context-Aware Local Discovery System**

Everything below matches the implemented system. No accuracy percentages or
performance figures are claimed beyond what was measured (see
[QA_STAGE13.md](QA_STAGE13.md)).

---

## 1. Abstract
Finding departments, labs, seminar halls and facilities on a large
multi-building campus is difficult for new students and visitors, and
general-purpose map applications do not list internal campus places. This
project presents PCE Campus Navigator, a web application built with React,
FastAPI and PostgreSQL that places the 69 canonical locations of
Priyadarshini College of Engineering, Nagpur on a Google Maps base map. It
provides ranked, typo-tolerant search, place details with straight-line
walking estimates, route preview with hand-off to Google Maps, and a
deterministic "Campus AI" assistant that answers natural-language
questions only from stored records and resolves follow-up questions using
conversational context. A Nearby module adds real off-campus places from
OpenStreetMap (live Overpass queries with a bundled snapshot fallback),
kept separate from campus data. Saved and recent places are stored on the
device without user accounts. A JWT-protected admin dashboard supports
data maintenance, read-only data-health auditing against a canonical
dataset, and anonymous search and assistant analytics. The system was
tested end-to-end in the running application, including failure scenarios
and six screen sizes.

## 2. Introduction
- Campuses as small cities; wayfinding as a daily need (orientation week, exams, visitors, events).
- Growth of location-based services and map APIs in browsers and phones.
- Aim: an institution-owned, accurate, searchable campus map with a conversational interface.
- Report organisation.

## 3. Problem Statement
(Use README "Problem statement".) Key point: the gap between how people
name places and how they are recorded, the absence of internal places in
public maps, and the lack of any feedback loop for administrators.

## 4. Existing System
- The original PCE app: a pywebview desktop kiosk with a hard-coded location dictionary and substring matching (`if location in speech_input`), naive Euclidean distance on latitude/longitude.
- Printed/board maps and verbal directions.
- Google Maps / OpenStreetMap public apps.

## 5. Limitations of the Existing System
- Kiosk only; no mobile access.
- Data hard-coded in source; any change needs a developer.
- Brittle matching (exact substrings); no typo tolerance.
- Incorrect distance formula.
- Public maps lack internal places and mix in commercial POIs.
- No analytics, no data validation.

## 6. Proposed System
Web app (mobile + desktop) with database-backed locations, admin
management, ranked search, grounded assistant, local discovery, device-local
personalisation and admin intelligence. Diagram: ARCHITECTURE §1.

## 7. Objectives
(README "Objectives", 7 items.)

## 8. Scope
- **In scope:** 69 PCE campus places; outdoor positions; straight-line estimates; Google Maps hand-off for walking; OSM places within 5 km (Around PCE) and Nagpur attractions; single admin role; English.
- **Out of scope (current):** indoor floor maps, in-app turn-by-turn routing (Routes API not enabled), user accounts, opening hours/events, multilingual support.

## 9. Functional Requirements
FR1 Display campus places on a map with Map/Satellite views.
FR2 Search places by name, category, building, floor, description, tolerating small typos.
FR3 Show place details and related places.
FR4 Estimate straight-line distance and walking time from the user or another place.
FR5 Preview a route and open walking navigation in Google Maps.
FR6 Answer natural-language campus questions, including follow-ups.
FR7 List nearby off-campus places by category, with live lookup and offline fallback.
FR8 Save/unsave places and show recently viewed places.
FR9 Admin sign-in; add/edit/delete locations with validation.
FR10 Data-health report and canonical-dataset comparison.
FR11 Anonymous search, place-usage and assistant analytics.
FR12 System status (DB, sync, AI, events, security flags).

## 10. Non-functional Requirements
- **Usability:** mobile-first bottom sheet, desktop panel; keyboard support; reduced-motion support.
- **Responsiveness:** no horizontal overflow from 390 px to 1920 px (verified).
- **Reliability:** graceful fallbacks (schematic map, direct-line estimate, OSM snapshot, empty storage).
- **Security:** bcrypt, JWT expiry, 401 on all admin APIs, secrets in env files, input validation (Pydantic).
- **Privacy:** no accounts; analytics store no identity, device, IP or position; Do Not Track honoured.
- **Maintainability:** feature-based modules, pure functions for logic, single canonical dataset.
- **Performance:** code-split admin and Nearby; one persistent map; 164 kB gzip main bundle (measured).
- **Cost:** OSM for local discovery (no billing); Google usage limited by caching.

## 11. System Architecture
ARCHITECTURE §1 diagram + "who talks to whom" table; three tiers
(client, API, database) + two external services.

## 12. Technology Stack
Table from README; justification from TECHNOLOGY.md.

## 13. Database Design
Four tables (ARCHITECTURE §4). ER note: no foreign keys from analytics to
locations, by design (history survives deletions). Canonical JSON snapshot
and the seed/export/verify cycle.

## 14. Module Design
14 modules from MODULES.md (one table or diagram each).

## 15. Implementation
- Frontend structure (features/screens/ui); persistent map layout; URL state.
- Backend structure (routers/services/models/schemas/core).
- Key screens (screenshots: home, search, detail, route fallback, AI, Nearby, Saved, admin health).
- Environment configuration and setup steps (README).

## 16. Campus AI
Intent families, filler stripping, resolution through the search index,
context object and follow-ups, grounded templates, logging to `chat_logs`
(ALGORITHMS §5–6). Discuss why deterministic rather than an LLM (predictable, no hallucinated places, offline-capable, no cost).

## 17. Map Integration
Google Maps JS API loader, Map ID styling, Advanced Markers, clustering,
outlier handling, satellite, schematic fallback; Routes API integration
and its current fallback.

## 18. Nearby Discovery
OSM data model, Overpass queries, tag classification, notability filter,
snapshot + live strategy, de-duplication against campus places, distance
sorting, category chips, attribution.

## 19. Admin Dashboard
Pages and what each shows; data-health checks; canonical audit; analytics
queries; system status; read-only principle.

## 20. Security
Authentication flow, token validation cases tested, secret handling,
input validation, CORS, anonymous analytics. **Report honestly:** the Stage 13
audit found the default admin password still active and the browser key
unrestricted; both were fixed and re-verified (QA_STAGE13 §4.1). Remaining
hardening recommendations: least-privilege DB role, login rate limiting.

## 21. Testing
Method: API script + browser automation (Playwright/Chrome) against the
running app; test tables from QA_STAGE13 §1 (API 41/42 in the initial
run, UI flows, error states, responsive sweep) and the final security
re-test (§4.1); the defects found and fixed (admin table overflow, default
admin password, unrestricted key). State clearly that there is no automated unit-test suite in the
repository.

## 22. Results
- All 24 functional flows work in the running application.
- All tested failure scenarios degrade gracefully without stack traces.
- 69/69 locations served; ids 16–84 intact; database and canonical JSON
  identical after the reviewed corrections to ids 32, 53, 76.
- Screenshots of each module.
- All Stage 13 findings resolved and re-verified; final Stage 13 status: PASS.
(No accuracy/latency percentages, since none were measured.)

## 23. Limitations
QA_STAGE13 §7.

## 24. Future Scope
README "Future scope".

## 25. Conclusion
The project replaces a hard-coded kiosk with a maintainable, web-based
campus navigator whose answers are always traceable to institution-owned
data, combines a commercial base map with open data for local discovery,
and gives administrators visibility into data quality and user needs.
The remaining work is operational hardening (credentials, key restrictions,
deployment) and enabling routing.

## 26. References
Use [RESEARCH_BACKGROUND.md § References](RESEARCH_BACKGROUND.md#references):
research papers (verified), official documentation, and project sources,
listed separately.
