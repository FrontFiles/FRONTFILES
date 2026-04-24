-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Newsroom Schema Extensions, Part A (NR-D2a)
--
-- Publish-precondition substrate for the Newsroom v1 subsystem:
--
--   Enums (3):
--     newsroom_scan_result
--     newsroom_rendition_kind
--     newsroom_rendition_format
--
--   Tables (4):
--     newsroom_asset_scan_results   — 1:1 with newsroom_assets
--     newsroom_asset_renditions     — N per asset, by (kind, format)
--     newsroom_rights_warranties    — 1:1 with newsroom_packs
--     newsroom_corrections          — N per pack, append-only
--
--   Deferred FK validation:
--     newsroom_packs.rights_warranty_id →
--       newsroom_rights_warranties(id)  ON DELETE SET NULL
--     (NOT VALID + VALIDATE CONSTRAINT pattern from migration
--      20260413230015 §4.)
--
--   RLS policies on all four new tables (6 total):
--     scan_results: 1 SELECT
--     renditions:   1 SELECT
--     rights_warr:  1 SELECT + 1 INSERT
--     corrections:  1 SELECT + 1 INSERT
--   INSERT/UPDATE/DELETE not granted to authenticated where not
--   listed = service_role only (Supabase bypasses RLS by default
--   for service_role).
--
-- REFERENCES (NOT MODIFIED, except for the single ALTER below):
--   users, companies, newsroom_packs, newsroom_assets,
--   set_updated_at(), is_newsroom_admin(uuid),
--   is_newsroom_editor_or_admin(uuid).
--
-- THE ONLY MUTATION TO AN EXISTING OBJECT:
--   §6 ALTER TABLE newsroom_packs ADD CONSTRAINT
--   fk_newsroom_packs_rights_warranty (NOT VALID then VALIDATE).
--   The rights_warranty_id column itself was created by NR-D1.
--
-- GOVERNING DOCS:
--   docs/public-newsroom/PRD.md                       (authority)
--   docs/public-newsroom/BUILD_CHARTER.md             (scope + mapping lock)
--   docs/public-newsroom/DIRECTIVE_SEQUENCE.md        (place in sequence)
--   docs/public-newsroom/directives/NR-D2a-asset-pack-extensions.md
--
-- DEPENDS ON:
--   Migration 20260425000001 (NR-D1 — newsroom_packs, newsroom_assets,
--                             helper functions, set_updated_at).
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/20260425000002_newsroom_schema_d2a.DOWN.sql
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUMS                                                  │
-- │                                                             │
-- │  Three Newsroom-specific workflow primitives.  Scoped to    │
-- │  this subsystem; do not extend any existing enum.  Kept     │
-- │  independently versionable from NR-D1's six enums and from  │
-- │  the commercial / entitlement value sets.                   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE newsroom_scan_result AS ENUM (
  'pending',
  'clean',
  'flagged',
  'error'
);

CREATE TYPE newsroom_rendition_kind AS ENUM (
  'thumbnail',
  'web',
  'print',
  'social'
);

