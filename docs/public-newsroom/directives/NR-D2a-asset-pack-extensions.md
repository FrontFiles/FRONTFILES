# NR-D2a — Newsroom Asset + Pack Extensions (Phase NR-1, Part A of NR-D2)

**Status.** Drafted 2026-04-24 on top of NR-D1 (migration `20260425000001`). First of three parts splitting the original NR-D2 scope (see `docs/public-newsroom/DIRECTIVE_SEQUENCE.md`). Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the first schema-extensions migration and its matching TypeScript row types:

- Three Postgres enums (`newsroom_scan_result`, `newsroom_rendition_kind`, `newsroom_rendition_format`)
- Four tables (`newsroom_asset_scan_results`, `newsroom_asset_renditions`, `newsroom_rights_warranties`, `newsroom_corrections`)
- One deferred-FK validation on `newsroom_packs.rights_warranty_id`
- RLS policies on all four new tables + column-level grants where required
- Indexes matching read-path queries
- Non-destructive rollback file under `supabase/migrations/_rollbacks/`
- Row types + enum unions appended to `src/lib/db/schema.ts`

**No** app code. **No** route handlers. **No** pages. **No** components. **No** RPC functions for Pack state transitions (those land in NR-D9). **No** seed data. **No** modification to existing migrations (including NR-D1's `20260425000001`), existing enums, or existing tables (`users`, `companies`, `company_memberships`, `newsroom_profiles`, `newsroom_verification_records`, `newsroom_assets`). Exception: a single `ALTER TABLE newsroom_packs ADD CONSTRAINT ... FOREIGN KEY ...` on the already-declared `rights_warranty_id` column, executed via the `NOT VALID` + `VALIDATE CONSTRAINT` pattern established in migration `20260413230015 §4`.

**Relationship to Phase NR-1 full scope.** NR-D2a is the first of three parts that together land Phase NR-1's schema extensions. Sequence: **NR-D1 (done) → NR-D2a (this directive) → NR-D2b → NR-D2c → NR-D3 → NR-D4**. Each part is dispatched only after the prior part's exit report clears verdict. NR-D2a is intentionally narrow — four tables grouped by a single concern (the publish-precondition surface: scan, rendition, rights warranty, correction) — so the exit report is verdictable in a single pass.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 3 §3.1 (object roster — **this directive implements AssetScanResult, AssetRendition, RightsWarranty, Correction**), §3.2 *Schemas* (verbatim field specs), §3.3 (Pack publish preconditions — **rights warranty FK is validated here to enable the "rights_warranty_id not null" precondition in NR-D9 RPCs**), §3.4 (key invariants — points 1 and 5 relevant: licence-class/credit_line immutability enforced elsewhere; RightsWarranty immutability enforced via RLS).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §4 (primitive-reuse mapping — **no changes; the four new tables are Newsroom-native, no existing-primitive collision**), §5 (Phase NR-1 exit gate NR-G1 — **this directive contributes the publish-precondition schema**), §3.1 P2 (exit criterion: publish blocked unless all seven preconditions are satisfied — **this directive creates the storage for preconditions 4 and 5**).
- **`supabase/migrations/20260413230015_companies_and_memberships.sql`** — §4 (deferred-FK-validation pattern: `NOT VALID` then `VALIDATE CONSTRAINT` — **this directive reuses the pattern for the `fk_newsroom_packs_rights_warranty` FK**).
- **`supabase/migrations/20260425000001_newsroom_schema_foundation.sql`** — **NR-D1 migration, direct predecessor; `newsroom_packs.rights_warranty_id` column exists here as nullable `uuid`; `newsroom_assets` table exists here and is referenced by scan/rendition tables**. NR-D1 exit report §2 notes one divergence (`idx_newsroom_vr_active` composite instead of partial) — not relevant to NR-D2a.
- **`src/lib/db/schema.ts`** — existing row-type exports through `NewsroomAssetRow` appended in NR-D1 at line 699 (per NR-D1 exit report §1). **This directive appends three enum unions and four row interfaces at the end, following the same convention.**
- **Reference directive (structural template)**: `docs/public-newsroom/directives/NR-D1-schema-foundation.md`. Match its §A format. Match its exit-report seven-section structure.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Schema Extensions, Part A
       (three enums + four tables + one deferred-FK validation
       + RLS policies + indexes + TS row types; no app code;
       no pages; no routes; no RPCs; no seed data; no
       modification to any existing migration, enum, or table
       other than the single ADD CONSTRAINT on newsroom_packs)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                          (authority)
  docs/public-newsroom/BUILD_CHARTER.md                (scope + mapping lock)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md           (place in sequence)
  docs/public-newsroom/directives/NR-D1-schema-foundation.md  (direct predecessor)

SCOPE

You are building the first schema-extensions migration for the
Newsroom v1 subsystem, Part A of the original NR-D2 scope split.
This migration creates the persistent substrate for the Pack
publish-precondition surface: asset scan results, asset
renditions, rights warranty, and corrections. It also validates
the deferred FK `newsroom_packs.rights_warranty_id` →
`newsroom_rights_warranties(id)`.

The existing Frontfiles schema and the NR-D1 Newsroom schema
(newsroom_profiles, newsroom_verification_records, newsroom_packs,
newsroom_assets) are REFERENCED BUT NOT MODIFIED — with ONE
explicit exception: a single `ALTER TABLE newsroom_packs ADD
CONSTRAINT fk_newsroom_packs_rights_warranty FOREIGN KEY
(rights_warranty_id) REFERENCES newsroom_rights_warranties(id)
ON DELETE SET NULL NOT VALID` followed by `ALTER TABLE ...
VALIDATE CONSTRAINT ...`.

Migration filename:
  20260425000002_newsroom_schema_d2a.sql
Rollback filename:
  _rollbacks/20260425000002_newsroom_schema_d2a.DOWN.sql

DELIVERABLES

(F1) supabase/migrations/20260425000002_newsroom_schema_d2a.sql
     — up migration, organised per the sectioned-comment-block
     convention of migration 20260413230015 and 20260425000001.

(F2) supabase/migrations/_rollbacks/20260425000002_newsroom_schema_d2a.DOWN.sql
     — symmetric DOWN migration that removes everything this
     migration creates, in reverse dependency order, including
     the fk_newsroom_packs_rights_warranty constraint.

(F3) src/lib/db/schema.ts (EDIT) — append three enum
     string-literal unions and four row interfaces at the end
     of the file, in the style of the existing row types and
     the NR-D1 append block. No other edits.

No other files are touched.

ENUMS (D1)

  newsroom_scan_result:
    'pending'
    'clean'
    'flagged'
    'error'

  newsroom_rendition_kind:
    'thumbnail'
    'web'
    'print'
    'social'

  newsroom_rendition_format:
    'jpeg'
    'webp'
    'png'
    'mp4'
    'gif'

TABLE 1 — newsroom_asset_scan_results (D2)

  Grain: one row per Asset. 1:1 with newsroom_assets.

  Columns:
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
    asset_id              uuid NOT NULL UNIQUE REFERENCES newsroom_assets(id) ON DELETE CASCADE
    scanner_suite         text NOT NULL
    scanner_version       text NOT NULL
    result                newsroom_scan_result NOT NULL DEFAULT 'pending'
    flagged_categories    text[] NOT NULL DEFAULT '{}'
    scanned_at            timestamptz (nullable — null while result='pending')
    last_error            text (nullable)
    created_at            timestamptz NOT NULL DEFAULT now()
    updated_at            timestamptz NOT NULL DEFAULT now()

  Constraints (all named explicitly so error messages are
  self-describing):

    CONSTRAINT newsroom_scan_pending_coherence
      CHECK ((result = 'pending' AND scanned_at IS NULL)
             OR (result != 'pending' AND scanned_at IS NOT NULL))

    CONSTRAINT newsroom_scan_error_has_message
      CHECK (result != 'error' OR last_error IS NOT NULL)

    CONSTRAINT newsroom_scan_flagged_has_category
      CHECK (result != 'flagged' OR array_length(flagged_categories, 1) >= 1)

  Indexes:
    asset_id uniqueness enforced by column-level UNIQUE; no
    separate index needed.

    idx_newsroom_scan_attention
      ON newsroom_asset_scan_results (result)
      WHERE result IN ('flagged', 'error')
      -- Partial index driving the admin scan-flag queue read
      -- path (enum predicate → IMMUTABLE; safe per NR-D1 exit
      -- report §2 lesson on Postgres CREATE INDEX predicates).

  Trigger:
    BEFORE UPDATE → set_updated_at() (reuse existing function)

TABLE 2 — newsroom_asset_renditions (D3)

  Grain: one row per (Asset, rendition kind, format) triple.

  Columns:
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid()
    asset_id             uuid NOT NULL REFERENCES newsroom_assets(id) ON DELETE CASCADE
    kind                 newsroom_rendition_kind NOT NULL
    storage_url          text NOT NULL
    width                integer NOT NULL CHECK (width > 0)
    height               integer NOT NULL CHECK (height > 0)
    format               newsroom_rendition_format NOT NULL
    file_size_bytes      bigint NOT NULL CHECK (file_size_bytes > 0)
    generated_at         timestamptz NOT NULL DEFAULT now()
    created_at           timestamptz NOT NULL DEFAULT now()
    updated_at           timestamptz NOT NULL DEFAULT now()

  Constraints:
    UNIQUE (asset_id, kind, format)
      — one rendition per (asset, kind, format); prevents
        duplicate generations and lets the UPSERT pattern land
        in NR-D7c cleanly.

  Indexes:
    idx_newsroom_renditions_asset
      ON newsroom_asset_renditions (asset_id)

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 3 — newsroom_rights_warranties (D4)

  Grain: one row per Pack. 1:1 with newsroom_packs at publish
  time. A row is created once, when the Pack leaves `draft`,
  and is immutable thereafter.

  Columns:
    id                             uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id                        uuid NOT NULL UNIQUE REFERENCES newsroom_packs(id) ON DELETE CASCADE
    subject_releases_confirmed     boolean NOT NULL
    third_party_content_cleared    boolean NOT NULL
    music_cleared                  boolean NOT NULL
    narrative_text                 text (nullable)
    confirmed_by_user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
    confirmed_at                   timestamptz NOT NULL DEFAULT now()
    created_at                     timestamptz NOT NULL DEFAULT now()
    updated_at                     timestamptz NOT NULL DEFAULT now()

  Constraints:
    CONSTRAINT newsroom_rights_warranty_all_true
      CHECK (subject_releases_confirmed = true
             AND third_party_content_cleared = true
             AND music_cleared = true)

  Rationale for the all-true CHECK: per PRD P9, all three
  checkboxes must be true to submit the warranty. The UI
  presents each with an "or this pack contains no ..." clause
  so the distributor can honestly confirm true for categories
  not applicable to their pack. The DB enforces that no
  RightsWarranty row exists with a false value — the business
  invariant is "warranty exists ⇒ all three affirmations
  given."

  Immutability is enforced at RLS (no UPDATE policy; see D6).

  Indexes:
    pack_id uniqueness enforced by column-level UNIQUE.

    idx_newsroom_rw_confirmed_by
      ON newsroom_rights_warranties (confirmed_by_user_id)
      — supports admin audit trail queries ("which warranties
        did this user confirm?"). No frequency-based partial.

  Trigger:
    BEFORE UPDATE → set_updated_at()
    (The trigger exists for consistency with the table
    convention, but no UPDATE will ever fire because the RLS
    policy rejects UPDATE. Keeping the trigger in place is
    cheaper than special-casing this table.)

TABLE 4 — newsroom_corrections (D5)

  Grain: one row per issued correction. Many-to-1 with
  newsroom_packs.

  Columns:
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id                 uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE CASCADE
    correction_text         text NOT NULL CHECK (length(correction_text) > 0)
    issued_at               timestamptz NOT NULL DEFAULT now()
    issued_by_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
    created_at              timestamptz NOT NULL DEFAULT now()
    updated_at              timestamptz NOT NULL DEFAULT now()

  Corrections are public and permanent (PRD §3.2 and P12). No
  UPDATE policy, no DELETE policy; service_role only for
  emergency admin intervention.

  Indexes:
    idx_newsroom_corrections_pack_recent
      ON newsroom_corrections (pack_id, issued_at DESC)
      — drives the "show most-recent corrections first" read
        path on J4 (public Pack page) and embed snippet
        attribution.

  Trigger:
    BEFORE UPDATE → set_updated_at()
    (Same rationale as rights_warranties — trigger retained
    for consistency; RLS prevents UPDATE.)

DEFERRED FK VALIDATION ON newsroom_packs (D6)

After newsroom_rights_warranties exists in this migration,
validate the deferred FK on newsroom_packs.rights_warranty_id.
Use the NOT VALID + VALIDATE CONSTRAINT pattern from migration
20260413230015 §4 to match the codebase convention and keep
the alter non-blocking for concurrent reads.

  ALTER TABLE newsroom_packs
    ADD CONSTRAINT fk_newsroom_packs_rights_warranty
    FOREIGN KEY (rights_warranty_id)
    REFERENCES newsroom_rights_warranties(id)
    ON DELETE SET NULL
    NOT VALID;

  ALTER TABLE newsroom_packs
    VALIDATE CONSTRAINT fk_newsroom_packs_rights_warranty;

The FK is ON DELETE SET NULL because a Pack does not cease to
exist when its warranty row is deleted (which would be rare —
only via service_role in emergency). The Pack precondition
enforcer in NR-D9 checks `rights_warranty_id IS NOT NULL`
before allowing transitions out of draft; that gate is at the
RPC layer, not the FK.

The `embargo_id` FK is NOT added in this directive. It lands
in NR-D2b when `newsroom_embargoes` is created.

RLS POLICIES (D7)

Enable RLS on all four new tables:

  ALTER TABLE newsroom_asset_scan_results ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_asset_renditions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_rights_warranties ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_corrections ENABLE ROW LEVEL SECURITY;

Reuse the NR-D1 helpers: is_newsroom_admin(uuid) and
is_newsroom_editor_or_admin(uuid). No new helpers required.

newsroom_asset_scan_results policies:

  POLICY newsroom_scan_select_editor
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_assets a
        JOIN newsroom_packs p ON p.id = a.pack_id
        WHERE a.id = newsroom_asset_scan_results.asset_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Editors/admins of the pack's company see their own
    -- assets' scan status. Admin console (§17 admin queue)
    -- reads via service_role. Anon does not see scan results.

  -- INSERT/UPDATE/DELETE: service_role only.
  -- (Scan pipeline runs server-side.)

newsroom_asset_renditions policies:

  POLICY newsroom_renditions_select
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
    )
    -- Inherit visibility from parent pack, same as
    -- newsroom_assets policy in NR-D1. Takedown renditions
    -- NOT readable.

  -- INSERT/UPDATE/DELETE: service_role only.
  -- (Rendition pipeline runs server-side; distributors do
  -- not hand-author renditions.)

newsroom_rights_warranties policies:

  POLICY newsroom_rw_select_editor
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_rights_warranties.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Editors/admins see their own packs' warranties. Not
    -- exposed to anon; the warranty is a back-office artifact,
    -- not a public surface.

  POLICY newsroom_rw_insert_editor
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_rights_warranties.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
      AND confirmed_by_user_id = auth.uid()
      -- The confirming user must be the authenticated caller.
      -- Prevents a third party from creating a warranty on
      -- behalf of someone else.
    )

  -- UPDATE: NO POLICY.
  -- (RightsWarranty is immutable post-insert per PRD §3.2.
  -- No policy granted to authenticated; service_role only
  -- for emergency correction.)

  -- DELETE: NO POLICY granted to authenticated; service_role only.

