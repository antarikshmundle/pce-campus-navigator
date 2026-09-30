from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.session import Base


class UsageEvent(Base):
    """
    Anonymous, aggregate-only product events from the student app (Stage 11):
    searches, opened places, navigation requests, nearby discovery.

    Deliberately minimal — no user, session, device, IP or position is stored.
    `query_text` holds a normalized, truncated search term (search events only);
    `external_key` is a public OpenStreetMap id (nearby events only).
    Campus AI queries are not duplicated here: chat_logs already records them.
    """
    __tablename__ = "usage_events"

    id = Column(Integer, primary_key=True)
    event_type = Column(String(32), nullable=False, index=True)
    place_id = Column(Integer, nullable=True)  # campus location id (checked on insert, no FK)
    external_key = Column(String(64), nullable=True)
    query_text = Column(String(80), nullable=True)
    result_count = Column(Integer, nullable=True)
    detail = Column(String(16), nullable=True)  # small whitelisted qualifier, e.g. in_app | google_maps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
