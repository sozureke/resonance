"""Prepare candidate pools for LLM curator and structural repair."""

from __future__ import annotations

import re

from catalog_fit import concert_hits_avoid
from concert_utils import is_kids_concert
from intent_llm import StructuredIntent

_TITLE_KEY_RE = re.compile(r"[^a-z0-9]+")
_FORMAT_TITLE_EXCLUDE_RE = re.compile(r"lunch|yoga", re.IGNORECASE)
_FAMILY_TITLE_EXCLUDE_RE = re.compile(
    r"loopino|baby\s+space|kanner|kids|family",
    re.IGNORECASE,
)


def concert_excluded_from_journey_pool(c: dict[str, str], intent: StructuredIntent) -> bool:
    """Drop concerts that clash with STRUCTURED INTENT avoid list or known off-topic formats."""
    if concert_hits_avoid(c, intent.avoid):
        return True
    title = c.get("title") or ""
    if _FORMAT_TITLE_EXCLUDE_RE.search(title):
        return True
    if not intent.allow_family_programmes and _FAMILY_TITLE_EXCLUDE_RE.search(title):
        return True
    return False


def performance_key(c: dict[str, str]) -> str:
    """One slot per production — drop duplicate Nabucco dates etc."""
    title = (c.get("title") or "").strip().lower()
    title = re.sub(r"\s+", " ", title)
    return _TITLE_KEY_RE.sub(" ", title).strip()[:80]


def prepare_journey_pool(
    pool_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    intent: StructuredIntent,
) -> list[str]:
    """Dedupe productions, drop kids when not allowed — keeps semantic order."""
    seen_keys: set[str] = set()
    out: list[str] = []
    for cid in pool_ids:
        c = c_by_id.get(cid)
        if not c:
            continue
        if not intent.allow_family_programmes and is_kids_concert(c):
            continue
        if concert_excluded_from_journey_pool(c, intent):
            continue
        key = performance_key(c)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        out.append(cid)
    return out
