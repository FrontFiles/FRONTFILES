/**
 * Frontfiles — CSV to SQL seed migration converter (L5 implementation, F1.5 v2 §10)
 *
 * Reads the 5 founder-filled calibration CSVs and emits a SQL seed
 * migration with 5 INSERT blocks (one per pricing table). Validation
 * runs first; errors block; warnings print but allow continuation.
 *
 * Usage:
 *   CALIBRATED_BY_USER_ID=<founder-uuid> bun run scripts/pricing/csv-to-seed-migration.ts
 *
 * Output:
 *   supabase/migrations/_pending/<TIMESTAMP>_pricing_seed_v1.sql
 *
 * The _pending/ directory is gitignored; F2 directive moves the seed
 * into supabase/migrations/ with a timestamp prefix at F2 ship time.
 *
 * SERVER-ONLY (Bun runtime; uses fs).
 */

import fs from 'fs'
import path from 'path'

// ── Dimension enumerations (mirror bootstrap-calibration-csvs.ts) ─────

const FORMATS = new Set([
  'photo',
  'illustration',
  'infographic',
  'vector',
  'video',
  'audio',
  'text',
])

const INTRUSION_LEVELS = new Set(['light', 'standard', 'heavy'])

const CELL_LICENCE_CLASSES = new Set(['editorial', 'commercial', 'advertising'])

const USE_TIERS = new Set(['tier_1', 'tier_2', 'tier_3', 'tier_4'])

const CC_VARIANTS = new Set([
  'cc0',
  'cc_by',
  'cc_by_sa',
  'cc_by_nc',
  'cc_by_nd',
  'cc_by_nc_sa',
  'cc_by_nc_nd',
])

const NON_CC_SUBLABELS = new Set([
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
])

// Sanity bounds for per-cell calibration values.
const CENTS_MIN = 100 // €1.00
const CENTS_MAX = 10_000_000 // €100,000.00
const MULTIPLIER_MIN = 0.1
const MULTIPLIER_MAX = 10.0

// ── Public types ─────────────────────────────────────────────────────

export interface FormatDefaultRow {
  format: string
  intrusion_level: string
  licence_class: string
  currency: string
  baseline_cents: number
  calibration_basis: string
}

export interface PlatformFloorRow {
  format: string
  intrusion_level: string
  licence_class: string
  currency: string
  min_cents: number
}

export interface SublabelMultiplierRow {
  sublabel: string
  multiplier: number
}

export interface UseTierMultiplierRow {
  licence_class: string
  use_tier: string
  multiplier: number
}

export interface CcVariantRow {
  cc_variant: string
  currency: string
  price_cents: number
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

// ── CSV parsing ──────────────────────────────────────────────────────

/**
 * Parse a CSV with a known header. Returns array of records keyed on
 * the header columns. Handles trailing newlines and empty trailing lines.
 * Does NOT handle quoted fields with embedded commas (calibration_basis
 * may need this — we use simple single-line splitting; if a basis
 * contains a comma, the founder must quote the cell or use semicolons).
 */
export function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0)
  if (lines.length < 1) return []
  const header = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = (cells[i] ?? '').trim()
    }
    return row
  })
}

