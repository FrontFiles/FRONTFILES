/**
 * Frontfiles — Watermark Preset System
 *
 * Named presets map product-facing WatermarkMode values to concrete
 * rendering parameters. Each preset defines a distinct protection tier
 * with intentional visual behavior — not just an opacity slider.
 *
 * Presets are pure data. Policy logic (context resolution, per-asset
 * overrides) lives in policy.ts.
 */

import type {
  WatermarkMode,
  WatermarkIntensity,
  WatermarkConfig,
  WatermarkContext,
} from './types'

// ── Preset Definitions ──────────────────────────────────

export interface WatermarkPreset {
  mode: WatermarkMode
  label: string
  description: string
  intensity: WatermarkIntensity
}

/**
 * SUBTLE — Light protection for discovery surfaces.
 * Branded, visible, but minimally intrusive. Bar sits at the near edge.
 * Suitable for asset cards, promotional previews, autopromotion feeds.
 */
export const PRESET_SUBTLE: WatermarkPreset = {
  mode: 'subtle',
  label: 'Subtle',
  description: 'Light branding at edge — visible but unobtrusive',
  intensity: 'standard',
}

/**
 * STANDARD — Default protection for most preview contexts.
 * Bar shifts to the lower third, making casual cropping harder.
 * Suitable for asset detail, share previews, general product use.
 */
export const PRESET_STANDARD: WatermarkPreset = {
  mode: 'standard',
  label: 'Standard',
  description: 'Bar at lower third — harder to crop, still preview-friendly',
  intensity: 'elevated',
}

/**
 * STRONG — Maximum protection for high-value or sensitive assets.
 * Full FF pattern overlay behind the bar. Clearly marks the asset
 * as protected. Intended for contexts where deterrence outweighs
 * visual cleanliness.
 */
export const PRESET_STRONG: WatermarkPreset = {
  mode: 'strong',
  label: 'Strong',
  description: 'Full FF pattern overlay — maximum deterrence',
  intensity: 'invasive',
}

/**
 * All presets indexed by mode. 'none' has no preset — it means disabled.
 */
export const PRESETS: Record<Exclude<WatermarkMode, 'none'>, WatermarkPreset> = {
  subtle: PRESET_SUBTLE,
  standard: PRESET_STANDARD,
  strong: PRESET_STRONG,
}

/**
 * All available preset entries for UI enumeration (excludes 'none').
 */
export const PRESET_LIST: WatermarkPreset[] = [
  PRESET_SUBTLE,
  PRESET_STANDARD,
  PRESET_STRONG,
]

// ── Context Defaults ────────────────────────────────────

/**
 * Default watermark mode per usage context.
 * Policy layer uses this when no per-asset override is set.
 */
export const CONTEXT_DEFAULTS: Record<WatermarkContext, WatermarkMode> = {
  'upload-default': 'standard',
  'asset-preview': 'subtle',
  'detail-preview': 'standard',
  'share-preview': 'standard',
  'promotional-preview': 'subtle',
  'internal': 'none',
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Resolve a WatermarkMode to its full config. Returns a disabled config
 * for mode 'none'. Pure function — no side effects.
 */
export function resolvePreset(mode: WatermarkMode): WatermarkConfig {
  if (mode === 'none') {
    return {
      mode: 'none',
      intensity: 'standard',
      enabled: false,
    }
  }

  const preset = PRESETS[mode]
  return {
    mode: preset.mode,
    intensity: preset.intensity,
    enabled: true,
  }
}

/**
 * Map a WatermarkMode to the WatermarkIntensity used by the rendering layer.
 * Allows callers that only need the intensity without a full config resolution.
 */
export function modeToIntensity(mode: WatermarkMode): WatermarkIntensity {
  if (mode === 'none') return 'standard' // inert — rendering won't fire
  return PRESETS[mode].intensity
}
