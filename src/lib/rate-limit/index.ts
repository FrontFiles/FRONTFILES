/**
 * Frontfiles — Rate Limiting Module
 *
 * Public API for download rate limiting.
 *
 * Usage:
 *   import { checkOriginalDownloadRate, buildRateLimitResponse } from '@/lib/rate-limit'
 */

export {
  checkOriginalDownloadRate,
  buildRateLimitResponse,
} from './original-downloads'

export type {
  RateLimitContext,
  RateLimitResult,
} from './original-downloads'
