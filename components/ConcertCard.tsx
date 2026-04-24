import { Concert } from '@/types/concert'

interface Props {
  concert: Concert
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-LU', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return iso
  }
}

function formatYear(iso: string) {
  try {
    return new Date(iso).getFullYear().toString()
  } catch {
    return ''
  }
}

function extractMainPerformer(castFull: string): string {
  if (!castFull) return ''
  const first = castFull.split('|')[0].trim()
  // Remove role in parentheses for brevity
  return first.replace(/\s*\([^)]+\)/, '').trim()
}

export default function ConcertCard({ concert }: Props) {
  const tags = [concert.tag1, concert.tag2, concert.genre].filter(Boolean)

  return (
    <div className="flex-shrink-0 w-64 md:w-72 bg-[#111] rounded overflow-hidden flex flex-col group cursor-pointer hover:bg-[#181818] transition-colors">
      {/* Photo placeholder */}
      <div
        className="w-full h-40 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #222 50%, #181818 100%)' }}
      >
        {/* Subtle accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
          style={{ background: 'linear-gradient(90deg, #ff1a8a, #ff4d2e)' }}
        />
        {/* Genre text watermark */}
        {concert.genre && (
          <span className="absolute top-3 right-3 text-white/10 text-4xl font-serif italic leading-none select-none"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            {concert.genre.charAt(0)}
          </span>
        )}
        {/* Date badge */}
        <div className="absolute top-3 left-3 text-center">
          <div className="text-white font-bold text-sm leading-tight">{formatDate(concert.date_start)}</div>
          <div className="text-white/50 text-xs">{formatYear(concert.date_start)}</div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3
          className="text-white font-medium text-sm leading-snug line-clamp-2"
          style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px' }}
        >
          {concert.title}
        </h3>

        {concert.subtitle && (
          <p className="text-white/50 text-xs line-clamp-1">{concert.subtitle}</p>
        )}

        <p className="text-white/40 text-xs line-clamp-1">
          {extractMainPerformer(concert.cast_full)}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-auto pt-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Venue */}
        {concert.room && (
          <p
            className="text-white/30 text-[10px] mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {concert.room}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 mt-3">
          <button className="flex-1 text-xs py-2 bg-white text-black font-medium hover:bg-white/90 transition">
            Réservez
          </button>
          <button className="flex-1 text-xs py-2 border border-white/30 text-white/70 hover:border-white hover:text-white transition">
            Plus d&apos;informations
          </button>
        </div>
      </div>
    </div>
  )
}
