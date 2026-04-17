/**
 * Frontfiles — Image Resize Service
 *
 * Pure function: takes an image buffer + derivative spec, returns
 * a resized/compressed JPEG buffer. No side effects, no storage I/O.
 *
 * Uses Sharp for all image operations.
 *
 * PROCESSING ORDER: This runs BEFORE watermark compositing.
 * The watermark is applied to the compressed output of this step.
 */

import sharp from 'sharp'
import type { DerivativeSpec } from './types'
import { computeOutputDimensions } from './types'

/** Metadata about the resize operation for logging/storage. */
export interface ResizeResult {
  buffer: Buffer
  width: number
  height: number
  fileSizeBytes: number
}

/**
 * Resize and compress an image to the target derivative spec.
 *
 * - short-edge / long-edge: preserves aspect ratio, no crop
 * - fixed: center-crops to exact dimensions (for OG images)
 * - Never upscales: if original is smaller than target, output is original size
 * - Output is always JPEG at the spec's quality level
 *
 * @param input — original image as Buffer
 * @param spec — the derivative spec (dimensions + quality)
 * @returns resized buffer + output metadata
 */
export async function resizeImage(
  input: Buffer,
  spec: DerivativeSpec,
): Promise<ResizeResult> {
  const metadata = await sharp(input).metadata()
  const originalWidth = metadata.width ?? 0
  const originalHeight = metadata.height ?? 0

  if (originalWidth === 0 || originalHeight === 0) {
    throw new Error(`Cannot resize: invalid image dimensions (${originalWidth}x${originalHeight})`)
  }

  const target = computeOutputDimensions(originalWidth, originalHeight, spec.dimensions)

  let pipeline = sharp(input)

  if (spec.dimensions.sizeMode === 'fixed') {
    // Fixed mode: resize to cover target area, then center-crop
    pipeline = pipeline.resize(target.width, target.height, {
      fit: 'cover',
      position: 'centre',
    })
  } else {
    // short-edge / long-edge: resize maintaining aspect ratio
    pipeline = pipeline.resize(target.width, target.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Encode as JPEG at target quality
  const buffer = await pipeline
    .jpeg({ quality: spec.quality, mozjpeg: true })
    .toBuffer()

  // Read actual output dimensions (may differ slightly due to rounding)
  const outputMeta = await sharp(buffer).metadata()

  return {
    buffer,
    width: outputMeta.width ?? target.width,
    height: outputMeta.height ?? target.height,
    fileSizeBytes: buffer.byteLength,
  }
}
