/**
 * Frontfiles — Asset Processing Types
 *
 * Type definitions for the canonical image derivative pipeline.
 * The pipeline takes an original upload, creates compressed derivatives,
 * and bakes watermarks into preview images.
 *
 * PROCESSING ORDER (strict):
 *   1. Ingest original → store as-is
 *   2. Resize/compress to target derivative dimensions
 *   3. Apply watermark to compressed derivative (skip for thumbnail)
 *   4. Store watermarked derivative
 *
 * WATERMARK RULE:
 *   - thumbnail: compressed only, NO watermark
 *   - watermarked_preview: compressed + watermarked
 *   - og_image: compressed + cropped + watermarked
 */

import type { MediaRole } from '@/lib/media/asset-media-repo'

// ══════════════════════════════════════════════
// INTRUSION LEVELS
// ══════════════════════════════════════════════

/** Canonical watermark intrusion levels. Replaces legacy watermark_mode. */
export type WatermarkIntrusionLevel = 'light' | 'standard' | 'heavy'

/** All valid intrusion levels. */
export const INTRUSION_LEVELS: readonly WatermarkIntrusionLevel[] = [
  'light',
  'standard',
  'heavy',
] as const

/** Template family — determined by image orientation. */
export type TemplateFamily = 'portrait' | 'landscape'

// ══════════════════════════════════════════════
// DERIVATIVE SPECS
// ══════════════════════════════════════════════

/** Target dimensions for a derivative. */
export interface DerivativeDimensions {
  /** Which edge the target size refers to. */
  sizeMode: 'short-edge' | 'long-edge' | 'fixed'
  /** Target pixel value for the sized edge, or width for fixed mode. */
  targetPx: number
  /** Height for fixed mode only. Ignored for short-edge/long-edge. */
  fixedHeight?: number
}

/** JPEG quality (1–100). */
export type JpegQuality = number

/** Spec for one derivative to generate from an original. */
export interface DerivativeSpec {
  /** Which media role this derivative fills. */
  role: MediaRole
  /** Target output dimensions. */
  dimensions: DerivativeDimensions
  /** JPEG output quality. */
  quality: JpegQuality
  /** Whether to bake watermark into this derivative. */
  watermarked: boolean
}

/**
 * Canonical derivative specs for image assets.
 *
 * IMPORTANT: Thumbnail is NOT watermarked (clean compressed preview).
 * watermarked_preview and og_image ARE watermarked.
 *
 * Dimensions are proposed defaults — not frozen until approved.
 */
export const IMAGE_DERIVATIVE_SPECS: readonly DerivativeSpec[] = [
  {
    role: 'thumbnail',
    dimensions: { sizeMode: 'short-edge', targetPx: 400 },
    quality: 80,
    watermarked: false,
  },
  {
    role: 'watermarked_preview',
    dimensions: { sizeMode: 'long-edge', targetPx: 1600 },
    quality: 85,
    watermarked: true,
  },
  {
    role: 'og_image',
    dimensions: { sizeMode: 'fixed', targetPx: 1200, fixedHeight: 630 },
    quality: 85,
    watermarked: true,
  },
] as const

// ══════════════════════════════════════════════
// WATERMARK PROFILE (from DB)
// ══════════════════════════════════════════════

/** Watermark profile approval status. */
export type WatermarkApprovalStatus = 'draft' | 'approved' | 'deprecated'

/** Bar positioning parameters (ratios relative to image dimensions). */
export interface BarPosition {
  /** Horizontal position ratio (0.0 = left edge, 1.0 = right edge). */
  xRatio: number
  /** Vertical position ratio (0.0 = top, 1.0 = bottom). */
  yRatio: number
  /** Anchor point of the bar relative to its own bounds. */
  anchor: 'top-right' | 'top-left' | 'center-right' | 'center-left'
}

/** Block height as a ratio of the bar's total height. */
export interface BarBlock {
  /** Height of this block as a fraction of the total bar height. */
  heightRatio: number
}

