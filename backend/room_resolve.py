from __future__ import annotations

import json
import re
from pathlib import Path

_ROOM_LABELS_PATH = Path(__file__).resolve().parent.parent / "data" / "room_labels.json"
_ROOM_ID_RE = re.compile(r"^[0-9a-f]{6,}:[0-9a-f]{6,}$", re.IGNORECASE)

_CANONICAL = {
    "grand auditorium": "Grand Auditorium",
    "salle de musique de chambre": "Salle de Musique de Chambre",
    "espace découverte": "Espace Découverte",
    "espace decouverte": "Espace Découverte",
    "grand foyer": "Grand Foyer",
    "salon philaphil": "Salon PhilaPhil",
    "kinnekswiss": "Kinnekswiss",
    "on tour": "On Tour",
}

_MISPLACED_EXACT = {
    "0",
    "intimate",
    "contemporary / experimental",
    "contemporary / experimental / chamber",
}


def _load_room_id_map() -> dict[str, str]:
    data = json.loads(_ROOM_LABELS_PATH.read_text(encoding="utf-8"))
    return {k.lower().strip(): v for k, v in data.items()}


ROOM_ID_MAP = _load_room_id_map()


def _looks_misplaced_room(value: str) -> bool:
    low = value.lower().strip()
    if not low or low in _MISPLACED_EXACT:
        return True
    if _ROOM_ID_RE.match(low.replace(" ", "")):
        return True
    if "mood-booster" in low or "outside-the-box" in low:
        return True
    if "thought-provoking" in low or "instrument focus" in low:
        return True
    return False


def _title_venue_hint(title: str, subtitle: str) -> str:
    blob = f"{title} {subtitle}".lower()
    if "kinnekswiss" in blob:
        return "Kinnekswiss"
    if "on tour" in blob:
        return "On Tour"
    if "grand foyer" in blob or "in c //" in blob:
        return "Grand Foyer"
    if "philaphil" in blob:
        return "Salon PhilaPhil"
    return ""


def _canonicalize(label: str) -> str:
    key = label.lower().strip()
    return _CANONICAL.get(key, label.strip())


def resolve_room_display(
    room: str = "",
    *,
    title: str = "",
    subtitle: str = "",
) -> str:
    """Human-readable venue; never returns raw booking IDs."""
    title = (title or "").strip()
    subtitle = (subtitle or "").strip()
    raw = (room or "").strip()

    from_title = _title_venue_hint(title, subtitle)
    if from_title:
        return from_title

    if raw:
        mapped = ROOM_ID_MAP.get(raw.lower())
        if mapped is not None:
            if mapped:
                return mapped
        elif not _looks_misplaced_room(raw):
            return _canonicalize(raw)

    return "Philharmonie Luxembourg"


def normalize_concert_room(c: dict[str, str]) -> None:
    """Replace raw export room codes with display labels in-place."""
    c["room"] = resolve_room_display(
        c.get("room", ""),
        title=c.get("title", ""),
        subtitle=c.get("subtitle", ""),
    )
