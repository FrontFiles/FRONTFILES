-- ════════════════════════════════════════════════════════════════
-- P4 concern 1 — M1: relocate buyer_company_role off the Assignment
-- Engine enum family, so M3's CASCADE drop does not take out the
-- identity-layer membership tables.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M1
-- Spec:      docs/specs/ECONOMIC_FLOW_v1.md §14.1 "Preserve without rename at P4"
-- Prereq:    docs/audits/P4_PREREQUISITES.md Entry 1
--
-- Schema choice.
--   The plan skeleton references `identity.buyer_company_role` as a
--   placeholder for "not the public.* schema the Assignment Engine
--   enums live in." No `identity` schema currently exists on the
--   Supabase dev project (verified via `\dn` pre-draft, 2026-04-21).
--   Per directive §M1, this migration uses a standalone type name
--   `public.identity_buyer_company_role` — the `identity_` prefix
--   is the schema-analogue convention. Same value set, same semantics;
--   M3 drops the now-orphaned `public.buyer_company_role` after both
--   dependent tables have been switched.
--
-- Scope.
--   - CREATE TYPE public.identity_buyer_company_role (3 values, same
--     as public.buyer_company_role).
--   - Drop the one dependent policy that blocks the column retype.
--   - ALTER both membership tables (P4_PREREQ Entry 1 scope).
--   - Recreate the dropped policy against the new type.
--   - Leave public.buyer_company_role in place until M3 drops it
--     (reviewer_role et al. still reference it).
--
-- Dependent policy note.
--   `companies_admin_update` on public.companies references
--   `company_memberships.role = 'admin'` in both USING and
--   WITH CHECK. Postgres blocks ALTER COLUMN TYPE on a column a
--   policy depends on (SQLSTATE 0A000). The policy is dropped,
--   the column retyped, then the policy recreated with the same
--   predicate — the comparison `role = 'admin'` is literal-equal
--   across both enum types (same value set), so the recreation is
--   a no-op at the logic level.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- Create the identity-layer type. Same enum values as the Assignment
-- Engine copy (`admin`, `content_commit_holder`, `editor`), so the
-- USING cast below is a no-op at the value level.
CREATE TYPE public.identity_buyer_company_role AS ENUM (
  'admin',
  'content_commit_holder',
  'editor'
);

-- Drop the policy that pins the column type. Recreated at the bottom
-- of this migration against the relocated type.
DROP POLICY IF EXISTS companies_admin_update ON public.companies;

-- Switch the two identity-layer membership tables off the
-- Assignment Engine enum. USING cast routes through text; the enum
-- values are identical so every existing row round-trips. Dependent
-- indexes (e.g., idx_cm_delivery_check) are auto-rebuilt.
ALTER TABLE public.buyer_company_memberships
  ALTER COLUMN role
    TYPE public.identity_buyer_company_role
    USING role::text::public.identity_buyer_company_role;

ALTER TABLE public.company_memberships
  ALTER COLUMN role
    TYPE public.identity_buyer_company_role
    USING role::text::public.identity_buyer_company_role;

-- Recreate the policy. Logic identical to
-- supabase/migrations/20260420000000_rls_all_tables.sql §D.1
-- (`companies_admin_update`). The literal comparison `cm.role =
-- 'admin'` works under either enum type because both types carry
-- the 'admin' label.
CREATE POLICY companies_admin_update ON public.companies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ));

COMMIT;