/**
 * Parse a single CSV line, respecting double-quoted fields that may
 * contain commas. Doubled quotes (`""`) inside a quoted field decode to a
 * single quote. Sufficient for `calibration_basis` text cells without
 * pulling in a CSV library.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === ',') {
        cells.push(current)
        current = ''
      } else if (ch === '"' && current.length === 0) {
        inQuotes = true
      } else {
        current += ch
      }
    }
  }
  cells.push(current)
  return cells
}

// ── Validators ───────────────────────────────────────────────────────

export function validateFormatDefaults(rows: Array<Record<string, string>>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expectedRows = 7 * 3 * 3 // 63
  if (rows.length !== expectedRows)
    errors.push(`format_defaults: expected ${expectedRows} rows, got ${rows.length}`)
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const where = `format_defaults row ${i + 2}` // +2 = 1-indexed + header
    if (!FORMATS.has(r.format)) errors.push(`${where}: unknown format '${r.format}'`)
    if (!INTRUSION_LEVELS.has(r.intrusion_level))
      errors.push(`${where}: unknown intrusion_level '${r.intrusion_level}'`)
    if (!CELL_LICENCE_CLASSES.has(r.licence_class))
      errors.push(
        `${where}: unknown licence_class '${r.licence_class}' (creative_commons belongs in cc_variants_v1_eur.csv)`,
      )
    if (r.currency !== 'EUR') errors.push(`${where}: currency must be EUR, got '${r.currency}'`)
    const cents = Number(r.baseline_cents)
    if (!Number.isInteger(cents) || cents <= 0) {
      errors.push(`${where}: baseline_cents must be a positive integer, got '${r.baseline_cents}'`)
    } else if (cents < CENTS_MIN || cents > CENTS_MAX) {
      warnings.push(
        `${where}: baseline_cents ${cents} outside sanity bounds [${CENTS_MIN}, ${CENTS_MAX}]`,
      )
    }
    if ((r.calibration_basis ?? '').trim().length < 5)
      warnings.push(`${where}: calibration_basis is empty or too short (< 5 chars)`)
    const key = `${r.format}|${r.intrusion_level}|${r.licence_class}`
    if (seen.has(key)) errors.push(`${where}: duplicate (format, intrusion_level, licence_class)`)
    seen.add(key)
  }
  return { errors, warnings }
}

export function validatePlatformFloors(rows: Array<Record<string, string>>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expectedRows = 7 * 3 * 3 // 63
  if (rows.length !== expectedRows)
    errors.push(`platform_floors: expected ${expectedRows} rows, got ${rows.length}`)
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const where = `platform_floors row ${i + 2}`
    if (!FORMATS.has(r.format)) errors.push(`${where}: unknown format '${r.format}'`)
    if (!INTRUSION_LEVELS.has(r.intrusion_level))
      errors.push(`${where}: unknown intrusion_level '${r.intrusion_level}'`)
    if (!CELL_LICENCE_CLASSES.has(r.licence_class))
      errors.push(`${where}: unknown licence_class '${r.licence_class}'`)
    if (r.currency !== 'EUR') errors.push(`${where}: currency must be EUR, got '${r.currency}'`)
    const cents = Number(r.min_cents)
    if (!Number.isInteger(cents) || cents <= 0) {
      errors.push(`${where}: min_cents must be a positive integer, got '${r.min_cents}'`)
    } else if (cents < CENTS_MIN || cents > CENTS_MAX) {
      warnings.push(`${where}: min_cents ${cents} outside sanity bounds [${CENTS_MIN}, ${CENTS_MAX}]`)
    }
    const key = `${r.format}|${r.intrusion_level}|${r.licence_class}`
    if (seen.has(key)) errors.push(`${where}: duplicate (format, intrusion_level, licence_class)`)
    seen.add(key)
  }
  return { errors, warnings }
}

export function validateSublabelMultipliers(
  rows: Array<Record<string, string>>,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expected = NON_CC_SUBLABELS.size
  if (rows.length !== expected)
    errors.push(`sublabel_multipliers: expected ${expected} rows, got ${rows.length}`)
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const where = `sublabel_multipliers row ${i + 2}`
    if (!NON_CC_SUBLABELS.has(r.sublabel))
      errors.push(`${where}: unknown sublabel '${r.sublabel}'`)
    const mult = Number(r.multiplier)
    if (!Number.isFinite(mult) || mult <= 0) {
      errors.push(`${where}: multiplier must be a positive number, got '${r.multiplier}'`)
    } else if (mult < MULTIPLIER_MIN || mult > MULTIPLIER_MAX) {
      warnings.push(
        `${where}: multiplier ${mult} outside sanity bounds [${MULTIPLIER_MIN}, ${MULTIPLIER_MAX}]`,
      )
    }
    if (seen.has(r.sublabel)) errors.push(`${where}: duplicate sublabel`)
    seen.add(r.sublabel)
  }
  return { errors, warnings }
}

export function validateUseTierMultipliers(
  rows: Array<Record<string, string>>,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expected = CELL_LICENCE_CLASSES.size * USE_TIERS.size
  if (rows.length !== expected)
    errors.push(`use_tier_multipliers: expected ${expected} rows, got ${rows.length}`)
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const where = `use_tier_multipliers row ${i + 2}`
    if (!CELL_LICENCE_CLASSES.has(r.licence_class))
      errors.push(`${where}: unknown licence_class '${r.licence_class}'`)
    if (!USE_TIERS.has(r.use_tier))
      errors.push(`${where}: unknown use_tier '${r.use_tier}'`)
    const mult = Number(r.multiplier)
    if (!Number.isFinite(mult) || mult <= 0) {
      errors.push(`${where}: multiplier must be a positive number, got '${r.multiplier}'`)
    } else if (mult < MULTIPLIER_MIN || mult > MULTIPLIER_MAX) {
      warnings.push(`${where}: multiplier ${mult} outside sanity bounds`)
    }
    const key = `${r.licence_class}|${r.use_tier}`
    if (seen.has(key)) errors.push(`${where}: duplicate (licence_class, use_tier)`)
    seen.add(key)
  }
  return { errors, warnings }
}

export function validateCcVariants(rows: Array<Record<string, string>>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expected = CC_VARIANTS.size
  if (rows.length !== expected)
    errors.push(`cc_variants: expected ${expected} rows, got ${rows.length}`)
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const where = `cc_variants row ${i + 2}`
    if (!CC_VARIANTS.has(r.cc_variant))
      errors.push(`${where}: unknown cc_variant '${r.cc_variant}'`)
    if (r.currency !== 'EUR') errors.push(`${where}: currency must be EUR`)
    const cents = Number(r.price_cents)
    if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) {
      errors.push(`${where}: price_cents must be a non-negative integer, got '${r.price_cents}'`)
    } else if (cents > CENTS_MAX) {
      warnings.push(`${where}: price_cents ${cents} above sanity bound ${CENTS_MAX}`)
    }
    if (r.cc_variant === 'cc0' && cents !== 0)
      warnings.push(`${where}: CC0 should be 0 (public domain dedication); got ${cents}`)
    if (seen.has(r.cc_variant)) errors.push(`${where}: duplicate cc_variant`)
    seen.add(r.cc_variant)
  }
  return { errors, warnings }
}

/**
 * Cross-CSV check: every floor cell should be ≤ baseline_cents ×
 * min(use_tier_multiplier across class). Per F1.5 v2 §7.3 — warning, not
 * error. Founder reviews flagged combinations.
 */
