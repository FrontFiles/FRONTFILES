import {
  WM_BLACK, WM_WHITE, WM_BLUE, WM_SANS,
  TIER_FONTS,
  type WatermarkIntensity,
} from '@/lib/watermark/types'

interface VerticalBarProps {
  barWidth: number
  inset: number
  intensity: WatermarkIntensity
  assetId: string
  attribution?: string
  tier: 'canonical' | 'reduced'
}

export function VerticalBar({
  barWidth,
  inset,
  intensity,
  assetId,
  attribution,
  tier,
}: VerticalBarProps) {
  const fonts = TIER_FONTS[tier]
  const right = intensity === 'elevated' ? '33.333%' : `${inset}px`
  const pad = Math.max(barWidth * 0.35, 8)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right,
        minHeight: '50%',
        width: barWidth,
        display: 'flex',
        flexDirection: 'column',
        background: WM_BLACK,
        fontFamily: WM_SANS,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        overflow: 'hidden',
      }}
    >
      {/* Top: Brand wordmark — top-to-bottom reading */}
      <div
        style={{
          writingMode: 'vertical-rl',
          whiteSpace: 'nowrap',
          paddingTop: pad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

      {/* Spacer — pushes metadata to the bottom */}
      <div style={{ flex: 1 }} />

      {/* Bottom: ID label + code + attribution */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          paddingBottom: pad,
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            whiteSpace: 'nowrap',
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
            writingMode: 'vertical-rl',
            whiteSpace: 'nowrap',
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
              writingMode: 'vertical-rl',
              whiteSpace: 'nowrap',
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
