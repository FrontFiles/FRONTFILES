/**
 * Frontfiles — rights.ts unit tests (P4 concern 4A.2 Part A)
 *
 * Template registry exhaustiveness + schema accept/reject cases +
 * custom-flag semantics.
 */

import { describe, expect, it } from 'vitest'

import {
  RIGHTS_TEMPLATES,
  RightsSchema,
  validateRights,
} from '@/lib/offer/rights'
import type { RightsTemplateId } from '@/lib/offer/types'

const ALL_TEMPLATE_IDS: readonly RightsTemplateId[] = [
  'editorial_one_time',
  'editorial_with_archive_12mo',
  'commercial_restricted',
  'custom',
]

describe('RIGHTS_TEMPLATES registry', () => {
  it('has exactly four entries — the three v1 templates + custom', () => {
    expect(Object.keys(RIGHTS_TEMPLATES)).toHaveLength(4)
  })

  it('registry keys match RightsTemplateId values exhaustively', () => {
    const keys = new Set(Object.keys(RIGHTS_TEMPLATES))
    for (const id of ALL_TEMPLATE_IDS) {
      expect(keys.has(id)).toBe(true)
    }
    expect(keys.size).toBe(ALL_TEMPLATE_IDS.length)
  })

  it('every entry carries { id, label, is_transfer } and nothing else', () => {
    for (const id of ALL_TEMPLATE_IDS) {
      const entry = RIGHTS_TEMPLATES[id]
      expect(entry.id).toBe(id)
      expect(typeof entry.label).toBe('string')
      expect(entry.label.length).toBeGreaterThan(0)
      expect(typeof entry.is_transfer).toBe('boolean')
      expect(Object.keys(entry).sort()).toEqual([
        'id',
        'is_transfer',
        'label',
      ])
    }
  })
})

describe('RightsSchema', () => {
  for (const template of ALL_TEMPLATE_IDS) {
    it(`accepts template='${template}'`, () => {
      const result = RightsSchema.safeParse({
        template,
        params: {},
        is_transfer: false,
      })
      expect(result.success).toBe(true)
    })
  }

  it('rejects an unknown template id', () => {
    const result = RightsSchema.safeParse({
      template: 'no_such_template',
      params: {},
      is_transfer: false,
    })
    expect(result.success).toBe(false)
  })

  it('admits open-valued params in Part A (tightens in Part C2)', () => {
    const result = RightsSchema.safeParse({
      template: 'commercial_restricted',
      params: { jurisdiction: 'US', duration_months: 12 },
      is_transfer: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-strict extra key (shape is .strict)', () => {
    const result = RightsSchema.safeParse({
      template: 'editorial_one_time',
      params: {},
      is_transfer: false,
      extra_field: 'nope',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateRights', () => {
  it('returns ok=true + flag=false for a non-custom template', () => {
    const result = validateRights({
      template: 'editorial_one_time',
      params: {},
      is_transfer: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.needsAdminReview).toBe(false)
  })

  it('returns ok=true + flag=true for the custom template', () => {
    const result = validateRights({
      template: 'custom',
      params: { notes: 'buyer wrote something custom' },
      is_transfer: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.needsAdminReview).toBe(true)
  })

  it('returns ok=false with a reason for a malformed input', () => {
    const result = validateRights({
      template: 'editorial_one_time',
      // Missing params / is_transfer — schema rejects.
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(typeof result.reason).toBe('string')
  })
})
