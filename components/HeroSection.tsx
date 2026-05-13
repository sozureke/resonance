'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import JourneyResult from './JourneyResult'
import { Journey } from '@/types/concert'
import {
  DISCOVERY_QUERY_INVALID_MESSAGE,
  discoveryQueryErrorMessage,
  validateDiscoveryQuery,
} from '@/lib/queryGuard'

const ParticleSphere = dynamic(() => import('./ParticleSphere'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black" />,
})

type JourneyRevealPhase = 'idle' | 'hold' | 'sphere_exit' | 'panel_only' | 'split'

const PRE_COLLAPSE_HOLD_MS = 3600
const OPEN_SPHERE_SHRINK_MS = 580
const PANEL_SETTLE_MS = 620
const SPHERE_REENTER_DELAY_MS = 550

const EXIT_SIMULT_MS = 380
const EXIT_BLACK_HOLD_MS = 1750
const POST_INTRO_HERO_MS = 2600
const SURFACE_REVEAL_FALLBACK_MS = 8000

const DEFAULT_HERO_LABEL = 'What would you like to discover?'
const SAVED_HERO_LABEL = 'Your journey is saved. Explore more?'
const POETIC_FALLBACK_LABEL = 'Ready to discover something new?'

interface HeroSectionProps {
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
  const [queryLoadStart, setQueryLoadStart] = useState<number | null>(null)
  const [queryLoadEnd, setQueryLoadEnd] = useState<number | null>(null)
  const [closeAnimStep, setCloseAnimStep] = useState(0)
  const [exitBlackout, setExitBlackout] = useState(false)
  const [postExitIntroBlock, setPostExitIntroBlock] = useState(false)
  /** After the particle intro completes, fade in input + let the page show the concerts strip. */
  const [surfaceRevealReady, setSurfaceRevealReady] = useState(false)
  const surfaceRevealOpenedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [heroLabelText, setHeroLabelText] = useState(DEFAULT_HERO_LABEL)
  const [heroLabelOpacity, setHeroLabelOpacity] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('')
  const [refinePanelOpen, setRefinePanelOpen] = useState(false)
  const [refineDrag, setRefineDrag] = useState(false)
  const [refineXy, setRefineXy] = useState({ x: 0.5, y: 0.5 })

  type PendingLabel =
    | { kind: 'none' }
    | { kind: 'saved' }
    | { kind: 'poetic'; title: string }
    | { kind: 'fallback_poetic' }
  const pendingLabelRef = useRef<PendingLabel>({ kind: 'none' })
  const pendingAfterSaveExitRef = useRef(false)

  const revealTimersRef = useRef<number[]>([])
  const exitTimersRef = useRef<number[]>([])
  const postIntroTimerRef = useRef<number | null>(null)
  const exitActiveRef = useRef(false)

  const clearRevealTimers = useCallback(() => {
    for (const id of revealTimersRef.current) {
      window.clearTimeout(id)
    }
    revealTimersRef.current = []
  }, [])

  const clearExitTimers = useCallback(() => {
    for (const id of exitTimersRef.current) {
      window.clearTimeout(id)
    }
    exitTimersRef.current = []
  }, [])

  const belowFoldHidden =
    !surfaceRevealReady ||
    loading ||
    postExitIntroBlock ||
    exitBlackout ||
    (closeAnimStep >= 1 && closeAnimStep <= 2) ||
    (closeAnimStep === 0 &&
      !exitBlackout &&
      (revealPhase !== 'idle' || showResult))

  useEffect(() => {
    onBelowFoldHiddenChange?.(belowFoldHidden)
  }, [belowFoldHidden, onBelowFoldHiddenChange])

  useEffect(() => {
    return () => clearExitTimers()
  }, [clearExitTimers])

  const intensity = loading ? 0.38 : 0

  const clearPostIntroTimer = useCallback(() => {
    if (postIntroTimerRef.current != null) {
      window.clearTimeout(postIntroTimerRef.current)
      postIntroTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearPostIntroTimer()
  }, [clearPostIntroTimer])

  const openSurfaceAfterIntro = useCallback(() => {
    if (surfaceRevealOpenedRef.current) return
    surfaceRevealOpenedRef.current = true
    setSurfaceRevealReady(true)
  }, [])

  const transitionToLabel = useCallback((next: string) => {
    setHeroLabelOpacity(0)
    window.setTimeout(() => {
      setHeroLabelText(next)
      window.setTimeout(() => setHeroLabelOpacity(1), 20)
    }, 300)
  }, [])

  const onReserveComplete = useCallback(() => {
    pendingAfterSaveExitRef.current = true
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) openSurfaceAfterIntro()
  }, [openSurfaceAfterIntro])