newsroom_corrections policies:

  POLICY newsroom_corrections_select_public
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
    )
    -- Corrections are readable wherever the Pack is publicly
    -- readable — EXCEPT on takedown. Per PRD C2 the tombstone
    -- renders no pack metadata beyond facts/explanation/
    -- receipt lookup. Corrections on takedown packs remain in
    -- the audit trail but are not RLS-exposed to anon. Editors
    -- see corrections on their drafts/scheduled packs too.

  POLICY newsroom_corrections_insert_editor
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_corrections.pack_id
          AND p.status IN ('published', 'archived')
          AND is_newsroom_editor_or_admin(p.company_id)
      )
      AND issued_by_user_id = auth.uid()
    )
    -- Corrections can only be issued on published or archived
    -- packs (not drafts, scheduled, or takedowns). The
    -- issuing user must be the authenticated caller.

  -- UPDATE: NO POLICY. Corrections are immutable.
  -- DELETE: NO POLICY. Corrections are permanent.

TS ROW TYPES — src/lib/db/schema.ts (D8)

Append to the end of the file, after NR-D1's NewsroomAssetRow
block (ends approximately at line 699 per NR-D1 exit report
§1). Follow the same section convention: spacer comment block
+ types. Do NOT reorder or modify anything already in the file.

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000002)
//
// Schema extensions Part A: publish-precondition surface.
// Scan results, renditions, rights warranty, corrections.
// See docs/public-newsroom/directives/NR-D2a-asset-pack-
// extensions.md for canonical semantics.
// ══════════════════════════════════════════════

