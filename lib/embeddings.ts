/**
 * TODO: Replace this mock with real sentence-transformers via Python microservice.
 *
 * Interface contract:
 *   getTopCandidates(query: string, concerts: Concert[], topN: number): Concert[]
 *
 * Real implementation would:
 *   1. POST query to http://localhost:8000/embed → float[]
 *   2. POST concert texts to /embed/batch → float[][]
 *   3. Cosine-rank and return topN
 *
 * The mock below does keyword scoring on title + genre + tags + program_full.
 */

import { Concert } from '@/types/concert'

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-zàâäéèêëîïôùûü\s]/g, ' ').split(/\s+/).filter(Boolean)
}

function scoreKeyword(concert: Concert, queryTokens: string[]): number {
  const searchable = [
    concert.title,
    concert.subtitle,
    concert.genre,
    concert.tag1,
    concert.tag2,
    concert.program_full,
    concert.cast_full,
  ].join(' ')

  const haystack = tokenize(searchable)
  let score = 0
  for (const token of queryTokens) {
    if (token.length < 3) continue
    for (const word of haystack) {
      if (word.includes(token) || token.includes(word)) {
        score += word === token ? 3 : 1
      }
    }
  }
  return score
}

export function getTopCandidates(
  query: string,
  concerts: Concert[],
  topN = 20
): Concert[] {
  const queryTokens = tokenize(query)

  const scored = concerts.map((c) => ({
    concert: c,
    score: scoreKeyword(c, queryTokens),
  }))

  // Sort: scored matches first, then shuffle remainder for variety
  const withScore = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  const withoutScore = scored.filter((x) => x.score === 0).sort(() => Math.random() - 0.5)

  const combined = [...withScore, ...withoutScore].slice(0, topN)
  return combined.map((x) => x.concert)
}
