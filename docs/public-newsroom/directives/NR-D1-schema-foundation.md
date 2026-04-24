# NR-D1 — Newsroom Schema Foundation

**Status.** Drafted 2026-04-24 against `main`. First directive of the Newsroom v1 build sequence. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the first Newsroom schema migration and its matching TypeScript row types:

- Six Postgres enums
- Four tables (`newsroom_profiles`, `newsroom_verification_records`, `newsroom_packs`, `newsroom_assets`)
- Two RLS helper functions (`is_newsroom_admin`, `is_newsroom_editor_or_admin`)
- RLS policies on all four tables + column-level grants where required
- Indexes matching read-path queries
- Non-destructive rollback file under `supabase/migrations/_rollbacks/`
- Row types + enum unions in `src/lib/db/schema.ts`

**No** app code. **No** route handlers. **No** pages. **No** components. **No** RPC functions (pack state-transition RPCs land in NR-D9). **No** seed data. **No** modification to existing migrations, existing enums (`buyer_company_role`, `account_state`, `company_membership_status`), or existing tables (`users`, `companies`, `company_memberships`, `buyer_accounts`, any other).

**Relationship to Phase NR-1 full scope.** NR-D1 is one of four dispatchable directives in Phase NR-1. Sequence: **NR-D1 (this directive) → NR-D2 → NR-D3 → NR-D4**. Each directive is dispatched only after the prior directive's exit report clears verdict. NR-D1 is intentionally narrow — one migration, one schema edit, no code paths — so the exit report is verdictable in a single pass.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 3 §3.1 (object roster; see roster table), §3.2 *Schemas* (Organization, VerificationRecord, Pack, Asset — **this directive implements the Organization extension via `newsroom_profiles`, plus the four Newsroom tables except those deferred to NR-D2**), §3.3 (Pack status × visibility matrix — **CHECK constraint in this migration enforces the valid cells**), §3.4 (key invariants — **points 1, 2, 3, 4 relevant; point 2 enforced at RLS**), Part 2 §2.1–§2.4 (licence-class enumeration — **this directive creates `newsroom_licence_class` enum verbatim**).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §4 (primitive reuse mapping — **binding: `companies` + new 1:1 `newsroom_profiles`; `company_memberships` reused with role mapping admin→owner, editor→editor+uploader collapsed**), §5 (Phase NR-1 exit gate NR-G1 — **this directive contributes the schema portion**).
- **`supabase/migrations/20260413230015_companies_and_memberships.sql`** — §2 (`companies` table definition — **FK target for `newsroom_profiles.company_id`, `newsroom_verification_records.company_id`, `newsroom_packs.company_id`**), §3 (`company_memberships` table — **read by RLS helpers**), §4 (deferred-FK-validation pattern — **reference for how NR-D2 will validate FKs added as NOT VALID in this migration**).
- **`supabase/migrations/20260408230009_identity_tables.sql`** — `users` table (FK target for `newsroom_packs.created_by_user_id`); `buyer_company_role` enum (reused via the role mapping in Build Charter §4; not extended).
- **`supabase/migrations/20260421000005_seed_system_actor.sql`** — system sentinel user `00000000-0000-0000-0000-000000000001` (not used in this directive but referenced by NR-D2+).
- **`src/lib/db/schema.ts`** — existing row-type exports (**this directive appends six enum unions and four row interfaces following the existing conventions**).
- **`src/lib/company-roles.ts`** — `DOWNLOAD_ELIGIBLE_ROLES` constant (**not modified; Newsroom role gating uses a separate helper**).
- **`src/lib/env.ts`** — no changes.
- **Reference directive**: `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` — structural template for this directive and for its exit report.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Schema Foundation
       (six enums + four tables + two RLS helpers + RLS policies
       + indexes + TS row types; no app code; no pages; no
       routes; no RPCs; no seed data; no modification to any
       existing migration, enum, or table)

GOVERNING DOCS
  docs/public-newsroom/PRD.md              (authority)
  docs/public-newsroom/BUILD_CHARTER.md    (scope + mapping lock)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md (place in sequence)

