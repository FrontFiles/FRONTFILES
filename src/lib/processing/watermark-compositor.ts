/**
 * Frontfiles — Watermark Compositor
 *
 * Composites a visible watermark onto a compressed image derivative.
 * Uses Sharp for all image composition operations.
 *
 * The compositor renders the watermark as a PNG overlay buffer, then
 * composites it onto the image. The overlay contains:
 *
 *   1. A vertical bar with three sections: brand logo, asset ID, attribution
 *   2. [Heavy level only] Scattered FF brand icons across the image surface
 *
 * All positioning uses ratios from the watermark profile, making it
 * resolution-independent. The same profile works at any derivative size.
 *
 * IMPORTANT: This runs AFTER resize. Input is the compressed derivative,
 * NOT the original. Output is JPEG at the same quality.
 */

import sharp from 'sharp'
import path from 'path'
import type { WatermarkProfile, ScatterConfig } from './types'

/** Path to static compositing assets. */
const ASSETS_DIR = path.join(__dirname, 'assets')

// ══════════════════════════════════════════════
// CONSTANTS (from PSD template analysis)
// ══════════════════════════════════════════════

/** Brand colors matching the PSD templates. */
const BRAND_BLUE = '#0000FF'
const BAR_BLACK = '#000000'
const TEXT_WHITE = '#FFFFFF'

// ══════════════════════════════════════════════
// BAR RENDERER
// ══════════════════════════════════════════════

/**
 * Render the watermark bar as a PNG buffer with alpha channel.
 *
 * The bar is a vertical strip with three stacked sections:
 *   1. Brand logo (blue background)
 *   2. Asset ID (black background, large rotated text)
 *   3. Attribution (black background, smaller rotated text)
 *
 * Text is rendered using SVG-in-Sharp for resolution independence.
 */