export function validateFloorsBelowDefaults(
  defaults: FormatDefaultRow[],
  floors: PlatformFloorRow[],
  useTierMults: UseTierMultiplierRow[],
): ValidationResult {
  const warnings: string[] = []
  const minMultByClass = new Map<string, number>()
  for (const m of useTierMults) {
    const cur = minMultByClass.get(m.licence_class)
    minMultByClass.set(m.licence_class, cur === undefined ? m.multiplier : Math.min(cur, m.multiplier))
  }
  const defaultsByKey = new Map<string, FormatDefaultRow>()
  for (const d of defaults)
    defaultsByKey.set(`${d.format}|${d.intrusion_level}|${d.licence_class}`, d)

  for (const f of floors) {
    const key = `${f.format}|${f.intrusion_level}|${f.licence_class}`
    const def = defaultsByKey.get(key)
    if (!def) continue
    const minMult = minMultByClass.get(f.licence_class) ?? 1
    const minDefault = Math.round(def.baseline_cents * minMult)
    if (f.min_cents > minDefault) {
      warnings.push(
        `floor ${f.min_cents} > baseline ${def.baseline_cents} × min_use_tier_mult ${minMult.toFixed(3)} = ${minDefault} for ${key}; engine will clamp every recommendation up`,
      )
    }
  }
  return { errors: [], warnings }
}

// ── SQL escaping ─────────────────────────────────────────────────────

function quoteString(s: string | undefined): string {
  if (s == null) return 'NULL'
  // Use $$...$$ dollar-quoting to avoid escaping single quotes in basis text.
  // If $$ appears in the string, fall back to $tag$...$tag$.
  const safe = s.includes('$$')
    ? `$ff$${s.replace(/\$ff\$/g, '\\$ff\\$')}$ff$`
    : `$$${s}$$`
  return safe
}

function quoteId(s: string): string {
  // Single-quoted SQL string with single-quote escaping.
  return `'${s.replace(/'/g, "''")}'`
}

// ── SQL generation ───────────────────────────────────────────────────

export interface SeedSqlInput {
  defaults: FormatDefaultRow[]
  floors: PlatformFloorRow[]
  sublabelMults: SublabelMultiplierRow[]
  useTierMults: UseTierMultiplierRow[]
  ccVariants: CcVariantRow[]
  tableVersion: number
  calibratedBy: string
  generatedAt: string // ISO timestamp
}

