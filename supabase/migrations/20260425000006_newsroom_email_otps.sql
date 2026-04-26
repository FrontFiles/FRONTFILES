-- ════════════════════════════════════════════════════════════════
-- Newsroom Schema Extension — Domain-Email OTP Storage  (NR-D5b-ii)
--
-- Phase NR-2 Distributor Path. First migration after the Phase
-- NR-1 schema close (NR-D2c-ii at 20260425000005). Adds the
-- single table that backs the second verification method —
-- domain-email OTP — completing the NR-D5b split.
--
-- When this migration applies and NR-D5b-ii's app code lands,
-- tier auto-promotion from `unverified` to `verified_source`
-- fires for the first time on Frontfiles (a company that has
-- both an active dns_txt record and an active domain_email
-- record now resolves to verified_source via computeTier()).
-- This migration ships only the substrate; the firing happens
-- in src/app/api/newsroom/orgs/[orgSlug]/verifications/email/
-- verify/route.ts via recomputeTier() once both methods land.
--
-- ─── What this migration creates ─────────────────────────────
--
--   Tables (1):
--     newsroom_email_otps   — issuance lifecycle for OTP codes
--
--   Indexes (2):
--     idx_newsroom_email_otps_lookup   — (company_id, email,
--                                         consumed_at) lookup
--     idx_newsroom_email_otps_cleanup  — (expires_at) WHERE
--                                         consumed_at IS NULL,
--                                         drives v1.1 TTL job
--
--   Triggers (1):  set_updated_at() BEFORE UPDATE
--
--   RLS:           ENABLED, zero policies (service-role-only;
--                  newsroom_signing_keys precedent — NR-D2c-i)
--
-- ─── Why a new table, not a column on verification_records ───
--
-- newsroom_email_otps stores the *issuance* lifecycle (issued →
-- consumed/expired/exhausted), distinct from
-- newsroom_verification_records, which is the durable verified
-- result. Mixing them would force nullable verified_at,
-- attempts, and code_hash columns onto an append-only audit
-- table — schema drift. Clean separation:
--
--   newsroom_email_otps           — short-lived issuance state
--   newsroom_verification_records — durable verification log
--
-- ─── code_hash format ────────────────────────────────────────
--
-- code_hash stores HMAC-SHA256(NEWSROOM_VERIFICATION_HMAC_SECRET,
-- otp_code) as a 64-char lowercase hex string (the same secret
-- that backs deriveDnsTxtToken in src/lib/newsroom/verification.ts
-- — no new env var). Plaintext OTP codes are NEVER stored or
-- logged. Verification re-hashes user input and compares via
-- crypto.timingSafeEqual().
--
-- ─── Out of scope here (handled later) ───────────────────────
--
--   - TTL cleanup job (v1.1 housekeeping; idx_*_cleanup ready)
--   - Admin-side SELECT policy (NR-D17)
--   - INSERT/UPDATE/DELETE policies for authenticated (none —
--     service-role only by design; matches signing_keys posture)
--
-- ─── Sequencing ──────────────────────────────────────────────
--
-- Predecessor: 20260425000005_newsroom_schema_d2c_ii.sql
-- (Phase NR-1 close). This migration does NOT touch any prior
-- newsroom_* table; the only FK is to companies(id), which has
-- existed since 20260413230015.
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/
--     20260425000006_newsroom_email_otps.DOWN.sql
-- ════════════════════════════════════════════════════════════════

BEGIN;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  newsroom_email_otps                                    │
-- │                                                             │
-- │  One row per OTP issuance. consumed_at NULL ⇒ active        │
-- │  (subject to expires_at). attempts is incremented on each   │
-- │  failed verify; cap at 5 short-circuits brute-force.        │
-- │                                                             │
-- │  At most one *active* OTP per (company_id, email): the      │
-- │  send-otp route invalidates prior unconsumed rows by        │
-- │  setting consumed_at = now() before INSERTing the new row.  │
-- │  No DB-level uniqueness — the application enforces it,      │
-- │  matching the verification_records approach where dedupe    │
-- │  is semantic (active set is idempotent), not structural.    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_email_otps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         text NOT NULL,
  code_hash     text NOT NULL,

  attempts      integer     NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Lightweight server-side format guard. The send-otp route
  -- also normalises and re-validates before reaching this
  -- INSERT; the CHECK is a defense-in-depth backstop, not the
  -- primary validation. Pattern accepts simple
  -- local-part@host.tld shapes and rejects whitespace and
  -- multiple @ characters; not RFC-5322-strict.
  CONSTRAINT newsroom_email_otps_email_format CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),

  CONSTRAINT newsroom_email_otps_attempts_nonneg CHECK (
    attempts >= 0
  ),

  -- 5-attempt cap defensible against online guessing:
  -- 1-in-10^6 per attempt × 5 ≈ 5e-6 ≈ negligible, plus the
  -- 10-minute TTL further bounds the brute-force window.
  CONSTRAINT newsroom_email_otps_attempts_max CHECK (
    attempts <= 5
  ),

  CONSTRAINT newsroom_email_otps_consumed_after_created CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  ),

  CONSTRAINT newsroom_email_otps_expires_after_created CHECK (
    expires_at > created_at
  )
);

