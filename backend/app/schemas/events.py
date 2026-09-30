from typing import Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "SEARCH_SUBMITTED",
    "SEARCH_RESULT_OPENED",
    "PLACE_OPENED",
    "NAVIGATION_REQUESTED",
    "NEARBY_SEARCH",
    "NEARBY_PLACE_OPENED",
]
EventDetail = Literal["in_app", "google_maps", "campus", "around", "nagpur"]


class UsageEventIn(BaseModel):
    type: EventType
    place_id: int | None = None
    external_key: str | None = Field(default=None, max_length=64, pattern=r"^osm-[nwr]\d{1,15}$")
    query: str | None = Field(default=None, max_length=200)
    result_count: int | None = Field(default=None, ge=0, le=10000)
    detail: EventDetail | None = None


class UsageEventBatch(BaseModel):
    events: list[UsageEventIn] = Field(..., min_length=1, max_length=20)