async function renderBar(
  imageWidth: number,
  imageHeight: number,
  profile: WatermarkProfile,
  assetIdShort: string,
  attribution: string,
): Promise<{ buffer: Buffer; x: number; y: number; barWidth: number; barHeight: number }> {
  // Compute bar dimensions from profile ratios
  const shortEdge = Math.min(imageWidth, imageHeight)
  const barWidth = Math.max(20, Math.round(shortEdge * profile.barWidthRatio))

  // Bar spans a portion of the image height
  const totalBarRatio = profile.brandBlock.heightRatio + profile.idBlock.heightRatio + profile.attributionBlock.heightRatio
  const barHeight = Math.round(imageHeight * totalBarRatio * 0.6)

  // Section heights
  const brandH = Math.round(barHeight * (profile.brandBlock.heightRatio / totalBarRatio))
  const idH = Math.round(barHeight * (profile.idBlock.heightRatio / totalBarRatio))
  const attrH = barHeight - brandH - idH

  // Font sizes scale with bar width
  const idFontSize = Math.max(8, Math.round(barWidth * 0.75))
  const attrFontSize = Math.max(6, Math.round(barWidth * 0.28))
  const labelFontSize = Math.max(5, Math.round(barWidth * 0.18))

  // Truncate attribution to fit
  const maxAttrChars = Math.floor(attrH / (attrFontSize * 0.8))
  const attrText = attribution.length > maxAttrChars
    ? attribution.slice(0, maxAttrChars - 1) + '\u2026'
    : attribution

  // Build SVG for the bar — vertical text using writing-mode
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${barWidth}" height="${barHeight}">
    <!-- Brand block (blue) -->
    <rect x="0" y="0" width="${barWidth}" height="${brandH}" fill="${BRAND_BLUE}"/>
    <text x="${barWidth / 2}" y="${brandH * 0.38}"
          text-anchor="middle" dominant-baseline="central"
          font-family="Helvetica,Arial,sans-serif" font-weight="900"
          font-size="${Math.round(barWidth * 0.32)}px" fill="${TEXT_WHITE}"
          letter-spacing="0.5">FRONT</text>
    <text x="${barWidth / 2}" y="${brandH * 0.72}"
          text-anchor="middle" dominant-baseline="central"
          font-family="Helvetica,Arial,sans-serif" font-weight="900"
          font-size="${Math.round(barWidth * 0.32)}px" fill="${TEXT_WHITE}"
          letter-spacing="0.5">FILES</text>

    <!-- ID block (black) -->
    <rect x="0" y="${brandH}" width="${barWidth}" height="${idH}" fill="${BAR_BLACK}"/>
    <text x="${barWidth * 0.88}" y="${brandH + 14}"
          font-family="Helvetica,Arial,sans-serif" font-weight="400"
          font-size="${labelFontSize}px" fill="${TEXT_WHITE}" opacity="0.6"
          letter-spacing="1">ID</text>
    <g transform="translate(${barWidth * 0.5}, ${brandH + idH * 0.5})">
      <text transform="rotate(90)"
            text-anchor="middle" dominant-baseline="central"
            font-family="Helvetica,Arial,sans-serif" font-weight="700"
            font-size="${idFontSize}px" fill="${TEXT_WHITE}"
            letter-spacing="1">${assetIdShort}</text>
    </g>

    <!-- Attribution block (black) -->
    <rect x="0" y="${brandH + idH}" width="${barWidth}" height="${attrH}" fill="${BAR_BLACK}"/>
    <text x="${barWidth * 0.88}" y="${brandH + idH + 14}"
          font-family="Helvetica,Arial,sans-serif" font-weight="400"
          font-size="${labelFontSize}px" fill="${TEXT_WHITE}" opacity="0.6"
          letter-spacing="1">PHOTO BY</text>
    <g transform="translate(${barWidth * 0.42}, ${brandH + idH + attrH * 0.5})">
      <text transform="rotate(90)"
            text-anchor="middle" dominant-baseline="central"
            font-family="Helvetica,Arial,sans-serif" font-weight="700"
            font-size="${attrFontSize}px" fill="${TEXT_WHITE}"
            letter-spacing="1.5">${escapeXml(attrText.toUpperCase())}</text>
    </g>
  </svg>`

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()

  // Compute absolute position from profile ratios
  const x = Math.round(imageWidth * profile.barPosition.xRatio)
  const y = Math.round(imageHeight * profile.barPosition.yRatio)

  return { buffer, x, y, barWidth, barHeight }
}

// ══════════════════════════════════════════════
// SCATTER RENDERER (Heavy level only)
// ══════════════════════════════════════════════

/**
 * Render scattered FF icons as a full-image PNG overlay.
 * Icons are distributed in a grid with slight offsets for
 * visual irregularity. The grid avoids the bar area.
 */
async function renderScatter(
  imageWidth: number,
  imageHeight: number,
  config: ScatterConfig,
  barX: number,
  barWidth: number,
): Promise<Buffer> {
  // Scale icon size proportionally to image dimensions
  const refLongEdge = 1600
  const actualLongEdge = Math.max(imageWidth, imageHeight)
  const scale = actualLongEdge / refLongEdge
  const iconSize = Math.max(12, Math.round(config.iconSizePx * scale))

  // Compute grid spacing from density
  // density = icons per 1,000,000 pixels
  const totalPixels = imageWidth * imageHeight
  const iconCount = Math.round((totalPixels / 1_000_000) * config.density)
  const cols = Math.max(2, Math.round(Math.sqrt(iconCount * (imageWidth / imageHeight))))
  const rows = Math.max(2, Math.round(iconCount / cols))
  const spacingX = imageWidth / cols
  const spacingY = imageHeight / rows

  // Build SVG with scattered FF glyphs
  const icons: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = Math.round(spacingX * (c + 0.5))
      const cy = Math.round(spacingY * (r + 0.5))

      // Skip icons that would overlap the bar
      if (cx > barX - iconSize && cx < barX + barWidth + iconSize) continue

      // Stagger odd rows by half a column
      const offsetX = r % 2 === 1 ? Math.round(spacingX * 0.3) : 0
      const finalX = cx + offsetX
      const fSize = Math.round(iconSize * 0.55)

      icons.push(`
        <text x="${finalX}" y="${cy - fSize * 0.1}"
              text-anchor="middle" dominant-baseline="central"
              font-family="Helvetica,Arial,sans-serif" font-weight="900"
              font-size="${fSize}px" fill="${BAR_BLACK}">F</text>
        <text x="${finalX}" y="${cy + fSize * 0.9}"
              text-anchor="middle" dominant-baseline="central"
              font-family="Helvetica,Arial,sans-serif" font-weight="900"
              font-size="${fSize}px" fill="${BRAND_BLUE}">F</text>
      `)
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}"
    opacity="${config.opacity}">
    ${icons.join('\n')}
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ══════════════════════════════════════════════
// MAIN COMPOSITOR
// ══════════════════════════════════════════════

/**
 * Composite a watermark onto a compressed image derivative.
 *
 * @param image — compressed JPEG buffer (output of resize step)
 * @param profile — approved watermark profile with rendering recipe
 * @param assetIdShort — short asset ID for the watermark bar (e.g. "952be73")
 * @param attribution — creator name for the watermark bar
 * @param quality — JPEG output quality (should match the resize step)
 * @returns watermarked JPEG buffer
 */
export async function compositeWatermark(
  image: Buffer,
  profile: WatermarkProfile,
  assetIdShort: string,
  attribution: string,
  quality: number,
): Promise<Buffer> {
  const metadata = await sharp(image).metadata()
  const imageWidth = metadata.width ?? 0
  const imageHeight = metadata.height ?? 0

  if (imageWidth === 0 || imageHeight === 0) {
    throw new Error('Cannot watermark: invalid image dimensions')
  }

  // Render the bar overlay
  const bar = await renderBar(imageWidth, imageHeight, profile, assetIdShort, attribution)

  // Build composite layers
  const layers: sharp.OverlayOptions[] = []

  // Scatter layer (heavy level only) — rendered BEHIND the bar
  if (profile.scatterConfig) {
    const scatterBuffer = await renderScatter(
      imageWidth,
      imageHeight,
      profile.scatterConfig,
      bar.x,
      bar.barWidth,
    )
    layers.push({ input: scatterBuffer, top: 0, left: 0 })
  }

  // Bar layer — rendered ON TOP
  layers.push({
    input: bar.buffer,
    top: bar.y,
    left: Math.min(bar.x, imageWidth - bar.barWidth), // clamp to image bounds
  })

  // Composite all layers onto the image
  const result = await sharp(image)
    .composite(layers)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()

  return result
}

// ══════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════

/** Escape XML special characters for safe SVG embedding. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
