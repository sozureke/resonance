import { NextResponse } from 'next/server'
import { getAllConcerts } from '@/lib/concerts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const concerts = getAllConcerts()
    return NextResponse.json({ concerts })
  } catch (err) {
    console.error('[/api/concerts]', err)
    return NextResponse.json({ error: 'Failed to load concerts' }, { status: 500 })
  }
}
