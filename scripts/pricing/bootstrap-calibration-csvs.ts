/**
 * Frontfiles — Bootstrap calibration CSVs (L5 implementation, F1.5 v2 §9)
 *
 * Generates the 5 empty CSV templates the founder fills during the
 * Stage B calibration pass. Idempotent: safe to re-run if dimensions
 * change (e.g., new AssetFormat value added) — overwrites only when
 * existing CSVs are still in their pre-fill anchor state.
 *
 * Usage:
 *   bun run scripts/pricing/bootstrap-calibration-csvs.ts
 *
 * Outputs (all in docs/pricing/calibration/):
 *   - format_defaults_v1_eur.csv     (63 rows + header)
 *   - platform_floors_v1_eur.csv     (63 rows + header)
 *   - sublabel_multipliers_v1.csv    (17 rows + header; editorial.news = 1.000 anchor)
 *   - use_tier_multipliers_v1.csv    (12 rows + header; tier_2 = 1.000 anchor per class)
 *   - cc_variants_v1_eur.csv         (7 rows + header; cc0 = 0 anchor)
 *
 * Per F1.5 v2 §9.3: when L2 implementation lands and ships
 * `src/lib/licence/types.ts`, this script SHOULD migrate to import
 * LICENCE_SUBLABELS / CC_VARIANTS / USE_TIERS from there. v1 uses
 * inline literal lists (the F1.5 §9.3 fallback path) so the bootstrap
 * works before L2 ships.
 *
 * SERVER-ONLY (Bun runtime; uses fs).
 */

import fs from 'fs'
import path from 'path'

// ── Dimension enumerations (per L1 v2 §4.2 + F1.5 v2 §3) ──────────────

const FORMATS = [
  'photo',
  'illustration',
  'infographic',
  'vector',
  'video',
  'audio',
  'text',
] as const

const INTRUSION_LEVELS = ['light', 'standard', 'heavy'] as const

/** v2: 3 cell-bearing classes; creative_commons excluded (handled via cc_variants table). */
const CELL_LICENCE_CLASSES = ['editorial', 'commercial', 'advertising'] as const

const USE_TIERS = ['tier_1', 'tier_2', 'tier_3', 'tier_4'] as const

const CC_VARIANTS = [
  'cc0',
  'cc_by',
  'cc_by_sa',
  'cc_by_nc',
  'cc_by_nd',
  'cc_by_nc_sa',
  'cc_by_nc_nd',
] as const

/** 17 non-CC sublabels per L1 v2 §4.2 (Editorial 6 + Commercial 4 + Advertising 7). */
const NON_CC_SUBLABELS = [
  // Editorial (6)
  'editorial.news',
  'editorial.longform',
  'editorial.documentary',
  'editorial.book',
  'editorial.commentary',
  'editorial.educational',
  // Commercial (4)
  'commercial.brand_content',
  'commercial.corporate_communications',
  'commercial.merchandise',
  'commercial.internal_training',
  // Advertising (7)
  'advertising.print_ad',
  'advertising.digital_ad',
  'advertising.social_ad',
  'advertising.out_of_home',
  'advertising.broadcast',
  'advertising.native_advertorial',
  'advertising.influencer',
] as const

const CALIBRATION_DIR = path.resolve(__dirname, '..', '..', 'docs', 'pricing', 'calibration')

// ── CSV builders ──────────────────────────────────────────────────────

function buildFormatDefaultsCsv(): string {
  const rows: string[] = ['format,intrusion_level,licence_class,currency,baseline_cents,calibration_basis']
  for (const f of FORMATS)
    for (const i of INTRUSION_LEVELS)
      for (const l of CELL_LICENCE_CLASSES) rows.push(`${f},${i},${l},EUR,,`)
  return rows.join('\n') + '\n'
}

function buildPlatformFloorsCsv(): string {
  const rows: string[] = ['format,intrusion_level,licence_class,currency,min_cents']
  for (const f of FORMATS)
    for (const i of INTRUSION_LEVELS)
      for (const l of CELL_LICENCE_CLASSES) rows.push(`${f},${i},${l},EUR,`)
  return rows.join('\n') + '\n'
}

function buildSublabelMultipliersCsv(): string {
  const rows: string[] = ['sublabel,multiplier']
  for (const sl of NON_CC_SUBLABELS) {
    const preset = sl === 'editorial.news' ? '1.000' : ''
    rows.push(`${sl},${preset}`)
  }
  return rows.join('\n') + '\n'
}