CREATE TYPE newsroom_rendition_format AS ENUM (
  'jpeg',
  'webp',
  'png',
  'mp4',
  'gif'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  newsroom_asset_scan_results                            │
-- │                                                             │
-- │  1:1 with newsroom_assets — exactly one scan-result row     │
-- │  per Asset.  Uniqueness enforced by column-level UNIQUE on  │
-- │  asset_id (no separate index needed).                       │
-- │                                                             │
-- │  scanned_at is NULL while result='pending' and NOT NULL     │
-- │  once a verdict has been written.  CHECKs are named so      │
-- │  Postgres' default error message is self-describing for     │
-- │  the scan pipeline and the admin queue.                     │
-- │                                                             │
-- │  flagged_categories is text[] (not an enum) because the     │
-- │  scanner suite is the source of truth for category labels   │
-- │  and may evolve without schema migrations.  The CHECK only  │
-- │  asserts non-emptiness when result='flagged'.               │
-- │                                                             │
-- │  ON DELETE CASCADE on asset_id — scan results have no       │
-- │  meaning once the asset is gone.                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_asset_scan_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_id            uuid NOT NULL UNIQUE
                        REFERENCES newsroom_assets(id) ON DELETE CASCADE,

  scanner_suite       text NOT NULL,
  scanner_version     text NOT NULL,

  result              newsroom_scan_result NOT NULL DEFAULT 'pending',
  flagged_categories  text[] NOT NULL DEFAULT '{}',
  scanned_at          timestamptz,
  last_error          text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- pending ⇔ scanned_at IS NULL.
  CONSTRAINT newsroom_scan_pending_coherence CHECK (
    (result =  'pending' AND scanned_at IS NULL)
    OR
    (result <> 'pending' AND scanned_at IS NOT NULL)
  ),

  -- error ⇒ last_error populated (so the queue tells operators why).
  CONSTRAINT newsroom_scan_error_has_message CHECK (
    result <> 'error' OR last_error IS NOT NULL
  ),

  -- flagged ⇒ at least one category (otherwise "flagged" is meaningless).
  CONSTRAINT newsroom_scan_flagged_has_category CHECK (
    result <> 'flagged' OR array_length(flagged_categories, 1) >= 1
  )
);

COMMENT ON TABLE newsroom_asset_scan_results IS
  '1:1 scan-result row per newsroom_asset.  Result lifecycle: '
  'pending → clean | flagged | error.  Re-scans overwrite via '
  'service_role; no append history.  Admin queue reads via '
  'service_role; editors read their org''s scan status only.';

-- ── Indexes ──

-- Admin scan-flag queue read path (PRD §17 admin queue).
-- Predicate is a pure enum membership test → IMMUTABLE → safe in
-- partial-index predicates per NR-D1 exit report §2 lesson.
CREATE INDEX idx_newsroom_scan_attention
  ON newsroom_asset_scan_results (result)
  WHERE result IN ('flagged', 'error');

CREATE TRIGGER trg_newsroom_scan_results_updated_at
  BEFORE UPDATE ON newsroom_asset_scan_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  newsroom_asset_renditions                              │
-- │                                                             │
-- │  N rows per Asset.  Grain is (asset, kind, format) so an    │
-- │  Asset may have a "web" kind in both webp and jpeg, and     │
-- │  separate thumbnail / print / social kinds.  The triple-    │
-- │  column UNIQUE prevents duplicate generations and lets the  │
-- │  NR-D7c rendition pipeline UPSERT cleanly.                  │
-- │                                                             │
-- │  Dimensional CHECKs (width > 0, height > 0,                 │
-- │  file_size_bytes > 0) catch malformed pipeline output at    │
-- │  insert time rather than at render time.                    │
-- │                                                             │
-- │  ON DELETE CASCADE on asset_id — renditions die with the    │
-- │  asset.                                                     │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_asset_renditions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_id         uuid NOT NULL
                     REFERENCES newsroom_assets(id) ON DELETE CASCADE,

  kind             newsroom_rendition_kind   NOT NULL,
  storage_url      text                      NOT NULL,
  width            integer                   NOT NULL CHECK (width  > 0),
  height           integer                   NOT NULL CHECK (height > 0),
  format           newsroom_rendition_format NOT NULL,
  file_size_bytes  bigint                    NOT NULL CHECK (file_size_bytes > 0),
  generated_at     timestamptz               NOT NULL DEFAULT now(),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- One rendition per (asset, kind, format).
  CONSTRAINT newsroom_renditions_asset_kind_format_unique
    UNIQUE (asset_id, kind, format)
);

COMMENT ON TABLE newsroom_asset_renditions IS
  'Generated rendition of a newsroom_asset.  Grain = '
  '(asset_id, kind, format).  Pipeline-managed via service_role; '
  'distributors do not hand-author renditions.  Visibility '
  'inherits from the parent Pack.';

-- ── Indexes ──

