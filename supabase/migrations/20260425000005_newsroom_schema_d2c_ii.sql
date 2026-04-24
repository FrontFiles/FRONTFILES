-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Newsroom Schema Extensions, Part C-ii (NR-D2c-ii)
--
-- Governance + subscriptions substrate for the Newsroom v1
-- subsystem.  FINAL schema directive of Phase NR-1.
--
--   Enums (5):
--     newsroom_claim_reason_category
--     newsroom_claim_status
--     newsroom_admin_role
--     newsroom_admin_target_type
--     newsroom_beat_notify_on
--
--   Tables (4):
--     newsroom_claims                  — public claim intake
--     newsroom_admin_users             — admin identity layer
--     newsroom_admin_audit_events      — append-only admin audit log
--     newsroom_beat_subscriptions      — journalist consumer notif
--
--   RLS policies on all four new tables (6 total):
--     claims:              1 SELECT (org editor/admin)
--     admin_users:         1 SELECT (self)
--     admin_audit_events:  1 SELECT (active admin — any row)
--     beat_subscriptions:  3 (SELECT / INSERT / DELETE — self)
--   NO INSERT / UPDATE / DELETE on claims, admin_users, or
--   admin_audit_events for authenticated — service_role only
--   via NR-D15 (C1 intake), NR-D17/19 (admin role mgmt),
--   NR-D18 (admin resolution + audit writers).
--
-- REFERENCES (NOT MODIFIED):
--   users, companies, newsroom_packs, newsroom_assets,
--   newsroom_recipients, set_updated_at(),
--   is_newsroom_editor_or_admin(uuid), auth.uid (Supabase).
--
-- NO MUTATION TO ANY EXISTING OBJECT.  All FKs from the four
-- new tables point at existing objects; no ALTER on any
-- pre-existing table is required.
--
-- GOVERNING DOCS:
--   docs/public-newsroom/PRD.md                       (authority)
--   docs/public-newsroom/BUILD_CHARTER.md             (scope + mapping lock)
--   docs/public-newsroom/DIRECTIVE_SEQUENCE.md        (place in sequence)
--   docs/public-newsroom/directives/NR-D2c-ii-claims-admin-subscriptions.md
--
-- DEPENDS ON:
--   Migration 20260425000001 (NR-D1 — newsroom_packs,
--                             newsroom_assets, set_updated_at,
--                             is_newsroom_editor_or_admin;
--                             companies, users predecessors).
--   Migration 20260425000003 (NR-D2b — newsroom_recipients;
--                             beat_subscriptions FKs into it).
--
-- OUT OF SCOPE (hard boundary — NOT landing here):
--   - Admin-role helper function (e.g.
--     is_newsroom_admin_security).  Role gating lands in
--     NR-D17 API layer.
--   - Public anon INSERT on newsroom_claims.  C1 intake runs
--     under service_role in NR-D15 after email verification.
--   - RPCs (claim-file, admin-action-record,
--     subscription-fanout, role-assignment) — later directives.
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/20260425000005_newsroom_schema_d2c_ii.DOWN.sql
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUMS                                                  │
-- │                                                             │
-- │  Five Newsroom-specific governance primitives.  Scoped to   │
-- │  this subsystem; do not extend any existing enum.           │
-- │                                                             │
-- │  Intentionally NOT introducing a newsroom_admin_action      │
-- │  enum — the action vocabulary will expand across NR-D17 /   │
-- │  NR-D18 / NR-D19 RPCs and enum ALTERs are painful.  The     │
-- │  audit table uses a text `action` column with non-empty +   │
-- │  length CHECKs at the DB layer; app layer validates         │
-- │  against a controlled set.                                  │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE newsroom_claim_reason_category AS ENUM (
  'trademark_infringement',
  'copyright',
  'defamation',
  'privacy',
  'embargo_breach',
  'other'
);

CREATE TYPE newsroom_claim_status AS ENUM (
  'submitted',
  'reviewing',
  'upheld',
  'dismissed',
  'withdrawn'
);