function buildUseTierMultipliersCsv(): string {
  const rows: string[] = ['licence_class,use_tier,multiplier']
  for (const c of CELL_LICENCE_CLASSES)
    for (const t of USE_TIERS) {
      const preset = t === 'tier_2' ? '1.000' : ''
      rows.push(`${c},${t},${preset}`)
    }
  return rows.join('\n') + '\n'
}

function buildCcVariantsCsv(): string {
  const rows: string[] = ['cc_variant,currency,price_cents']
  for (const v of CC_VARIANTS) {
    const preset = v === 'cc0' ? '0' : ''
    rows.push(`${v},EUR,${preset}`)
  }
  return rows.join('\n') + '\n'
}

// ── Idempotency check ────────────────────────────────────────────────

/**
 * Determine whether a CSV file already has user-supplied calibration
 * values (which should not be overwritten) versus only the pre-filled
 * anchors (safe to overwrite). Returns true if there are user values
 * beyond the documented anchors.
 *
 * Anchors (safe to overwrite): editorial.news = 1.000; tier_2 = 1.000
 * per class; cc0 = 0. Anything else is treated as user input.
 */
function hasUserValues(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').slice(1) // skip header
  for (const line of lines) {
    const cells = line.split(',')
    const last = cells[cells.length - 1]?.trim() ?? ''
    const secondLast = cells[cells.length - 2]?.trim() ?? ''

    // calibration_basis column (last in format_defaults) holds free text;
    // a non-empty value indicates user input.
    if (filePath.endsWith('format_defaults_v1_eur.csv')) {
      if (last !== '' || secondLast !== '') return true
      continue
    }

    // Other CSVs: last column is the calibration value (multiplier or cents).
    if (last === '') continue
    if (filePath.endsWith('sublabel_multipliers_v1.csv')) {
      if (line.startsWith('editorial.news,1.000')) continue // anchor
      return true
    }
    if (filePath.endsWith('use_tier_multipliers_v1.csv')) {
      if (line.endsWith(',tier_2,1.000') || /,tier_2,1\.000$/.test(line)) continue // anchor (any class)
      return true
    }
    if (filePath.endsWith('cc_variants_v1_eur.csv')) {
      if (line === 'cc0,EUR,0') continue // anchor
      return true
    }
    if (filePath.endsWith('platform_floors_v1_eur.csv')) {
      return true // any non-empty min_cents is user input
    }
  }
  return false
}

function writeCsv(name: string, content: string): { written: boolean; reason?: string } {
  const filePath = path.join(CALIBRATION_DIR, name)
  if (hasUserValues(filePath)) {
    return { written: false, reason: 'user values present; refuse to overwrite' }
  }
  fs.mkdirSync(CALIBRATION_DIR, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  return { written: true }
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  console.log(`▶ Generating calibration CSV templates in ${CALIBRATION_DIR}`)

  const tasks: Array<{ name: string; rowCount: number; build: () => string }> = [
    { name: 'format_defaults_v1_eur.csv', rowCount: 63, build: buildFormatDefaultsCsv },
    { name: 'platform_floors_v1_eur.csv', rowCount: 63, build: buildPlatformFloorsCsv },
    { name: 'sublabel_multipliers_v1.csv', rowCount: 17, build: buildSublabelMultipliersCsv },
    { name: 'use_tier_multipliers_v1.csv', rowCount: 12, build: buildUseTierMultipliersCsv },
    { name: 'cc_variants_v1_eur.csv', rowCount: 7, build: buildCcVariantsCsv },
  ]

  let writtenCount = 0
  let skippedCount = 0
  const skipped: string[] = []

  for (const t of tasks) {
    const result = writeCsv(t.name, t.build())
    if (result.written) {
      console.log(`  wrote ${t.rowCount} rows → ${t.name}`)
      writtenCount++
    } else {
      console.log(`  skipped ${t.name}: ${result.reason}`)
      skippedCount++
      skipped.push(t.name)
    }
  }

  console.log('')
  console.log(`Done. ${writtenCount} written, ${skippedCount} skipped.`)
  if (skipped.length > 0) {
    console.log('To regenerate the skipped files, delete them manually first:')
    for (const name of skipped) console.log(`  rm ${path.join('docs', 'pricing', 'calibration', name)}`)
  }
}

main()
