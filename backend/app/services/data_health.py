"""
Read-only data-quality checks for the canonical campus locations (Stage 11).

Everything here is a pure function over plain dicts: the admin endpoints pass
database rows and the parsed locations.json, and get back observations.
Nothing is ever corrected, normalized or written — the admin reviews and
fixes records by hand.

Severity per check (worst wins for the overall status):
  warning       something is broken: wrong count/ids, invalid coordinates,
                missing names, database out of sync with locations.json
  needs_review  a human should verify: far-off coordinates, category variants,
                stray whitespace
  info          worth knowing, not a defect: shared coordinates, optional
                fields left empty
"""
import json
import math
import re
from collections import defaultdict
from pathlib import Path
from statistics import median

CANONICAL_FILE = Path(__file__).resolve().parent.parent / "db" / "data" / "locations.json"
FIELDS = ["id", "name", "category", "latitude", "longitude",
          "building", "floor", "description", "image_url"]

EXPECTED_COUNT = 69
EXPECTED_IDS = range(16, 85)  # 16–84
# Same rule as the map's campus framing (frontend mapConfig.outlierRadiusM)
# and app/db/verify_locations.py.
OUTLIER_RADIUS_M = 3000
EARTH_RADIUS_M = 6371000

STATUS_RANK = {"healthy": 0, "info": 0, "needs_review": 1, "warning": 2, "unavailable": 3}


def worst(*statuses):
    return max(statuses, key=lambda s: STATUS_RANK[s]) if statuses else "healthy"


