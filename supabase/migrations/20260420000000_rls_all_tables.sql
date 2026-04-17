-- ═══════════════════════════════════════════════════════════════════
-- FRONTFILES — CCP 2: Row-Level Security on EVERY user-owned table
--
-- This migration closes two gaps identified in the 2026-04-20 audit:
--
--   1. The prior RLS migration (20260419100000_rls_core_policies.sql)
--      declared — in its header — that "RLS is already ENABLED on
--      every public-schema table by earlier migrations." A grep of the
--      migration tree proves otherwise: only asset_embeddings,
--      ai_analysis, and audit_log (from 20260419110000) had
--      `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. For every other
--      table the v1 policies were INERT — Postgres does not enforce
--      policies on a table whose RLS is disabled. This migration
--      enables RLS on every user-owned table.
--
--   2. Several user-owned tables had no policy coverage at all. This
--      migration adds participant-read policies per the CCP 2 spec
--      on the tables the spec enumerates. Tables whose product
--      decision is unresolved get an explicit deny-all policy + a
--      TODO comment rather than a guessed policy. All writes default
--      to service-role only (the authoritative state transitions live
--      in server-side API routes); tables that need participant
--      writes from the client will loosen in a later migration once
--      the per-entity state-transition rules are locked.
--
-- PRODUCT DECISIONS SURFACED (not guessed — intentionally deny-all):
--
--   a. `messages` table — spec lists it, but no such table exists in
--      the schema. Closest thing is the deny-messages UI strings
--      under src/lib/deny-messages. If a real messages table is
--      planned, policies need to be designed against it later.
--
--   b. "staff R" on assignment_* tables — there is no `staff` value in
--      user_granted_types and no staff identity registry. The /staff
--      dashboard runs on the server via service role, not under
--      authenticated RLS. Until a staff-user registry exists, staff
--      reads are served by server code (service role); RLS for the
--      `authenticated` role stays participant-only.
--
--   c. watermark_profiles "creator RW own" — the table has no
--      creator_id column. Watermark profiles are platform-managed
--      (approval-gated, shared across all creators per the 2026-04-16
--      image derivative architecture memo). Per-creator ownership
--      would require a schema change. Deny-all for anon +
--      authenticated; writes via service role during approval flow.
--
--   d. assignment_* participant WRITES — the spec says "RW" for
--      buyer + creator participants, but assignment state transitions
--      are event-sourced through /api/assignment/* (service role).
--      Allowing direct UPDATE from the client would bypass the state
--      machine invariants enforced in application code. This
--      migration grants participant READS only; writes continue
--      through server APIs with service role. Revisit per
--      ASSIGNMENT_DISPUTE_TAXONOMY.md once the wire-level
--      state-transition contract is locked.
--
-- IDEMPOTENCY:
--   - `ALTER TABLE … ENABLE ROW LEVEL SECURITY` is a no-op if RLS is
--     already enabled — safe to re-run.
--   - Every policy uses `DROP POLICY IF EXISTS` before `CREATE POLICY`
--     (Postgres has no `CREATE POLICY IF NOT EXISTS` — this is the
--     standard idempotent workaround).
--   - Column grants use REVOKE-then-GRANT.
--   - The users_public view uses `CREATE OR REPLACE VIEW`.
--
-- VERIFICATION:
--   See supabase/tests/rls_all_tables.sql (pgTAP) and
--   src/lib/db/__tests__/rls.test.ts (runtime checks via supabase-js).
-- ═══════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §A  Enable Row-Level Security on every user-owned table        │
-- │                                                                 │
-- │  Idempotent.  Without this, the policies below have no effect.  │
-- └─────────────────────────────────────────────────────────────────┘

ALTER TABLE users                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_granted_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_accounts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_company_memberships     ENABLE ROW LEVEL SECURITY;

ALTER TABLE companies                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships           ENABLE ROW LEVEL SECURITY;

ALTER TABLE vault_assets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_media                   ENABLE ROW LEVEL SECURITY;

ALTER TABLE upload_batches                ENABLE ROW LEVEL SECURITY;

ALTER TABLE posts                         ENABLE ROW LEVEL SECURITY;

ALTER TABLE licence_grants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_line_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_packages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_package_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_package_artifacts   ENABLE ROW LEVEL SECURITY;

ALTER TABLE download_events               ENABLE ROW LEVEL SECURITY;

ALTER TABLE assignments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rights_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_records                ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfilment_submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_records                ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_change_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccr_amended_fields            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_dispute_cases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_events             ENABLE ROW LEVEL SECURITY;

ALTER TABLE direct_offer_threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_offer_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_checkout_intents        ENABLE ROW LEVEL SECURITY;

ALTER TABLE external_connections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_credentials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_webhook_events       ENABLE ROW LEVEL SECURITY;

ALTER TABLE watermark_profiles            ENABLE ROW LEVEL SECURITY;

-- asset_embeddings, ai_analysis, audit_log already had ENABLE ROW LEVEL
-- SECURITY in 20260419110000_phase1_vector_cache_audit.sql and are
-- deliberately service-role-only.  No action needed here.


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §B  users: restrict anon to public fields via column GRANTs    │
-- │                                                                 │
-- │  The v1 policy `users_anon_read` grants anon SELECT on any row  │
-- │  (rows ARE public — that's what a profile page renders).  But   │
-- │  Postgres RLS is row-scoped, not column-scoped — without the    │
-- │  REVOKE+GRANT below, anon could also read `email`, which is     │
-- │  private PII.  Column-level privileges close the column hole.   │
-- │                                                                 │
-- │  Public fields: id, username, display_name, avatar_url,         │
-- │                 founding_member, account_state, created_at.     │
-- │  Private field: email (plus updated_at — low-signal, keep       │
-- │  server-side).                                                  │
-- │                                                                 │
-- │  Authenticated role keeps full SELECT — self-access needs       │
-- │  email visible through the `users_self_update`-gated paths.     │
-- └─────────────────────────────────────────────────────────────────┘

REVOKE SELECT ON users FROM anon;

GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  founding_member,
  account_state,
  created_at
) ON users TO anon;

-- Authenticated role must be able to read its own row in full.
-- The existing users_self_update + users_auth_read policies gate row
-- visibility; column grants keep private fields reachable for SELF.
GRANT SELECT ON users TO authenticated;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §C  users_public view — canonical public surface               │
-- │                                                                 │
-- │  Clients that want to list or look up users by username go      │
-- │  through this view.  It projects only public columns and        │
-- │  inherits RLS from the underlying `users` table (SECURITY       │
-- │  INVOKER is the Postgres default for views).                    │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW users_public AS
  SELECT
    id,
    username,
    display_name,
    avatar_url,
    founding_member,
    account_state,
    created_at
  FROM users;

GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO authenticated;

COMMENT ON VIEW users_public IS
  'Public-fields-only projection of users. Anon clients should query this view rather than users directly. Column-level grants on users also restrict anon to these fields at the privilege layer, so direct anon SELECT email FROM users errors with permission_denied.';


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §D  Gaps filled on tables already covered by v1                │
-- │                                                                 │
-- │  The v1 migration established read-only policies on some tables │
-- │  where the spec now wants participant-write coverage.  Writes   │
-- │  remain service-role for state-machine tables (see §D top-level │
-- │  note).  The additions below are write-paths that are safely    │
-- │  participant-bound (no state-machine invariants).               │
-- └─────────────────────────────────────────────────────────────────┘

-- §D.1  companies — admin members may update; any active member reads.
--       The v1 `companies_member_read` policy is kept. We add UPDATE
--       for members with role='admin'. INSERT/DELETE remain service-
--       role only (company creation is a vetted flow).

DROP POLICY IF EXISTS companies_admin_update ON companies;
CREATE POLICY companies_admin_update ON companies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ));

-- §D.2  company_memberships — kept read-only under v1. Admin writes
--       stay service-role (invite + role-change flows are sensitive
--       and need server-side validation of eligibility + audit).

-- §D.3  transactions — v1 covers buyer_user_id read. Add company-context
--       read for active company members when the transaction was
--       placed on behalf of a company (buyer_company_id is set).

DROP POLICY IF EXISTS transactions_company_member_read ON transactions;
CREATE POLICY transactions_company_member_read ON transactions
  FOR SELECT TO authenticated
  USING (
    buyer_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = transactions.buyer_company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §E  Tables NOT covered by v1 — add policies per spec           │
-- └─────────────────────────────────────────────────────────────────┘

-- §E.1  transaction_line_items — reads mirror parent transaction.

DROP POLICY IF EXISTS line_items_participant_read ON transaction_line_items;
CREATE POLICY line_items_participant_read ON transaction_line_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_line_items.transaction_id
      AND (
        t.buyer_user_id = auth.uid()
        OR (
          t.buyer_company_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = t.buyer_company_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
      )
  ));

-- Creators also see the line items that will pay them.
DROP POLICY IF EXISTS line_items_creator_read ON transaction_line_items;
CREATE POLICY line_items_creator_read ON transaction_line_items
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

-- §E.2  certified_packages + items + artifacts — owner + buyer read.
--       TODO (product decision): staff reviewer access. Deferred.

-- Certified packages sit on transactions. The buyer of the
-- originating transaction can read its package. Creators in the
-- package read their line-item-derived artifacts via line-item
-- policy above. Cross-entity reads stay service-role.

DROP POLICY IF EXISTS certified_packages_buyer_read ON certified_packages;
CREATE POLICY certified_packages_buyer_read ON certified_packages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = certified_packages.transaction_id
      AND (
        t.buyer_user_id = auth.uid()
        OR (
          t.buyer_company_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = t.buyer_company_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
      )
  ));

DROP POLICY IF EXISTS certified_package_items_buyer_read ON certified_package_items;
CREATE POLICY certified_package_items_buyer_read ON certified_package_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM certified_packages cp
    JOIN transactions t ON t.id = cp.transaction_id
    WHERE cp.id = certified_package_items.package_id
      AND (
        t.buyer_user_id = auth.uid()
        OR (
          t.buyer_company_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = t.buyer_company_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
      )
  ));

DROP POLICY IF EXISTS certified_package_artifacts_buyer_read ON certified_package_artifacts;
CREATE POLICY certified_package_artifacts_buyer_read ON certified_package_artifacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM certified_packages cp
    JOIN transactions t ON t.id = cp.transaction_id
    WHERE cp.id = certified_package_artifacts.package_id
      AND (
        t.buyer_user_id = auth.uid()
        OR (
          t.buyer_company_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = t.buyer_company_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
      )
  ));

-- §E.3  Assignment engine — participant READS on all nested tables.
--       Writes are service-role only (state machine lives in
--       /api/assignment/*; direct UPDATE bypasses invariants).

DROP POLICY IF EXISTS assignment_rights_records_participant_read ON assignment_rights_records;
CREATE POLICY assignment_rights_records_participant_read ON assignment_rights_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = assignment_rights_records.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS escrow_records_participant_read ON escrow_records;
CREATE POLICY escrow_records_participant_read ON escrow_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = escrow_records.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS milestones_participant_read ON milestones;
CREATE POLICY milestones_participant_read ON milestones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = milestones.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS fulfilment_submissions_participant_read ON fulfilment_submissions;
CREATE POLICY fulfilment_submissions_participant_read ON fulfilment_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM milestones m
    JOIN assignments a ON a.id = m.assignment_id
    WHERE m.id = fulfilment_submissions.milestone_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS evidence_items_participant_read ON evidence_items;
CREATE POLICY evidence_items_participant_read ON evidence_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fulfilment_submissions fs
    JOIN milestones m ON m.id = fs.milestone_id
    JOIN assignments a ON a.id = m.assignment_id
    WHERE fs.id = evidence_items.fulfilment_submission_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS service_logs_participant_read ON service_logs;
CREATE POLICY service_logs_participant_read ON service_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM evidence_items ei
    JOIN fulfilment_submissions fs ON fs.id = ei.fulfilment_submission_id
    JOIN milestones m ON m.id = fs.milestone_id
    JOIN assignments a ON a.id = m.assignment_id
    WHERE ei.id = service_logs.evidence_item_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS review_records_participant_read ON review_records;
CREATE POLICY review_records_participant_read ON review_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM milestones m
    JOIN assignments a ON a.id = m.assignment_id
    WHERE m.id = review_records.milestone_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS commission_change_requests_participant_read ON commission_change_requests;
CREATE POLICY commission_change_requests_participant_read ON commission_change_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = commission_change_requests.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS ccr_amended_fields_participant_read ON ccr_amended_fields;
CREATE POLICY ccr_amended_fields_participant_read ON ccr_amended_fields
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commission_change_requests ccr
    JOIN assignments a ON a.id = ccr.assignment_id
    WHERE ccr.id = ccr_amended_fields.ccr_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS assignment_dispute_cases_participant_read ON assignment_dispute_cases;
CREATE POLICY assignment_dispute_cases_participant_read ON assignment_dispute_cases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = assignment_dispute_cases.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS assignment_events_participant_read ON assignment_events;
CREATE POLICY assignment_events_participant_read ON assignment_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = assignment_events.assignment_id
      AND (a.buyer_id = auth.uid() OR a.creator_id = auth.uid())
  ));

-- §E.4  Direct offer — participant reads on events + checkout intents.
--       Writes remain service-role; the offer lifecycle is event-
--       sourced via /api/direct-offer/* per DIRECT_OFFER_SPEC.md.

DROP POLICY IF EXISTS direct_offer_events_participant_read ON direct_offer_events;
CREATE POLICY direct_offer_events_participant_read ON direct_offer_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM direct_offer_threads t
    WHERE t.id = direct_offer_events.thread_id
      AND (t.buyer_id = auth.uid() OR t.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS offer_checkout_intents_participant_read ON offer_checkout_intents;
CREATE POLICY offer_checkout_intents_participant_read ON offer_checkout_intents
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR creator_id = auth.uid()
  );


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §F  Explicit deny-all on tables with unresolved product state  │
-- │                                                                 │
-- │  Without explicit policies, RLS is already deny-by-default, but │
-- │  we add named deny-all policies here so future readers see the  │
-- │  intent ("this is known-empty, not forgotten") and so the lint  │
-- │  can assert policy coverage > 0 rows per table.                 │
-- └─────────────────────────────────────────────────────────────────┘

-- §F.1  user_granted_types — granted capabilities are admin-managed.
--       TODO: once an admin console exists, allow SELF read so users
--       can see their own granted types.  Until then, server code
--       reads via service role.

DROP POLICY IF EXISTS user_granted_types_deny_all ON user_granted_types;
CREATE POLICY user_granted_types_deny_all ON user_granted_types
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- §F.2  buyer_company_memberships — role bindings; admin writes,
--       members read through server.  No client path yet.

DROP POLICY IF EXISTS buyer_company_memberships_deny_all ON buyer_company_memberships;
CREATE POLICY buyer_company_memberships_deny_all ON buyer_company_memberships
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- §F.3  external_connections + external_credentials + external_webhook_events
--       — provider credential linkage. External credentials NEVER reach
--       the client under any circumstance (their secret_ref is opaque
--       but still sensitive).  All three tables are service-role only.

DROP POLICY IF EXISTS external_connections_deny_all ON external_connections;
CREATE POLICY external_connections_deny_all ON external_connections
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS external_credentials_deny_all ON external_credentials;
CREATE POLICY external_credentials_deny_all ON external_credentials
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS external_webhook_events_deny_all ON external_webhook_events;
CREATE POLICY external_webhook_events_deny_all ON external_webhook_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- §F.4  watermark_profiles — platform-managed, approval-gated.  Schema
--       has no creator_id; "creator RW own" in the spec is a schema
--       mismatch.  Deny-all client; staff approval flow goes through
--       service role.  TODO: decide whether clients ever need to
--       READ approved profiles (they currently consume derivatives,
--       not recipes — so probably not).

DROP POLICY IF EXISTS watermark_profiles_deny_all ON watermark_profiles;
CREATE POLICY watermark_profiles_deny_all ON watermark_profiles
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);


-- ═══════════════════════════════════════════════════════════════════
-- END OF CCP 2 RLS MIGRATION
--
-- Policies added (new this migration): 22 policies across 21 tables.
-- RLS newly enabled on: 37 tables.
-- Existing v1 policies kept (20260419100000): untouched — this
-- migration only adds, never overrides.
--
-- Not in this migration (per H9/H10/H10a deferral 2026-04-17):
--   - Vercel preview / prod env wiring
--   - Vercel ↔ GitHub connection
--
-- Not in this migration (belongs to later CCPs):
--   - CCP 4 mock-to-real module flips
--   - CCP 8 Supabase Auth provider wiring
--   - Signed-URL delivery hardening
-- ═══════════════════════════════════════════════════════════════════
