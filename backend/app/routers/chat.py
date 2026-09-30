from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.chat_log import ChatLog
from app.models.location import Location
from app.schemas.chat import ChatQuery, ChatResponse, DirectionsRequest, DirectionsResponse
from app.services import chatbot, directions

router = APIRouter(tags=["chat"])

_MAX_LOGGED_QUERY = 500


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatQuery, db: Session = Depends(get_db)):
    """
    Natural-language location query, e.g. "where is the AI lab".
    Uses offline fuzzy matching (see services/chatbot.py) — no external LLM
    call, so it works even if the kiosk's internet is flaky.

    The Campus AI assistant resolves queries in the browser (against the same
    location data) and sends `client_resolution` so the log records what it
    actually answered. Without it, logging is unchanged. The response is the
    same either way.
    """
    location, score, suggestions = chatbot.match_location(db, payload.message)
    reply = chatbot.build_reply(payload.message, location, score, suggestions)

    if payload.client_resolution is not None:
        res = payload.client_resolution
        # Only ids that really exist count; a single place is named in the log.
        # Answers without places (greeting, "enable location") keep the client's flag.
        known = db.query(Location).filter(Location.id.in_(res.place_ids)).all() if res.place_ids else []
        log = ChatLog(
            query_text=payload.message[:_MAX_LOGGED_QUERY],
            matched_location=known[0].name if len(known) == 1 else None,
            match_score=None,  # not a rapidfuzz score
            was_resolved=res.resolved and (bool(known) or not res.place_ids),
        )
    else:
        log = ChatLog(
            query_text=payload.message,
            matched_location=location.name if location else None,
            match_score=score,
            was_resolved=location is not None,
        )
    db.add(log)
    db.commit()

    return ChatResponse(
        reply=reply,
        matched_location=location,
        match_score=score,
        suggestions=suggestions,
    )


@router.post("/directions", response_model=DirectionsResponse)
def get_directions(payload: DirectionsRequest, db: Session = Depends(get_db)):
    origin = db.query(Location).filter(Location.name == payload.from_location).first()
    destination = db.query(Location).filter(Location.name == payload.to_location).first()

    if not origin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown starting location: {payload.from_location}")
    if not destination:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown destination: {payload.to_location}")
    if origin.id == destination.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Starting point and destination must differ")

    minutes = directions.estimate_walking_minutes(origin, destination)
    steps = directions.build_steps(origin, destination, minutes)

    return DirectionsResponse(
        from_location=origin.name,
        to_location=destination.name,
        maps_url=directions.build_maps_url(origin, destination),
        estimated_minutes=minutes,
        steps=steps,
        speech_text=directions.build_speech_text(steps),
    )