/** Scatter configuration for heavy intrusion level. */
export interface ScatterConfig {
  /** Number of icons per 1,000,000 pixels of image area. */
  density: number
  /** Icon opacity (0.0–1.0). */
  opacity: number
  /** Icon size in pixels at 1600px long edge (scales proportionally). */
  iconSizePx: number
}

/**
 * A watermark profile record as loaded from the database.
 * Contains all parameters needed by the compositor to render
 * the watermark onto a compressed derivative.
 */
export interface WatermarkProfile {
  id: string
  version: number
  intrusionLevel: WatermarkIntrusionLevel
  templateFamily: TemplateFamily
  barPosition: BarPosition
  barWidthRatio: number
  brandBlock: BarBlock
  idBlock: BarBlock
  attributionBlock: BarBlock
  scatterConfig: ScatterConfig | null
  approvalStatus: WatermarkApprovalStatus
  approvedBy: string | null
  approvedAt: string | null
}

// ══════════════════════════════════════════════
// PROCESSING JOB
// ══════════════════════════════════════════════

/** Input for a single derivative processing job. */
export interface ProcessingJob {
  /** The vault asset ID. */
  assetId: string
  /** The derivative to generate. */
  spec: DerivativeSpec
  /** The asset's configured intrusion level. */
  intrusionLevel: WatermarkIntrusionLevel
  /** Short asset ID hash for watermark rendering (e.g. "952be73"). */
  assetIdShort: string
  /** Creator attribution text (e.g. "BRUNO FELIX VAN DER HAAR"). */
  attribution: string
}

/** Result of a processing job. */
export interface ProcessingResult {
  assetId: string
  role: MediaRole
  success: boolean
  /** Storage ref where the derivative was written. Null on failure. */
  storageRef: string | null
  /** Output dimensions. Null on failure. */
  width: number | null
  height: number | null
  /** File size in bytes. Null on failure. */
  fileSizeBytes: number | null
  /** Watermark profile version used. Null for unwatermarked or failure. */
  profileVersion: number | null
  /** Error message on failure. Null on success. */
  error: string | null
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

/** Determine template family from image dimensions. */
export function resolveTemplateFamily(width: number, height: number): TemplateFamily {
  return height >= width ? 'portrait' : 'landscape'
}

/** Generate short ID hash for watermark display (first 7 chars of asset ID). */
export function shortAssetId(assetId: string): string {
  // Strip common prefixes
  const clean = assetId.replace(/^asset-/, '')
  return clean.slice(0, 7)
}

/**
 * Compute output dimensions for a derivative spec given original dimensions.
 * Maintains aspect ratio for short-edge and long-edge modes.
 * For fixed mode, returns the fixed dimensions (center crop in the resize step).
 */
export function computeOutputDimensions(
  originalWidth: number,
  originalHeight: number,
  dimensions: DerivativeDimensions,
): { width: number; height: number } {
  const { sizeMode, targetPx, fixedHeight } = dimensions

  if (sizeMode === 'fixed') {
    return { width: targetPx, height: fixedHeight ?? targetPx }
  }

  const aspectRatio = originalWidth / originalHeight

  if (sizeMode === 'short-edge') {
    const shortEdge = Math.min(originalWidth, originalHeight)
    if (shortEdge <= targetPx) {
      // Original is already smaller than target — don't upscale
      return { width: originalWidth, height: originalHeight }
    }
    if (originalWidth <= originalHeight) {
      // Portrait: width is short edge
      return { width: targetPx, height: Math.round(targetPx / aspectRatio) }
    }
    // Landscape: height is short edge
    return { width: Math.round(targetPx * aspectRatio), height: targetPx }
  }

  // long-edge
  const longEdge = Math.max(originalWidth, originalHeight)
  if (longEdge <= targetPx) {
    return { width: originalWidth, height: originalHeight }
  }
  if (originalWidth >= originalHeight) {
    // Landscape: width is long edge
    return { width: targetPx, height: Math.round(targetPx / aspectRatio) }
  }
  // Portrait: height is long edge
  return { width: Math.round(targetPx * aspectRatio), height: targetPx }
}
