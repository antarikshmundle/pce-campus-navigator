from pydantic import BaseModel, Field

from app.schemas.location import LocationOut


class ClientResolution(BaseModel):
    """
    How the Campus AI assistant (frontend) resolved the query against the
    location data. Optional and used only for chat_logs analytics; ids are
    re-checked against the database, nothing else is stored.
    """
    intent: str = Field(..., max_length=32)  # place_lookup | category_search | nearby | navigation | distance | unknown …
    place_ids: list[int] = Field(default_factory=list, max_length=50)
    resolved: bool = False


class ChatQuery(BaseModel):
    message: str
    client_resolution: ClientResolution | None = None


class ChatResponse(BaseModel):
    reply: str
    matched_location: LocationOut | None = None
    match_score: int | None = None
    suggestions: list[str] = []  # nearby-name suggestions when confidence is low


class DirectionsRequest(BaseModel):
    from_location: str
    to_location: str


class DirectionsResponse(BaseModel):
    from_location: str
    to_location: str
    maps_url: str
    estimated_minutes: int
    steps: list[str]
    speech_text: str
