/**
 * Frontfiles — Company Role Policy
 *
 * Single source of truth for which company membership roles
 * grant access to protected resources.
 *
 * Imported by:
 *   - entitlement store (original delivery authorization)
 *   - fulfilment store (package ownership authorization)
 *
 * These are the SAME roles in both contexts because the business
 * rule is: "if you can download originals via a company grant,
 * you can also access company-owned packages, and vice versa."
 *
 * If this changes (e.g. a future 'viewer' role that can see
 * packages but not download originals), split into two constants.
 */

import type { BuyerCompanyRole } from '@/lib/types'

export const DOWNLOAD_ELIGIBLE_ROLES: readonly BuyerCompanyRole[] = [
  'admin',
  'content_commit_holder',
  'editor',
] as const
