/**
 * Tests for scripts/pricing/csv-to-seed-migration.ts (L5 implementation, F1.5 v2 §10).
 *
 * Covers:
 *   - parseCsv: header parsing, quoted fields, CRLF
 *   - per-CSV validation (errors block, warnings allow continuation)
 *   - cross-CSV check (floors vs defaults × min use_tier multiplier)
 *   - SQL generation (5 INSERT blocks; correct columns; dollar-quoted basis)
 */

import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  validateFormatDefaults,
  validatePlatformFloors,
  validateSublabelMultipliers,
  validateUseTierMultipliers,
  validateCcVariants,
  validateFloorsBelowDefaults,
  generateSeedSql,
  type FormatDefaultRow,
  type PlatformFloorRow,
  type SublabelMultiplierRow,
  type UseTierMultiplierRow,
  type CcVariantRow,
} from '../csv-to-seed-migration'

// ── Fixture builders ──────────────────────────────────────────────────

const FORMATS = ['photo', 'illustration', 'infographic', 'vector', 'video', 'audio', 'text'] as const
const INTRUSION_LEVELS = ['light', 'standard', 'heavy'] as const
const CLASSES = ['editorial', 'commercial', 'advertising'] as const
const TIERS = ['tier_1', 'tier_2', 'tier_3', 'tier_4'] as const
const CC = ['cc0', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'cc_by_nd', 'cc_by_nc_sa', 'cc_by_nc_nd'] as const
const SUBLABELS = [
  'editorial.news',
  'editorial.longform',
  'editorial.documentary',
  'editorial.book',
  'editorial.commentary',
  'editorial.educational',
  'commercial.brand_content',
  'commercial.corporate_communications',
  'commercial.merchandise',
  'commercial.internal_training',
  'advertising.print_ad',
  'advertising.digital_ad',
  'advertising.social_ad',
  'advertising.out_of_home',
  'advertising.broadcast',
  'advertising.native_advertorial',
  'advertising.influencer',
] as const

function fullDefaults(): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  for (const f of FORMATS)
    for (const i of INTRUSION_LEVELS)
      for (const l of CLASSES)
        rows.push({
          format: f,
          intrusion_level: i,
          licence_class: l,
          currency: 'EUR',
          baseline_cents: '20000',
          calibration_basis: 'fotoQuote 2026 mid editorial photo midpoint',
        })
  return rows
}

function fullFloors(): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  for (const f of FORMATS)
    for (const i of INTRUSION_LEVELS)
      for (const l of CLASSES)
        rows.push({
          format: f,
          intrusion_level: i,
          licence_class: l,
          currency: 'EUR',
          min_cents: '5000',
        })
  return rows
}

function fullSublabelMults(): Array<Record<string, string>> {
  return SUBLABELS.map((sl) => ({ sublabel: sl, multiplier: '1.000' }))
}

function fullUseTierMults(): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  for (const c of CLASSES) for (const t of TIERS) rows.push({ licence_class: c, use_tier: t, multiplier: '1.000' })
  return rows
}

function fullCcVariants(): Array<Record<string, string>> {
  return CC.map((v) => ({
    cc_variant: v,
    currency: 'EUR',
    price_cents: v === 'cc0' ? '0' : '500',
  }))
}

// ── parseCsv tests ───────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses header + rows with simple commas', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n'
    expect(parseCsv(csv)).toEqual([{ a: '1', b: '2' }])
  })

  it('handles quoted fields with embedded commas', () => {
    const csv = 'name,note\nphoto,"a, b, c"\n'
    expect(parseCsv(csv)).toEqual([{ name: 'photo', note: 'a, b, c' }])
  })

  it('handles doubled quotes inside quoted fields', () => {
    const csv = 'name,note\nphoto,"says ""hi"""\n'
    expect(parseCsv(csv)).toEqual([{ name: 'photo', note: 'says "hi"' }])
  })

  it('trims trailing empty lines', () => {
    const csv = 'a\n1\n\n\n'
    expect(parseCsv(csv)).toEqual([{ a: '1' }])
  })
})

// ── validateFormatDefaults tests ─────────────────────────────────────

