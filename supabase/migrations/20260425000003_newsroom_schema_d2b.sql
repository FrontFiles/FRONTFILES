-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Newsroom Schema Extensions, Part B (NR-D2b)
--
-- Embargo workflow + consumer-identity substrate for the Newsroom
-- v1 subsystem:
--
--   Enum (1):
--     newsroom_embargo_state
--
--   Tables (4):
--     newsroom_outlets              — one row per outlet (pub)
--     newsroom_recipients           — email-first consumer identity
--     newsroom_embargoes            — 1:1 with newsroom_packs
--     newsroom_embargo_recipients   — (embargo, recipient) pair
--
--   Deferred FK validation:
--     newsroom_packs.embargo_id →
--       newsroom_embargoes(id)  ON DELETE SET NULL
--     (NOT VALID + VALIDATE CONSTRAINT pattern from migration
--      20260413230015 §4, reused in NR-D2a §6.)
--
--   RLS policies on all four new tables (4 total, all SELECT):
--     outlets:             1 SELECT (public)
--     recipients:          1 SELECT (self OR inviting org)
--     embargoes:           1 SELECT (inviting org)
--     embargo_recipients:  1 SELECT (inviting org OR self)
--   INSERT / UPDATE / DELETE not granted to authenticated on ANY
--   of the four tables — mutations routed through service_role
--   RPCs in NR-D8 / NR-D9 / NR-D14 (token generation, domain
--   parsing, atomic email send, entropy source control).
--
-- REFERENCES (NOT MODIFIED, except for the single ALTER below):
--   users, newsroom_packs,
--   set_updated_at(), is_newsroom_editor_or_admin(uuid),
--   auth.uid (Supabase).
--
-- THE ONLY MUTATION TO AN EXISTING OBJECT:
--   §6 ALTER TABLE newsroom_packs ADD CONSTRAINT
--   fk_newsroom_packs_embargo (NOT VALID then VALIDATE).
--   The embargo_id column itself was created by NR-D1 as a plain
--   uuid with a deferred-FK comment; this directive validates the
--   FK now that newsroom_embargoes exists.
--
-- PACK VISIBILITY CHECK — NOT STRENGTHENED:
--   DIRECTIVE_SEQUENCE's earlier note proposed strengthening the
--   NR-D1 newsroom_packs_status_visibility_coherence CHECK to
--   honour embargo presence for (scheduled, restricted).  On
--   review, a CHECK cannot reference another table's state;
--   triggers and subquery-IMMUTABLE-wrapper antipatterns are both
--   unacceptable.  The cross-table invariant moves to the NR-D9
--   Pack-state-transition RPC, which has a clean seam for pre-
--   write invariant checks and produces deterministic error
--   payloads for the UI.  No change to the NR-D1 CHECK in this
--   directive.
--
-- GOVERNING DOCS:
--   docs/public-newsroom/PRD.md                       (authority)
--   docs/public-newsroom/BUILD_CHARTER.md             (scope + mapping lock)
--   docs/public-newsroom/DIRECTIVE_SEQUENCE.md        (place in sequence)
--   docs/public-newsroom/directives/NR-D2b-embargo-consumer-identity.md
--
-- DEPENDS ON:
--   Migration 20260425000001 (NR-D1 — newsroom_packs, RLS helper
--                             functions, set_updated_at,
--                             users table reference).
--   Migration 20260425000002 (NR-D2a — predecessor; establishes
--                             the NOT VALID + VALIDATE pattern
--                             mirrored here for embargo_id).
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/20260425000003_newsroom_schema_d2b.DOWN.sql
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUM                                                   │
-- │                                                             │
-- │  One Newsroom-specific workflow primitive: the three legal  │
-- │  embargo states.  Lifecycle: active → lifted | cancelled    │
-- │  (terminal).  Timestamps (lifted_at, cancelled_at) paired   │
-- │  via the state-coherence CHECK on newsroom_embargoes §4.    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE newsroom_embargo_state AS ENUM (
  'active',
  'lifted',
  'cancelled'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  newsroom_outlets                                       │
-- │                                                             │
-- │  One row per outlet (publication).  Auto-created in NR-D5 / │
-- │  NR-D14 when a Recipient's email domain is first            │
-- │  encountered; domain is the natural unique key.  name is    │
-- │  display-only and may be admin-edited (v1.1 surface).       │
-- │                                                             │
-- │  verified is reserved for the v1.1 outlet-verification      │
-- │  path; default false, no policy enforcement in v1.  Keeping │
-- │  the column avoids a schema change when that path ships.    │
-- │                                                             │
-- │  Domain format CHECK matches the NR-D1                      │
-- │  newsroom_profiles_domain_format pattern for consistency.   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_outlets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name        text NOT NULL,
  domain      text NOT NULL,
  verified    boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_outlets_domain_unique UNIQUE (domain),

  -- FQDN pattern (lowercase, hyphen-permitted labels, ≥2 parts).
  -- Same shape as NR-D1 newsroom_profiles_domain_format.
  CONSTRAINT newsroom_outlets_domain_format CHECK (
    domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),

  CONSTRAINT newsroom_outlets_name_nonempty CHECK (length(name) > 0)
);

