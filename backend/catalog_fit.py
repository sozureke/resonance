"""Lightweight checks on LLM-provided phrases vs catalogue text — no mood routing tables."""

from __future__ import annotations

import re

from concert_utils import concert_blob


def normalize_era_focus(raw: str | None) -> str:
    if not raw:
        return "none"
    return raw.strip().lower().replace(" ", "_").replace("-", "_")[:40] or "none"


def concert_listed_as_baroque(c: dict[str, str]) -> bool:
    genre = (c.get("genre") or "").lower()
    if "baroque" in genre or "early music" in genre:
        return True
    title = (c.get("title") or "").lower()
    return "midi baroque" in title


def wish_targets_baroque(era_focus: str, must_emphasize: list[str]) -> bool:
    if "baroque" in era_focus or "early_music" in era_focus:
        return True
    return any(
        "baroque" in m.lower() or "early music" in m.lower() for m in must_emphasize
    )


def concert_matches_phrases(c: dict[str, str], phrases: list[str]) -> bool:
    if not phrases:
        return False
    blob = concert_blob(c)
    for phrase in phrases:
        p = phrase.lower().strip()
        if len(p) >= 3 and p in blob:
            return True
    return False


def concert_hits_avoid(c: dict[str, str], avoid_phrases: list[str]) -> bool:
    return concert_matches_phrases(c, avoid_phrases)


def intent_fit_score(c: dict[str, str], must_emphasize: list[str], avoid: list[str]) -> float:
    """Used only for heuristic repair ordering — not the primary relevance gate."""
    if concert_hits_avoid(c, avoid):
        return 0.05
    if concert_matches_phrases(c, must_emphasize):
        return 1.0
    if must_emphasize:
        return 0.35
    return 0.5


def validate_intent_quartet(
    chrono_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    must_emphasize: list[str],
    avoid: list[str],
) -> str | None:
    """Phrase checks for offline/heuristic mode only. LLM-curated journeys use the critic instead."""
    concerts = [c_by_id[i] for i in chrono_ids]

    for cid in chrono_ids:
        if concert_hits_avoid(c_by_id[cid], avoid):
            return (
                f"concert matches avoid list: «{c_by_id[cid].get('title', '')[:45]}»"
            )

    if not must_emphasize:
        return None

    fits = [concert_matches_phrases(c, must_emphasize) for c in concerts]
    if sum(fits) < 2:
        return (
            f"wish needs ≥2 concerts matching intent ({must_emphasize[:3]}), got {sum(fits)}"
        )
    if not fits[0]:
        return (
            f"step 1 should match wish, not «{concerts[0].get('title', '')[:45]}»"
        )

    return None
