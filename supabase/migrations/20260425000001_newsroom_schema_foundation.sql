-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Newsroom Schema Foundation (NR-D1)
--
-- Persistent substrate for the Newsroom v1 subsystem:
--
--   Enums (6):
--     newsroom_verification_tier
--     newsroom_verification_method
--     newsroom_pack_status
--     newsroom_pack_visibility
--     newsroom_licence_class
--     newsroom_asset_kind
--
--   Tables (4):
--     newsroom_profiles              — 1:1 extension of companies
--     newsroom_verification_records  — append-only verification log
--     newsroom_packs                 — Pack entity
--     newsroom_assets                — Asset inside a Pack
--
--   RLS helper functions (2):
--     is_newsroom_admin(company_id)
--     is_newsroom_editor_or_admin(company_id)
--
--   RLS policies on all four tables.
--   Indexes matching read-path queries in PRD §3.
--   Post-asset FK: newsroom_profiles.logo_asset_id → newsroom_assets(id).
--
-- REFERENCES (NOT MODIFIED):
--   users, companies, company_memberships, buyer_accounts,
--   buyer_company_role, account_state, company_membership_status.
--
-- RELATIONSHIP TO EXISTING IDENTITY LAYER:
--   Newsroom "Organization" = existing companies row + new 1:1
--   newsroom_profiles extension.  Newsroom membership = existing
--   company_memberships row with role IN ('admin', 'editor') AND
--   status = 'active'.  No new membership table.
--
-- GOVERNING DOCS:
--   docs/public-newsroom/PRD.md              (authority)
--   docs/public-newsroom/BUILD_CHARTER.md    (scope + mapping lock)
--   docs/public-newsroom/directives/NR-D1-schema-foundation.md
--
-- DEPENDS ON:
--   Tables:    users (migration 9), companies (migration 15),
--              company_memberships (migration 15)
--   Enums:     buyer_company_role (migration 1)
--   Functions: set_updated_at (migration 14), auth.uid (Supabase)
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/20260425000001_newsroom_schema_foundation.DOWN.sql
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUMS                                                  │
-- │                                                             │
-- │  Six Newsroom-specific enums.  Scoped to this subsystem;    │
-- │  do not extend buyer_company_role or any existing enum.     │
-- │  Kept independently versionable from the commercial /       │
-- │  entitlement value sets.                                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE newsroom_verification_tier AS ENUM (
  'unverified',
  'verified_source',
  'verified_publisher'
);

CREATE TYPE newsroom_verification_method AS ENUM (
  'dns_txt',
  'domain_email',
  'authorized_signatory'
);

CREATE TYPE newsroom_pack_status AS ENUM (
  'draft',
  'scheduled',
  'published',
  'archived',
  'takedown'
);

CREATE TYPE newsroom_pack_visibility AS ENUM (
  'private',
  'restricted',
  'public',
  'tombstone'
);

CREATE TYPE newsroom_licence_class AS ENUM (
  'press_release_verbatim',
  'editorial_use_only',
  'promotional_use',
  'cc_attribution',
  'cc_public_domain'
);

