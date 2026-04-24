# NR-D2c-ii — Newsroom Claims + Admin + Subscriptions (Phase NR-1, Part C-ii of NR-D2)

**Status.** Drafted 2026-04-24 on top of NR-D1 (migration `20260425000001`), NR-D2a (`20260425000002`), NR-D2b (`20260425000003`), and NR-D2c-i (`20260425000004`). Second of two parts splitting the original NR-D2c. **Final schema directive of Phase NR-1.** Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the governance substrate (claims + admin + audit) and the consumer-notification primitive (beat subscriptions):

- Five Postgres enums (`newsroom_claim_reason_category`, `newsroom_claim_status`, `newsroom_admin_role`, `newsroom_admin_target_type`, `newsroom_beat_notify_on`)
- Four tables (`newsroom_claims`, `newsroom_admin_users`, `newsroom_admin_audit_events`, `newsroom_beat_subscriptions`)
- RLS policies — 6 total (1 SELECT on claims/admin_users/audit; 3 on beat_subscriptions for SELECT/INSERT/DELETE self)
- Indexes matching admin-queue and journalist-side read paths
- Non-destructive rollback file
- Row types + enum unions appended to `src/lib/db/schema.ts`

**No** app code. **No** route handlers (admin shell, queues, claim intake, takedown flow all land in NR-D15, NR-D17, NR-D18, NR-D19). **No** pages. **No** components. **No** RPC functions (claim-file, admin-action-record, subscription-fanout all in later directives). **No** seed data. **No** modification to existing migrations or tables.

**Relationship to Phase NR-1 full scope.** NR-D2c-ii is the closing directive of Phase NR-1 schema. Sequence: **NR-D1 (done) → NR-D2a (done) → NR-D2b (done) → NR-D2c-i (done) → NR-D2c-ii (this directive) → NR-D3 → NR-D4 → NR-G1**. After this directive ships, the full 19-table Newsroom substrate is in place and NR-1 proceeds to subdomain routing (NR-D3) and domain libraries (NR-D4) before NR-G1 gate.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 3 §3.1 (object roster: Claim, AdminUser, AdminAuditEvent, BeatSubscription), §3.2 *Schemas* (verbatim field specs), Part 5 §5.4 C1 (public claim intake — this directive provides the table C1 writes to), Part 5 §5.5 A1–A9 (admin console — **this directive lays admin_users, admin_audit_events; the console UI lands in NR-D17/18/19**), Part 5 §5.3 J7 (beat subscriptions — thin v1: newsroom-only, no topic taxonomy), Part 6 §6.4 (admin action integrity invariants).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §4 primitive-reuse mapping (AdminUser reuses `users` with role assignment via new `newsroom_admin_users(user_id PK, role)` table — this directive implements that mapping verbatim).
- **`supabase/migrations/20260425000001_newsroom_schema_foundation.sql`** — NR-D1; provides `newsroom_packs`, `newsroom_assets` (FK targets for claims).
- **`supabase/migrations/20260425000003_newsroom_schema_d2b.sql`** — NR-D2b; provides `newsroom_recipients` (FK target for beat_subscriptions) and confirms the email-first Recipient model (Path A).
- **`supabase/migrations/20260413230015_companies_and_memberships.sql`** — provides `companies` (FK target for beat_subscriptions).
- **`supabase/migrations/20260408230009_identity_tables.sql`** — provides `users` (FK target for admin_users and admin_audit_events).
- **`src/lib/db/schema.ts`** — existing exports through NR-D2c-i's append (ends at approximately line 915 per NR-D2c-i exit report §1). This directive appends five enums + four interfaces.
- **Reference directive (structural template)**: `docs/public-newsroom/directives/NR-D2c-i-provenance-stack.md`.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Schema Extensions, Part C-ii
       (five enums + four tables + RLS policies + indexes
       + TS row types; no app code; no pages; no routes;
       no RPCs; no seed data; no modification to any existing
       migration, enum, or table)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                          (authority)
  docs/public-newsroom/BUILD_CHARTER.md                (scope + mapping lock)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md           (place in sequence)
  docs/public-newsroom/directives/NR-D1-schema-foundation.md          (predecessor)
  docs/public-newsroom/directives/NR-D2a-asset-pack-extensions.md     (predecessor)
  docs/public-newsroom/directives/NR-D2b-embargo-consumer-identity.md (predecessor)
  docs/public-newsroom/directives/NR-D2c-i-provenance-stack.md        (predecessor)

