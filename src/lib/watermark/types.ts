export type WatermarkIntensity = 'standard' | 'elevated' | 'invasive'
export type WatermarkOrientation = 'vertical' | 'horizontal'

/**
 * Product-facing watermark mode. Maps to concrete intensity + placement behavior
 * via the preset system. 'none' explicitly disables watermarking.
 */
export type WatermarkMode = 'none' | 'subtle' | 'standard' | 'strong'

/**
 * Usage context that drives policy resolution.
 * Determines which watermark mode applies when no per-asset override is set.
 */
export type WatermarkContext =
  | 'upload-default'        // default mode applied at intake
  | 'asset-preview'         // discovery cards, grid thumbnails
  | 'detail-preview'        // asset detail page viewer
  | 'share-preview'         // OG image / share card
  | 'promotional-preview'   // autopromotion, featured placements
  | 'internal'              // internal/non-public surfaces (no watermark)

export type WatermarkTier =
  | 'canonical'   // S >= 600 — full bar, brand + ID + attribution
  | 'reduced'     // S >= 380 — bar, brand + ID + attribution
  | 'corner'      // S >= 160 — corner mark, brand + ID + attribution
  | 'brand-only'  // S >= 90  — corner mark, brand + ID + attribution
  | 'ff-collapse' // S >= 60  — micro glyph "FF"
  | 'f-micro'     // S >= 40  — micro glyph "F"

export interface WatermarkGeometry {
  S: number
  barWidth: number
  inset: number
  tier: WatermarkTier | null
}

export interface WatermarkProps {
  intensity: WatermarkIntensity
  imageWidth: number
  imageHeight: number
  assetId: string
  attribution?: string
  orientation?: WatermarkOrientation
}

/**
 * Resolved watermark configuration — the output of the policy layer.
 * Contains everything needed to render a watermark for a given context.
 */
export interface WatermarkConfig {
  mode: WatermarkMode
  intensity: WatermarkIntensity
  enabled: boolean
}

/**
 * Per-asset watermark settings. Stored on asset records.
 * null fields inherit from context/upload defaults.
 */
export interface AssetWatermarkSettings {
  mode: WatermarkMode | null        // null = inherit from context default
  overrideIntensity: WatermarkIntensity | null  // null = use preset mapping
}

// Font sizes per tier — codes and names always visible through brand-only
export const TIER_FONTS = {
  canonical: { brand: 13, id: 18, attr: 9 },
  reduced: { brand: 10, id: 14, attr: 8 },
  corner: { brand: 8, id: 10, attr: 7 },
  'brand-only': { brand: 7, id: 8, attr: 6 },
  'ff-collapse': { glyph: 7 },
  'f-micro': { glyph: 5 },
} as const

// Glyph dimensions
export const GLYPH_SIZE = {
  'ff-collapse': 14,
  'f-micro': 10,
} as const

// Canon colors — no other colors permitted
export const WM_BLACK = '#000000'
export const WM_BLUE = '#0000FF'
export const WM_WHITE = '#FFFFFF'
export const WM_ATTR_WHITE = 'rgba(255,255,255,0.6)'
export const WM_PATTERN_OPACITY = 0.12

// Font stack — system fonts only, isolated from parent
export const WM_SANS = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
