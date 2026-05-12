import { NextRequest, NextResponse } from 'next/server'
import { Journey, JourneyConcert } from '@/types/concert'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4200').replace(/\/+$/, '')
const DEFAULT_BRIDGES = [
  'The journey opens with a first step aligned with your intent.',
  'This second stop broadens the perspective while keeping the same emotional thread.',
  'Here, the trajectory expands and shifts the way you listen.',
  'The final step closes the journey with a complementary color.',
]

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
    const { query, exclude_ids } = (await req.json()) as {
      query?: string
      exclude_ids?: unknown
    }
    const trimmed = query?.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const excludes = Array.isArray(exclude_ids)
      ? exclude_ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : undefined

    const agentRes = await fetch(`${BACKEND_URL}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        ...(excludes?.length ? { exclude_ids: excludes } : {}),
      }),
      cache: 'no-store',
    })
    if (!agentRes.ok) {
      const raw = await agentRes.text().catch(() => '')
      let msg = `Backend agent failed (${agentRes.status})`
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
        const item: JourneyConcert = {
          id: c.id,
          date_start: c.date_iso ?? '',
          title: c.title ?? '',
          subtitle: c.subtitle ?? '',
          room: c.room ?? '',
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

    const journey: Journey = {
      journey_title: (agentPayload.message || agentPayload.arc || 'Your Resonance journey').slice(0, 120),
      concerts: journeyConcerts,
    }
    return NextResponse.json(journey)
  } catch (err) {
    console.error('[/api/recommend]', err)
    return NextResponse.json({ error: 'Failed to generate journey' }, { status: 500 })
  }
}
