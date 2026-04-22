-- ════════════════════════════════════════════════════════════════
-- allow-banned: rename source identifiers appear throughout this
--               header block and the SQL below. Every banned-term
--               occurrence in this file is part of the
--               `certified_*` → `provenance_*` rename mapping
--               permitted by ECONOMIC_FLOW_v1 §9 / §14.1 and
--               directive §M2 exception 1.
-- ════════════════════════════════════════════════════════════════
-- P4 concern 1 — M2: rename the certified_* package family to                  -- allow-banned: rename source identifier
-- provenance_* per ECONOMIC_FLOW_v1 §9 compound-identifier ban +
-- §14.1 "Preserve with banned-term rename at P4".
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M2
-- Spec:      docs/specs/ECONOMIC_FLOW_v1.md §9, §14.1, §17
-- Preflight: supabase/migrations/_preflight/20260421000002_rename_introspection.sql
--
-- Scope (narrow — per directive §M2 "three tables, one column, one
-- enum value, two trigger names" + protect_ready_package() body
-- update):
--   - Table renames (3)
--     certified_packages          → provenance_packages            -- allow-banned: rename source identifier
--     certified_package_items     → provenance_package_items       -- allow-banned: rename source identifier
--     certified_package_artifacts → provenance_package_artifacts   -- allow-banned: rename source identifier
--   - Column rename (1)
--     provenance_package_items.certification_hash_at_issue → provenance_hash_at_issue  -- allow-banned: rename source identifier (column)
--   - Enum value rename (1)
--     package_artifact_type value 'certificate' → 'provenance_record'  -- allow-banned: rename source value
--   - Trigger renames (2)
--     trg_certified_packages_updated_at → trg_provenance_packages_updated_at  -- allow-banned: rename source identifier
--     trg_certified_packages_protect    → trg_provenance_packages_protect     -- allow-banned: rename source identifier
--   - protect_ready_package() body update — error-string hygiene only.
--     Trigger body inspection per P4_PREREQUISITES.md Entry 2 confirms
--     the body contains NO internal table/column refs; only OLD/NEW
--     row refs and error-message strings. CREATE OR REPLACE updates
--     the two RAISE EXCEPTION messages to use "provenance package"
--     wording. Governed-field set and terminal-revoked logic unchanged.
--
-- Depends on M1 (20260421000001_relocate_buyer_company_role.sql).
-- M1 is logically independent of the rename but lands first under
-- the concern 1 sequence (see plan §4.2 M2 "Depends on: M1").
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Table renames ───────────────────────────────────────────────
-- allow-banned: rename source identifier (table name)
ALTER TABLE public.certified_packages          RENAME TO provenance_packages;
-- allow-banned: rename source identifier (table name)
ALTER TABLE public.certified_package_items     RENAME TO provenance_package_items;
-- allow-banned: rename source identifier (table name)
ALTER TABLE public.certified_package_artifacts RENAME TO provenance_package_artifacts;

-- ── Column rename ───────────────────────────────────────────────
-- allow-banned: rename source identifier (column name)
ALTER TABLE public.provenance_package_items
  RENAME COLUMN certification_hash_at_issue TO provenance_hash_at_issue;

-- ── Enum value rename ───────────────────────────────────────────
-- Partial indexes that filter on `package_artifact_type = 'certificate'`  -- allow-banned: rename source value cited in index-safety rationale
-- carry their predicate via enum OID, which does NOT change on RENAME
-- VALUE; those indexes remain valid after this statement.
-- allow-banned: rename source value
ALTER TYPE public.package_artifact_type
  RENAME VALUE 'certificate' TO 'provenance_record';

-- ── Trigger renames ─────────────────────────────────────────────
-- Triggers are attached to the (post-rename) provenance_packages
-- table; ALTER TRIGGER uses the current table identity.
-- allow-banned: rename source identifier (trigger name)
ALTER TRIGGER trg_certified_packages_updated_at ON public.provenance_packages
  RENAME TO trg_provenance_packages_updated_at;

-- allow-banned: rename source identifier (trigger name)
ALTER TRIGGER trg_certified_packages_protect ON public.provenance_packages
  RENAME TO trg_provenance_packages_protect;

-- ── protect_ready_package() body — error-string hygiene ─────────
-- Pre-rename body reviewed at
-- supabase/migrations/20260413230016_transactions_and_certified_packages_v2.sql:483-519  -- allow-banned: cites pre-rename source migration filename
-- per P4_PREREQUISITES.md Entry 2. Body contains NO internal refs
-- to the renamed tables or column; only two RAISE EXCEPTION message
-- strings carried banned-term wording. Governed-field set and
-- terminal-revoked logic preserved verbatim. Error messages updated
-- to spec-canonical "provenance package" wording.
CREATE OR REPLACE FUNCTION public.protect_ready_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Revoked is terminal. No field may change.
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION
      'Cannot modify a revoked provenance package (id=%)',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Ready packages: governed fields are locked.
  -- Allowed: status (→ revoked only at service layer), revoked_at,
  --          version, updated_at.
  IF OLD.status = 'ready' THEN
    IF   NEW.package_number              IS DISTINCT FROM OLD.package_number
      OR NEW.transaction_id              IS DISTINCT FROM OLD.transaction_id
      OR NEW.kind                        IS DISTINCT FROM OLD.kind
      OR NEW.owner_user_id               IS DISTINCT FROM OLD.owner_user_id
      OR NEW.owner_company_id            IS DISTINCT FROM OLD.owner_company_id
      OR NEW.total_buyer_pays_cents      IS DISTINCT FROM OLD.total_buyer_pays_cents
      OR NEW.total_creator_receives_cents IS DISTINCT FROM OLD.total_creator_receives_cents
      OR NEW.total_platform_earns_cents  IS DISTINCT FROM OLD.total_platform_earns_cents
      OR NEW.generated_at                IS DISTINCT FROM OLD.generated_at
      OR NEW.ready_at                    IS DISTINCT FROM OLD.ready_at
    THEN
      RAISE EXCEPTION
        'Cannot modify governed fields on a finalized provenance package (id=%, status=%)',
        OLD.id, OLD.status
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_ready_package() IS
  'Revoked packages: blocks all modifications (terminal state).  Ready packages: locks governed fields; allows status transition, revoked_at, version, updated_at.';

COMMIT;
