'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Journey, JourneyConcert } from '@/types/concert'
import JourneyRefinePad from './JourneyRefinePad'

interface Props {
  journey: Journey
  onRefineSubmit?: (payload: {
    x: number
    y: number
    excludeIds: string[]
  }) => Promise<void>
  onRefineOpenChange?: (open: boolean) => void
  onRefineDragChange?: (dragging: boolean) => void
  onRefineXyChange?: (xy: { x: number; y: number }) => void
  /** Starts the parent’s sequential close animation (Back, Escape, or auto-dismiss after reserve). */
  onRequestExit: () => void
  /** 0 = visible; 1 = fade inner content; 2+ = slide panel off-screen (owned by parent timing). */
  closeAnimStep: number
  /** Fires once when the “saved” confirmation state begins (after tapping reserve). */
  onReserveComplete?: () => void
}

const FRAUNCES = "'Fraunces', Georgia, serif"
const MONO = "'JetBrains Mono', monospace"

const TIMELINE_LINE_MS = 600
const TIMELINE_DOT_STAGGER_MS = 150
/** Progress bar + confirmation visible while this elapses */
const RESERVE_CONFIRM_MS = 3000
/** After the bar completes, hold the message this long before closing the sheet + sphere */
const POST_RESERVE_BEFORE_EXIT_MS = 1500

function formatPosterDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
    const day = d.toLocaleDateString('en-US', { day: 'numeric' })
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    return `${weekday} ${day} ${month}`
  } catch {
    return iso
  }
}

function formatRange(concerts: JourneyConcert[]): string {
  const dates = concerts
    .map((c) => new Date(c.date_start))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (dates.length === 0) return ''
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const first = fmt(dates[0])
  const last = fmt(dates[dates.length - 1])
  return first === last ? first : `${first} — ${last}`
}

