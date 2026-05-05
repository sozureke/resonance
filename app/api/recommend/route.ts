import { NextRequest, NextResponse } from 'next/server'
import { Journey, JourneyConcert } from '@/types/concert'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4200').replace(/\/+$/, '')
const DEFAULT_BRIDGES = [
  'Le parcours s ouvre sur cette premiere etape, proche de votre intention.',
  'Cette deuxieme halte elargit la perspective tout en gardant le fil emotionnel.',
  'Ici, la trajectoire prend de l ampleur et fait basculer l ecoute.',
  'La derniere etape referme le voyage avec une couleur complementaire.',
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
    const { query } = (await req.json()) as { query?: string }
    const trimmed = query?.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const agentRes = await fetch(`${BACKEND_URL}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
      cache: 'no-store',
    })
    if (!agentRes.ok) {
      return NextResponse.json({ error: 'Backend agent request failed' }, { status: 502 })
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
      journey_title: (agentPayload.message || agentPayload.arc || 'Votre parcours Resonance').slice(0, 120),
      concerts: journeyConcerts,
    }
    return NextResponse.json(journey)
  } catch (err) {
    console.error('[/api/recommend]', err)
    return NextResponse.json({ error: 'Failed to generate journey' }, { status: 500 })
  }
}
