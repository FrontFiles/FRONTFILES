/**
 * Frontfiles — Watermark Policy Layer
 *
 * Resolves which watermark configuration applies for a given usage context,
 * accounting for per-asset overrides and upload defaults.
 *
 * Resolution order:
 * 1. Per-asset override mode (if set)
 * 2. Upload default mode (if provided and context = upload-default)
 * 3. Context default from CONTEXT_DEFAULTS
 *
 * Per-asset overrideIntensity takes precedence over preset-defined intensity,
 * allowing a creator to force a specific intensity without changing mode.
 */

import type {
  WatermarkMode,
  WatermarkContext,
  WatermarkConfig,
  WatermarkIntensity,
  AssetWatermarkSettings,
} from './types'
import { CONTEXT_DEFAULTS, resolvePreset, PRESETS } from './presets'

/**
 * Resolve the watermark configuration for a specific context.
 *
 * @param context     - Usage context (asset-preview, share-preview, etc.)
 * @param assetSettings - Per-asset watermark settings (optional)
 * @param uploadDefault - Upload-level default mode (optional, used when context is 'upload-default')
 * @returns Fully resolved WatermarkConfig ready for rendering
 */
export function resolveWatermarkConfig(
  context: WatermarkContext,
  assetSettings?: AssetWatermarkSettings | null,
  uploadDefault?: WatermarkMode | null,
): WatermarkConfig {
  // Step 1: Determine effective mode
  let mode: WatermarkMode

  if (assetSettings?.mode != null) {
    // Per-asset override takes highest priority
    mode = assetSettings.mode
  } else if (uploadDefault != null && context === 'upload-default') {
    // Upload default applies only in upload context
    mode = uploadDefault
  } else {
    // Fall back to context default
    mode = CONTEXT_DEFAULTS[context]
  }

  // Step 2: Resolve to full config via preset
  const config = resolvePreset(mode)

  // Step 3: Apply per-asset intensity override if set and mode is not 'none'
  if (config.enabled && assetSettings?.overrideIntensity != null) {
    return {
      ...config,
      intensity: assetSettings.overrideIntensity,
    }
  }

  return config
}

/**
 * Check whether a given context should produce watermarked output at all.
 * Convenience function for guards / early returns.
 */
export function isWatermarkEnabled(
  context: WatermarkContext,
  assetSettings?: AssetWatermarkSettings | null,
): boolean {
  const config = resolveWatermarkConfig(context, assetSettings)
  return config.enabled
}

/**
 * Get the display label for a watermark mode. Includes 'None' for disabled.
 */
export function getWatermarkModeLabel(mode: WatermarkMode): string {
  if (mode === 'none') return 'None'
  return PRESETS[mode].label
}

/**
 * All valid watermark modes for UI enumeration (including 'none').
 */
export const ALL_MODES: WatermarkMode[] = ['none', 'subtle', 'standard', 'strong']

/**
 * Validate that a string is a valid WatermarkMode.
 */
export function isValidWatermarkMode(value: string): value is WatermarkMode {
  return ALL_MODES.includes(value as WatermarkMode)
}

/**
 * Create default AssetWatermarkSettings (all nulls = inherit everything).
 */
export function createDefaultAssetWatermarkSettings(): AssetWatermarkSettings {
  return {
    mode: null,
    overrideIntensity: null,
  }
}
