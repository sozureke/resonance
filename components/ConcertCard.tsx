import { resolveRoomDisplay } from '@/lib/rooms'
import { Concert } from '@/types/concert'

interface Props {
  concert: Concert
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
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

function compactTags(concert: Concert): string[] {
  const source = [concert.tag1, concert.genre, concert.tag2]
    .filter((t): t is string => Boolean(t) && t !== '0')
    .map((t) => t.trim())

  return Array.from(new Set(source)).slice(0, 2)
}

export default function ConcertCard({ concert }: Props) {
  const tags = compactTags(concert)
  const roomText = resolveRoomDisplay({
    room: concert.room,
    title: concert.title,
    subtitle: concert.subtitle,
  })
  const tagsTitle = tags.length > 0 ? tags.join(', ') : undefined

  return (
    <div className="flex-shrink-0 w-64 md:w-72 h-[446px] md:h-[460px] bg-[#111] rounded overflow-hidden flex flex-col">
      {/* Photo placeholder */}
      <div
        className="w-full h-[170px] md:h-[186px] shrink-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #222 50%, #181818 100%)' }}
      >
        {/* Subtle accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
          style={{ background: 'linear-gradient(90deg, #ff1a8a, #ff4d2e)' }}
        />
        {/* Genre text watermark */}
        {concert.genre && concert.genre !== '0' && (
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

      {/* Demo card: only core info for visual consistency */}
      <div className="flex flex-1 flex-col min-h-0 p-3 pt-2.5 justify-between">
        <div className="shrink-0 flex flex-col gap-1">
          <h3
            className="text-white font-medium leading-snug line-clamp-2 min-h-[2.625rem]"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px' }}
            title={concert.title}
          >
            {concert.title}
          </h3>

          <p
            className="text-white/45 text-xs tracking-wide uppercase line-clamp-1 min-h-[1.25rem]"
            title={formatYear(concert.date_start) || undefined}
          >
            Visual season {formatYear(concert.date_start) || '2026'}
          </p>

          <div
            className="mt-2 shrink-0 h-[4rem] flex flex-wrap content-start gap-2 overflow-hidden min-w-0"
            title={tagsTitle}
          >
            {tags.length > 0 ? (
              tags.map((tag) => (
                <span
                  key={tag}
                  title={tag}
                  className="w-fit max-w-full min-w-0 truncate inline-block text-[10px] font-medium tracking-wide px-2.5 py-0.5 rounded-full border border-white/20 bg-white/[0.08] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="h-px w-full opacity-0 pointer-events-none" aria-hidden>
                &nbsp;
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2 pt-1.5">
          <p
            className="text-white/35 text-[10px] leading-snug line-clamp-2 min-h-[2.25rem]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            title={roomText || undefined}
          >
            {roomText || '\u00a0'}
          </p>

          <a
            href="/"
            className="block w-full shrink-0 text-center text-xs py-[0.4375rem] border border-white/30 text-white/70 hover:border-white hover:bg-white hover:text-black transition-colors"
          >
            More information
          </a>
        </div>
      </div>
    </div>
  )
}
