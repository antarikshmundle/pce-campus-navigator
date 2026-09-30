"""
Admin Intelligence (Stage 11): read-only summaries for the admin panel.

Every number comes from stored rows — locations, locations.json, chat_logs,
usage_events. Nothing is estimated, and nothing here writes to the database.
Local-discovery (OpenStreetMap) data is bundled with the frontend, so its
checks run in the admin UI, not here.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import Date, cast, func, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_admin
from app.core.security import verify_password
from app.db.seed import DEFAULT_ADMIN_PASSWORD
from app.db.session import engine, get_db
from app.models.admin_user import AdminUser
from app.models.chat_log import ChatLog
from app.models.location import Location
from app.models.usage_event import UsageEvent
from app.services import data_health

router = APIRouter(prefix="/admin/insights", tags=["admin"], dependencies=[Depends(get_current_admin)])

TZ = "Asia/Kolkata"  # campus time for per-day grouping
MAX_PATTERNS = 200


def _location_rows(db: Session):
    return [{f: getattr(loc, f) for f in data_health.FIELDS} for loc in db.query(Location).order_by(Location.id)]


def _day(column):
    return cast(func.timezone(TZ, column), Date)


def _iso(value):
    return value.isoformat() if value else None


def _health(db: Session):
    rows = _location_rows(db)
    health = data_health.check_locations(rows)
    canonical, error = data_health.load_canonical()
    integrity = (
        data_health.compare_canonical(rows, canonical)
        if canonical is not None
        else {"status": "unavailable", "error": error, "synchronized": False, "database_count": len(rows)}
    )
    return rows, health, integrity


def _events_table_exists() -> bool:
    return inspect(engine).has_table(UsageEvent.__tablename__)


# --- Dashboard -------------------------------------------------------------

@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    rows, health, integrity = _health(db)
    ai_total, ai_resolved, ai_last = db.query(
        func.count(ChatLog.id),
        func.count(ChatLog.id).filter(ChatLog.was_resolved.is_(True)),
        func.max(ChatLog.created_at),
    ).one()

    events = None
    if _events_table_exists():
        by_type = dict(db.query(UsageEvent.event_type, func.count(UsageEvent.id)).group_by(UsageEvent.event_type).all())
        first = db.query(func.min(UsageEvent.created_at)).scalar()
        events = {"total": sum(by_type.values()), "by_type": by_type, "since": _iso(first)}

    attention = [
        {"code": c["code"], "title": c["title"], "status": c["status"], "detail": c["detail"], "ids": c["affected_ids"][:12]}
        for c in health["checks"] if c["status"] in ("warning", "needs_review")
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "locations": {
            "total": len(rows),
            "min_id": rows[0]["id"] if rows else None,
            "max_id": rows[-1]["id"] if rows else None,
            "categories": health["categories"]["distinct"],
            "categories_normalized": health["categories"]["distinct_normalized"],
            "category_variant_groups": len(health["categories"]["variant_groups"]),
            "buildings": health["buildings"]["distinct"],
            "buildings_normalized": health["buildings"]["distinct_normalized"],
            "without_building": len(health["buildings"]["missing_ids"]),
        },
        "health": {"status": data_health.worst(health["status"], integrity["status"]), "attention": attention},
        "canonical": {k: integrity.get(k) for k in ("status", "synchronized", "database_count", "canonical_count", "matching", "error")},
        "ai": {"total": ai_total, "resolved": ai_resolved, "unresolved": ai_total - ai_resolved, "last_at": _iso(ai_last)},
        "events": events,
    }


# --- Data --------------------------------------------------------------------

@router.get("/data-health")
def data_health_report(db: Session = Depends(get_db)):
    rows, health, integrity = _health(db)
    return {
        **health,
        "status": data_health.worst(health["status"], integrity["status"]),
        "canonical": integrity,
        "expected": {"count": data_health.EXPECTED_COUNT,
                     "ids": [data_health.EXPECTED_IDS.start, data_health.EXPECTED_IDS.stop - 1],
                     "outlier_radius_m": data_health.OUTLIER_RADIUS_M},
    }


# --- Insights --------------------------------------------------------------

@router.get("/ai")
def ai_analytics(db: Session = Depends(get_db)):
    total, resolved, first, last = db.query(
        func.count(ChatLog.id),
        func.count(ChatLog.id).filter(ChatLog.was_resolved.is_(True)),
        func.min(ChatLog.created_at),
        func.max(ChatLog.created_at),
    ).one()

    day = _day(ChatLog.created_at)
    by_day = db.query(
        day.label("day"),
        func.count(ChatLog.id),
        func.count(ChatLog.id).filter(ChatLog.was_resolved.is_(True)),
    ).group_by(day).order_by(day).all()

    ids_by_name = {name: i for i, name in db.query(Location.id, Location.name).all()}
    top_places = db.query(ChatLog.matched_location, func.count(ChatLog.id)) \
        .filter(ChatLog.matched_location.isnot(None)) \
        .group_by(ChatLog.matched_location).order_by(func.count(ChatLog.id).desc()).limit(10).all()

    # Query patterns: case/spacing/trailing-punctuation-insensitive grouping.
    pattern = func.regexp_replace(
        func.lower(func.trim(func.regexp_replace(ChatLog.query_text, r"\s+", " ", "g"))), r"[?.!\s]+$", ""
    )
    patterns = db.query(
        pattern.label("pattern"),
        func.count(ChatLog.id),
        func.count(ChatLog.id).filter(ChatLog.was_resolved.is_(True)),
        func.max(ChatLog.created_at),
    ).group_by(pattern).order_by(func.count(ChatLog.id).desc(), func.max(ChatLog.created_at).desc()) \
        .limit(MAX_PATTERNS).all()
    distinct_patterns = db.query(func.count(func.distinct(pattern))).scalar()

    unresolved = db.query(ChatLog.query_text, ChatLog.created_at).filter(ChatLog.was_resolved.is_(False)) \
        .order_by(ChatLog.created_at.desc()).limit(10).all()

    return {
        "total": total,
        "resolved": resolved,
        "unresolved": total - resolved,
        "first_at": _iso(first),
        "last_at": _iso(last),
        "timezone": TZ,
        "by_day": [{"day": d.isoformat(), "total": t, "resolved": r} for d, t, r in by_day],
        "top_places": [{"name": n, "id": ids_by_name.get(n), "count": c} for n, c in top_places],
        "patterns": [{"text": p, "count": c, "resolved": r, "last_at": _iso(l)} for p, c, r, l in patterns],
        "distinct_patterns": distinct_patterns,
        "patterns_truncated": distinct_patterns > MAX_PATTERNS,
        "recent_unresolved": [{"text": q, "at": _iso(a)} for q, a in unresolved],
    }


@router.get("/usage")
def usage_analytics(db: Session = Depends(get_db)):
    if not _events_table_exists():
        return {"available": False}

    E = UsageEvent
    by_type = dict(db.query(E.event_type, func.count(E.id)).group_by(E.event_type).all())
    first, last = db.query(func.min(E.created_at), func.max(E.created_at)).one()
    names = {i: n for i, n in db.query(Location.id, Location.name).all()}

    def top_places(event_type, limit=10):
        rows = db.query(E.place_id, func.count(E.id)).filter(E.event_type == event_type, E.place_id.isnot(None)) \
            .group_by(E.place_id).order_by(func.count(E.id).desc(), E.place_id).limit(limit).all()
        return [{"id": i, "name": names.get(i), "count": c} for i, c in rows]

    def top_queries(event_type, zero_only=False, limit=15):
        q = db.query(E.query_text, func.count(E.id), func.max(E.result_count)) \
            .filter(E.event_type == event_type, E.query_text.isnot(None))
        if zero_only:
            q = q.filter(E.result_count == 0)
        rows = q.group_by(E.query_text).order_by(func.count(E.id).desc(), E.query_text).limit(limit).all()
        return [{"text": t, "count": c, "results": r} for t, c, r in rows]

    day = _day(E.created_at)
    by_day = db.query(day, E.event_type, func.count(E.id)).group_by(day, E.event_type).order_by(day).all()
    days = {}
    for d, t, c in by_day:
        days.setdefault(d.isoformat(), {})[t] = c

    searches = by_type.get("SEARCH_SUBMITTED", 0)
    zero = db.query(func.count(E.id)).filter(E.event_type == "SEARCH_SUBMITTED", E.result_count == 0).scalar()
    nav_modes = dict(db.query(E.detail, func.count(E.id)).filter(E.event_type == "NAVIGATION_REQUESTED")
                     .group_by(E.detail).all())
    nearby_opened = db.query(E.external_key, E.detail, func.count(E.id)) \
        .filter(E.event_type == "NEARBY_PLACE_OPENED", E.external_key.isnot(None)) \
        .group_by(E.external_key, E.detail).order_by(func.count(E.id).desc()).limit(10).all()

    return {
        "available": True,
        "total": sum(by_type.values()),
        "by_type": by_type,
        "first_at": _iso(first),
        "last_at": _iso(last),
        "timezone": TZ,
        "by_day": [{"day": d, "counts": c} for d, c in days.items()],
        "search": {
            "submitted": searches,
            "zero_result": zero,
            "top_queries": top_queries("SEARCH_SUBMITTED"),
            "zero_result_queries": top_queries("SEARCH_SUBMITTED", zero_only=True),
            "result_opens": top_places("SEARCH_RESULT_OPENED"),
        },
        "places": {
            "opened": top_places("PLACE_OPENED"),
            "navigated": top_places("NAVIGATION_REQUESTED"),
            "navigation_modes": {str(k): v for k, v in nav_modes.items()},
        },
        "nearby": {
            "searches": top_queries("NEARBY_SEARCH"),
            "opened": [{"key": k, "layer": d, "count": c} for k, d, c in nearby_opened],
        },
    }


# --- System ------------------------------------------------------------------

@router.get("/system")
def system_status(request: Request, db: Session = Depends(get_db)):
    checks = {}
    try:
        database, version = db.execute(text("SELECT current_database(), current_setting('server_version')")).one()
        checks["database"] = {"status": "healthy", "name": database, "version": version}
    except Exception:
        checks["database"] = {"status": "unavailable"}
        return {"backend": {"status": "healthy"}, **checks}

    rows, health, integrity = _health(db)
    checks["locations"] = {"status": "healthy" if len(rows) == data_health.EXPECTED_COUNT else "warning", "count": len(rows)}
    checks["canonical"] = {k: integrity.get(k) for k in ("status", "synchronized", "matching", "canonical_count", "error")}

    paths = {getattr(r, "path", "") for r in request.app.routes}
    ai_count, ai_last = db.query(func.count(ChatLog.id), func.max(ChatLog.created_at)).one()
    chat_ok = f"{settings.API_V1_PREFIX}/chat" in paths
    checks["ai"] = {"status": "healthy" if chat_ok else "unavailable", "endpoint_registered": chat_ok,
                    "logs": ai_count, "last_query_at": _iso(ai_last)}

    if _events_table_exists():
        n, last = db.query(func.count(UsageEvent.id), func.max(UsageEvent.created_at)).one()
        checks["events"] = {"status": "healthy", "table": True, "count": n, "last_at": _iso(last)}
    else:
        checks["events"] = {"status": "unavailable", "table": False}

    # Security posture as booleans only — never the values themselves.
    admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
    default_password = bool(admin and verify_password(DEFAULT_ADMIN_PASSWORD, admin.hashed_password))
    default_secret = settings.SECRET_KEY in ("change-this-in-production", "replace-with-a-long-random-string")
    checks["security"] = {
        "status": "warning" if default_password or default_secret else "healthy",
        "default_admin_password": default_password,
        "default_secret_key": default_secret,
        "token_lifetime_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    }
    return {"backend": {"status": "healthy", "time": datetime.now(timezone.utc).isoformat()}, **checks}