-- Read path: "give me all renditions for this asset" (Pack page,
-- API).  The (asset_id, kind, format) UNIQUE index also covers
-- this prefix, but a dedicated single-column index keeps the
-- access pattern explicit and matches NR-D1 newsroom_assets'
-- idx_newsroom_assets_pack convention.
CREATE INDEX idx_newsroom_renditions_asset
  ON newsroom_asset_renditions (asset_id);

CREATE TRIGGER trg_newsroom_renditions_updated_at
  BEFORE UPDATE ON newsroom_asset_renditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  newsroom_rights_warranties                             │
-- │                                                             │
-- │  1:1 with newsroom_packs at publish time.  A row exists if  │
-- │  and only if the distributor has confirmed all three        │
-- │  warranty checkboxes — the all-true CHECK enforces this at  │
-- │  the schema level.                                          │
-- │                                                             │
-- │  RATIONALE for the all-true CHECK: per PRD P9 the UI        │
-- │  presents each checkbox with an "or this pack contains no   │
-- │  ..." clause so the distributor can honestly mark true for  │
-- │  N/A categories.  The DB invariant is therefore: warranty   │
-- │  exists ⇒ all three affirmations given.  A row with any     │
-- │  false value is business-invalid and must not be storable.  │
-- │                                                             │
-- │  Immutability is enforced at RLS (no UPDATE policy in §7);  │
-- │  the trigger below never fires for non-service_role         │
-- │  callers but is retained for table-convention consistency.  │
-- │                                                             │
-- │  ON DELETE RESTRICT on confirmed_by_user_id — the user who  │
-- │  confirmed must remain referencable for the audit trail.    │
-- │  ON DELETE CASCADE on pack_id — warranty has no meaning     │
-- │  without a Pack.                                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_rights_warranties (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id                      uuid NOT NULL UNIQUE
                                 REFERENCES newsroom_packs(id) ON DELETE CASCADE,

  subject_releases_confirmed   boolean NOT NULL,
  third_party_content_cleared  boolean NOT NULL,
  music_cleared                boolean NOT NULL,
  narrative_text               text,

  confirmed_by_user_id         uuid NOT NULL
                                 REFERENCES users(id) ON DELETE RESTRICT,
  confirmed_at                 timestamptz NOT NULL DEFAULT now(),

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Warranty exists ⇒ all three affirmations true (PRD P9).
  CONSTRAINT newsroom_rights_warranty_all_true CHECK (
    subject_releases_confirmed  = true
    AND third_party_content_cleared = true
    AND music_cleared               = true
  )
);

COMMENT ON TABLE newsroom_rights_warranties IS
  '1:1 RightsWarranty per newsroom_pack at publish time.  Row '
  'exists iff distributor confirmed all three warranty '
  'categories (PRD P9).  Immutable post-insert; RLS rejects '
  'UPDATE/DELETE for authenticated callers (service_role only '
  'for emergency correction).';

-- ── Indexes ──

-- Admin audit: "which warranties did this user confirm?"
CREATE INDEX idx_newsroom_rw_confirmed_by
  ON newsroom_rights_warranties (confirmed_by_user_id);

-- Trigger retained for convention symmetry; RLS prevents UPDATE
-- by authenticated callers, so this only fires for service_role.
CREATE TRIGGER trg_newsroom_rw_updated_at
  BEFORE UPDATE ON newsroom_rights_warranties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  newsroom_corrections                                   │
-- │                                                             │
-- │  N rows per Pack — append-only public correction log.       │
-- │  Corrections are issued only on published or archived       │
-- │  Packs (RLS INSERT WITH CHECK below) and remain permanent   │
-- │  (no UPDATE / DELETE for authenticated; service_role only   │
-- │  for emergency admin intervention).                         │
-- │                                                             │
-- │  ON DELETE RESTRICT on issued_by_user_id — the issuing      │
-- │  user must remain referencable for the audit trail.         │
-- │  ON DELETE CASCADE on pack_id — corrections have no         │
-- │  meaning without the Pack they correct.                     │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_corrections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id            uuid NOT NULL
                       REFERENCES newsroom_packs(id) ON DELETE CASCADE,
  correction_text    text NOT NULL CHECK (length(correction_text) > 0),
  issued_at          timestamptz NOT NULL DEFAULT now(),
  issued_by_user_id  uuid NOT NULL
                       REFERENCES users(id) ON DELETE RESTRICT,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE newsroom_corrections IS
  'Append-only correction log per newsroom_pack.  Public + '
  'permanent (PRD §3.2, P12).  Insertable only on '
  'published / archived Packs by an authenticated editor / '
  'admin of the owning org.  Drives "most-recent corrections '
  'first" read path on J4 (public Pack page) and embed '
  'snippet attribution.';