COMMENT ON TABLE newsroom_outlets IS
  'Outlet directory — one row per publication, keyed by domain.  '
  'Auto-created on first Recipient invite whose email domain is '
  'new (NR-D5 / NR-D14, service_role).  verified flag reserved '
  'for v1.1 outlet-verification path; default false.';

-- ── Indexes ──

-- Partial index for the v1.1 "verified outlets only" filter on
-- the distributor analytics surface.  Predicate is IMMUTABLE
-- (column-constant).  Safe per NR-D1 exit report §2 lesson.
CREATE INDEX idx_newsroom_outlets_verified
  ON newsroom_outlets (domain)
  WHERE verified = true;

CREATE TRIGGER trg_newsroom_outlets_updated_at
  BEFORE UPDATE ON newsroom_outlets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  newsroom_recipients                                    │
-- │                                                             │
-- │  One row per identified consumer, keyed by email.  Path A   │
-- │  locked: email-first (Build Charter §4, founder confirmed   │
-- │  2026-04-24).  Row created on first embargo invite          │
-- │  regardless of whether the email has a Frontfiles user      │
-- │  account.  user_id populated later when the same email      │
-- │  signs up as a journalist via J1 (email-match upsert at the │
-- │  RPC layer in NR-D14).  Anonymous visitors get no Recipient │
-- │  row; tracked via anon_session_id on events only (NR-D2c).  │
-- │                                                             │
-- │  verified is reserved for v1.1 outlet-/journalist-          │
-- │  verification; default false, no policy enforcement in v1.  │
-- │                                                             │
-- │  ON DELETE SET NULL on user_id — a Recipient predates user  │
-- │  signup and survives user deletion (email identity persists │
-- │  as the invite address).                                    │
-- │  ON DELETE SET NULL on outlet_id — deleting an outlet       │
-- │  clears the association without cascading to the Recipient. │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_recipients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email       text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  outlet_id   uuid REFERENCES newsroom_outlets(id) ON DELETE SET NULL,
  name        text,
  verified    boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_recipients_email_unique UNIQUE (email),

  -- Pragmatic email pattern: has @, has dot in domain, no
  -- whitespace.  Not RFC 5321-exhaustive; sufficient for a
  -- store-and-lookup key.  Stricter format validation lives at
  -- the application layer (NR-D14 invite RPC).
  CONSTRAINT newsroom_recipients_email_format CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

COMMENT ON TABLE newsroom_recipients IS
  'Consumer-identity substrate — one row per identified '
  'recipient, keyed by email.  Path A (email-first): created on '
  'first embargo invite; user_id populated on later J1 signup '
  'via email-match upsert (NR-D14 RPC).  verified flag reserved '
  'for v1.1; default false.';

