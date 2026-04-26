// ═══════════════════════════════════════════════════════════════
// Frontfiles — Public keyset endpoint (NR-D10, F6)
//
// Exposes the active + rotated SigningKey public keys so any
// third-party verifier can fetch them and validate stored
// DownloadReceipts.
//
// PRD §3.2 SigningKey block (verbatim authority): "Public keyset
// endpoint: `frontfiles.com/.well-known/receipt-keys`."
// IP-3 ratification (2026-04-26) corrected the directive's
// proposed `/api/newsroom/keyset` to this PRD-canonical path.
//
// RFC 8615 .well-known URI compliance: the endpoint serves
// marketplace-wide receipt verification, not newsroom-specific
// content; verifiers know to fetch from the root domain.
//
// proxy.ts behavior: the matcher excludes paths containing a
// literal dot (`.*\..*`), which `.well-known` matches on the dot
// in the segment name. The newsroom-subdomain rewrite therefore
// does NOT fire for this path — the route is reachable on both
// `frontfiles.com/.well-known/receipt-keys` AND
// `newsroom.frontfiles.com/.well-known/receipt-keys` directly,
// without rewriting. Either is correct; verifiers per PRD use
// the main domain.
//
// Auth: NONE. Public keys are public by definition; verifiers
// must be able to fetch without credentials.
//
// Cache: 5 minutes. Verifiers should refresh periodically (key
// rotation) but not hammer the endpoint per request.
//
// Status filter: returns `active` and `rotated` keys, excludes
// `revoked`. PRD §3.2: "`rotated` keys remain valid for verifying
// prior receipts. `revoked` invalidates prior receipts signed by
// that key (compromise response only)." Revoked keys are
// deliberately excluded — receipts signed by revoked keys are no
// longer trusted.
//
// Spec cross-references:
//   - directives/NR-D10-signing-keys-receipts.md §F6
//   - PRD §3.2 SigningKey (PRD-canonical URL + status semantics)
//   - migration 20260425000004 (NR-D2c-i — newsroom_signing_keys)
//   - src/proxy.ts (matcher exclusion regex)
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import type {
  NewsroomSigningAlgorithm,
  NewsroomSigningKeyStatus,
} from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const ROUTE = 'GET /.well-known/receipt-keys'

interface PublicKeyEntry {
  /** SigningKey row's `kid` — referenced by DownloadReceipt.signing_key_kid. */
  signing_key_kid: string
  /** SPKI-format PEM. */
  public_key_pem: string
  /** v1 fixed: 'ed25519'. Future-proof for v1.1 rotation to other algorithms. */
  algorithm: NewsroomSigningAlgorithm
  /** 'active' or 'rotated' (revoked excluded). */
  status: NewsroomSigningKeyStatus
  /** When the key row was created (acts as activation time in v1; no separate activated_at). */
  created_at: string
  /** When the key was rotated (null for active keys). */
  rotated_at: string | null
}

interface KeysetResponse {
  keys: PublicKeyEntry[]
}

/**
 * GET /.well-known/receipt-keys
 *
 * Returns the JSON keyset (JWKS-inspired but simpler). On query
 * failure, returns 500 with a structured error — verifiers should
 * retry with backoff.
 */
export async function GET(): Promise<NextResponse<KeysetResponse | { error: string }>> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('newsroom_signing_keys')
    .select('kid, public_key_pem, algorithm, status, rotated_at, created_at')
    .in('status', ['active', 'rotated'])
    .order('created_at', { ascending: false })

  if (error) {
    logger.error(
      {
        route: ROUTE,
        rawCode: error.code,
        rawMessage: error.message,
      },
      '[newsroom.keyset] query failed',
    )
    return NextResponse.json(
      { error: 'keyset-fetch-failed' },
      { status: 500 },
    )
  }

  const keys: PublicKeyEntry[] = ((data ?? []) as Array<{
    kid: string
    public_key_pem: string
    algorithm: NewsroomSigningAlgorithm
    status: NewsroomSigningKeyStatus
    rotated_at: string | null
    created_at: string
  }>).map((row) => ({
    signing_key_kid: row.kid,
    public_key_pem: row.public_key_pem,
    algorithm: row.algorithm,
    status: row.status,
    created_at: row.created_at,
    rotated_at: row.rotated_at,
  }))

  return NextResponse.json(
    { keys },
    {
      status: 200,
      headers: {
        // 5-minute cache. Verifiers refresh periodically to pick
        // up rotation; not so often that a single high-volume
        // verifier hammers the endpoint.
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
}
