import { resolveRoomDisplay } from '@/lib/rooms'
import { Journey, JourneyConcert } from '@/types/concert'

export type NarrativeNodeState = 'hidden' | 'active' | 'done'
export type NarrativeStoryState = 'hidden' | 'active' | 'done'

export const NARRATIVE_PATH_VIEWBOX = '0 0 100 100'
export const NARRATIVE_PATH_D =
  'M 14 18 C 20 19, 28 21, 36 26 C 45 32, 53 41, 62 50 C 70 57, 79 63, 88 68'
export const NARRATIVE_NODES = [
  { x: 29, y: 23, pathT: 0.23 },
  { x: 46, y: 34, pathT: 0.46 },
  { x: 64, y: 51, pathT: 0.69 },
  { x: 84, y: 66, pathT: 0.9 },
]

interface StoryStepPlan {
  id: string
  title: string
  text: string
  typingMarksMs: number[]
  typingMs: number
  holdMs: number
  startMs: number
  endMs: number
}

export interface NarrativePlan {
  thinkingMs: number
  collapsingMs: number
  seedMs: number
  pathDrawingMs: number
  nodesHoldMs: number
  storyMs: number
  totalMs: number
  boundaries: {
    thinkingEnd: number
    collapsingEnd: number
    seedEnd: number
    pathEnd: number
    nodesEnd: number
    storyEnd: number
  }
  steps: StoryStepPlan[]
}

export interface NarrativeStepView {
  id: string
  title: string
  text: string
  renderedText: string
  status: NarrativeStoryState
}

export interface NarrativeViewModel {
  phase: 'thinking' | 'collapsing' | 'seed' | 'pathDrawing' | 'nodesReveal' | 'storyTyping' | 'actions'
  pathProgress: number
  nodeStates: NarrativeNodeState[]
  steps: NarrativeStepView[]
  elapsedMs: number
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function easeOutCubic(t: number) {
  const x = clamp01(t)
  return 1 - Math.pow(1 - x, 3)
}

function formatConcertDate(dateIso: string) {
  if (!dateIso) return 'one of your next nights in Luxembourg'
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return 'one of your next nights in Luxembourg'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function fallback(value: string | undefined, next: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : next
}

function composeStoryText(concert: JourneyConcert, index: number) {
  const title = fallback(concert.title, `Concert ${index + 1}`)
  const room = resolveRoomDisplay({
    room: concert.room,
    title: concert.title,
    subtitle: concert.subtitle,
  })
  const genre = fallback(concert.genre, 'a luminous program')
  const bridge = fallback(concert.bridge, 'The thread keeps opening for you.')
  const dateText = formatConcertDate(concert.date_start)
  return `You begin with "${title}" in ${room} on ${dateText}. ${bridge} ${genre} meets your pulse without forcing it.`
}

function buildTypingMarks(text: string, reducedMotion: boolean) {
  const marks: number[] = []
  let t = 0
  const baseMs = reducedMotion ? 9 : 28
  const punctuationPause = reducedMotion ? 30 : 150

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    let next = baseMs
    if (ch === ' ') next *= 0.52
    if (ch === '\n') next *= 0.22
    if (/[,:;.!?]/.test(ch)) next += punctuationPause
    t += next
    marks.push(t)
  }

  return marks
}

function typedCharsAt(marks: number[], elapsedMs: number) {
  if (marks.length === 0) return 0
  if (elapsedMs <= 0) return 0
  if (elapsedMs >= marks[marks.length - 1]) return marks.length

  let lo = 0
  let hi = marks.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (marks[mid] <= elapsedMs) lo = mid + 1
    else hi = mid
  }
  return marks[lo] <= elapsedMs ? lo + 1 : lo
}

