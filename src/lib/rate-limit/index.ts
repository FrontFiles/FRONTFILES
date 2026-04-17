/**
 * Frontfiles — Rate Limiting Module
 *
 * Two policies currently exported:
 *   - `checkOriginalDownloadRate` — protects original-file delivery
 *     from scraping. Per-user + per-IP, creator exemption.
 *   - `checkWriteActionRate` — protects write endpoints (POST/PATCH/DELETE)
 *     from abuse. Per-user across burst/hourly/daily windows.
 *
 * Usage:
 *   import { checkOriginalDownloadRate, buildRateLimitResponse } from '@/lib/rate-limit'
 *   import { checkWriteActionRate, buildWriteRateLimitResponse } from '@/lib/rate-limit'
 */

export {
  checkOriginalDownloadRate,
  buildRateLimitResponse,
} from './original-downloads'

export type {
  RateLimitContext,
  RateLimitResult,
} from './original-downloads'

export {
  checkWriteActionRate,
  buildWriteRateLimitResponse,
} from './write-actions'

export type {
  WriteRateContext,
  WriteRateResult,
} from './write-actions'