SCOPE

You are building the governance + subscriptions substrate for
the Newsroom v1 subsystem, Part C-ii of the NR-D2c split and
the final schema directive of Phase NR-1. This migration
creates:

  (a) Public claim intake substrate (newsroom_claims).
  (b) Admin identity layer (newsroom_admin_users) and
      append-only admin audit log (newsroom_admin_audit_events).
  (c) Consumer notification primitive (newsroom_beat_subscriptions),
      v1-thin: newsroom-only scoping, no topic taxonomy.

No app code. No RPCs. Mutations on claims, admin_users, and
admin_audit_events are service_role only; beat_subscriptions
allows authenticated self-service INSERT/DELETE (journalist
manages their own subscriptions per PRD §5.3 J7).

The existing Frontfiles schema and the NR-D1/D2a/D2b/D2c-i
Newsroom schema are REFERENCED BUT NOT MODIFIED.

Migration filename:
  20260425000005_newsroom_schema_d2c_ii.sql
Rollback filename:
  _rollbacks/20260425000005_newsroom_schema_d2c_ii.DOWN.sql

DELIVERABLES

(F1) supabase/migrations/20260425000005_newsroom_schema_d2c_ii.sql
     — up migration, sectioned-comment-block convention.

(F2) supabase/migrations/_rollbacks/20260425000005_newsroom_schema_d2c_ii.DOWN.sql
     — symmetric DOWN, reverse dependency order.

(F3) src/lib/db/schema.ts (EDIT) — append five enum string-
     literal unions and four row interfaces at the end of the
     file. No other edits.

No other files are touched.

ENUMS (D1)

  newsroom_claim_reason_category:
    'trademark_infringement'
    'copyright'
    'defamation'
    'privacy'
    'embargo_breach'
    'other'

  newsroom_claim_status:
    'submitted'
    'reviewing'
    'upheld'
    'dismissed'
    'withdrawn'

  newsroom_admin_role:
    'viewer'
    'reviewer'
    'operator'
    'security'

  newsroom_admin_target_type:
    'organization'
    'pack'
    'asset'
    'verification_record'
    'signing_key'
    'claim'

  newsroom_beat_notify_on:
    'new_pack'
    'embargo_lift'
    'update'

