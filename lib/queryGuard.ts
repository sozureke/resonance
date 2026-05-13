import intentData from '@/data/discovery_intent_hints.json'

export const DISCOVERY_QUERY_POLICY_MESSAGE =
  "That request doesn’t look like a musical discovery search. Remove jailbreak-style or system-level prompts — we only accept intents about live music and concerts."

export const DISCOVERY_QUERY_INVALID_MESSAGE =
  "That doesn’t look like a valid musical discovery request. Describe a mood, genre, artists you like, or the kind of concert experience you want."

const MIN_LEN = 2
const MAX_LEN = 2000

const LONG_HINTS: string[] = intentData.long_hints
const SHORT_HINT_RES: RegExp[] = intentData.short_hint_words.map((w) => {
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${esc}\\b`, 'i')
})
const ONE_WORD = new Set(intentData.one_word.map((w) => w.toLowerCase()))
const OFF_TOPIC_PHRASES: string[] = intentData.off_topic_phrases

const SUBSTRING_DENY = [
  'ignore previous',
  'ignore above',
  'ignore all',
  'ignore the',
  'disregard previous',
  'disregard the',
  'disregard all',
  'new instructions',
  'system prompt',
  'developer message',
  'developer mode',
  'jailbreak',
  'dan mode',
  'you are now',
  "you're now",
  'act as',
  'pretend you are',
  'simulate a',
  'roleplay',
  'role play',
  'override rules',
  'override system',
  'bypass',
  'api key',
  'secret key',
  'password:',
  'token:',
  'openrouter',
  'anthropic',
  'sk-',
  'curl ',
  'wget ',
  'powershell',
  '/etc/',
  '<?php',
  '<script',
  '```',
  '[inst]',
  '[/inst]',
  'sudo ',
  'rm -rf',
  'delete all',
  'truncate ',
]

const RE_DENY: RegExp[] = [
  /\bignore\b.*\b(instructions|rules|prompt)\b/i,
  /\bsystem\s*:\s*/i,
  /\bhuman\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /\buser\s*:\s*[\s\S]{0,200}\bsystem\s*:\s*/i,
  /```\s*(json|yaml|python|javascript)/i,
]

function looksLikeGibberish(s: string): boolean {
  const t = s.trim()
  if (/^(.)\1{12,}$/i.test(t)) return true
  const chars = Array.from(t)
  if (t.length >= 14) {
    const letters = chars.filter((c) => /[a-zA-Z]/.test(c))
    if (letters.length >= 10) {
      const uniq = new Set(letters.map((c) => c.toLowerCase()))
      if (uniq.size <= 2) return true
    }
  }
  let letterCount = 0
  for (const c of chars) {
    if (/[a-zA-Z]/.test(c)) letterCount++
  }
  if (t.length > 60 && letterCount < 4) return true
  return false
}

function firstTokenLower(q: string): string {
  const raw = q.trim().split(/\s+/)[0] ?? ''
  if (!raw) return ''
  const stripped = raw
    .replace(/^['"'""‘’]+/g, '')
    .replace(/['"'""‘’?!.,;:]+$/g, '')
  return stripped.toLowerCase()
}

function matchesOffTopicPhrase(low: string): boolean {
  for (const p of OFF_TOPIC_PHRASES) {
    if (low.includes(p)) return true
  }
  return false
}

function hasMusicalDiscoveryIntent(q: string): boolean {
  const low = q.trim().toLowerCase()
  const tokens = low.split(/\s+/).filter(Boolean)
  if (tokens.length === 1) {
    const w = firstTokenLower(q)
    if (w && ONE_WORD.has(w)) return true
  }
  for (const h of LONG_HINTS) {
    if (low.includes(h.toLowerCase())) return true
  }
  for (const re of SHORT_HINT_RES) {
    if (re.test(q)) return true
  }
  return false
}

export type QueryGuardReason = 'policy' | 'length' | 'invalid'

export type QueryGuardResult = { ok: true } | { ok: false; reason: QueryGuardReason }

/** Map guard outcome to a user-visible string (English, matches backend where applicable). */
export function discoveryQueryErrorMessage(reason: QueryGuardReason): string {
  if (reason === 'policy') return DISCOVERY_QUERY_POLICY_MESSAGE
  return DISCOVERY_QUERY_INVALID_MESSAGE
}

export function validateDiscoveryQuery(raw: string): QueryGuardResult {
  const q = raw.trim()
  if (q.length < MIN_LEN || q.length > MAX_LEN) {
    return { ok: false, reason: 'length' }
  }

  const low = q.toLowerCase()
  if (matchesOffTopicPhrase(low)) {
    return { ok: false, reason: 'invalid' }
  }

  for (const s of SUBSTRING_DENY) {
    if (low.includes(s)) return { ok: false, reason: 'policy' }
  }
  for (const re of RE_DENY) {
    if (re.test(q)) return { ok: false, reason: 'policy' }
  }

  if (!hasMusicalDiscoveryIntent(q)) {
    return { ok: false, reason: 'invalid' }
  }

  if (looksLikeGibberish(q)) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true }
}
