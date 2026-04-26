// ═══════════════════════════════════════════════════════════════
// OfferComposerClient — pure-helper tests (§R6-pure / §F10)
//
// 3 test cases per §F10 / AC12: valid body assembly / invalid
// validation paths / items parsing per target_type. Tested via
// the exported pure helpers `buildComposerOfferBody` and
// `parseItemsInput` — the component's `handleSubmit` delegates
// body construction to `buildComposerOfferBody`, so asserting on
// its output is equivalent to asserting on the request body at
// the fetch boundary (per §R6-pure pattern).
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
  buildComposerOfferBody,
  parseItemsInput,
} from '../OfferComposerClient'

// ─── Fixtures ───────────────────────────────────────────────────

const NOW = new Date('2026-04-23T12:00:00.000Z')
const ASSET_ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CREATOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function baseForm() {
  return {
    targetType: 'single_asset' as const,
    itemsInput: ASSET_ID_A,
    creatorId: CREATOR_ID,
    rightsTemplate: 'editorial_one_time' as const,
    grossFee: '250.00',
    currency: 'EUR' as const,
    expiryHours: 4,
    note: 'Q3 editorial feature.',
  }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('buildComposerOfferBody — valid single_asset composition (AC12)', () => {
  it('assembles the POST /api/offers body with expected fields + derived expiresAt', () => {
    const result = buildComposerOfferBody({ form: baseForm(), now: NOW })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body.creatorId).toBe(CREATOR_ID)
    expect(result.body.targetType).toBe('single_asset')
    expect(result.body.grossFee).toBe(250)
    expect(result.body.platformFeeBps).toBe(2000)
    expect(result.body.currency).toBe('EUR')
    expect(result.body.note).toBe('Q3 editorial feature.')
    expect(result.body.items).toEqual([ASSET_ID_A])
    expect(result.body.rights.template).toBe('editorial_one_time')
    expect(result.body.rights.is_transfer).toBe(false)

    const expected = new Date(
      NOW.getTime() + 4 * 60 * 60 * 1000,
    ).toISOString()
    expect(result.body.expiresAt).toBe(expected)
  })
})

describe('buildComposerOfferBody — client-side validation rejections (bundled per IP-3)', () => {
  it('rejects missing creatorId, empty items, non-positive grossFee, and overlong note', () => {
    // (a) missing creatorId
    const missingCreator = buildComposerOfferBody({
      form: { ...baseForm(), creatorId: '   ' },
      now: NOW,
    })
    expect(missingCreator.ok).toBe(false)
    if (!missingCreator.ok) expect(missingCreator.error).toContain('creator')

    // (b) empty items
    const emptyItems = buildComposerOfferBody({
      form: { ...baseForm(), itemsInput: '' },
      now: NOW,
    })
    expect(emptyItems.ok).toBe(false)
    if (!emptyItems.ok) expect(emptyItems.error).toContain('item')

    // (c) non-positive grossFee
    const zeroFee = buildComposerOfferBody({
      form: { ...baseForm(), grossFee: '0' },
      now: NOW,
    })
    expect(zeroFee.ok).toBe(false)
    if (!zeroFee.ok) expect(zeroFee.error).toContain('greater than zero')

    const negativeFee = buildComposerOfferBody({
      form: { ...baseForm(), grossFee: '-5' },
      now: NOW,
    })
    expect(negativeFee.ok).toBe(false)

    // (d) overlong note
    const longNote = buildComposerOfferBody({
      form: { ...baseForm(), note: 'x'.repeat(2001) },
      now: NOW,
    })
    expect(longNote.ok).toBe(false)
    if (!longNote.ok) expect(longNote.error).toContain('2000')
  })
})

describe('parseItemsInput — target-type-keyed parsing', () => {
  it('truncates to one line for single_* and preserves all lines for _pack target types', () => {
    const multiline = `${ASSET_ID_A}\n${ASSET_ID_B}\n`

    // single_asset — takes only the first entry.
    expect(parseItemsInput('single_asset', multiline)).toEqual([ASSET_ID_A])

    // single_brief — same single-entry rule.
    expect(parseItemsInput('single_brief', multiline)).toEqual([ASSET_ID_A])

    // asset_pack — preserves all non-empty lines.
    expect(parseItemsInput('asset_pack', multiline)).toEqual([
      ASSET_ID_A,
      ASSET_ID_B,
    ])

    // brief_pack — same multi-line behaviour.
    expect(parseItemsInput('brief_pack', multiline)).toEqual([
      ASSET_ID_A,
      ASSET_ID_B,
    ])

    // Empty / whitespace-only input returns empty array regardless
    // of target type.
    expect(parseItemsInput('single_asset', '')).toEqual([])
    expect(parseItemsInput('asset_pack', '   \n\n')).toEqual([])
  })
})
