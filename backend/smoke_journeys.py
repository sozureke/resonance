#!/usr/bin/env python3
"""Smoke-check journey contract on upcoming catalogue (no API key required)."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

# Run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from concert_utils import is_kids_concert  # noqa: E402
from intent_llm import StructuredIntent, fallback_intent  # noqa: E402
from journey_contract import validate_journey_contract  # noqa: E402


def venue_kind(room: str) -> str:
    r = (room or "").lower()
    if "chambre" in r:
        return "chambre"
    if "découverte" in r or "decouverte" in r or "espace d" in r:
        return "decouverte"
    if "foyer" in r:
        return "foyer"
    if "auditorium" in r:
        return "grand_auditorium"
    return "other"


def month_key(c: dict[str, str]) -> str:
    d = (c.get("date_iso") or "").strip()
    return d[:7] if len(d) >= 7 else f"unknown:{c.get('id')}"


def parse_dt(c: dict[str, str]) -> datetime | None:
    s = (c.get("date_iso") or "").strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s[:19])
    except ValueError:
        return None


def reference_today() -> datetime:
    raw = os.environ.get("DEMO_REFERENCE_DATE", "2026-05-01").strip()
    return datetime.fromisoformat(raw[:10])


def load_upcoming() -> dict[str, dict[str, str]]:
    path = Path(__file__).resolve().parent.parent / "data" / "concerts.csv"
    today = reference_today().date()
    out: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines()[1:]:
        cols = line.split(";")
        if len(cols) < 10:
            continue
        d = cols[1][:10]
        try:
            if datetime.fromisoformat(d).date() < today:
                continue
        except ValueError:
            continue
        cid = cols[0]
        out[cid] = {
            "id": cid,
            "date_iso": cols[1],
            "title": cols[2],
            "subtitle": cols[3],
            "room": cols[4],
            "tag1": cols[5],
            "tag2": cols[6],
            "genre": cols[7],
            "cast": cols[8],
            "program": cols[9],
        }
    return out


def pick_spread_four(c_by_id: dict[str, dict[str, str]]) -> list[str]:
    """Greedy spread for smoke: spaced dates, diverse venues, no kids."""
    min_gap = int(os.environ.get("JOURNEY_GAP_MIN_DAYS", "7"))
    dated = sorted(
        (
            (parse_dt(c), cid)
            for cid, c in c_by_id.items()
            if parse_dt(c) and not is_kids_concert(c)
        ),
        key=lambda x: x[0],
    )
    picks: list[str] = []
    last_dt: datetime | None = None
    for dt, cid in dated:
        if last_dt and (dt - last_dt).days < min_gap:
            continue
        picks.append(cid)
        last_dt = dt
        if len(picks) == 4:
            break
    if len(picks) < 4:
        for _, cid in dated:
            if cid not in picks:
                picks.append(cid)
            if len(picks) == 4:
                break
    return picks[:4]


QUERIES = [
    "I want to discover something dramatic",
    "I want to discover Late Baroque",
    "Discover powerful Verdi and Italian opera",
    "Film music with emotional power and big orchestra",
    "Surprise me",
]


def main() -> int:
    c_by_id = load_upcoming()
    print(f"Upcoming concerts: {len(c_by_id)} (from {reference_today().date()})")
    fails = 0
    for q in QUERIES:
        intent = fallback_intent(q)
        ids = pick_spread_four(c_by_id)
        if len(ids) < 4:
            print(f"SKIP {q!r}: not enough concerts")
            fails += 1
            continue
        ids.sort(key=lambda i: parse_dt(c_by_id[i]) or datetime.min)
        err = validate_journey_contract(
            ids,
            c_by_id,
            intent,
            parse_dt=parse_dt,
            venue_kind_fn=venue_kind,
            month_key_fn=month_key,
        )
        kids = sum(1 for i in ids if is_kids_concert(c_by_id[i]))
        status = "OK" if err is None else f"FAIL: {err}"
        print(f"  {status} | {q!r} | kids={kids}")
        if err:
            fails += 1
    print(f"\n{'All contract checks passed' if fails == 0 else f'{fails} failed'}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