TABLE 1 — newsroom_claims (D2)

  Grain: one row per submitted claim. Created by the public
  C1 intake form (NR-D15) under service_role after email
  verification. Status transitions managed by admin A4/A5
  flow (NR-D18) under service_role.

  Columns:
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id           uuid NOT NULL REFERENCES newsroom_packs(id) ON DELETE RESTRICT
    asset_id          uuid REFERENCES newsroom_assets(id) ON DELETE RESTRICT
    reporter_email    text NOT NULL
    reporter_name     text
    reason_category   newsroom_claim_reason_category NOT NULL
    reason_text       text NOT NULL
    status            newsroom_claim_status NOT NULL DEFAULT 'submitted'
    submitted_at      timestamptz NOT NULL DEFAULT now()
    resolved_at       timestamptz
    resolution_note   text
    created_at        timestamptz NOT NULL DEFAULT now()
    updated_at        timestamptz NOT NULL DEFAULT now()

  FK policy:
    - pack_id RESTRICT: claims outlive pack takedowns for
      audit; pack must not be deleted if claims reference it.
    - asset_id RESTRICT: same at asset granularity.

  Constraints:
    CONSTRAINT newsroom_claims_reason_text_min_length
      CHECK (length(reason_text) >= 40)
      -- PRD C1: "Reason text (required, min 40 chars)".
      -- Enforced at DB level defensively.

    CONSTRAINT newsroom_claims_reporter_email_format
      CHECK (reporter_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
      -- Same pragmatic pattern as newsroom_recipients.

    CONSTRAINT newsroom_claims_status_resolution_coherence
      CHECK (
        (status IN ('submitted', 'reviewing') AND resolved_at IS NULL)
        OR
        (status IN ('upheld', 'dismissed', 'withdrawn') AND resolved_at IS NOT NULL)
      )

  Indexes:
    idx_newsroom_claims_pack_time
      ON newsroom_claims (pack_id, submitted_at DESC)
      -- P13 distributor-side claim list for a pack.

    idx_newsroom_claims_open_queue
      ON newsroom_claims (submitted_at DESC)
      WHERE status IN ('submitted', 'reviewing')
      -- A4 admin queue: unresolved claims by age.
      -- Enum-constant predicate → IMMUTABLE. Safe.

    idx_newsroom_claims_category_time
      ON newsroom_claims (reason_category, submitted_at DESC)
      -- Admin filtering by category.

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 2 — newsroom_admin_users (D3)

  Grain: one row per admin. Extension of `users` via
  `user_id` PK (per Build Charter §4). A user is an admin
  iff this row exists AND `revoked_at IS NULL`.

  Columns:
    user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT
    role                  newsroom_admin_role NOT NULL
    mfa_enabled           boolean NOT NULL
    assigned_at           timestamptz NOT NULL DEFAULT now()
    assigned_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL
    revoked_at            timestamptz
    revoked_by_user_id    uuid REFERENCES users(id) ON DELETE SET NULL
    created_at            timestamptz NOT NULL DEFAULT now()
    updated_at            timestamptz NOT NULL DEFAULT now()

  FK policy:
    - user_id RESTRICT: admin identity anchored to the users
      row; users cannot be deleted while admin assignment exists.
    - assigned_by_user_id SET NULL: if the assigner leaves the
      system, the assignment record survives.
    - revoked_by_user_id SET NULL: same.

  Constraints:
    CONSTRAINT newsroom_admin_users_mfa_required
      CHECK (mfa_enabled = true)
      -- PRD §5.5 A1: TOTP MFA required for every admin role.
      -- DB enforces that an admin row cannot exist without
      -- MFA enrolled. Application layer validates at
      -- sign-in; DB is defence in depth.

    CONSTRAINT newsroom_admin_users_revoked_coherence
      CHECK (
        (revoked_at IS NULL AND revoked_by_user_id IS NULL)
        OR
        (revoked_at IS NOT NULL)
      )

    CONSTRAINT newsroom_admin_users_assigner_not_self
      CHECK (assigned_by_user_id IS NULL OR assigned_by_user_id != user_id)

  Indexes:
    user_id uniqueness enforced at PK level.

    idx_newsroom_admin_users_active_role
      ON newsroom_admin_users (role)
      WHERE revoked_at IS NULL
      -- Admin role-filtering (e.g. "all security admins").

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 3 — newsroom_admin_audit_events (D4)

  Grain: one row per admin action. Append-only. No
  updated_at column, no update trigger, no UPDATE policy.

  Columns:
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid()
    admin_user_id              uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
    cosigner_admin_user_id     uuid REFERENCES users(id) ON DELETE RESTRICT
    action                     text NOT NULL
    target_type                newsroom_admin_target_type NOT NULL
    target_id                  uuid NOT NULL
    reason                     text NOT NULL
    before_state               jsonb NOT NULL DEFAULT '{}'::jsonb
    after_state                jsonb NOT NULL DEFAULT '{}'::jsonb
    source_ip                  inet
    occurred_at                timestamptz NOT NULL DEFAULT now()
    created_at                 timestamptz NOT NULL DEFAULT now()

  NOTE on `action` type: text rather than enum. The full
  action vocabulary (verification_approved, scan_override,
  claim_upheld, key_rotated, org_suspended, etc.) will expand
  across NR-D17/18/19 RPCs, and enum migrations are painful.
  App-layer validates against a controlled set; DB enforces
  non-empty + length.

  NOTE on `source_ip`: uses `inet` type (Postgres native)
  rather than text. Supports both IPv4 and IPv6 natively,
  indexable and comparable.

  Constraints:
    CONSTRAINT newsroom_aae_action_nonempty
      CHECK (length(action) > 0 AND length(action) <= 80)

    CONSTRAINT newsroom_aae_reason_min_length
      CHECK (length(reason) >= 10)
      -- PRD Part 6 §6.4 point 2: "Reason capture is blocking;
      -- required min 10 chars."

    CONSTRAINT newsroom_aae_cosigner_distinct
      CHECK (
        cosigner_admin_user_id IS NULL
        OR cosigner_admin_user_id != admin_user_id
      )
      -- Co-signer cannot be the initiating admin.

  Indexes:
    idx_newsroom_aae_admin_time
      ON newsroom_admin_audit_events (admin_user_id, occurred_at DESC)
      -- A8 audit log viewer: filter by admin.

    idx_newsroom_aae_target
      ON newsroom_admin_audit_events (target_type, target_id)
      -- A8 filter by target entity.

    idx_newsroom_aae_time
      ON newsroom_admin_audit_events (occurred_at DESC)
      -- Default chronological view.

    idx_newsroom_aae_cosigned
      ON newsroom_admin_audit_events (occurred_at DESC)
      WHERE cosigner_admin_user_id IS NOT NULL
      -- A8 "co-signed only" filter.

  NO updated_at column. NO update trigger. Append-only.

TABLE 4 — newsroom_beat_subscriptions (D5)

  Grain: one row per (recipient, company, notify_on) triple.
  A journalist can subscribe to multiple notification types
  for the same newsroom (new_pack, embargo_lift, update are
  separate rows).

  Columns:
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
    recipient_id     uuid NOT NULL REFERENCES newsroom_recipients(id) ON DELETE CASCADE
    company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE
    notify_on        newsroom_beat_notify_on NOT NULL
    created_at       timestamptz NOT NULL DEFAULT now()
    updated_at       timestamptz NOT NULL DEFAULT now()

  FK policy:
    - recipient_id CASCADE: subscription disappears on
      recipient deletion (GDPR erasure).
    - company_id CASCADE: subscription disappears on company
      deletion (rare; usually org suspension keeps the company
      row).

  Constraints:
    CONSTRAINT newsroom_bs_unique_per_notify
      UNIQUE (recipient_id, company_id, notify_on)
      -- One row per (recipient, company, notify_on). Toggle
      -- a notification off = DELETE; toggle on = INSERT.
      -- No UPDATE path needed.

  Indexes:
    unique constraint provides the composite index.

    idx_newsroom_bs_recipient
      ON newsroom_beat_subscriptions (recipient_id)
      -- J7 subscriptions management: journalist's list.

    idx_newsroom_bs_fanout
      ON newsroom_beat_subscriptions (company_id, notify_on)
      -- Server-side fanout: "who should be notified when
      -- company X fires a new_pack event?"

  Trigger:
    BEFORE UPDATE → set_updated_at()
    (Trigger exists for convention; no UPDATE policy, so
    never fires for authenticated. service_role may update
    for migration-grade operations.)

RLS POLICIES (D6)

Enable RLS on all four new tables:

  ALTER TABLE newsroom_claims ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_admin_users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_admin_audit_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_beat_subscriptions ENABLE ROW LEVEL SECURITY;

Reuse NR-D1 helper is_newsroom_editor_or_admin. One new
scenario requires checking admin membership: a helper for
"is this user an active admin?" would be useful but is NOT
a DB helper in v1 — the check is inlined in the
admin_audit_events SELECT policy. Admin role gating (viewer
vs. operator vs. security) lands in NR-D17 application layer.

newsroom_claims policies:

  POLICY newsroom_claims_select_org
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_claims.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Org editor/admin sees claims against their packs (P13).
    -- Admin queue (A4) reads via service_role.
    -- Reporter does NOT get authenticated SELECT — status
    -- updates are sent by email (NR-D18 RPC).

  -- No INSERT/UPDATE/DELETE policies. Claim file + status
  -- transitions via service_role RPCs (NR-D15 C1 intake;
  -- NR-D18 A5/A6 admin resolution).

newsroom_admin_users policies:

  POLICY newsroom_admin_users_select_self
    FOR SELECT
    USING (user_id = auth.uid())
    -- Admin sees own row. Admin console (A1) may need a
    -- "who else is admin?" view — lands in NR-D17 via
    -- service_role.

  -- No INSERT/UPDATE/DELETE policies. Role assignment is
  -- an ops action via service_role RPC in NR-D17/19.

newsroom_admin_audit_events policies:

  POLICY newsroom_aae_select_admin_any
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_admin_users au
        WHERE au.user_id = auth.uid()
          AND au.revoked_at IS NULL
      )
    )
    -- Any active admin (any role) sees the audit log. Role-
    -- level redaction (viewer gets truncated reason, etc.)
    -- lands in NR-D17/19 API layer.

  -- No INSERT/UPDATE/DELETE policies. Audit events written
  -- only by the atomic-commit pattern in NR-D17/18/19 RPCs
  -- under service_role.

