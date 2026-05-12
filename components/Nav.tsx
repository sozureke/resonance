'use client'

import { useEffect, useState } from 'react'

const NAV_LINKS = [
  'Concerts & Tickets',
  "Kids' Phil",
  'Luxembourg Philharmonic',
  'Participate & Support',
  'Your Visit',
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1360px)')
    const onChange = () => {
      if (mq.matches) setMenuOpen(false)
    }
    mq.addEventListener('change', onChange)
    onChange()
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 md:px-8 flex items-center min-h-14 sm:min-h-16 gap-2 sm:gap-4 min-[1360px]:gap-6 w-full min-w-0">
        <a
          href="/"
          className="flex-shrink-0 flex items-center gap-2 sm:gap-3 text-white no-underline min-w-0"
          onClick={() => setMenuOpen(false)}
        >
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="shrink-0 sm:w-8 sm:h-8">
            <rect width="32" height="32" rx="2" className="fill-white" />
            <text x="6" y="22" fill="#000" fontSize="11" fontFamily="Georgia, serif" fontWeight="700">
              Ph
            </text>
          </svg>
          <span
            className="font-semibold text-[11px] sm:text-sm tracking-wide text-white/95 leading-tight sm:leading-normal"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className="min-[1360px]:hidden">Philharmonie</span>
            <span className="hidden min-[1360px]:inline">Philharmonie Luxembourg</span>
          </span>
        </a>

        <nav className="hidden min-[1360px]:flex items-center justify-center gap-3 min-[1500px]:gap-5 flex-1 min-w-0 px-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-[11px] min-[1500px]:text-[13px] text-white/55 hover:text-white transition-colors text-center leading-tight min-[1360px]:max-w-[8.75rem] min-[1500px]:max-w-none min-[1500px]:whitespace-nowrap no-underline border-b border-transparent hover:border-[#ff1a8a]/60 pb-0.5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1 rounded-full text-white font-medium tracking-wide whitespace-nowrap"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              background: 'linear-gradient(135deg, #ff1a8a, #ff4d2e)',
              boxShadow: '0 0 20px rgba(255, 26, 138, 0.25)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0" aria-hidden />
            <span className="hidden md:inline">Resonance AI</span>
            <span className="md:hidden">AI</span>
          </span>

          <button
            type="button"
            className="text-xs sm:text-sm text-white/75 font-medium hover:text-white transition border border-white/20 hover:border-white/35 rounded px-2 py-1 shrink-0"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            EN
          </button>

          <button
            type="button"
            className="min-[1360px]:hidden p-2 -mr-1 sm:-mr-2 text-white/80 hover:text-white rounded-md hover:bg-white/5 transition shrink-0 touch-manipulation"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              {menuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`min-[1360px]:hidden overflow-hidden transition-[max-height] duration-300 ease-out border-t ${
          menuOpen ? 'max-h-[min(85dvh,32rem)] border-white/[0.06]' : 'max-h-0 border-transparent'
        }`}
      >
        <nav className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col bg-black overflow-y-auto max-h-[min(85dvh,32rem)]">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-white/75 hover:text-white py-3.5 px-1 border-b border-white/[0.06] last:border-0 no-underline transition-colors active:bg-white/5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              onClick={() => setMenuOpen(false)}
            >
              {link}
            </a>
          ))}
          <div className="pt-4 sm:hidden">
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full text-white font-medium"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: 'linear-gradient(135deg, #ff1a8a, #ff4d2e)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/90" aria-hidden />
              Resonance AI
            </span>
          </div>
        </nav>
      </div>
    </header>
  )
}
