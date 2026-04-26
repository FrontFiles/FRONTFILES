/**
 * Frontfiles — publish-checklist.ts unit tests (NR-D9b, F9)
 *
 * Pure-function tests against `derivePublishChecklist` and the
 * two zod schemas. No DB, no IO. Mirrors the testing posture of
 * `state-machine.test.ts`.
 *
 * Coverage:
 *   - 7-row derivation across all PRD §5.1 P10 state strings
 *   - CTA label derivation across the 3 PRD line-953 branches
 *   - Active signing key surfaced in `missing[]` only
 *   - Zod warranty + transition schemas (valid + invalid)
 */

import { describe, expect, it } from 'vitest'

import type {
  NewsroomLicenceClass,
  NewsroomPackRow,
  NewsroomPackStatus,
  NewsroomRightsWarrantyRow,
} from '@/lib/db/schema'
import {
  createWarrantySchema,
  derivePublishChecklist,
  transitionRequestSchema,
  type DeriveChecklistInput,
} from '../publish-checklist'

// ── Fixtures ───────────────────────────────────────────────────

function makePack(overrides: Partial<NewsroomPackRow> = {}): NewsroomPackRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    company_id: '22222222-2222-2222-2222-222222222222',
    slug: 'test-pack',
    title: 'Test Pack',
    subtitle: null,
    description: '',
    credit_line: 'Test credit',
    licence_class: 'editorial_use_only' as NewsroomLicenceClass,
    publish_at: null,
    embargo_id: null,
    rights_warranty_id: null,
    status: 'draft' as NewsroomPackStatus,
    visibility: 'private',
    published_at: null,
    notification_sent_at: null,
    archived_at: null,
    takedown_at: null,
    takedown_reason: null,
    c2pa_signing_enabled: false,
    created_by_user_id: '33333333-3333-3333-3333-333333333333',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeWarranty(): NewsroomRightsWarrantyRow {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    pack_id: '11111111-1111-1111-1111-111111111111',
    subject_releases_confirmed: true,
    third_party_content_cleared: true,
    music_cleared: true,
    narrative_text: null,
    confirmed_by_user_id: '33333333-3333-3333-3333-333333333333',
    confirmed_at: '2026-04-01T00:00:00Z',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  }
}

const futureLiftAt = '2099-01-01T00:00:00Z' // safely in future

function baseInput(
  overrides: Partial<DeriveChecklistInput> = {},
): DeriveChecklistInput {
  return {
    pack: makePack(),
    warranty: makeWarranty(),
    embargo: null,
    assetCount: 1,
    imagesMissingAltCount: 0,
    scanCounts: { pending: 0, clean: 1, flagged: 0, error: 0 },
    hasActiveSigningKey: true,
    ...overrides,
  }
}

// ── Happy paths ────────────────────────────────────────────────

describe('derivePublishChecklist — happy paths', () => {
  it('all preconditions met, no embargo, no publish_at → "Publish now"', () => {
    const result = derivePublishChecklist(baseInput())
    expect(result.ctaLabel).toBe('Publish now')
    expect(result.ctaDisabled).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.items).toHaveLength(7)
    // Embargo row is N/A when no embargo
    expect(result.items[6]).toEqual({
      label: 'Embargo configured (if set)',
      state: 'na',
    })
  })

  it('all preconditions met, publish_at set, no embargo → "Schedule"', () => {
    const result = derivePublishChecklist(
      baseInput({
        pack: makePack({ publish_at: '2099-06-01T00:00:00Z' }),
      }),
    )
    expect(result.ctaLabel).toBe('Schedule')
    expect(result.ctaDisabled).toBe(false)
    expect(result.missing).toEqual([])
  })

  it('all preconditions met with embargo → "Schedule"', () => {
    const result = derivePublishChecklist(
      baseInput({
        embargo: {
          id: '55555555-5555-5555-5555-555555555555',
          lift_at: futureLiftAt,
          policy_text: 'Press only.',
          recipientCount: 2,
        },
      }),
    )
    expect(result.ctaLabel).toBe('Schedule')
    expect(result.ctaDisabled).toBe(false)
    expect(result.items[6]).toEqual({
      label: 'Embargo configured (if set)',
      state: 'ok',
    })
  })
})

// ── Precondition failures ──────────────────────────────────────