CREATE TYPE newsroom_asset_kind AS ENUM (
  'image',
  'video',
  'audio',
  'document',
  'text'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  newsroom_profiles                                      │
-- │                                                             │
-- │  1:1 extension of companies for orgs set up as Newsroom     │
-- │  distributors.  company_id is the primary key — enforces    │
-- │  the 1:1 relationship without a separate UNIQUE constraint. │
-- │  ON DELETE RESTRICT prevents accidental company deletion    │
-- │  while a Newsroom profile exists.                           │
-- │                                                             │
-- │  logo_asset_id references newsroom_assets(id) via an FK     │
-- │  added in §6 (after newsroom_assets exists, same file,      │
-- │  same migration).                                           │
-- │                                                             │
-- │  suspended_reason is intentionally NOT a column here.       │
-- │  Suspension reasoning lives in newsroom_admin_audit_events  │
-- │  (NR-D2).  This keeps the public-readable row free of admin │
-- │  free-text.                                                 │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_profiles (
  company_id         uuid PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,

  verification_tier  newsroom_verification_tier NOT NULL DEFAULT 'unverified',
  verified_at        timestamptz,

  primary_domain     text NOT NULL,

  logo_asset_id      uuid,  -- FK added in §6 after newsroom_assets exists

  suspended          boolean NOT NULL DEFAULT false,
  suspended_at       timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- FQDN pattern (lowercase, hyphen-permitted labels, ≥2 parts)
  CONSTRAINT newsroom_profiles_domain_format CHECK (
    primary_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),

  -- verified_at coherence with verification_tier
  CONSTRAINT newsroom_profiles_verified_at_coherence CHECK (
    (verification_tier = 'unverified' AND verified_at IS NULL)
    OR
    (verification_tier != 'unverified' AND verified_at IS NOT NULL)
  ),

  -- suspended_at coherence with suspended flag
  CONSTRAINT newsroom_profiles_suspended_at_coherence CHECK (
    (suspended = false AND suspended_at IS NULL)
    OR
    (suspended = true  AND suspended_at IS NOT NULL)
  )
);

COMMENT ON TABLE newsroom_profiles IS
  'Newsroom distributor profile.  1:1 extension of companies — '
  'one row per company set up as a Newsroom distributor.  '
  'Public-readable: verification_tier, primary_domain, suspended.';

COMMENT ON COLUMN newsroom_profiles.logo_asset_id IS
  'Optional reference to a newsroom_assets row used as the '
  'distributor logo.  FK added in §6 (after newsroom_assets '
  'exists).  ON DELETE SET NULL — deleting the asset clears the '
  'pointer without cascading to the profile.';

-- ── Indexes ──

-- Prevents two different verified orgs claiming the same domain.
-- Unverified orgs may collide pre-verification.
CREATE UNIQUE INDEX idx_newsroom_profiles_primary_domain_verified
  ON newsroom_profiles (primary_domain)
  WHERE verification_tier != 'unverified';

-- Tier filter for directory listings of verified orgs.
CREATE INDEX idx_newsroom_profiles_tier
  ON newsroom_profiles (verification_tier)
  WHERE verification_tier != 'unverified';

CREATE TRIGGER trg_newsroom_profiles_updated_at
  BEFORE UPDATE ON newsroom_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  newsroom_verification_records                          │
-- │                                                             │
-- │  Append-only log of verification attempts per (company,     │
-- │  method).  UPDATE allowed only on expires_at for re-        │
-- │  verification cycles (policy enforced at the application    │
-- │  layer; trigger here only maintains updated_at).            │
-- │                                                             │
-- │  ON DELETE CASCADE on company_id — verification records     │
-- │  have no independent meaning once the company is gone, and  │
-- │  they carry no financial or legal-receipt semantics         │
-- │  (unlike DownloadReceipts, which are ON DELETE RESTRICT).   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_verification_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  method         newsroom_verification_method NOT NULL,
  value_checked  text NOT NULL,
  verified_at    timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE newsroom_verification_records IS
  'Append-only log of verification attempts per (company, method).  '
  'UPDATE permitted only on expires_at (re-verification cycles); '
  'append-only semantics enforced at the application layer — '
  'the DB retains all historical rows.';

-- ── Indexes ──

CREATE INDEX idx_newsroom_vr_company
  ON newsroom_verification_records (company_id);

-- Active verification records per (company, method), ordered by
-- expires_at.  The verification-tier resolver filters on time at
-- query time (WHERE expires_at IS NULL OR expires_at > now()) and
-- uses this composite index via index-range scan.
--
-- Divergence from NR-D1 directive §D3: the directive spec'd this
-- as a partial index WHERE expires_at IS NULL OR expires_at > now(),
-- but PostgreSQL rejects non-IMMUTABLE functions in index
-- predicates (SQLSTATE 42P17 — "functions in index predicate must
-- be marked IMMUTABLE"; now() is STABLE).  A three-column
-- composite preserves the access pattern without the invalid
-- predicate.  See exit report §2.
CREATE INDEX idx_newsroom_vr_active
  ON newsroom_verification_records (company_id, method, expires_at);

CREATE TRIGGER trg_newsroom_vr_updated_at
  BEFORE UPDATE ON newsroom_verification_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  newsroom_packs                                         │
-- │                                                             │
-- │  One row per Pack.  embargo_id and rights_warranty_id are   │
-- │  plain uuid columns in NR-D1 — the target tables            │
-- │  (newsroom_embargoes, newsroom_rights_warranties) land in   │
-- │  NR-D2, which will add the FK constraints as NOT VALID and  │
-- │  then VALIDATE them (non-blocking for concurrent writes —   │
-- │  pattern from migration 20260413230015 §4).                 │
-- │                                                             │
-- │  licence_class and credit_line immutability after first     │
-- │  publish is enforced in the state-transition RPC in NR-D9,  │
-- │  NOT in the schema.                                         │
-- │                                                             │
-- │  canonical_url is NOT stored — it is computed in TypeScript │
-- │  as https://newsroom.frontfiles.com/{org-slug}/{pack-slug}. │
-- │  Avoids trigger / generated-column complexity and keeps     │
-- │  slug-in-URL derivation authoritative at one layer.         │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_packs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  slug                  text NOT NULL,
  title                 text NOT NULL,
  subtitle              text,
  description           text NOT NULL DEFAULT '',
  credit_line           text NOT NULL,
  licence_class         newsroom_licence_class NOT NULL,

  publish_at            timestamptz,
  embargo_id            uuid,                 -- FK added in NR-D2
  rights_warranty_id    uuid,                 -- FK added in NR-D2

  status                newsroom_pack_status     NOT NULL DEFAULT 'draft',
  visibility            newsroom_pack_visibility NOT NULL DEFAULT 'private',

  published_at          timestamptz,
  archived_at           timestamptz,
  takedown_at           timestamptz,
  takedown_reason       text,

  c2pa_signing_enabled  boolean NOT NULL DEFAULT false,

  created_by_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Slug unique within organization (shared URL namespace)
  CONSTRAINT newsroom_packs_slug_unique UNIQUE (company_id, slug),

  -- Slug format: lowercase alphanumeric + hyphens, 1–60 chars,
  -- no leading / trailing / doubled hyphens (single-segment rule
  -- used by companies.slug as well).
  CONSTRAINT newsroom_packs_slug_format CHECK (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'
  ),

  -- Status × visibility coherence (PRD §3.3 matrix).
  -- NR-D2 will refine this CHECK to honour embargo presence for
  -- the (scheduled, restricted) pair.
  CONSTRAINT newsroom_packs_status_visibility_coherence CHECK (
    (status = 'draft'     AND visibility = 'private')
    OR
    (status = 'scheduled' AND visibility IN ('private', 'restricted'))
    OR
    (status = 'published' AND visibility = 'public')
    OR
    (status = 'archived'  AND visibility = 'public')
    OR
    (status = 'takedown'  AND visibility = 'tombstone')
  ),

  -- Terminal-state timestamp coherence
  CONSTRAINT newsroom_packs_published_at_coherence CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR status != 'published'
  ),

  CONSTRAINT newsroom_packs_archived_at_coherence CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR status != 'archived'
  ),

  CONSTRAINT newsroom_packs_takedown_coherence CHECK (
    (status = 'takedown'
      AND takedown_at     IS NOT NULL
      AND takedown_reason IS NOT NULL)
    OR status != 'takedown'
  ),

  -- Scheduled status requires a publish_at timestamp
  CONSTRAINT newsroom_packs_scheduled_needs_schedule CHECK (
    status != 'scheduled' OR publish_at IS NOT NULL
  )
);