SCOPE

You are building the foundation migration for the Newsroom v1
subsystem. This migration creates the persistent substrate
without introducing any application code. Exactly four tables,
six enums, two RLS helper functions, RLS policies, indexes,
and the matching row types in src/lib/db/schema.ts.

The existing Frontfiles schema (users, companies,
company_memberships, buyer_accounts, buyer_company_role enum,
etc.) is REFERENCED BUT NOT MODIFIED.

Newsroom "Organization" = existing companies row + new 1:1
newsroom_profiles extension. Newsroom membership = existing
company_memberships row with role IN ('admin', 'editor') AND
status = 'active'. No new membership table.

Migration filename:
  20260425000001_newsroom_schema_foundation.sql
Rollback filename:
  _rollbacks/20260425000001_newsroom_schema_foundation.DOWN.sql

DELIVERABLES

(F1) supabase/migrations/20260425000001_newsroom_schema_foundation.sql
     — up migration, idempotent within its own scope, organised
     per the sectioned-comment-block convention of migration
     20260413230015.

(F2) supabase/migrations/_rollbacks/20260425000001_newsroom_schema_foundation.DOWN.sql
     — symmetric DOWN migration that removes everything this
     migration creates, in reverse dependency order.

(F3) src/lib/db/schema.ts (EDIT) — append six enum string-literal
     unions and four row interfaces at the end of the file, in
     the style of the existing row types. No other edits.

No other files are touched.

ENUMS (D1)

  newsroom_verification_tier:
    'unverified'
    'verified_source'
    'verified_publisher'

  newsroom_verification_method:
    'dns_txt'
    'domain_email'
    'authorized_signatory'

  newsroom_pack_status:
    'draft'
    'scheduled'
    'published'
    'archived'
    'takedown'

  newsroom_pack_visibility:
    'private'
    'restricted'
    'public'
    'tombstone'

  newsroom_licence_class:
    'press_release_verbatim'
    'editorial_use_only'
    'promotional_use'
    'cc_attribution'
    'cc_public_domain'

  newsroom_asset_kind:
    'image'
    'video'
    'audio'
    'document'
    'text'

TABLE 1 — newsroom_profiles (D2)

  Grain: one row per company that is set up as a Newsroom
  distributor. 1:1 with companies.

  Columns:
    company_id          uuid PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT
    verification_tier   newsroom_verification_tier NOT NULL DEFAULT 'unverified'
    verified_at         timestamptz (nullable)
    primary_domain      text NOT NULL
    logo_asset_id       uuid REFERENCES newsroom_assets(id) ON DELETE SET NULL
                          (FK added AFTER newsroom_assets is created, same migration)
    suspended           boolean NOT NULL DEFAULT false
    suspended_at        timestamptz (nullable)
    created_at          timestamptz NOT NULL DEFAULT now()
    updated_at          timestamptz NOT NULL DEFAULT now()

  Constraints:
    CHECK primary_domain matches FQDN pattern:
      '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'

    CHECK verified_at coherence:
      (verification_tier = 'unverified' AND verified_at IS NULL)
      OR
      (verification_tier != 'unverified' AND verified_at IS NOT NULL)

    CHECK suspended_at coherence:
      (suspended = false AND suspended_at IS NULL)
      OR
      (suspended = true AND suspended_at IS NOT NULL)

  Indexes:
    UNIQUE idx_newsroom_profiles_primary_domain_verified
      ON newsroom_profiles (primary_domain)
      WHERE verification_tier != 'unverified'
      (prevents two different verified orgs claiming the same
      domain; unverified orgs may collide pre-verification)

    idx_newsroom_profiles_tier
      ON newsroom_profiles (verification_tier)
      WHERE verification_tier != 'unverified'

  Trigger:
    BEFORE UPDATE → set_updated_at() (reuse existing function)

  NOTE ON suspended_reason: intentionally NOT a column here.
  Suspension reasoning lives in newsroom_admin_audit_events
  (NR-D2). This keeps the public-readable row free of admin
  free-text.

