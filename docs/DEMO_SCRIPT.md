# Final Demo Script (5–7 minutes)

## Before the demo (10 minutes earlier)

1. Start PostgreSQL. On this laptop the Windows service needs admin rights,
   so use:
   `"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\18\data" -l "C:\Program Files\PostgreSQL\18\data\manual-start.log"`
2. Backend: `cd backend && venv\Scripts\activate && uvicorn app.main:app --port 8000`
3. Frontend: `cd frontend && npm run dev`, then open `http://localhost:5173` in Chrome.
4. Optional: clear QA analytics rows ([QA_STAGE13.md §6](QA_STAGE13.md#6-qa-data-added-to-analytics)),
   then do a few real searches and AI questions so analytics have content.
5. Allow location in Chrome if you want "near me" answers (the laptop's position
   may be imprecise; the campus fallback works without it).
6. Have the current admin password ready. The default was changed in Stage 13; don't try the old one live.
7. Keep a second tab on `/admin` already signed in, in case of time pressure.

## Script

| Time | Step | What to do | What to say |
|---|---|---|---|
| 0:00 | 1. Open app | Show the home screen | "This is PCE Campus Navigator, a web app for finding any of our 69 campus places. It works on phones and laptops." |
| 0:20 | 2. Campus map | Zoom and pan; point at clustered markers | "The base map is Google Maps with our own style that hides shops, so only college places show. Markers are grouped when they overlap." |
| 0:40 | 3. Search | Type `libary` (with the typo), then `seminar` | "Search is ranked: exact and prefix names first, and it tolerates small typos in longer words." |
| 1:05 | 4. Location details | Open **Central Library** | "Details come from our database: building, floor, the directory note, and places in the same building or nearby." |
| 1:25 | 5. Route preview | Tap route; choose **PCE Admin Block** as start | "The preview asks Google for a walking route. The Routes API isn't enabled for our project, so it honestly says 'direct-line estimate' and offers **Open in Google Maps** for the real walk. The in-app navigation engine exists but isn't active; I won't claim it is." |
| 1:55 | 6–7. Campus AI | Open **Ask Campus AI**; ask `Where is the AI & DS department?`, then `How far is it from the library?` | "The assistant is rule-based and grounded: it only answers from our records and computes distances from stored coordinates." |
| 2:30 | | Ask `Show sports facilities`, then `the second one`, then `take me there` | "It remembers context: 'the second one' picks from the last list, and 'take me there' opens the route." |
| 2:55 | | Ask `What are the library timings?` | "Timings aren't in our data, so it says so instead of guessing." |
| 3:10 | 8–9. Nearby / Around PCE | Open **Nearby** → **Around PCE** | "Nearby uses OpenStreetMap, which is free and open. These are real places within about 5 km, sorted by straight-line distance." |
| 3:30 | 10. Category filter | Tap **Food**, then **Hospital** | "Categories come from OpenStreetMap tags." |
| 3:45 | 11. Explore Nagpur | Switch to **Explore Nagpur** | "34 city attractions, selected by tags, not by hand." |
| 4:00 | 12. Save a place | Open an OSM place (e.g. a hospital) → **Save**; also save Central Library | "Saving needs no account; it stays in this browser." |
| 4:15 | 13. Saved places | Open **Saved** | "Campus and off-campus places together, plus recently viewed." |
| 4:25 | 14. Profile | Open **Profile** | "Preferences: default map view, voice guidance, motion, and on-device data controls." |
| 4:35 | 15. Satellite | Back to the map → **Satellite** | "Satellite imagery helps check where buildings really are." |
| 4:45 | 16. Admin | Go to `/admin`, sign in | "Admin is a separate, protected area. The server checks a signed token on every request." |
| 5:00 | 17. Data Health | Open **Data health** | "These checks never change data. They report count, id range, spelling variants, suspicious coordinates, and whether the database still matches our canonical file." "In Stage 13 it caught three rows edited after the data was locked; we reviewed them, accepted them, and exported them, so it now shows synchronized." |
| 5:30 | 18. AI / usage analytics | Open **AI analytics**, then **Search analytics** | "Every AI question is logged; unresolved ones show what to improve. Search analytics show zero-result searches, which point to missing places. Nothing personal is stored." |
| 5:55 | 19. OSM data | Open **Around PCE** under Local discovery | "The admin can audit the OpenStreetMap snapshot too: its date, radius, categories and overlaps with campus places." |
| 6:15 | 20. Wrap-up | Show the architecture diagram (README) | "React frontend, FastAPI backend, PostgreSQL; Google Maps for the base map, OpenStreetMap for local discovery. Problem: people can't find places, and public maps don't list them. Solution: an institution-owned, searchable, conversational campus map with data-quality tools. Next steps: enable routing and finish production hardening." |

## Do NOT demonstrate as working
- Live in-app turn-by-turn navigation (`/navigate`), which needs the Routes API.
- Any claim of accuracy percentages or user-study results.
- Id 32's "position being verified" message: its coordinates were corrected in Stage 13, so there are no outliers any more.

## If something fails live
- **Map doesn't load:** the schematic map appears. Say "this is the designed fallback" and continue.
- **Backend down:** the app shows "Check your connection"; restart uvicorn.
- **OSM slow:** Nearby still lists the bundled snapshot.
