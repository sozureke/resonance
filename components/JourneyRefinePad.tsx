'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const FRAUNCES = "'Fraunces', Georgia, serif"
const MONO = "'JetBrains Mono', monospace"

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: '8px',
  lineHeight: 1.2,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.28)',
  whiteSpace: 'nowrap',
}

const Q_COL: Record<'tl' | 'tr' | 'bl' | 'br', string> = {
  tl: '#ff1a8a',
  tr: '#c84dff',
  bl: '#ff4d2e',
  br: '#ff1a5a',
}

const MOOD = {
  tl: {
    label: 'Intimate · Familiar',
    sub: 'Start close to what you know',
  },
  tr: {
    label: 'Intimate · Adventurous',
    sub: 'Small spaces, unexpected sounds',
  },
  bl: {
    label: 'Epic · Familiar',
    sub: 'Grand scale, beloved repertoire',
  },
  br: {
    label: 'Epic · Adventurous',
    sub: 'Push the boundaries entirely',
  },
} as const

type Quad = keyof typeof MOOD

function quadrantFor(xy: { x: number; y: number }): Quad {
  const ix = xy.x < 0.5 ? 'l' : 'r'
  const iy = xy.y < 0.5 ? 't' : 'b'
  if (iy === 't' && ix === 'l') return 'tl'
  if (iy === 't' && ix === 'r') return 'tr'
  if (iy === 'b' && ix === 'l') return 'bl'
  return 'br'
}

