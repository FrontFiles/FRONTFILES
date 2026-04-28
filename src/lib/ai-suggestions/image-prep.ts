/**
 * Frontfiles — Vertex Vision image preparation
 *
 * Per E1.5 §6 + E3-DIRECTIVE.md §9.
 *
 * Source: original (NOT watermarked_preview — that derivative has the
 * Frontfiles watermark bar baked in and would contaminate the Vision input).
 *
 * Resizes in-memory to long-edge per ai_pipeline_settings.vision_max_long_edge_px
 * (default 1568px). JPEG quality from settings.
 *
 * Returns inline mode for ≤ 4 MiB; signed-URL mode otherwise (rare at the
 * default long-edge + JPEG q85 — most assets compress under 4 MiB).
 *
 * SERVER-ONLY.
 */

import sharp from 'sharp'
import { getEffectiveSettings } from './settings'

const MAX_INLINE_BYTES = 4 * 1024 * 1024 // 4 MiB Vertex inline limit

export interface PreparedImage {
  bytes: Buffer
  mime: 'image/jpeg'
  mode: 'inline' | 'signed_url'
}

export async function prepareForVision(originalBytes: Buffer): Promise<PreparedImage> {
  const settings = await getEffectiveSettings()

  const resized = await sharp(originalBytes)
    .rotate() // honor EXIF rotation
    .resize(settings.vision_max_long_edge_px, settings.vision_max_long_edge_px, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: settings.vision_jpeg_quality, mozjpeg: true })
    .toBuffer()

  return {
    bytes: resized,
    mime: 'image/jpeg',
    mode: resized.byteLength <= MAX_INLINE_BYTES ? 'inline' : 'signed_url',
  }
}
