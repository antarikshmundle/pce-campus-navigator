"""
One-time setup script:
1. Creates all tables (for quick local dev — use Alembic migrations in production)
2. Seeds campus locations from app/db/data/locations.json — ONLY if the
   locations table is empty. Existing data is never touched.
3. Creates a default admin account (CHANGE THE PASSWORD after first login)

locations.json is the canonical dataset, exported from the live database with
`python -m app.db.export_locations`. Original ids are kept so /place/:id links
stay stable across fresh installs.

Run with:  python -m app.db.seed
"""
import json
from pathlib import Path

from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models.admin_user import AdminUser
from app.models.location import Location

LOCATIONS_FILE = Path(__file__).parent / "data" / "locations.json"

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "changeme123"  # CHANGE THIS after first login


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Location).count()
        if existing:
            print(f"Locations table already has {existing} row(s), skipping location seed.")
        else:
            records = json.loads(LOCATIONS_FILE.read_text(encoding="utf-8"))
            db.add_all(Location(**rec) for rec in records)
            db.flush()
            # Ids were inserted explicitly, so move the sequence past them.
            db.execute(text(
                "SELECT setval(pg_get_serial_sequence('locations', 'id'), "
                "(SELECT MAX(id) FROM locations))"
            ))
            db.commit()
            print(f"Seeded {len(records)} location(s) from {LOCATIONS_FILE.name}.")

        if not db.query(AdminUser).filter(AdminUser.username == DEFAULT_ADMIN_USERNAME).first():
            db.add(AdminUser(
                username=DEFAULT_ADMIN_USERNAME,
                hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
            ))
            db.commit()
            print(f"Created default admin user '{DEFAULT_ADMIN_USERNAME}' "
                  f"(password: '{DEFAULT_ADMIN_PASSWORD}') — change this immediately.")
        else:
            print("Admin user already exists, skipping.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
