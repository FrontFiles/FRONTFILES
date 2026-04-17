import { useMemo } from 'react'
import { resolveWatermarkConfig } from '@/lib/watermark/policy'
import type { WatermarkContext, WatermarkConfig, WatermarkMode, AssetWatermarkSettings } from '@/lib/watermark/types'

/**
 * Resolve watermark configuration for a given context + optional asset override.
 * Returns a stable WatermarkConfig object (memoized on inputs).
 */
export function useWatermark(
  context: WatermarkContext,
  assetWatermarkMode?: WatermarkMode | null,
): WatermarkConfig {
  return useMemo(() => {
    const settings: AssetWatermarkSettings | null =
      assetWatermarkMode != null
        ? { mode: assetWatermarkMode, overrideIntensity: null }
        : null
    return resolveWatermarkConfig(context, settings)
  }, [context, assetWatermarkMode])
}
