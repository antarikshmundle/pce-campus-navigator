# PCE Campus Navigator — Backend (FastAPI + PostgreSQL)

See the [project README](../README.md) for the full picture and
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for internals.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp — then set DATABASE_URL and SECRET_KEY
```

Create the database once (psql or pgAdmin):
```sql
CREATE DATABASE pce_navigator;
CREATE USER pce_user WITH PASSWORD '<choose-a-password>';
GRANT ALL PRIVILEGES ON DATABASE pce_navigator TO pce_user;
\c pce_navigator
GRANT ALL ON SCHEMA public TO pce_user;   -- PostgreSQL 15+
```

Create tables, load `app/db/data/locations.json` (only if the locations table
is empty, keeping the original ids) and create the `admin` account:
```bash
python -m app.db.seed
```
The seed prints a default admin password. **Change it immediately.** There is
no password-change screen yet; see
[docs/QA_STAGE13.md §4](../docs/QA_STAGE13.md#4-security) for a one-line command.

Run the API:
```bash
uvicorn app.main:app --port 8000        # add --reload while developing
```
Interactive docs: http://localhost:8000/docs

## Data tools (read-only unless stated)

```bash
python -m app.db.verify_locations --links   # outliers, shared coordinates, DB ↔ JSON drift
python -m app.db.export_locations           # WRITES locations.json from the DB (verified round-trip)
```

## Endpoints (`/api/v1`)

| Method | Path | Auth |
|---|---|---|
| GET | `/locations`, `/locations/categories`, `/locations/{id}` | – |
| POST / PATCH / DELETE | `/locations`, `/locations/{id}` | Admin JWT |
| POST | `/auth/login` | – |
| POST | `/chat` (logs to `chat_logs`), `/directions` (legacy) | – |
| POST | `/events` (anonymous usage events) | – |
| GET | `/admin/stats/overview` (legacy) | Admin JWT |
| GET | `/admin/insights/summary`, `/data-health`, `/ai`, `/usage`, `/system` | Admin JWT |

## Tables

`locations`, `admin_users`, `chat_logs`, `usage_events` (created by
`seed.py` / on startup via SQLAlchemy `create_all`; no Alembic migrations yet).
