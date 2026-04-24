import { NextRequest, NextResponse } from 'next/server'
import { getAllConcerts } from '@/lib/concerts'
import { getTopCandidates } from '@/lib/embeddings'
import client from '@/lib/claude'
import { Journey, JourneyConcert } from '@/types/concert'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Resonance — a poetic cultural companion for Philharmonie Luxembourg.
Given a user's musical interest and a curated list of real upcoming concerts, select 3-4 concerts that form a coherent discovery journey.

Rules:
- The journey must feel like a narrative arc, not a random list
- Prefer variety of genre, mood, and date across the journey
- Each bridge (1-2 sentences) explains WHY this concert follows the previous — emotionally, thematically, or historically
- The journey_title should be a short, evocative, italic-worthy phrase in French or English
- Return ONLY valid JSON, no markdown, no commentary

Response schema:
{
  "journey_title": "string",
  "concerts": [
    { "id": "string", "bridge": "string" },
    ...
  ]
}`

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json() as { query: string }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const allConcerts = getAllConcerts()
    const candidates = getTopCandidates(query, allConcerts, 20)

    const candidateSummary = candidates.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      date: c.date_start,
      room: c.room,
      genre: c.genre,
      tags: [c.tag1, c.tag2].filter(Boolean),
      program: c.program_full.slice(0, 200),
      cast: c.cast_full.slice(0, 150),
    }))

    const userMessage = `User's musical interest: "${query}"

Available concerts (choose 3-4 that form the best discovery journey):
${JSON.stringify(candidateSummary, null, 2)}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const claudeResponse = JSON.parse(raw) as { journey_title: string; concerts: { id: string; bridge: string }[] }

    // Build full concert objects with bridges
    const concertMap = new Map(allConcerts.map((c) => [c.id, c]))
    const journeyConcerts: JourneyConcert[] = claudeResponse.concerts
      .map(({ id, bridge }) => {
        const concert = concertMap.get(id)
        if (!concert) return null
        return { ...concert, bridge }
      })
      .filter((c): c is JourneyConcert => c !== null)

    const journey: Journey = {
      journey_title: claudeResponse.journey_title,
      concerts: journeyConcerts,
    }

    return NextResponse.json(journey)
  } catch (err) {
    console.error('[/api/recommend]', err)
    return NextResponse.json({ error: 'Failed to generate journey' }, { status: 500 })
  }
}
