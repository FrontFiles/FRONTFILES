/**
 * Frontfiles — Download UI View-Model Module
 *
 * Pure functions that map backend entitlement/deny/pack state
 * into concrete UI shapes (button labels, variants, banners).
 *
 * Usage:
 *   import { buildAssetDownloadViewModel } from '@/lib/download-ui'
 */

export {
  buildAssetDownloadViewModel,
  buildPackHeaderViewModel,
  buildArtifactRowViewModel,
} from './view-models'

export type {
  AssetDownloadViewModel,
  PackHeaderViewModel,
  ArtifactRowViewModel,
} from './view-models'
