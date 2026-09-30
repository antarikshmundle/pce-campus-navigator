# Research Background: Smart Campus Navigation and Context-Aware Local Discovery

This is background material for a review/research paper or the report's
literature chapter. **Citation rules used here:**

- **[R#] Research papers:** each was checked against a publisher or index
  record (title, authors, venue, year, pages/DOI) on 2026-09-30.
- **[D#] Official documentation:** vendor or project documentation, used
  only to describe how a technology works.
- **[P#] Project sources:** this repository.

No paper is cited for a claim it does not make. Where a statement is our
own observation, no citation is attached. Before submission, re-check each
reference in your institution's required style and read the parts you cite.

---

## 1. Smart campus systems

A "smart campus" applies networked digital services (connectivity,
sensing, data platforms and user-facing applications) to how a university
operates and how people experience it. Min-Allah and Alrashed [R1] observe
that no generic model of a smart campus exists, and they propose a set of
essential initiatives prioritised by infrastructure needs, emphasising a
human-centred approach with feedback from students, faculty and staff.

Wayfinding is one of the most direct student-facing services such a
platform can offer. PCE Campus Navigator is a small, concrete instance: an
institution-owned directory of 69 places, exposed through a map, search
and a conversational interface, with an admin feedback loop (zero-result
searches, unresolved assistant queries) that matches the participatory
feedback emphasis in [R1] [P1].

## 2. Indoor and outdoor campus navigation

Outdoor navigation relies on satellite positioning (GNSS) available in
phones and exposed to web apps through the browser Geolocation API [D5].
Indoors, satellite signals are weak, and dedicated techniques are needed.
Zafari, Gkelias and Leung [R2] survey indoor localisation techniques
(angle of arrival, time of flight, received signal strength) and
technologies (Wi-Fi, RFID, UWB, Bluetooth), which shows that indoor
positioning requires infrastructure or fingerprinting beyond what a
standard web app has.

Our system is deliberately **outdoor-only**: positions are building-level
coordinates, and indoor detail is given as text (building and floor).
Turn-by-turn outdoor walking is delegated to Google Maps. The in-app
navigation engine (progress matching, off-route detection) is implemented
but depends on the Google Routes API [D2], which is not enabled [P2].

## 3. Location-based services (LBS)

Raper, Gartner, Karimi and Rizos [R3] survey LBS as a multidisciplinary
field that spans positioning, geographic information science, mobile
cartography, spatial cognition and interfaces, along with business, legal,
social and ethical aspects. Two of those aspects shaped this project's
design:

- **Interface and cognition:** answers are expressed as named places, a
  building/floor, and an approximate distance clearly labelled "straight
  line", rather than raw coordinates.
- **Ethics and privacy:** position is requested only on a user action,
  never sent to our server, and analytics store no identity or location [P3].

## 4. GIS and map-based applications

Web mapping APIs let applications combine a professionally maintained base
map with their own data layers. Our base layer is the Google Maps
JavaScript API with a Map ID and cloud styling that hides commercial points
of interest, so the institution's own places dominate [D1]. The campus
layer is our PostgreSQL data rendered as clustered markers. Distances use
the Haversine great-circle formula [D6], and a median-based centre
identifies coordinate outliers, a simple robust-statistics technique used
here for data-quality flagging (our design) [P4].

## 5. Context-aware systems

Schilit, Adams and Want [R4] define context-aware computing as systems that
examine and react to an individual's changing context, and they describe
four application categories. These include *proximate selection* (nearby
objects emphasised) and *contextual information and commands*. Dey [R5]
gives an operational definition of context as information that
characterises the situation of an entity relevant to the interaction.

In this project, context appears in two forms:
1. **Physical context:** the user's position (when shared) re-ranks search
   ties by proximity and answers "near me" and "how far" questions,
   an instance of proximate selection [R4].
2. **Conversational context:** the assistant keeps the last focused place,
   the last list and pending clarification options to resolve "it", "the
   second one" and short replies [P5].

## 6. Conversational interfaces

Natural-language interfaces to computers date back at least to ELIZA
[R6], a rule/pattern-based program that made certain kinds of
natural-language conversation with a computer possible. Modern assistants
often use large language models, which can produce fluent but unsupported
statements. For a campus directory, where a wrong room is worse than "I
don't know", we chose a pattern-based design in the ELIZA tradition, with
responses grounded in database records (our design rationale) [P5].

## 7. Rule-based intelligent assistants

Our assistant combines:
- intent detection through ordered regular-expression families;
- slot extraction by removing filler words;
- entity resolution through a ranked, typo-tolerant search index. Typo
  tolerance uses an edit distance that counts insertions, deletions,
  substitutions and adjacent transpositions, the error classes identified by
  Damerau [R7];
- clarification dialogue when results tie;
- explicit refusals when the data lacks the requested attribute (hours,
  contact, fees).

The trade-off is coverage: it handles the phrasings it was designed for.
The admin AI analytics (resolved/unresolved queries from `chat_logs`) are
the mechanism for extending it based on real questions [P6].

## 8. Local discovery systems

Local discovery helps users find nearby services (food, transport, health,
banking) around a point. Commercial place APIs provide rich data but need
billing and have licence restrictions. This project uses open data
instead: OpenStreetMap queried through the Overpass API [D3][D4], with
places classified by OSM tags, a notability filter for city attractions
(Wikidata tag required for parks, landmarks and places of worship),
de-duplication against campus places, and a bundled snapshot as an offline
and rate-limit fallback [P7].

## 9. OpenStreetMap

Haklay and Weber [R8] describe OpenStreetMap as a user-generated street map
made possible by affordable GPS devices and free access to satellite
positioning, and they analyse its collection techniques, opportunities and
challenges. Goodchild [R9] places such projects within *volunteered
geographic information*, with citizens acting as sensors. Both suggest
why OSM coverage can be rich in some areas and sparse in others, which
matches what we observed around PCE (71 useful named places within the
query radius at the snapshot date) and is listed as a limitation [P2].
OSM data is licensed under the ODbL, which requires attribution; the app
shows "© OpenStreetMap contributors" [D4].

## 10. Digital campus platforms

Beyond navigation, digital campus platforms centralise institutional data
and expose it through services. Our admin module is a small example: it
maintains a canonical dataset (`locations.json` ↔ database), audits data
quality read-only, and turns anonymous usage into actionable signals, such
as searches with no results pointing to missing places [P6]. This data-ownership
model connects to the human-centred, feedback-driven smart campus in [R1].

## 11. Positioning of this project (summary for a paper)

| Dimension | This project |
|---|---|
| Space | Outdoor, building-level; indoor via text (building, floor) |
| Base map | Commercial (Google Maps JS API) with custom styling |
| Local data | Institution-owned relational database + canonical JSON |
| Off-campus data | Open (OSM / Overpass), snapshot + live |
| Interaction | Map, ranked search, rule-based conversational assistant |
| Context | Position (on demand), conversational context |
| Routing | Hand-off to Google Maps; in-app engine built, inactive |
| Privacy | No accounts, device-local personalisation, anonymous analytics |
| Evaluation | Functional, failure-mode and responsive testing; **no user study or accuracy measurement yet** |

A research paper should present evaluation honestly: the present work
contains system testing, not a user study. A natural next study would
measure task completion time and success for wayfinding tasks with and
without the app, and the assistant's resolution rate over real queries.

---

## References

### Research papers (verified)

- **[R1]** N. Min-Allah and S. Alrashed, "Smart campus—A sketch," *Sustainable Cities and Society*, vol. 59, Art. 102231, Aug. 2020. https://www.sciencedirect.com/science/article/pii/S2210670720302183
- **[R2]** F. Zafari, A. Gkelias and K. K. Leung, "A Survey of Indoor Localization Systems and Technologies," *IEEE Communications Surveys & Tutorials*, vol. 21, no. 3, pp. 2568–2599, 2019. doi:10.1109/COMST.2019.2911558
- **[R3]** J. Raper, G. Gartner, H. Karimi and C. Rizos, "A critical evaluation of location based services and their potential," *Journal of Location Based Services*, vol. 1, no. 1, pp. 5–45, 2007. doi:10.1080/17489720701584069
- **[R4]** B. Schilit, N. Adams and R. Want, "Context-Aware Computing Applications," in *Proc. 1994 First Workshop on Mobile Computing Systems and Applications (WMCSA)*, pp. 85–90, 1994. doi:10.1109/WMCSA.1994.16
- **[R5]** A. K. Dey, "Understanding and Using Context," *Personal and Ubiquitous Computing*, vol. 5, no. 1, pp. 4–7, 2001. doi:10.1007/s007790170019
- **[R6]** J. Weizenbaum, "ELIZA—a computer program for the study of natural language communication between man and machine," *Communications of the ACM*, vol. 9, no. 1, pp. 36–45, 1966. doi:10.1145/365153.365168
- **[R7]** F. J. Damerau, "A technique for computer detection and correction of spelling errors," *Communications of the ACM*, vol. 7, no. 3, pp. 171–176, 1964. doi:10.1145/363958.363994
- **[R8]** M. Haklay and P. Weber, "OpenStreetMap: User-Generated Street Maps," *IEEE Pervasive Computing*, vol. 7, no. 4, pp. 12–18, 2008. doi:10.1109/MPRV.2008.80
- **[R9]** M. F. Goodchild, "Citizens as sensors: the world of volunteered geography," *GeoJournal*, vol. 69, pp. 211–221, 2007. doi:10.1007/s10708-007-9111-y

### Official documentation

- **[D1]** Google, *Maps JavaScript API* documentation (Map IDs, cloud-based map styling, Advanced Markers). https://developers.google.com/maps/documentation/javascript
- **[D2]** Google, *Routes API* documentation. https://developers.google.com/maps/documentation/routes
- **[D3]** OpenStreetMap Wiki, *Overpass API*. https://wiki.openstreetmap.org/wiki/Overpass_API
- **[D4]** OpenStreetMap Foundation, *Copyright and License* (ODbL, attribution). https://www.openstreetmap.org/copyright
- **[D5]** MDN Web Docs, *Geolocation API*. https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- **[D6]** Haversine formula: see e.g. MDN/general geodesy references; the formula as implemented is given in [ALGORITHMS.md §2](ALGORITHMS.md). *(If a formal citation is required, use a geodesy textbook your guide approves; not verified here.)*
- **[D7]** FastAPI documentation. https://fastapi.tiangolo.com
- **[D8]** React documentation. https://react.dev
- **[D9]** PostgreSQL documentation. https://www.postgresql.org/docs/
- **[D10]** M. Jones, J. Bradley and N. Sakimura, *JSON Web Token (JWT)*, RFC 7519, IETF, 2015. https://www.rfc-editor.org/rfc/rfc7519

### Project sources

- **[P1]** Admin analytics: `backend/app/routers/admin_insights.py`, `frontend/src/admin/pages/*`
- **[P2]** Stage 13 QA report and limitations: `docs/QA_STAGE13.md`
- **[P3]** Privacy design: `frontend/src/lib/analytics.js`, `backend/app/routers/events.py`, `frontend/src/features/nearby/useNearbyPlaces.js`
- **[P4]** Map and outlier logic: `frontend/src/features/map/geojson.js`, `backend/app/services/data_health.py`
- **[P5]** Campus AI: `frontend/src/features/assistant/*`
- **[P6]** Data health and canonical audit: `backend/app/services/data_health.py`
- **[P7]** OSM provider and snapshot: `frontend/src/features/nearby/providers/osm.js`, `frontend/src/features/nearby/data/osmSnapshot.json`
