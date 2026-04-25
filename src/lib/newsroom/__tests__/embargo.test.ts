// ═══════════════════════════════════════════════════════════════
// Frontfiles — Embargo helper tests (NR-D8, F10)
//
// Coverage:
//   - F8a: deriveOutletFromEmail (constants imports tested)
//   - F8b: generateRecipientToken, buildPreviewUrl,
//          createEmbargoSchema, updateEmbargoSchema,
//          addRecipientSchema
//
// IP-2 ratification asserted: tokens are random, not HMAC-derived.
// Multiple calls produce distinct base64url 32-char strings.
//
// IP-1 ratification asserted: buildPreviewUrl produces the
// PRD §5.3 J5 shape with newsroom subdomain + slugs + ?t= query.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  EMBARGO_POLICY_MAX,
  EMBARGO_RECIPIENT_EMAIL_MAX,
  deriveOutletFromEmail,
} from '../embargo-form-constants'
import {
  addRecipientSchema,
  buildPreviewUrl,
  createEmbargoSchema,
  generateRecipientToken,
  updateEmbargoSchema,
} from '../embargo'

// ── Pure helpers ──────────────────────────────────────────────

describe('generateRecipientToken (IP-2 — random)', () => {
  it('returns a 32-char base64url string', () => {
    const t = generateRecipientToken()
    expect(t.length).toBe(32)
    // base64url alphabet: A-Z a-z 0-9 - _
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/)
  })

  it('produces distinct values across calls (random, not deterministic)', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 20; i++) {
      tokens.add(generateRecipientToken())
    }
    // 20 random 192-bit tokens should never collide; even one
    // collision implies the RNG is broken.
    expect(tokens.size).toBe(20)
  })

  it('does NOT use HMAC of any input — independent of args', () => {
    // Property: calling with the same "context" twice still yields
    // distinct tokens because the function takes no arguments.
    const a = generateRecipientToken()
    const b = generateRecipientToken()
    expect(a).not.toBe(b)
  })
})

describe('buildPreviewUrl (IP-1 — PRD §5.3 J5 shape)', () => {
  it('produces the PRD-specified URL shape', () => {
    const url = buildPreviewUrl(
      'acme-news',
      'q3-launch',
      'abcDEF123_-_456-XYZ',
    )
    expect(url).toBe(
      'https://newsroom.frontfiles.com/acme-news/q3-launch/preview?t=abcDEF123_-_456-XYZ',
    )
  })

  it('uses the newsroom subdomain (NEWSROOM_BASE_URL)', () => {
    const url = buildPreviewUrl('a', 'b', 'c')
    expect(url.startsWith('https://newsroom.frontfiles.com/')).toBe(true)
  })

  it('places the token in a ?t= query param (not a path segment)', () => {
    const url = buildPreviewUrl('a', 'b', 'c')
    expect(url).toContain('?t=c')
    expect(url).not.toContain('/c?')
  })

  it('URL-encodes tokens with reserved characters', () => {
    // base64url already uses URL-safe chars, but defensive: if a
    // future token format introduces +/ or =, the encoder must
    // pass it through cleanly.
    const url = buildPreviewUrl('a', 'b', 'token+with/slash=eq')
    expect(url).toContain('token%2Bwith%2Fslash%3Deq')
  })
})

// ── Schemas ───────────────────────────────────────────────────

const VALID_EMBARGO = {
  lift_at: '2026-12-31T17:00:00.000Z',
  policy_text: 'No sharing before lift. Quote with attribution.',
  notify_on_lift: true,
}

describe('createEmbargoSchema', () => {
  it('accepts a valid full payload', () => {
    expect(createEmbargoSchema.safeParse(VALID_EMBARGO).success).toBe(true)
  })

  it('rejects missing lift_at', () => {
    const { lift_at: _l, ...rest } = VALID_EMBARGO
    void _l
    expect(createEmbargoSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects lift_at without timezone offset', () => {
    expect(
      createEmbargoSchema.safeParse({
        ...VALID_EMBARGO,
        lift_at: '2026-12-31T17:00:00',
      }).success,
    ).toBe(false)
  })

  it('rejects empty policy_text', () => {
    expect(
      createEmbargoSchema.safeParse({
        ...VALID_EMBARGO,
        policy_text: '',
      }).success,
    ).toBe(false)
  })

  it('rejects oversized policy_text', () => {
    expect(
      createEmbargoSchema.safeParse({
        ...VALID_EMBARGO,
        policy_text: 'x'.repeat(EMBARGO_POLICY_MAX + 1),
      }).success,
    ).toBe(false)
  })

  it('defaults notify_on_lift to true when omitted', () => {
    const { notify_on_lift: _n, ...rest } = VALID_EMBARGO
    void _n
    const result = createEmbargoSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notify_on_lift).toBe(true)
    }
  })
})

describe('updateEmbargoSchema', () => {
  it('rejects an empty object (refine)', () => {
    expect(updateEmbargoSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a single-field update', () => {
    expect(
      updateEmbargoSchema.safeParse({ notify_on_lift: false }).success,
    ).toBe(true)
  })

  it('rejects partial with invalid field', () => {
    expect(
      updateEmbargoSchema.safeParse({ lift_at: 'not-iso' }).success,
    ).toBe(false)
  })
})

describe('addRecipientSchema', () => {
  it('accepts a valid email', () => {
    expect(
      addRecipientSchema.safeParse({ email: 'editor@reuters.com' }).success,
    ).toBe(true)
  })

  it('rejects malformed email', () => {
    expect(
      addRecipientSchema.safeParse({ email: 'not-an-email' }).success,
    ).toBe(false)
  })

  it('rejects oversized email', () => {
    const local = 'a'.repeat(64)
    const domain = 'b'.repeat(EMBARGO_RECIPIENT_EMAIL_MAX) + '.com'
    expect(
      addRecipientSchema.safeParse({ email: `${local}@${domain}` })
        .success,
    ).toBe(false)
  })
})

// ── Outlet derivation ─────────────────────────────────────────

describe('deriveOutletFromEmail', () => {
  it('extracts simple .com domain', () => {
    expect(deriveOutletFromEmail('editor@reuters.com')).toBe('Reuters')
  })

  it('handles multi-part TLDs (.co.uk)', () => {
    expect(deriveOutletFromEmail('reporter@bbc.co.uk')).toBe('Bbc')
  })

  it('strips leading www. subdomain', () => {
    expect(
      deriveOutletFromEmail('staff@www.washingtonpost.com'),
    ).toBe('Washingtonpost')
  })

  it('lowercases input domain before processing', () => {
    expect(deriveOutletFromEmail('Editor@Reuters.com')).toBe('Reuters')
  })

  it('returns Unknown for malformed input (no @)', () => {
    expect(deriveOutletFromEmail('not-an-email')).toBe('Unknown')
  })

  it('returns Unknown for empty domain', () => {
    expect(deriveOutletFromEmail('reporter@')).toBe('Unknown')
  })

  it('returns Unknown for single-segment domain', () => {
    expect(deriveOutletFromEmail('user@localhost')).toBe('Unknown')
  })
})
