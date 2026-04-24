# NR-D2c-i — Newsroom Provenance Stack (Phase NR-1, Part C-i of NR-D2)

**Status.** Drafted 2026-04-24 on top of NR-D1 (migration `20260425000001`), NR-D2a (migration `20260425000002`), and NR-D2b (migration `20260425000003`). First of two parts splitting the original NR-D2c scope (see `docs/public-newsroom/DIRECTIVE_SEQUENCE.md`). Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the provenance substrate — the three tables that back the "every download emits an event AND a signed receipt" invariant (PRD Part 6 §6.1) and the Ed25519 signing-key lifecycle (PRD §3.2, §3.6a, Decision #9):

- Four Postgres enums (`newsroom_distribution_event_type`, `newsroom_distribution_source`, `newsroom_signing_algorithm`, `newsroom_signing_key_status`)
- Three tables (`newsroom_signing_keys`, `newsroom_distribution_events`, `newsroom_download_receipts`)
- One partial unique index enforcing the at-most-one-active signing-key invariant
- RLS policies (exactly 2: editor-scoped SELECT on distribution_events; public SELECT on download_receipts; signing_keys RLS-enabled with zero authenticated policies so only service_role reads/writes)
- Indexes matching analytic read paths
- Non-destructive rollback file
- Row types + enum unions appended to `src/lib/db/schema.ts`

**No** app code. **No** route handlers (including `/.well-known/receipt-keys`, which lands in NR-D10). **No** pages. **No** components. **No** RPC functions for receipt emission, signing, or event writing (all NR-D10 and beyond). **No** seed data. **No** modification to existing migrations (20260425000001, 20260425000002, 20260425000003), existing enums, or existing tables.

**Relationship to Phase NR-1 full scope.** NR-D2c-i is the first of two parts splitting the original NR-D2c. Sequence: **NR-D1 (done) → NR-D2a (done) → NR-D2b (done) → NR-D2c-i (this directive) → NR-D2c-ii → NR-D3 → NR-D4**. Each part is dispatched only after the prior part's exit report clears verdict.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 3 §3.1 (object roster: DistributionEvent, DownloadReceipt, SigningKey), §3.2 *Schemas* (verbatim field specs), §3.4 point 5 ("Every download emits a DistributionEvent and a DownloadReceipt (1:1). No silent downloads"), Part 2 Decision #9 (provenance posture — opt-in C2PA, signed receipt v1, third-party verification UI in v1.1 — **this directive lays the schema; emission and signing logic land in NR-D10**), Part 6 §6.1 (receipt and identity integrity invariants), Part 5 §5.1 P4 (signed receipt view — **this directive provides the table P4 reads from**).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §3.2 T1 (exit criterion: downloads emit tamper-evident receipts resolvable at `frontfiles.com/.well-known/receipt-keys` — **schema prerequisite landed here; endpoint is NR-D10**).
- **`supabase/migrations/20260425000001_newsroom_schema_foundation.sql`** — NR-D1; provides `newsroom_packs`, `newsroom_assets`, the `newsroom_licence_class` enum (reused as a snapshot type in `newsroom_download_receipts.licence_class`), and the RLS helper `is_newsroom_editor_or_admin` reused here.
- **`supabase/migrations/20260425000003_newsroom_schema_d2b.sql`** — NR-D2b; provides `newsroom_recipients` (FK target with ON DELETE SET NULL on both event and receipt rows, per PRD §13.8 GDPR erasure rule).
- **`src/lib/db/schema.ts`** — existing row-type exports through NR-D2b's append block ending at line 839. This directive appends four enums + three interfaces.
- **Reference directive (structural template)**: `docs/public-newsroom/directives/NR-D2b-embargo-consumer-identity.md`. Match its §A format and exit-report seven-section structure.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Schema Extensions, Part C-i
       (four enums + three tables + at-most-one-active partial
       unique index + RLS policies + indexes + TS row types;
       no app code; no pages; no routes; no RPCs; no seed data;
       no modification to any existing migration, enum, or table)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                          (authority)
  docs/public-newsroom/BUILD_CHARTER.md                (scope + mapping lock)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md           (place in sequence)
  docs/public-newsroom/directives/NR-D1-schema-foundation.md   (predecessor)
  docs/public-newsroom/directives/NR-D2a-asset-pack-extensions.md (predecessor)
  docs/public-newsroom/directives/NR-D2b-embargo-consumer-identity.md (predecessor)

SCOPE

You are building the provenance-substrate migration for the
Newsroom v1 subsystem, Part C-i of the original NR-D2c scope
split. This migration creates:

  (a) Ed25519 signing-key lifecycle (`newsroom_signing_keys`
      with at-most-one-active invariant enforced at DB level;
      KMS integration lands in NR-D10 and is out of scope here).
  (b) Append-only distribution-event log
      (`newsroom_distribution_events`) keyed for per-pack and
      per-outlet analytics.
  (c) Tamper-evident download receipts
      (`newsroom_download_receipts`) in 1:1 with the subset of
      distribution events that are downloads; snapshots licence
      class + credit line at emission time; carries the
      signing_key_kid and signature.

All mutations are service_role only (no authenticated INSERT/
UPDATE/DELETE policies on any of the three tables). Reads:
distribution_events to org editors of the pack's company;
download_receipts publicly readable (receipt URLs are public
per PRD Part 5 §5.1 P4); signing_keys not authenticated-readable
(public keyset endpoint served via API route in NR-D10 using
service_role; admin-side reads land with admin infrastructure
in NR-D17).

Migration filename:
  20260425000004_newsroom_schema_d2c_i.sql
Rollback filename:
  _rollbacks/20260425000004_newsroom_schema_d2c_i.DOWN.sql

DELIVERABLES

(F1) supabase/migrations/20260425000004_newsroom_schema_d2c_i.sql
     — up migration, organised per the sectioned-comment-block
     convention of prior migrations.

(F2) supabase/migrations/_rollbacks/20260425000004_newsroom_schema_d2c_i.DOWN.sql
     — symmetric DOWN migration, reverse dependency order.

(F3) src/lib/db/schema.ts (EDIT) — append four enum string-
     literal unions and three row interfaces at the end of the
     file, following the NR-D1/NR-D2a/NR-D2b convention.
     No other edits.

No other files are touched.

ENUMS (D1)

  newsroom_distribution_event_type:
    'pack_view'
    'asset_view'
    'asset_download'
    'pack_zip_download'
    'embed_render'
    'preview_access'

  newsroom_distribution_source:
    'web'
    'embed'
    'api'
    'email_link'

  newsroom_signing_algorithm:
    'ed25519'

  newsroom_signing_key_status:
    'active'
    'rotated'
    'revoked'

TABLE 1 — newsroom_signing_keys (D2)

  Grain: one row per Ed25519 signing key across the system's
  entire key lifecycle. At-most-one row with status='active'
  at any time (enforced by a partial unique index). Rotated
  keys stay in the table indefinitely so prior receipts remain
  verifiable.

  Columns:
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
    kid               text NOT NULL
    algorithm         newsroom_signing_algorithm NOT NULL DEFAULT 'ed25519'
    public_key_pem    text NOT NULL
    private_key_ref   text NOT NULL
    status            newsroom_signing_key_status NOT NULL DEFAULT 'active'
    rotated_at        timestamptz (nullable)
    revoked_at        timestamptz (nullable)
    created_at        timestamptz NOT NULL DEFAULT now()
    updated_at        timestamptz NOT NULL DEFAULT now()

  NOTE on private_key_ref: stores a KMS reference (e.g.
  `projects/frontfiles/locations/global/keyRings/newsroom/
  cryptoKeys/receipts/cryptoKeyVersions/N`). The raw private
  key bytes never touch this table. Enforced by convention
  + downstream integration in NR-D10. At DB level, just a
  non-empty text field.

  Constraints:
    CONSTRAINT newsroom_signing_keys_kid_unique
      UNIQUE (kid)

    CONSTRAINT newsroom_signing_keys_kid_format
      CHECK (kid ~ '^[A-Za-z0-9_-]{8,128}$')
      -- URL-safe identifier, 8–128 chars. NR-D10 will
      -- standardise on a specific format (e.g. 'nr-YYYYMMDD-<n>').

    CONSTRAINT newsroom_signing_keys_public_key_nonempty
      CHECK (length(public_key_pem) > 0)

    CONSTRAINT newsroom_signing_keys_private_ref_nonempty
      CHECK (length(private_key_ref) > 0)

    CONSTRAINT newsroom_signing_keys_state_coherence
      CHECK (
        (status = 'active'  AND rotated_at IS NULL AND revoked_at IS NULL)
        OR
        (status = 'rotated' AND rotated_at IS NOT NULL AND revoked_at IS NULL)
        OR
        (status = 'revoked' AND revoked_at IS NOT NULL)
        -- A revoked key may have rotated_at set (rotated then
        -- revoked) or NULL (revoked while still active).
      )

  Indexes:
    kid uniqueness enforced at constraint level.

    idx_newsroom_signing_keys_single_active
      UNIQUE ON newsroom_signing_keys (status)
      WHERE status = 'active'
      -- Enforces at-most-one-active-key invariant. Inserting
      -- a second row with status='active' raises a unique
      -- violation. Rotation (NR-D10) is a two-step: flip
      -- current `active` → `rotated` first, then insert new
      -- row with `active`. Partial-index predicate is
      -- IMMUTABLE (enum-constant), safe per NR-D1 lesson.

    idx_newsroom_signing_keys_published
      ON newsroom_signing_keys (kid)
      WHERE status != 'revoked'
      -- Drives the /.well-known/receipt-keys endpoint
      -- (NR-D10) to list currently-published keys.

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 2 — newsroom_distribution_events (D3)

  Grain: one row per tracked event. Append-only. No
  updated_at trigger; rows never change after insert.

  Columns:
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id            uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE RESTRICT
    asset_id           uuid REFERENCES newsroom_assets(id) ON DELETE RESTRICT
    recipient_id       uuid REFERENCES newsroom_recipients(id) ON DELETE SET NULL
    anon_session_id    text
    event_type         newsroom_distribution_event_type NOT NULL
    source             newsroom_distribution_source NOT NULL
    outlet_domain      text
    user_agent         text
    ip_country         char(2)
    occurred_at        timestamptz NOT NULL DEFAULT now()
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb
    created_at         timestamptz NOT NULL DEFAULT now()

  FK policy rationale:
    - pack_id RESTRICT: packs rarely deleted (takedown tombstones,
      not deletes); events outlive takedowns for audit.
    - asset_id RESTRICT: same rationale at asset granularity.
    - recipient_id SET NULL: GDPR Art. 17 erasure per PRD §13.8
      must be able to null out the recipient reference without
      deleting the event row. Outlet_domain is already on the
      event, so outlet-level analytics survive recipient
      erasure.

  Constraints:
    CONSTRAINT newsroom_de_ip_country_format
      CHECK (ip_country IS NULL OR ip_country ~ '^[A-Z]{2}$')

    CONSTRAINT newsroom_de_outlet_domain_format
      CHECK (outlet_domain IS NULL
             OR outlet_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')

  Indexes:
    idx_newsroom_de_pack_time
      ON newsroom_distribution_events (pack_id, occurred_at DESC)
      -- Per-pack analytics drill-down (P14).

    idx_newsroom_de_outlet_time
      ON newsroom_distribution_events (outlet_domain, occurred_at DESC)
      WHERE outlet_domain IS NOT NULL
      -- Outlet-attribution analytics (P14). Partial: rows
      -- with no outlet_domain don't need indexing.

    idx_newsroom_de_event_type_time
      ON newsroom_distribution_events (event_type, occurred_at DESC)
      -- Event-type filtering.

    idx_newsroom_de_recipient_time
      ON newsroom_distribution_events (recipient_id, occurred_at DESC)
      WHERE recipient_id IS NOT NULL
      -- Journalist export history (J8). Partial: anonymous
      -- events don't need this index.

  NO updated_at trigger. Events are immutable.

TABLE 3 — newsroom_download_receipts (D4)

  Grain: one row per download event. 1:1 with the subset of
  newsroom_distribution_events where event_type IN
  ('asset_download', 'pack_zip_download'). Immutable after
  insert (tamper-evident by design).

  Columns:
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid()
    distribution_event_id  uuid NOT NULL UNIQUE REFERENCES newsroom_distribution_events(id) ON DELETE RESTRICT
    pack_id                uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE RESTRICT
    asset_id               uuid REFERENCES newsroom_assets(id) ON DELETE RESTRICT
    recipient_id           uuid REFERENCES newsroom_recipients(id) ON DELETE SET NULL
    licence_class          newsroom_licence_class NOT NULL
    credit_line            text NOT NULL
    terms_summary          text NOT NULL
    content_hash_sha256    text NOT NULL
    signing_key_kid        text NOT NULL REFERENCES newsroom_signing_keys(kid) ON DELETE RESTRICT
    signed_at              timestamptz NOT NULL DEFAULT now()
    signature              text NOT NULL
    receipt_url            text NOT NULL
    created_at             timestamptz NOT NULL DEFAULT now()

  NOTE on snapshot columns: licence_class, credit_line,
  terms_summary, content_hash_sha256 are captured AT THE TIME
  OF THE DOWNLOAD and frozen. The receipt must remain
  verifiable against the bytes served and the licence presented
  even after the source Pack is edited (post-publish edits are
  constrained to description/subtitle per PRD, but defence in
  depth: snapshot everything that matters). Same for the
  signing_key_kid — even if the key is later rotated or
  revoked, the receipt still carries the kid that was active
  at signing.

  FK policy:
    - distribution_event_id RESTRICT: 1:1 with the event;
      event row must not vanish while receipt exists.
    - pack_id RESTRICT: receipts outlive pack takedowns.
    - asset_id RESTRICT: same.
    - recipient_id SET NULL: GDPR erasure.
    - signing_key_kid RESTRICT: receipts must never lose their
      key reference. A revoked key stays in the table so its
      public_key_pem remains retrievable for independent
      verification (the receipt is "signed by a revoked key"
      but still inspectable, per PRD P4 state table).

  Constraints:
    CONSTRAINT newsroom_dr_distribution_event_unique
      UNIQUE (distribution_event_id)

    CONSTRAINT newsroom_dr_receipt_url_unique
      UNIQUE (receipt_url)

    CONSTRAINT newsroom_dr_content_hash_format
      CHECK (length(content_hash_sha256) = 64
             AND content_hash_sha256 ~ '^[0-9a-f]{64}$')
      -- 64 lowercase hex chars.

    CONSTRAINT newsroom_dr_credit_line_nonempty
      CHECK (length(credit_line) > 0)

    CONSTRAINT newsroom_dr_terms_summary_nonempty
      CHECK (length(terms_summary) > 0)

    CONSTRAINT newsroom_dr_signature_nonempty
      CHECK (length(signature) > 0)

    CONSTRAINT newsroom_dr_receipt_url_format
      CHECK (receipt_url ~ '^https://[a-z0-9.-]+/receipts/[A-Za-z0-9_-]+$')
      -- Shape: https://{host}/receipts/{id-or-slug}. NR-D10
      -- will standardise on the id uuid; keeping the pattern
      -- flexible here to avoid early coupling.

  Indexes:
    distribution_event_id uniqueness at constraint level.
    receipt_url uniqueness at constraint level.

    idx_newsroom_dr_pack_time
      ON newsroom_download_receipts (pack_id, signed_at DESC)
      -- Per-pack receipt listing (P4 admin view and P14 analytics).

    idx_newsroom_dr_signing_key
      ON newsroom_download_receipts (signing_key_kid)
      -- Key-rotation inspection ("how many receipts did this
      -- key sign?" — NR-D17 admin query).

  NO updated_at column. Receipts are immutable. Column
  intentionally omitted to prevent accidental "touch" updates.

RLS POLICIES (D5)

Enable RLS on all three tables:

  ALTER TABLE newsroom_signing_keys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_distribution_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_download_receipts ENABLE ROW LEVEL SECURITY;

newsroom_signing_keys policies:

  NO policies granted to authenticated or anon. RLS enabled +
  zero policies = deny-all for non-service-role callers. This
  is deliberate:
    - Public key material is served via the /.well-known/
      receipt-keys API route (NR-D10), which runs with
      service_role credentials and selects only the public
      columns (kid, algorithm, public_key_pem, status) of
      non-revoked rows.
    - Admin-side reads land with admin infrastructure in
      NR-D17 (a `security`-role policy will be added there).
    - private_key_ref must never be readable by any
      authenticated session, even admins; only the signing
      server (service_role) needs it.

newsroom_distribution_events policies:

  POLICY newsroom_de_select_org
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_distribution_events.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Editors/admins of the pack's company see events on
    -- their own packs (drives P14 analytics). Anon does not
    -- see events. Journalist view of own events (J8 export
    -- history) uses service_role via API route (query filters
    -- on recipient_id = caller's recipient id).

  -- No INSERT/UPDATE/DELETE policies. Events emitted by
  -- server-side writer in NR-D10 and beyond.

newsroom_download_receipts policies:

  POLICY newsroom_dr_select_public
    FOR SELECT
    USING (true)
    -- Receipt URLs are publicly resolvable per PRD Part 5
    -- §5.1 P4 (signed receipt view). Receipt content is
    -- intentionally public: credit_line, licence_class, hash,
    -- kid, signature are all inspection-required.
    -- Recipient identity is NOT exposed in the raw row —
    -- recipient_id is a uuid with no public resolution path
    -- (newsroom_recipients RLS blocks anon SELECT). P4 UI
    -- renders masked email via a service-role side channel.

  -- No INSERT/UPDATE/DELETE policies. Receipts emitted by
  -- NR-D10 signing RPC. Immutability enforced at application
  -- + database (no updated_at column + no UPDATE policy).

TS ROW TYPES — src/lib/db/schema.ts (D6)

Append to the end of the file, after NR-D2b's
NewsroomEmbargoRecipientRow block (file ends at approximately
line 839 per NR-D2b exit report §1). Follow the same section
convention.

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000004)
//
// Schema extensions Part C-i: provenance stack.
// Signing keys, distribution events, download receipts.
// See docs/public-newsroom/directives/
//   NR-D2c-i-provenance-stack.md for canonical semantics.
// ══════════════════════════════════════════════

export type NewsroomDistributionEventType =
  | 'pack_view'
  | 'asset_view'
  | 'asset_download'
  | 'pack_zip_download'
  | 'embed_render'
  | 'preview_access'

export type NewsroomDistributionSource =
  | 'web'
  | 'embed'
  | 'api'
  | 'email_link'

export type NewsroomSigningAlgorithm = 'ed25519'

export type NewsroomSigningKeyStatus =
  | 'active'
  | 'rotated'
  | 'revoked'

export interface NewsroomSigningKeyRow {
  id: string
  kid: string
  algorithm: NewsroomSigningAlgorithm
  public_key_pem: string
  private_key_ref: string
  status: NewsroomSigningKeyStatus
  rotated_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomDistributionEventRow {
  id: string
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  anon_session_id: string | null
  event_type: NewsroomDistributionEventType
  source: NewsroomDistributionSource
  outlet_domain: string | null
  user_agent: string | null
  ip_country: string | null
  occurred_at: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface NewsroomDownloadReceiptRow {
  id: string
  distribution_event_id: string
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  licence_class: NewsroomLicenceClass
  credit_line: string
  terms_summary: string
  content_hash_sha256: string
  signing_key_kid: string
  signed_at: string
  signature: string
  receipt_url: string
  created_at: string
}

ROLLBACK (D7)

supabase/migrations/_rollbacks/20260425000004_newsroom_schema_d2c_i.DOWN.sql

Symmetric DOWN migration. Reverse dependency order:

  1. DROP POLICY (2 policies: newsroom_de_select_org,
     newsroom_dr_select_public)
  2. DROP TABLE newsroom_download_receipts CASCADE
  3. DROP TABLE newsroom_distribution_events CASCADE
  4. DROP TABLE newsroom_signing_keys CASCADE
  5. DROP TYPE newsroom_signing_key_status
  6. DROP TYPE newsroom_signing_algorithm
  7. DROP TYPE newsroom_distribution_source
  8. DROP TYPE newsroom_distribution_event_type

Comment block at the top states: inverse of the 20260425000004
up migration; does NOT touch NR-D1, NR-D2a, or NR-D2b objects.
CASCADE drops will delete any data in these three tables if
present.

OUT OF SCOPE (hard boundaries)

- NO change to any existing migration file (20260425000001,
  20260425000002, 20260425000003).
- NO change to existing tables, enums, functions, or triggers.
- NO edits to src/lib/types.ts, src/lib/identity/*,
  src/lib/company-roles.ts, or any other existing source file.
- NO additional tables (claims, admin_users, admin_audit_events,
  beat_subscriptions) — these land in NR-D2c-ii.
- NO RPC functions (receipt-emit, key-rotate, event-write all
  in NR-D10).
- NO API route for /.well-known/receipt-keys (NR-D10).
- NO KMS integration (NR-D10).
- NO INSERT/UPDATE/DELETE policies on any of the three tables.
- NO admin-side SELECT policy on newsroom_signing_keys
  (NR-D17).
- NO subdomain middleware (NR-D3), domain libraries (NR-D4),
  pages, components, API endpoints, seed data, vitest files.
- NO fix of the PUBLIC-EXECUTE grant on NR-D1 helpers
  (v1.1 tightening per DIRECTIVE_SEQUENCE.md).

If you find you need something outside this list to make the
migration work, STOP and surface the blocker as an exit-report
open question. Do not expand scope silently.

VERIFY

Run these in order. Each must pass before moving to the next.

  # 1. Reset dev database with the new migration
  bun run supabase db reset

  # 2. TypeScript type-check
  bun run typecheck
  # If you hit a stale .next/types cache issue (the one
  # flagged in NR-D2b exit report §5), run:
  #   rm -rf .next && bun run typecheck
  # expected: tsc --noEmit exit 0

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0, route count unchanged
  # from predecessor baseline (NR-D2b closed at 91 routes)

  # 4. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_signing_keys"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_distribution_events"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_download_receipts"
  # expected: three tables present with columns, constraints,
  # indexes, triggers (only newsroom_signing_keys has a
  # BEFORE UPDATE trigger; the other two are append-only
  # with no updated_at column), RLS enabled on all three

  # 5. Enum inspection
  psql "$SUPABASE_DB_URL" -c \
    "\dT+ newsroom_distribution_event_type newsroom_distribution_source newsroom_signing_algorithm newsroom_signing_key_status"
  # expected: four enums present with correct values

  # 6. RLS policy inspection
  psql "$SUPABASE_DB_URL" -c \
    "SELECT polname, polrelid::regclass, polcmd FROM pg_policy
     WHERE polrelid::regclass::text IN (
       'newsroom_signing_keys',
       'newsroom_distribution_events',
       'newsroom_download_receipts'
     )
     ORDER BY polrelid::regclass, polcmd"
  # expected: exactly 2 rows
  #   newsroom_de_select_org         | newsroom_distribution_events | r
  #   newsroom_dr_select_public      | newsroom_download_receipts   | r
  # newsroom_signing_keys has RLS enabled but zero policies
  # (service_role only). Confirm via:
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname, relrowsecurity FROM pg_class
     WHERE relname IN ('newsroom_signing_keys',
                       'newsroom_distribution_events',
                       'newsroom_download_receipts')"
  # expected: all three relrowsecurity = t

  # 7. SigningKey state-coherence CHECK smoke
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    BEGIN
      -- Should FAIL: status='active' with rotated_at set
      INSERT INTO newsroom_signing_keys
        (kid, public_key_pem, private_key_ref, status, rotated_at)
      VALUES ('nrd2ci-smoke-active',
              '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
              'kms://test/smoke-coherence',
              'active',
              now());
      RAISE EXCEPTION 'nrd2ci-smoke-coherence-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning
  # 'newsroom_signing_keys_state_coherence' on
  # newsroom_signing_keys. Sentinel must NOT appear.

  # 8. At-most-one-active unique index smoke
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    BEGIN
      -- First active key — should succeed
      INSERT INTO newsroom_signing_keys
        (kid, public_key_pem, private_key_ref, status)
      VALUES ('nrd2ci-smoke-k1',
              '-----BEGIN PUBLIC KEY-----\nk1\n-----END PUBLIC KEY-----',
              'kms://test/k1',
              'active');

      -- Second active key — should FAIL on partial unique
      INSERT INTO newsroom_signing_keys
        (kid, public_key_pem, private_key_ref, status)
      VALUES ('nrd2ci-smoke-k2',
              '-----BEGIN PUBLIC KEY-----\nk2\n-----END PUBLIC KEY-----',
              'kms://test/k2',
              'active');

      RAISE EXCEPTION 'nrd2ci-smoke-atmostone-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning
  # 'idx_newsroom_signing_keys_single_active' or a unique
  # violation on newsroom_signing_keys. Sentinel must NOT
  # appear. First INSERT should have been rolled back
  # automatically by DO block exception handling.
  # Confirm no leftover:
  psql "$SUPABASE_DB_URL" -c \
    "SELECT count(*) FROM newsroom_signing_keys
     WHERE kid LIKE 'nrd2ci-smoke-%'"
  # expected: 0

  # 9. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000004_newsroom_schema_d2c_i.DOWN.sql
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname IN ('newsroom_signing_keys',
                     'newsroom_distribution_events',
                     'newsroom_download_receipts')"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT typname FROM pg_type
     WHERE typname IN ('newsroom_distribution_event_type',
                       'newsroom_distribution_source',
                       'newsroom_signing_algorithm',
                       'newsroom_signing_key_status')"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname LIKE 'newsroom_%' ORDER BY relname"
  # expected: 12 tables (NR-D1's 4 + NR-D2a's 4 + NR-D2b's 4)
  # — NR-D2c-i rollback must not regress prior substrate

  # 10. Restore
  bun run supabase db reset
  # expected: all migrations through 20260425000004 re-apply;
  # post-state: 15 newsroom_* tables

EXIT REPORT

Required sections. Each is a first-class heading:

1. Summary — files created/edited with line counts and
   one-line descriptions. Migration size. TS schema edit
   line count. Per-table object counts (cols, indexes,
   CHECKs, FKs out, FKs in, policies, triggers).

2. Decisions that diverged — any place the implementation
   deviates from this directive (with rationale). If none,
   state "no divergence". Same SQLSTATE 42P17 / Postgres-
   rule halt protocol as NR-D1.

3. Open questions for founder — anything that surfaced as
   ambiguous. Minimum: flag if you found a reason to modify
   any existing file.

4. RLS verification results — outputs of VERIFY steps 6, 7,
   8. Redact any PII.

5. Build results — exit codes and route counts for VERIFY
   steps 2, 3. Confirm route count unchanged.

6. Rollback verification — output of VERIFY step 9 (tables,
   enums all gone; NR-D1 + NR-D2a + NR-D2b tables intact;
   12-table up-state preserved after rollback).

7. Verdict — self-assessment:
   "approve" / "approve with corrections: ..." / "revise
   before approval: ..." / "reject: ..."

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Four enums.** Event type and source are catalogue-style (consumed by analytics + client writers). Signing algorithm enum has a single value today (`ed25519`) but is declared as an enum so v2 Ed448/secp256k1 can extend without a new column. Key status is a three-state lifecycle (active → rotated / revoked). All four are Newsroom-scoped.

**D2 — At-most-one-active signing key, enforced at DB.** PRD §3.2 locks "at most one key with status=active at any time." A partial unique index on `(status) WHERE status='active'` enforces this at the row-creation level, cheaper and stronger than an advisory application-layer check. IMMUTABLE predicate (enum-constant) per NR-D1 lesson.

**D3 — Append-only distribution events.** No `updated_at` column, no update trigger. Event rows never change. Prevents accidental "touch" updates. Reads are by time range + dimension; write path is high-volume and tolerates no extra overhead.

**D4 — Snapshot columns on download_receipts.** `licence_class`, `credit_line`, `terms_summary`, `content_hash_sha256`, `signing_key_kid` are captured at emission and frozen. Receipts remain verifiable even if the source Pack is edited or taken down, or the signing key is rotated or revoked. This is the core tamper-evidence invariant.

**D5 — RLS: zero authenticated policies on signing_keys.** Public key material is served via the `/.well-known/receipt-keys` route (NR-D10) under service_role. Admin reads land with admin infrastructure in NR-D17 (a security-role policy). `private_key_ref` must never be readable by any authenticated session. Distribution events get org-scoped SELECT (editors see their own Pack's events). Receipts get public SELECT (receipt URLs are public per PRD P4).

**D6 — `recipient_id` SET NULL on both event and receipt.** PRD §13.8 GDPR erasure rule: Recipient PII deletable on DSR request; event and receipt rows survive with recipient_id nulled. `outlet_domain` stays on the event row so outlet-level analytics survive erasure.

**D7 — `receipt_url` format CHECK is tolerant.** Pattern `^https://[a-z0-9.-]+/receipts/[A-Za-z0-9_-]+$` accepts a host plus a `/receipts/{identifier}` path. NR-D10 will standardise on the receipt id (uuid); keeping the pattern flexible avoids early coupling and makes the migration robust to hostname choice (`frontfiles.com` vs `newsroom.frontfiles.com`, etc.).

**D8 — Rollback order prioritises referrers first.** `newsroom_download_receipts` references both `newsroom_distribution_events` and `newsroom_signing_keys`. Drop receipts first, then events, then signing keys. Then enums in creation-reverse order.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean on dev | VERIFY 1 |
| **AC2** | TypeScript compiles with appended row types | VERIFY 2 |
| **AC3** | Next.js build exits 0, route count unchanged from NR-D2b baseline (91) | VERIFY 3 |
| **AC4** | Three tables present with columns, constraints, indexes, RLS enabled | VERIFY 4 |
| **AC5** | Four new enums present with exact values | VERIFY 5 |
| **AC6** | Exactly 2 RLS policies (both SELECT); RLS enabled on all three tables; signing_keys has zero policies | VERIFY 6 |
| **AC7** | SigningKey state-coherence CHECK rejects incoherent inserts | VERIFY 7 |
| **AC8** | At-most-one-active partial unique index rejects second active row | VERIFY 8 |
| **AC9** | DOWN removes all NR-D2c-i objects without regressing NR-D1/D2a/D2b | VERIFY 9 |
| **AC10** | Restore brings DB to 15-table up-state | VERIFY 10 |
| **AC11** | No modification to any file beyond the three deliverables | Git diff review in exit report |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D2b exit report approved; commit on feat/newsroom-phase-nr-1 | Confirmed 2026-04-24 — NR-D2b cleared `approve`; branch at `5c8d6c8` |
| **DC2** | `feat/newsroom-phase-nr-1` is current branch | `git branch --show-current` |
| **DC3** | Dev Supabase DB is in NR-D2b up-state (12 newsroom_* tables) | `\dt newsroom_*` |
| **DC4** | `main` + branch build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC5** | `.claude/agents/` reference file present | `ls .claude/agents/` |
| **DC6** | Dev Supabase DB is disposable | Confirm before dispatch |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D2c-i.**