  useEffect(() => {
    const id = window.setTimeout(openSurfaceAfterIntro, SURFACE_REVEAL_FALLBACK_MS)
    return () => window.clearTimeout(id)
  }, [openSurfaceAfterIntro])

  const handleSubmit = async () => {
    const q = query.trim()
    if (!q || loading || !surfaceRevealReady || revealPhase !== 'idle') return

    const guard = validateDiscoveryQuery(q)
    if (!guard.ok) {
      setSubmitError(discoveryQueryErrorMessage(guard.reason))
      return
    }

    pendingLabelRef.current = { kind: 'none' }
    setHeroLabelText(DEFAULT_HERO_LABEL)
    setHeroLabelOpacity(1)
    setSubmitError(null)
    setSearchPulse((n) => n + 1)
    setLoading(true)
    clearRevealTimers()
    clearExitTimers()
    clearPostIntroTimer()
    exitActiveRef.current = false
    setCloseAnimStep(0)
    setExitBlackout(false)
    setPostExitIntroBlock(false)
    setShowResult(false)
    setJourney(null)
    setRevealPhase('idle')
    setQueryLoadStart(performance.now())
    setQueryLoadEnd(null)

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) {
        let errText = DISCOVERY_QUERY_INVALID_MESSAGE
        try {
          const j = (await res.json()) as { error?: string }
          if (typeof j.error === 'string' && j.error.trim()) {
            errText = j.error.trim()
          }
        } catch {
          /* keep default */
        }
        setSubmitError(errText)
        setLoading(false)
        setRevealPhase('idle')
        setQueryLoadStart(null)
        setQueryLoadEnd(null)
        return
      }
      const data: Journey = await res.json()
      setLastSubmittedQuery(q)
      setQueryLoadEnd(performance.now())
      setJourney(data)
      setLoading(false)

      setRevealPhase('hold')

      const scheduleRevealSequence = () => {
        setRevealPhase('sphere_exit')

        const t1 = window.setTimeout(() => {
          setShowResult(true)
          setRevealPhase('panel_only')
        }, OPEN_SPHERE_SHRINK_MS)
        revealTimersRef.current.push(t1)

        const t2 = window.setTimeout(() => {
          setRevealPhase('split')
          setIntroReplayKey((k) => k + 1)
        }, OPEN_SPHERE_SHRINK_MS + PANEL_SETTLE_MS + SPHERE_REENTER_DELAY_MS)
        revealTimersRef.current.push(t2)
      }