export type NewsroomScanResult =
  | 'pending'
  | 'clean'
  | 'flagged'
  | 'error'

export type NewsroomRenditionKind =
  | 'thumbnail'
  | 'web'
  | 'print'
  | 'social'

export type NewsroomRenditionFormat =
  | 'jpeg'
  | 'webp'
  | 'png'
  | 'mp4'
  | 'gif'

export interface NewsroomAssetScanResultRow {
  id: string
  asset_id: string
  scanner_suite: string
  scanner_version: string
  result: NewsroomScanResult
  flagged_categories: string[]
  scanned_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAssetRenditionRow {
  id: string
  asset_id: string
  kind: NewsroomRenditionKind
  storage_url: string
  width: number
  height: number
  format: NewsroomRenditionFormat
  file_size_bytes: number
  generated_at: string
  created_at: string
  updated_at: string
}

export interface NewsroomRightsWarrantyRow {
  id: string
  pack_id: string
  subject_releases_confirmed: boolean
  third_party_content_cleared: boolean
  music_cleared: boolean
  narrative_text: string | null
  confirmed_by_user_id: string
  confirmed_at: string
  created_at: string
  updated_at: string
}

export interface NewsroomCorrectionRow {
  id: string
  pack_id: string
  correction_text: string
  issued_at: string
  issued_by_user_id: string
  created_at: string
  updated_at: string
}

ROLLBACK (D9)

supabase/migrations/_rollbacks/20260425000002_newsroom_schema_d2a.DOWN.sql

Symmetric DOWN migration. Reverse dependency order:

