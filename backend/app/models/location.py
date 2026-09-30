from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func

from app.db.session import Base


class Location(Base):
    """
    A single navigable point on campus. Replaces the hardcoded `self.locations`
    dict from the original pywebview app — now editable via the admin panel.
    """
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    category = Column(String(80), nullable=False, default="General")  # e.g. Academic, Hostel, Sports, Admin
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    building = Column(String(120), nullable=True)
    floor = Column(String(40), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(300), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
