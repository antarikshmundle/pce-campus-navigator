"""
Lightweight, offline chatbot for location queries.

Why fuzzy matching instead of an LLM call:
- Zero API cost/latency, works fully offline on a kiosk with patchy campus wifi
- The vocabulary is closed (a few dozen location names), so fuzzy string
  matching + intent detection is plenty accurate and far more predictable
  than an LLM for a kiosk that needs to "just work"
- This replaces the old app's brittle `if location.lower() in speech_input`
  substring check, which failed on any phrasing that didn't contain the
  exact location string

Matching strategy:
- Every location name starts with "PRIYADARSHINI" (campus prefix) — matching
  the raw name against a query like "where is the AI lab" scores badly
  because the prefix dominates the comparison. So we match against an
  *alias* (the name with the campus prefix stripped) instead.
- The query itself is stripped of filler/question words ("where is the",
  "how do i get to") so only the meaningful terms remain before matching.
- fuzz.token_set_ratio is used because it's insensitive to word order and
  extra/missing filler tokens, which is exactly the noise a spoken or typed
  natural-language query introduces.

This module can later be swapped for an LLM-backed version without changing
the router/API contract (match_location / build_reply signatures stay the same).
"""
import re

from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.location import Location

_DIRECTION_TRIGGERS = ["how do i get", "how to reach", "directions to", "way to", "navigate to", "route to"]
_INFO_TRIGGERS = ["where is", "where's", "find", "locate", "show me"]

_FILLER_WORDS = {
    "where", "is", "the", "how", "do", "i", "get", "to", "a", "an", "of",
    "please", "can", "you", "me", "tell", "find", "locate", "show", "at",
    "there", "here", "want", "go", "need", "priyadarshini",
}

_CAMPUS_PREFIX = "PRIYADARSHINI College Of ENGINEERING"


def _clean(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if t not in _FILLER_WORDS]
    cleaned = " ".join(tokens)
    return cleaned if cleaned else text  # never return empty — fall back to raw cleaned text


def _alias(location_name: str) -> str:
    """Location name with the campus prefix stripped, e.g. 'PRIYADARSHINI AI Lab' -> 'ai lab'."""
    alias = location_name.replace(_CAMPUS_PREFIX, "").strip().lower()
    return alias if alias else location_name.lower()  # e.g. the bare "PRIYADARSHINI" landmark itself


def _detect_intent(cleaned_query: str) -> str:
    for trig in _DIRECTION_TRIGGERS:
        if trig in cleaned_query:
            return "directions"
    for trig in _INFO_TRIGGERS:
        if trig in cleaned_query:
            return "info"
    return "info"


def match_location(db: Session, query_text: str) -> tuple[Location | None, int, list[str]]:
    """
    Fuzzy-match free text against all location names (via aliases).
    Returns (best_match_or_None, score_0_to_100, list_of_alternate_suggestions).
    """
    locations = db.query(Location).all()
    if not locations:
        return None, 0, []

    alias_to_location = {_alias(loc.name): loc for loc in locations}
    cleaned_query = _clean(query_text)

    results = process.extract(
        cleaned_query,
        list(alias_to_location.keys()),
        scorer=fuzz.token_set_ratio,
        limit=3,
    )
    if not results:
        return None, 0, []

    best_alias, best_score, _ = results[0]
    suggestions = [alias_to_location[alias].name for alias, score, _ in results[1:] if score >= 45]

    if best_score < settings.CHATBOT_MATCH_THRESHOLD:
        low_conf_suggestions = [alias_to_location[alias].name for alias, score, _ in results if score >= 40]
        return None, int(best_score), low_conf_suggestions

    matched = alias_to_location[best_alias]
    return matched, int(best_score), suggestions


def build_reply(query_text: str, location: Location | None, score: int, suggestions: list[str]) -> str:
    intent = _detect_intent(_clean(query_text))

    if location is None:
        if suggestions:
            options = ", ".join(suggestions[:3])
            return f"I couldn't find an exact match. Did you mean: {options}?"
        return "I couldn't find that location. Try asking about a building, department, or facility by name."

    if intent == "directions":
        return f"{location.name} is in the {location.category} category. Tap 'Get Directions' below to see the walking route."

    parts = [f"{location.name} is a {location.category.lower()} location on campus."]
    if location.building:
        parts.append(f"It's located in {location.building}.")
    if location.description:
        parts.append(location.description)
    return " ".join(parts)