describe('validateFormatDefaults', () => {
  it('accepts a full valid 63-row fixture', () => {
    const r = validateFormatDefaults(fullDefaults())
    expect(r.errors).toEqual([])
  })

  it('errors on row count mismatch', () => {
    const rows = fullDefaults().slice(0, 10)
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes('expected 63 rows'))).toBe(true)
  })

  it('errors on unknown format', () => {
    const rows = fullDefaults()
    rows[0].format = 'bogus'
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes("unknown format 'bogus'"))).toBe(true)
  })

  it('errors on creative_commons in licence_class column', () => {
    const rows = fullDefaults()
    rows[0].licence_class = 'creative_commons'
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes('creative_commons belongs in cc_variants'))).toBe(true)
  })

  it('errors on non-EUR currency', () => {
    const rows = fullDefaults()
    rows[0].currency = 'USD'
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes('currency must be EUR'))).toBe(true)
  })

  it('errors on non-positive baseline_cents', () => {
    const rows = fullDefaults()
    rows[0].baseline_cents = '0'
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes('positive integer'))).toBe(true)
  })

  it('warns (does not error) on out-of-range baseline_cents', () => {
    const rows = fullDefaults()
    rows[0].baseline_cents = '50' // below 100 sanity bound
    const r = validateFormatDefaults(rows)
    expect(r.errors).toEqual([])
    expect(r.warnings.some((w) => w.includes('outside sanity bounds'))).toBe(true)
  })

  it('errors on duplicate (format, intrusion, class) tuple', () => {
    const rows = fullDefaults()
    rows[1] = { ...rows[0] }
    const r = validateFormatDefaults(rows)
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true)
  })

  it('warns on empty calibration_basis', () => {
    const rows = fullDefaults()
    rows[0].calibration_basis = ''
    const r = validateFormatDefaults(rows)
    expect(r.warnings.some((w) => w.includes('calibration_basis is empty'))).toBe(true)
  })
})

// ── validatePlatformFloors tests ─────────────────────────────────────

describe('validatePlatformFloors', () => {
  it('accepts a full valid 63-row fixture', () => {
    const r = validatePlatformFloors(fullFloors())
    expect(r.errors).toEqual([])
  })

  it('errors on missing rows', () => {
    const rows = fullFloors().slice(0, 5)
    const r = validatePlatformFloors(rows)
    expect(r.errors.some((e) => e.includes('expected 63 rows'))).toBe(true)
  })

  it('errors on negative min_cents', () => {
    const rows = fullFloors()
    rows[0].min_cents = '-100'
    const r = validatePlatformFloors(rows)
    expect(r.errors.some((e) => e.includes('positive integer'))).toBe(true)
  })
})

// ── validateSublabelMultipliers tests ────────────────────────────────

describe('validateSublabelMultipliers', () => {
  it('accepts a full valid 17-row fixture', () => {
    const r = validateSublabelMultipliers(fullSublabelMults())
    expect(r.errors).toEqual([])
  })

  it('errors on row count mismatch', () => {
    const rows = fullSublabelMults().slice(0, 5)
    const r = validateSublabelMultipliers(rows)
    expect(r.errors.some((e) => e.includes('expected 17'))).toBe(true)
  })

  it('errors on unknown sublabel', () => {
    const rows = fullSublabelMults()
    rows[0].sublabel = 'creative_commons.cc_by' // CC sublabel — wrong CSV
    const r = validateSublabelMultipliers(rows)
    expect(r.errors.some((e) => e.includes("unknown sublabel"))).toBe(true)
  })

  it('errors on non-positive multiplier', () => {
    const rows = fullSublabelMults()
    rows[0].multiplier = '0'
    const r = validateSublabelMultipliers(rows)
    expect(r.errors.some((e) => e.includes('positive number'))).toBe(true)
  })
})

// ── validateUseTierMultipliers tests ─────────────────────────────────

describe('validateUseTierMultipliers', () => {
  it('accepts a full valid 12-row fixture', () => {
    const r = validateUseTierMultipliers(fullUseTierMults())
    expect(r.errors).toEqual([])
  })

  it('errors on creative_commons in licence_class column', () => {
    const rows = fullUseTierMults()
    rows[0].licence_class = 'creative_commons'
    const r = validateUseTierMultipliers(rows)
    expect(r.errors.some((e) => e.includes("unknown licence_class 'creative_commons'"))).toBe(true)
  })

  it('errors on tier_5 (out of enum)', () => {
    const rows = fullUseTierMults()
    rows[0].use_tier = 'tier_5'
    const r = validateUseTierMultipliers(rows)
    expect(r.errors.some((e) => e.includes("unknown use_tier 'tier_5'"))).toBe(true)
  })
})

// ── validateCcVariants tests ─────────────────────────────────────────

