# NR-D2b — Newsroom Embargo + Consumer Identity (Phase NR-1, Part B of NR-D2)

**Status.** Drafted 2026-04-24 on top of NR-D1 (migration `20260425000001`) and NR-D2a (migration `20260425000002`). Second of three parts splitting the original NR-D2 scope (see `docs/public-newsroom/DIRECTIVE_SEQUENCE.md`). Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the embargo-workflow and consumer-identity substrate and the matching TypeScript row types:

- One Postgres enum (`newsroom_embargo_state`)
- Four tables (`newsroom_outlets`, `newsroom_recipients`, `newsroom_embargoes`, `newsroom_embargo_recipients`)
- One deferred-FK validation on `newsroom_packs.embargo_id`
- RLS policies on all four new tables (SELECT-only for authenticated; all mutations service-role)
- Indexes matching read-path queries
- Non-destructive rollback file under `supabase/migrations/_rollbacks/`
- Row types + enum union appended to `src/lib/db/schema.ts`

**No** app code. **No** route handlers. **No** pages. **No** components. **No** RPC functions (embargo-create, recipient-invite, lift-worker all land in NR-D8 and NR-D9). **No** seed data. **No** modification to existing migrations (including NR-D1's `20260425000001` and NR-D2a's `20260425000002`), existing enums, or existing tables (`users`, `companies`, `company_memberships`, NR-D1/D2a newsroom_* tables). Exception: a single `ALTER TABLE newsroom_packs ADD CONSTRAINT ... FOREIGN KEY ...` on the already-declared `embargo_id` column, executed via the `NOT VALID` + `VALIDATE CONSTRAINT` pattern established in migration `20260413230015 §4` and re-used in NR-D2a.

**Relationship to Phase NR-1 full scope.** NR-D2b is the second of three parts. Sequence: **NR-D1 (done) → NR-D2a (done) → NR-D2b (this directive) → NR-D2c → NR-D3 → NR-D4**. NR-D2b is narrow — four tables grouped by two linked concerns (embargo workflow as the schema primitive for restricted-visibility Packs; Recipient/Outlet as the consumer-identity substrate) — so the exit report is verdictable in a single pass.

**Recipient semantic locked.** Per founder confirmation 2026-04-24 + Build Charter §4 correction: **Path A, email-first.** `newsroom_recipients.email` is the stable identity. A Recipient is created on first embargo invite; `user_id` is populated later when the same email signs up as a journalist (J1). No signup required before invite.

**Pack visibility CHECK is NOT strengthened in this directive.** The DIRECTIVE_SEQUENCE noted "strengthen Pack visibility CHECK to honour embargo state" against NR-D2. On review, that invariant can't be enforced at DB CHECK level because CHECK constraints cannot reference other tables. Moved to RPC-layer enforcement in NR-D9 (alongside all other cross-table invariants). Scope-adjustment documented in §B below.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 3 §3.1 (object roster — **Embargo, EmbargoRecipient, Recipient, Outlet**), §3.2 *Schemas* (verbatim field specs), §3.3 (Pack status × visibility matrix — `scheduled + restricted` is the cell this directive makes reachable by giving Embargo a real row), Part 5 §5.2 P8 (Embargo configuration — downstream consumer of this schema in NR-D8), Part 5 §5.3 J5 (pre-lift preview — downstream consumer in NR-D12).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §4 (primitive-reuse mapping; Recipient row corrected to email-first 2026-04-24), §5 (Phase NR-1 exit gate NR-G1).
- **`supabase/migrations/20260413230015_companies_and_memberships.sql`** — §4 (deferred-FK-validation pattern).
- **`supabase/migrations/20260425000001_newsroom_schema_foundation.sql`** — NR-D1; provides `newsroom_packs` (including the nullable `embargo_id` column validated by this directive), `users` FK target, and the two RLS helpers (`is_newsroom_admin`, `is_newsroom_editor_or_admin`) reused by this directive's policies.
- **`supabase/migrations/20260425000002_newsroom_schema_d2a.sql`** — NR-D2a; direct predecessor; landed `newsroom_rights_warranties` and the `fk_newsroom_packs_rights_warranty` deferred-FK. This directive mirrors the FK-validation pattern for `embargo_id`.
- **`src/lib/db/schema.ts`** — existing row-type exports through the NR-D2a block at line 777 (per NR-D2a exit report §1). **This directive appends one enum union and four row interfaces at the end.**
- **Reference directive (structural template)**: `docs/public-newsroom/directives/NR-D2a-asset-pack-extensions.md`. Match its §A format and its exit-report seven-section structure.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Schema Extensions, Part B
       (one enum + four tables + one deferred-FK validation
       + RLS policies [SELECT-only for authenticated]
       + indexes + TS row types; no app code; no pages;
       no routes; no RPCs; no seed data; no modification to
       any existing migration, enum, or table other than the
       single ADD CONSTRAINT on newsroom_packs)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                          (authority)
  docs/public-newsroom/BUILD_CHARTER.md                (scope + mapping lock)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md           (place in sequence)
  docs/public-newsroom/directives/NR-D1-schema-foundation.md   (predecessor)
  docs/public-newsroom/directives/NR-D2a-asset-pack-extensions.md (predecessor)

