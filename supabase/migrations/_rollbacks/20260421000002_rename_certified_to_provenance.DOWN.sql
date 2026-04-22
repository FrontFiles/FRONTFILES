-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260421000002_rename_certified_to_provenance.sql
--
-- Reverses every rename in M2 in inverse order:
--   1. Restore protect_ready_package() body with pre-rename error
--      strings.
--   2. Rename triggers back.
--   3. Rename enum value back.
--   4. Rename column back.
--   5. Rename three tables back.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M2 rollback
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Restore protect_ready_package() body to pre-rename wording ──
CREATE OR REPLACE FUNCTION public.protect_ready_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Revoked is terminal.  No field may change.
  IF OLD.status = 'revoked' THEN
    -- allow-banned: rollback restores pre-rename error-message wording
    RAISE EXCEPTION
      'Cannot modify a revoked certified package (id=%)',
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
      -- allow-banned: rollback restores pre-rename error-message wording
      RAISE EXCEPTION
        'Cannot modify governed fields on a finalized certified package (id=%, status=%)',
        OLD.id, OLD.status
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_ready_package() IS
  'Revoked packages: blocks all modifications (terminal state).  Ready packages: locks governed fields; allows status transition, revoked_at, version, updated_at.';

-- ── Reverse trigger renames ─────────────────────────────────────
-- Triggers still live on the table whose current name is
-- provenance_packages until the table rename at the end of this DOWN.
-- allow-banned: rollback restores pre-rename trigger name
ALTER TRIGGER trg_provenance_packages_protect ON public.provenance_packages
  RENAME TO trg_certified_packages_protect;

-- allow-banned: rollback restores pre-rename trigger name
ALTER TRIGGER trg_provenance_packages_updated_at ON public.provenance_packages
  RENAME TO trg_certified_packages_updated_at;

-- ── Reverse enum value rename ───────────────────────────────────
-- allow-banned: rollback restores pre-rename enum value
ALTER TYPE public.package_artifact_type
  RENAME VALUE 'provenance_record' TO 'certificate';

-- ── Reverse column rename ───────────────────────────────────────
-- allow-banned: rollback restores pre-rename column name
ALTER TABLE public.provenance_package_items
  RENAME COLUMN provenance_hash_at_issue TO certification_hash_at_issue;

-- ── Reverse table renames ───────────────────────────────────────
-- allow-banned: rollback restores pre-rename table name
ALTER TABLE public.provenance_package_artifacts RENAME TO certified_package_artifacts;
-- allow-banned: rollback restores pre-rename table name
ALTER TABLE public.provenance_package_items     RENAME TO certified_package_items;
-- allow-banned: rollback restores pre-rename table name
ALTER TABLE public.provenance_packages          RENAME TO certified_packages;

COMMIT;
