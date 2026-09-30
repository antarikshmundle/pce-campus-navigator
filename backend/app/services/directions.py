"""
Directions generation. Per project decision: no custom path-graph/routing
engine — actual turn-by-turn walking is delegated to Google Maps via a deep
link. This service builds that link plus a rough time estimate and a short
on-screen/spoken summary (upgraded from the original app's templated text).
"""
import math

from app.models.location import Location


def build_maps_url(origin: Location, destination: Location) -> str:
    origin_coords = f"{origin.latitude},{origin.longitude}"
    dest_coords = f"{destination.latitude},{destination.longitude}"
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin_coords}&destination={dest_coords}&travelmode=walking"
    )


def estimate_walking_minutes(origin: Location, destination: Location) -> int:
    """
    Haversine distance (accurate great-circle distance, unlike the old app's
    naive Euclidean-on-lat/lng approximation) / average walking speed.
    """
    r = 6371000  # Earth radius in meters
    lat1, lon1 = math.radians(origin.latitude), math.radians(origin.longitude)
    lat2, lon2 = math.radians(destination.latitude), math.radians(destination.longitude)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    meters = r * c

    avg_walk_speed_mps = 1.3  # slightly conservative for a campus w/ crowds & stairs
    minutes = math.ceil(meters / (avg_walk_speed_mps * 60))
    return max(1, minutes)


def build_steps(origin: Location, destination: Location, minutes: int) -> list[str]:
    steps = [f"Start at {origin.name}."]
    if origin.building and origin.building != destination.building:
        steps.append(f"Exit {origin.building}.")
    steps.append(f"Head towards {destination.name}" + (f" in {destination.building}" if destination.building else "") + ".")
    steps.append(f"Estimated walking time: {minutes} minute{'s' if minutes != 1 else ''}.")
    steps.append("Tap 'Open in Google Maps' for the live walking route.")
    return steps


def build_speech_text(steps: list[str]) -> str:
    return " ".join(steps)