COMMENT ON COLUMN newsroom_recipients.email IS
  'Stable identity — UNIQUE.  Upserts keyed by email at the RPC '
  'layer (NR-D14).  Lowercasing / trimming happens before insert '
  'in the RPC, not enforced by a DB trigger.';

COMMENT ON COLUMN newsroom_recipients.user_id IS
  'NULL until the same email signs up as a Frontfiles user via '
  'J1.  ON DELETE SET NULL — a Recipient outlives its user row '
  '(email-first identity).';

-- ── Indexes ──

-- Partial index for the J1 signup flow: "find existing Recipient
-- by user_id" after linking by email match.
CREATE INDEX idx_newsroom_recipients_user
  ON newsroom_recipients (user_id)
  WHERE user_id IS NOT NULL;

-- Partial index for the distributor analytics surface
-- ("recipients by outlet").
CREATE INDEX idx_newsroom_recipients_outlet
  ON newsroom_recipients (outlet_id)
  WHERE outlet_id IS NOT NULL;

CREATE TRIGGER trg_newsroom_recipients_updated_at
  BEFORE UPDATE ON newsroom_recipients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  newsroom_embargoes                                     │
-- │                                                             │
-- │  1:1 with newsroom_packs.  A Pack has at most one Embargo   │
-- │  row; UNIQUE on pack_id enforces it.  State lifecycle:      │
-- │  active → lifted | cancelled (terminal).  The state-        │
-- │  coherence CHECK pairs each state with its required         │
-- │  timestamp column:                                          │
-- │                                                             │
-- │    active    ⇔ lifted_at    IS NULL AND cancelled_at IS NULL│
-- │    lifted    ⇔ lifted_at    IS NOT NULL AND cancelled_at    │
-- │                 IS NULL                                     │
-- │    cancelled ⇔ cancelled_at IS NOT NULL AND lifted_at       │
-- │                 IS NULL                                     │
-- │                                                             │
-- │  On uploader pull-back (scheduled → draft) the NR-D9 RPC    │
-- │  flips state → cancelled.  On re-schedule with a new        │
-- │  lift_at, NR-D9 decides whether to UPDATE back to active    │
-- │  (same row) or DELETE + CASCADE to embargo_recipients and   │
-- │  re-create.  Schema supports both paths.                    │
-- │                                                             │
-- │  ON DELETE CASCADE on pack_id — embargo has no meaning      │
-- │  without its Pack.  The reverse direction                   │
-- │  (newsroom_packs.embargo_id FK) is ON DELETE SET NULL (§6). │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_embargoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id         uuid NOT NULL UNIQUE
                    REFERENCES newsroom_packs(id) ON DELETE CASCADE,

  lift_at         timestamptz NOT NULL,
  policy_text     text NOT NULL,
  state           newsroom_embargo_state NOT NULL DEFAULT 'active',
  lifted_at       timestamptz,
  cancelled_at    timestamptz,
  notify_on_lift  boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_embargo_policy_text_nonempty CHECK (
    length(policy_text) > 0
  ),

  -- State-coherence: each state pairs with exactly one non-null
  -- timestamp column (and leaves the other as NULL).  Rejects
  -- incoherent rows such as active-with-lifted_at or
  -- lifted-with-cancelled_at.
  CONSTRAINT newsroom_embargo_state_coherence CHECK (
    (state = 'active'    AND lifted_at IS NULL     AND cancelled_at IS NULL)
    OR
    (state = 'lifted'    AND lifted_at IS NOT NULL AND cancelled_at IS NULL)
    OR
    (state = 'cancelled' AND cancelled_at IS NOT NULL AND lifted_at IS NULL)
  )
);

COMMENT ON TABLE newsroom_embargoes IS
  '1:1 Embargo per newsroom_pack — the first-class object that '
  'makes (scheduled, restricted) Packs reachable (PRD §3.3).  '
  'State lifecycle: active → lifted | cancelled.  Cross-table '
  'invariant "publish_at = lift_at when both exist" lives at the '
  'NR-D9 Pack state-transition RPC, not in a CHECK.';

-- ── Indexes ──

