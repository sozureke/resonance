import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4200').replace(/\/+$/, '')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: payload?.error || 'Backend feedback request failed' },
        { status: res.status }
      )
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[/api/feedback]', err)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
