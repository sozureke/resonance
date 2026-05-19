import roomLabelsJson from '@/data/room_labels.json'

export const DEFAULT_VENUE = 'Philharmonie Luxembourg'

const ROOM_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(roomLabelsJson as Record<string, string>).map(([k, v]) => [
    k.toLowerCase().trim(),
    v,
  ]),
)

/** Display labels for known venue names (consistent casing). */
const CANONICAL: Record<string, string> = {
  'grand auditorium': 'Grand Auditorium',
  'salle de musique de chambre': 'Salle de Musique de Chambre',
  'espace découverte': 'Espace Découverte',
  'espace decouverte': 'Espace Découverte',
  'grand foyer': 'Grand Foyer',
  'salon philaphil': 'Salon PhilaPhil',
  kinnekswiss: 'Kinnekswiss',
  'on tour': 'On Tour',
}

const ROOM_ID_RE = /^[0-9a-f]{6,}:[0-9a-f]{6,}$/i

const MISPLACED_EXACT = new Set(
  [
    '0',
    'intimate',
    'contemporary / experimental',
    'contemporary / experimental / chamber',
  ].map((s) => s.toLowerCase()),
)

function looksMisplacedRoom(value: string): boolean {
  const low = value.toLowerCase().trim()
  if (!low || MISPLACED_EXACT.has(low)) return true
  if (ROOM_ID_RE.test(low.replace(/\s/g, ''))) return true
  if (low.includes('mood-booster') || low.includes('outside-the-box')) return true
  if (low.includes('thought-provoking') || low.includes('instrument focus')) return true
  return false
}

function titleVenueHint(title: string, subtitle: string): string {
  const blob = `${title} ${subtitle}`.toLowerCase()
  if (blob.includes('kinnekswiss')) return 'Kinnekswiss'
  if (blob.includes('on tour')) return 'On Tour'
  if (blob.includes('philaphil')) return 'Salon PhilaPhil'
  if (blob.includes('grand foyer') || blob.includes('in c //')) return 'Grand Foyer'
  return ''
}

function canonicalize(label: string): string {
  const key = label.toLowerCase().trim()
  return CANONICAL[key] ?? label.trim()
}

export type RoomResolveInput = {
  room?: string
  title?: string
  subtitle?: string
}

/**
 * Human-readable venue for cards and copy. Never returns raw booking IDs or tag strings.
 */
export function resolveRoomDisplay(input: RoomResolveInput): string {
  const title = (input.title ?? '').trim()
  const subtitle = (input.subtitle ?? '').trim()
  const raw = (input.room ?? '').trim()

  const fromTitle = titleVenueHint(title, subtitle)
  if (fromTitle) return fromTitle

  if (raw) {
    const mapped = ROOM_ID_MAP[raw.toLowerCase()]
    if (mapped !== undefined) {
      if (mapped) return mapped
    } else if (!looksMisplacedRoom(raw)) {
      return canonicalize(raw)
    }
  }

  return DEFAULT_VENUE
}
