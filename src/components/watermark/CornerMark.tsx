import {
  WM_BLACK, WM_WHITE, WM_BLUE, WM_SANS,
  TIER_FONTS,
} from '@/lib/watermark/types'

interface CornerMarkProps {
  tier: 'corner' | 'brand-only'
  assetId: string
  attribution?: string
}

export function CornerMark({ tier, assetId, attribution }: CornerMarkProps) {
  const fonts = TIER_FONTS[tier]

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 6,
        right: 6,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        background: WM_BLACK,
        zIndex: 10,
        fontFamily: WM_SANS,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        padding: '0 5px',
        gap: 4,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
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
        {assetId.slice(0, 4)}
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
  )
}
