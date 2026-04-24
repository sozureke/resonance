'use client'

import { Concert } from '@/types/concert'

interface Props {
  concerts: Concert[]
  onTagClick?: (tag: string) => void
}

export default function TagCloud({ concerts, onTagClick }: Props) {
  const tagCounts = new Map<string, number>()

  for (const c of concerts) {
    for (const tag of [c.tag1, c.tag2, c.genre].filter(Boolean)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  if (sorted.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map(([tag, count]) => (
        <button
          key={tag}
          onClick={() => onTagClick?.(tag)}
          className="text-sm px-3 py-1.5 rounded-full border border-white/20 text-white/60 hover:border-[#ff1a8a] hover:text-white transition-all"
        >
          {tag}
          <span className="ml-1.5 text-white/30 text-xs">{count}</span>
        </button>
      ))}
    </div>
  )
}
