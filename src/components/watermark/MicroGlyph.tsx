import {
  WM_BLUE, WM_WHITE, WM_SANS,
  GLYPH_SIZE, TIER_FONTS,
} from '@/lib/watermark/types'

interface MicroGlyphProps {
  tier: 'ff-collapse' | 'f-micro'
}

export function MicroGlyph({ tier }: MicroGlyphProps) {
  const size = GLYPH_SIZE[tier]
  const fontSize = TIER_FONTS[tier].glyph
  const text = tier === 'ff-collapse' ? 'FF' : 'F'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: size,
        height: size,
        background: WM_BLUE,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: WM_SANS,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 900,
          color: WM_WHITE,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {text}
      </span>
    </div>
  )
}
