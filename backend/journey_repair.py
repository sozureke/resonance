"""Build a valid quartet when LLM curator fails — anchor step 1 on best intent match."""

from __future__ import annotations

import itertools
import logging
import os
from collections.abc import Callable
from datetime import datetime

from catalog_fit import intent_fit_score
from intent_llm import StructuredIntent
from journey_contract import relaxed_gap_profiles, validate_journey_contract
from journey_pool import prepare_journey_pool

LOG = logging.getLogger("resonance.journey_repair")


def _step_fits(
    chrono: list[str],
    c_by_id: dict[str, dict[str, str]],
    intent: StructuredIntent,
) -> list[float]:
    return [
        intent_fit_score(c_by_id[cid], intent.must_emphasize, intent.avoid)
        for cid in chrono
    ]


def _quality_ok(chrono: list[str], c_by_id: dict[str, dict[str, str]], intent: StructuredIntent) -> bool:
    if not intent.must_emphasize:
        return True
    fits = _step_fits(chrono, c_by_id, intent)
    if fits[0] < 0.5:
        return False
    if sum(1 for f in fits if f >= 0.5) < 3:
        return False
    return True


def _score_quartet(
    chrono: list[str],
    c_by_id: dict[str, dict[str, str]],
    intent: StructuredIntent,
    rank_by_id: dict[str, int],
) -> float:
    fits = _step_fits(chrono, c_by_id, intent)
    sc = 6.0 * fits[0] + sum(fits[1:])
    sc -= 0.12 * sum(rank_by_id.get(cid, 50) for cid in chrono)
    return sc


def _stylistic_era(era_focus: str) -> bool:
    """Specific aesthetic — anchor by intent fit, not generic semantic rank."""
    e = (era_focus or "").strip().lower().replace("-", "_")
    if e in ("", "none", "dramatic", "surprise"):
        return False
    return True


def repair_journey_quartet(
    pool_ids: list[str],
    c_by_id: dict[str, dict[str, str]],
    intent: StructuredIntent,
    rank_by_id: dict[str, int],
    *,
    parse_dt: Callable[[dict[str, str]], datetime | None],
    venue_kind_fn: Callable[[str], str],
    month_key_fn: Callable[[dict[str, str]], str],
    chronological_sort: Callable[[list[str], dict[str, dict[str, str]]], list[str] | None],
) -> list[str] | None:
    """Step 1 = best entry for the wish; stylistic eras prioritize intent over raw semantic rank."""
    pool_ids = prepare_journey_pool(pool_ids, c_by_id, intent)
    if len(pool_ids) < 4:
        return None

    stylistic = _stylistic_era(intent.era_focus)
    candidates = sorted(
        pool_ids,
        key=lambda cid: (
            (-intent_fit_score(c_by_id[cid], intent.must_emphasize, intent.avoid), rank_by_id.get(cid, 999))
            if stylistic
            else (rank_by_id.get(cid, 999), -intent_fit_score(c_by_id[cid], intent.must_emphasize, intent.avoid))
        ),
    )

    anchor_limit = min(int(os.environ.get("JOURNEY_REPAIR_ANCHORS", "15")), len(candidates))
    rest_limit = int(os.environ.get("JOURNEY_REPAIR_REST", "35"))
    profiles = relaxed_gap_profiles()

    best: list[str] | None = None
    best_score = float("-inf")

    for anchor in candidates[:anchor_limit]:
        anchor_dt = parse_dt(c_by_id[anchor])
        if anchor_dt is None:
            continue

        later = [
            cid
            for cid in candidates
            if cid != anchor and (dt := parse_dt(c_by_id[cid])) is not None and dt > anchor_dt
        ][:rest_limit]

        if len(later) < 3:
            continue

        for trio in itertools.combinations(later, 3):
            chrono = chronological_sort([anchor, *trio], c_by_id)
            if not chrono or chrono[0] != anchor:
                continue
            if not _quality_ok(chrono, c_by_id, intent):
                continue
            err = validate_journey_contract(
                chrono,
                c_by_id,
                intent,
                parse_dt=parse_dt,
                venue_kind_fn=venue_kind_fn,
                month_key_fn=month_key_fn,
                gap_profiles_override=profiles,
            )
            if err:
                continue
            sc = _score_quartet(chrono, c_by_id, intent, rank_by_id)
            if sc > best_score:
                best_score = sc
                best = chrono

    if best:
        LOG.info("Repaired journey quartet (anchor=%s): %s", best[0], best)
    return best