function PosterCard({
  concert,
  index,
}: {
  concert: JourneyConcert
  index: number
}) {
  const tags = [concert.tag1, concert.tag2].filter(
    (t): t is string => Boolean(t && t.trim().length > 0),
  )

  return (
    <article
      className="pl-14 pr-10 py-10 border-t border-white/[0.08] animate-card-fade-up"
      style={{
        minHeight: '180px',
        animationDelay: `${200 + index * 150}ms`,
      }}
    >
      {/* Date + venue (venue under date, left-aligned) */}
      <div className="flex flex-col items-start gap-1">
        <span
          className="text-white italic"
          style={{
            fontFamily: FRAUNCES,
            fontSize: '32px',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
          }}
        >
          {formatPosterDate(concert.date_start)}
        </span>
        {concert.room && (
          <span
            className="uppercase"
            style={{
              fontFamily: MONO,
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
            }}
          >
            {concert.room}
          </span>
        )}
      </div>

      {/* Concert title + timeline node */}
      <h3
        className="relative text-white mt-3"
        style={{
          fontFamily: FRAUNCES,
          fontSize: '22px',
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.005em',
        }}
      >
        <span
          aria-hidden
          className="absolute left-[-24px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-gradient-to-br from-[#ff1a8a] to-[#ff8a65] opacity-0 motion-reduce:opacity-100 motion-safe:animate-journey-timeline-dot"
          style={{
            animationDelay: `${TIMELINE_LINE_MS + index * TIMELINE_DOT_STAGGER_MS}ms`,
            animationFillMode: 'forwards',
          }}
        />
        {concert.title}
      </h3>

      {concert.subtitle && (
        <p
          className="mt-2"
          style={{
            fontFamily: FRAUNCES,
            fontSize: '14px',
            color: '#888',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {concert.subtitle}
        </p>
      )}

      {concert.cast_full && (
        <p
          className="mt-1.5"
          style={{
            fontFamily: FRAUNCES,
            fontSize: '14px',
            color: '#888',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {concert.cast_full}
        </p>
      )}

      {concert.bridge && (
        <p
          className="italic"
          style={{
            fontFamily: FRAUNCES,
            fontSize: '15px',
            color: '#ff1a8a',
            lineHeight: 1.55,
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px dashed rgba(255,26,138,0.25)',
          }}
        >
          {concert.bridge}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="border border-white/25 text-white/65 uppercase"
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.08em',
                padding: '4px 10px',
                borderRadius: '999px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

export default function JourneyResult({
  journey,
  onRefineSubmit,
  onRefineOpenChange,
  onRefineDragChange,
  onRefineXyChange,
  onRequestExit,
  closeAnimStep,
  onReserveComplete,
}: Props) {
  const [reservePhase, setReservePhase] = useState<'idle' | 'pending' | 'done'>('idle')
  const [showJourneyLayer, setShowJourneyLayer] = useState(true)
  const [showRefineLayer, setShowRefineLayer] = useState(false)
  const [refineGenerating, setRefineGenerating] = useState(false)
  const autoDismissRef = useRef<number | null>(null)
  const reserveDoneNotifiedRef = useRef(false)

  const isClosing = closeAnimStep > 0

  const handleCancelRefine = useCallback(() => {
    if (refineGenerating) return
    setShowRefineLayer(false)
    onRefineOpenChange?.(false)
    window.setTimeout(() => setShowJourneyLayer(true), 300)
  }, [refineGenerating, onRefineOpenChange])

  const handleTryAgain = () => {
    if (isClosing || !onRefineSubmit || refineGenerating) return
    setShowJourneyLayer(false)
    window.setTimeout(() => {
      setShowRefineLayer(true)
      onRefineOpenChange?.(true)
    }, 300)
  }

  const handleRefineGenerate = async (xy: { x: number; y: number }) => {
    if (!onRefineSubmit || refineGenerating) return
    setRefineGenerating(true)
    try {
      await onRefineSubmit({
        x: xy.x,
        y: xy.y,
        excludeIds: journey.concerts.map((c) => c.id),
      })
      setShowRefineLayer(false)
      onRefineOpenChange?.(false)
      window.setTimeout(() => setShowJourneyLayer(true), 300)
    } catch (err) {
      console.error(err)
    } finally {
      setRefineGenerating(false)
    }
  }

  useEffect(() => {
    if (isClosing && showRefineLayer) {
      setShowRefineLayer(false)
      onRefineOpenChange?.(false)
      setShowJourneyLayer(true)
    }
  }, [isClosing, onRefineOpenChange, showRefineLayer])

  useEffect(() => {
    if (reservePhase === 'done' && !reserveDoneNotifiedRef.current) {
      reserveDoneNotifiedRef.current = true
      onReserveComplete?.()
    }
    if (reservePhase === 'idle') {
      reserveDoneNotifiedRef.current = false
    }
  }, [reservePhase, onReserveComplete])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isClosing) return
      if (showRefineLayer) {
        e.preventDefault()
        handleCancelRefine()
        return
      }
      onRequestExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRequestExit, isClosing, showRefineLayer, handleCancelRefine])

  useEffect(() => {
    if (reservePhase !== 'done' || isClosing) return
    const totalBeforeExit = RESERVE_CONFIRM_MS + POST_RESERVE_BEFORE_EXIT_MS
    autoDismissRef.current = window.setTimeout(() => {
      autoDismissRef.current = null
      onRequestExit()
    }, totalBeforeExit)
    return () => {
      if (autoDismissRef.current != null) {
        window.clearTimeout(autoDismissRef.current)
        autoDismissRef.current = null
      }
    }
  }, [reservePhase, onRequestExit, isClosing])

  const handleReserve = () => {
    if (reservePhase !== 'idle' || isClosing) return
    setReservePhase('pending')
    window.setTimeout(() => setReservePhase('done'), 400)
  }

  const count = journey.concerts.length
  const range = formatRange(journey.concerts)
  const meta = `${count} concert${count === 1 ? '' : 's'}${range ? ` · ${range}` : ''}`

  const innerFade = closeAnimStep >= 1
  /** Exit together with sphere collapse (see HeroSection EXIT_SIMULT_MS, 380ms). */
  const panelSlide = closeAnimStep >= 1

  return (
    <aside
      className={`
        absolute z-30 flex flex-col
        bg-[#0a0a0b]
        right-0 left-0 bottom-0
        h-[60vh]
        md:left-auto md:top-0 md:w-1/2 md:h-full
        transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]
        ${
          panelSlide
            ? '-translate-y-full translate-x-0 md:translate-y-0 md:translate-x-full pointer-events-none'
            : 'translate-x-0 translate-y-0'
        }
        ${closeAnimStep === 0 ? 'animate-panel-slide-up md:animate-panel-slide-in' : ''}
      `}
    >
      <div
        className={`relative flex h-full min-h-0 flex-col transition-opacity duration-[380ms] ease-out ${
          innerFade ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div
          className={`absolute inset-0 z-[1] flex min-h-0 flex-col transition-opacity duration-300 ease-out ${
            showJourneyLayer ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
        <header className="relative flex-shrink-0 px-10 pb-6 pt-10">
          <button
            type="button"
            onClick={() => !isClosing && onRequestExit()}
            disabled={isClosing}
            className="absolute right-8 top-6 uppercase text-[rgba(255,255,255,0.5)] transition-colors hover:text-white disabled:opacity-40"
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              letterSpacing: '0.15em',
            }}
          >
            ← Back
          </button>

          <h2
            className="text-white italic pr-24"
            style={{
              fontFamily: FRAUNCES,
              fontSize: '28px',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            {journey.journey_title}
          </h2>

          <p
            className="text-white/45 mt-2 uppercase tracking-[0.12em]"
            style={{ fontFamily: MONO, fontSize: '11px' }}
          >
            {meta}
          </p>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto journey-scroll">
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-10 h-full w-px origin-top bg-[rgba(255,255,255,0.12)] motion-safe:animate-journey-timeline-line motion-reduce:scale-y-100 motion-reduce:animate-none"
            style={{ left: '32px', transformOrigin: 'top' }}
          />
          {journey.concerts.map((concert, i) => (
            <PosterCard key={concert.id} concert={concert} index={i} />
          ))}
        </div>

        <div
          className="flex-shrink-0 border-t border-white/[0.08] bg-[#0a0a0b] px-10 pb-10 pt-6"
          style={{
            minHeight: reservePhase === 'done' ? '152px' : undefined,
          }}
        >
          <div className="relative min-h-[48px]">
            <div
              className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                reservePhase === 'done'
                  ? 'pointer-events-none -translate-y-1 opacity-0'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              <div
                className={`flex gap-3 ${onRefineSubmit ? 'flex-col-reverse sm:flex-row sm:items-stretch' : 'flex-col'}`}
              >
                <button
                  type="button"
                  onClick={handleReserve}
                  disabled={reservePhase !== 'idle' || isClosing}
                  className={`
                    w-full rounded-none uppercase sm:flex-1
                    border border-solid border-[rgba(255,255,255,0.2)]
                    bg-transparent text-[rgba(255,255,255,0.85)]
                    transition-all duration-300 ease-[ease]
                    hover:border-[#ff1a8a] hover:bg-[rgba(255,26,138,0.06)] hover:text-white
                    disabled:pointer-events-none
                    disabled:hover:border-[rgba(255,255,255,0.2)] disabled:hover:bg-transparent disabled:hover:text-[rgba(255,255,255,0.7)]
                  `}
                  style={{
                    minHeight: '52px',
                    fontFamily: MONO,
                    fontSize: '12px',
                    fontWeight: 500,
                    letterSpacing: '0.22em',
                  }}
                >
                  {reservePhase === 'pending' ? (
                    <span className="inline-flex items-center justify-center gap-3">
                      <span
                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white"
                        aria-hidden
                      />
                      <span>Hold on…</span>
                    </span>
                  ) : (
                    'Reserve this journey'
                  )}
                </button>
                {onRefineSubmit && (
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    disabled={isClosing || refineGenerating || !showJourneyLayer}
                    className="
                      w-full rounded-none uppercase
                      border border-solid border-[rgba(255,255,255,0.22)]
                      bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.78)]
                      transition-all duration-300 ease-[ease]
                      hover:border-[#ff1a8a] hover:bg-[rgba(255,26,138,0.08)] hover:text-white
                      disabled:pointer-events-none disabled:opacity-35
                      sm:w-auto sm:flex-none sm:basis-[34%] sm:px-4
                    "
                    style={{
                      minHeight: '48px',
                      fontFamily: MONO,
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>

            <div
              className={`absolute inset-x-0 top-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                reservePhase === 'done'
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-2 opacity-0'
              }`}
              aria-live="polite"
            >
              <p
                className="text-center text-white/85"
                style={{ fontFamily: FRAUNCES, fontSize: '16px', lineHeight: 1.45 }}
              >
                This journey is saved to your account. Pick up booking whenever you&apos;re ready.
              </p>
              <p
                className="mt-2 text-center uppercase tracking-[0.14em] text-white/40"
                style={{ fontFamily: MONO, fontSize: '10px' }}
              >
                No payment taken yet
              </p>

              <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  key={reservePhase === 'done' ? 'bar-on' : 'bar-off'}
                  className="h-[2px] w-full origin-left motion-safe:animate-reserve-bar-shrink motion-reduce:w-0"
                  style={{
                    background:
                      'linear-gradient(90deg, #ff1a8a 0%, #ff4a9a 22%, #ff6b9d 48%, #ff8a5c 78%, #ffb38a 100%)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        </div>

        <div
          className={`absolute inset-0 z-[2] flex min-h-0 flex-col bg-[#0a0a0b] transition-opacity duration-300 ease-out ${
            showRefineLayer ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={handleCancelRefine}
            disabled={refineGenerating}
            className="absolute right-8 top-6 z-10 uppercase text-[rgba(255,255,255,0.45)] transition-colors hover:text-white disabled:opacity-40"
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              letterSpacing: '0.15em',
            }}
          >
            ← Journey
          </button>
          {onRefineSubmit && (
            <JourneyRefinePad
              previousTitle={journey.journey_title}
              onGenerate={(xy) => void handleRefineGenerate(xy)}
              generating={refineGenerating}
              onXyChange={onRefineXyChange}
              onDragChange={onRefineDragChange}
            />
          )}
        </div>
      </div>
    </aside>
  )
}
