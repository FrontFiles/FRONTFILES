-- ════════════════════════════════════════════════════════════════
-- Newsroom Pack State-Machine RPC  (NR-D9a)
--
-- Phase NR-2. Backend-only directive — no UI, no API routes. The
-- function created here is the SOLE AUTHORITATIVE entry point for
-- mutating `newsroom_packs.status` (excluding admin takedown,
-- which is NR-D17/D18 territory).
--
-- ─── What this migration creates ────────────────────────────────
--
--   Function (1):
--     newsroom_pack_transition(
--       p_pack_id,
--       p_target_status,
--       p_caller_user_id,
--       p_override_embargo_cancel
--     ) → jsonb
--
--   - SECURITY DEFINER + SET search_path = public, pg_temp
--     (security hardening; pg_temp prevents temp-schema hijacking
--     of objects referenced inside the function body).
--   - REVOKE ALL ON FUNCTION ... FROM PUBLIC inside this migration
--     (no GRANT to authenticated; service-role-only call posture
--     mirroring NR-D2c-i's signing-key write surface).
--   - Atomic: single transaction inside the function body. All
--     UPDATEs satisfy the existing newsroom_packs CHECK
--     constraints (status_visibility_coherence, published_at_coherence,
--     archived_at_coherence).
--
-- ─── Why a SECURITY DEFINER RPC, not application-layer logic ────
--
--   1. Atomicity. NR-D7a (asset+scan_result) and NR-D8 (recipient
--      INSERT-then-update, embargo cancel + pack detach) both
--      have v1 two-INSERT-atomicity caveats. Pack state
--      transitions touch the pack row + the embargo row + (in
--      future directives) signing/notification queues. Running
--      these in PG inside one transaction is the only way to get
--      true atomicity. v1.1 backlog item "Two-INSERT atomicity"
--      will retrofit NR-D7a/D8 into RPCs of the same shape.
--
--   2. Single source of truth. Downstream directives (NR-D9b UI,
--      NR-D9c lift worker, NR-D11 consumer-side) all call this
--      RPC; no other code path is permitted to write
--      newsroom_packs.status. The transition matrix lives here.
--
--   3. PRD §3.3 verbatim authority. This file enumerates the
--      transition matrix + preconditions + side effects directly
--      from the PRD. Any drift surfaces as an IP at audit time.
--
-- ─── Transitions enabled (NR-D9a scope) ─────────────────────────
--
--   draft       → scheduled
--   draft       → published
--   scheduled   → draft
--   scheduled   → published
--   published   → archived
--   archived    → published
--
--   `(any) → takedown` and `takedown → archived` are admin-side
--   transitions handled by a separate RPC in NR-D17/D18.
--
-- ─── Pre-audit findings (verified during dispatch) ──────────────
--
--   - Latest migration before this: 20260425000006 (newsroom_email_otps).
--   - newsroom_rights_warranties schema-level CHECK already enforces
--     all 3 booleans = true (line 276 of d2a). The per-field check
--     in this RPC is defensive belt-and-suspenders — keeps the
--     RPC's logic readable without forcing reviewers to chase
--     table-level CHECKs.
--   - newsroom_signing_key_status enum has 'active' value.
--   - Pack table CHECKs honoured by every UPDATE branch:
--       status_visibility_coherence (line 316) — visibility is
--         set to a value valid for the target status.
--       published_at_coherence (line 329) — published_at NOT NULL
--         when status='published'; either set on transition or
--         preserved from prior publish.
--       archived_at_coherence (line 334) — archived_at NOT NULL
--         when status='archived'; cleared to NULL when leaving
--         archived.
--
-- ─── Mid-compose refinement (documented for exit report) ────────
--
--   The "every asset scan = 'clean'" precondition uses a LEFT JOIN
--   instead of the directive's INNER JOIN form. Reason: NR-D7a's
--   two-INSERT-atomicity caveat permits orphan asset rows (asset
--   row exists but its scan_result row was never created). An
--   INNER JOIN would silently skip such orphans and let them pass
--   the precondition check. The LEFT JOIN treats `sr.result IS
--   NULL` as not-clean, surfacing the orphan.
--
-- ─── Sequencing ─────────────────────────────────────────────────
--
--   Predecessor: 20260425000006_newsroom_email_otps.sql
--   This migration adds 1 function. No new tables, no new enums,
--   no schema changes to existing tables.
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/
--     20260425000007_newsroom_pack_transition_rpc.DOWN.sql
-- ════════════════════════════════════════════════════════════════

BEGIN;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  newsroom_pack_transition                                    │
-- │                                                              │
-- │  Sole authoritative entry point for newsroom_packs.status    │
-- │  mutations (excluding admin takedown). Returns jsonb so the  │
-- │  TypeScript wrapper (src/lib/newsroom/pack-transition.ts)    │
-- │  can pattern-match on the discriminated `ok` field without   │
-- │  catching exceptions for business-logic failures.            │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION newsroom_pack_transition(
  p_pack_id                  uuid,
  p_target_status            newsroom_pack_status,
  p_caller_user_id           uuid,
  p_override_embargo_cancel  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pack            newsroom_packs%ROWTYPE;
  v_warranty        newsroom_rights_warranties%ROWTYPE;
  v_asset_count     integer;
  v_unclean_count   integer;
  v_signing_active  boolean;
  v_new_visibility  newsroom_pack_visibility;
  v_now             timestamptz := now();
  v_missing         text[]      := ARRAY[]::text[];
BEGIN
  -- Caller-id is captured for any future audit logging. Currently
  -- unused by the function body, but accepting it as a typed param
  -- locks the call signature so D9b/D9c don't have to retro-fit
  -- when admin audit (NR-D17) lights up.
  PERFORM p_caller_user_id;

  -- ── 1. Load + lock the pack row ──
  -- FOR UPDATE serialises concurrent transitions on the same pack.
  -- Other concurrent operations (asset upload, embargo CRUD) take
  -- different locks and don't conflict.
  SELECT * INTO v_pack
    FROM newsroom_packs
   WHERE id = p_pack_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'pack-not-found');
  END IF;

  -- ── 2. Reject illegal source → target combos ──
  IF NOT (
       (v_pack.status = 'draft'      AND p_target_status = 'scheduled')
    OR (v_pack.status = 'draft'      AND p_target_status = 'published')
    OR (v_pack.status = 'scheduled'  AND p_target_status = 'draft')
    OR (v_pack.status = 'scheduled'  AND p_target_status = 'published')
    OR (v_pack.status = 'published'  AND p_target_status = 'archived')
    OR (v_pack.status = 'archived'   AND p_target_status = 'published')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'illegal-transition',
      'from', v_pack.status,
      'to',   p_target_status
    );
  END IF;

  -- ── 3. Per-transition precondition checks (PRD §3.3 publish checklist) ──
  -- The full checklist applies to either "draft → scheduled" or
  -- "draft → published" (commit-from-draft transitions). Other
  -- transitions don't re-validate — once a pack is in `scheduled`,
  -- the editing surface is locked (draft-only guard on every CRUD
  -- route) so the preconditions remain satisfied.
  IF v_pack.status = 'draft' AND p_target_status IN ('scheduled', 'published') THEN
    -- (#1) title + credit_line set
    IF v_pack.title IS NULL OR v_pack.title = '' THEN
      v_missing := v_missing || 'title';
    END IF;
    IF v_pack.credit_line IS NULL OR v_pack.credit_line = '' THEN
      v_missing := v_missing || 'credit_line';
    END IF;
    -- licence_class is enum NOT NULL; a row's existence implies a
    -- valid value. No explicit check.

    -- (#2) ≥ 1 Asset
    SELECT COUNT(*) INTO v_asset_count
      FROM newsroom_assets
     WHERE pack_id = p_pack_id;
    IF v_asset_count = 0 THEN
      v_missing := v_missing || 'no_assets';
    END IF;

    -- (#3) Every image Asset has alt_text non-empty
    PERFORM 1
      FROM newsroom_assets
     WHERE pack_id = p_pack_id
       AND kind = 'image'
       AND (alt_text IS NULL OR alt_text = '');
    IF FOUND THEN
      v_missing := v_missing || 'asset_alt_text_missing';
    END IF;

    -- (#4) Every Asset scan_result = 'clean'
    -- LEFT JOIN form (refinement vs directive's INNER JOIN) catches
    -- orphan assets without a scan_result row — see file header.
    SELECT COUNT(*) INTO v_unclean_count
      FROM newsroom_assets a
      LEFT JOIN newsroom_asset_scan_results sr ON sr.asset_id = a.id
     WHERE a.pack_id = p_pack_id
       AND (sr.result IS NULL OR sr.result <> 'clean');
    IF v_unclean_count > 0 THEN
      v_missing := v_missing || 'asset_scan_pending_or_flagged';
    END IF;

    -- (#5) RightsWarranty confirmed (all 3 booleans true)
    -- Schema-level CHECK on newsroom_rights_warranties already
    -- enforces all 3 = true at row-INSERT time, so the per-field
    -- check below is defensive belt-and-suspenders that also
    -- handles the "no warranty row exists yet" case cleanly.
    SELECT * INTO v_warranty
      FROM newsroom_rights_warranties
     WHERE pack_id = p_pack_id;
    IF NOT FOUND
       OR NOT v_warranty.subject_releases_confirmed
       OR NOT v_warranty.third_party_content_cleared
       OR NOT v_warranty.music_cleared
    THEN
      v_missing := v_missing || 'rights_warranty_missing_or_incomplete';
    END IF;

    -- (#7) Active SigningKey exists
    SELECT EXISTS (
      SELECT 1 FROM newsroom_signing_keys WHERE status = 'active'
    ) INTO v_signing_active;
    IF NOT v_signing_active THEN
      v_missing := v_missing || 'no_active_signing_key';
    END IF;

    -- (#6) Embargo / publish_at coherence — depends on target.
    --   scheduled : either embargo_id or publish_at must be set
    --   published : neither embargo_id nor publish_at may be set
    --               (immediate publish is no-embargo, no-schedule)
    IF p_target_status = 'scheduled'
       AND v_pack.embargo_id IS NULL
       AND v_pack.publish_at IS NULL
    THEN
      v_missing := v_missing || 'scheduled_requires_embargo_or_publish_at';
    END IF;

    IF p_target_status = 'published'
       AND (v_pack.embargo_id IS NOT NULL OR v_pack.publish_at IS NOT NULL)
    THEN
      v_missing := v_missing || 'immediate_publish_disallows_embargo_or_publish_at';
    END IF;

    -- Bail out if any precondition missed.
    -- array_length() returns NULL on empty arrays in PG; the
    -- `> 0` comparison treats NULL as false, which is what we
    -- want (no missed preconditions → don't bail).
    IF array_length(v_missing, 1) > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'preconditions-not-met',
        'missing_preconditions', v_missing
      );
    END IF;
  END IF;

  -- ── 4. scheduled → draft pullback: embargo cancellability ──
  -- PRD §3.3 line 567: "Embargo cancellable when no recipient
  -- has accessed". The override flag exists for the post-launch
  -- admin-override path NR-D9 / NR-D17 may light up.
  IF v_pack.status = 'scheduled'
     AND p_target_status = 'draft'
     AND v_pack.embargo_id IS NOT NULL
  THEN
    PERFORM 1
      FROM newsroom_embargo_recipients
     WHERE embargo_id = v_pack.embargo_id
       AND access_count > 0;
    IF FOUND AND NOT p_override_embargo_cancel THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'embargo-already-accessed',
        'hint', 'Pass p_override_embargo_cancel=true to override.'
      );
    END IF;
  END IF;

  -- ── 5. Apply transition + side effects ──
  -- All UPDATEs run inside this function's transaction. The
  -- newsroom_packs CHECK constraints enforce coherence; if any
  -- branch below would violate one, the function aborts and the
  -- transaction rolls back atomically.

  IF v_pack.status = 'draft' AND p_target_status = 'scheduled' THEN
    IF v_pack.embargo_id IS NOT NULL THEN
      -- Embargo state → 'active' (was 'active' already on
      -- creation; this is idempotent unless a prior cancellation
      -- left it 'cancelled' which the directive's F5 handles by
      -- clearing pack.embargo_id).
      UPDATE newsroom_embargoes
         SET state = 'active'
       WHERE id = v_pack.embargo_id;
      v_new_visibility := 'restricted';
    ELSE
      v_new_visibility := 'private';
    END IF;
    UPDATE newsroom_packs
       SET status      = 'scheduled',
           visibility  = v_new_visibility,
           updated_at  = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'draft' AND p_target_status = 'published' THEN
    UPDATE newsroom_packs
       SET status        = 'published',
           visibility    = 'public',
           published_at  = v_now,
           updated_at    = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'scheduled' AND p_target_status = 'draft' THEN
    IF v_pack.embargo_id IS NOT NULL THEN
      UPDATE newsroom_embargoes
         SET state         = 'cancelled',
             cancelled_at  = v_now
       WHERE id = v_pack.embargo_id;
      UPDATE newsroom_packs
         SET status      = 'draft',
             visibility  = 'private',
             embargo_id  = NULL,
             updated_at  = v_now
       WHERE id = p_pack_id;
    ELSE
      UPDATE newsroom_packs
         SET status      = 'draft',
             visibility  = 'private',
             updated_at  = v_now
       WHERE id = p_pack_id;
    END IF;

  ELSIF v_pack.status = 'scheduled' AND p_target_status = 'published' THEN
    -- Auto-lift (cron worker NR-D9c) or manual early lift.
    -- Side effect: embargo state → 'lifted' if attached.
    IF v_pack.embargo_id IS NOT NULL THEN
      UPDATE newsroom_embargoes
         SET state      = 'lifted',
             lifted_at  = v_now
       WHERE id = v_pack.embargo_id;
    END IF;
    UPDATE newsroom_packs
       SET status        = 'published',
           visibility    = 'public',
           published_at  = COALESCE(v_pack.publish_at, v_now),
           updated_at    = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'published' AND p_target_status = 'archived' THEN
    UPDATE newsroom_packs
       SET status       = 'archived',
           visibility   = 'public',
           archived_at  = v_now,
           updated_at   = v_now
     WHERE id = p_pack_id;

  ELSIF v_pack.status = 'archived' AND p_target_status = 'published' THEN
    -- Restore. published_at preserved from the original publish;
    -- archived_at cleared.
    UPDATE newsroom_packs
       SET status       = 'published',
           visibility   = 'public',
           archived_at  = NULL,
           updated_at   = v_now
     WHERE id = p_pack_id;
  END IF;

  -- ── 6. Re-fetch the post-update pack for the return shape ──
  SELECT * INTO v_pack
    FROM newsroom_packs
   WHERE id = p_pack_id;

  RETURN jsonb_build_object(
    'ok',                true,
    'new_status',        v_pack.status,
    'new_visibility',    v_pack.visibility,
    'new_published_at',  v_pack.published_at,
    'new_archived_at',   v_pack.archived_at
  );
END;
$$;


-- ── Permissions ──
-- Service-role only. No GRANT to authenticated/anon. The TS
-- wrapper (pack-transition.ts) imports the service-role client
-- and is `'server-only'` — UI surfaces never call this RPC
-- directly. Mirrors NR-D2c-i's signing-key write posture.
REVOKE ALL ON FUNCTION newsroom_pack_transition(
  uuid, newsroom_pack_status, uuid, boolean
) FROM PUBLIC;


COMMENT ON FUNCTION newsroom_pack_transition(
  uuid, newsroom_pack_status, uuid, boolean
) IS
  'Sole authoritative entry point for newsroom_packs.status '
  'transitions (excluding admin takedown — separate RPC in '
  'NR-D17/D18). Atomic transactional execution. Application-'
  'layer auth: caller must be admin of the pack''s company; '
  'caller_user_id passed for any future audit logging. '
  'Returns jsonb with ok bool + new_* state on success, or '
  'error_code + missing_preconditions[] on failure. See '
  'PRD §3.3 for the full transition matrix + precondition '
  'checklist + visibility derivation.';


COMMIT;