CREATE TYPE newsroom_admin_role AS ENUM (
  'viewer',
  'reviewer',
  'operator',
  'security'
);

CREATE TYPE newsroom_admin_target_type AS ENUM (
  'organization',
  'pack',
  'asset',
  'verification_record',
  'signing_key',
  'claim'
);

CREATE TYPE newsroom_beat_notify_on AS ENUM (
  'new_pack',
  'embargo_lift',
  'update'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  newsroom_claims                                        │
-- │                                                             │
-- │  One row per submitted claim.  Created by the public C1     │
-- │  intake form under service_role (NR-D15) after email        │
-- │  verification; status transitions managed by the admin      │
-- │  A4/A5 flow under service_role (NR-D18).                    │
-- │                                                             │
-- │  Lifecycle (PRD §5.2 C1):                                   │
-- │    submitted → reviewing → upheld | dismissed | withdrawn   │
-- │  Resolved_at is NULL while {submitted, reviewing} and       │
-- │  NOT NULL in the three terminal states.  CHECK enforces     │
-- │  the pairing; resolution_note is nullable text that admins  │
-- │  may populate during the A5 resolution step.                │
-- │                                                             │
-- │  FK policy:                                                 │
-- │    - pack_id RESTRICT: claims outlive pack takedowns for    │
-- │      audit; pack must not be deleted while claims           │
-- │      reference it.                                          │
-- │    - asset_id RESTRICT: same at asset granularity.          │
-- │    NO recipient_id FK — claim reporters use email-only      │
-- │    identity (reporter_email / reporter_name); a reporter    │
-- │    may never be a Frontfiles user and we do not create      │
-- │    newsroom_recipients rows for claim intake.               │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id           uuid NOT NULL
                      REFERENCES newsroom_packs(id) ON DELETE RESTRICT,
  asset_id          uuid
                      REFERENCES newsroom_assets(id) ON DELETE RESTRICT,

  reporter_email    text NOT NULL,
  reporter_name     text,

  reason_category   newsroom_claim_reason_category NOT NULL,
  reason_text       text NOT NULL,

  status            newsroom_claim_status NOT NULL DEFAULT 'submitted',
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  resolution_note   text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- PRD §5.2 C1: "Reason text (required, min 40 chars)."
  -- Enforced at DB level defensively.
  CONSTRAINT newsroom_claims_reason_text_min_length CHECK (
    length(reason_text) >= 40
  ),

  -- Pragmatic email pattern: has @, has dot in domain, no
  -- whitespace.  Same shape as NR-D2b
  -- newsroom_recipients_email_format.
  CONSTRAINT newsroom_claims_reporter_email_format CHECK (
    reporter_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),

  -- Status ↔ resolved_at coherence:
  --   open states (submitted, reviewing)        ⇒ resolved_at NULL
  --   terminal states (upheld, dismissed,
  --                    withdrawn)                ⇒ resolved_at NOT NULL
  CONSTRAINT newsroom_claims_status_resolution_coherence CHECK (
    (status IN ('submitted', 'reviewing') AND resolved_at IS NULL)
    OR
    (status IN ('upheld', 'dismissed', 'withdrawn') AND resolved_at IS NOT NULL)
  )
);

COMMENT ON TABLE newsroom_claims IS
  'Public claim intake — one row per submitted claim.  Created '
  'under service_role by the C1 API route (NR-D15) after email '
  'verification; admin A4/A5 resolution flow (NR-D18) mutates '
  'status.  Reporter identity is email-only (no FK to '
  'newsroom_recipients); reporters may not be Frontfiles users.';

COMMENT ON COLUMN newsroom_claims.reason_text IS
  'Min 40 chars (PRD §5.2 C1).  Defensive CHECK at DB level; '
  'app-layer validation is the primary gate at the C1 form.';

-- ── Indexes ──

-- P13 distributor-side claim list for a pack (most recent first).
CREATE INDEX idx_newsroom_claims_pack_time
  ON newsroom_claims (pack_id, submitted_at DESC);