  1. DROP POLICY (all, on all four new tables)
  2. ALTER TABLE newsroom_packs DROP CONSTRAINT IF EXISTS
     fk_newsroom_packs_rights_warranty
  3. DROP TABLE newsroom_corrections CASCADE
  4. DROP TABLE newsroom_rights_warranties CASCADE
  5. DROP TABLE newsroom_asset_renditions CASCADE
  6. DROP TABLE newsroom_asset_scan_results CASCADE
  7. DROP TYPE newsroom_rendition_format
  8. DROP TYPE newsroom_rendition_kind
  9. DROP TYPE newsroom_scan_result

Include a comment block at the top explaining the rollback is
the inverse of the 20260425000002 up migration, does NOT
touch NR-D1's 20260425000001 objects, and does NOT touch any
pre-Newsroom migration. If the DOWN is run when there is data
in the four new tables, the CASCADE drops will delete that
data — document this.

CRITICAL: The DOWN must drop the fk_newsroom_packs_rights_warranty
constraint BEFORE dropping newsroom_rights_warranties, otherwise
the FK target disappears while the constraint still references it.

OUT OF SCOPE (hard boundaries)

Anything not explicitly in DELIVERABLES above. In particular:

- NO change to any existing migration file, including
  20260425000001 (NR-D1).
- NO change to existing tables beyond the single
  ALTER TABLE newsroom_packs ADD CONSTRAINT call explicitly
  scoped above.
- NO change to existing functions (set_updated_at,
  is_newsroom_admin, is_newsroom_editor_or_admin, etc.).
- NO edits to src/lib/types.ts, src/lib/identity/*,
  src/lib/company-roles.ts, or any other existing source file.
- NO additional tables (embargoes, embargo_recipients,
  recipients, outlets, distribution_events, download_receipts,
  signing_keys, claims, admin_users, admin_audit_events,
  beat_subscriptions) — these land in NR-D2b and NR-D2c.
- NO validation of the newsroom_packs.embargo_id FK — lands
  in NR-D2b.
- NO RPC functions for state transitions (NR-D9).
- NO subdomain middleware, no routing (NR-D3).
- NO domain libraries in src/lib/newsroom/* (NR-D4).
- NO pages, components, route handlers, API endpoints.
- NO seed data.
- NO vitest files. VERIFY steps below are sufficient.
- NO fix of the PUBLIC-EXECUTE grant on NR-D1 helpers
  (v1.1 tightening per DIRECTIVE_SEQUENCE.md).

If you find you need something outside this list to make the
migration work, STOP and surface the blocker as an exit-report
open question. Do not expand scope silently.

VERIFY

Run these in order from the repo root. Each must pass before
moving to the next.

  # 1. Reset dev database with the new migration
  bun run supabase db reset

  # 2. TypeScript type-check
  bun run typecheck
  # expected: tsc --noEmit exit 0

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0, route count unchanged
  # (NR-D1 established 96 routes; no new routes here)

  # 4. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_asset_scan_results"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_asset_renditions"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_rights_warranties"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_corrections"
  # expected: all four tables present with columns, constraints,
  # indexes, triggers, RLS enabled

  # 5. Enum inspection
  psql "$SUPABASE_DB_URL" -c "\dT+ newsroom_scan_result newsroom_rendition_kind newsroom_rendition_format"
  # expected: three enums present with correct values

  # 6. RLS policy inspection
  psql "$SUPABASE_DB_URL" -c \
    "SELECT polname, polrelid::regclass, polcmd FROM pg_policy
     WHERE polrelid::regclass::text IN (
       'newsroom_asset_scan_results',
       'newsroom_asset_renditions',
       'newsroom_rights_warranties',
       'newsroom_corrections'
     )
     ORDER BY polrelid::regclass, polcmd"
  # expected: 6 policies total:
  #   scan_results: 1 SELECT
  #   renditions:   1 SELECT
  #   rights_warr:  1 SELECT + 1 INSERT = 2
  #   corrections:  1 SELECT + 1 INSERT = 2

  # 7. Deferred FK validation
  psql "$SUPABASE_DB_URL" -c \
    "SELECT conname, convalidated
     FROM pg_constraint
     WHERE conname = 'fk_newsroom_packs_rights_warranty'"
  # expected: 1 row, convalidated = true

  # 8. RightsWarranty all-true CHECK smoke
  # Uses a plpgsql DO block (no psql meta-commands) for
  # portability across psql versions. DO blocks wrap their
  # body in an implicit transaction; any exception rolls the
  # whole block back, so no seed rows persist regardless of
  # which path fires.
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    DECLARE
      v_user_id    uuid;
      v_company_id uuid;
      v_pack_id    uuid;
    BEGIN
      INSERT INTO users (id, username, display_name, email)
      VALUES (gen_random_uuid(), 'nrd2a-smoke',
              'NR-D2a Smoke', 'nrd2a-smoke@example.com')
      RETURNING id INTO v_user_id;

      INSERT INTO companies (name, slug, created_by_user_id)
      VALUES ('NR-D2a Smoke Co', 'nrd2a-smoke-co', v_user_id)
      RETURNING id INTO v_company_id;

      INSERT INTO newsroom_packs
        (company_id, slug, title, credit_line,
         licence_class, created_by_user_id)
      VALUES (v_company_id, 'nrd2a-smoke-pack', 'Smoke',
              'Test', 'editorial_use_only', v_user_id)
      RETURNING id INTO v_pack_id;

      -- Should FAIL with CHECK violation
      -- (newsroom_rights_warranty_all_true): one false warranty.
      INSERT INTO newsroom_rights_warranties
        (pack_id, subject_releases_confirmed,
         third_party_content_cleared, music_cleared,
         confirmed_by_user_id)
      VALUES (v_pack_id, true, false, true, v_user_id);

      -- Unreachable if the CHECK fires. Safeguard rollback:
      RAISE EXCEPTION 'nrd2a-smoke-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning the constraint
  # 'newsroom_rights_warranty_all_true' on
  # newsroom_rights_warranties. If instead you see
  # 'nrd2a-smoke-didnotfail' the CHECK failed to fire — treat
  # as a bug and halt.

  # 9. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000002_newsroom_schema_d2a.DOWN.sql
  psql "$SUPABASE_DB_URL" -c "\dt newsroom_asset_scan_results newsroom_asset_renditions newsroom_rights_warranties newsroom_corrections"
  # expected: zero rows (all four tables dropped)
  psql "$SUPABASE_DB_URL" -c \
    "SELECT conname FROM pg_constraint
     WHERE conname = 'fk_newsroom_packs_rights_warranty'"
  # expected: zero rows
  psql "$SUPABASE_DB_URL" -c "\dT newsroom_scan_result newsroom_rendition_kind newsroom_rendition_format"
  # expected: zero rows
  psql "$SUPABASE_DB_URL" -c "\dt newsroom_profiles newsroom_verification_records newsroom_packs newsroom_assets"
  # expected: all four NR-D1 tables STILL present
  # (rollback of NR-D2a must not regress NR-D1)

  # 10. Restore
  bun run supabase db reset
  # expected: all migrations through 20260425000002 re-apply;
  # post-state: 8 newsroom_* tables

EXIT REPORT

Required sections. Each is a first-class heading in the
exit report you return at the end of the session:

1. Summary — files created/edited with line counts and a
   one-line description of each. Migration size. TS schema
   edit line count. Per-table object counts (cols, indexes,
   CHECKs, FKs, policies, triggers).

2. Decisions that diverged — any place the implementation
   deviates from this directive (with rationale). If none,
   state "no divergence". Special case: if any VERIFY fails
   due to a Postgres rule similar to NR-D1's SQLSTATE 42P17
   issue, halt and surface before applying any fix — same
   escalation path as NR-D1.

3. Open questions for founder — anything that surfaced as
   ambiguous. Minimum: flag if you found a reason to modify
   any existing file beyond the single ALTER TABLE
   newsroom_packs call.

4. RLS verification results — the outputs of VERIFY steps 6,
   7 (deferred FK), 8 (RightsWarranty CHECK smoke). Redact
   any PII.

5. Build results — exit codes and route counts for VERIFY
   steps 2, 3. Confirm route count unchanged (96 → 96).

6. Rollback verification — output of VERIFY step 9 (tables,
   constraint, enums all gone; NR-D1 tables intact).

7. Verdict — self-assessment:
   "approve" / "approve with corrections: ..." / "revise
   before approval: ..." / "reject: ..."

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Enum placement.** Three Newsroom-specific enums created in this migration. `newsroom_scan_result` and `newsroom_rendition_kind`/`newsroom_rendition_format` are workflow primitives that should not be extended into any pre-existing enum. Independently versionable from NR-D1's enums.

**D2 — Scan-result grain is 1:1 with Asset.** Enforced by `UNIQUE` on `asset_id`. One scan result per Asset; rescans overwrite. The `scanned_at` nullability while `pending` is explicit, guarded by a CHECK. The `flagged_categories` CHECK ensures a flagged row always has at least one category (otherwise "flagged" is meaningless).

**D3 — Rendition grain is (asset, kind, format).** A given Asset may have multiple kinds (thumbnail/web/print/social), and a given kind may be generated in multiple formats (e.g. web as both webp and jpeg per PRD rendition spec). The three-column UNIQUE enforces the triple without forcing a merged "kind+format" column.

**D4 — RightsWarranty all-true CHECK.** The UI semantics of the three checkboxes is "true = warranty confirmed OR category N/A." A row with a false value is business-invalid; the DB enforces the invariant directly. This is different from scan/rendition where pending/error states are legitimate lifecycle rows. Rights warranty is a point-in-time confirmation — either it's confirmed (all three true) or the row should not exist.

**D5 — Correction insert gates.** RLS restricts correction insert to published or archived Packs only. Not draft (no correction before publish), not scheduled (corrections mid-embargo would be confusing), not takedown (tombstones don't accept corrections). The `issued_by_user_id = auth.uid()` check prevents a third party from issuing a correction under someone else's name.

**D6 — Deferred FK validation, not plain ADD CONSTRAINT.** The codebase convention from migration `20260413230015 §4` uses `NOT VALID` + `VALIDATE CONSTRAINT` for FKs added to already-existing columns, even when no pre-existing data violates the constraint. Matching the convention keeps the migration style consistent; functional outcome is identical.

**D7 — RLS posture.** Scan results: editor-readable within their org, service-role-writable only. Renditions: same visibility as parent Pack's Assets (public for published+public, editor otherwise). RightsWarranties: editor-readable, editor-insertable, never updatable or deletable by authenticated callers. Corrections: publicly readable wherever the Pack is publicly readable (including tombstones), editor-insertable on published/archived Packs, never updatable or deletable. The pattern mirrors NR-D1's anon-vs-editor split, extended through the parent-Pack visibility chain.

**D8 — TS row types append-only.** Matches NR-D1 convention. Three enums + four interfaces, no imports, no branded types. `flagged_categories` typed as `string[]` pending a Postgres enum array helper in NR-D4 domain libraries.

**D9 — Rollback order is load-bearing.** The DOWN must drop the `fk_newsroom_packs_rights_warranty` constraint BEFORE dropping `newsroom_rights_warranties`. If the order is reversed, Postgres rejects the table drop because the FK constraint still references it. The migration's DOWN order as listed is correct; the "CRITICAL" note in the directive makes this explicit to prevent Claude Code from "tidying" the order.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean on dev | VERIFY 1 |
| **AC2** | TypeScript compiles with appended row types | VERIFY 2 |
| **AC3** | Next.js build exits 0 with route count unchanged (96 → 96) | VERIFY 3 |
| **AC4** | All four new tables present with columns, constraints, indexes, triggers | VERIFY 4 |
| **AC5** | Three new enums present with exact values | VERIFY 5 |
| **AC6** | RLS policies present (6 total across the four tables) | VERIFY 6 |
| **AC7** | Deferred FK `fk_newsroom_packs_rights_warranty` exists and is validated | VERIFY 7 |
| **AC8** | RightsWarranty all-true CHECK rejects invalid inserts | VERIFY 8 |
| **AC9** | DOWN file cleanly removes everything this migration creates (tables + enums + FK) without affecting NR-D1's objects | VERIFY 9 |
| **AC10** | Restore (VERIFY 10) brings DB to 8-table up-state for NR-D2b dispatch | VERIFY 10 |
| **AC11** | No modification to any file beyond the three deliverables + the single ALTER TABLE call | Git diff review in exit report |

---

## D — Dispatch conditions

Must all be true before this directive is pasted into a Claude Code session.

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D1 exit report approved by founder | Confirmed 2026-04-24 — NR-D1 cleared with `approve` verdict |
| **DC2** | `main` branch is green, with NR-D1 migration landed | `bun run build` exit 0; `bun run typecheck` clean; migration `20260425000001` present |
| **DC3** | Dev Supabase DB is in NR-D1 up-state | `\dt newsroom_*` shows four tables; `\dT+ newsroom_*` shows six enums |
| **DC4** | No in-flight directive that touches `supabase/migrations/` or `src/lib/db/schema.ts` | Check for other open PRs/branches |
| **DC5** | Dev Supabase DB is disposable | Confirm with founder before dispatch |
| **DC6** | `.claude/agents/` reference file present | `ls .claude/agents/` |

When all conditions are green, paste the entire §A block — everything between the opening triple-backtick-fenced `PHASE:` line and the `END OF DIRECTIVE BODY.` line — into Claude Code as a single message. Do not add preamble. Do not paraphrase.

---

**End of NR-D2a.**
