import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        'inter-tight': ['Inter Tight', 'system-ui', 'sans-serif'],
      },
      colors: {
        pink: {
          resonance: '#ff1a8a',
        },
        orange: {
          resonance: '#ff4d2e',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease',
        'concerts-strip': 'concertsStrip 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'concert-card-in': 'concertCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'tag-cross': 'tagCross 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-slide-in': 'panelSlideIn 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-slide-up': 'panelSlideUp 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'card-fade-up': 'cardFadeUp 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'journey-timeline-line': 'journeyTimelineLine 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'journey-timeline-dot': 'journeyTimelineDot 320ms ease forwards',
        'reserve-bar-shrink': 'reserveBarShrink 3s linear forwards',
        'hero-shimmer': 'heroShimmer 3s ease-in-out infinite alternate',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        concertsStrip: {
          '0%': { opacity: '0', transform: 'translateX(14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        concertCardIn: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        tagCross: {
          '0%': { opacity: '0', transform: 'scale(0.82)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        panelSlideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        panelSlideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        cardFadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        journeyTimelineLine: {
          '0%': { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' },
        },
        journeyTimelineDot: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        reserveBarShrink: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        heroShimmer: {
          '0%': {
            transform: 'translateX(-130%) translateY(-50%)',
          },
          '100%': {
            transform: 'translateX(340%) translateY(-50%)',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