describe('derivePublishChecklist — precondition failures', () => {
  it('missing title disables CTA + adds to missing[]', () => {
    const result = derivePublishChecklist(
      baseInput({ pack: makePack({ title: '' }) }),
    )
    expect(result.ctaDisabled).toBe(true)
    expect(result.ctaLabel).toBe('Publish')
    expect(result.missing).toContain('Title and credit line')
    expect(result.items[0]).toEqual({
      label: 'Title and credit line',
      state: 'missing',
    })
  })

  it('missing credit line disables CTA', () => {
    const result = derivePublishChecklist(
      baseInput({ pack: makePack({ credit_line: '   ' }) }), // whitespace only
    )
    expect(result.ctaDisabled).toBe(true)
    expect(result.items[0].state).toBe('missing')
  })

  it('zero assets → row 3 missing + row 4 missing', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 0,
        scanCounts: { pending: 0, clean: 0, flagged: 0, error: 0 },
      }),
    )
    expect(result.ctaDisabled).toBe(true)
    expect(result.items[2]).toEqual({
      label: 'At least one asset',
      state: 'missing',
    })
    expect(result.items[3]).toEqual({
      label: 'All assets scanned clean',
      state: 'missing',
    })
    expect(result.missing).toContain('At least one asset')
    expect(result.missing).toContain('All assets scanned clean')
  })

  it('asset scan pending → row 4 partial "{n} scanning"', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 3,
        scanCounts: { pending: 2, clean: 1, flagged: 0, error: 0 },
      }),
    )
    expect(result.items[3]).toEqual({
      label: 'All assets scanned clean',
      state: 'partial',
      detail: '2 scanning',
    })
    expect(result.ctaDisabled).toBe(true)
    expect(result.missing).toContain('All assets scanned clean')
  })

  it('asset scan flagged → row 4 partial "{n} flagged"', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 2,
        scanCounts: { pending: 0, clean: 1, flagged: 1, error: 0 },
      }),
    )
    expect(result.items[3]).toEqual({
      label: 'All assets scanned clean',
      state: 'partial',
      detail: '1 flagged',
    })
  })

  it('error scan results conflate into "{n} flagged"', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 2,
        scanCounts: { pending: 0, clean: 0, flagged: 1, error: 1 },
      }),
    )
    expect(result.items[3].detail).toBe('2 flagged')
  })

  it('orphan asset (no scan_result row) treated as scanning', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 3,
        scanCounts: { pending: 0, clean: 1, flagged: 0, error: 0 },
        // 2 assets without scan_result rows → "2 scanning"
      }),
    )
    expect(result.items[3]).toEqual({
      label: 'All assets scanned clean',
      state: 'partial',
      detail: '2 scanning',
    })
  })

  it('flagged dominates scanning when both present', () => {
    const result = derivePublishChecklist(
      baseInput({
        assetCount: 3,
        scanCounts: { pending: 1, clean: 1, flagged: 1, error: 0 },
      }),
    )
    // Mixed pending+flagged: "flagged" wins (it's the harder block)
    expect(result.items[3].detail).toBe('1 flagged')
  })

  it('image missing alt → row 5 partial "Missing on {n}"', () => {
    const result = derivePublishChecklist(
      baseInput({ imagesMissingAltCount: 2 }),
    )
    expect(result.items[4]).toEqual({
      label: 'Alt text on all images',
      state: 'partial',
      detail: 'Missing on 2',
    })
    expect(result.ctaDisabled).toBe(true)
  })

  it('warranty null → row 6 partial "Not confirmed"', () => {
    const result = derivePublishChecklist(baseInput({ warranty: null }))
    expect(result.items[5]).toEqual({
      label: 'Rights warranty confirmed',
      state: 'partial',
      detail: 'Not confirmed',
    })
    expect(result.ctaDisabled).toBe(true)
    expect(result.missing).toContain('Rights warranty confirmed')
  })

  it('no active signing key → missing[] includes "Active signing key" but items[] does not', () => {
    const result = derivePublishChecklist(
      baseInput({ hasActiveSigningKey: false }),
    )
    expect(result.ctaDisabled).toBe(true)
    expect(result.ctaLabel).toBe('Publish')
    expect(result.missing).toContain('Active signing key')
    // items[] still has 7 rows; signing key is tooltip-only
    expect(result.items).toHaveLength(7)
    expect(result.items.find((i) => i.label === 'Active signing key')).toBeUndefined()
  })

  it('"Active signing key" appears AFTER item-derived missing labels in tooltip order', () => {
    const result = derivePublishChecklist(
      baseInput({
        pack: makePack({ title: '' }), // adds "Title and credit line"
        hasActiveSigningKey: false,
      }),
    )
    const idxTitle = result.missing.indexOf('Title and credit line')
    const idxKey = result.missing.indexOf('Active signing key')
    expect(idxTitle).toBeGreaterThanOrEqual(0)
    expect(idxKey).toBeGreaterThan(idxTitle)
  })
})