newsroom_beat_subscriptions policies:

  POLICY newsroom_bs_select_self
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_recipients r
        WHERE r.id = newsroom_beat_subscriptions.recipient_id
          AND r.user_id = auth.uid()
      )
    )
    -- Signed-in journalist sees own subscriptions.

  POLICY newsroom_bs_insert_self
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM newsroom_recipients r
        WHERE r.id = newsroom_beat_subscriptions.recipient_id
          AND r.user_id = auth.uid()
      )
    )
    -- Signed-in journalist creates subscription rows on
    -- their own recipient.

  POLICY newsroom_bs_delete_self
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_recipients r
        WHERE r.id = newsroom_beat_subscriptions.recipient_id
          AND r.user_id = auth.uid()
      )
    )
    -- Signed-in journalist unsubscribes (DELETE own rows).

  -- No UPDATE policy. Subscriptions are delete-then-insert
  -- to change notify_on (prevents accidental semantic drift
  -- via UPDATE).

Total policy count: 6 (1 + 1 + 1 + 3).

TS ROW TYPES — src/lib/db/schema.ts (D7)

Append to the end of the file, after NR-D2c-i's
NewsroomDownloadReceiptRow block (file ends at approximately
line 915 per NR-D2c-i exit report §1). Follow the same
section convention.

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000005)
//
// Schema extensions Part C-ii: governance + subscriptions.
// Claims, admin users, admin audit events, beat subscriptions.
// FINAL schema directive of Phase NR-1.
// See docs/public-newsroom/directives/
//   NR-D2c-ii-claims-admin-subscriptions.md for canonical
//   semantics.
// ══════════════════════════════════════════════

