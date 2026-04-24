'use client'

import { useEffect, useRef, useState } from 'react'
import Nav from '@/components/Nav'
import HeroSection from '@/components/HeroSection'
import ConcertCard from '@/components/ConcertCard'
import TagCloud from '@/components/TagCloud'
import { Concert } from '@/types/concert'

export default function Home() {
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/concerts')
      .then((r) => r.json())
      .then((data) => {
        setConcerts(data.concerts ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Display first 8 concerts for the grid
  const gridConcerts = concerts.slice(0, 8)

  // Collect all genres/tags for the TagCloud
  const uniqueTags = concerts

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })
  }
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })
  }

  return (
    <main className="bg-black min-h-screen">
      <Nav />
      <HeroSection />

      {/* Concert grid section */}
      <section className="bg-black py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[#ff1a8a] text-xs tracking-widest uppercase mb-2">
                Saison 2024–2025
              </p>
              <h2
                className="text-white text-2xl md:text-3xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Concerts à venir
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
                <div key={i} className="flex-shrink-0 w-64 h-80 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-4"
            >
              {gridConcerts.map((concert) => (
                <ConcertCard key={concert.id} concert={concert} />
              ))}
            </div>
          )}

          {/* Tag cloud */}
          {concerts.length > 0 && (
            <div className="mt-12">
              <p className="text-white/30 text-xs tracking-widest uppercase mb-4">
                Explorer par ambiance
              </p>
              <TagCloud concerts={concerts} />
            </div>
          )}
        </div>
      </section>

      {/* Footer strip */}
      <footer className="border-t border-white/10 py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            © 2025 Philharmonie Luxembourg · Resonance est un prototype IA
          </p>
        </div>
      </footer>
    </main>
  )
}
