/**
 * Frontfiles — Embargo-form constants + pure helpers (NR-D8, F8a)
 *
 * Client-safe foundation for the Pack-editor Embargo tab. Length
 * caps, common-timezone list, and the outlet-from-email
 * derivation helper.
 *
 * NO `'server-only'` marker — F3 + F4 (`'use client'` form +
 * recipients table) import these for client-side validation
 * hints + outlet-label rendering. IP-2 / IP-3 / IP-4 ratified
 * pre-composition; this file mirrors the NR-D6b/D7a constants/zod
 * split pattern.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P8 (recipients table — outlet "auto-filled from domain; editable")
 *   - directives/NR-D8-embargo-configuration.md §F8a
 */

// ── Length caps ───────────────────────────────────────────────

export const EMBARGO_POLICY_MAX = 5000
export const EMBARGO_RECIPIENT_EMAIL_MAX = 320 // RFC 5321 path limit

// ── Timezone list ─────────────────────────────────────────────

/**
 * Common-timezone subset for the Lift-at picker. v1 covers the
 * editorial press-release distribution corridor (US/EU primary
 * markets); v1.1 can expand to a full IANA list when the
 * customer base demands it.
 *
 * Format: { value: 'IANA/Zone', label: 'Display Name' }. UTC
 * offset rendering is the form's responsibility — the IANA zone
 * is the canonical write-back value.
 */
export const COMMON_TIMEZONES: ReadonlyArray<{
  value: string
  label: string
}> = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (US/Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US/Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US/Canada)' },
  { value: 'America/New_York', label: 'Eastern Time (US/Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Lisbon', label: 'Lisbon' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'UTC', label: 'UTC' },
]

// ── Outlet derivation ─────────────────────────────────────────

/**
 * Derive a display label for the recipient's outlet from their
 * email domain. Pure; no I/O.
 *
 * Algorithm: extract domain, strip leading `www.` if present,
 * take the second-to-last dot-separated segment, title-case
 * the first character.
 *
 * Examples:
 *   'editor@reuters.com'              → 'Reuters'
 *   'news@nytimes.com'                → 'Nytimes'
 *   'staff@www.washingtonpost.com'    → 'Washingtonpost'
 *   'reporter@bbc.co.uk'              → 'Bbc'  (best-effort)
 *
 * Multi-part TLD handling (`co.uk`, `com.au`, etc.) is
 * imperfect — the second-to-last segment heuristic gives
 * `co` for `bbc.co.uk`, which we override by checking against
 * a small known-list of compound TLDs and falling back to the
 * third-to-last segment in those cases.
 *
 * IP-4 ratification: NR-D8 v1 displays this label only;
 * `newsroom_recipients.outlet_id` stays NULL on creation. v1.1
 * will wire outlet table writes when consumer-side identity
 * (J3 org page, J7 subscriptions) becomes load-bearing.
 *
 * Returns 'Unknown' for malformed inputs.
 */

const COMPOUND_TLDS: ReadonlySet<string> = new Set([
  'co.uk',
  'com.au',
  'co.jp',
  'com.br',
  'co.za',
  'co.nz',
  'com.mx',
])

export function deriveOutletFromEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return 'Unknown'
  let domain = email.slice(at + 1).trim().toLowerCase()
  if (domain.length === 0) return 'Unknown'

  // Strip a single leading `www.`
  if (domain.startsWith('www.')) {
    domain = domain.slice(4)
  }

  const parts = domain.split('.').filter((p) => p.length > 0)
  if (parts.length < 2) return 'Unknown'

  // Compound-TLD check on the trailing two segments
  const tail2 = parts.slice(-2).join('.')
  let coreSegment: string
  if (COMPOUND_TLDS.has(tail2) && parts.length >= 3) {
    // bbc.co.uk → 'bbc'
    coreSegment = parts[parts.length - 3]!
  } else {
    // reuters.com → 'reuters'
    coreSegment = parts[parts.length - 2]!
  }

  if (coreSegment.length === 0) return 'Unknown'
  return coreSegment.charAt(0).toUpperCase() + coreSegment.slice(1)
}
