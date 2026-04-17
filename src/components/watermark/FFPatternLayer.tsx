import { WM_BLUE, WM_SANS, WM_PATTERN_OPACITY } from '@/lib/watermark/types'

const PATTERN_GAP_X = 120
const PATTERN_GAP_Y = 36
const PATTERN_FONT_SIZE = 18

/**
 * Full-surface "FRONTFILES" repeating text pattern for invasive intensity.
 * Renders a staggered grid of brand text at low opacity.
 * Sits behind the bar (z-index 7 vs bar at 10).
 */
export function FFPatternLayer() {
  // Generate enough rows/cols to cover any reasonable container.
  // CSS overflow:hidden on the parent clips excess.
  const rows = 30
  const cols = 12

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 7,
        opacity: WM_PATTERN_OPACITY,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {Array.from({ length: rows }, (_, row) => {
        const stagger = row % 2 === 1 ? -(PATTERN_GAP_X / 2) : 0
        return (
          <div
            key={row}
            style={{
              display: 'flex',
              gap: PATTERN_GAP_X,
              marginLeft: stagger,
              height: PATTERN_GAP_Y,
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {Array.from({ length: cols }, (_, col) => (
              <span
                key={col}
                style={{
                  fontFamily: WM_SANS,
                  fontSize: PATTERN_FONT_SIZE,
                  fontWeight: 900,
                  color: WM_BLUE,
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                FRONTFILES
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
