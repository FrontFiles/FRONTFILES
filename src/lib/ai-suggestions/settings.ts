/**
 * Frontfiles — AI Suggestions: Settings reader
 *
 * Reads the singleton ai_pipeline_settings row. Production env reads
 * the row values verbatim; preview/dev applies a 10% multiplier on
 * cost ceilings (so a misconfigured dev environment can't burn through
 * the production-grade $500/day cap).
 *
 * In-process LRU cache with 60s TTL. Settings change rarely; the staleness
 * window is bounded by TTL. Tests can clear the cache via
 * invalidateSettingsCache().
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'

export interface EffectiveSettings {
  daily_cap_cents: number
  monthly_cap_cents: number
  tag_taxonomy_top_n: number
  confidence_floor_caption: number
  confidence_floor_keywords: number
  confidence_floor_tags_existing: number
  confidence_floor_tags_new: number
  confidence_floor_silhouette: number
  vision_max_long_edge_px: number
  vision_jpeg_quality: number
  circuit_failure_threshold: number
  circuit_cooldown_ms: number
  // E5: clustering knobs (per E5 §8.3 + migration 20260428000004)
  cluster_min_size: number
  cluster_min_samples: number | null
  // E6: per-field auto-accept threshold (UX-SPEC-V4 IPV4-5 lock = 0.85)
  auto_accept_threshold: number
}

const DEV_MULTIPLIER = 0.1 // 10% of production cost ceilings in dev/preview
const CACHE_TTL_MS = 60_000

let _cachedRow: EffectiveSettings | null = null
let _cachedAt = 0

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const now = Date.now()
  if (_cachedRow && now - _cachedAt < CACHE_TTL_MS) {
    return _cachedRow
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ai_pipeline_settings')
    .select('*')
    .eq('singleton_key', 'global')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to read ai_pipeline_settings: ${error?.message ?? 'no row'}`,
    )
  }

  // CCP Pattern-a Option 2b — read process.env live so vi.stubEnv works in
  // tests and per-request env scoping (Vercel preview vs prod) is honored.
  // The frozen `env.NODE_ENV` snapshot in @/lib/env can't be re-stubbed after
  // module-load; the codebase precedent is `flags.*` getters in env.ts.
  const isProd = process.env.NODE_ENV === 'production'
  const result: EffectiveSettings = {
    daily_cap_cents: isProd
      ? data.daily_cap_cents
      : Math.round(data.daily_cap_cents * DEV_MULTIPLIER),
    monthly_cap_cents: isProd
      ? data.monthly_cap_cents
      : Math.round(data.monthly_cap_cents * DEV_MULTIPLIER),
    tag_taxonomy_top_n: data.tag_taxonomy_top_n,
    confidence_floor_caption: Number(data.confidence_floor_caption),
    confidence_floor_keywords: Number(data.confidence_floor_keywords),
    confidence_floor_tags_existing: Number(
      data.confidence_floor_tags_existing,
    ),
    confidence_floor_tags_new: Number(data.confidence_floor_tags_new),
    confidence_floor_silhouette: Number(data.confidence_floor_silhouette),
    vision_max_long_edge_px: data.vision_max_long_edge_px,
    vision_jpeg_quality: data.vision_jpeg_quality,
    circuit_failure_threshold: data.circuit_failure_threshold,
    circuit_cooldown_ms: data.circuit_cooldown_ms,
    // E5: defaults handle the case where this code runs before the
    // clustering migration has applied (e.g., during dev that hasn't
    // pulled the migration yet). Production reads the row values.
    cluster_min_size: data.cluster_min_size ?? 3,
    cluster_min_samples:
      data.cluster_min_samples === undefined ? null : data.cluster_min_samples,
    // E6: default 0.85 per UX-SPEC-V4 IPV4-5; pre-migration fallback
    auto_accept_threshold:
      data.auto_accept_threshold === undefined
        ? 0.85
        : Number(data.auto_accept_threshold),
  }

  _cachedRow = result
  _cachedAt = now
  return result
}

/** Clear cache — for tests and for future admin tuning surfaces. */
export function invalidateSettingsCache(): void {
  _cachedRow = null
  _cachedAt = 0
}
