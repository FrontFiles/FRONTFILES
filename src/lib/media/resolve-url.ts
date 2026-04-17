/**
 * Frontfiles — Asset Media URL Resolver
 *
 * Convenience wrappers over delivery-policy.ts for common component contexts.
 * Every component that renders an asset image MUST use these resolvers.
 *
 * DELIVERY POLICY: The browser never receives the original file path.
 * All URLs route through /api/media/[id], which resolves the file server-side.
 */

import { resolveProtectedUrl, type DeliveryContext } from './delivery-policy'

// Re-export for convenience
export { resolveProtectedUrl, type DeliveryContext } from './delivery-policy'
export { deliveryToWatermarkContext } from './delivery-policy'

/**
 * Resolve URL for preview card contexts (grid, search, discovery).
 */
export function resolvePreviewUrl(assetId: string): string {
  return resolveProtectedUrl(assetId, 'thumbnail')
}

/**
 * Resolve URL for detail page contexts (asset viewer, lightbox).
 */
export function resolveDetailUrl(assetId: string): string {
  return resolveProtectedUrl(assetId, 'preview')
}
