// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom verification helpers (NR-D5b-i, F10)
//
// Three pure helpers + one DB-bound helper for the P2 verification
// dashboard:
//
//   1. deriveDnsTxtToken(companyId)
//      Deterministic HMAC-SHA256 of `${companyId}:dns-txt` with
//      NEWSROOM_VERIFICATION_HMAC_SECRET.  Truncated to 32 hex chars
//      (128 bits), which is sufficient — the token is the challenge
//      for a PUBLIC DNS record, so the only threat worth modelling
//      is collision on the token space, not brute-force.  Rotating
//      the env secret invalidates all in-flight challenges; rows
//      already persisted in newsroom_verification_records carry
//      their own value_checked snapshot so prior verifications
//      remain auditable.
//
//   2. expectedDnsTxtRecord(companyId, domain)
//      Returns `{ recordName: domain, recordValue:
//      'frontfiles-verify=<token>' }` — the exact shape the
//      dashboard tells the user to add to DNS and the shape F9's
//      resolver compares against.
//
//   3. computeTier(activeRecords)
//      Pure tier resolution from active verification methods.
//      dns_txt + domain_email + authorized_signatory → verified_publisher
//      dns_txt + domain_email                         → verified_source
//      anything else                                  → unverified
//
//   4. recomputeTier(client, companyId)  (async, DB)
//      Reads newsroom_profiles + active newsroom_verification_records,
//      derives the tier via (3), and persists to newsroom_profiles if
//      it changed.  The pure branch is covered by unit tests (F11);
//      this async wrapper is exercised by the recheck endpoint (F9)
//      and covered indirectly by runtime smoke.
//
// Secret loading is deliberately fail-fast (see loadSecret below).
// env.ts already fails at module load when the secret is missing,
// but the helper-level guard catches test cases that stub the env
// out (vitest `vi.stubEnv('NEWSROOM_VERIFICATION_HMAC_SECRET', '')`).
//
// Spec cross-references:
//   - docs/public-newsroom/PRD.md §5.1 P2 (tier transitions)
//   - docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md §F10
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { createHmac } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  NewsroomVerificationMethod,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

const DNS_TXT_PURPOSE = 'dns-txt'
const DNS_TXT_TOKEN_LENGTH = 32 // hex chars (128 bits of entropy)
const DNS_TXT_RECORD_PREFIX = 'frontfiles-verify='

/**
 * Read the env secret. Throws if missing or empty.
 *
 * Reads `process.env` directly (not via `env.ts`) so that the test
 * harness can stub it per-case via `vi.stubEnv(...)`. The env.ts
 * Zod parse still runs at module load and fails-fast in production;
 * this helper is the runtime guard for test / future mocked paths.
 */
function loadSecret(): string {
  const secret = process.env.NEWSROOM_VERIFICATION_HMAC_SECRET
  if (!secret || secret.length === 0) {
    throw new Error(
      'NEWSROOM_VERIFICATION_HMAC_SECRET is not set. ' +
        'Run `openssl rand -base64 48` and add it to .env.local. ' +
        'See docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md §NEW ENV VAR.',
    )
  }
  return secret
}

/**
 * Deterministic DNS TXT challenge token for a company.
 *
 * Same companyId + same secret → same token, always. This makes
 * re-issuance idempotent: the dashboard can safely call the issue
 * endpoint multiple times without invalidating a record the user
 * has already added to DNS.
 */
export function deriveDnsTxtToken(companyId: string): string {
  const secret = loadSecret()
  return createHmac('sha256', secret)
    .update(`${companyId}:${DNS_TXT_PURPOSE}`)
    .digest('hex')
    .slice(0, DNS_TXT_TOKEN_LENGTH)
}

/**
 * The DNS TXT record the user must add, in the exact shape the
 * dashboard displays and the recheck endpoint compares against.
 */
export function expectedDnsTxtRecord(
  companyId: string,
  domain: string,
): { recordName: string; recordValue: string } {
  const token = deriveDnsTxtToken(companyId)
  return {
    recordName: domain,
    recordValue: `${DNS_TXT_RECORD_PREFIX}${token}`,
  }
}

/**
 * Pure tier resolution from a list of active verification records.
 *
 * "Active" means: expires_at IS NULL OR expires_at > now(). The
 * filtering happens at the caller (F9 / recomputeTier); this helper
 * just consumes the filtered list.
 *
 * PRD §5.1 P2 tier-transition rules encoded here. Any change to the
 * rules ripples through the vitest suite in F11.
 */
export function computeTier(
  activeRecords: ReadonlyArray<{ method: NewsroomVerificationMethod }>,
): NewsroomVerificationTier {
  const methods = new Set(activeRecords.map((r) => r.method))
  const hasDns = methods.has('dns_txt')
  const hasEmail = methods.has('domain_email')
  const hasSignatory = methods.has('authorized_signatory')
  if (hasDns && hasEmail && hasSignatory) return 'verified_publisher'
  if (hasDns && hasEmail) return 'verified_source'
  return 'unverified'
}

/**
 * Recompute and persist a company's verification_tier.
 *
 * Reads newsroom_profiles + active newsroom_verification_records,
 * derives the tier via computeTier(), and UPDATEs newsroom_profiles
 * iff the tier changed. Returns the before/after tuple for logging
 * at the call site.
 *
 * Takes a supabase client rather than instantiating one so callers
 * can pass their authenticated (user-JWT) or service_role client
 * depending on the caller's posture. The recheck route (F9) uses
 * service_role because newsroom_verification_records INSERT is
 * service_role-only (RLS policies in migration 20260425000001).
 *
 * Throws on any DB error. Caller is responsible for catch + log;
 * the recheck route swallows recompute failures (the verification
 * record insert already succeeded — tier recompute is an ancillary
 * consistency step, not the core verification semantic).
 */
export async function recomputeTier(
  client: SupabaseClient,
  companyId: string,
): Promise<{
  before: NewsroomVerificationTier
  after: NewsroomVerificationTier
}> {
  const { data: profile, error: profileError } = await client
    .from('newsroom_profiles')
    .select('verification_tier')
    .eq('company_id', companyId)
    .maybeSingle()
  if (profileError) {
    throw new Error(
      `recomputeTier: newsroom_profiles read failed: ${profileError.message}`,
    )
  }
  if (!profile) {
    throw new Error(
      `recomputeTier: newsroom_profiles row not found for company ${companyId}`,
    )
  }
  const before = profile.verification_tier as NewsroomVerificationTier

  const nowIso = new Date().toISOString()
  const { data: records, error: recordsError } = await client
    .from('newsroom_verification_records')
    .select('method, expires_at')
    .eq('company_id', companyId)
  if (recordsError) {
    throw new Error(
      `recomputeTier: verification_records read failed: ${recordsError.message}`,
    )
  }

  const active = (records ?? []).filter(
    (r: { method: NewsroomVerificationMethod; expires_at: string | null }) =>
      r.expires_at === null || r.expires_at > nowIso,
  ) as Array<{ method: NewsroomVerificationMethod }>

  const after = computeTier(active)

  if (before !== after) {
    const { error: updateError } = await client
      .from('newsroom_profiles')
      .update({ verification_tier: after })
      .eq('company_id', companyId)
    if (updateError) {
      throw new Error(
        `recomputeTier: verification_tier update failed: ${updateError.message}`,
      )
    }
  }

  return { before, after }
}
