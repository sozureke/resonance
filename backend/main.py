from __future__ import annotations

import csv
import itertools
import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

load_dotenv(Path(__file__).resolve().parent / ".env")

LOG = logging.getLogger("resonance")
logging.basicConfig(level=logging.INFO)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
META_PATH = CACHE_DIR / "embed_meta.json"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def concerts_csv_path() -> Path:
    env = os.environ.get("CONCERTS_CSV")
    if env:
        return Path(env).expanduser().resolve()
    return repo_root() / "data" / "concerts.csv"


STATE: dict[str, Any] = {}

# Bump when embedding inputs change so .cache rebuilds
EMBED_TEXT_VERSION = "title_program_tag1_tag2_cast_v1"

SYSTEM_PROMPT = """You are "Resonance", the narrative voice for Philharmonie Luxembourg's AI companion.

The **four concerts are already fixed** (in chronological order). Your job is only to write:
1) a short journey title in French, and
2) exactly **four** French sentences for the "arc" — sentence k appears under concert k on screen.

Narrative rules for the arc:
- This is a **trajectory from familiar to discovery**: step 1 should feel like a safe, welcoming entry to the user's wish; step 4 should feel like a stretch / opening into something new but still connected.
- Each sentence should show **movement** from the previous step (different mood, scale, era, or setting) — not four similar blurbs.
- Do **not** claim two steps are the same experience; honour the fact that venues, dates, and programs differ.

Respond with ONLY valid JSON (no markdown):
{"message": "…", "arc": "Four French sentences. Separate with spaces; each should end with . ! or ?"}

Do not include concert ids in the JSON. Do not add fields other than message and arc.
"""


def concert_month_key(c: dict[str, str]) -> str:
    """YYYY-MM bucket; concerts without ISO date fall back per-id."""
    d = (c.get("date_iso") or "").strip()
    if len(d) >= 7 and d[4] == "-":
        return d[:7]
    return f"unknown:{c.get('id', '')}"


def parse_concert_datetime(c: dict[str, str]) -> datetime | None:
    s = (c.get("date_iso") or "").strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1]
        return datetime.fromisoformat(s[:19])
    except ValueError:
        return None


def concert_is_upcoming(c: dict[str, str]) -> bool:
    dt = parse_concert_datetime(c)
    if dt is None:
        return False
    return dt.date() >= datetime.now().date()


def tickets_seem_available(c: dict[str, str]) -> bool:
    """If CSV has no availability column, treat as available."""
    raw = (c.get("available") or "").strip().lower()
    if not raw:
        return True
    if raw in (
        "0",
        "false",
        "no",
        "sold_out",
        "sold out",
        "sold-out",
        "complete",
        "ausverkauft",
        "complet",
        "épuisé",
        "epuise",
    ):
        return False
    if raw in ("1", "true", "yes", "available", "on sale", "on_sale", "onsale"):
        return True
    return True


def embedding_model_name() -> str:
    return os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small")


def is_e5_family(name: str) -> bool:
    return "e5" in name.lower()


def prefix_query(text: str, model_name: str) -> str:
    return f"query: {text}" if is_e5_family(model_name) else text


def prefix_passage(text: str, model_name: str) -> str:
    return f"passage: {text}" if is_e5_family(model_name) else text


def venue_kind(room: str) -> str:
    r = (room or "").lower()
    if "chambre" in r:
        return "chambre"
    if "découverte" in r or "decouverte" in r or "discovery" in r or "espace d" in r:
        return "decouverte"
    if "foyer" in r:
        return "foyer"
    if "auditorium" in r:
        return "grand_auditorium"
    return "other"