// ── Embargo row variants ───────────────────────────────────────

describe('derivePublishChecklist — embargo row', () => {
  it('embargo with lift in past → partial "lift in past"', () => {
    const result = derivePublishChecklist(
      baseInput({
        embargo: {
          id: '55555555-5555-5555-5555-555555555555',
          lift_at: '2020-01-01T00:00:00Z',
          policy_text: 'Press only.',
          recipientCount: 1,
        },
      }),
    )
    expect(result.items[6]).toEqual({
      label: 'Embargo configured (if set)',
      state: 'partial',
      detail: 'lift in past',
    })
    expect(result.ctaDisabled).toBe(true)
  })

  it('embargo with no recipients → partial "no recipients"', () => {
    const result = derivePublishChecklist(
      baseInput({
        embargo: {
          id: '55555555-5555-5555-5555-555555555555',
          lift_at: futureLiftAt,
          policy_text: 'Press only.',
          recipientCount: 0,
        },
      }),
    )
    expect(result.items[6].state).toBe('partial')
    expect(result.items[6].detail).toBe('no recipients')
  })

  it('embargo with empty policy_text → partial "no policy text"', () => {
    const result = derivePublishChecklist(
      baseInput({
        embargo: {
          id: '55555555-5555-5555-5555-555555555555',
          lift_at: futureLiftAt,
          policy_text: '',
          recipientCount: 1,
        },
      }),
    )
    expect(result.items[6].detail).toBe('no policy text')
  })

  it('embargo with multiple issues → comma-joined missing list', () => {
    const result = derivePublishChecklist(
      baseInput({
        embargo: {
          id: '55555555-5555-5555-5555-555555555555',
          lift_at: '2020-01-01T00:00:00Z',
          policy_text: '',
          recipientCount: 0,
        },
      }),
    )
    expect(result.items[6].detail).toBe('lift in past, no policy text, no recipients')
  })
})

// ── PRD verbatim labels (regression guard) ─────────────────────

describe('derivePublishChecklist — PRD verbatim labels', () => {
  it('all 7 labels match PRD §5.1 P10 lines 945–951 exactly', () => {
    const result = derivePublishChecklist(baseInput())
    expect(result.items.map((i) => i.label)).toEqual([
      'Title and credit line',
      'Licence class',
      'At least one asset',
      'All assets scanned clean',
      'Alt text on all images',
      'Rights warranty confirmed',
      'Embargo configured (if set)',
    ])
  })
})

// ── Zod: warranty body schema ──────────────────────────────────

describe('createWarrantySchema', () => {
  it('accepts a fully confirmed body with no narrative', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      third_party_content_cleared: true,
      music_cleared: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts narrative_text when provided', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      third_party_content_cleared: true,
      music_cleared: true,
      narrative_text: 'Subjects gave verbal consent on-camera.',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null narrative_text', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      third_party_content_cleared: true,
      music_cleared: true,
      narrative_text: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects when any boolean is false', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      third_party_content_cleared: false,
      music_cleared: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects narrative > 2000 chars', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      third_party_content_cleared: true,
      music_cleared: true,
      narrative_text: 'a'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects when checkbox missing entirely', () => {
    const result = createWarrantySchema.safeParse({
      subject_releases_confirmed: true,
      music_cleared: true,
    })
    expect(result.success).toBe(false)
  })
})

// ── Zod: transition request body schema ────────────────────────

describe('transitionRequestSchema', () => {
  it('accepts each legal targetStatus', () => {
    for (const targetStatus of ['scheduled', 'published', 'draft', 'archived'] as const) {
      const result = transitionRequestSchema.safeParse({ targetStatus })
      expect(result.success).toBe(true)
    }
  })

  it('rejects "takedown" (admin-only, not via this route)', () => {
    const result = transitionRequestSchema.safeParse({
      targetStatus: 'takedown',
    })
    expect(result.success).toBe(false)
  })

  it('accepts overrideEmbargoCancel boolean', () => {
    const result = transitionRequestSchema.safeParse({
      targetStatus: 'draft',
      overrideEmbargoCancel: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown targetStatus', () => {
    const result = transitionRequestSchema.safeParse({
      targetStatus: 'archived-ish',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing targetStatus', () => {
    const result = transitionRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