-- A4 admin queue: unresolved claims by age.  Enum-constant
-- predicate → IMMUTABLE.  Safe per NR-D1 exit report §2 lesson.
CREATE INDEX idx_newsroom_claims_open_queue
  ON newsroom_claims (submitted_at DESC)
  WHERE status IN ('submitted', 'reviewing');

-- Admin filtering by category.
CREATE INDEX idx_newsroom_claims_category_time
  ON newsroom_claims (reason_category, submitted_at DESC);

CREATE TRIGGER trg_newsroom_claims_updated_at
  BEFORE UPDATE ON newsroom_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  newsroom_admin_users                                   │
-- │                                                             │
-- │  One row per admin.  Extension of `users` via user_id PK    │
-- │  (per Build Charter §4).  A user is an admin iff this row   │
-- │  exists AND revoked_at IS NULL.                             │
-- │                                                             │
-- │  MFA invariant: PRD §5.5 A1 requires TOTP MFA for every     │
-- │  admin role.  The CHECK (mfa_enabled = true) prevents an    │
-- │  admin row existing without MFA enrolled.  Application      │
-- │  layer validates at sign-in (NR-D16); DB is defence in      │
-- │  depth.                                                     │
-- │                                                             │
-- │  FK policy:                                                 │
-- │    - user_id RESTRICT: admin identity anchored to the       │
-- │      users row; a user cannot be deleted while an admin     │
-- │      assignment exists (even revoked — audit trail         │
-- │      relevance).                                            │
-- │    - assigned_by_user_id SET NULL: if the assigner leaves   │
-- │      the system, the assignment record survives without     │
-- │      the attribution pointer.                               │
-- │    - revoked_by_user_id SET NULL: same symmetry.            │
-- │                                                             │
-- │  NO admin-role helper function at DB level (e.g.            │
-- │  is_newsroom_admin_security).  Role gating lives at the     │
-- │  NR-D17 API layer; DB layer only knows "is this a           │
-- │  non-revoked admin?" via the audit-events policy JOIN.      │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_admin_users (
  user_id               uuid PRIMARY KEY
                          REFERENCES users(id) ON DELETE RESTRICT,

  role                  newsroom_admin_role NOT NULL,
  mfa_enabled           boolean NOT NULL,

  assigned_at           timestamptz NOT NULL DEFAULT now(),
  assigned_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,

  revoked_at            timestamptz,
  revoked_by_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- MFA required for every admin role (PRD §5.5 A1).  Defence
  -- in depth: app layer validates at sign-in, DB prevents the
  -- row from existing without MFA enrolled.
  CONSTRAINT newsroom_admin_users_mfa_required CHECK (
    mfa_enabled = true
  ),

  -- Revocation coherence: revoked_at NULL ⇒ revoked_by NULL.
  -- A non-revoked row carries no revoker attribution.
  CONSTRAINT newsroom_admin_users_revoked_coherence CHECK (
    (revoked_at IS NULL AND revoked_by_user_id IS NULL)
    OR
    (revoked_at IS NOT NULL)
  ),

  -- Self-assignment defence: an admin cannot assign themselves.
  -- NULL is permitted (e.g. bootstrap-seeded admin with no
  -- known assigner).
  CONSTRAINT newsroom_admin_users_assigner_not_self CHECK (
    assigned_by_user_id IS NULL
    OR assigned_by_user_id != user_id
  )
);

COMMENT ON TABLE newsroom_admin_users IS
  'Admin identity layer — extension of users.  A user is an '
  'admin iff this row exists AND revoked_at IS NULL.  MFA '
  'required for every row (PRD §5.5 A1 / DB-level CHECK).  '
  'Role assignment / revocation via service_role RPC in '
  'NR-D17/NR-D19.';

-- ── Indexes ──

-- user_id uniqueness enforced at PK level.

