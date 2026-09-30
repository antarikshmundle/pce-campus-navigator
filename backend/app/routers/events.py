"""
Anonymous usage events from the student app (Stage 11 search / discovery
analytics). Public, like /chat, so it is kept narrow: whitelisted event types,
bounded batches, a per-client rate limit held only in memory, and search
terms normalized + truncated before storage. Nothing identifying is stored.
"""
import re
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.location import Location
from app.models.usage_event import UsageEvent
from app.schemas.events import UsageEventBatch

router = APIRouter(tags=["events"])

SEARCH_TYPES = {"SEARCH_SUBMITTED", "SEARCH_RESULT_OPENED", "NEARBY_SEARCH"}
MAX_QUERY = 80
RATE_WINDOW_S = 60
RATE_LIMIT = 120  # events per client per window

# client → (window start, count). The address is never stored anywhere else.
_rate: dict[str, tuple[float, int]] = defaultdict(lambda: (0.0, 0))

_DIGITS = re.compile(r"\d{6,}")  # phone / roll numbers
_EMAIL = re.compile(r"\S+@\S+")


def normalize_query(text: str | None) -> str | None:
    if not text:
        return None
    text = _EMAIL.sub("", text)
    text = _DIGITS.sub("#", text)
    text = re.sub(r"\s+", " ", text).strip().casefold()
    return text[:MAX_QUERY] or None


def _allow(client: str, n: int) -> int:
    now = time.monotonic()
    start, count = _rate[client]
    if now - start > RATE_WINDOW_S:
        start, count = now, 0
    allowed = max(0, min(n, RATE_LIMIT - count))
    _rate[client] = (start, count + allowed)
    if len(_rate) > 5000:  # keep memory bounded
        _rate.clear()
    return allowed


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
def record_events(payload: UsageEventBatch, request: Request, db: Session = Depends(get_db)):
    client = request.client.host if request.client else "unknown"
    events = payload.events[: _allow(client, len(payload.events))]

    ids = {e.place_id for e in events if e.place_id is not None}
    known = {row[0] for row in db.query(Location.id).filter(Location.id.in_(ids)).all()} if ids else set()

    stored = 0
    for e in events:
        if e.place_id is not None and e.place_id not in known:
            continue  # unknown campus place: drop rather than store a dangling id
        db.add(UsageEvent(
            event_type=e.type,
            place_id=e.place_id,
            external_key=e.external_key,
            query_text=normalize_query(e.query) if e.type in SEARCH_TYPES else None,
            result_count=e.result_count if e.type in SEARCH_TYPES else None,
            detail=e.detail,
        ))
        stored += 1
    if stored:
        db.commit()
    return {"accepted": stored}
