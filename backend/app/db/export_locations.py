"""
Exports the live `locations` table to the canonical seed file
(app/db/data/locations.json). Read-only against the database.

The database (edited via the Admin Dashboard) is the source of truth; this
file is a snapshot of it so a fresh database can be seeded identically.
Values are copied verbatim — coordinates are never rounded, and text is never
trimmed or normalized. The written file is read back and compared field-by-field
against the database; nothing is written if any value would not round-trip.

Run with:  python -m app.db.export_locations
"""
import hashlib
import json
from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

DATA_FILE = Path(__file__).parent / "data" / "locations.json"

FIELDS = ["id", "name", "category", "latitude", "longitude",
          "building", "floor", "description", "image_url"]


def export():
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(
            text(f"SELECT {', '.join(FIELDS)} FROM locations ORDER BY id")
        ).mappings().all()

    records = [{f: row[f] for f in FIELDS} for row in rows]
    payload = json.dumps(records, ensure_ascii=False, indent=2) + "\n"

    # Round-trip check: every value must come back identical (floats compared exactly).
    if json.loads(payload) != records:
        raise SystemExit("Round-trip check failed — nothing written.")

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(payload, encoding="utf-8")

    if json.loads(DATA_FILE.read_text(encoding="utf-8")) != records:
        raise SystemExit(f"Read-back check failed for {DATA_FILE}.")

    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    print(f"Exported {len(records)} location(s) to {DATA_FILE}")
    print(f"sha256: {digest}")


if __name__ == "__main__":
    export()