describe('validateCcVariants', () => {
  it('accepts a full valid 7-row fixture', () => {
    const r = validateCcVariants(fullCcVariants())
    expect(r.errors).toEqual([])
  })

  it('warns when CC0 is non-zero', () => {
    const rows = fullCcVariants()
    rows[0].price_cents = '500' // cc0 should be 0
    const r = validateCcVariants(rows)
    expect(r.warnings.some((w) => w.includes('CC0 should be 0'))).toBe(true)
  })

  it('errors on negative price_cents', () => {
    const rows = fullCcVariants()
    rows[0].price_cents = '-100'
    const r = validateCcVariants(rows)
    expect(r.errors.some((e) => e.includes('non-negative integer'))).toBe(true)
  })
})

// ── validateFloorsBelowDefaults tests ────────────────────────────────

describe('validateFloorsBelowDefaults', () => {
  it('passes when floors ≤ baseline × min(use_tier_mult)', () => {
    const defaults: FormatDefaultRow[] = [
      { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', baseline_cents: 20000, calibration_basis: 'x' },
    ]
    const floors: PlatformFloorRow[] = [
      { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', min_cents: 5000 },
    ]
    const useTierMults: UseTierMultiplierRow[] = [
      { licence_class: 'editorial', use_tier: 'tier_1', multiplier: 0.5 },
      { licence_class: 'editorial', use_tier: 'tier_2', multiplier: 1.0 },
    ]
    // baseline 20000 × min mult 0.5 = 10000 ≥ floor 5000 → no warning
    const r = validateFloorsBelowDefaults(defaults, floors, useTierMults)
    expect(r.warnings).toEqual([])
  })

  it('warns when floor exceeds baseline × min(use_tier_mult)', () => {
    const defaults: FormatDefaultRow[] = [
      { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', baseline_cents: 10000, calibration_basis: 'x' },
    ]
    const floors: PlatformFloorRow[] = [
      { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', min_cents: 8000 },
    ]
    const useTierMults: UseTierMultiplierRow[] = [
      { licence_class: 'editorial', use_tier: 'tier_1', multiplier: 0.5 },
    ]
    // baseline 10000 × min mult 0.5 = 5000 < floor 8000 → warning
    const r = validateFloorsBelowDefaults(defaults, floors, useTierMults)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toContain('engine will clamp every recommendation up')
  })
})

// ── generateSeedSql tests ────────────────────────────────────────────

describe('generateSeedSql', () => {
  function tinyInput(): Parameters<typeof generateSeedSql>[0] {
    return {
      defaults: [
        { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', baseline_cents: 20000, calibration_basis: 'fotoQuote midpoint' },
      ],
      floors: [
        { format: 'photo', intrusion_level: 'standard', licence_class: 'editorial', currency: 'EUR', min_cents: 5000 },
      ],
      sublabelMults: [{ sublabel: 'editorial.news', multiplier: 1.0 }],
      useTierMults: [{ licence_class: 'editorial', use_tier: 'tier_2', multiplier: 1.0 }],
      ccVariants: [{ cc_variant: 'cc0', currency: 'EUR', price_cents: 0 }],
      tableVersion: 1,
      calibratedBy: '00000000-0000-0000-0000-000000000001',
      generatedAt: '2026-04-28T12:00:00.000Z',
    }
  }

  it('emits 5 INSERT blocks (one per table)', () => {
    const sql = generateSeedSql(tinyInput())
    expect(sql).toContain('INSERT INTO pricing_format_defaults')
    expect(sql).toContain('INSERT INTO pricing_platform_floors')
    expect(sql).toContain('INSERT INTO pricing_sublabel_multipliers')
    expect(sql).toContain('INSERT INTO pricing_use_tier_multipliers')
    expect(sql).toContain('INSERT INTO pricing_cc_variants')
  })

  it('uses dollar-quoted strings for calibration_basis (avoids single-quote escaping)', () => {
    const input = tinyInput()
    input.defaults[0].calibration_basis = "fotoQuote's 2026 midpoint"
    const sql = generateSeedSql(input)
    expect(sql).toContain("$$fotoQuote's 2026 midpoint$$")
  })

  it('includes table_version and calibrated_by', () => {
    const sql = generateSeedSql(tinyInput())
    expect(sql).toContain('table_version = 1')
    expect(sql).toContain("'00000000-0000-0000-0000-000000000001'")
  })

  it('includes generation timestamp in header comment', () => {
    const sql = generateSeedSql(tinyInput())
    expect(sql).toContain('2026-04-28T12:00:00.000Z')
  })

  it('escapes single quotes in identifier columns (defensive)', () => {
    const input = tinyInput()
    // Edge case: should not happen with valid enum values, but converter
    // must not break if a row sneaks through with a weird character.
    input.defaults[0].format = "photo'evil"
    const sql = generateSeedSql(input)
    expect(sql).toContain("'photo''evil'")
  })
})
