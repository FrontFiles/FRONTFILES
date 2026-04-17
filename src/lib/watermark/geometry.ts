import type { WatermarkTier, WatermarkGeometry, WatermarkOrientation } from './types'

/**
 * Deterministic tier selection from shorter dimension S.
 * Thresholds are exact — no fuzzy ranges.
 */
export function selectTier(S: number): WatermarkTier | null {
  if (S >= 600) return 'canonical'
  if (S >= 380) return 'reduced'
  if (S >= 160) return 'corner'
  if (S >= 90) return 'brand-only'
  if (S >= 60) return 'ff-collapse'
  if (S >= 40) return 'f-micro'
  return null // below minimum viable threshold
}

/**
 * Compute all geometry tokens from rendered image dimensions.
 * barWidth and inset snap to whole pixels.
 */
export function computeGeometry(imageWidth: number, imageHeight: number): WatermarkGeometry {
  const S = Math.min(imageWidth, imageHeight)
  const tier = selectTier(S)
  const barWidth = Math.round(clamp(S * 0.06, 28, 52))
  const inset = Math.round(clamp(S * 0.03, 8, 24))
  return { S, barWidth, inset, tier }
}

/**
 * Auto-detect bar orientation from aspect ratio.
 * Portrait/square -> vertical, landscape -> horizontal.
 */
export function resolveOrientation(
  imageWidth: number,
  imageHeight: number,
  explicit?: WatermarkOrientation,
): WatermarkOrientation {
  if (explicit) return explicit
  return imageHeight >= imageWidth ? 'vertical' : 'horizontal'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
