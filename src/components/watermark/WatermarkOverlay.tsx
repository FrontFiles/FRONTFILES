import { useMemo } from 'react'
import { computeGeometry, resolveOrientation } from '@/lib/watermark/geometry'
import type { WatermarkProps } from '@/lib/watermark/types'
import { VerticalBar } from './VerticalBar'
import { HorizontalBar } from './HorizontalBar'
import { CornerMark } from './CornerMark'
import { MicroGlyph } from './MicroGlyph'
import { FFPatternLayer } from './FFPatternLayer'

/**
 * Top-level watermark overlay. Renders exactly one bar/glyph per image.
 * Place inside a container with `position: relative; overflow: hidden`.
 * Returns null when image is below minimum viable threshold (S < 40)
 * or when dimensions are invalid.
 */
/**
 * Format asset ID for watermark display.
 * Strips common prefixes (e.g. "asset-") and uppercases the code.
 */
function formatWatermarkId(raw: string): string {
  const code = raw.replace(/^asset-/i, '')
  return code.toUpperCase()
}

export function WatermarkOverlay({
  intensity,
  imageWidth,
  imageHeight,
  assetId,
  attribution,
  orientation: explicitOrientation,
}: WatermarkProps) {
  const geo = useMemo(
    () => computeGeometry(imageWidth, imageHeight),
    [imageWidth, imageHeight],
  )

  const orientation = useMemo(
    () => resolveOrientation(imageWidth, imageHeight, explicitOrientation),
    [imageWidth, imageHeight, explicitOrientation],
  )

  // Below minimum viable threshold or invalid dimensions
  if (!geo.tier || imageWidth <= 0 || imageHeight <= 0) return null

  const displayId = formatWatermarkId(assetId)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {/* FF pattern layer — invasive only, behind bar */}
      {intensity === 'invasive' && <FFPatternLayer />}

      {/* Tier-specific bar/glyph */}
      {renderTier(geo.tier, orientation, geo, intensity, displayId, attribution)}
    </div>
  )
}

function renderTier(
  tier: NonNullable<ReturnType<typeof computeGeometry>['tier']>,
  orientation: ReturnType<typeof resolveOrientation>,
  geo: ReturnType<typeof computeGeometry>,
  intensity: WatermarkProps['intensity'],
  assetId: string,
  attribution?: string,
) {
  switch (tier) {
    case 'canonical':
    case 'reduced': {
      const Bar = orientation === 'vertical' ? VerticalBar : HorizontalBar
      return (
        <Bar
          barWidth={geo.barWidth}
          inset={geo.inset}
          intensity={intensity}
          assetId={assetId}
          attribution={attribution}
          tier={tier}
        />
      )
    }
    case 'corner':
      return <CornerMark tier="corner" assetId={assetId} attribution={attribution} />
    case 'brand-only':
      return <CornerMark tier="brand-only" assetId={assetId} attribution={attribution} />
    case 'ff-collapse':
      return <MicroGlyph tier="ff-collapse" />
    case 'f-micro':
      return <MicroGlyph tier="f-micro" />
  }
}