TABLE 2 — newsroom_verification_records (D3)

  Grain: one row per attempted/completed verification method
  per company. Append-only in semantics; UPDATE allowed only
  on expires_at for re-verification cycles.

  Columns:
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
    company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE
    method            newsroom_verification_method NOT NULL
    value_checked     text NOT NULL
    verified_at       timestamptz NOT NULL DEFAULT now()
    expires_at        timestamptz (nullable)
    created_at        timestamptz NOT NULL DEFAULT now()
    updated_at        timestamptz NOT NULL DEFAULT now()

  Indexes:
    idx_newsroom_vr_company
      ON newsroom_verification_records (company_id)

    idx_newsroom_vr_active
      ON newsroom_verification_records (company_id, method, expires_at)
      -- Corrected from the v1 draft, which used a partial index
      -- with `WHERE expires_at IS NULL OR expires_at > now()`.
      -- Postgres rejects that form: SQLSTATE 42P17 — "functions
      -- in index predicate must be marked IMMUTABLE". `now()`
      -- is STABLE. The three-column composite preserves name
      -- and access pattern (equality on company_id + method;
      -- range/null filter on expires_at at scan time).
      -- Shipped form matches the migration authored by NR-D1;
      -- see NR-D1 exit report §2 for the full rationale.

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 3 — newsroom_packs (D4)

  Grain: one row per Pack.

  Columns:
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
    company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT
    slug                  text NOT NULL
    title                 text NOT NULL
    subtitle              text (nullable)
    description           text NOT NULL DEFAULT ''
    credit_line           text NOT NULL
    licence_class         newsroom_licence_class NOT NULL
    publish_at            timestamptz (nullable)
    embargo_id            uuid (nullable)
                            — FK to newsroom_embargoes added in NR-D2
    rights_warranty_id    uuid (nullable)
                            — FK to newsroom_rights_warranties added in NR-D2
    status                newsroom_pack_status NOT NULL DEFAULT 'draft'
    visibility            newsroom_pack_visibility NOT NULL DEFAULT 'private'
    published_at          timestamptz (nullable)
    archived_at           timestamptz (nullable)
    takedown_at           timestamptz (nullable)
    takedown_reason       text (nullable)
    c2pa_signing_enabled  boolean NOT NULL DEFAULT false
    created_by_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
    created_at            timestamptz NOT NULL DEFAULT now()
    updated_at            timestamptz NOT NULL DEFAULT now()

  Constraints:
    UNIQUE (company_id, slug) — slug unique within org

    CHECK slug format:
      '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'

    CHECK status × visibility coherence (from PRD §3.3 matrix):
      (status = 'draft'     AND visibility = 'private')   OR
      (status = 'scheduled' AND visibility IN ('private','restricted')) OR
      (status = 'published' AND visibility = 'public')    OR
      (status = 'archived'  AND visibility = 'public')    OR
      (status = 'takedown'  AND visibility = 'tombstone')

    CHECK published_at coherence:
      (status = 'published' AND published_at IS NOT NULL)
      OR status != 'published'

    CHECK archived_at coherence:
      (status = 'archived' AND archived_at IS NOT NULL)
      OR status != 'archived'

    CHECK takedown coherence:
      (status = 'takedown' AND takedown_at IS NOT NULL
         AND takedown_reason IS NOT NULL)
      OR status != 'takedown'

    CHECK scheduled requires schedule:
      status != 'scheduled' OR publish_at IS NOT NULL

  Invariant enforced elsewhere (NOT in this migration):
    - licence_class immutable after first published — enforced
      in the state-transition RPC in NR-D9
    - credit_line immutable after first published — same
    - visibility derivation from (status, embargo.state) —
      NR-D2 refines the CHECK to honour embargo presence;
      NR-D9 RPCs maintain invariants

  Indexes:
    idx_newsroom_packs_company_status
      ON newsroom_packs (company_id, status)

    idx_newsroom_packs_public_recent
      ON newsroom_packs (published_at DESC)
      WHERE status = 'published' AND visibility = 'public'

    idx_newsroom_packs_scheduled_publish_at
      ON newsroom_packs (publish_at)
      WHERE status = 'scheduled'

  Trigger:
    BEFORE UPDATE → set_updated_at()

  NOTE ON canonical_url: not stored. Computed in TypeScript as
    `https://newsroom.frontfiles.com/${companies.slug}/${newsroom_packs.slug}`
  This avoids trigger/generated-column complexity and keeps the
  slug-in-URL derivation authoritative at one layer. A helper
  in src/lib/newsroom/ (NR-D4) will expose this computation.

