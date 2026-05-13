import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const FALLBACK = 'Ready to discover something new?'

function safeJourneyTitleForPrompt(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function capitalizeFirstWord(s: string): string {
  const t = s.trim()
  if (!t) return t
  const first = t[0]
  if (!first) return t
  return first.toUpperCase() + t.slice(1)
}

function sanitizeLine(raw: string): string {
  let s = raw.trim().split('\n')[0] ?? ''
  s = s.replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, '')
  s = s.toLowerCase()
  s = s.replace(/[!.,;:]+$/g, '')
  if (!s.endsWith('?')) s += '?'
  const words = s.replace(/\?$/, '').split(/\s+/).filter(Boolean)
  if (words.length > 7) {
    s = `${words.slice(0, 7).join(' ')}?`
  }
  return capitalizeFirstWord(s)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { journeyTitle?: string }
    const title = safeJourneyTitleForPrompt(body.journeyTitle ?? '')
    if (!title) {
      return NextResponse.json({ question: FALLBACK })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ question: FALLBACK })
    }

    const client = new Anthropic({ apiKey })
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022'

    const userPrompt = `Generate a short poetic question (max 7 words, English, normal sentence casing, ending with ?; no other punctuation) that invites the user to explore more music, based on this journey title: ${title}. Examples: 'Ready to go deeper?', 'Where shall we travel next?', 'Curious about what lies beyond?' Return only the question, nothing else.`

    const msg = await client.messages.create({
      model,
      max_tokens: 80,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = msg.content[0]
    const text = block.type === 'text' ? block.text : ''
    if (!text.trim()) {
      return NextResponse.json({ question: FALLBACK })
    }

    const q = sanitizeLine(text)
    return NextResponse.json({ question: q || FALLBACK })
  } catch {
    return NextResponse.json({ question: FALLBACK })
  }
}