def era_hint(c: dict[str, str]) -> str:
    blob = " ".join(
        [
            (c.get("program") or "")[:800],
            c.get("tag1", ""),
            c.get("tag2", ""),
            c.get("genre", ""),
            c.get("title", ""),
        ]
    ).lower()
    if "baroque" in blob:
        return "baroque"
    if "classical" in blob or "klassis" in blob:
        return "classical"
    if "romantic" in blob or "romant" in blob:
        return "romantic"
    if "modern" in blob or "contemporary" in blob or "moderne" in blob or "20th" in blob or "21st" in blob:
        return "modern"
    return "mixed"


def strip_bom(s: str) -> str:
    return s.replace("\ufeff", "", 1) if s else s


def load_concerts_from_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(f"Missing concerts CSV: {path}")

    raw = strip_bom(path.read_text(encoding="utf-8"))
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    if len(lines) < 2:
        return []

    reader = csv.reader([lines[0]], delimiter=";")
    headers = next(reader)
    idx = {h: headers.index(h) for h in headers}

    keys = (
        ("id", idx.get("ID_ev_booking")),
        ("date_iso", idx.get("date_start")),
        ("title", idx.get("title")),
        ("subtitle", idx.get("subtitle")),
        ("room", idx.get("room")),
        ("tag1", idx.get("tag1_E")),
        ("tag2", idx.get("tag2_E")),
        ("genre", idx.get("genre")),
        ("cast", idx.get("cast_full")),
        ("program", idx.get("program_full")),
        (
            "available",
            idx.get("tickets_available")
            if idx.get("tickets_available") is not None
            else idx.get("available"),
        ),
    )

    concerts: list[dict[str, str]] = []
    for line in lines[1:]:
        cols = line.split(";")
        row: dict[str, str] = {}
        for attr, col_i in keys:
            if col_i is None or col_i >= len(cols):
                row[attr] = ""
                continue
            row[attr] = (cols[col_i] or "").strip()
        if row.get("id") and row.get("title"):
            concerts.append(row)
    return concerts


def concert_embedding_text(c: dict[str, str]) -> str:
    """Spec: title + program_full + tag1_E + tag2_E + cast_full."""
    chunks = [
        (c.get("title") or "").strip(),
        (c.get("program") or "").strip(),
        (c.get("tag1") or "").strip(),
        (c.get("tag2") or "").strip(),
        (c.get("cast") or "").strip(),
    ]
    return " \n ".join(x for x in chunks if x)


def load_or_compute_embeddings(
    model: SentenceTransformer,
    model_name: str,
    concerts: list[dict[str, str]],
    csv_mtime: float,
) -> tuple[np.ndarray, dict[str, int]]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    vectors_path = CACHE_DIR / "concert_embeddings.npy"

    id_to_row = {c["id"]: i for i, c in enumerate(concerts)}

    reload = True
    emb: np.ndarray | None = None
    if META_PATH.is_file() and vectors_path.is_file():
        try:
            meta = json.loads(META_PATH.read_text(encoding="utf-8"))
            if (
                meta.get("csv_mtime") == csv_mtime
                and meta.get("count") == len(concerts)
                and meta.get("embed_text_version") == EMBED_TEXT_VERSION
                and meta.get("embed_model") == model_name
            ):
                emb = np.load(vectors_path)
                if emb.shape[0] == len(concerts):
                    reload = False
        except (json.JSONDecodeError, OSError, ValueError):
            reload = True

    if not reload and emb is not None:
        LOG.info("Loaded cached concert embeddings (%s x %s)", emb.shape[0], emb.shape[1])
        return emb.astype(np.float32, copy=False), id_to_row

    LOG.info("Computing embeddings for %d concerts (first run may take several minutes)…", len(concerts))
    texts = [prefix_passage(concert_embedding_text(c), model_name) for c in concerts]
    emb = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype(np.float32)
    np.save(vectors_path, emb)
    META_PATH.write_text(
        json.dumps(
            {
                "csv_mtime": csv_mtime,
                "count": len(concerts),
                "dim": int(emb.shape[1]),
                "embed_text_version": EMBED_TEXT_VERSION,
                "embed_model": model_name,
            }
        ),
        encoding="utf-8",
    )
    LOG.info("Saved embedding cache to %s", CACHE_DIR)
    return emb, id_to_row


