"""
Read-only accuracy report for the canonical campus locations.

Reads app/db/data/locations.json and — unless --no-db — the live `locations`
table inside a READ ONLY transaction. Nothing is ever written or corrected.

Reports:
  - outliers: places further than --radius metres (default 3000, same rule as
    the map's campus framing) from the median position — likely data-entry errors
  - groups of places sharing identical coordinates (informational: several
    rooms can legitimately share one building position)
  - any difference between locations.json and the database
  - a Google Maps satellite link per place, for manual visual verification

Run with:  python -m app.db.verify_locations [--no-db] [--radius 3000] [--links]
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import median

DATA_FILE = Path(__file__).parent / "data" / "locations.json"
FIELDS = ["id", "name", "category", "latitude", "longitude",
          "building", "floor", "description", "image_url"]
EARTH_RADIUS_M = 6371000


def distance_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def satellite_link(lat, lng):
    # Coordinates printed with repr() so the link uses the exact stored value.
    return f"https://www.google.com/maps/place/{lat!r},{lng!r}/@{lat!r},{lng!r},19z/data=!3m1!1e3"


def read_db():
    from sqlalchemy import text
    from app.db.session import engine
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(text(f"SELECT {', '.join(FIELDS)} FROM locations ORDER BY id")).mappings().all()
    return [{f: row[f] for f in FIELDS} for row in rows]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-db", action="store_true", help="only check locations.json")
    parser.add_argument("--radius", type=float, default=3000, help="outlier radius in metres")
    parser.add_argument("--links", action="store_true", help="print a satellite link for every place")
    args = parser.parse_args()

    records = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"{DATA_FILE.name}: {len(records)} location(s), ids {records[0]['id']}-{records[-1]['id']}")

    if not args.no_db:
        db = read_db()
        if db == records:
            print(f"Database: {len(db)} row(s), identical to {DATA_FILE.name}")
        else:
            by_id = {r["id"]: r for r in db}
            print(f"Database: {len(db)} row(s), DIFFERS from {DATA_FILE.name}:")
            for rec in records:
                live = by_id.pop(rec["id"], None)
                if live is None:
                    print(f"  id {rec['id']}: missing from database")
                elif live != rec:
                    changed = [f for f in FIELDS if live[f] != rec[f]]
                    print(f"  id {rec['id']}: {', '.join(changed)} differ")
            for extra in by_id:
                print(f"  id {extra}: only in database")

    center = (median(r["latitude"] for r in records), median(r["longitude"] for r in records))
    print(f"\nMedian position: {center[0]!r}, {center[1]!r}")

    outliers = [
        (r, distance_m(*center, r["latitude"], r["longitude"]))
        for r in records
        if distance_m(*center, r["latitude"], r["longitude"]) > args.radius
    ]
    print(f"\nOutliers (> {args.radius:.0f} m from median): {len(outliers)}")
    for r, d in outliers:
        print(f"  id {r['id']} {r['name']!r}: {r['latitude']!r}, {r['longitude']!r}  ({d / 1000:.0f} km away)")
        print(f"    verify: {satellite_link(r['latitude'], r['longitude'])}")

    groups = defaultdict(list)
    for r in records:
        groups[(r["latitude"], r["longitude"])].append(r)
    shared = [g for g in groups.values() if len(g) > 1]
    print(f"\nShared coordinates (informational): {len(shared)} group(s)")
    for g in shared:
        print("  " + " | ".join(f"id {r['id']} {r['name'].strip()!r}" for r in g))

    if args.links:
        print("\nSatellite links:")
        for r in records:
            print(f"  id {r['id']:>3} {r['name'].strip():<55} {satellite_link(r['latitude'], r['longitude'])}")


if __name__ == "__main__":
    main()
