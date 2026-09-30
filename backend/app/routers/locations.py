from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/locations", tags=["locations"])


# --- Public endpoints (used by the kiosk frontend) ---

@router.get("", response_model=list[LocationOut])
def list_locations(category: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Location)
    if category:
        query = query.filter(Location.category == category)
    return query.order_by(Location.name).all()


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Location.category).distinct().order_by(Location.category).all()
    return [r[0] for r in rows]


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    return loc


# --- Admin-protected endpoints (used by the admin panel) ---

@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    if db.query(Location).filter(Location.name == payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A location with this name already exists")
    loc = Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.patch("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    db.delete(loc)
    db.commit()
