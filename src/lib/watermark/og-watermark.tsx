/**
 * Frontfiles — OG Image Watermark Renderer
 *
 * Server-compatible watermark JSX for Next.js ImageResponse (Satori).
 * Uses the same geometry engine and brand constants as the client-side
 * overlay but avoids React hooks (not available in route handlers).
 *
 * Renders a horizontal bar at the bottom of the OG card with brand mark,
 * asset ID, and attribution.
 */

import {
  WM_WHITE, WM_BLUE, WM_SANS,
} from './types'
import { computeGeometry } from './geometry'

interface OgWatermarkProps {
  imageWidth: number
  imageHeight: number
  assetId: string
  attribution?: string
}

/** Height of the OG watermark bar in pixels. Exported so callers can adjust layout. */
export const OG_WATERMARK_BAR_HEIGHT = 38

/**
 * Render watermark elements for OG image composition.
 * Returns JSX compatible with Next.js ImageResponse (Satori renderer).
 *
 * The caller is responsible for deciding whether to render this component.
 * This component does not resolve watermark policy — it only renders.
 */
function formatWatermarkId(raw: string): string {
  return raw.replace(/^asset-/i, '').toUpperCase()
}

export function OgWatermark({
  imageWidth,
  imageHeight,
  assetId,
  attribution,
}: OgWatermarkProps) {
  const geo = computeGeometry(imageWidth, imageHeight)
  if (!geo.tier) return null

  const displayId = formatWatermarkId(assetId)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: OG_WATERMARK_BAR_HEIGHT,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.75)',
        fontFamily: WM_SANS,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Brand wordmark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 16,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: WM_WHITE,
            lineHeight: 1,
          }}
        >
          FRONT
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: WM_BLUE,
            lineHeight: 1,
          }}
        >
          FILES
        </span>
      </div>

      {/* ID label + code */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: WM_WHITE,
          lineHeight: 1,
        }}
      >
        ID
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase' as const,
          color: WM_WHITE,
          lineHeight: 1,
          marginLeft: 4,
        }}
      >
        {displayId}
      </span>

      {/* Attribution */}
      {attribution && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            color: WM_WHITE,
            lineHeight: 1,
            marginLeft: 12,
          }}
        >
          {`\u00A9 ${attribution}`}
        </span>
      )}
    </div>
  )
}