export function buildNarrativePlan(journey: Journey, reducedMotion: boolean): NarrativePlan {
  const concerts = journey.concerts.slice(0, 4)
  const thinkingMs = reducedMotion ? 260 : 1300
  const collapsingMs = reducedMotion ? 180 : 900
  const seedMs = reducedMotion ? 120 : 320
  const pathDrawingMs = reducedMotion ? 260 : 1900
  const nodesHoldMs = reducedMotion ? 150 : 620
  const stepHoldMs = reducedMotion ? 120 : 360
  const maxStepMs = reducedMotion ? 520 : 4200

  let cursor = 0
  const steps = concerts.map((concert, idx) => {
    const title = fallback(concert.title, `Concert ${idx + 1}`)
    const text = composeStoryText(concert, idx)
    const typingMarksMs = buildTypingMarks(text, reducedMotion)
    const typingMs = typingMarksMs[typingMarksMs.length - 1] ?? 0
    const holdMs = stepHoldMs
    const totalStepMs = Math.min(maxStepMs, typingMs + holdMs)
    const step: StoryStepPlan = {
      id: concert.id || `step-${idx}`,
      title,
      text,
      typingMarksMs,
      typingMs,
      holdMs,
      startMs: cursor,
      endMs: cursor + totalStepMs,
    }
    cursor += totalStepMs
    return step
  })

  const storyMs = cursor
  const boundaries = {
    thinkingEnd: thinkingMs,
    collapsingEnd: thinkingMs + collapsingMs,
    seedEnd: thinkingMs + collapsingMs + seedMs,
    pathEnd: thinkingMs + collapsingMs + seedMs + pathDrawingMs,
    nodesEnd: thinkingMs + collapsingMs + seedMs + pathDrawingMs + nodesHoldMs,
    storyEnd: thinkingMs + collapsingMs + seedMs + pathDrawingMs + nodesHoldMs + storyMs,
  }

  return {
    thinkingMs,
    collapsingMs,
    seedMs,
    pathDrawingMs,
    nodesHoldMs,
    storyMs,
    totalMs: boundaries.storyEnd,
    boundaries,
    steps,
  }
}

export function resolveNarrativeViewModel(
  plan: NarrativePlan,
  elapsedMs: number,
  skipRequested: boolean,
): NarrativeViewModel {
  const effectiveElapsed = skipRequested ? plan.totalMs + 1 : Math.max(0, elapsedMs)
  const { boundaries } = plan
  let phase: NarrativeViewModel['phase'] = 'thinking'
  if (effectiveElapsed >= boundaries.storyEnd) phase = 'actions'
  else if (effectiveElapsed >= boundaries.nodesEnd) phase = 'storyTyping'
  else if (effectiveElapsed >= boundaries.pathEnd) phase = 'nodesReveal'
  else if (effectiveElapsed >= boundaries.seedEnd) phase = 'pathDrawing'
  else if (effectiveElapsed >= boundaries.collapsingEnd) phase = 'seed'
  else if (effectiveElapsed >= boundaries.thinkingEnd) phase = 'collapsing'

  const pathElapsed = Math.max(0, effectiveElapsed - boundaries.seedEnd)
  const pathProgress =
    effectiveElapsed <= boundaries.seedEnd
      ? 0
      : effectiveElapsed >= boundaries.pathEnd
        ? 1
        : easeOutCubic(pathElapsed / plan.pathDrawingMs)

  const nodeStates = NARRATIVE_NODES.map((node) => {
    if (pathProgress + 0.001 < node.pathT) return 'hidden' as const
    if (phase === 'storyTyping' || phase === 'actions') return 'done' as const
    if (pathProgress >= node.pathT + 0.08) return 'done' as const
    return 'active' as const
  })

  const storyElapsed = Math.max(0, effectiveElapsed - boundaries.nodesEnd)
  const steps = plan.steps.map((step) => {
    const local = storyElapsed - step.startMs
    if (local <= 0) {
      return {
        id: step.id,
        title: step.title,
        text: step.text,
        renderedText: '',
        status: 'hidden' as const,
      }
    }
    if (local >= step.endMs - step.startMs) {
      return {
        id: step.id,
        title: step.title,
        text: step.text,
        renderedText: step.text,
        status: 'done' as const,
      }
    }
    const visibleChars = typedCharsAt(step.typingMarksMs, local)
    return {
      id: step.id,
      title: step.title,
      text: step.text,
      renderedText: step.text.slice(0, visibleChars),
      status: visibleChars >= step.text.length ? ('done' as const) : ('active' as const),
    }
  })

  const activeIndex = steps.findIndex((step) => step.status === 'active')
  if (activeIndex > -1) {
    for (let i = activeIndex + 1; i < steps.length; i += 1) {
      if (steps[i].status !== 'hidden') {
        steps[i] = { ...steps[i], status: 'hidden', renderedText: '' }
      }
    }
  }

  return {
    phase,
    pathProgress,
    nodeStates,
    steps,
    elapsedMs: effectiveElapsed,
  }
}