export type NewsroomClaimReasonCategory =
  | 'trademark_infringement'
  | 'copyright'
  | 'defamation'
  | 'privacy'
  | 'embargo_breach'
  | 'other'

export type NewsroomClaimStatus =
  | 'submitted'
  | 'reviewing'
  | 'upheld'
  | 'dismissed'
  | 'withdrawn'

export type NewsroomAdminRole =
  | 'viewer'
  | 'reviewer'
  | 'operator'
  | 'security'

export type NewsroomAdminTargetType =
  | 'organization'
  | 'pack'
  | 'asset'
  | 'verification_record'
  | 'signing_key'
  | 'claim'

export type NewsroomBeatNotifyOn =
  | 'new_pack'
  | 'embargo_lift'
  | 'update'

export interface NewsroomClaimRow {
  id: string
  pack_id: string
  asset_id: string | null
  reporter_email: string
  reporter_name: string | null
  reason_category: NewsroomClaimReasonCategory
  reason_text: string
  status: NewsroomClaimStatus
  submitted_at: string
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAdminUserRow {
  user_id: string
  role: NewsroomAdminRole
  mfa_enabled: boolean
  assigned_at: string
  assigned_by_user_id: string | null
  revoked_at: string | null
  revoked_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface NewsroomAdminAuditEventRow {
  id: string
  admin_user_id: string
  cosigner_admin_user_id: string | null
  action: string
  target_type: NewsroomAdminTargetType
  target_id: string
  reason: string
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  source_ip: string | null
  occurred_at: string
  created_at: string
}

export interface NewsroomBeatSubscriptionRow {
  id: string
  recipient_id: string
  company_id: string
  notify_on: NewsroomBeatNotifyOn
  created_at: string
  updated_at: string
}

ROLLBACK (D8)

supabase/migrations/_rollbacks/20260425000005_newsroom_schema_d2c_ii.DOWN.sql

Symmetric DOWN migration. Reverse dependency order:

  1. DROP POLICY (6 policies)
  2. DROP TABLE newsroom_beat_subscriptions CASCADE
  3. DROP TABLE newsroom_admin_audit_events CASCADE
  4. DROP TABLE newsroom_admin_users CASCADE
  5. DROP TABLE newsroom_claims CASCADE
  6. DROP TYPE newsroom_beat_notify_on
  7. DROP TYPE newsroom_admin_target_type
  8. DROP TYPE newsroom_admin_role
  9. DROP TYPE newsroom_claim_status
  10. DROP TYPE newsroom_claim_reason_category

Header comment: inverse of 20260425000005 up migration;
does NOT touch NR-D1 / NR-D2a / NR-D2b / NR-D2c-i objects.
CASCADE drops delete any data in the four new tables if
present.

OUT OF SCOPE (hard boundaries)

- NO change to any existing migration file (20260425000001
  through 20260425000004).
- NO change to existing tables, enums, functions, or triggers.
- NO edits to src/lib/types.ts, src/lib/identity/*,
  src/lib/company-roles.ts, or any other existing source file.
- NO RPC functions (claim-file, admin-action-record,
  subscription-fanout, role-assignment all in later directives).
- NO pages, components, route handlers, API endpoints,
  seed data, vitest files.
- NO admin-role helper function at DB level (e.g.
  is_newsroom_admin_security). Role gating lands in
  NR-D17 API layer.
- NO public anon INSERT on newsroom_claims. Claim intake
  goes through service_role in the C1 API route (NR-D15)
  after email verification.
- NO fix of the PUBLIC-EXECUTE grant on NR-D1 helpers
  (v1.1 tightening per DIRECTIVE_SEQUENCE.md).
- NO subdomain middleware (NR-D3), domain libraries (NR-D4).

If you find you need something outside this list to make the
migration work, STOP and surface the blocker as an exit-report
open question. Do not expand scope silently.

VERIFY

Run these in order. Each must pass before moving to the next.

  # 1. Reset dev database with the new migration
  bun run supabase db reset

  # 2. TypeScript type-check
  bun run typecheck
  # If stale .next/types hits, rm -rf .next && retry.
  # expected: tsc --noEmit exit 0

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0, route count unchanged
  # from NR-D2c-i baseline (90 routes)

  # 4. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_claims"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_admin_users"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_admin_audit_events"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_beat_subscriptions"
  # expected: four tables present with columns, constraints,
  # indexes, triggers (claims + admin_users + beat_subs have
  # BEFORE UPDATE triggers; admin_audit_events is append-only
  # with no updated_at), RLS enabled on all four

  # 5. Enum inspection
  psql "$SUPABASE_DB_URL" -c \
    "\dT+ newsroom_claim_reason_category newsroom_claim_status newsroom_admin_role newsroom_admin_target_type newsroom_beat_notify_on"
  # expected: five enums present with correct values

  # 6. RLS policy inspection
  psql "$SUPABASE_DB_URL" -c \
    "SELECT polname, polrelid::regclass, polcmd FROM pg_policy
     WHERE polrelid::regclass::text IN (
       'newsroom_claims',
       'newsroom_admin_users',
       'newsroom_admin_audit_events',
       'newsroom_beat_subscriptions'
     )
     ORDER BY polrelid::regclass, polcmd"
  # expected: exactly 6 rows:
  #   newsroom_aae_select_admin_any     | newsroom_admin_audit_events | r
  #   newsroom_admin_users_select_self  | newsroom_admin_users        | r
  #   newsroom_bs_insert_self           | newsroom_beat_subscriptions | a
  #   newsroom_bs_delete_self           | newsroom_beat_subscriptions | d
  #   newsroom_bs_select_self           | newsroom_beat_subscriptions | r
  #   newsroom_claims_select_org        | newsroom_claims             | r

  # 7. Claim status-coherence CHECK smoke
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    DECLARE
      v_user_id    uuid;
      v_company_id uuid;
      v_pack_id    uuid;
    BEGIN
      INSERT INTO users (id, username, display_name, email)
      VALUES (gen_random_uuid(), 'nrd2cii-smoke',
              'NR-D2c-ii Smoke', 'nrd2cii-smoke@example.com')
      RETURNING id INTO v_user_id;

      INSERT INTO companies (name, slug, created_by_user_id)
      VALUES ('NR-D2c-ii Smoke Co', 'nrd2cii-smoke-co', v_user_id)
      RETURNING id INTO v_company_id;

      INSERT INTO newsroom_packs
        (company_id, slug, title, credit_line,
         licence_class, created_by_user_id)
      VALUES (v_company_id, 'nrd2cii-smoke-pack', 'Smoke',
              'Test', 'editorial_use_only', v_user_id)
      RETURNING id INTO v_pack_id;

      -- Should FAIL on newsroom_claims_status_resolution_coherence:
      -- status='submitted' with resolved_at set is incoherent.
      INSERT INTO newsroom_claims
        (pack_id, reporter_email, reason_category,
         reason_text, status, resolved_at)
      VALUES (v_pack_id,
              'reporter@example.com',
              'copyright',
              'This is a test reason of sufficient length to pass the 40-character minimum CHECK constraint.',
              'submitted',
              now());

      RAISE EXCEPTION 'nrd2cii-smoke-claim-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning
  # 'newsroom_claims_status_resolution_coherence'. Sentinel
  # must NOT appear.

  # 8. Admin MFA-required CHECK smoke
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    DECLARE
      v_user_id uuid;
    BEGIN
      INSERT INTO users (id, username, display_name, email)
      VALUES (gen_random_uuid(), 'nrd2cii-admin-smoke',
              'NR-D2c-ii Admin Smoke',
              'nrd2cii-admin-smoke@example.com')
      RETURNING id INTO v_user_id;

      -- Should FAIL on newsroom_admin_users_mfa_required:
      -- mfa_enabled = false is rejected.
      INSERT INTO newsroom_admin_users
        (user_id, role, mfa_enabled)
      VALUES (v_user_id, 'reviewer', false);

      RAISE EXCEPTION 'nrd2cii-smoke-admin-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning
  # 'newsroom_admin_users_mfa_required'. Sentinel must NOT
  # appear.

  # 9. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000005_newsroom_schema_d2c_ii.DOWN.sql
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname IN ('newsroom_claims',
                     'newsroom_admin_users',
                     'newsroom_admin_audit_events',
                     'newsroom_beat_subscriptions')"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT typname FROM pg_type
     WHERE typname IN ('newsroom_claim_reason_category',
                       'newsroom_claim_status',
                       'newsroom_admin_role',
                       'newsroom_admin_target_type',
                       'newsroom_beat_notify_on')"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname LIKE 'newsroom_%' ORDER BY relname"
  # expected: 15 tables (NR-D1: 4 + NR-D2a: 4 + NR-D2b: 4
  # + NR-D2c-i: 3). NR-D2c-ii rollback must not regress prior
  # substrate.

  # 10. Restore
  bun run supabase db reset
  # expected: all migrations through 20260425000005 re-apply;
  # post-state: 19 newsroom_* tables

EXIT REPORT

Required sections. Each is a first-class heading:

1. Summary — files created/edited with line counts and
   one-line descriptions. Migration size. TS schema edit
   line count. Per-table object counts (cols, indexes,
   CHECKs, FKs out, FKs in, policies, triggers).

2. Decisions that diverged — if none, state "no divergence".
   Same SQLSTATE 42P17 halt protocol.

3. Open questions for founder — anything ambiguous. Minimum:
   flag if you found a reason to modify any existing file.

4. RLS verification results — outputs of VERIFY steps 6, 7,
   8. Redact any PII.

5. Build results — exit codes and route counts for VERIFY
   steps 2, 3.

6. Rollback verification — output of VERIFY step 9 (tables,
   enums all gone; prior 15 tables intact).

7. Verdict — self-assessment.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Five enums.** Four are straightforward controlled vocabularies (claim reason, claim status, admin role, beat notify_on). `newsroom_admin_target_type` enumerates what admin actions can target — keeping the enum small and closed (6 values) because each entry gates admin UI code paths in NR-D17/18/19.

**D2 — Claim `reason_text` min 40 chars at DB level.** PRD C1 validates at form layer; DB enforces defence in depth. Status-resolution coherence CHECK enforces the two-state shape (open: submitted/reviewing with null resolved_at; closed: upheld/dismissed/withdrawn with set resolved_at).

**D3 — AdminUser MFA required via CHECK.** `CHECK (mfa_enabled = true)`. An admin row cannot exist without MFA. The actual MFA enforcement at sign-in is an application-layer concern (NR-D17); this CHECK is defence in depth. `assigned_by_user_id != user_id` prevents self-promotion.

**D4 — AdminAuditEvent `action` is text, `target_type` is enum.** Action vocabulary will expand across NR-D17/18/19; enum migrations are painful. `target_type` is a small closed set tied to code paths; enum is the right shape. `source_ip` uses Postgres `inet` native type for IPv4/IPv6 support and proper indexing.

**D5 — BeatSubscription has three rows per (recipient, org) pair when all three notify_on are on.** One row per (recipient, company, notify_on) with UNIQUE enforcing the triple. Toggling notification type is delete-then-insert. No UPDATE policy prevents accidental semantic drift (e.g. flipping notify_on via UPDATE instead of proper delete-recreate).

**D6 — RLS posture.** Claims: org editor/admin sees claims against their packs (P13 distributor view); admin queue A4 reads via service_role; reporter gets email updates, no authenticated SELECT path. Admin users: self-view only (admin directory via service_role). Admin audit events: any active admin sees all (role-level redaction at NR-D17 API layer). Beat subscriptions: SELECT + INSERT + DELETE for self via recipient.user_id match.

**D7 — TS row types append-only.** Five enums + four interfaces. `Record<string, unknown>` for before_state / after_state jsonb columns.

**D8 — Rollback order.** Tables with no inter-NR-D2c-ii FKs; any order works. Reverse creation order for cleanliness. Enums dropped in reverse creation order.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean | VERIFY 1 |
| **AC2** | TypeScript compiles | VERIFY 2 |
| **AC3** | Build exits 0; route count unchanged (90) | VERIFY 3 |
| **AC4** | Four tables present with columns, constraints, indexes, RLS enabled | VERIFY 4 |
| **AC5** | Five new enums present | VERIFY 5 |
| **AC6** | Exactly 6 RLS policies (1+1+1+3) | VERIFY 6 |
| **AC7** | Claim status-coherence CHECK rejects incoherent inserts | VERIFY 7 |
| **AC8** | Admin MFA-required CHECK rejects mfa_enabled=false | VERIFY 8 |
| **AC9** | DOWN removes all NR-D2c-ii objects without regressing prior 15 tables | VERIFY 9 |
| **AC10** | Restore brings DB to 19-table up-state | VERIFY 10 |
| **AC11** | No modification to any file beyond the three deliverables | Git diff review |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D2c-i exit report approved; commit on feat/newsroom-phase-nr-1 | Confirmed 2026-04-24 — `f4af1f2` |
| **DC2** | `feat/newsroom-phase-nr-1` is current branch | `git branch --show-current` |
| **DC3** | Dev Supabase DB in NR-D2c-i up-state (15 newsroom_* tables) | `\dt newsroom_*` |
| **DC4** | Build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC5** | `.claude/agents/` reference present | `ls .claude/agents/` |
| **DC6** | Dev Supabase DB is disposable | Confirm before dispatch |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D2c-ii.** This closes Phase NR-1 schema-extension work. After this directive's exit report clears, Phase NR-1 continues with NR-D3 (subdomain routing) and NR-D4 (domain libraries) to close NR-G1.