COMMENT ON TABLE newsroom_packs IS
  'Pack entity — the primary unit of Newsroom distribution.  '
  'Status × visibility coherence enforced via CHECK; fuller '
  'embargo-aware refinement lands in NR-D2.  State transitions '
  'in NR-D9 RPCs maintain the immutability invariants for '
  'licence_class and credit_line after first publish.';

COMMENT ON COLUMN newsroom_packs.embargo_id IS
  'Plain uuid in NR-D1.  FK to newsroom_embargoes(id) added in '
  'NR-D2 as NOT VALID + VALIDATE CONSTRAINT.';

COMMENT ON COLUMN newsroom_packs.rights_warranty_id IS
  'Plain uuid in NR-D1.  FK to newsroom_rights_warranties(id) '
  'added in NR-D2 as NOT VALID + VALIDATE CONSTRAINT.';

-- ── Indexes ──

-- Org dashboard: list packs by status
CREATE INDEX idx_newsroom_packs_company_status
  ON newsroom_packs (company_id, status);

-- Public directory / newsroom landing: recent publications
CREATE INDEX idx_newsroom_packs_public_recent
  ON newsroom_packs (published_at DESC)
  WHERE status = 'published' AND visibility = 'public';

-- Scheduler worker: find packs ready to auto-publish
CREATE INDEX idx_newsroom_packs_scheduled_publish_at
  ON newsroom_packs (publish_at)
  WHERE status = 'scheduled';