TABLE 4 — newsroom_assets (D5)

  Grain: one row per Asset inside a Pack.

  Columns:
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id                uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE CASCADE
    kind                   newsroom_asset_kind NOT NULL
    mime_type              text NOT NULL
    original_filename      text NOT NULL
    storage_url            text NOT NULL
    file_size_bytes        bigint NOT NULL CHECK (file_size_bytes > 0)
    width                  integer CHECK (width IS NULL OR width > 0)
    height                 integer CHECK (height IS NULL OR height > 0)
    duration_seconds       integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
    checksum_sha256        text NOT NULL CHECK (length(checksum_sha256) = 64)
    caption                text (nullable)
    alt_text               text (nullable)
    is_trademark_asset     boolean NOT NULL DEFAULT false
    c2pa_manifest_stored   boolean NOT NULL DEFAULT false
    created_at             timestamptz NOT NULL DEFAULT now()
    updated_at             timestamptz NOT NULL DEFAULT now()

  Constraints:
    CHECK dimensions present for image:
      kind != 'image'
      OR (width IS NOT NULL AND height IS NOT NULL)

    CHECK dimensions + duration for video:
      kind != 'video'
      OR (width IS NOT NULL AND height IS NOT NULL AND duration_seconds IS NOT NULL)

    CHECK duration for audio:
      kind != 'audio' OR duration_seconds IS NOT NULL

  Alt-text rule (D6): alt_text is NULLABLE at the DB level.
  The "all image assets have alt_text" precondition for Pack
  publish is enforced at the RPC layer in NR-D9, not here.
  Rationale: an Asset may be created on upload before the
  uploader has filled in the metadata row on the editor.

  Indexes:
    idx_newsroom_assets_pack
      ON newsroom_assets (pack_id)

    idx_newsroom_assets_checksum
      ON newsroom_assets (checksum_sha256)

  Trigger:
    BEFORE UPDATE → set_updated_at()

POST-ASSET FK (D7)

After newsroom_assets exists in the migration, add the FK
on newsroom_profiles.logo_asset_id:

  ALTER TABLE newsroom_profiles
    ADD CONSTRAINT fk_newsroom_profiles_logo_asset
    FOREIGN KEY (logo_asset_id)
    REFERENCES newsroom_assets(id)
    ON DELETE SET NULL;

RLS HELPER FUNCTIONS (D8)

Create two SECURITY DEFINER helpers. They live in the public
schema so RLS policies can reference them directly.

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
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
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
        AND user_id = auth.uid()
        AND role IN ('admin', 'editor')
        AND status = 'active'
    );
  $$;