export function generateSeedSql(input: SeedSqlInput): string {
  const { defaults, floors, sublabelMults, useTierMults, ccVariants, tableVersion, calibratedBy, generatedAt } = input
  const lines: string[] = []
  lines.push('-- F2 seed (v1, EUR) — 5 pricing tables')
  lines.push(`-- Generated by scripts/pricing/csv-to-seed-migration.ts on ${generatedAt}`)
  lines.push(`-- Calibrated by user ${calibratedBy} (table_version = ${tableVersion})`)
  lines.push('')

  // Block 1 — pricing_format_defaults (63 rows)
  lines.push(`-- Block 1: pricing_format_defaults (${defaults.length} rows)`)
  lines.push('INSERT INTO pricing_format_defaults')
  lines.push(
    '  (format, intrusion_level, licence_class, currency, baseline_cents, table_version, effective_from, calibration_basis, calibrated_at, calibrated_by)',
  )
  lines.push('VALUES')
  lines.push(
    defaults
      .map(
        (r) =>
          `  (${quoteId(r.format)}, ${quoteId(r.intrusion_level)}, ${quoteId(r.licence_class)}, ${quoteId(r.currency)}, ${r.baseline_cents}, ${tableVersion}, now(), ${quoteString(r.calibration_basis)}, now(), ${quoteId(calibratedBy)})`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  // Block 2 — pricing_platform_floors (63 rows)
  lines.push(`-- Block 2: pricing_platform_floors (${floors.length} rows)`)
  lines.push('INSERT INTO pricing_platform_floors')
  lines.push(
    '  (format, intrusion_level, licence_class, currency, min_cents, effective_from, calibrated_at, calibrated_by)',
  )
  lines.push('VALUES')
  lines.push(
    floors
      .map(
        (r) =>
          `  (${quoteId(r.format)}, ${quoteId(r.intrusion_level)}, ${quoteId(r.licence_class)}, ${quoteId(r.currency)}, ${r.min_cents}, now(), now(), ${quoteId(calibratedBy)})`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  // Block 3 — pricing_sublabel_multipliers (17 rows)
  lines.push(`-- Block 3: pricing_sublabel_multipliers (${sublabelMults.length} rows)`)
  lines.push('INSERT INTO pricing_sublabel_multipliers')
  lines.push('  (sublabel, multiplier, effective_from, calibrated_at, calibrated_by)')
  lines.push('VALUES')
  lines.push(
    sublabelMults
      .map(
        (r) =>
          `  (${quoteId(r.sublabel)}, ${r.multiplier}, now(), now(), ${quoteId(calibratedBy)})`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  // Block 4 — pricing_use_tier_multipliers (12 rows)
  lines.push(`-- Block 4: pricing_use_tier_multipliers (${useTierMults.length} rows)`)
  lines.push('INSERT INTO pricing_use_tier_multipliers')
  lines.push('  (licence_class, use_tier, multiplier, effective_from, calibrated_at, calibrated_by)')
  lines.push('VALUES')
  lines.push(
    useTierMults
      .map(
        (r) =>
          `  (${quoteId(r.licence_class)}, ${quoteId(r.use_tier)}, ${r.multiplier}, now(), now(), ${quoteId(calibratedBy)})`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  // Block 5 — pricing_cc_variants (7 rows)
  lines.push(`-- Block 5: pricing_cc_variants (${ccVariants.length} rows)`)
  lines.push('INSERT INTO pricing_cc_variants')
  lines.push('  (cc_variant, currency, price_cents, effective_from, calibrated_at, calibrated_by)')
  lines.push('VALUES')
  lines.push(
    ccVariants
      .map(
        (r) =>
          `  (${quoteId(r.cc_variant)}, ${quoteId(r.currency)}, ${r.price_cents}, now(), now(), ${quoteId(calibratedBy)})`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  return lines.join('\n')
}

// ── Row coercion ─────────────────────────────────────────────────────

function coerceFormatDefaults(raw: Array<Record<string, string>>): FormatDefaultRow[] {
  return raw.map((r) => ({
    format: r.format,
    intrusion_level: r.intrusion_level,
    licence_class: r.licence_class,
    currency: r.currency,
    baseline_cents: Number(r.baseline_cents),
    calibration_basis: r.calibration_basis ?? '',
  }))
}

function coercePlatformFloors(raw: Array<Record<string, string>>): PlatformFloorRow[] {
  return raw.map((r) => ({
    format: r.format,
    intrusion_level: r.intrusion_level,
    licence_class: r.licence_class,
    currency: r.currency,
    min_cents: Number(r.min_cents),
  }))
}

function coerceSublabelMultipliers(
  raw: Array<Record<string, string>>,
): SublabelMultiplierRow[] {
  return raw.map((r) => ({ sublabel: r.sublabel, multiplier: Number(r.multiplier) }))
}

function coerceUseTierMultipliers(
  raw: Array<Record<string, string>>,
): UseTierMultiplierRow[] {
  return raw.map((r) => ({
    licence_class: r.licence_class,
    use_tier: r.use_tier,
    multiplier: Number(r.multiplier),
  }))
}

function coerceCcVariants(raw: Array<Record<string, string>>): CcVariantRow[] {
  return raw.map((r) => ({
    cc_variant: r.cc_variant,
    currency: r.currency,
    price_cents: Number(r.price_cents),
  }))
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  const calibratedBy = process.env.CALIBRATED_BY_USER_ID
  if (!calibratedBy) {
    console.error('CALIBRATED_BY_USER_ID env var required (founder/admin user UUID).')
    process.exit(1)
  }

  const calibrationDir = path.resolve(__dirname, '..', '..', 'docs', 'pricing', 'calibration')
  const pendingDir = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '_pending')

  const csvFiles = {
    defaults: 'format_defaults_v1_eur.csv',
    floors: 'platform_floors_v1_eur.csv',
    sublabelMults: 'sublabel_multipliers_v1.csv',
    useTierMults: 'use_tier_multipliers_v1.csv',
    ccVariants: 'cc_variants_v1_eur.csv',
  }

  // Read all 5 CSVs
  const rawData: Record<string, Array<Record<string, string>>> = {}
  for (const [key, name] of Object.entries(csvFiles)) {
    const filePath = path.join(calibrationDir, name)
    if (!fs.existsSync(filePath)) {
      console.error(`Missing CSV: ${filePath}`)
      console.error('Run scripts/pricing/bootstrap-calibration-csvs.ts first.')
      process.exit(1)
    }
    rawData[key] = parseCsv(fs.readFileSync(filePath, 'utf8'))
  }

  // Validate each CSV
  const allErrors: string[] = []
  const allWarnings: string[] = []

  const r1 = validateFormatDefaults(rawData.defaults)
  allErrors.push(...r1.errors)
  allWarnings.push(...r1.warnings)
  const r2 = validatePlatformFloors(rawData.floors)
  allErrors.push(...r2.errors)
  allWarnings.push(...r2.warnings)
  const r3 = validateSublabelMultipliers(rawData.sublabelMults)
  allErrors.push(...r3.errors)
  allWarnings.push(...r3.warnings)
  const r4 = validateUseTierMultipliers(rawData.useTierMults)
  allErrors.push(...r4.errors)
  allWarnings.push(...r4.warnings)
  const r5 = validateCcVariants(rawData.ccVariants)
  allErrors.push(...r5.errors)
  allWarnings.push(...r5.warnings)

  // Block on per-CSV errors before cross-CSV check
  if (allErrors.length > 0) {
    console.error('VALIDATION ERRORS — converter aborted:')
    for (const e of allErrors) console.error('  ' + e)
    process.exit(1)
  }

  // Coerce + cross-check
  const defaults = coerceFormatDefaults(rawData.defaults)
  const floors = coercePlatformFloors(rawData.floors)
  const sublabelMults = coerceSublabelMultipliers(rawData.sublabelMults)
  const useTierMults = coerceUseTierMultipliers(rawData.useTierMults)
  const ccVariants = coerceCcVariants(rawData.ccVariants)

  const cross = validateFloorsBelowDefaults(defaults, floors, useTierMults)
  allWarnings.push(...cross.warnings)

  if (allWarnings.length > 0) {
    console.warn('Warnings (proceeding anyway):')
    for (const w of allWarnings) console.warn('  ' + w)
    console.warn('')
  }

  // Generate SQL
  const generatedAt = new Date().toISOString()
  const sql = generateSeedSql({
    defaults,
    floors,
    sublabelMults,
    useTierMults,
    ccVariants,
    tableVersion: 1,
    calibratedBy,
    generatedAt,
  })

  // Write output
  fs.mkdirSync(pendingDir, { recursive: true })
  const timestamp = generatedAt.replace(/[-:.]/g, '').slice(0, 15) // YYYYMMDDTHHMMSS
  const outPath = path.join(pendingDir, `${timestamp}_pricing_seed_v1.sql`)
  fs.writeFileSync(outPath, sql, 'utf8')

  const totalRows = defaults.length + floors.length + sublabelMults.length + useTierMults.length + ccVariants.length
  console.log(`Wrote SQL seed: ${outPath}`)
  console.log(
    `  ${defaults.length} format_defaults + ${floors.length} platform_floors + ${sublabelMults.length} sublabel_mults + ${useTierMults.length} use_tier_mults + ${ccVariants.length} cc_variants = ${totalRows} rows`,
  )
  console.log('Move to supabase/migrations/ when F2 schema migration ships.')
}

// Only run main when invoked directly (not when imported by tests).
if (require.main === module) {
  main()
}
