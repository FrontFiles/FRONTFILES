/**
 * Frontfiles — Download Event Audit Types
 *
 * TypeScript types mirroring the download_events PostgreSQL table
 * and its supporting enums.
 *
 * BOUNDARY:
 *   These types are for audit logging ONLY.
 *   They do not participate in authorization decisions.
 */

import type { ArtifactType } from '@/lib/fulfilment'

// ══════════════════════════════════════════════
// ENUMS (mirrors PostgreSQL enums)
// ══════════════════════════════════════════════

export type DownloadChannel =
  | 'original_media'
  | 'package_zip'
  | 'package_artifact'

export type DownloadAccessBasis =
  | 'creator_self_access'
  | 'personal_grant'
  | 'company_grant'
  | 'package_owner'
  | 'none'

export type DownloadOutcome =
  | 'allowed'
  | 'denied'
  | 'unavailable'
  | 'not_found'
  | 'redirected'
  | 'error'

// ══════════════════════════════════════════════
// INSERT PAYLOAD
// ══════════════════════════════════════════════

/**
 * Full insert payload for download_events.
 *
 * All fields map 1:1 to table columns. Nullable fields are
 * optional in TypeScript — Supabase omits them from the INSERT.
 */
export interface DownloadEventInsert {
  // Who
  user_id: string
  company_id?: string | null

  // Channel
  delivery_channel: DownloadChannel

  // Resource identifiers
  asset_id?: string | null
  licence_grant_id?: string | null
  package_id?: string | null
  artifact_id?: string | null
  artifact_type?: ArtifactType | null

  // Authorization
  access_basis: DownloadAccessBasis

  // Outcome
  outcome: DownloadOutcome
  deny_reason?: string | null
  http_status: number

  // Request context
  ip_address?: string | null
  user_agent?: string | null
  request_id?: string | null
}

// ══════════════════════════════════════════════
// REQUEST METADATA
// ══════════════════════════════════════════════

/**
 * Extracted from NextRequest at the top of each handler.
 * Passed into the event builder so each handler doesn't
 * repeat header extraction.
 */
export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
}
