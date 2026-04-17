/**
 * Frontfiles — Canonical Media Configuration
 *
 * Centralises aspect ratios, crop strategies, and object-position
 * so no card duplicates this logic.
 */

import type { PreviewFamily, PreviewSize, MediaConfig } from './types'

// ══════════════════════════════════════════════
// CANONICAL ASPECT RATIOS
// ══════════════════════════════════════════════

/** Aspect ratio CSS class and numeric value by family + size */
const MEDIA_RATIOS: Record<PreviewFamily, Partial<Record<PreviewSize, { cls: string; ratio: number }>>> = {
  asset: {
    xs: { cls: 'aspect-square', ratio: 1 },
    sm: { cls: 'aspect-video', ratio: 16 / 9 },
    md: { cls: 'aspect-video', ratio: 16 / 9 },
    lg: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
    xl: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
  },
  story: {
    xs: { cls: 'aspect-square', ratio: 1 },
    sm: { cls: 'aspect-video', ratio: 16 / 9 },
    md: { cls: 'aspect-video', ratio: 16 / 9 },
    lg: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
    xl: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
  },
  article: {
    xs: { cls: 'aspect-square', ratio: 1 },
    sm: { cls: 'aspect-video', ratio: 16 / 9 },
    md: { cls: 'aspect-video', ratio: 16 / 9 },
    lg: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
    xl: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
  },
  frontfiler: {
    xs: { cls: 'aspect-square', ratio: 1 },
    sm: { cls: 'aspect-[3/4]', ratio: 3 / 4 },
    md: { cls: 'aspect-[3/4]', ratio: 3 / 4 },
    lg: { cls: 'aspect-[3/4]', ratio: 3 / 4 },
    xl: { cls: 'aspect-[3/4]', ratio: 3 / 4 },
  },
  collection: {
    xs: { cls: 'aspect-square', ratio: 1 },
    sm: { cls: 'aspect-video', ratio: 16 / 9 },
    md: { cls: 'aspect-video', ratio: 16 / 9 },
    lg: { cls: 'aspect-video', ratio: 16 / 9 },
    xl: { cls: 'aspect-[4/3]', ratio: 4 / 3 },
  },
}

/** Default fallback */
const DEFAULT_RATIO = { cls: 'aspect-video', ratio: 16 / 9 }

// ══════════════════════════════════════════════
// CROP STRATEGY DEFAULTS
// ══════════════════════════════════════════════

/**
 * Default object-position by family.
 *
 * - asset: center — most editorial content is landscape-oriented
 * - story/article: top 30% — hero images usually have subjects in upper portion
 * - frontfiler: upper portion — faces are typically in the top third
 * - collection: center — mosaic/composite thumbnails
 */
const OBJECT_POSITION: Record<PreviewFamily, string> = {
  asset: '50% 50%',
  story: '50% 30%',
  article: '50% 30%',
  frontfiler: '50% 20%',
  collection: '50% 50%',
}

// ══════════════════════════════════════════════
// RESOLVER
// ══════════════════════════════════════════════

export function resolveMediaConfig(family: PreviewFamily, size: PreviewSize): MediaConfig {
  const ratio = MEDIA_RATIOS[family]?.[size] ?? DEFAULT_RATIO

  return {
    aspectClass: ratio.cls,
    aspectRatio: ratio.ratio,
    cropStrategy: family === 'frontfiler' ? 'face' : 'safe',
    objectPosition: OBJECT_POSITION[family],
    formatRendering: family === 'asset' && size !== 'xs',
  }
}

/**
 * Returns a CSS object-position value.
 * Uses an explicit focal point if provided, otherwise falls back to
 * the family default.
 */
export function resolveObjectPosition(
  family: PreviewFamily,
  focalPoint?: { x: number; y: number } | null,
  creatorSlugCrop?: string | null,
): string {
  if (focalPoint) {
    return `${focalPoint.x}% ${focalPoint.y}%`
  }
  if (creatorSlugCrop) {
    return creatorSlugCrop
  }
  return OBJECT_POSITION[family]
}