CREATE TRIGGER trg_newsroom_packs_updated_at
  BEFORE UPDATE ON newsroom_packs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  newsroom_assets                                        │
-- │                                                             │
-- │  One row per Asset inside a Pack.  CASCADE on pack_id —     │
-- │  dropping a Pack drops its assets (pre-publish cleanup).    │
-- │  Business rule preventing deletion from a published Pack    │
-- │  lives in the RPC layer (NR-D9).                            │
-- │                                                             │
-- │  Dimensional CHECK constraints enforce metadata hygiene:    │
-- │    - images require width + height                          │
-- │    - videos require width + height + duration_seconds       │
-- │    - audio  requires duration_seconds                       │
-- │    - documents / text do not require dimensions             │
-- │                                                             │
-- │  alt_text is NULLABLE at the DB level.  The "all image      │
-- │  assets have alt_text" precondition for Pack publish is     │
-- │  enforced at the RPC layer in NR-D9 — an Asset may be       │
-- │  created on upload before the uploader has filled in the    │
-- │  metadata row.                                              │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_assets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id               uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE CASCADE,
  kind                  newsroom_asset_kind NOT NULL,
  mime_type             text NOT NULL,
  original_filename     text NOT NULL,
  storage_url           text NOT NULL,
  file_size_bytes       bigint  NOT NULL CHECK (file_size_bytes > 0),
  width                 integer CHECK (width  IS NULL OR width  > 0),
  height                integer CHECK (height IS NULL OR height > 0),
  duration_seconds      integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  checksum_sha256       text    NOT NULL CHECK (length(checksum_sha256) = 64),
  caption               text,
  alt_text              text,
  is_trademark_asset    boolean NOT NULL DEFAULT false,
  c2pa_manifest_stored  boolean NOT NULL DEFAULT false,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- Image: width + height required
  CONSTRAINT newsroom_assets_image_dims CHECK (
    kind != 'image'
    OR (width IS NOT NULL AND height IS NOT NULL)
  ),

  -- Video: width + height + duration required
  CONSTRAINT newsroom_assets_video_dims_duration CHECK (
    kind != 'video'
    OR (width IS NOT NULL AND height IS NOT NULL AND duration_seconds IS NOT NULL)
  ),

  -- Audio: duration required
  CONSTRAINT newsroom_assets_audio_duration CHECK (
    kind != 'audio' OR duration_seconds IS NOT NULL
  )
);

COMMENT ON TABLE newsroom_assets IS
  'Pack asset — image / video / audio / document / text.  '
  'alt_text nullable at DB level; the "images require alt_text" '
  'rule is a publish-time precondition enforced in the NR-D9 '
  'Pack state-transition RPC.  CASCADE on pack_id.';

-- ── Indexes ──

CREATE INDEX idx_newsroom_assets_pack
  ON newsroom_assets (pack_id);

-- Duplicate-detection: find assets by content hash
CREATE INDEX idx_newsroom_assets_checksum
  ON newsroom_assets (checksum_sha256);

CREATE TRIGGER trg_newsroom_assets_updated_at
  BEFORE UPDATE ON newsroom_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  POST-ASSET FK on newsroom_profiles.logo_asset_id       │
-- │                                                             │
-- │  newsroom_profiles is defined before newsroom_assets        │
-- │  because newsroom_packs references companies (which         │
-- │  newsroom_profiles extends), whereas newsroom_assets        │
-- │  references newsroom_packs.  The logo FK from profiles to   │
-- │  assets is therefore added here — same file, same           │
-- │  migration, same transaction.                               │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_profiles
  ADD CONSTRAINT fk_newsroom_profiles_logo_asset
  FOREIGN KEY (logo_asset_id)
  REFERENCES newsroom_assets(id)
  ON DELETE SET NULL;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  RLS HELPER FUNCTIONS                                   │
