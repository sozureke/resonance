import fs from 'fs'
import path from 'path'
import { Concert } from '@/types/concert'

function parseConcerts(): Concert[] {
  const filePath = path.join(process.cwd(), 'data', 'concerts.csv')
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '') // strip BOM

  const lines = raw.split('\n').filter(Boolean)
  const headers = lines[0].split(';')

  const idx = {
    id: headers.indexOf('ID_ev_booking'),
    date_start: headers.indexOf('date_start'),
    title: headers.indexOf('title'),
    subtitle: headers.indexOf('subtitle'),
    room: headers.indexOf('room'),
    tag1: headers.indexOf('tag1_E'),
    tag2: headers.indexOf('tag2_E'),
    genre: headers.indexOf('genre'),
    cast_full: headers.indexOf('cast_full'),
    program_full: headers.indexOf('program_full'),
  }

  return lines.slice(1).map((line) => {
    // Handle potential quoted fields with semicolons inside
    const cols = line.split(';')
    return {
      id: cols[idx.id]?.trim() ?? '',
      date_start: cols[idx.date_start]?.trim() ?? '',
      title: cols[idx.title]?.trim() ?? '',
      subtitle: cols[idx.subtitle]?.trim() ?? '',
      room: cols[idx.room]?.trim() ?? '',
      tag1: cols[idx.tag1]?.trim() ?? '',
      tag2: cols[idx.tag2]?.trim() ?? '',
      genre: cols[idx.genre]?.trim() ?? '',
      cast_full: cols[idx.cast_full]?.trim() ?? '',
      program_full: cols[idx.program_full]?.trim() ?? '',
    }
  })
    .filter((c) => c.id && c.title)
    .sort((a, b) => {
      const ta = new Date(a.date_start).getTime()
      const tb = new Date(b.date_start).getTime()
      const aOk = !Number.isNaN(ta)
      const bOk = !Number.isNaN(tb)
      if (!aOk && !bOk) return 0
      if (!aOk) return 1
      if (!bOk) return -1
      return tb - ta // plus récent d’abord (2026 → 2024)
    })
}

// Parse once at module level — cached for the lifetime of the process
let _cache: Concert[] | null = null

export function getAllConcerts(): Concert[] {
  if (!_cache) {
    _cache = parseConcerts()
  }
  return _cache
}