-- Admin role-filtering ("all non-revoked security admins").
-- Predicate is column-nullness → IMMUTABLE.  Safe per NR-D1
-- exit report §2 lesson.
CREATE INDEX idx_newsroom_admin_users_active_role
  ON newsroom_admin_users (role)
  WHERE revoked_at IS NULL;

CREATE TRIGGER trg_newsroom_admin_users_updated_at
  BEFORE UPDATE ON newsroom_admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  newsroom_admin_audit_events                            │
-- │                                                             │
-- │  Append-only admin audit log — one row per admin action.    │
-- │  NO updated_at column, no update trigger, no UPDATE policy. │
-- │  Rows are immutable by construction.                        │
-- │                                                             │
-- │  `action` is a text column (not an enum) because the        │
-- │  vocabulary expands across NR-D17/18/19 RPCs and enum       │
-- │  migrations are painful.  DB enforces non-empty + length    │
-- │  ≤ 80; app layer validates against a controlled set.        │
-- │                                                             │
-- │  `source_ip` uses Postgres `inet` type for native IPv4 +    │
-- │  IPv6 support, indexable and comparable without casting.    │
-- │                                                             │
-- │  `target_id` is a plain uuid with no FK — target_type       │
-- │  dispatches across multiple tables (organization → company, │
-- │  pack → newsroom_packs, asset → newsroom_assets,            │
-- │  verification_record → newsroom_verification_records,       │
-- │  signing_key → newsroom_signing_keys, claim →               │
-- │  newsroom_claims).  Polymorphic FKs are an anti-pattern in  │
-- │  PG; the (target_type, target_id) index supports the A8     │
-- │  "filter by target entity" query path without them.         │
-- │                                                             │
-- │  FK policy:                                                 │
-- │    - admin_user_id RESTRICT: the acting admin must remain   │
-- │      referencable for the audit trail.                      │
-- │    - cosigner_admin_user_id RESTRICT: same for the          │
-- │      co-signer when present.                                │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_admin_audit_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  admin_user_id           uuid NOT NULL
                            REFERENCES users(id) ON DELETE RESTRICT,
  cosigner_admin_user_id  uuid
                            REFERENCES users(id) ON DELETE RESTRICT,

  action                  text NOT NULL,
  target_type             newsroom_admin_target_type NOT NULL,
  target_id               uuid NOT NULL,

  reason                  text NOT NULL,
  before_state            jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state             jsonb NOT NULL DEFAULT '{}'::jsonb,

  source_ip               inet,

  occurred_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_aae_action_nonempty CHECK (
    length(action) > 0 AND length(action) <= 80
  ),

  -- PRD Part 6 §6.4 point 2: "Reason capture is blocking;
  -- required min 10 chars."
  CONSTRAINT newsroom_aae_reason_min_length CHECK (
    length(reason) >= 10
  ),

  -- Co-signer must be a distinct admin from the initiating
  -- admin (two-key ceremony semantics).  NULL cosigner is
  -- permitted for single-admin actions.
  CONSTRAINT newsroom_aae_cosigner_distinct CHECK (
    cosigner_admin_user_id IS NULL
    OR cosigner_admin_user_id != admin_user_id
  )
);

COMMENT ON TABLE newsroom_admin_audit_events IS
  'Append-only admin audit log.  No updated_at column; rows '
  'immutable by construction.  `target_id` is a plain uuid '
  '(polymorphic across target_type values) — no FK.  '
  'source_ip uses Postgres `inet` type for native v4+v6 '
  'support.';

-- ── Indexes ──

-- A8 audit log viewer: filter by admin (most recent first).
CREATE INDEX idx_newsroom_aae_admin_time
  ON newsroom_admin_audit_events (admin_user_id, occurred_at DESC);

-- A8 filter by target entity (covers polymorphic target_id
-- lookup without a cross-table FK).
CREATE INDEX idx_newsroom_aae_target
  ON newsroom_admin_audit_events (target_type, target_id);

-- Default chronological A8 view.
CREATE INDEX idx_newsroom_aae_time
  ON newsroom_admin_audit_events (occurred_at DESC);

