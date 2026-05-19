"""Shared concert text helpers (no keyword intent tables)."""

from __future__ import annotations

import re

KIDS_AGE_RE = re.compile(
    r"\b(\d+\s*[–-]\s*\d+\s*years?|0\s*[–-]\s*2|3\s*[–-]\s*5|5\s*[–-]\s*9|"
    r"7\s*[–-]\s*12|12\s*[–-]\s*18)\b",
    re.IGNORECASE,
)

KIDS_TITLE_HINTS = (
    "baby space",
    "loopino",
    "schoolharmonic",
    "pinocchio",
    "cipollino",
    "goscho",
    "gamelan de bali",
    "percussions gamelan",
    "kanner",
    "enfants",
    "children",
    "0–2 years",
    "0-2 years",
)


def concert_blob(c: dict[str, str]) -> str:
    return " ".join(
        [
            c.get("title", ""),
            c.get("subtitle", ""),
            c.get("tag1", ""),
            c.get("tag2", ""),
            c.get("genre", ""),
            c.get("program", "")[:1200],
            c.get("cast", "")[:400],
        ]
    ).lower()


def is_kids_concert(c: dict[str, str]) -> bool:
    blob = concert_blob(c)
    if KIDS_AGE_RE.search(blob):
        return True
    return any(h in blob for h in KIDS_TITLE_HINTS)


def catalogue_vocabulary_hint(concerts: list[dict[str, str]], *, limit: int = 18) -> str:
    """Sample real tag/genre values for LLM prompts — data-driven, not mood routing."""
    tag1: set[str] = set()
    tag2: set[str] = set()
    genres: set[str] = set()
    for c in concerts:
        if c.get("tag1"):
            tag1.add(c["tag1"].strip())
        if c.get("tag2"):
            tag2.add(c["tag2"].strip())
        if c.get("genre"):
            genres.add(c["genre"].strip())
    t1 = ", ".join(sorted(tag1)[:limit]) or "—"
    t2 = ", ".join(sorted(tag2)[:limit]) or "—"
    g = ", ".join(sorted(genres)[:limit]) or "—"
    return f"tag1 (series): {t1}\ntag2 (mood/scale): {t2}\ngenres: {g}"
