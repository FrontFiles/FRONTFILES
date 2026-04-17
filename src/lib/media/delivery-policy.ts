/**
 * Frontfiles — Centralized Asset Delivery Policy
 *
 * EVERY browser-facing surface that displays asset media MUST use this module.
 * No component may use thumbnailRef, thumbnailUrl, or any raw storage path
 * directly in <img src>, <video src>, or any browser-visible URL.
 *
 * This module enforces the commercial delivery rule:
 * - All preview/browse/pre-purchase contexts → /api/media/[id] (protected derivative)
 * - Original delivery → only with verified purchase/authorization
 * - Fail closed → if derivative unavailable, no image (never fall back to original)
 *
 * The original file path is resolved SERVER-SIDE by the API route.
 * It is NEVER sent to the browser as a URL, query parameter, or payload field.
 */

import type { WatermarkContext } from '@/lib/watermark/types'

// ── Delivery Contexts ──────────────────────────────────────

/**
 * Describes how the asset will be used. Determines delivery variant
 * and watermark configuration. Components select the context; the
 * policy layer enforces the correct variant.
 */
export type DeliveryContext =
  | 'thumbnail'          // Grid cards, search results, map markers
  | 'preview'            // Asset detail page, standard preview
  | 'lightbox-preview'   // Lightbox/fullscreen — still protected
  | 'share-preview'      // OG images, social share cards
  | 'upload-preview'     // Creator upload preview (pre-publish)
  | 'composer'           // Editorial composer (internal tool)

/**
 * Map DeliveryContext → WatermarkContext for the overlay system.
 */
export function deliveryToWatermarkContext(context: DeliveryContext): WatermarkContext {
  switch (context) {
    case 'thumbnail':        return 'asset-preview'
    case 'preview':          return 'detail-preview'
    case 'lightbox-preview': return 'detail-preview'
    case 'share-preview':    return 'share-preview'
    case 'upload-preview':   return 'upload-default'
    case 'composer':         return 'internal'
  }
}

// ── URL Resolution ─────────────────────────────────────────

/**
 * Resolve the browser-safe URL for an asset in a given delivery context.
 *
 * Returns a URL pointing to /api/media/[id] — the protected media endpoint.
 * The original file path is NEVER exposed to the browser.
 *
 * Returns empty string if assetId is missing (fail-closed).
 */
export function resolveProtectedUrl(
  assetId: string | null | undefined,
  context: DeliveryContext = 'preview',
): string {
  if (!assetId) return ''
  return `/api/media/${encodeURIComponent(assetId)}?ctx=${context}`
}

/**
 * Media variant — overrides the default visual derivative for the context.
 * video → playable video stream derivative.
 * audio → playable audio stream derivative.
 * illustration → illustration/vector visual derivative (thumbnail).
 *
 * NOTE: 'text' is NOT a variant. Text preview uses vault_assets.text_excerpt.
 * Full text access requires ?delivery=original with entitlement.
 */
export type MediaVariant = 'video' | 'audio' | 'illustration'

/**
 * Resolve the browser-safe URL for a non-default media variant.
 *
 * Adds a variant parameter that tells the route to serve a specific
 * derivative instead of the default visual derivative for the context.
 *
 * Returns empty string if assetId is missing (fail-closed).
 */
export function resolveProtectedMediaUrl(
  assetId: string | null | undefined,
  variant: MediaVariant,
  context: DeliveryContext = 'preview',
): string {
  if (!assetId) return ''
  return `/api/media/${encodeURIComponent(assetId)}?ctx=${context}&variant=${variant}`
}

/**
 * Resolve the URL for authorized original delivery (post-purchase).
 *
 * Returns null if assetId is missing — callers MUST handle null by failing closed.
 * Authorization is checked by the route handler, not by this function.
 * In production, this would return a time-limited signed URL to private storage.
 */
export function resolveOriginalUrl(
  assetId: string | null | undefined,
): string | null {
  if (!assetId) return null
  return `/api/media/${encodeURIComponent(assetId)}?delivery=original`
}
