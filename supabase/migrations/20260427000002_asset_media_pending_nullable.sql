-- ════════════════════════════════════════════════════════════════
-- Migration — PR 3: relax NOT NULL on asset_media.storage_ref and
--                   content_type for pending derivative rows
--
-- Per ARCHITECTURE-BRIEF.md §2 STEP 6, derivative pending rows are
-- inserted with `storage_ref=NULL` (the derivative bytes don't exist
-- yet — the worker generates them on transition to 'ready').
--
-- The original PR 1 substrate migration (20260413230002) declared
-- both columns as NOT NULL because at that time only 'ready' rows
-- existed (uploaded originals). PR 3 introduces the pattern of
-- pending rows that exist BEFORE bytes do, requiring NULL on both.
--
-- The new CHECK constraint preserves the safety invariant: any row
-- with generation_status='ready' MUST have both columns populated.
-- Pending / processing / failed rows may have NULL. The delivery
-- route already filters on generation_status='ready' so it never
-- attempts to serve a NULL storage_ref.
--
-- Audit reference: docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md
-- (correction note in §1 Findings); PR-3-PLAN.md §2.1.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE asset_media ALTER COLUMN storage_ref  DROP NOT NULL;
ALTER TABLE asset_media ALTER COLUMN content_type DROP NOT NULL;

ALTER TABLE asset_media ADD CONSTRAINT asset_media_ready_has_storage
  CHECK (
    generation_status <> 'ready'
    OR (storage_ref IS NOT NULL AND content_type IS NOT NULL)
  );

COMMENT ON CONSTRAINT asset_media_ready_has_storage ON asset_media IS
  'Safety invariant: any row marked ready must have storage_ref + content_type populated. Pending / processing / failed rows may have NULL on these columns. The delivery route only serves ready rows, so the constraint guarantees servable bytes whenever delivery looks them up.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- Removes the CHECK and re-adds NOT NULL. Note: rollback fails if
-- any row exists with NULL storage_ref or content_type (which is
-- exactly what this migration enabled). Operator must DELETE those
-- rows first, or set placeholder values, before rolling back.
--
-- ALTER TABLE asset_media DROP CONSTRAINT IF EXISTS asset_media_ready_has_storage;
-- ALTER TABLE asset_media ALTER COLUMN content_type SET NOT NULL;
-- ALTER TABLE asset_media ALTER COLUMN storage_ref  SET NOT NULL;
