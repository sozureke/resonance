'use client'

import { Concert } from '@/types/concert'

interface Props {
  concerts: Concert[]
  activeTag?: string | null
  onTagClick?: (tag: string) => void
}

export default function TagCloud({ concerts, activeTag, onTagClick }: Props) {
  const tagCounts = new Map<string, number>()

  for (const c of concerts) {
    for (const tag of [c.tag1, c.tag2, c.genre].filter(
      (t): t is string => Boolean(t) && t !== '0'
    )) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  if (sorted.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map(([tag, count]) => {
        const active = activeTag === tag
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onTagClick?.(tag)}
            title={active ? 'Clear category filter' : undefined}
            className={`group inline-flex items-center gap-1.5 text-sm py-1.5 pl-3 pr-2 rounded-full border transition-all duration-300 ease-out ${
              active
                ? 'border-[#ff1a8a] text-white bg-[#ff1a8a]/15 pr-1.5'
                : 'border-white/20 text-white/60 hover:border-[#ff1a8a] hover:text-white'
            }`}
            aria-pressed={active}
          >
            <span>{tag}</span>
            <span className="text-white/30 text-xs tabular-nums">{count}</span>
            <span
              className={`flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 ease-out ${
                active
                  ? 'ml-0.5 w-6 h-6 opacity-100 animate-tag-cross'
                  : 'w-0 h-6 opacity-0 pointer-events-none'
              }`}
              aria-hidden={!active}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/25 text-white/80 text-sm leading-none hover:bg-white/10 hover:text-white transition-colors">
                ×
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
