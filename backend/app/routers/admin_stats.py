from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.chat_log import ChatLog
from app.models.location import Location

router = APIRouter(prefix="/admin/stats", tags=["admin"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    total_locations = db.query(func.count(Location.id)).scalar()
    total_queries = db.query(func.count(ChatLog.id)).scalar()
    unresolved_queries = db.query(func.count(ChatLog.id)).filter(ChatLog.was_resolved.is_(False)).scalar()

    top_locations = (
        db.query(ChatLog.matched_location, func.count(ChatLog.id).label("count"))
        .filter(ChatLog.matched_location.isnot(None))
        .group_by(ChatLog.matched_location)
        .order_by(func.count(ChatLog.id).desc())
        .limit(5)
        .all()
    )

    unresolved_samples = (
        db.query(ChatLog.query_text)
        .filter(ChatLog.was_resolved.is_(False))
        .order_by(ChatLog.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_locations": total_locations,
        "total_queries": total_queries,
        "unresolved_queries": unresolved_queries,
        "top_locations": [{"name": name, "count": count} for name, count in top_locations],
        "recent_unresolved_queries": [row[0] for row in unresolved_samples],
    }