def distance_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def load_canonical():
    """→ (records, error). Error is a short message, never a traceback."""
    try:
        records = json.loads(CANONICAL_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, "locations.json not found"
    except (OSError, ValueError) as exc:
        return None, f"locations.json could not be read ({type(exc).__name__})"
    if not isinstance(records, list):
        return None, "locations.json is not a list of records"
    return records, None


def _blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def _valid_coord(lat, lng):
    ok = lambda v, lim: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and -lim <= v <= lim
    return ok(lat, 90) and ok(lng, 180) and not (lat == 0 and lng == 0)


# --- Label variants (categories, buildings) ---------------------------------

def _label_key(label):
    """Case/spacing-insensitive key: 'Food ' / 'food' → 'food'."""
    return re.sub(r"\s+", " ", label).strip().casefold()


def _stem(key):
    # 'sports' / 'sport' → 'sport'; deliberately crude, only used to *suggest* a review.
    return key[:-1] if len(key) > 3 and key.endswith("s") else key


def _similar(a, b):
    """Two different normalized labels that probably name the same thing."""
    if _stem(a) == _stem(b):
        return "singular/plural"
    short, long_ = sorted((a, b), key=len)
    if len(short) >= 4 and long_.startswith(short):
        return "one label extends the other"
    shared = 0
    for x, y in zip(a, b):
        if x != y:
            break
        shared += 1
    if shared >= 4 and shared >= min(len(a), len(b)) - 4:
        return "same stem"
    return None


def label_analysis(rows, field):
    """
    Distinct raw labels of `field` with their location ids, plus groups of
    labels that are possibly the same (whitespace, case, plural, shared stem).
    Groups are suggestions for manual review — nothing is merged.
    """
    raw = defaultdict(list)
    for r in rows:
        value = r.get(field)
        if not _blank(value):
            raw[value].append(r["id"])

    by_key = defaultdict(list)
    for label in raw:
        by_key[_label_key(label)].append(label)

    # Union keys that are similar to each other.
    keys = sorted(by_key)
    parent = {k: k for k in keys}

    def find(k):
        while parent[k] != k:
            k = parent[k]
        return k

    reasons = defaultdict(set)
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            why = _similar(a, b)
            if why:
                ra, rb = find(a), find(b)
                if ra != rb:
                    parent[rb] = ra
                reasons[find(a)].add(why)

    clusters = defaultdict(list)
    for k in keys:
        clusters[find(k)].append(k)

    variant_groups = []
    for root, members in clusters.items():
        labels = sorted(label for k in members for label in by_key[k])
        if len(labels) < 2:
            continue
        why = set(reasons[root])
        if any(len(by_key[k]) > 1 for k in members):
            variant_labels = [l for k in members for l in by_key[k]]
            if any(l != l.strip() for l in variant_labels):
                why.add("trailing/leading whitespace")
            if len({l.strip() for l in variant_labels}) > len({l.strip().casefold() for l in variant_labels}):
                why.add("letter case")
        variant_groups.append({
            "labels": [{"label": l, "count": len(raw[l]), "ids": sorted(raw[l])} for l in labels],
            "reasons": sorted(why),
            "total": sum(len(raw[l]) for l in labels),
        })
    variant_groups.sort(key=lambda g: -g["total"])

    labels = sorted(
        ({"label": l, "count": len(ids), "ids": sorted(ids), "whitespace": l != l.strip()} for l, ids in raw.items()),
        key=lambda x: (-x["count"], x["label"].casefold()),
    )
    return {
        "distinct": len(raw),
        "distinct_normalized": len(by_key),
        "labels": labels,
        "variant_groups": variant_groups,
        "missing_ids": sorted(r["id"] for r in rows if _blank(r.get(field))),
    }


# --- Location checks --------------------------------------------------------

def check_locations(rows):
    """Data-quality checks over location rows (dicts with FIELDS)."""
    ids = [r["id"] for r in rows]
    id_set = set(ids)
    flags = defaultdict(list)  # id → [flag codes] for the admin table

    def check(code, title, status, affected, detail, expected=None):
        return {"code": code, "title": title, "status": status if affected else "healthy",
                "affected_ids": sorted(set(affected)), "detail": detail, "expected": expected}

    checks = []

    # A. Count
    count_ok = len(rows) == EXPECTED_COUNT
    checks.append({"code": "count", "title": "Total count", "status": "healthy" if count_ok else "warning",
                   "affected_ids": [], "detail": f"{len(rows)} location(s)", "expected": str(EXPECTED_COUNT)})

    # B. ID integrity
    expected = set(EXPECTED_IDS)
    missing, unexpected = sorted(expected - id_set), sorted(id_set - expected)
    id_detail = "All ids present" if not (missing or unexpected) else \
        "; ".join(filter(None, [missing and f"missing {missing}", unexpected and f"unexpected {unexpected}"]))
    checks.append({"code": "id_range", "title": "ID integrity",
                   "status": "healthy" if not (missing or unexpected) else "warning",
                   "affected_ids": unexpected, "detail": id_detail,
                   "expected": f"{EXPECTED_IDS.start}–{EXPECTED_IDS.stop - 1}"})

    # C. Duplicate ids
    dup_ids = [i for i in id_set if ids.count(i) > 1]
    checks.append(check("duplicate_ids", "Duplicate IDs", "warning", dup_ids,
                        f"{len(dup_ids)} duplicated id(s)" if dup_ids else "None"))

    # E–I. Missing fields
    for code, field, title, status in [
        ("missing_name", "name", "Missing names", "warning"),
        ("missing_category", "category", "Missing categories", "warning"),
        ("missing_description", "description", "Missing descriptions", "info"),
        ("missing_building", "building", "Missing building", "info"),
        ("missing_floor", "floor", "Missing floor", "info"),
    ]:
        affected = [r["id"] for r in rows if _blank(r.get(field))]
        for i in affected:
            flags[i].append(code)
        checks.append(check(code, title, status, affected,
                            f"{len(affected)} of {len(rows)} empty" if affected else "All set"))

    # J. Whitespace in names
    ws = [r["id"] for r in rows if isinstance(r.get("name"), str) and r["name"] != r["name"].strip()]
    for i in ws:
        flags[i].append("name_whitespace")
    checks.append(check("name_whitespace", "Trailing whitespace in names", "needs_review", ws,
                        f"{len(ws)} name(s) with leading/trailing spaces" if ws else "None"))

    # K. Category inconsistencies
    categories = label_analysis(rows, "category")
    cat_ids = [i for g in categories["variant_groups"] for l in g["labels"] for i in l["ids"]]
    spaced = [l for l in categories["labels"] if l["whitespace"]]
    for i in cat_ids:
        flags[i].append("category_variant")
    for l in spaced:
        for i in l["ids"]:
            flags[i].append("category_whitespace")
    checks.append(check("category_variants", "Category inconsistencies", "needs_review",
                        cat_ids + [i for l in spaced for i in l["ids"]],
                        f"{len(categories['variant_groups'])} possible variant group(s), "
                        f"{len(spaced)} label(s) with stray spaces, across {categories['distinct']} category labels"
                        if cat_ids or spaced else "None"))

    # L. Invalid coordinates
    valid = [r for r in rows if _valid_coord(r.get("latitude"), r.get("longitude"))]
    invalid = [r["id"] for r in rows if r not in valid]
    for i in invalid:
        flags[i].append("invalid_coordinates")
    checks.append(check("invalid_coordinates", "Invalid latitude/longitude", "warning", invalid,
                        f"{len(invalid)} out of range or missing" if invalid else "All within range"))

    # M. Suspicious coordinates (far from the median campus position)
    suspicious = []
    center = None
    if valid:
        center = (median(r["latitude"] for r in valid), median(r["longitude"] for r in valid))
        for r in valid:
            d = distance_m(*center, r["latitude"], r["longitude"])
            if d > OUTLIER_RADIUS_M:
                reasons = [f"{d / 1000:,.0f} km from the campus median position"]
                if r["latitude"] == r["longitude"]:
                    reasons.append("latitude equals longitude")
                suspicious.append({"id": r["id"], "name": r["name"], "latitude": r["latitude"],
                                   "longitude": r["longitude"], "distance_m": round(d), "reasons": reasons})
                flags[r["id"]].append("needs_verification")
    checks.append(check("suspicious_coordinates", "Suspicious coordinates", "needs_review",
                        [s["id"] for s in suspicious],
                        f"{len(suspicious)} place(s) need verification — values preserved" if suspicious else "None"))

    # D. Shared coordinates — informational, several rooms can share one building position.
    groups = defaultdict(list)
    for r in valid:
        groups[(r["latitude"], r["longitude"])].append({"id": r["id"], "name": r["name"]})
    shared = [{"latitude": k[0], "longitude": k[1], "places": sorted(v, key=lambda p: p["id"])}
              for k, v in groups.items() if len(v) > 1]
    shared.sort(key=lambda g: g["places"][0]["id"])
    shared_ids = [p["id"] for g in shared for p in g["places"]]
    for i in shared_ids:
        flags[i].append("shared_coordinates")
    checks.append(check("shared_coordinates", "Shared coordinate groups", "info", shared_ids,
                        f"{len(shared)} group(s) — informational, not errors" if shared else "None"))

    buildings = label_analysis(rows, "building")

    return {
        "checks": checks,
        "status": worst(*(c["status"] for c in checks)),
        "center": {"latitude": center[0], "longitude": center[1]} if center else None,
        "suspicious": suspicious,
        "shared_coordinate_groups": shared,
        "categories": categories,
        "buildings": buildings,
        "row_flags": {str(k): sorted(set(v)) for k, v in flags.items()},
    }


# --- Canonical integrity ----------------------------------------------------

def compare_canonical(db_rows, canonical):
    """Field-by-field comparison of the database with locations.json (exact values)."""
    db_by_id = {r["id"]: r for r in db_rows}
    json_by_id = {}
    json_duplicates = []
    for rec in canonical:
        rid = rec.get("id") if isinstance(rec, dict) else None
        if rid in json_by_id:
            json_duplicates.append(rid)
        json_by_id[rid] = rec

    matching, mismatched, missing_in_db = [], [], []
    for rid, rec in json_by_id.items():
        live = db_by_id.get(rid)
        if live is None:
            missing_in_db.append(rid)
            continue
        changed = [f for f in FIELDS if live.get(f) != rec.get(f)]
        if changed:
            mismatched.append({"id": rid, "fields": changed})
        else:
            matching.append(rid)
    extra_in_db = sorted(set(db_by_id) - set(json_by_id))

    synchronized = not (mismatched or missing_in_db or extra_in_db or json_duplicates) and len(db_rows) == len(canonical)
    return {
        "database_count": len(db_rows),
        "canonical_count": len(canonical),
        "matching": len(matching),
        "mismatched": sorted(mismatched, key=lambda m: m["id"]),
        "missing_in_db": sorted(missing_in_db, key=lambda x: (x is None, x)),
        "extra_in_db": extra_in_db,
        "canonical_duplicate_ids": json_duplicates,
        "synchronized": synchronized,
        "status": "healthy" if synchronized else "warning",
    }