SCOPE

You are building the second schema-extensions migration for the
Newsroom v1 subsystem, Part B of the original NR-D2 scope split.
This migration creates the persistent substrate for:

  (a) Embargo workflow — the first-class object that makes
      `scheduled + restricted` Packs possible, per PRD §3.3.
  (b) Consumer identity — `newsroom_recipients` (email-first,
      Path A locked in Build Charter §4) and `newsroom_outlets`
      (auto-derived from email domain in later directives).

It also validates the second deferred FK on newsroom_packs:
`newsroom_packs.embargo_id` → `newsroom_embargoes(id)`.

All four tables, the new enum, and the FK validation. No app
code, no RPCs, no pages. Mutations on all four new tables are
service_role-only (authenticated gets SELECT policies; embargo
creation, recipient invite, token generation, and lift workers
land in NR-D8 and NR-D9 as RPCs).

The existing Frontfiles schema and the NR-D1/NR-D2a Newsroom
schema are REFERENCED BUT NOT MODIFIED — with ONE explicit
exception: a single `ALTER TABLE newsroom_packs ADD CONSTRAINT
fk_newsroom_packs_embargo FOREIGN KEY (embargo_id) REFERENCES
newsroom_embargoes(id) ON DELETE SET NULL NOT VALID` followed
by `VALIDATE CONSTRAINT`.

Migration filename:
  20260425000003_newsroom_schema_d2b.sql
Rollback filename:
  _rollbacks/20260425000003_newsroom_schema_d2b.DOWN.sql

DELIVERABLES

(F1) supabase/migrations/20260425000003_newsroom_schema_d2b.sql
     — up migration, organised per the sectioned-comment-block
     convention of prior migrations.

(F2) supabase/migrations/_rollbacks/20260425000003_newsroom_schema_d2b.DOWN.sql
     — symmetric DOWN migration that removes everything this
     migration creates, in reverse dependency order, including
     the fk_newsroom_packs_embargo constraint.

(F3) src/lib/db/schema.ts (EDIT) — append one enum string-
     literal union and four row interfaces at the end of the
     file, following the NR-D1 and NR-D2a append-block
     conventions. No other edits.

No other files are touched.

ENUM (D1)

  newsroom_embargo_state:
    'active'
    'lifted'
    'cancelled'

