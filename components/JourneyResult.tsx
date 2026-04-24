'use client'

import { Journey } from '@/types/concert'

interface Props {
  journey: Journey
  onClose: () => void
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-LU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-LU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function JourneyResult({ journey, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-h-[85vh] bg-[#0a0a0a] border-t border-white/10 overflow-y-auto animate-slide-up rounded-t-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/10 px-6 py-4 flex items-start justify-between z-10">
          <h2
            className="text-2xl md:text-3xl text-white italic leading-tight max-w-lg"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {journey.journey_title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-4 mt-1 text-white/50 hover:text-white transition text-xl leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Concert steps */}
        <div className="px-6 py-6 space-y-0">
          {journey.concerts.map((concert, idx) => (
            <div key={concert.id} className="relative">
              {/* Connector line */}
              {idx < journey.concerts.length - 1 && (
                <div className="absolute left-[11px] top-[28px] bottom-0 w-px bg-white/10" />
              )}

              <div className="flex gap-5 pb-8">
                {/* Step indicator */}
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 rounded-full border border-[#ff1a8a] flex items-center justify-center">
                    <span className="text-[#ff1a8a] text-xs font-mono">{idx + 1}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Date + venue */}
                  <div
                    className="text-white/40 text-xs mb-1 tracking-wide"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(concert.date_start)}
                    {formatTime(concert.date_start) && ` · ${formatTime(concert.date_start)}`}
                    {concert.room && ` · ${concert.room}`}
                  </div>

                  {/* Title */}
                  <h3
                    className="text-white text-lg md:text-xl leading-snug mb-1"
                    style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px' }}
                  >
                    {concert.title}
                  </h3>

                  {/* Subtitle */}
                  {concert.subtitle && (
                    <p className="text-white/60 text-sm mb-2">{concert.subtitle}</p>
                  )}

                  {/* Tags */}
                  {(concert.tag1 || concert.tag2) && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {[concert.tag1, concert.tag2].filter(Boolean).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bridge */}
                  {concert.bridge && (
                    <p
                      className="text-sm italic leading-relaxed"
                      style={{ color: '#ff1a8a' }}
                    >
                      {concert.bridge}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-8">
          <button className="w-full max-w-sm mx-auto block py-4 border border-white text-white text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors font-sans font-medium">
            Réserver le parcours
          </button>
        </div>
      </div>
    </div>
  )
}