/** Dot field behind axes + handle */
function PadDotField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        backgroundColor: 'transparent',
        backgroundImage: `radial-gradient(rgba(255,255,255,0.14) 1.6px, transparent 1.9px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: '9px 9px',
      }}
    />
  )
}

export interface JourneyRefinePadProps {
  previousTitle: string
  initialX?: number
  initialY?: number
  onXyChange?: (xy: { x: number; y: number }) => void
  onDragChange?: (dragging: boolean) => void
  onGenerate: (xy: { x: number; y: number }) => void
  generating?: boolean
}

export default function JourneyRefinePad({
  previousTitle,
  initialX = 0.5,
  initialY = 0.5,
  onXyChange,
  onDragChange,
  onGenerate,
  generating = false,
}: JourneyRefinePadProps) {
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [xy, setXy] = useState({ x: initialX, y: initialY })
  const [textFade, setTextFade] = useState(1)
  const prevQuad = useRef<Quad | null>(null)

  const quad = quadrantFor(xy)
  const cursorColor = Q_COL[quad]

  const HANDLE = 38
  const RING = 56

  useEffect(() => {
    onXyChange?.(xy)
  }, [xy, onXyChange])

  useEffect(() => {
    if (prevQuad.current === null) {
      prevQuad.current = quad
      return
    }
    if (prevQuad.current === quad) return
    prevQuad.current = quad
    setTextFade(0)
    const id = window.setTimeout(() => setTextFade(1), 150)
    return () => window.clearTimeout(id)
  }, [quad])

  const setFromClient = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (clientX - r.left) / Math.max(1, r.width)
    const ny = (clientY - r.top) / Math.max(1, r.height)
    setXy({
      x: Math.min(1, Math.max(0, nx)),
      y: Math.min(1, Math.max(0, ny)),
    })
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (generating) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    onDragChange?.(true)
    setFromClient(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || generating) return
    setFromClient(e.clientX, e.clientY)
  }

  const endDrag = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    onDragChange?.(false)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    endDrag()
  }

  const mood = MOOD[quad]

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ padding: '20px 16px', fontFamily: FRAUNCES }}
    >
      <div className="flex-shrink-0">
        <p
          className="truncate text-[13px] italic text-white/[0.2]"
          style={{ fontFamily: FRAUNCES }}
          title={previousTitle}
        >
          {previousTitle}
        </p>
        <p
          className="mt-1.5 mb-6 text-[24px] italic text-white capitalize"
          style={{ fontFamily: FRAUNCES, marginTop: '6px', marginBottom: '24px' }}
        >
          Refine Your Journey.
        </p>
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative flex flex-col"
          style={{
            width: 'min(100%, 80vh)',
            maxHeight: '100%',
          }}
        >
          <div className="flex w-full items-end justify-between gap-3 px-0.5 pb-2">
            <span style={LABEL_STYLE}>intimate · familiar</span>
            <span style={{ ...LABEL_STYLE, textAlign: 'right' }}>
              intimate · adventurous
            </span>
          </div>

          <div className="relative w-full" style={{ paddingBottom: '100%' }}>
            <div
              ref={padRef}
              role="presentation"
              className="absolute inset-0 z-[1] cursor-crosshair touch-none select-none overflow-hidden"
              style={{
                border: '1px solid #1a1a1a',
                background: '#050505',
                borderRadius: '8px',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <PadDotField />
              <div
                className="pointer-events-none absolute left-0 right-0 top-1/2 z-[1] h-px -translate-y-1/2"
                style={{ background: '#1f1f1f' }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-[1] w-px -translate-x-1/2"
                style={{ background: '#1f1f1f' }}
              />

              <div
                className="pointer-events-none absolute z-[2] rounded-full shadow-lg transition-[colors,box-shadow] duration-300 ease-out"
                style={{
                  left: `${xy.x * 100}%`,
                  top: `${xy.y * 100}%`,
                  width: HANDLE,
                  height: HANDLE,
                  marginLeft: -HANDLE / 2,
                  marginTop: -HANDLE / 2,
                  backgroundColor: cursorColor,
                  boxShadow: `0 0 0 8px ${cursorColor}22, 0 6px 20px rgba(0,0,0,0.55)`,
                }}
              />
              <div
                className="pointer-events-none absolute z-[2] rounded-full transition-[colors,border-color] duration-300 ease-out"
                style={{
                  left: `${xy.x * 100}%`,
                  top: `${xy.y * 100}%`,
                  width: RING,
                  height: RING,
                  marginLeft: -RING / 2,
                  marginTop: -RING / 2,
                  border: `1px solid ${cursorColor}55`,
                }}
              />
            </div>
          </div>

          <div className="flex w-full items-start justify-between gap-3 px-0.5 pt-2">
            <span style={LABEL_STYLE}>epic · familiar</span>
            <span style={{ ...LABEL_STYLE, textAlign: 'right' }}>
              epic · adventurous
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col" style={{ marginTop: '32px' }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#444',
            marginBottom: '6px',
          }}
        >
          direction
        </p>
        <div className="transition-opacity duration-150 ease-out" style={{ opacity: textFade }}>
          <p className="text-white italic" style={{ fontFamily: FRAUNCES, fontSize: '16px' }}>
            {mood.label}
          </p>
          <p className="mt-1 italic text-white/35" style={{ fontFamily: FRAUNCES, fontSize: '12px' }}>
            {mood.sub}
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={() => onGenerate(xy)}
          className={`mt-4 w-full text-center uppercase transition-all duration-200 ${
            generating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'
          }`}
          style={{
            marginTop: '16px',
            padding: '14px 16px',
            border: '1px solid rgba(255,26,138,0.55)',
            background: 'rgba(255,26,138,0.07)',
            color: 'rgba(255,255,255,0.92)',
            fontFamily: MONO,
            fontSize: '10px',
            letterSpacing: '0.16em',
          }}
          onMouseEnter={(e) => {
            if (generating) return
            e.currentTarget.style.borderColor = '#ff1a8a'
            e.currentTarget.style.background = 'rgba(255,26,138,0.14)'
            e.currentTarget.style.color = '#ffffff'
          }}
          onMouseLeave={(e) => {
            if (generating) return
            e.currentTarget.style.borderColor = 'rgba(255,26,138,0.55)'
            e.currentTarget.style.background = 'rgba(255,26,138,0.07)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.92)'
          }}
        >
          {generating ? 'Generating…' : 'Generate again →'}
        </button>
      </div>
    </div>
  )
}