COMMENT ON TABLE newsroom_email_otps IS
  'Issuance lifecycle for domain-email verification OTPs. '
  'code_hash is HMAC-SHA256(NEWSROOM_VERIFICATION_HMAC_SECRET, '
  'otp_code) as 64-char hex; plaintext codes never persisted. '
  'consumed_at NULL ⇒ active (subject to expires_at); set to '
  'now() on successful verify, on attempts-cap exhaustion, or '
  'when send-otp invalidates a prior unconsumed row. '
  'Service-role only (RLS enabled, zero authenticated policies; '
  'matches newsroom_signing_keys posture from NR-D2c-i).';

COMMENT ON COLUMN newsroom_email_otps.code_hash IS
  'Hex-encoded HMAC-SHA256 of the OTP code. 64 chars. The OTP '
  'plaintext is emailed once and never persisted server-side. '
  'Verification re-hashes user input and compares via '
  'crypto.timingSafeEqual.';

COMMENT ON COLUMN newsroom_email_otps.attempts IS
  'Failed-verify counter. Incremented on each wrong-code '
  'submission. Hitting the cap (5) marks consumed_at = now() '
  'to invalidate the row, forcing the user to request a new '
  'OTP. Successful verify also marks consumed_at.';

COMMENT ON COLUMN newsroom_email_otps.expires_at IS
  '10 minutes from created_at by application policy (not a '
  'DB constraint — the column is just timestamptz). The '
  'verify route checks expires_at > now() before validating '
  'the code.';


-- ── Indexes ──

-- Fast lookup of the latest active OTP for (company, email).
-- The verify route does:
--   SELECT ... WHERE company_id = ? AND email = ?
--                AND consumed_at IS NULL
--   ORDER BY created_at DESC LIMIT 1
-- Including consumed_at in the index lets the planner serve
-- the consumed_at filter from the index rather than reading
-- heap rows just to discard consumed ones.
CREATE INDEX idx_newsroom_email_otps_lookup
  ON newsroom_email_otps (company_id, email, consumed_at);

-- Drives the v1.1 TTL cleanup job. Predicate is IMMUTABLE
-- (column reference + IS NULL constant), safe per the
-- partial-index-predicate-immutability rule established in
-- NR-D1 exit report §2 / NR-D2c-i §2 (no functions like now(),
-- no enum-coercion expressions, no volatile operators).
CREATE INDEX idx_newsroom_email_otps_cleanup
  ON newsroom_email_otps (expires_at)
  WHERE consumed_at IS NULL;


-- ── Trigger ──

-- set_updated_at() is the canonical updated_at maintenance
-- trigger from migration 20260413230014_common_trigger_functions.sql.
-- Used identically by every Newsroom table that has updated_at.
CREATE TRIGGER trg_newsroom_email_otps_updated_at
  BEFORE UPDATE ON newsroom_email_otps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  Row-Level Security                                     │
-- │                                                             │
-- │  ENABLE RLS + ZERO authenticated policies = deny-all for    │
-- │  authenticated and anon. service_role bypasses RLS by       │
-- │  default (Postgres convention), so the send-otp / verify    │
-- │  routes — which use the service-role client — can read,    │
-- │  insert, and update freely.                                 │
-- │                                                             │
-- │  Same posture as newsroom_signing_keys (NR-D2c-i §4) and    │
-- │  newsroom_distribution_events / newsroom_download_receipts. │
-- │                                                             │
-- │  An admin-side SELECT policy may be added in NR-D17 if      │
-- │  operator surfaces need to view OTP issuance history; not   │
-- │  in scope here.                                             │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_email_otps ENABLE ROW LEVEL SECURITY;

-- NO POLICIES on newsroom_email_otps. Intentional: service-
-- role-only access. authenticated and anon are denied all
-- operations by the RLS default-deny posture.


COMMIT;
