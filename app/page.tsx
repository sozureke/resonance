'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import HeroSection from '@/components/HeroSection'
import ConcertCard from '@/components/ConcertCard'
import TagCloud from '@/components/TagCloud'
import { Concert } from '@/types/concert'

function concertHasTag(concert: Concert, tag: string) {
  return [concert.tag1, concert.tag2, concert.genre].some((t) => t === tag)
}

const GRID_ROW_LIMIT = 48

export default function Home() {
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [hideBelowHero, setHideBelowHero] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [activeTag])

  /** Journey / search mode locks the page to the hero viewport; reset scroll so the sphere does not appear to “jump” after the strip collapses. */
  useEffect(() => {
    if (hideBelowHero) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [hideBelowHero])

  useEffect(() => {
    fetch('/api/concerts')
      .then((r) => r.json())
      .then((data) => {
        setConcerts(data.concerts ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const gridConcerts = useMemo(() => {
    const filtered = activeTag
      ? concerts.filter((c) => concertHasTag(c, activeTag))
      : concerts
    return filtered.slice(0, GRID_ROW_LIMIT)
  }, [concerts, activeTag])

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })
  }
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })
  }

  return (
    <main
      className={`bg-black flex flex-col ${
        hideBelowHero
          ? 'h-screen max-h-screen min-h-0 overflow-hidden'
          : 'min-h-screen'
      }`}
    >
      {/* Hero owns the viewport while below-the-fold is hidden so the sphere does not reflow when the strip collapses. */}
      <div
        className={
          hideBelowHero ? 'relative min-h-0 flex-1 flex flex-col' : 'shrink-0'
        }
      >
        <HeroSection onBelowFoldHiddenChange={setHideBelowHero} />
      </div>

      {/* Concert grid — padding only when visible; collapsed track is flex-none + h-0 so it reserves zero space */}
      <section
        className={`bg-black px-4 md:px-8 shrink-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          hideBelowHero
            ? 'h-0 min-h-0 max-h-0 overflow-hidden py-0 m-0 opacity-0 pointer-events-none border-0'
            : 'py-16 opacity-100 overflow-visible'
        }`}
        aria-hidden={hideBelowHero}
      >
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[#ff1a8a] text-xs tracking-widest uppercase mb-2">
                Season 2024-2026
              </p>
              <h2
                className="text-white text-2xl md:text-3xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Upcoming Concerts
              </h2>
            </div>
            {/* Scroll arrows */}
            <div className="flex gap-2">
              <button
                onClick={scrollLeft}
                className="w-10 h-10 border border-white/20 text-white/60 hover:border-white hover:text-white transition flex items-center justify-center"
              >
                ←
              </button>
              <button
                onClick={scrollRight}
                className="w-10 h-10 border border-white/20 text-white/60 hover:border-white hover:text-white transition flex items-center justify-center"
              >
                →
              </button>
            </div>
          </div>

          {/* Horizontal scroll row */}
          {loading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-64 md:w-72 h-[446px] md:h-[460px] bg-white/5 rounded animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-4"
            >
              {gridConcerts.length === 0 ? (
                <div
                  key={activeTag ?? '__empty'}
                  className="animate-concerts-strip py-8"
                >
                  <p className="text-white/45 text-sm mb-4">
                    No concerts are currently available in this category.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="text-[#ff1a8a] text-xs tracking-wide underline-offset-4 hover:text-white hover:underline"
                  >
                    Show all concerts
                  </button>
                </div>
              ) : (
                <div
                  key={activeTag ?? '__all'}
                  className="flex gap-4 animate-concerts-strip"
                >
                  {gridConcerts.map((concert, i) => (
                    <div
                      key={concert.id}
                      className="flex-shrink-0 animate-concert-card-in"
                      style={{ animationDelay: `${Math.min(i, 14) * 38}ms` }}
                    >
                      <ConcertCard concert={concert} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tag cloud */}
          {concerts.length > 0 && (
            <div className="mt-12">
              <TagCloud
                concerts={concerts}
                activeTag={activeTag}
                onTagClick={(tag) =>
                  setActiveTag((prev) => (prev === tag ? null : tag))
                }
              />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
