'use client'

import { useEffect, useRef, useState } from 'react'
import {
  NARRATIVE_NODES,
  NARRATIVE_PATH_D,
  NARRATIVE_PATH_VIEWBOX,
  NarrativeViewModel,
} from '@/components/narrativeTimeline'

interface Props {
  model: NarrativeViewModel | null
  visible: boolean
}

export default function NarrativeLayer({ model, visible }: Props) {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(1)

  useEffect(() => {
    const nextLength = pathRef.current?.getTotalLength()
    if (nextLength && Number.isFinite(nextLength)) {
      setPathLength(nextLength)
    }
  }, [])

  if (!visible || !model) return null

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <svg viewBox={NARRATIVE_PATH_VIEWBOX} className="absolute inset-0 w-full h-full overflow-visible">
        <path
          ref={pathRef}
          d={NARRATIVE_PATH_D}
          fill="none"
          stroke="rgba(255, 26, 138, 0.14)"
          strokeWidth="0.42"
          strokeLinecap="round"
        />
        <path
          d={NARRATIVE_PATH_D}
          fill="none"
          stroke="url(#narrativePathGradient)"
          strokeWidth="0.48"
          strokeLinecap="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - model.pathProgress)}
          style={{ transition: 'stroke-dashoffset 90ms linear' }}
        />
        <defs>
          <linearGradient id="narrativePathGradient" x1="10%" y1="10%" x2="92%" y2="72%">
            <stop offset="0%" stopColor="#ff1a8a" />
            <stop offset="45%" stopColor="#ff6b9d" />
            <stop offset="78%" stopColor="#ff8a5c" />
            <stop offset="100%" stopColor="#ffd8ea" />
          </linearGradient>
        </defs>
      </svg>

      {NARRATIVE_NODES.map((node, idx) => {
        const nodeState = model.nodeStates[idx] ?? 'hidden'
        const step = model.steps[idx]
        const isVisible = nodeState !== 'hidden'
        const isActiveNode = nodeState === 'active'
        const textDone = step?.status === 'done'
        const textActive = step?.status === 'active'

        return (
          <div key={`${node.x}-${node.y}`} className="absolute" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
            <div
              className={`absolute -left-[7px] -top-[7px] w-[14px] h-[14px] rounded-full border border-[#ffb7d8]/70 transition-all duration-500 ${
                isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              } ${isActiveNode ? 'animate-pulse' : ''}`}
              style={{ boxShadow: '0 0 22px rgba(255,26,138,0.55)' }}
            />
            <div
              className={`absolute -left-[3px] -top-[3px] w-[6px] h-[6px] rounded-full bg-[#ffd2e6] transition-all duration-500 ${
                isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              style={{ boxShadow: '0 0 14px rgba(255, 141, 193, 0.95)' }}
            />

            {step && (
              <div
                className={`absolute left-5 -top-2 w-[280px] md:w-[320px] transition-all duration-500 ${
                  step.status === 'hidden' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                }`}
              >
                <p className="text-[10px] tracking-[0.2em] uppercase text-white/45 mb-1">Step {idx + 1}</p>
                <p className="text-[13px] md:text-[14px] leading-relaxed text-white/88">
                  {step.renderedText}
                  {textActive && <span className="inline-block w-[8px] h-[1em] ml-1 bg-[#ffd2e6]/90 animate-pulse" />}
                </p>
                <p className={`text-[11px] mt-1 transition ${textDone ? 'text-white/55' : 'text-white/35'}`}>
                  {step.title}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