-- │                                                             │
-- │  Two SECURITY DEFINER helpers referenced by the policies    │
-- │  in §8.  STABLE because the query result is stable within   │
-- │  a statement.  search_path pinned to public — required for  │
-- │  SECURITY DEFINER helpers that read a fixed set of tables.  │
-- │                                                             │
-- │  Role values come from buyer_company_role (reused, not      │
-- │  extended): 'admin', 'content_commit_holder', 'editor'.     │
-- │  Newsroom maps admin → org admin, editor → org editor.      │
-- │  content_commit_holder is not a Newsroom write role — it    │
-- │  governs commercial commitments on buyer_accounts only.     │
-- │                                                             │
-- │  Granting EXECUTE to authenticated is sufficient; anon does │
-- │  not need these helpers because anonymous reads go through  │
-- │  the public-read policies directly.                         │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION is_newsroom_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_memberships
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND role       = 'admin'
      AND status     = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_newsroom_editor_or_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_memberships
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND role       IN ('admin', 'editor')
      AND status     = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION is_newsroom_admin(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION is_newsroom_editor_or_admin(uuid) TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §8  RLS POLICIES                                           │
-- │                                                             │
-- │  Enable RLS on every table, then attach policies per the    │
-- │  posture documented in PRD §3 and directive §D9.            │
-- │                                                             │
-- │  - Profiles are public-readable (verified orgs are meant    │
-- │    to be discoverable on the public directory).             │
-- │  - Verification records are admin-only reads (Frontfiles    │
-- │    admins read via service_role).                           │
-- │  - Packs are public-readable when status is published /     │
-- │    archived / takedown (for tombstone rendering); drafts    │
-- │    and scheduled are visible only to editors / admins of    │
-- │    the org.  Restricted-visibility (embargoed-scheduled)    │
-- │    packs are NOT reachable via direct SELECT by anon —      │
-- │    the pre-lift preview page uses a token-gated API route   │
-- │    at the application layer (NR-D12).                       │
-- │  - Assets follow their Pack's read posture, except          │
-- │    takedown: takedown-pack assets are NOT readable.         │
-- │                                                             │
-- │  service_role bypasses RLS by default (Supabase convention) │
-- │  and is what server-side workers, the scheduler, and admin  │
-- │  flows use for the operations not permitted here.           │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_packs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_assets               ENABLE ROW LEVEL SECURITY;

-- ── newsroom_profiles ──

CREATE POLICY newsroom_profiles_select_public
  ON newsroom_profiles
  FOR SELECT
  USING (true);

CREATE POLICY newsroom_profiles_insert_admin
  ON newsroom_profiles
  FOR INSERT
  WITH CHECK (is_newsroom_admin(company_id));

CREATE POLICY newsroom_profiles_update_admin
  ON newsroom_profiles
  FOR UPDATE
  USING (is_newsroom_admin(company_id))
  WITH CHECK (is_newsroom_admin(company_id));

-- DELETE not granted to authenticated; service_role only.

-- ── newsroom_verification_records ──

CREATE POLICY newsroom_vr_select_admin
  ON newsroom_verification_records
  FOR SELECT
  USING (is_newsroom_admin(company_id));

-- INSERT / UPDATE / DELETE: service_role only.  Verification
-- flows are server-side workers, not direct client mutations.

-- ── newsroom_packs ──

CREATE POLICY newsroom_packs_select_public
  ON newsroom_packs
  FOR SELECT
  USING (
    (status = 'published' AND visibility = 'public')
    OR status = 'archived'
    OR status = 'takedown'
    OR is_newsroom_editor_or_admin(company_id)
  );

CREATE POLICY newsroom_packs_insert_editor
  ON newsroom_packs
  FOR INSERT
  WITH CHECK (is_newsroom_editor_or_admin(company_id));

CREATE POLICY newsroom_packs_update_editor
  ON newsroom_packs
  FOR UPDATE
  USING (is_newsroom_editor_or_admin(company_id))
  WITH CHECK (is_newsroom_editor_or_admin(company_id));

-- DELETE not granted to authenticated; service_role only.

-- ── newsroom_assets ──

CREATE POLICY newsroom_assets_select
  ON newsroom_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_assets.pack_id
        AND (
          (p.status = 'published' AND p.visibility = 'public')
          OR (p.status = 'archived' AND p.visibility = 'public')
          OR is_newsroom_editor_or_admin(p.company_id)
        )
    )
  );

CREATE POLICY newsroom_assets_insert
  ON newsroom_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_assets.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

CREATE POLICY newsroom_assets_update
  ON newsroom_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_assets.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_assets.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

CREATE POLICY newsroom_assets_delete
  ON newsroom_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_assets.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- DELETE is grantable on assets because an uploader needs to
-- remove an asset from a draft pack.  Business invariants
-- (can't delete from a published pack without a correction
-- workflow) are enforced at the RPC layer in NR-D9.
