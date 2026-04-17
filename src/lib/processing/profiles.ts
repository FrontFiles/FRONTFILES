/**
 * Frontfiles — Watermark Profile Loader
 *
 * Loads approved watermark profiles from the database.
 * The processing pipeline calls this to get the rendering recipe
 * for a given (intrusion_level, template_family) pair.
 *
 * FAIL-CLOSED: If no approved profile exists for the requested
 * combination, the pipeline refuses to process. This is the
 * approval gate — nothing ships until explicitly approved.
 *
 * In mock phase, returns draft profiles from the seed data
 * to enable development and testing.
 */

import type {
  WatermarkIntrusionLevel,
  TemplateFamily,
  WatermarkProfile,
  BarPosition,
  BarBlock,
  ScatterConfig,
} from './types'

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

// ══════════════════════════════════════════════
// PROFILE LOADER
// ══════════════════════════════════════════════

/**
 * Load the current approved watermark profile for a given level and family.
 *
 * Returns the highest-version approved profile, or null if none exists.
 *
 * PRODUCTION: queries watermark_profiles WHERE approval_status = 'approved'
 *   AND intrusion_level = ? AND template_family = ? ORDER BY version DESC LIMIT 1
 *
 * MOCK: returns seed profile (always draft — for dev/testing only).
 */
export function getApprovedProfile(
  level: WatermarkIntrusionLevel,
  family: TemplateFamily,
): WatermarkProfile | null {
  // In production, this queries the database for approved profiles.
  // In mock phase, we return seed profiles to enable development.
  // The pipeline should check approvalStatus and decide whether
  // to proceed (production: require 'approved', dev: allow 'draft').
  const match = SEED_PROFILES.find(
    p => p.intrusionLevel === level && p.templateFamily === family,
  )
  return match ?? null
}

/**
 * Load ALL profiles for a given intrusion level (both families).
 * Used by the dev harness to display all profiles for review.
 */
export function getProfilesForLevel(
  level: WatermarkIntrusionLevel,
): WatermarkProfile[] {
  return SEED_PROFILES.filter(p => p.intrusionLevel === level)
}

/**
 * Load all seed profiles. Used by the dev harness and seed script.
 */
export function getAllSeedProfiles(): WatermarkProfile[] {
  return [...SEED_PROFILES]
}

/**
 * Check whether approved profiles exist for all required combinations.
 * Returns the combinations that are missing approved profiles.
 *
 * Used by the pipeline to fail-fast before starting a batch.
 */
export function getMissingApprovedProfiles(): Array<{
  level: WatermarkIntrusionLevel
  family: TemplateFamily
}> {
  const required: Array<{ level: WatermarkIntrusionLevel; family: TemplateFamily }> = []

  for (const level of ['light', 'standard', 'heavy'] as const) {
    for (const family of ['portrait', 'landscape'] as const) {
      const profile = getApprovedProfile(level, family)
      if (!profile || profile.approvalStatus !== 'approved') {
        required.push({ level, family })
      }
    }
  }

  return required
}
