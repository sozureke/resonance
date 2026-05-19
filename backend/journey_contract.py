"""Product journey invariants (no mood keyword tables)."""

from __future__ import annotations

import os
from collections.abc import Callable
from datetime import datetime

from catalog_fit import concert_hits_avoid, validate_intent_quartet
from concert_utils import concert_blob, is_kids_concert
from intent_llm import StructuredIntent


def _gap_env() -> tuple[int, int, int, bool]:
    preferred = int(os.environ.get("JOURNEY_GAP_MIN_DAYS", "7"))
    hard = int(os.environ.get("JOURNEY_GAP_HARD_MIN_DAYS", "2"))
    gmax = int(os.environ.get("JOURNEY_GAP_MAX_DAYS", "75"))
    soft = os.environ.get("JOURNEY_GAP_SOFT", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    return preferred, hard, gmax, soft


def gap_profiles() -> list[tuple[int, int]]:
    """Strict tiers for repair / final validation (soft mode adds a hard floor tier)."""
    preferred, hard, gmax, soft = _gap_env()
    profiles: list[tuple[int, int]] = [
        (preferred, gmax),
        (max(5, preferred - 2), gmax + 10),
        (5, 100),
    ]
    if soft:
        profiles.append((hard, 120))
    return profiles


def curator_gap_profiles() -> list[tuple[int, int]]:
    """LLM curator: prefer season spread, accept catalogue-realistic spacing."""
    preferred, hard, gmax, _ = _gap_env()
    return [
        (preferred, gmax),
        (max(5, preferred - 2), gmax + 15),
        (hard, 120),
    ]


def relaxed_gap_profiles() -> list[tuple[int, int]]:
    """Repair search — same as gap_profiles."""
    return gap_profiles()


def gaps_ok_ordered(dts: list[datetime], min_gap: int, max_gap: int) -> bool:
    for i in range(3):
        g = (dts[i + 1] - dts[i]).days
        if g < min_gap or g > max_gap:
            return False
    return True


def gap_spacing_note(dts: list[datetime]) -> str | None:
    """Non-blocking hint when gaps are tight but allowed (soft mode)."""
    preferred, _, _, soft = _gap_env()
    if not soft:
        return None
    gaps = [(dts[i + 1] - dts[i]).days for i in range(3)]
    if any(g < preferred for g in gaps):
        return f"spacing prefers ≥{preferred}d between steps; actual gaps {gaps}"
    return None


def _venue_soft() -> bool:
    return os.environ.get("JOURNEY_VENUE_SOFT", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def pool_has_multiple_venue_types(
    pool_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    venue_kind_fn: Callable[[str], str],
) -> bool:
    kinds = {
        venue_kind_fn(c_by_id[cid].get("room", ""))
        for cid in pool_ids
        if cid in c_by_id
    }
    return len(kinds) >= 2


def venue_variety_note(
    chrono_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    venue_kind_fn: Callable[[str], str],
    *,
    pool_ids: list[str] | None = None,
) -> str | None:
    """Non-blocking hint when the quartet uses one venue type but the pool offered more."""
    if not _venue_soft():
        return None
    venues = {
        venue_kind_fn(c_by_id[cid].get("room", "")) for cid in chrono_ids if cid in c_by_id
    }
    if len(venues) >= 2:
        return None
    if pool_ids is not None and not pool_has_multiple_venue_types(
        pool_ids, c_by_id, venue_kind_fn
    ):
        return None
    only = next(iter(venues), "unknown")
    return (
        f"venue variety prefers ≥2 types when available; journey uses only «{only}»"
    )


def _concert_hits_avoid(c: dict[str, str], avoid_phrases: list[str]) -> bool:
    if not avoid_phrases:
        return False
    blob = concert_blob(c)
    for phrase in avoid_phrases:
        p = phrase.lower().strip()
        if len(p) >= 4 and p in blob:
            return True
    return False


def validate_journey_contract(
    chrono_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    intent: StructuredIntent,
    *,
    parse_dt: Callable[[dict[str, str]], datetime | None],
    venue_kind_fn: Callable[[str], str],
    month_key_fn: Callable[[dict[str, str]], str],
    gap_profiles_override: list[tuple[int, int]] | None = None,
) -> str | None:
    if len(chrono_ids) != 4:
        return f"expected 4 concerts in order, got {len(chrono_ids)}"

    concerts = [c_by_id[cid] for cid in chrono_ids if cid in c_by_id]
    if len(concerts) != 4:
        return "unknown concert id in quartet"

    if not intent.allow_family_programmes:
        kids = [cid for cid in chrono_ids if is_kids_concert(c_by_id[cid])]
        if kids:
            return f"children/family concerts not allowed: {kids[0]}"

    for cid in chrono_ids:
        c = c_by_id[cid]
        if _concert_hits_avoid(c, intent.avoid):
            return f"concert matches avoid list: «{c.get('title', '')[:50]}»"

    dts: list[datetime] = []
    for cid in chrono_ids:
        dt = parse_dt(c_by_id[cid])
        if dt is None:
            return f"missing date for {cid}"
        dts.append(dt)

    profiles = gap_profiles_override if gap_profiles_override is not None else gap_profiles()
    if not any(gaps_ok_ordered(dts, lo, hi) for lo, hi in profiles):
        gaps = [(dts[i + 1] - dts[i]).days for i in range(3)]
        _, hard, _, _ = _gap_env()
        return f"date gaps {gaps} outside allowed spacing (hard minimum {hard} days)"

    months = {month_key_fn(c_by_id[cid]) for cid in chrono_ids}
    if len(months) < 2:
        return "journey should span at least two different months"

    venues = {venue_kind_fn(c_by_id[cid].get("room", "")) for cid in chrono_ids}
    if len(venues) < 2 and not _venue_soft():
        return "journey should use at least two different venue types"

    intent_err = validate_intent_quartet(
        chrono_ids,
        c_by_id,
        intent.must_emphasize,
        intent.avoid,
    )
    if intent_err and not intent.llm_curated:
        return intent_err

    return None