      if (PRE_COLLAPSE_HOLD_MS > 0) {
        const holdId = window.setTimeout(scheduleRevealSequence, PRE_COLLAPSE_HOLD_MS)
        revealTimersRef.current.push(holdId)
      } else {
        scheduleRevealSequence()
      }
    } catch (err) {
      console.error(err)
      setSubmitError(DISCOVERY_QUERY_INVALID_MESSAGE)
      setLoading(false)
      setRevealPhase('idle')
      setQueryLoadStart(null)
      setQueryLoadEnd(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const handleRefineSubmit = useCallback(
    async (payload: { x: number; y: number; excludeIds: string[] }) => {
      const q = lastSubmittedQuery.trim()
      if (!q) throw new Error('Missing original query')
      setLoading(true)
      setQueryLoadStart(performance.now())
      setQueryLoadEnd(null)
      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            feedback: {
              x: payload.x,
              y: payload.y,
              excludeIds: payload.excludeIds,
            },
          }),
        })
        if (!res.ok) {
          let errText = DISCOVERY_QUERY_INVALID_MESSAGE
          try {
            const j = (await res.json()) as { error?: string }
            if (typeof j.error === 'string' && j.error.trim()) errText = j.error.trim()
          } catch {
            /* ignore */
          }
          throw new Error(errText)
        }
        const data = (await res.json()) as Journey
        setQueryLoadEnd(performance.now())
        setJourney(data)
        setLoading(false)
        setRevealPhase('split')
        setShowResult(true)
        setCloseAnimStep(0)
        setIntroReplayKey((k) => k + 1)
      } catch (e) {
        setLoading(false)
        setQueryLoadStart(null)
        setQueryLoadEnd(null)
        throw e
      }
    },
    [lastSubmittedQuery],
  )

  const beginJourneyExit = useCallback(() => {
    if (exitActiveRef.current || closeAnimStep > 0) return
    exitActiveRef.current = true

    const wantSaved = pendingAfterSaveExitRef.current
    pendingAfterSaveExitRef.current = false
    const jt = journey?.journey_title?.trim() ?? ''
    if (wantSaved) {
      pendingLabelRef.current = { kind: 'saved' }
    } else if (jt) {
      pendingLabelRef.current = { kind: 'poetic', title: jt }
    } else {
      pendingLabelRef.current = { kind: 'fallback_poetic' }
    }

    clearRevealTimers()
    clearExitTimers()

    const queue = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      exitTimersRef.current.push(id)
    }

    const tAfterBlack = EXIT_SIMULT_MS + EXIT_BLACK_HOLD_MS

    setCloseAnimStep(1)
    queue(() => {
      setCloseAnimStep(2)
      setExitBlackout(true)
    }, EXIT_SIMULT_MS)
    queue(() => {
      setExitBlackout(false)
      setShowResult(false)
      setJourney(null)
      setQuery('')
      setRevealPhase('idle')
      setQueryLoadStart(null)
      setQueryLoadEnd(null)
      setCloseAnimStep(0)
      setIntroReplayKey((k) => k + 1)
      setRefinePanelOpen(false)
      setRefineDrag(false)
      setPostExitIntroBlock(true)
      clearPostIntroTimer()
      postIntroTimerRef.current = window.setTimeout(() => {
        setPostExitIntroBlock(false)
        exitActiveRef.current = false
        postIntroTimerRef.current = null
      }, POST_INTRO_HERO_MS)
    }, tAfterBlack)
  }, [clearExitTimers, clearPostIntroTimer, clearRevealTimers, journey])

  const splitLayout =
    showResult && revealPhase !== 'sphere_exit' && closeAnimStep < 2

  const openingShrink =
    revealPhase === 'sphere_exit' || revealPhase === 'panel_only'

  const exitingCollapse = closeAnimStep >= 1 && closeAnimStep <= 2

  const refineDimsSphere =
    showResult && closeAnimStep < 2 && refinePanelOpen

  const sphereOpacityClass =
    revealPhase === 'panel_only'
      ? 'opacity-0 pointer-events-none'
      : refineDimsSphere
        ? refineDrag
          ? 'opacity-[0.7]'
          : 'opacity-40'
        : 'opacity-100'

  const sphereScaleClass = exitingCollapse
    ? 'scale-0'
    : openingShrink
      ? 'scale-0'
      : revealPhase === 'split' && closeAnimStep < 2
        ? 'scale-[0.8]'
        : 'scale-100'

  const transitionSphere =
    refineDimsSphere
      ? 'transition-[opacity,transform] duration-300 ease-out'
      : revealPhase === 'sphere_exit'
        ? 'transition-[opacity,transform] duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
        : exitingCollapse
          ? 'transition-[opacity,transform] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
          : 'transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]'

  const layoutShellClass =
    showResult && closeAnimStep >= 2
      ? 'transition-all duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
      : 'transition-all duration-[600ms] ease-out'

  const showHeroChrome =
    surfaceRevealReady &&
    !loading &&
    !postExitIntroBlock &&
    !exitBlackout &&
    revealPhase === 'idle' &&
    !showResult

  const isListening =
    surfaceRevealReady &&
    !loading &&
    !postExitIntroBlock &&
    revealPhase === 'idle' &&
    !showResult &&
    (isInputFocused || query.trim().length > 0)

  useEffect(() => {
    if (!surfaceRevealReady || !showHeroChrome) return
    const p = pendingLabelRef.current
    if (p.kind === 'none') return
    pendingLabelRef.current = { kind: 'none' }

    if (p.kind === 'saved') {
      transitionToLabel(SAVED_HERO_LABEL)
      return
    }
    if (p.kind === 'fallback_poetic') {
      transitionToLabel(POETIC_FALLBACK_LABEL)
      return
    }
    if (p.kind === 'poetic') {
      setHeroLabelOpacity(0)
      const title = p.title
      window.setTimeout(() => {
        void (async () => {
          let q = POETIC_FALLBACK_LABEL
          try {
            const res = await fetch('/api/hero-question', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ journeyTitle: title }),
            })
            const data = (await res.json()) as { question?: string }
            if (typeof data.question === 'string' && data.question.trim()) {
              q = data.question.trim()
            }
          } catch {
            q = POETIC_FALLBACK_LABEL
          }
          setHeroLabelText(q)
          window.setTimeout(() => setHeroLabelOpacity(1), 20)
        })()
      }, 300)
    }
  }, [surfaceRevealReady, showHeroChrome, transitionToLabel])

  return (
    <section className="relative w-full h-screen min-h-0 bg-black overflow-hidden">
      <div
        className={`absolute left-0 top-0 ease-out ${
          splitLayout
            ? 'w-full h-[40vh] md:w-1/2 md:h-full'
            : 'w-full h-full'
        } ${layoutShellClass}`}
      >
        <div
          className={`absolute inset-0 origin-center ${transitionSphere} ${sphereOpacityClass} ${sphereScaleClass}`}
        >
          <ParticleSphere
            isListening={isListening}
            intensity={intensity}
            searchPulse={searchPulse}
            introReplayKey={introReplayKey}
            opacityBoost={
              revealPhase === 'split' && closeAnimStep < 2 ? 1.8 : 1
            }
            queryLoadStart={queryLoadStart}
            queryLoadEnd={queryLoadEnd}
            journeyPanelOpen={showResult && closeAnimStep < 2}
            xyPadOpen={refinePanelOpen}
            xyNorm={refineXy}
            xyDragging={refineDrag}
            onIntroComplete={openSurfaceAfterIntro}
          />
        </div>

        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-end px-6 transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[opacity] ${
            postExitIntroBlock ? 'duration-[900ms]' : 'duration-[650ms]'
          } ${
            showHeroChrome
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            paddingBottom: '212px',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.58) 0%, transparent 100%)',
          }}
        >
          <div className="flex w-full max-w-[480px] flex-col items-center text-center">
            <label
              htmlFor="hero-journey-query"
              className="mb-3 block min-h-[1.4em] max-w-[40rem] font-fraunces text-[24px] leading-[1.15] italic text-[rgba(255,255,255,0.5)] [letter-spacing:0.03em] transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ opacity: heroLabelOpacity }}
            >
              {heroLabelText}
            </label>

            <input
              id="hero-journey-query"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSubmitError(null)
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Take me somewhere I've never been..."
              autoComplete="off"
              className="
                w-full max-w-[480px] bg-transparent px-0 py-1.5 text-center
                font-fraunces text-[16px] italic leading-relaxed tracking-[-0.01em] text-white caret-[#ff1a8a] outline-none
                placeholder:text-[rgba(255,255,255,0.28)] placeholder:transition-opacity placeholder:duration-300
                focus:placeholder:opacity-0
              "
            />

            <div
              className="relative mt-0 h-px w-full max-w-[480px] overflow-hidden bg-[rgba(255,255,255,0.10)]"
              aria-hidden
            >
              <div
                className="absolute left-0 top-1/2 w-[44%] h-px animate-hero-shimmer bg-gradient-to-r from-transparent via-[#ff1a8a] to-transparent opacity-90"
              />
            </div>

            <div className="mt-6 flex min-h-[36px] w-full max-w-[480px] items-center justify-center">
              <p
                className={`text-center font-mono text-[10px] uppercase tracking-[0.15em] transition-opacity duration-300 ${
                  isInputFocused
                    ? 'text-[rgba(255,255,255,0.45)]'
                    : 'text-[rgba(255,255,255,0.25)]'
                }`}
              >
                press enter to discover
              </p>
            </div>

            {submitError && (
              <p
                role="alert"
                className="mt-4 max-w-[480px] text-center font-fraunces text-[13px] italic leading-snug text-[#ff6b9d]"
              >
                {submitError}
              </p>
            )}
          </div>
        </div>
      </div>

      {showResult && journey && (
        <JourneyResult
          journey={journey}
          onRefineSubmit={handleRefineSubmit}
          onRefineOpenChange={setRefinePanelOpen}
          onRefineDragChange={setRefineDrag}
          onRefineXyChange={setRefineXy}
          onRequestExit={beginJourneyExit}
          closeAnimStep={closeAnimStep}
          onReserveComplete={onReserveComplete}
        />
      )}

      {exitBlackout && (
        <div
          className="fixed inset-0 z-[100] bg-black pointer-events-none"
          aria-hidden
        />
      )}
    </section>
  )
}