def semantic_ranked_pool(
    sims: np.ndarray,
    concerts: list[dict[str, str]],
    exclude: set[str],
    limit: int,
) -> tuple[list[int], dict[str, int]]:
    """Pure cosine over eligible concerts: upcoming dates, optional availability filter."""
    order = np.argsort(-sims).tolist()
    ranked_idx: list[int] = []
    for i in order:
        c = concerts[i]
        if c["id"] in exclude:
            continue
        if not concert_is_upcoming(c):
            continue
        if not tickets_seem_available(c):
            continue
        ranked_idx.append(i)
        if len(ranked_idx) >= limit:
            break

    ranked_ids = [concerts[j]["id"] for j in ranked_idx]
    rank_by_id = {cid: r for r, cid in enumerate(ranked_ids)}
    return ranked_idx, rank_by_id


def chronological_four(ids4: tuple[str, ...], c_by_id: dict[str, dict[str, str]]) -> list[str] | None:
    pairs: list[tuple[datetime, str]] = []
    for cid in ids4:
        c = c_by_id.get(cid)
        if not c:
            continue
        dt = parse_concert_datetime(c)
        if dt is None:
            return None
        pairs.append((dt, cid))
    if len(pairs) != 4:
        return None
    pairs.sort(key=lambda x: x[0])
    return [cid for _, cid in pairs]


def gaps_ok_ordered(dts: list[datetime], min_gap: int, max_gap: int) -> bool:
    for i in range(3):
        g = (dts[i + 1] - dts[i]).days
        if g < min_gap or g > max_gap:
            return False
    return True


def is_small_room(c: dict[str, str]) -> bool:
    return venue_kind(c.get("room", "")) in ("chambre", "decouverte")


def score_quadruple(
    chrono: list[str],
    rank_by_id: dict[str, int],
    c_by_id: dict[str, dict[str, str]],
) -> float:
    ranks = [rank_by_id[cid] for cid in chrono]
    months = {concert_month_key(c_by_id[cid]) for cid in chrono}
    vk = [venue_kind(c_by_id[cid].get("room", "")) for cid in chrono]

    score = 0.0
    score -= 4.5 * ranks[0]
    score += 3.0 * ranks[3]
    score += 2.2 * len(months)
    score += sum(3.5 for a, b in zip(vk, vk[1:]) if a != b)

    eras = [era_hint(c_by_id[cid]) for cid in chrono]
    score += 1.2 * len(set(eras))

    if sum(1 for cid in chrono if is_small_room(c_by_id[cid])) >= 1:
        score += 6.0
    else:
        score -= 1.8

    ga = sum(1 for v in vk if v == "grand_auditorium")
    if ga >= 4:
        score -= 12.0
    elif ga >= 3:
        score -= 3.5

    for step in range(3):
        p0, p1 = c_by_id[chrono[step]], c_by_id[chrono[step + 1]]
        if era_hint(p0) == era_hint(p1) and venue_kind(p0.get("room", "")) == venue_kind(
            p1.get("room", "")
        ):
            score -= 4.5

    return score


