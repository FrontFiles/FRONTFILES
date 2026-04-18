/**
 * Frontfiles — Watermark Profile Loader
 *
 * Loads watermark profiles for the compositor. Dual-mode:
 *   mock (in-memory): returns hand-written seed profiles
 *   real (Supabase):  SELECTs from `watermark_profiles`
 *
 * The processing pipeline calls this to get the rendering recipe
 * for a given (intrusion_level, template_family) pair.
 *
 * FAIL-CLOSED: `getApprovedProfile` returns null when no approved
 * profile exists for the requested combination. The pipeline treats
 * that as a hard stop — nothing ships until a profile is explicitly
 * approved. That rule is enforced in the pipeline, not here.
 *
 * In mock mode, all seed profiles are emitted with `approvalStatus:
 * 'draft'` so dev harness output is visible but the pipeline still
 * refuses to process them unless `allowDraft` is set. This mirrors
 * how the DB will behave after migration and before approval.
 *
 * SERVER-ONLY. Never import from a client component.
 */

import { env, isSupabaseEnvPresent } from '@/lib/env'
import type {
  WatermarkIntrusionLevel,
  TemplateFamily,
  WatermarkProfile,
  WatermarkApprovalStatus,
  BarPosition,
  BarBlock,
  ScatterConfig,
} from './types'

// ═══════════════════════════════════════════════════════════════
// Mode selector (CCP 4)
// ═══════════════════════════════════════════════════════════════

const MODE: 'real' | 'mock' = isSupabaseEnvPresent ? 'real' : 'mock'

let _modeLogged = false
function logModeOnce(): void {
  if (_modeLogged) return
  _modeLogged = true
  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(`[ff:mode] profiles=${MODE}`)
  }
}

// ─── Lazy Supabase client accessor ──────────────────────────

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ══════════════════════════════════════════════
// SEED PROFILES (Draft — NOT approved)
//
// These are development defaults based on the PSD templates.
// All 6 start as 'draft'. The product owner must approve each
// one individually before the pipeline uses them in production.
//
// Positions are ratios relative to image dimensions (0.0–1.0).
// Extracted from the PSD layer bounding boxes:
//   Landscape 1920x1080: bar at x=1773..1891 → x_ratio ≈ 0.924
//   Portrait 1080x1920:  bar at x=930..1049  → x_ratio ≈ 0.861
// ══════════════════════════════════════════════

