from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocationBase(BaseModel):
    name: str = Field(..., max_length=150)
    category: str = Field(default="General", max_length=80)
    latitude: float
    longitude: float
    building: str | None = Field(default=None, max_length=120)
    floor: str | None = Field(default=None, max_length=40)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=300)


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    """All fields optional — used for PATCH-style partial updates in the admin panel."""
    name: str | None = Field(default=None, max_length=150)
    category: str | None = Field(default=None, max_length=80)
    latitude: float | None = None
    longitude: float | None = None
    building: str | None = Field(default=None, max_length=120)
    floor: str | None = Field(default=None, max_length=40)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=300)


class LocationOut(LocationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