TABLE 1 — newsroom_outlets (D2)

  Grain: one row per outlet (publication). Auto-created in
  later directives (NR-D5, NR-D14) when a Recipient's email
  domain is first encountered. Verified flag reserved for
  v1.1 outlet-verification path.

  Columns:
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
    name        text NOT NULL
    domain      text NOT NULL
    verified    boolean NOT NULL DEFAULT false
    created_at  timestamptz NOT NULL DEFAULT now()
    updated_at  timestamptz NOT NULL DEFAULT now()

  Constraints:
    CONSTRAINT newsroom_outlets_domain_unique
      UNIQUE (domain)

    CONSTRAINT newsroom_outlets_domain_format
      CHECK (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')

    CONSTRAINT newsroom_outlets_name_nonempty
      CHECK (length(name) > 0)

  Indexes:
    domain uniqueness enforced at column-constraint level.

    idx_newsroom_outlets_verified
      ON newsroom_outlets (domain)
      WHERE verified = true
      -- Partial index for the v1.1 "verified outlets only"
      -- filter on the distributor analytics surface. Predicate
      -- is IMMUTABLE (column-constant). Safe per NR-D1 lesson.

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 2 — newsroom_recipients (D3)

  Grain: one row per identified consumer, keyed by email.

  Path A (locked): email-first. Row created on first embargo
  invite (regardless of whether the email has a Frontfiles
  user account). `user_id` populated later when the same
  email signs up as a journalist via J1. Anonymous visitors
  get no Recipient row; tracked via `anon_session_id` on
  events only (NR-D2c).

  Columns:
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
    email       text NOT NULL
    user_id     uuid REFERENCES users(id) ON DELETE SET NULL
    outlet_id   uuid REFERENCES newsroom_outlets(id) ON DELETE SET NULL
    name        text
    verified    boolean NOT NULL DEFAULT false
    created_at  timestamptz NOT NULL DEFAULT now()
    updated_at  timestamptz NOT NULL DEFAULT now()

  Constraints:
    CONSTRAINT newsroom_recipients_email_unique
      UNIQUE (email)

    CONSTRAINT newsroom_recipients_email_format
      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
      -- Pragmatic email pattern (has @, has dot in domain, no
      -- whitespace). Not RFC 5321-exhaustive. Good enough for
      -- a store-and-lookup key.

  Indexes:
    email uniqueness enforced at constraint level.

    idx_newsroom_recipients_user
      ON newsroom_recipients (user_id)
      WHERE user_id IS NOT NULL
      -- Partial index for the J1 signup flow: "find existing
      -- Recipient by user_id" after linking by email match.

    idx_newsroom_recipients_outlet
      ON newsroom_recipients (outlet_id)
      WHERE outlet_id IS NOT NULL
      -- Partial index for the distributor analytics surface
      -- ("recipients by outlet").

  Trigger:
    BEFORE UPDATE → set_updated_at()

  NOTE on verified: column reserved for v1.1 outlet-
  verification / journalist-verification path. Default false;
  no policy enforcement in v1. Keep the column so the schema
  shape stays stable.

TABLE 3 — newsroom_embargoes (D4)

  Grain: one row per Pack. 1:1 with newsroom_packs.

  A Pack has at most one Embargo row. On uploader pull-back
  from scheduled → draft, the Embargo state flips to
  `cancelled` (NR-D9 RPC concern). On re-schedule with a new
  lift_at, the same Embargo row is updated back to `active`
  or a new row is created after DELETE (NR-D9 decides; the
  schema supports both via the UNIQUE constraint + DELETE
  CASCADE path).

  Columns:
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
    pack_id         uuid NOT NULL UNIQUE REFERENCES newsroom_packs(id) ON DELETE CASCADE
    lift_at         timestamptz NOT NULL
    policy_text     text NOT NULL
    state           newsroom_embargo_state NOT NULL DEFAULT 'active'
    lifted_at       timestamptz
    cancelled_at    timestamptz
    notify_on_lift  boolean NOT NULL DEFAULT true
    created_at      timestamptz NOT NULL DEFAULT now()
    updated_at      timestamptz NOT NULL DEFAULT now()

  Constraints:
    CONSTRAINT newsroom_embargo_policy_text_nonempty
      CHECK (length(policy_text) > 0)

    CONSTRAINT newsroom_embargo_state_coherence
      CHECK (
        (state = 'active'    AND lifted_at IS NULL     AND cancelled_at IS NULL)
        OR
        (state = 'lifted'    AND lifted_at IS NOT NULL AND cancelled_at IS NULL)
        OR
        (state = 'cancelled' AND cancelled_at IS NOT NULL AND lifted_at IS NULL)
      )

  Indexes:
    pack_id uniqueness enforced at column-constraint level.

    idx_newsroom_embargoes_active_lift_at
      ON newsroom_embargoes (lift_at)
      WHERE state = 'active'
      -- Drives the scheduled-lift worker's "find active
      -- embargoes with lift_at <= now()" query path. Predicate
      -- is IMMUTABLE (enum-constant).

  Trigger:
    BEFORE UPDATE → set_updated_at()

TABLE 4 — newsroom_embargo_recipients (D5)

  Grain: one row per (embargo, recipient) pair. The approved
  pre-lift viewer list for an embargo.

  Columns:
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
    embargo_id            uuid NOT NULL REFERENCES newsroom_embargoes(id) ON DELETE CASCADE
    recipient_id          uuid NOT NULL REFERENCES newsroom_recipients(id) ON DELETE RESTRICT
    access_token          text NOT NULL UNIQUE
    invited_at            timestamptz NOT NULL DEFAULT now()
    first_accessed_at     timestamptz
    last_accessed_at      timestamptz
    access_count          integer NOT NULL DEFAULT 0
    revoked_at            timestamptz
    created_at            timestamptz NOT NULL DEFAULT now()
    updated_at            timestamptz NOT NULL DEFAULT now()

  Constraints:
    CONSTRAINT newsroom_er_unique_per_embargo
      UNIQUE (embargo_id, recipient_id)

    CONSTRAINT newsroom_er_access_token_length
      CHECK (length(access_token) >= 32)
      -- Access tokens must be unguessable. 32-char minimum
      -- ensures ≥192 bits of entropy when tokens are URL-safe
      -- base64. Generation rule is an NR-D8 RPC concern.

    CONSTRAINT newsroom_er_access_count_nonneg
      CHECK (access_count >= 0)

    CONSTRAINT newsroom_er_access_count_coherence
      CHECK (
        (access_count = 0 AND first_accessed_at IS NULL AND last_accessed_at IS NULL)
        OR
        (access_count >= 1 AND first_accessed_at IS NOT NULL AND last_accessed_at IS NOT NULL)
      )

    CONSTRAINT newsroom_er_access_order
      CHECK (
        first_accessed_at IS NULL
        OR last_accessed_at IS NULL
        OR first_accessed_at <= last_accessed_at
      )

  Indexes:
    access_token uniqueness enforced at column-constraint level.

    idx_newsroom_er_embargo
      ON newsroom_embargo_recipients (embargo_id)
      -- "list recipients of this embargo" (distributor P8 view).

    idx_newsroom_er_recipient
      ON newsroom_embargo_recipients (recipient_id)
      -- "journalist's invites" (consumer J7/J8 views).

  Trigger:
    BEFORE UPDATE → set_updated_at()

DEFERRED FK VALIDATION ON newsroom_packs (D6)

After newsroom_embargoes exists, validate the deferred FK on
newsroom_packs.embargo_id. Same NOT VALID + VALIDATE pattern
as NR-D2a's fk_newsroom_packs_rights_warranty.

  ALTER TABLE newsroom_packs
    ADD CONSTRAINT fk_newsroom_packs_embargo
    FOREIGN KEY (embargo_id)
    REFERENCES newsroom_embargoes(id)
    ON DELETE SET NULL
    NOT VALID;

  ALTER TABLE newsroom_packs
    VALIDATE CONSTRAINT fk_newsroom_packs_embargo;

The FK is ON DELETE SET NULL because a Pack does not cease to
exist when its embargo row is deleted (rare — only via
service_role). The NR-D9 RPC maintains the higher-level
invariant (Pack.publish_at must equal Embargo.lift_at when
both exist).

PACK VISIBILITY CHECK — NOT STRENGTHENED (D7)

DIRECTIVE_SEQUENCE's earlier note proposed "strengthen Pack
visibility CHECK to honour embargo state" in NR-D2. On review,
a CHECK constraint cannot reference another table's state
(e.g. newsroom_embargoes.state). Postgres CHECK constraints
are row-local. Enforcing the cross-table invariant would
require either a trigger (cost: hidden side effects on every
INSERT/UPDATE; poor reviewability) or a subquery-based CHECK
via an IMMUTABLE function wrapper (cost: immutability lie;
planner confusion).

Neither is acceptable. The cross-table invariant moves to the
NR-D9 Pack-state-transition RPC, which has a clean seam for
pre-write invariant checks and produces deterministic error
payloads for the UI.

No change to NR-D1's Pack visibility CHECK in this directive.
The NR-D1 CHECK already permits `(scheduled, private)` and
`(scheduled, restricted)` at the row level. The RPC gates the
transition to `(scheduled, restricted)` only when a valid
active Embargo row exists.

RLS POLICIES (D8)

Enable RLS on all four new tables:

  ALTER TABLE newsroom_outlets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_recipients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_embargoes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE newsroom_embargo_recipients ENABLE ROW LEVEL SECURITY;

Reuse NR-D1 helpers (is_newsroom_admin, is_newsroom_editor_or_admin).
No new helpers required.

Four SELECT policies total. No INSERT / UPDATE / DELETE
policies granted to authenticated — all mutations via
service_role RPCs in NR-D8 / NR-D9 / NR-D14.

newsroom_outlets policies:

  POLICY newsroom_outlets_select_public
    FOR SELECT
    USING (true)
    -- Outlet directory is public (domain → name lookup for
    -- the J2 directory UI and distributor analytics display).
    -- No PII; verification status is public signal.

newsroom_recipients policies:

  POLICY newsroom_recipients_select_self_or_org
    FOR SELECT
    USING (
      -- (a) The recipient themselves (via linked user_id):
      user_id = auth.uid()
      OR
      -- (b) An org editor/admin whose company has invited
      -- this recipient to at least one embargo:
      EXISTS (
        SELECT 1
        FROM newsroom_embargo_recipients er
        JOIN newsroom_embargoes e  ON e.id = er.embargo_id
        JOIN newsroom_packs     p  ON p.id = e.pack_id
        WHERE er.recipient_id = newsroom_recipients.id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Recipient sees their own row; distributors see
    -- recipients they've invited. No cross-org leakage — a
    -- brand cannot enumerate journalists they never invited.

newsroom_embargoes policies:

  POLICY newsroom_embargoes_select_org
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM newsroom_packs p
        WHERE p.id = newsroom_embargoes.pack_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
    )
    -- Editors/admins see their own packs' embargoes. Anon
    -- does not see embargoes (pre-lift preview uses signed
    -- token URLs at API layer via service_role). Recipients
    -- don't need SELECT on newsroom_embargoes — the preview
    -- page pulls via service_role under the access_token.

newsroom_embargo_recipients policies:

  POLICY newsroom_er_select_org_or_self
    FOR SELECT
    USING (
      -- (a) Org editor/admin: their embargoes' recipient list
      EXISTS (
        SELECT 1
        FROM newsroom_embargoes e
        JOIN newsroom_packs p ON p.id = e.pack_id
        WHERE e.id = newsroom_embargo_recipients.embargo_id
          AND is_newsroom_editor_or_admin(p.company_id)
      )
      OR
      -- (b) Recipient themselves (via linked user_id on the
      -- joined newsroom_recipients row):
      EXISTS (
        SELECT 1
        FROM newsroom_recipients r
        WHERE r.id = newsroom_embargo_recipients.recipient_id
          AND r.user_id = auth.uid()
      )
    )
    -- Distributor sees their embargo invites; signed-in
    -- recipient sees invites sent to their own email.

-- No INSERT / UPDATE / DELETE policies on ANY of the four
-- tables for authenticated. Mutations routed through
-- service_role RPCs. Justification:
--
--   * Outlet auto-creation requires domain parsing + dedupe
--     (NR-D14). Not a client-safe INSERT.
--   * Recipient upsert-by-email + user_id linking requires
--     lookup-or-create logic (NR-D14). Not a client-safe
--     INSERT.
--   * Embargo creation triggers token generation, email
--     sends, and status bookkeeping on newsroom_packs
--     (NR-D8/NR-D9). Must be atomic under service_role.
--   * EmbargoRecipient invite generates the access_token,
--     which must never be client-authored (entropy source
--     control). Server-side only.

TS ROW TYPES — src/lib/db/schema.ts (D9)

Append to the end of the file, after NR-D2a's
NewsroomCorrectionRow block (file ends approximately at
line 777 per NR-D2a exit report §1). Follow the same section
convention. Do NOT reorder or modify anything already in
the file.

// ══════════════════════════════════════════════
// NEWSROOM — v1 (migration 20260425000003)
//
// Schema extensions Part B: embargo workflow + consumer
// identity (Path A email-first Recipient).
// See docs/public-newsroom/directives/
//   NR-D2b-embargo-consumer-identity.md for canonical
//   semantics and Build Charter §4 for primitive mapping.
// ══════════════════════════════════════════════

export type NewsroomEmbargoState =
  | 'active'
  | 'lifted'
  | 'cancelled'

export interface NewsroomOutletRow {
  id: string
  name: string
  domain: string
  verified: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomRecipientRow {
  id: string
  email: string
  user_id: string | null
  outlet_id: string | null
  name: string | null
  verified: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomEmbargoRow {
  id: string
  pack_id: string
  lift_at: string
  policy_text: string
  state: NewsroomEmbargoState
  lifted_at: string | null
  cancelled_at: string | null
  notify_on_lift: boolean
  created_at: string
  updated_at: string
}

export interface NewsroomEmbargoRecipientRow {
  id: string
  embargo_id: string
  recipient_id: string
  access_token: string
  invited_at: string
  first_accessed_at: string | null
  last_accessed_at: string | null
  access_count: number
  revoked_at: string | null
  created_at: string
  updated_at: string
}

ROLLBACK (D10)

supabase/migrations/_rollbacks/20260425000003_newsroom_schema_d2b.DOWN.sql

Symmetric DOWN migration. Reverse dependency order:

  1. DROP POLICY (all four SELECT policies)
  2. ALTER TABLE newsroom_packs DROP CONSTRAINT IF EXISTS
     fk_newsroom_packs_embargo
  3. DROP TABLE newsroom_embargo_recipients CASCADE
  4. DROP TABLE newsroom_embargoes CASCADE
  5. DROP TABLE newsroom_recipients CASCADE
  6. DROP TABLE newsroom_outlets CASCADE
  7. DROP TYPE newsroom_embargo_state

Comment block at the top states: inverse of the 20260425000003
up migration; does NOT touch NR-D1 or NR-D2a objects; does NOT
touch any pre-Newsroom migration. If run when data exists, the
CASCADE drops delete that data.

CRITICAL: The DOWN must drop fk_newsroom_packs_embargo BEFORE
dropping newsroom_embargoes, otherwise the FK target disappears
while the constraint still references it. Same pattern as
NR-D2a's rights-warranty FK rollback.

OUT OF SCOPE (hard boundaries)

Anything not explicitly in DELIVERABLES above. In particular:

- NO change to any existing migration file, including
  20260425000001 (NR-D1) and 20260425000002 (NR-D2a).
- NO change to existing tables beyond the single
  ALTER TABLE newsroom_packs ADD CONSTRAINT call explicitly
  scoped above.
- NO strengthening of the NR-D1 Pack visibility CHECK
  (cross-table invariant moved to NR-D9 RPC layer — see D7).
- NO change to existing functions (set_updated_at,
  is_newsroom_admin, is_newsroom_editor_or_admin).
- NO edits to src/lib/types.ts, src/lib/identity/*,
  src/lib/company-roles.ts, or any other existing source file.
- NO additional tables (distribution_events, download_receipts,
  signing_keys, claims, admin_users, admin_audit_events,
  beat_subscriptions) — these land in NR-D2c.
- NO RPC functions (embargo-create, recipient-invite,
  token-generation, lift-worker all in NR-D8/NR-D9).
- NO INSERT/UPDATE/DELETE policies granted to authenticated.
  Mutations via service_role only.
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

Run these in order. Each must pass before moving to the next.

  # 1. Reset dev database with the new migration
  bun run supabase db reset

  # 2. TypeScript type-check
  bun run typecheck
  # expected: tsc --noEmit exit 0

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0, route count unchanged (96)

  # 4. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_outlets"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_recipients"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_embargoes"
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_embargo_recipients"
  # expected: four tables present with columns, constraints,
  # indexes, triggers, RLS enabled

  # 5. Enum inspection
  psql "$SUPABASE_DB_URL" -c "\dT+ newsroom_embargo_state"
  # expected: one enum, values active / lifted / cancelled

  # 6. RLS policy inspection
  psql "$SUPABASE_DB_URL" -c \
    "SELECT polname, polrelid::regclass, polcmd FROM pg_policy
     WHERE polrelid::regclass::text IN (
       'newsroom_outlets',
       'newsroom_recipients',
       'newsroom_embargoes',
       'newsroom_embargo_recipients'
     )
     ORDER BY polrelid::regclass, polcmd"
  # expected: exactly 4 rows (all SELECT policies). No
  # INSERT/UPDATE/DELETE policies on any of the four tables.

  # 7. Deferred FK validation
  psql "$SUPABASE_DB_URL" -c \
    "SELECT conname, convalidated
     FROM pg_constraint
     WHERE conname = 'fk_newsroom_packs_embargo'"
  # expected: 1 row, convalidated = true

  # 8. Embargo state-coherence CHECK smoke (plpgsql DO block)
  # Inserting an embargo with state='active' but a non-null
  # lifted_at should FAIL on newsroom_embargo_state_coherence.
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    DECLARE
      v_user_id    uuid;
      v_company_id uuid;
      v_pack_id    uuid;
    BEGIN
      INSERT INTO users (id, username, display_name, email)
      VALUES (gen_random_uuid(), 'nrd2b-smoke',
              'NR-D2b Smoke', 'nrd2b-smoke@example.com')
      RETURNING id INTO v_user_id;

      INSERT INTO companies (name, slug, created_by_user_id)
      VALUES ('NR-D2b Smoke Co', 'nrd2b-smoke-co', v_user_id)
      RETURNING id INTO v_company_id;

      INSERT INTO newsroom_packs
        (company_id, slug, title, credit_line,
         licence_class, created_by_user_id)
      VALUES (v_company_id, 'nrd2b-smoke-pack', 'Smoke',
              'Test', 'editorial_use_only', v_user_id)
      RETURNING id INTO v_pack_id;

      -- Should FAIL with CHECK violation on
      -- newsroom_embargo_state_coherence: state='active' with
      -- lifted_at not null is an incoherent row.
      INSERT INTO newsroom_embargoes
        (pack_id, lift_at, policy_text, state, lifted_at)
      VALUES (v_pack_id, now() + interval '7 days',
              'Test embargo policy', 'active', now());

      RAISE EXCEPTION 'nrd2b-smoke-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning the constraint
  # 'newsroom_embargo_state_coherence' on newsroom_embargoes.
  # If instead 'nrd2b-smoke-didnotfail' appears, the CHECK
  # failed to fire — treat as a bug and halt.

  # 9. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000003_newsroom_schema_d2b.DOWN.sql
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname IN ('newsroom_outlets','newsroom_recipients',
                     'newsroom_embargoes','newsroom_embargo_recipients')"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT conname FROM pg_constraint
     WHERE conname = 'fk_newsroom_packs_embargo'"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c "\dT newsroom_embargo_state"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c \
    "SELECT relname FROM pg_class WHERE relkind='r'
     AND relname LIKE 'newsroom_%' ORDER BY relname"
  # expected: 8 tables (NR-D1's 4 + NR-D2a's 4) — NR-D2a/D1
  # substrate fully intact

  # 10. Restore
  bun run supabase db reset
  # expected: all migrations through 20260425000003 re-apply;
  # post-state: 12 newsroom_* tables

EXIT REPORT

Required sections. Each is a first-class heading:

1. Summary — files created/edited with line counts and a
   one-line description. Migration size. TS schema edit
   line count. Per-table object counts (cols, indexes,
   CHECKs, FKs, policies, triggers).

2. Decisions that diverged — any place the implementation
   deviates from this directive (with rationale). If none,
   state "no divergence". Special case: if any VERIFY fails
   due to a Postgres rule similar to NR-D1's SQLSTATE 42P17
   issue, halt and surface before applying any fix.

3. Open questions for founder — anything that surfaced as
   ambiguous. Minimum: flag if you found a reason to modify
   any existing file beyond the single ALTER TABLE
   newsroom_packs call.

4. RLS verification results — outputs of VERIFY steps 6, 7,
   8. Redact any PII.

5. Build results — exit codes and route counts for VERIFY
   steps 2, 3. Confirm route count unchanged.

6. Rollback verification — output of VERIFY step 9 (tables,
   constraint, enum all gone; NR-D1 + NR-D2a tables intact).

7. Verdict — self-assessment:
   "approve" / "approve with corrections: ..." / "revise
   before approval: ..." / "reject: ..."

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — One new enum.** `newsroom_embargo_state` is the only new enum needed. No rendition/scan-style enums required here; embargo semantics are already covered by `lift_at / lifted_at / cancelled_at` timestamp pair + state.

**D2 — Outlet grain and uniqueness.** `domain` is the natural unique key (email-domain → outlet mapping is canonical). `name` is display-only and may be human-edited (v1.1 admin surface). Partial index on `verified = true` anticipates the v1.1 outlet-verification filter.

**D3 — Recipient email-first (Path A locked).** Per Build Charter §4 correction. Email is the stable identity; `user_id` is optional and populated on J1 signup via an email-match upsert. Two partial indexes support the two dominant read paths (user_id lookup on signup; outlet_id lookup on analytics).

**D4 — Embargo 1:1 enforced at schema.** PRD §3.2 locks 1:1. UNIQUE on `pack_id` enforces it. State-coherence CHECK covers all three legal transitions and rejects incoherent rows (active-with-lifted_at, lifted-with-cancelled_at, etc.). Partial index on `(lift_at) WHERE state = 'active'` drives the lift-worker scan — IMMUTABLE predicate (enum-constant), safe per NR-D1 lesson.

**D5 — EmbargoRecipient CHECKs are tight.** `access_count` coherence with `first_accessed_at` / `last_accessed_at`, plus ordering CHECK, prevent corrupt access-log rows. 32-char minimum on `access_token` enforces entropy; the actual generator lives in the NR-D8 RPC (url-safe base64 of 24 random bytes = 32 chars).

**D6 — Deferred FK validation mirrors NR-D2a.** Same `NOT VALID` + `VALIDATE CONSTRAINT` pattern; ON DELETE SET NULL for the same reason (Pack outlives its Embargo row).

**D7 — Pack visibility CHECK not strengthened.** Cross-table invariants belong at the RPC layer. Postgres CHECK constraints are row-local; triggers or subquery-wrapper functions are antipatterns here. The NR-D1 CHECK already permits both `(scheduled, private)` and `(scheduled, restricted)` at row level; NR-D9 RPC enforces that `(scheduled, restricted)` only fires when an active Embargo row exists.

**D8 — RLS is SELECT-only for authenticated.** All mutations via service_role RPCs. The four affected flows (outlet upsert, recipient upsert-by-email, embargo create, recipient invite + token generation) have server-side logic that can't be client-authored safely. Reads are permissioned: outlets public; recipients visible to self + inviting org; embargoes visible to org editors; embargo_recipients visible to org editors + invited recipient themselves.

**D9 — TS row types append-only.** Same convention as NR-D1 and NR-D2a. Four interfaces + one enum union. No imports.

**D10 — Rollback order matches NR-D2a pattern.** FK drop first, table drops in reverse-dependency (embargo_recipients → embargoes → recipients → outlets), then enum.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean on dev | VERIFY 1 |
| **AC2** | TypeScript compiles with appended row types | VERIFY 2 |
| **AC3** | Next.js build exits 0, route count unchanged | VERIFY 3 |
| **AC4** | All four new tables present with columns, constraints, indexes, triggers | VERIFY 4 |
| **AC5** | `newsroom_embargo_state` enum present with three values | VERIFY 5 |
| **AC6** | Exactly 4 RLS policies (all SELECT); RLS enabled on all four tables | VERIFY 6 |
| **AC7** | Deferred FK `fk_newsroom_packs_embargo` exists and is validated | VERIFY 7 |
| **AC8** | Embargo state-coherence CHECK rejects invalid inserts | VERIFY 8 |
| **AC9** | DOWN removes all NR-D2b objects without regressing NR-D1 or NR-D2a | VERIFY 9 |
| **AC10** | Restore brings DB to 12-table up-state | VERIFY 10 |
| **AC11** | No modification to any file beyond the three deliverables + the single ALTER TABLE call on newsroom_packs | Git diff review in exit report |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D2a exit report approved; commit on feat/newsroom-phase-nr-1 | Confirmed 2026-04-24 — NR-D2a cleared `approve`; branch at `1b26cf5` on top of main after rebase |
| **DC2** | Path A Recipient semantics locked | Confirmed 2026-04-24 — Build Charter §4 updated |
| **DC3** | `feat/newsroom-phase-nr-1` is current branch; `main` fully merged in | `git branch --show-current && git log --oneline -3` |
| **DC4** | Dev Supabase DB is in NR-D2a up-state (8 newsroom_* tables) | `\dt newsroom_*` |
| **DC5** | `main` + branch build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC6** | `.claude/agents/` reference file present | `ls .claude/agents/` |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D2b.**