-- Drives the scheduled-lift worker's "find active embargoes with
-- lift_at <= now()" query path (NR-D9 lift-worker).  Predicate is
-- IMMUTABLE (enum-constant).  Safe per NR-D1 exit report §2
-- lesson.
CREATE INDEX idx_newsroom_embargoes_active_lift_at
  ON newsroom_embargoes (lift_at)
  WHERE state = 'active';

CREATE TRIGGER trg_newsroom_embargoes_updated_at
  BEFORE UPDATE ON newsroom_embargoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  newsroom_embargo_recipients                            │
-- │                                                             │
-- │  One row per (embargo, recipient) pair — the approved pre-  │
-- │  lift viewer list for an embargo.  UNIQUE (embargo_id,      │
-- │  recipient_id) prevents duplicate invites to the same       │
-- │  recipient on the same embargo.                             │
-- │                                                             │
-- │  access_token is the opaque URL-safe secret that gates the  │
-- │  pre-lift preview page (J5).  The 32-char minimum enforces  │
-- │  ≥192 bits of entropy when tokens are URL-safe base64 (the  │
-- │  NR-D8 generator standard: base64url of 24 random bytes =   │
-- │  32 chars).  Server-side only — see §7 policy comment.      │
-- │                                                             │
-- │  access_count / first_accessed_at / last_accessed_at form   │
-- │  an access-log triple.  The coherence CHECK enforces:       │
-- │    count = 0 ⇒ both timestamps NULL                         │
-- │    count ≥ 1 ⇒ both timestamps NOT NULL                     │
-- │  and the ordering CHECK enforces first ≤ last when both are │
-- │  set.                                                       │
-- │                                                             │
-- │  ON DELETE CASCADE on embargo_id — invites die with the     │
-- │  embargo (pull-back flow).                                  │
-- │  ON DELETE RESTRICT on recipient_id — prevents orphaning    │
-- │  historical invites by deleting a Recipient still           │
-- │  referenced by an active/lifted embargo.                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_embargo_recipients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  embargo_id         uuid NOT NULL
                       REFERENCES newsroom_embargoes(id) ON DELETE CASCADE,
  recipient_id       uuid NOT NULL
                       REFERENCES newsroom_recipients(id) ON DELETE RESTRICT,

  access_token       text NOT NULL UNIQUE,
  invited_at         timestamptz NOT NULL DEFAULT now(),
  first_accessed_at  timestamptz,
  last_accessed_at   timestamptz,
  access_count       integer NOT NULL DEFAULT 0,
  revoked_at         timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- One invite per (embargo, recipient) pair.
  CONSTRAINT newsroom_er_unique_per_embargo
    UNIQUE (embargo_id, recipient_id),

  -- Access tokens must be unguessable.  32-char minimum ensures
  -- ≥192 bits of entropy when tokens are URL-safe base64
  -- (base64url of 24 random bytes = 32 chars).  Generation rule
  -- is an NR-D8 RPC concern.
  CONSTRAINT newsroom_er_access_token_length CHECK (
    length(access_token) >= 32
  ),

  CONSTRAINT newsroom_er_access_count_nonneg CHECK (access_count >= 0),

  -- Access-log coherence: count = 0 ⇔ both timestamps NULL;
  -- count ≥ 1 ⇔ both timestamps NOT NULL.
  CONSTRAINT newsroom_er_access_count_coherence CHECK (
    (access_count = 0 AND first_accessed_at IS NULL AND last_accessed_at IS NULL)
    OR
    (access_count >= 1 AND first_accessed_at IS NOT NULL AND last_accessed_at IS NOT NULL)
  ),

  -- Ordering: first_accessed_at ≤ last_accessed_at when both set.
  CONSTRAINT newsroom_er_access_order CHECK (
    first_accessed_at IS NULL
    OR last_accessed_at IS NULL
    OR first_accessed_at <= last_accessed_at
  )
);