Grant execute to authenticated, anon:

  GRANT EXECUTE ON FUNCTION is_newsroom_admin(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION is_newsroom_editor_or_admin(uuid) TO authenticated;

(anon does not need execute — anon reads go through public-read
policies, not through these helpers.)

RLS POLICIES (D9)

Enable RLS on every table:

  ALTER TABLE newsroom_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_verification_records ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_packs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_assets ENABLE ROW LEVEL SECURITY;

newsroom_profiles policies:

  POLICY newsroom_profiles_select_public
    FOR SELECT
    USING (true)
    -- Newsroom profiles are public; their purpose is to
    -- advertise verified orgs on the public directory.

  POLICY newsroom_profiles_insert_admin
    FOR INSERT
    WITH CHECK (is_newsroom_admin(company_id))

  POLICY newsroom_profiles_update_admin
    FOR UPDATE
    USING (is_newsroom_admin(company_id))
    WITH CHECK (is_newsroom_admin(company_id))

  -- DELETE not granted to authenticated; service_role only.

newsroom_verification_records policies:

  POLICY newsroom_vr_select_admin
    FOR SELECT
    USING (is_newsroom_admin(company_id))
    -- Only company admins see their own verification history.
    -- Frontfiles admins read via service_role.

  -- INSERT/UPDATE/DELETE: service_role only.
  -- (Verification flows are server-side workers, not direct
  -- client mutations.)

newsroom_packs policies:

  POLICY newsroom_packs_select_public
    FOR SELECT
    USING (
      (status = 'published' AND visibility = 'public')
      OR status = 'archived'
      OR status = 'takedown'
      OR is_newsroom_editor_or_admin(company_id)
    )
    -- Public read of published, archived, takedown (for
    -- tombstone rendering). Drafts and scheduled are visible
    -- only to editors/admins of the org. Restricted
    -- (embargoed-scheduled) is NOT reachable via direct
    -- SELECT by anon — the pre-lift preview page uses a
    -- token-gated API route at application layer.

  POLICY newsroom_packs_insert_editor
    FOR INSERT
    WITH CHECK (is_newsroom_editor_or_admin(company_id))

  POLICY newsroom_packs_update_editor
    FOR UPDATE
    USING (is_newsroom_editor_or_admin(company_id))
    WITH CHECK (is_newsroom_editor_or_admin(company_id))

  -- DELETE not granted to authenticated.

newsroom_assets policies:

  POLICY newsroom_assets_select
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
    )
    -- Takedown packs' assets are NOT readable.

  POLICY newsroom_assets_insert
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_assets.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )

  POLICY newsroom_assets_update
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
    )

  POLICY newsroom_assets_delete
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_assets.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- DELETE is grantable here because the uploader needs to
    -- remove an asset from a draft pack. Business invariants
    -- (can't delete from published pack without a correction
    -- workflow) are enforced at the RPC layer in NR-D9.

TS ROW TYPES — src/lib/db/schema.ts (D10)

Append to the end of the file, following the existing section
convention (spacer comment block + types). Do NOT reorder or
modify anything already in the file. Do NOT introduce new
import statements unless strictly required.

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000001)
//
// Schema foundation for the public newsroom distribution
// subsystem. See docs/public-newsroom/PRD.md for canonical
// semantics and docs/public-newsroom/BUILD_CHARTER.md for
// the primitive-reuse mapping.
// ══════════════════════════════════════════════

export type NewsroomVerificationTier =
  | 'unverified'
  | 'verified_source'
  | 'verified_publisher'

export type NewsroomVerificationMethod =
  | 'dns_txt'
  | 'domain_email'
  | 'authorized_signatory'

export type NewsroomPackStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'takedown'

export type NewsroomPackVisibility =
  | 'private'
  | 'restricted'
  | 'public'
  | 'tombstone'

export type NewsroomLicenceClass =
  | 'press_release_verbatim'
  | 'editorial_use_only'
  | 'promotional_use'
  | 'cc_attribution'
  | 'cc_public_domain'

export type NewsroomAssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'text'