-- A8 "co-signed only" filter.  Partial: single-admin rows
-- don't contribute to this access pattern.
CREATE INDEX idx_newsroom_aae_cosigned
  ON newsroom_admin_audit_events (occurred_at DESC)
  WHERE cosigner_admin_user_id IS NOT NULL;

-- NO trigger — events are immutable, no updated_at column.


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  newsroom_beat_subscriptions                            │
-- │                                                             │
-- │  One row per (recipient, company, notify_on) triple.  A    │
-- │  journalist can subscribe to multiple notification types   │
-- │  for the same newsroom — new_pack, embargo_lift, update     │
-- │  are separate rows.                                         │
-- │                                                             │
-- │  v1-thin scoping: subscriptions are newsroom-wide (the      │
-- │  company_id grain) with no topic taxonomy.  A topic /       │
-- │  beat hierarchy can layer on in v1.1 without breaking       │
-- │  this schema.                                               │
-- │                                                             │
-- │  FK policy:                                                 │
-- │    - recipient_id CASCADE: subscription disappears on       │
-- │      recipient deletion (GDPR Art. 17 erasure).             │
-- │    - company_id CASCADE: subscription disappears on         │
-- │      company deletion (rare — org suspension keeps the      │
-- │      companies row alive).                                  │
-- │                                                             │
-- │  No UPDATE path — toggle off = DELETE, toggle on = INSERT.  │
-- │  The unique triple UNIQUE supports the upsert-as-INSERT-    │
-- │  ON-CONFLICT-DO-NOTHING pattern for idempotent opt-ins.     │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_beat_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_id     uuid NOT NULL
                     REFERENCES newsroom_recipients(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL
                     REFERENCES companies(id) ON DELETE CASCADE,
  notify_on        newsroom_beat_notify_on NOT NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- One row per (recipient, company, notify_on).  Toggle a
  -- notification off = DELETE; toggle on = INSERT.  No UPDATE
  -- path needed.
  CONSTRAINT newsroom_bs_unique_per_notify
    UNIQUE (recipient_id, company_id, notify_on)
);

COMMENT ON TABLE newsroom_beat_subscriptions IS
  'Consumer-notification primitive — one row per (recipient, '
  'company, notify_on) triple.  v1-thin: newsroom-wide scope, '
  'no topic taxonomy.  Self-service via J7 under '
  'authenticated RLS (not service_role).';

-- ── Indexes ──

-- The unique constraint provides the (recipient_id, company_id,
-- notify_on) composite index.

-- J7 subscription-management view: "my subscriptions".
CREATE INDEX idx_newsroom_bs_recipient
  ON newsroom_beat_subscriptions (recipient_id);

-- Server-side fanout: "who should be notified when company X
-- fires a new_pack event?" (NR-D14 fanout worker).
CREATE INDEX idx_newsroom_bs_fanout
  ON newsroom_beat_subscriptions (company_id, notify_on);

CREATE TRIGGER trg_newsroom_bs_updated_at
  BEFORE UPDATE ON newsroom_beat_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  RLS POLICIES                                           │
