import {
  WM_BLACK, WM_WHITE, WM_BLUE, WM_SANS,
  TIER_FONTS,
  type WatermarkIntensity,
} from '@/lib/watermark/types'

interface HorizontalBarProps {
  barWidth: number
  inset: number
  intensity: WatermarkIntensity
  assetId: string
  attribution?: string
  tier: 'canonical' | 'reduced'
}

export function HorizontalBar({
  barWidth,
  inset,
  intensity,
  assetId,
  attribution,
  tier,
}: HorizontalBarProps) {
  const fonts = TIER_FONTS[tier]
  const bottom = intensity === 'elevated' ? '33.333%' : `${inset}px`

  const pad = Math.max(barWidth * 0.35, 8)

  return (
    <div
      style={{
        position: 'absolute',
        bottom,
        right: 0,
        minWidth: '50%',
        height: barWidth,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        background: WM_BLACK,
        fontFamily: WM_SANS,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Brand wordmark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: pad,
          paddingRight: 10,
        }}
      >
        <span
          style={{
            fontSize: fonts.brand,
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
            fontSize: fonts.brand,
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

      {/* Spacer — pushes metadata to the right edge */}
      <div style={{ flex: 1 }} />

      {/* ID label + code + attribution */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingRight: pad,
        }}
      >
        <span
          style={{
            fontSize: fonts.attr,
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
            fontSize: fonts.id,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase' as const,
            color: WM_WHITE,
            lineHeight: 1,
          }}
        >
          {assetId}
        </span>
        {attribution && (
          <span
            style={{
              fontSize: fonts.attr,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              color: WM_WHITE,
              lineHeight: 1,
            }}
          >
            {`\u00A9 ${attribution}`}
          </span>
        )}
      </div>
    </div>
  )
}
