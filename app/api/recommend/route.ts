import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomDisplay } from '@/lib/rooms'
import { Journey, JourneyConcert } from '@/types/concert'
import {
  DISCOVERY_QUERY_INVALID_MESSAGE,
  discoveryQueryErrorMessage,
  validateDiscoveryQuery,
} from '@/lib/queryGuard'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4200').replace(/\/+$/, '')
const DEFAULT_BRIDGES = [
  'The journey opens with a first step aligned with your intent.',
  'This second stop broadens the perspective while keeping the same emotional thread.',
  'Here, the trajectory expands and shifts the way you listen.',
  'The final step closes the journey with a complementary color.',
]

/** Fallback title when the agent does not return an English headline (keeps UI language consistent). */
const DEFAULT_JOURNEY_TITLE = 'Your resonance journey'

type BackendAgentResponse = {
  arc?: string
  message?: string
  path?: Array<{ id?: string }>
  error?: string
}

type BackendConcert = {
  id: string
  title?: string
  subtitle?: string
  room?: string
  genre?: string
  tag1?: string
  tag2?: string
  cast?: string
  program?: string
  date_iso?: string
}

function bridgesFromArc(arc?: string): string[] {
  if (!arc) return DEFAULT_BRIDGES
  const parts = arc
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4)
  if (parts.length === 0) return DEFAULT_BRIDGES
  while (parts.length < 4) {
    parts.push(DEFAULT_BRIDGES[parts.length])
  }
  return parts
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string
      exclude_ids?: unknown
      feedback?: {
        x?: number
        y?: number
        excludeIds?: unknown
      }
    }
    const { query, exclude_ids, feedback } = body
    const trimmed = query?.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const guard = validateDiscoveryQuery(trimmed)
    if (!guard.ok) {
      return NextResponse.json(
        { error: discoveryQueryErrorMessage(guard.reason) },
        { status: 400 },
      )
    }

    const excludesTop = Array.isArray(exclude_ids)
      ? exclude_ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
    const excludesFb =
      feedback && Array.isArray(feedback.excludeIds)
        ? feedback.excludeIds.filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0,
          )
        : []
    const merged = Array.from(new Set([...excludesTop, ...excludesFb]))

    let feedback_x: number | undefined
    let feedback_y: number | undefined
    if (feedback && typeof feedback.x === 'number' && Number.isFinite(feedback.x)) {
      feedback_x = Math.min(1, Math.max(0, feedback.x))
    }
    if (feedback && typeof feedback.y === 'number' && Number.isFinite(feedback.y)) {
      feedback_y = Math.min(1, Math.max(0, feedback.y))
    }

    const agentRes = await fetch(`${BACKEND_URL}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        locale: 'en',
        language: 'en',
        ...(merged.length ? { exclude_ids: merged } : {}),
        ...(feedback_x !== undefined ? { feedback_x } : {}),
        ...(feedback_y !== undefined ? { feedback_y } : {}),
      }),
      cache: 'no-store',
    })
    if (!agentRes.ok) {
      const raw = await agentRes.text().catch(() => '')
      let msg = `Backend agent failed (${agentRes.status})`
      if (agentRes.status === 400) {
        try {
          const j = JSON.parse(raw) as { detail?: string }
          if (typeof j?.detail === 'string' && j.detail.trim()) {
            return NextResponse.json({ error: j.detail.trim() }, { status: 400 })
          }
        } catch {
          /* fall through */
        }
      }
      try {
        const j = JSON.parse(raw) as { detail?: string }
        if (typeof j?.detail === 'string') msg = j.detail
      } catch {
        if (raw.trim()) msg = raw.trim().slice(0, 280)
      }
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const agentPayload = (await agentRes.json()) as BackendAgentResponse
    if (agentPayload.error) {
      return NextResponse.json({ error: agentPayload.error }, { status: 502 })
    }

    const ids = (agentPayload.path ?? [])
      .map((slot) => String(slot?.id ?? '').trim())
      .filter(Boolean)
      .slice(0, 4)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No concerts returned by backend' }, { status: 502 })
    }

    const bridgeTexts = bridgesFromArc(agentPayload.arc)
    const concertsSettled = await Promise.all(
      ids.map(async (id, idx) => {
        const detailRes = await fetch(`${BACKEND_URL}/concert?id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        })
        if (!detailRes.ok) return null
        const c = (await detailRes.json()) as BackendConcert
        const title = c.title ?? ''
        const subtitle = c.subtitle ?? ''
        const item: JourneyConcert = {
          id: c.id,
          date_start: c.date_iso ?? '',
          title,
          subtitle,
          room: resolveRoomDisplay({ room: c.room ?? '', title, subtitle }),
          tag1: c.tag1 ?? '',
          tag2: c.tag2 ?? '',
          genre: c.genre ?? '',
          cast_full: c.cast ?? '',
          program_full: c.program ?? '',
          bridge: bridgeTexts[idx] ?? DEFAULT_BRIDGES[idx] ?? DEFAULT_BRIDGES[DEFAULT_BRIDGES.length - 1],
        }
        return item
      })
    )

    const journeyConcerts = concertsSettled.filter((x): x is JourneyConcert => x !== null)
    if (journeyConcerts.length === 0) {
      return NextResponse.json({ error: 'No valid concerts were resolved' }, { status: 502 })
    }

    const rawTitle = (agentPayload.message || agentPayload.arc || DEFAULT_JOURNEY_TITLE).trim()
    const journey: Journey = {
      journey_title: rawTitle.slice(0, 120) || DEFAULT_JOURNEY_TITLE,
      concerts: journeyConcerts,
    }
    return NextResponse.json(journey)
  } catch (err) {
    console.error('[/api/recommend]', err)
    return NextResponse.json({ error: 'Failed to generate journey' }, { status: 500 })
  }
}