const SEED_PROFILES: WatermarkProfile[] = [
  // ── LIGHT: bar at edge, minimal disruption ──
  {
    id: 'seed-light-portrait',
    version: 1,
    intrusionLevel: 'light',
    templateFamily: 'portrait',
    barPosition: { xRatio: 0.92, yRatio: 0.02, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: null,
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: 'seed-light-landscape',
    version: 1,
    intrusionLevel: 'light',
    templateFamily: 'landscape',
    barPosition: { xRatio: 0.92, yRatio: 0.02, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: null,
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },

  // ── STANDARD: bar shifted toward center, harder to crop ──
  // Landscape PSD bar position moved up per product owner direction
  {
    id: 'seed-standard-portrait',
    version: 1,
    intrusionLevel: 'standard',
    templateFamily: 'portrait',
    barPosition: { xRatio: 0.86, yRatio: 0.02, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: null,
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: 'seed-standard-landscape',
    version: 1,
    intrusionLevel: 'standard',
    templateFamily: 'landscape',
    barPosition: { xRatio: 0.86, yRatio: 0.015, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: null,
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },

  // ── HEAVY: bar + scattered FF brand icons ──
  {
    id: 'seed-heavy-portrait',
    version: 1,
    intrusionLevel: 'heavy',
    templateFamily: 'portrait',
    barPosition: { xRatio: 0.86, yRatio: 0.02, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: { density: 8, opacity: 0.10, iconSizePx: 28 },
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: 'seed-heavy-landscape',
    version: 1,
    intrusionLevel: 'heavy',
    templateFamily: 'landscape',
    barPosition: { xRatio: 0.86, yRatio: 0.015, anchor: 'top-right' },
    barWidthRatio: 0.06,
    brandBlock: { heightRatio: 0.11 },
    idBlock: { heightRatio: 0.49 },
    attributionBlock: { heightRatio: 0.40 },
    scatterConfig: { density: 8, opacity: 0.10, iconSizePx: 28 },
    approvalStatus: 'draft',
    approvedBy: null,
    approvedAt: null,
  },
]

// ═══════════════════════════════════════════════════════════════
// Row → WatermarkProfile converter
//
// The DB column names are snake_case; the in-app type is camelCase.
// NUMERIC columns come back from supabase-js as strings for
// precision — we Number() them at the edge so the rest of the
// codebase keeps treating these values as numbers.
//
// `approval_status` is an enum in postgres and validates as text
// in supabase-js. We cast rather than re-validate because the SQL
// CHECK constraint is the canonical guard.
// ═══════════════════════════════════════════════════════════════

interface WatermarkProfileDbRow {
  id: string
  version: number
  intrusion_level: WatermarkIntrusionLevel
  template_family: TemplateFamily
  bar_position: { x_ratio: number | string; y_ratio: number | string; anchor: BarPosition['anchor'] }
  bar_width_ratio: number | string
  brand_block: { height_ratio: number | string }
  id_block: { height_ratio: number | string }
  attribution_block: { height_ratio: number | string }
  scatter_config:
    | { density: number | string; opacity: number | string; icon_size_px: number | string }
    | null
  approval_status: WatermarkApprovalStatus
  approved_by: string | null
  approved_at: string | null
}

function toBlock(raw: { height_ratio: number | string }): BarBlock {
  return { heightRatio: Number(raw.height_ratio) }
}

function toScatter(
  raw: WatermarkProfileDbRow['scatter_config'],
): ScatterConfig | null {
  if (!raw) return null
  return {
    density: Number(raw.density),
    opacity: Number(raw.opacity),
    iconSizePx: Number(raw.icon_size_px),
  }
}

function rowToProfile(row: WatermarkProfileDbRow): WatermarkProfile {
  return {
    id: row.id,
    version: row.version,
    intrusionLevel: row.intrusion_level,
    templateFamily: row.template_family,
    barPosition: {
      xRatio: Number(row.bar_position.x_ratio),
      yRatio: Number(row.bar_position.y_ratio),
      anchor: row.bar_position.anchor,
    },
    barWidthRatio: Number(row.bar_width_ratio),
    brandBlock: toBlock(row.brand_block),
    idBlock: toBlock(row.id_block),
    attributionBlock: toBlock(row.attribution_block),
    scatterConfig: toScatter(row.scatter_config),
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
  }
}

const PROFILE_COLUMNS =
  'id, version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config, approval_status, approved_by, approved_at'

// ══════════════════════════════════════════════
// PUBLIC — profile loader
// ══════════════════════════════════════════════

/**
 * Load the current approved watermark profile for a given level and family.
 *
 * Returns the highest-version approved profile, or null if none exists.
 *
 * Real path:
 *   SELECT * FROM watermark_profiles
 *   WHERE approval_status = 'approved'
 *     AND intrusion_level = ?
 *     AND template_family = ?
 *   ORDER BY version DESC
 *   LIMIT 1
 *
 * Mock path: returns the matching seed profile (always `draft`).
 * The pipeline treats `draft` as a fail-closed signal unless
 * `allowDraft` is explicitly set — see `processDerivative`.
 */
export async function getApprovedProfile(
  level: WatermarkIntrusionLevel,
  family: TemplateFamily,
): Promise<WatermarkProfile | null> {
  logModeOnce()

  if (MODE === 'mock') {
    const match = SEED_PROFILES.find(
      (p) => p.intrusionLevel === level && p.templateFamily === family,
    )
    return match ?? null
  }

  const client = await db()
  const { data, error } = await client
    .from('watermark_profiles')
    .select(PROFILE_COLUMNS)
    .eq('approval_status', 'approved')
    .eq('intrusion_level', level)
    .eq('template_family', family)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `profiles: getApprovedProfile failed (${error.message})`,
    )
  }
  if (!data) return null
  return rowToProfile(data as unknown as WatermarkProfileDbRow)
}

/**
 * Load all profiles for a given intrusion level (both families).
 * Used by the dev harness to display profiles for review.
 *
 * Real path: returns ALL versions + statuses for the level. The
 * dev harness wants the full history. Callers that only want the
 * currently-active profile per family should use `getApprovedProfile`.
 */
export async function getProfilesForLevel(
  level: WatermarkIntrusionLevel,
): Promise<WatermarkProfile[]> {
  logModeOnce()

  if (MODE === 'mock') {
    return SEED_PROFILES.filter((p) => p.intrusionLevel === level)
  }

  const client = await db()
  const { data, error } = await client
    .from('watermark_profiles')
    .select(PROFILE_COLUMNS)
    .eq('intrusion_level', level)
    .order('template_family', { ascending: true })
    .order('version', { ascending: false })

  if (error) {
    throw new Error(
      `profiles: getProfilesForLevel failed (${error.message})`,
    )
  }
  return (data ?? []).map((r) =>
    rowToProfile(r as unknown as WatermarkProfileDbRow),
  )
}

/**
 * Load the full profile set.
 *
 * Mock: returns the 6 hand-written seed profiles (3 levels x 2 families),
 *       all `draft`.
 * Real: returns ALL rows from `watermark_profiles` — any version, any
 *       approval status. Used by the operator surface to audit what's
 *       deployed. This is the documented CCP 4 interpretation: "list
 *       all rows" (Q2 decision).
 *
 * The name is preserved across modes to keep call-sites stable.
 */
export async function getAllSeedProfiles(): Promise<WatermarkProfile[]> {
  logModeOnce()

  if (MODE === 'mock') {
    return [...SEED_PROFILES]
  }

  const client = await db()
  const { data, error } = await client
    .from('watermark_profiles')
    .select(PROFILE_COLUMNS)
    .order('intrusion_level', { ascending: true })
    .order('template_family', { ascending: true })
    .order('version', { ascending: false })

  if (error) {
    throw new Error(
      `profiles: getAllSeedProfiles failed (${error.message})`,
    )
  }
  return (data ?? []).map((r) =>
    rowToProfile(r as unknown as WatermarkProfileDbRow),
  )
}

/**
 * Check whether approved profiles exist for all required combinations.
 * Returns the combinations that are missing approved profiles.
 *
 * Used by the pipeline to fail-fast before starting a batch. Running
 * this in mock mode will always return all 6 combinations as missing,
 * because seed profiles are `draft`.
 */
export async function getMissingApprovedProfiles(): Promise<
  Array<{
    level: WatermarkIntrusionLevel
    family: TemplateFamily
  }>
> {
  logModeOnce()

  const required: Array<{
    level: WatermarkIntrusionLevel
    family: TemplateFamily
  }> = []

  for (const level of ['light', 'standard', 'heavy'] as const) {
    for (const family of ['portrait', 'landscape'] as const) {
      const profile = await getApprovedProfile(level, family)
      if (!profile || profile.approvalStatus !== 'approved') {
        required.push({ level, family })
      }
    }
  }

  return required
}