export interface NewsroomProfileRow {
  company_id: string
  verification_tier: NewsroomVerificationTier
  verified_at: string | null
  primary_domain: string
  logo_asset_id: string | null
  suspended: boolean
  suspended_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomVerificationRecordRow {
  id: string
  company_id: string
  method: NewsroomVerificationMethod
  value_checked: string
  verified_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomPackRow {
  id: string
  company_id: string
  slug: string
  title: string
  subtitle: string | null
  description: string
  credit_line: string
  licence_class: NewsroomLicenceClass
  publish_at: string | null
  embargo_id: string | null
  rights_warranty_id: string | null
  status: NewsroomPackStatus
  visibility: NewsroomPackVisibility
  published_at: string | null
  archived_at: string | null
  takedown_at: string | null
  takedown_reason: string | null
  c2pa_signing_enabled: boolean
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface NewsroomAssetRow {
  id: string
  pack_id: string
  kind: NewsroomAssetKind
  mime_type: string
  original_filename: string
  storage_url: string
  file_size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  checksum_sha256: string
  caption: string | null
  alt_text: string | null
  is_trademark_asset: boolean
  c2pa_manifest_stored: boolean
  created_at: string
  updated_at: string
}

ROLLBACK (D11)

supabase/migrations/_rollbacks/20260425000001_newsroom_schema_foundation.DOWN.sql

Symmetric DOWN migration. Reverse dependency order:

  1. DROP POLICY (all, on all four tables)
  2. DROP TABLE newsroom_assets CASCADE
     (this also drops the FK on newsroom_profiles.logo_asset_id)
  3. DROP TABLE newsroom_packs CASCADE
  4. DROP TABLE newsroom_verification_records CASCADE
  5. DROP TABLE newsroom_profiles CASCADE
  6. DROP FUNCTION is_newsroom_editor_or_admin(uuid)
  7. DROP FUNCTION is_newsroom_admin(uuid)
  8. DROP TYPE newsroom_asset_kind
  9. DROP TYPE newsroom_licence_class
  10. DROP TYPE newsroom_pack_visibility
  11. DROP TYPE newsroom_pack_status
  12. DROP TYPE newsroom_verification_method
  13. DROP TYPE newsroom_verification_tier

Include a comment block at the top explaining the rollback is
the inverse of the 20260425000001 up migration and does NOT
touch existing tables or enums. If the DOWN is run when there
is data in newsroom_* tables, the CASCADE drops will delete
that data — document this.

OUT OF SCOPE (hard boundaries)

Anything not explicitly in DELIVERABLES above. In particular:

- NO change to any existing migration file.
- NO change to companies, users, company_memberships,
  buyer_accounts, buyer_company_role, or any existing table,
  enum, function, or trigger.
- NO edits to src/lib/types.ts, src/lib/identity/*,
  src/lib/company-roles.ts, or any other existing source file.
- NO additional tables (scan_results, renditions,
  rights_warranties, corrections, embargoes, recipients,
  outlets, events, receipts, signing_keys, claims, audit,
  admin_users, subscriptions) — all of these land in NR-D2.
- NO RPC functions for state transitions (NR-D9).
- NO subdomain middleware, no routing (NR-D3).
- NO domain libraries in src/lib/newsroom/* (NR-D4).
- NO pages, components, route handlers, API endpoints.
- NO seed data.
- NO vitest files. A single migration-applies-clean smoke is
  performed via VERIFY commands; no test file is authored.

If you find you need something outside this list to make the
migration work, STOP and surface the blocker as an exit-report
open question. Do not expand scope silently.

VERIFY

Run these in order from the repo root. Each must pass before
moving to the next.

  # 1. Reset dev database with the new migration
  bun run supabase db reset

  # 2. TypeScript type-check (validates src/lib/db/schema.ts edit)
  bun run typecheck
  # expected: tsc --noEmit exit 0

  # 3. Full build — must still pass with 81 existing routes
  bun run build
  # expected: Next.js build exit 0, route count unchanged

  # 4. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_profiles"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_verification_records"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_packs"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_assets"
  # expected: all four tables present with columns, constraints,
  # indexes, triggers, RLS enabled

  # 5. Enum inspection
  psql "$SUPABASE_DB_URL" -c "\dT+ newsroom_*"
  # expected: six enums present with correct values

  # 6. RLS policy inspection
  psql "$SUPABASE_DB_URL" -c \
    "SELECT polname, polrelid::regclass, polcmd FROM pg_policy
     WHERE polrelid::regclass::text LIKE 'newsroom_%'
     ORDER BY polrelid::regclass, polcmd"
  # expected: policies listed per table, per command

  # 7. Helper function inspection
  psql "$SUPABASE_DB_URL" -c "\df+ is_newsroom_*"
  # expected: both helpers present, SECURITY DEFINER, STABLE,
  # search_path = public

  # 8. Grant inspection (column-level, execute)
  psql "$SUPABASE_DB_URL" -c "\dp newsroom_*"
  psql "$SUPABASE_DB_URL" -c "\df+ is_newsroom_*"
  # expected: authenticated has EXECUTE on helpers

  # 9. Constraint smoke — insert coherence
  psql "$SUPABASE_DB_URL" -c "
    -- should FAIL: verified_at NULL with tier != 'unverified'
    INSERT INTO newsroom_profiles (company_id, verification_tier, primary_domain)
    SELECT id, 'verified_source', 'example.com' FROM companies LIMIT 1;
  "
  # expected: CHECK violation

  # 10. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000001_newsroom_schema_foundation.DOWN.sql
  psql "$SUPABASE_DB_URL" -c "\dt newsroom_*"
  # expected: zero newsroom_* tables
  # then restore:
  bun run supabase db reset

EXIT REPORT

Required sections. Each is a first-class heading in the
exit report you return at the end of the session:

1. Summary — files created/edited with line counts and a
   one-line description of each. Migration size. TS schema
   edit line count.

2. Decisions that diverged — any place the implementation
   deviates from this directive (with rationale). If none,
   state "no divergence".

3. Open questions for founder — anything that surfaced as
   ambiguous. Minimum: flag if you found a reason to extend
   buyer_company_role, add a column to companies, or change
   any other existing file — you should NOT have done any of
   those, but if the requirements pushed toward it, surface
   it here instead of doing it.

4. RLS verification results — the outputs of VERIFY steps 6,
   7, 8, 9 (redact any PII that happens to be in the row data
   you used).

5. Build results — exit codes and route counts for VERIFY
   steps 2, 3.

6. Rollback verification — output of VERIFY step 10.

7. Verdict — self-assessment:
   "approve" / "approve with corrections: ..." / "revise
   before approval: ..." / "reject: ..."

   You are assessing your own work for the founder's verdict
   pass; the founder will review and return their own verdict.
   Be conservative: mark "approve with corrections" if there
   is anything non-trivial the founder will want to adjust.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Enum placement.** All six enums are Newsroom-specific and are created inside this migration (not as extensions to `buyer_company_role` or any other existing enum). This preserves the existing role enum's semantics (it is gating `DOWNLOAD_ELIGIBLE_ROLES` logic) and keeps Newsroom's value sets independently versionable.

**D2 — `newsroom_profiles` as 1:1 extension.** Binding from Build Charter §4. Using `company_id` as the primary key enforces the 1:1 relationship at the schema level without needing a UNIQUE constraint. `ON DELETE RESTRICT` prevents accidental company deletion while a Newsroom profile exists.

**D3 — `newsroom_verification_records` grain and CASCADE.** Grain is one row per method attempt. `ON DELETE CASCADE` on `company_id` is safe because verification records have no independent meaning once the company is gone; they also carry no financial or legal-receipt semantics (unlike DownloadReceipts, which are `ON DELETE RESTRICT`).

**D4 — `newsroom_packs` deferred FKs.** `embargo_id` and `rights_warranty_id` are `uuid` columns without FK constraints in NR-D1. The target tables (`newsroom_embargoes`, `newsroom_rights_warranties`) land in NR-D2. NR-D2 will add the FK constraints as `NOT VALID` and then `VALIDATE CONSTRAINT` in a separate statement — matching the pattern in migration `20260413230015` §4 for `licence_grants.grantee_company_id`. The `NOT VALID` approach is non-blocking for concurrent writes.

**D5 — `newsroom_assets` dimensional constraints.** CHECK constraints enforce that images and videos have width+height and that videos and audio have duration_seconds. This is schema-level enforcement of metadata hygiene. Documents do not require dimensions (first-page thumbnail is a rendition in NR-D2).

**D6 — Alt-text nullability.** The DB allows null `alt_text` because the upload flow creates the Asset row before the per-Asset metadata form is filled. The "all images have alt_text" precondition is a *publish-time* check, enforced in the Pack state-transition RPC in NR-D9. This is a deliberate design choice — failing to carry it through would make the upload flow in NR-D7 impossible to implement without schema-level workarounds.

**D7 — Post-asset FK on profiles.** `newsroom_profiles.logo_asset_id` references `newsroom_assets(id)` with `ON DELETE SET NULL`. Because `newsroom_profiles` is defined before `newsroom_assets` in the migration, the FK is added via `ALTER TABLE` *after* both tables exist. Same file, same transaction, same migration.

**D8 — RLS helpers as `STABLE SECURITY DEFINER`.** `STABLE` because the query result is stable within a statement. `SECURITY DEFINER` with `SET search_path = public` is the Supabase convention for helpers that need to read `company_memberships` regardless of the calling user's RLS permissions. `auth.uid()` resolves inside the helper body. Granting `EXECUTE` to `authenticated` is sufficient; `anon` does not need these helpers because anonymous reads go through the public-read policies directly.

**D9 — Public read posture.** The newsroom is a *public* distribution surface. `newsroom_profiles` rows, published `newsroom_packs`, and their assets are readable by anon. This is the whole point of the product. RLS prevents:

- Authenticated-but-non-member writes on all four tables
- Anon reads of drafts, scheduled packs, verification records, and takedown-pack assets
- Any `DELETE` on `newsroom_profiles`, `newsroom_verification_records`, `newsroom_packs` (service_role only)

Restricted-visibility (embargoed-scheduled) packs are not reachable via direct SELECT because the token-gated preview flow (NR-D12) runs server-side with service_role credentials.

**D10 — TS row types are pure.** `src/lib/db/schema.ts` is edited by appending a new section. No imports, no dependencies, no collateral edits. All types are string-literal unions and flat interfaces — no branded types, no classes. This keeps the edit surface minimal and the diff verdictable.

**D11 — Rollback symmetry.** The DOWN file removes exactly what the UP file creates, in reverse dependency order. It does not touch existing tables, existing enums, or any row in `companies` / `users` / `company_memberships`. A rollback on a populated Newsroom DB *will* delete Newsroom data — this is documented in the DOWN file header.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean on a fresh dev DB | VERIFY 1 |
| **AC2** | TypeScript compiles with new row types | VERIFY 2 |
| **AC3** | Next.js build exits 0 with route count unchanged | VERIFY 3 |
| **AC4** | All four tables present with columns, constraints, indexes, triggers | VERIFY 4 |
| **AC5** | All six enums present with exact values | VERIFY 5 |
| **AC6** | RLS policies present per table per command as spec'd in D9 | VERIFY 6 |
| **AC7** | Helper functions present, STABLE, SECURITY DEFINER, search_path locked | VERIFY 7 |
| **AC8** | `authenticated` has EXECUTE on both helpers | VERIFY 8 |
| **AC9** | Coherence CHECK constraints reject invalid inserts | VERIFY 9 |
| **AC10** | Rollback file cleanly removes everything this migration creates | VERIFY 10 |
| **AC11** | No existing migration, enum, table, function, or trigger is modified | Git diff review in exit report |
| **AC12** | No files outside the three listed in DELIVERABLES are touched | Git diff review in exit report |

---

## D — Dispatch conditions

Must all be true before this directive is pasted into a Claude Code session.

| # | Condition | How to check |
|---|---|---|
| **DC1** | `docs/public-newsroom/BUILD_CHARTER.md` approved (founder sign-off) | Ask the founder |
| **DC2** | `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` approved (founder sign-off) | Ask the founder |
| **DC3** | `main` branch is green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC4** | Latest Supabase migration is `20260421000012_offer_accept_stripe.sql` (or later) | `ls supabase/migrations/ \| tail -1` |
| **DC5** | No in-flight directive that touches `supabase/migrations/` or `src/lib/db/schema.ts` | Check for other open PRs/branches |
| **DC6** | `.claude/agents/` reference file present (existing convention) | `ls .claude/agents/` |
| **DC7** | Dev Supabase DB is disposable (the directive runs `bun run supabase db reset`) | Confirm with founder before dispatch |

When all conditions are green, paste the entire §A block — everything between the opening triple-backtick-fenced `PHASE:` line and the `END OF DIRECTIVE BODY.` line — into Claude Code as a single message. Do not add preamble. Do not abbreviate. Do not paraphrase. The directive is the contract.

---

**End of NR-D1.**