-- ── Indexes ──

-- "Show most-recent corrections first" — J4 public Pack page +
-- embed snippet attribution.
CREATE INDEX idx_newsroom_corrections_pack_recent
  ON newsroom_corrections (pack_id, issued_at DESC);

-- Trigger retained for convention symmetry; RLS prevents UPDATE
-- by authenticated callers, so this only fires for service_role.
CREATE TRIGGER trg_newsroom_corrections_updated_at
  BEFORE UPDATE ON newsroom_corrections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  DEFERRED FK VALIDATION on newsroom_packs               │
-- │                                                             │
-- │  newsroom_packs.rights_warranty_id was created in NR-D1 as  │
-- │  a plain uuid column with a deferred-FK comment.  The FK    │
-- │  target table now exists (§4 above), so we can validate     │
-- │  the constraint.                                            │
-- │                                                             │
-- │  Pattern from migration 20260413230015 §4: ADD CONSTRAINT   │
-- │  ... NOT VALID, then VALIDATE CONSTRAINT.  The two-step is  │
-- │  non-blocking for concurrent reads (NOT VALID acquires only │
-- │  a SHARE ROW EXCLUSIVE briefly; VALIDATE acquires SHARE     │
-- │  UPDATE EXCLUSIVE).  No pre-existing data violates the FK   │
-- │  because no rights_warranty_id values have ever been        │
-- │  written.                                                   │
-- │                                                             │
-- │  ON DELETE SET NULL: a Pack does NOT cease to exist when    │
-- │  its warranty row is deleted (rare, only via service_role   │
-- │  in emergency).  The "rights_warranty_id IS NOT NULL"       │
-- │  publish-precondition check lives at the RPC layer in       │
-- │  NR-D9, not at the FK.                                      │
-- │                                                             │
-- │  The embargo_id FK is NOT added here.  It lands in NR-D2b   │
-- │  when newsroom_embargoes is created.                        │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_packs
  ADD CONSTRAINT fk_newsroom_packs_rights_warranty
  FOREIGN KEY (rights_warranty_id)
  REFERENCES newsroom_rights_warranties(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE newsroom_packs
  VALIDATE CONSTRAINT fk_newsroom_packs_rights_warranty;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  RLS POLICIES                                           │
-- │                                                             │
-- │  Enable RLS on all four new tables, then attach the         │
-- │  policies documented in PRD §3 and directive §D7.  Reuses   │
-- │  the NR-D1 helpers is_newsroom_admin(uuid) and              │
-- │  is_newsroom_editor_or_admin(uuid) — no new helpers.        │
-- │                                                             │
-- │  POSTURE SUMMARY:                                           │
-- │    - Scan results: editor-readable within their org;        │
-- │      service_role only for INSERT / UPDATE / DELETE         │
-- │      (scan pipeline is server-side).                        │
-- │    - Renditions:   public when parent Pack is public;       │
-- │      editor otherwise.  Takedown renditions NOT readable.   │
-- │      service_role only for writes (rendition pipeline is    │
-- │      server-side).                                          │
-- │    - RightsWarranties: editor-readable + editor-insertable  │
-- │      with auth.uid() identity check; never updatable or     │
-- │      deletable by authenticated (immutable per PRD §3.2).   │
-- │    - Corrections: publicly readable wherever the Pack is    │
-- │      publicly readable (excluding takedown — tombstones     │
-- │      render no metadata beyond facts/explanation/receipt    │
-- │      lookup per PRD C2); editor-insertable only on          │
-- │      published / archived Packs with auth.uid() identity    │
-- │      check; never updatable or deletable by authenticated   │
-- │      (permanent per PRD P12).                               │
-- │                                                             │
-- │  service_role bypasses RLS by default (Supabase convention) │
-- │  and is what server-side workers and admin flows use for    │
-- │  the operations not granted to authenticated below.         │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_asset_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_asset_renditions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_rights_warranties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_corrections        ENABLE ROW LEVEL SECURITY;

-- ── newsroom_asset_scan_results ──

-- Editors / admins of the owning Pack's company see scan status
-- of their own assets.  Anon does not see scan results.  Admin
-- console reads via service_role.
CREATE POLICY newsroom_scan_select_editor
  ON newsroom_asset_scan_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_assets a
      JOIN newsroom_packs p ON p.id = a.pack_id
      WHERE a.id = newsroom_asset_scan_results.asset_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (scan pipeline).

-- ── newsroom_asset_renditions ──

-- Inherit visibility from the parent Pack, mirroring the NR-D1
-- newsroom_assets policy.  Takedown renditions NOT readable
-- (the takedown branch from newsroom_assets_select is omitted
-- here, intentionally — renditions are creator-derived content
-- and we suppress them on tombstones).
CREATE POLICY newsroom_renditions_select
  ON newsroom_asset_renditions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_assets a
      JOIN newsroom_packs p ON p.id = a.pack_id
      WHERE a.id = newsroom_asset_renditions.asset_id
        AND (
          (p.status = 'published' AND p.visibility = 'public')
          OR (p.status = 'archived' AND p.visibility = 'public')
          OR is_newsroom_editor_or_admin(p.company_id)
        )
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (rendition pipeline).

-- ── newsroom_rights_warranties ──

-- Editors / admins see their own packs' warranties.  Not
-- exposed to anon — the warranty is a back-office artifact, not
-- a public surface.
CREATE POLICY newsroom_rw_select_editor
  ON newsroom_rights_warranties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_rights_warranties.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- Editor / admin of the Pack's org may insert a warranty, and
-- the confirming user MUST be the authenticated caller (prevents
-- a third party from creating a warranty on behalf of someone
-- else).
CREATE POLICY newsroom_rw_insert_editor
  ON newsroom_rights_warranties
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_rights_warranties.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
    AND confirmed_by_user_id = auth.uid()
  );

