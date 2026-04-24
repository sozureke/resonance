'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import JourneyResult from './JourneyResult'
import { Journey } from '@/types/concert'

const ParticleSphere = dynamic(() => import('./ParticleSphere'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black" />,
})

export default function HeroSection() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [showResult, setShowResult] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const intensity = loading ? 0.9 : 0

  const handleSubmit = async () => {
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setShowResult(false)
    setJourney(null)

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error('API error')
      const data: Journey = await res.json()
      setJourney(data)
      setShowResult(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const handleClose = () => {
    setShowResult(false)
    setJourney(null)
    setQuery('')
  }

  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      {/* Particle sphere — full section */}
      <div className="absolute inset-0">
        <ParticleSphere focused={focused} intensity={intensity} />
      </div>

      {/* Bottom-third overlay */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-16 px-6 gap-6 z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>

        <h1 className="text-white text-2xl md:text-3xl font-serif italic text-center leading-snug"
          style={{ fontFamily: "'Playfair Display', serif" }}>
          Qu&apos;est-ce que vous voulez découvrir&nbsp;?
        </h1>

        {/* Input row */}
        <div className="flex w-full max-w-2xl rounded-sm overflow-hidden border border-white/60 focus-within:border-white transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Late Baroque, something melancholic, surprise me…"
            className="flex-1 bg-black text-white placeholder-white/40 text-sm md:text-base px-5 py-4 outline-none font-sans"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            aria-label="Search"
            className="bg-black border-l border-white/30 px-5 flex items-center justify-center text-white hover:bg-white/10 transition disabled:opacity-30"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        </div>

        {loading && (
          <p className="text-white/50 text-xs tracking-widest uppercase animate-pulse">
            Composing your journey…
          </p>
        )}
      </div>

      {/* Journey result panel */}
      {showResult && journey && (
        <JourneyResult journey={journey} onClose={handleClose} />
      )}
    </section>
  )
}
