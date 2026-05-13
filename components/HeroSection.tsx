'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import JourneyResult from './JourneyResult'
import { Journey } from '@/types/concert'

const ParticleSphere = dynamic(() => import('./ParticleSphere'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black" />,
})

/** Sphere fades out → panel slides in → sphere reappears on the left with the same shader intro. */
type JourneyRevealPhase = 'idle' | 'sphere_exit' | 'panel_only' | 'split'

const SPHERE_EXIT_MS = 480
const PANEL_SETTLE_MS = 520
/** Extra beat before the sphere fades back in (less abrupt). */
const SPHERE_REENTER_DELAY_MS = 450

interface HeroSectionProps {
  /** Hide concerts / below-fold while searching or showing a journey */
  onBelowFoldHiddenChange?: (hidden: boolean) => void
}

export default function HeroSection({
  onBelowFoldHiddenChange,
}: HeroSectionProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [searchPulse, setSearchPulse] = useState(0)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [introReplayKey, setIntroReplayKey] = useState(0)
  const [revealPhase, setRevealPhase] = useState<JourneyRevealPhase>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const revealTimersRef = useRef<number[]>([])

  const clearRevealTimers = useCallback(() => {
    for (const id of revealTimersRef.current) {
      window.clearTimeout(id)
    }
    revealTimersRef.current = []
  }, [])

  const heroBusy =
    loading || revealPhase !== 'idle' || showResult

  useEffect(() => {
    onBelowFoldHiddenChange?.(heroBusy)
  }, [heroBusy, onBelowFoldHiddenChange])

  const intensity = loading ? 0.9 : 0
  const isListening =
    !loading &&
    revealPhase === 'idle' &&
    !showResult &&
    (isInputFocused || query.trim().length > 0)

  const handleSubmit = async () => {
    const q = query.trim()
    if (!q || loading) return
    setSearchPulse((n) => n + 1)
    setLoading(true)
    clearRevealTimers()
    setShowResult(false)
    setJourney(null)
    setRevealPhase('idle')

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error('API error')
      const data: Journey = await res.json()
      setJourney(data)
      setLoading(false)

      setRevealPhase('sphere_exit')

      const t1 = window.setTimeout(() => {
        setShowResult(true)
        setRevealPhase('panel_only')
      }, SPHERE_EXIT_MS)
      revealTimersRef.current.push(t1)

      const t2 = window.setTimeout(() => {
        setRevealPhase('split')
        setIntroReplayKey((k) => k + 1)
      }, SPHERE_EXIT_MS + PANEL_SETTLE_MS + SPHERE_REENTER_DELAY_MS)
      revealTimersRef.current.push(t2)
    } catch (err) {
      console.error(err)
      setLoading(false)
      setRevealPhase('idle')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const handleClose = () => {
    clearRevealTimers()
    setShowResult(false)
    setJourney(null)
    setQuery('')
    setRevealPhase('idle')
  }

  const splitLayout = showResult && revealPhase !== 'sphere_exit'

  const sphereHidden =
    revealPhase === 'sphere_exit' ||
    revealPhase === 'panel_only'
  const sphereOpacityClass = sphereHidden
    ? 'opacity-0 pointer-events-none'
    : 'opacity-100'

  const sphereScaleClass =
    revealPhase === 'split'
      ? 'scale-[0.8]'
      : 'scale-100'

  const transitionSphere =
    'transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]'

  const showHeroChrome =
    !loading &&
    revealPhase === 'idle' &&
    !showResult

  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      <div
        className={`absolute left-0 top-0 ease-out ${
          splitLayout
            ? 'w-full h-[40vh] md:w-1/2 md:h-full'
            : 'w-full h-full'
        } transition-all duration-500 ease-out`}
      >
        <div
          className={`absolute inset-0 origin-center ${transitionSphere} ${sphereOpacityClass} ${sphereScaleClass}`}
        >
          <ParticleSphere
            isListening={isListening}
            intensity={intensity}
            searchPulse={searchPulse}
            introReplayKey={introReplayKey}
            opacityBoost={revealPhase === 'split' ? 1.8 : 1}
          />
        </div>

        <div
          className={`absolute inset-0 flex flex-col items-center justify-end px-6 z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            showHeroChrome
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          style={{
            paddingBottom: '156px',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
          }}
        >
          <h1
            className="text-white text-2xl md:text-3xl font-serif italic text-center leading-snug mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            What would you like to discover?
          </h1>

          <div className="flex w-full max-w-2xl rounded-sm overflow-hidden border border-white/60 focus-within:border-white transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </div>

          {loading && (
            <p className="text-white/50 text-xs tracking-widest uppercase animate-pulse mt-6">
              Composing your journey...
            </p>
          )}
        </div>
      </div>

      {showResult && journey && (
        <JourneyResult journey={journey} onClose={handleClose} />
      )}
    </section>
  )
}