-- UPDATE: NO POLICY (immutable per PRD §3.2; service_role only
-- for emergency correction).
-- DELETE: NO POLICY (service_role only).

-- ── newsroom_corrections ──

-- Public wherever the Pack is publicly readable, EXCEPT on
-- takedown.  Per PRD C2 the tombstone renders no pack metadata
-- beyond facts/explanation/receipt lookup; corrections on
-- takedown packs remain in the audit trail but are not RLS-
-- exposed to anon.  Editors / admins additionally see corrections
-- on their org's Packs at any status (drafts, scheduled, etc.)
-- for forward-planning visibility, even though INSERT is gated
-- to published / archived only.
CREATE POLICY newsroom_corrections_select_public
  ON newsroom_corrections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_corrections.pack_id
        AND (
          (p.status = 'published' AND p.visibility = 'public')
          OR p.status = 'archived'
          OR is_newsroom_editor_or_admin(p.company_id)
        )
    )
  );

-- Corrections insertable only on published / archived Packs
-- (not draft / scheduled / takedown), and the issuing user MUST
-- be the authenticated caller.
CREATE POLICY newsroom_corrections_insert_editor
  ON newsroom_corrections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_corrections.pack_id
        AND p.status IN ('published', 'archived')
        AND is_newsroom_editor_or_admin(p.company_id)
    )
    AND issued_by_user_id = auth.uid()
  );

-- UPDATE: NO POLICY (corrections are immutable).
-- DELETE: NO POLICY (corrections are permanent).