def choose_journey_four(
    ranked_ids_top20: list[str],
    rank_by_id: dict[str, int],
    c_by_id: dict[str, dict[str, str]],
) -> list[str]:
    if len(ranked_ids_top20) < 4:
        return ranked_ids_top20[:4]

    profiles: list[tuple[int, int]] = [
        (
            int(os.environ.get("JOURNEY_GAP_MIN_DAYS", "25")),
            int(os.environ.get("JOURNEY_GAP_MAX_DAYS", "49")),
        ),
        (21, 56),
        (18, 62),
        (14, 75),
        (10, 100),
        (7, 150),
    ]

    for gmin, gmax in profiles:
        best_sc = float("-inf")
        chosen: list[str] | None = None
        for combo in itertools.combinations(ranked_ids_top20, 4):
            ch = chronological_four(combo, c_by_id)
            if ch is None:
                continue
            dts: list[datetime] = []
            valid = True
            for cid in ch:
                d = parse_concert_datetime(c_by_id[cid])
                if d is None:
                    valid = False
                    break
                dts.append(d)
            if not valid:
                continue
            if not gaps_ok_ordered(dts, gmin, gmax):
                continue
            sc = score_quadruple(ch, rank_by_id, c_by_id)
            if sc > best_sc:
                best_sc = sc
                chosen = ch
        if chosen is not None:
            LOG.info("Matched journey gaps %s-%s days between steps", gmin, gmax)
            return chosen

    LOG.warning("No quartet satisfied gap tiers; spaced quartile fallback.")
    dated: list[tuple[datetime, str]] = []
    for cid in ranked_ids_top20:
        d = parse_concert_datetime(c_by_id[cid])
        if d:
            dated.append((d, cid))
    dated.sort(key=lambda x: x[0])
    n = len(dated)
    if n < 4:
        return [cid for _, cid in dated]
    picks_pos = sorted({0, max(1, n // 5), max(2, n // 2), n - 1})
    out: list[str] = []
    for pi in picks_pos:
        cid = dated[pi][1]
        if cid not in out:
            out.append(cid)
        if len(out) >= 4:
            break
    ri = 0
    while len(out) < 4 and ri < n:
        c_loop = dated[ri][1]
        if c_loop not in out:
            out.append(c_loop)
        ri += 1
    dm = {cid: dt for dt, cid in dated}
    out.sort(key=lambda c_id: dm[c_id])
    return out[:4]


def call_openrouter(
    messages: list[dict[str, str]],
    model: str,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not set")

    referer = os.environ.get("OPENROUTER_SITE_URL", "http://localhost:3000")
    title = os.environ.get("OPENROUTER_APP_NAME", "Resonance")

    payload = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.7 if temperature is None else temperature,
        "max_tokens": 900 if max_tokens is None else max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-OpenRouter-Title": title,
    }
    r = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120)
    if (
        r.status_code == 400
        and "response_format" in (r.text or "").lower()
        and "response_format" in payload
    ):
        retry = dict(payload)
        retry.pop("response_format", None)
        r = requests.post(OPENROUTER_URL, headers=headers, json=retry, timeout=120)

    if not r.ok:
        LOG.error("OpenRouter error %s: %s", r.status_code, r.text[:500])
        raise HTTPException(status_code=502, detail="OpenRouter request failed")

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        LOG.error("Unexpected OpenRouter payload: %s", data)
        raise HTTPException(status_code=502, detail="Malformed OpenRouter response") from e


def parse_json_loose(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


class AgentBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    exclude_ids: list[str] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    csv_path = concerts_csv_path()
    mtime = csv_path.stat().st_mtime
    concerts = load_concerts_from_csv(csv_path)
    if not concerts:
        raise RuntimeError(f"No concerts loaded from {csv_path}")

    model_name = embedding_model_name()
    LOG.info("Loading embedding model %s …", model_name)
    t0 = time.perf_counter()
    model = SentenceTransformer(model_name)
    LOG.info("Embedding model ready in %.1fs", time.perf_counter() - t0)

    emb, id_to_row = load_or_compute_embeddings(model, model_name, concerts, mtime)

    STATE["model"] = model
    STATE["embed_model_name"] = model_name
    STATE["concerts"] = concerts
    STATE["embeddings"] = emb
    STATE["id_to_row"] = id_to_row
    STATE["csv_path"] = str(csv_path)
    LOG.info("Backend ready: %d concerts", len(concerts))
    yield
    STATE.clear()


app = FastAPI(title="Resonance Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "concerts": len(STATE.get("concerts", []))}


@app.get("/concert")
def get_concert(id: str = Query(..., min_length=1)):
    id_to_row: dict[str, int] = STATE.get("id_to_row", {})
    concerts: list[dict[str, str]] = STATE.get("concerts", [])
    i = id_to_row.get(id)
    if i is None:
        raise HTTPException(status_code=404, detail="Unknown concert id")
    c = concerts[i]
    return {
        "id": c["id"],
        "title": c.get("title", ""),
        "subtitle": c.get("subtitle", ""),
        "room": c.get("room", ""),
        "genre": c.get("genre", ""),
        "tag1": c.get("tag1", ""),
        "tag2": c.get("tag2", ""),
        "cast": c.get("cast", ""),
        "program": c.get("program", ""),
        "date_iso": c.get("date_iso", ""),
    }


@app.post("/feedback")
def feedback(body: dict[str, Any]):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    log_path = CACHE_DIR / "feedback.jsonl"
    line = json.dumps({"ts": time.time(), **body}, ensure_ascii=False)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    return {"received": True}


@app.post("/agent")
def agent(body: AgentBody):
    model: SentenceTransformer = STATE["model"]
    model_name = str(STATE.get("embed_model_name") or embedding_model_name())
    concerts: list[dict[str, str]] = STATE["concerts"]
    corpus_emb: np.ndarray = STATE["embeddings"]

    msg = body.message.strip()
    exclude = {x.strip() for x in (body.exclude_ids or []) if x and str(x).strip()}

    q_emb = (
        model.encode(
            prefix_query(msg, model_name),
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        .astype(np.float32)
        .reshape(-1)
    )

    sims = corpus_emb @ q_emb

    top_k = int(os.environ.get("TOP_CANDIDATES", "20"))
    _, rank_by_id = semantic_ranked_pool(sims, concerts, exclude, top_k)
    ranked_ids = sorted(rank_by_id.keys(), key=lambda cid: rank_by_id[cid])
    c_by_id = {c["id"]: c for c in concerts}

    if len(ranked_ids) < 4:
        raise HTTPException(
            status_code=502,
            detail="Not enough upcoming concerts for a journey — widen the catalogue or loosen filters.",
        )

    final_four = choose_journey_four(ranked_ids, rank_by_id, c_by_id)

    narr_lines = []
    for step, cid in enumerate(final_four, start=1):
        c = c_by_id[cid]
        sem = rank_by_id.get(cid, 99)
        narr_lines.append(
            f"Step {step} — semantic rank {sem + 1}/20 (1 = closest to user wish). "
            f"Date: {c.get('date_iso')}. Room: {c.get('room')}. "
            f"Title: {c.get('title')}. Subtitle: {c.get('subtitle')}. "
            f"Genre: {c.get('genre')}. Tags: {c.get('tag1')} / {c.get('tag2')}.\n"
            f"Program excerpt: {(c.get('program') or '')[:400]}\n"
            f"Cast excerpt: {(c.get('cast') or '')[:280]}"
        )

    user_block = (
        f"USER WISH:\n{msg}\n\n"
        "FOUR CONCERTS (fixed, chronological by date — earliest is step 1). "
        "Step 1 should read as the comfortable entry point; step 4 as the stretch into discovery.\n"
        "Each row must stay distinct in setting, scale, and era flavour — no copy-paste blurbs.\n\n"
        + "\n\n".join(narr_lines)
    )

    or_model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    content = call_openrouter(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_block},
        ],
        model=or_model,
        temperature=0.55,
        max_tokens=900,
    )

    try:
        data = parse_json_loose(content)
    except json.JSONDecodeError as e:
        LOG.error("LLM JSON parse error: %s | raw=%s", e, content[:800])
        raise HTTPException(status_code=502, detail="Model returned invalid JSON") from e

    message_out = str(data.get("message") or "").strip() or "Votre parcours Resonance"
    arc_out = str(data.get("arc") or "").strip()
    out_path = [{"id": cid} for cid in final_four]

    return {"message": message_out[:200], "arc": arc_out, "path": out_path, "error": None}
