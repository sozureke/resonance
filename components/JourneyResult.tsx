'use client'

import { useEffect, useState } from 'react'
import { Journey, JourneyConcert } from '@/types/concert'

interface Props {
  journey: Journey
  onClose: () => void
}

const FRAUNCES = "'Fraunces', Georgia, serif"
const MONO = "'JetBrains Mono', monospace"
const INTER_TIGHT = "'Inter Tight', system-ui, sans-serif"

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
      className="px-10 py-10 border-t border-white/[0.08] animate-card-fade-up"
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

      {/* Concert title */}
      <h3
        className="text-white mt-3"
        style={{
          fontFamily: FRAUNCES,
          fontSize: '22px',
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.005em',
        }}
      >
        {concert.title}
      </h3>

      {/* Optional subtitle — same 2-line clamp as performer */}
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

      {/* Performer — max 2 lines, ellipsis */}
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

      {/* Bridge text — narrative connection */}
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

      {/* Mood tags */}
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

export default function JourneyResult({ journey, onClose }: Props) {
  const [reservePhase, setReservePhase] = useState<'idle' | 'pending' | 'done'>('idle')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleReserve = () => {
    if (reservePhase !== 'idle') return
    setReservePhase('pending')
    window.setTimeout(() => {
      setReservePhase('done')
    }, 720)
  }

  const count = journey.concerts.length
  const range = formatRange(journey.concerts)
  const meta = `${count} concert${count === 1 ? '' : 's'}${range ? ` · ${range}` : ''}`

  return (
    <aside
      className="
        absolute z-30 flex flex-col
        bg-[#0a0a0b]
        right-0 left-0 bottom-0
        h-[60vh]
        md:left-auto md:top-0 md:w-1/2 md:h-full
        animate-panel-slide-up md:animate-panel-slide-in
      "
    >
      {/* Header — journey title + meta */}
      <header className="flex-shrink-0 px-10 pt-10 pb-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close journey"
          className="absolute top-6 right-8 text-white/35 hover:text-white/80 transition uppercase tracking-[0.18em]"
          style={{ fontFamily: MONO, fontSize: '10px' }}
        >
          Close
        </button>

        <h2
          className="text-white italic"
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

      {/* Scrollable poster list */}
      <div className="flex-1 overflow-y-auto journey-scroll">
        {journey.concerts.map((concert, i) => (
          <PosterCard key={concert.id} concert={concert} index={i} />
        ))}
      </div>

      {/* Reserve CTA */}
      <div
        className="flex-shrink-0 px-10 pb-10 pt-6 border-t border-white/[0.08] bg-[#0a0a0b] transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          minHeight: reservePhase === 'done' ? '140px' : undefined,
        }}
      >
        <div className="relative min-h-[52px]">
          <div
            className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              reservePhase === 'done'
                ? 'opacity-0 translate-y-1 pointer-events-none'
                : 'opacity-100 translate-y-0'
            }`}
          >
            <button
              type="button"
              onClick={handleReserve}
              disabled={reservePhase !== 'idle'}
              className="
                w-full uppercase
                bg-white text-black
                hover:bg-[#ff4d2e] hover:text-white
                disabled:opacity-90 disabled:pointer-events-none
                transition-[background-color,color,transform] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]
              "
              style={{
                height: '52px',
                fontFamily: INTER_TIGHT,
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.15em',
              }}
            >
              {reservePhase === 'pending' ? (
                <span className="inline-flex items-center justify-center gap-3">
                  <span className="inline-block w-4 h-4 border-2 border-black/35 border-t-black rounded-full animate-spin" />
                  <span>Hold on…</span>
                </span>
              ) : (
                'Reserve this journey'
              )}
            </button>
          </div>

          <div
            className={`absolute inset-x-0 top-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              reservePhase === 'done'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
            aria-live="polite"
          >
            <p
              className="text-center text-white/85"
              style={{ fontFamily: FRAUNCES, fontSize: '16px', lineHeight: 1.45 }}
            >
              You&apos;re on the list. We&apos;ll follow up with booking details shortly.
            </p>
            <p
              className="text-center text-white/40 mt-2 uppercase tracking-[0.14em]"
              style={{ fontFamily: MONO, fontSize: '10px' }}
            >
              No payment taken yet
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