-- │                                                             │
-- │  Enable RLS on all four new tables.  Reuses the NR-D1       │
-- │  helper is_newsroom_editor_or_admin(uuid).                  │
-- │                                                             │
-- │  POSTURE SUMMARY:                                           │
-- │    - claims:              1 SELECT policy (editors /        │
-- │                           admins of the pack's org).  No    │
-- │                           INSERT policy — C1 intake is a    │
-- │                           service_role RPC (NR-D15) after   │
-- │                           email-verification outside the    │
-- │                           table's trust boundary.  No       │
-- │                           UPDATE policy — status transitions│
-- │                           are admin A5/A6 service_role      │
-- │                           (NR-D18).                         │
-- │    - admin_users:         1 SELECT policy (self; admins     │
-- │                           see only their own row).  No      │
-- │                           INSERT/UPDATE/DELETE — role mgmt  │
-- │                           is service_role (NR-D17/NR-D19).  │
-- │                           No bulk admin-list policy — that  │
-- │                           surface lives in NR-D17 via       │
-- │                           service_role.                     │
-- │    - admin_audit_events:  1 SELECT policy (any active       │
-- │                           admin sees any audit row — the    │
-- │                           A8 log viewer).  No role          │
-- │                           gating at DB level (v1);           │
-- │                           NR-D17 API may add further        │
-- │                           server-side filtering.  Append-   │
-- │                           only — no INSERT/UPDATE/DELETE    │
-- │                           policy (service_role only).       │
-- │    - beat_subscriptions:  3 policies — authenticated        │
-- │                           journalist self-service           │
-- │                           (SELECT / INSERT / DELETE).  No   │
-- │                           UPDATE — subscriptions are        │
-- │                           delete-then-insert.  recipient_id │
-- │                           ↔ auth.uid() identity check on    │
-- │                           all three.                        │
-- │                                                             │
-- │  Total policy count: 6 (1 + 1 + 1 + 3).                     │
-- │                                                             │
-- │  service_role bypasses RLS by default (Supabase convention) │
-- │  and is what C1 intake, admin RPCs, audit writers, and      │
-- │  fanout workers use for the operations not granted to       │
-- │  authenticated below.                                       │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_claims              ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_admin_audit_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_beat_subscriptions  ENABLE ROW LEVEL SECURITY;

-- ── newsroom_claims ──

-- Editors / admins of the pack's company see claims filed
-- against their own packs (drives the P13 distributor claim
-- list).  Anon does not see claims.  Claim reporters do not
-- see historical claims — the C1 intake flow is fire-and-
-- forget with an email confirmation (NR-D15).
CREATE POLICY newsroom_claims_select_org
  ON newsroom_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_claims.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- INSERT / UPDATE / DELETE: service_role only.
--   C1 intake → NR-D15 API route (email-verified service_role).
--   A5/A6 resolution → NR-D18 admin RPC.

-- ── newsroom_admin_users ──

-- Admins see only their own row.  No bulk admin-list policy at
-- DB level — that surface (NR-D17 admin directory) runs under
-- service_role and renders only columns appropriate for the
-- calling admin's role.
CREATE POLICY newsroom_admin_users_select_self
  ON newsroom_admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT / UPDATE / DELETE: service_role only.
--   Role assignment / revocation → NR-D17 or NR-D19 RPC.

-- ── newsroom_admin_audit_events ──

-- Any active (non-revoked) admin can SELECT any audit row —
-- this drives the A8 audit log viewer.  No role gating at DB
-- level in v1; NR-D17 API layer may add further server-side
-- filtering when the viewer UI lands.
CREATE POLICY newsroom_aae_select_admin_any
  ON newsroom_admin_audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );

-- INSERT / UPDATE / DELETE: service_role only.  Append-only
-- also enforced structurally (no updated_at column, no UPDATE
-- policy).  Audit writers in NR-D17/18/19 emit rows.

-- ── newsroom_beat_subscriptions ──

-- Journalist self-service (J7 UI).  recipient_id ↔ auth.uid()
-- via newsroom_recipients.user_id — authenticated journalists
-- whose users.id matches the recipient's linked user_id can
-- view, add, and remove their own subscriptions.  Anonymous
-- visitors never have beat subscriptions (recipient creation
-- is email-first at invite time — NR-D2b).

CREATE POLICY newsroom_bs_select_self
  ON newsroom_beat_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_recipients r
      WHERE r.id = newsroom_beat_subscriptions.recipient_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY newsroom_bs_insert_self
  ON newsroom_beat_subscriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM newsroom_recipients r
      WHERE r.id = newsroom_beat_subscriptions.recipient_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY newsroom_bs_delete_self
  ON newsroom_beat_subscriptions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_recipients r
      WHERE r.id = newsroom_beat_subscriptions.recipient_id
        AND r.user_id = auth.uid()
    )
  );

-- UPDATE: NO POLICY (subscriptions are delete-then-insert).