COMMENT ON TABLE newsroom_embargo_recipients IS
  'Approved pre-lift viewer list — one row per (embargo, '
  'recipient).  access_token gates the J5 preview page; '
  'server-side-only generation (NR-D8 RPC).  access_count / '
  'first_accessed_at / last_accessed_at form a per-invite '
  'access log with schema-level coherence CHECKs.';

COMMENT ON COLUMN newsroom_embargo_recipients.access_token IS
  'Opaque URL-safe secret; NEVER client-authored.  Generated '
  'server-side by the NR-D8 invite RPC (base64url of 24 random '
  'bytes = 32 chars = ≥192 bits entropy).  UNIQUE column '
  'constraint enforces no-collision.';

-- ── Indexes ──

-- "List recipients of this embargo" — distributor P8 view.
CREATE INDEX idx_newsroom_er_embargo
  ON newsroom_embargo_recipients (embargo_id);

-- "Journalist's invites" — consumer J7 / J8 views.
CREATE INDEX idx_newsroom_er_recipient
  ON newsroom_embargo_recipients (recipient_id);

CREATE TRIGGER trg_newsroom_er_updated_at
  BEFORE UPDATE ON newsroom_embargo_recipients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  DEFERRED FK VALIDATION on newsroom_packs               │
-- │                                                             │
-- │  newsroom_packs.embargo_id was created in NR-D1 as a plain  │
-- │  uuid column with a deferred-FK comment.  The FK target     │
-- │  table now exists (§4 above), so we can validate the        │
-- │  constraint.                                                │
-- │                                                             │
-- │  Pattern mirrors NR-D2a §6 and migration 20260413230015 §4: │
-- │  ADD CONSTRAINT ... NOT VALID, then VALIDATE CONSTRAINT.    │
-- │  The two-step is non-blocking for concurrent reads (NOT     │
-- │  VALID acquires only a SHARE ROW EXCLUSIVE briefly;         │
-- │  VALIDATE acquires SHARE UPDATE EXCLUSIVE).  No pre-        │
-- │  existing data violates the FK because no embargo_id values │
-- │  have ever been written.                                    │
-- │                                                             │
-- │  ON DELETE SET NULL: a Pack does NOT cease to exist when    │
-- │  its embargo row is deleted (rare, only via service_role).  │
-- │  The NR-D9 RPC maintains the higher-level invariant         │
-- │  (Pack.publish_at must equal Embargo.lift_at when both      │
-- │  exist) — that invariant is cross-table and belongs at the  │
-- │  RPC seam, not at the FK.                                   │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_packs
  ADD CONSTRAINT fk_newsroom_packs_embargo
  FOREIGN KEY (embargo_id)
  REFERENCES newsroom_embargoes(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE newsroom_packs
  VALIDATE CONSTRAINT fk_newsroom_packs_embargo;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  RLS POLICIES                                           │
-- │                                                             │
-- │  Enable RLS on all four new tables, then attach SELECT-only │
-- │  policies for authenticated.  Reuses the NR-D1 helper       │
-- │  is_newsroom_editor_or_admin(uuid) — no new helpers.        │
-- │                                                             │
-- │  POSTURE SUMMARY:                                           │
-- │    - Outlets: publicly readable (directory / domain → name  │
-- │      lookup for J2 and distributor analytics display; no    │
-- │      PII, verification status is public signal).            │
-- │    - Recipients: visible to the recipient themselves (via   │
-- │      linked user_id) OR to the org editor/admin whose       │
-- │      company invited them to at least one embargo.  No      │
-- │      cross-org enumeration.                                 │
-- │    - Embargoes: visible to the owning org's editors/admins  │
-- │      only.  Recipients do NOT need SELECT on this table —   │
-- │      the J5 preview page pulls embargo+pack data via        │
-- │      service_role under the access_token (NR-D12 route).    │
-- │    - EmbargoRecipients: visible to the inviting org's       │
-- │      editors/admins OR to the recipient themselves (via     │
-- │      linked user_id).                                       │
-- │                                                             │
-- │  NO INSERT / UPDATE / DELETE POLICIES on ANY of the four    │
-- │  tables for authenticated.  Mutations routed through        │
-- │  service_role RPCs (NR-D8 / NR-D9 / NR-D14).                │
-- │  Justification:                                             │
-- │    * Outlet auto-creation requires domain parsing + dedupe  │
-- │      (NR-D14).  Not a client-safe INSERT.                   │
-- │    * Recipient upsert-by-email + user_id linking requires   │
-- │      lookup-or-create logic (NR-D14).  Not a client-safe    │
-- │      INSERT.                                                │
-- │    * Embargo creation triggers token generation, email      │
-- │      sends, and status bookkeeping on newsroom_packs (NR-D8 │
-- │      / NR-D9).  Must be atomic under service_role.          │
-- │    * EmbargoRecipient invite generates the access_token,    │
-- │      which must NEVER be client-authored (entropy source    │
-- │      control).  Server-side only.                           │
-- │                                                             │
-- │  service_role bypasses RLS by default (Supabase convention) │
-- │  and is what server-side workers, the lift worker, and      │
-- │  admin flows use for the operations not granted here.       │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_outlets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_recipients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_embargoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_embargo_recipients  ENABLE ROW LEVEL SECURITY;

-- ── newsroom_outlets ──

-- Public directory: domain → name lookup for J2 and distributor
-- analytics.  No PII; verification status is public signal.
CREATE POLICY newsroom_outlets_select_public
  ON newsroom_outlets
  FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE: service_role only (auto-creation by
-- NR-D14 RPC on first embargo invite whose email domain is new).

-- ── newsroom_recipients ──

-- Recipient sees their own row; distributors see recipients they
-- have invited.  No cross-org leakage — a brand cannot enumerate
-- journalists they never invited.
CREATE POLICY newsroom_recipients_select_self_or_org
  ON newsroom_recipients
  FOR SELECT
  USING (
    -- (a) The recipient themselves (via linked user_id):
    user_id = auth.uid()
    OR
    -- (b) An org editor/admin whose company has invited this
    -- recipient to at least one embargo:
    EXISTS (
      SELECT 1
      FROM newsroom_embargo_recipients er
      JOIN newsroom_embargoes e  ON e.id = er.embargo_id
      JOIN newsroom_packs     p  ON p.id = e.pack_id
      WHERE er.recipient_id = newsroom_recipients.id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (email-first upsert
-- at NR-D14 invite RPC).

-- ── newsroom_embargoes ──

-- Editors / admins see their own packs' embargoes.  Anon does
-- not see embargoes — the J5 pre-lift preview uses signed token
-- URLs routed via service_role at the API layer (NR-D12).
-- Recipients don't need SELECT here for the same reason.
CREATE POLICY newsroom_embargoes_select_org
  ON newsroom_embargoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_embargoes.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (embargo create /
-- lift / cancel are atomic RPC concerns in NR-D8 / NR-D9).

-- ── newsroom_embargo_recipients ──

-- Distributor sees their embargo's invites; signed-in recipient
-- sees invites sent to their own email (post-J1 user linking).
-- The access_token path for unauthenticated recipients uses
-- service_role at the route layer (NR-D12); no anon policy here.
CREATE POLICY newsroom_er_select_org_or_self
  ON newsroom_embargo_recipients
  FOR SELECT
  USING (
    -- (a) Org editor/admin: their embargoes' recipient list.
    EXISTS (
      SELECT 1
      FROM newsroom_embargoes e
      JOIN newsroom_packs p ON p.id = e.pack_id
      WHERE e.id = newsroom_embargo_recipients.embargo_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
    OR
    -- (b) Recipient themselves (via linked user_id on the
    -- joined newsroom_recipients row).
    EXISTS (
      SELECT 1
      FROM newsroom_recipients r
      WHERE r.id = newsroom_embargo_recipients.recipient_id
        AND r.user_id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE: service_role only.  access_token
-- must NEVER be client-authored (entropy source control);
-- invite generation is atomic with token issuance at the NR-D8
-- RPC seam.
