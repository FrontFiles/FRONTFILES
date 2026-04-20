# P4 Implementation Plan

**Status.** Draft 1, 2026-04-20. Gate 3 pending founder approval before Claude Code handoff.

**Governs.** The P4 migration cutover per `docs/specs/ECONOMIC_FLOW_v1.md` §14.1 (revision 6) — Assignment Engine sunset, spec-canonical economic layer landed, renames executed, UI retired.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` (§7, §8, §9, §14.1, §17); `docs/audits/REMEDIATION_PLAN_20260418.md` (T4 body, appendix F baseline); `docs/audits/P4_PREREQUISITES.md` (entries 1–4); `docs/audits/P4_UI_DEPRECATION_AUDIT.md` (concern 4 deliverable, companion doc).

**Plan shape.** Concern-based, five concerns plus two gates. Approved under Gate 2, 2026-04-20.

---

## 1. Scope

### 1.1 What this document governs

This plan locks the architecture, sequencing, acceptance criteria, and handoff pattern for P4. Implementation itself is performed by Claude Code under per-concern directives derived from this plan (see §13). This document does not execute code; it governs it.

### 1.2 In scope for P4

- **Schema** — 5 sequenced Supabase migrations that land the spec-canonical `offers`, `assignments`, `disputes`, `assignment_deliverables`, `ledger_events`, `actor_handles` tables with RLS, triggers, and the ledger hash chain per ECONOMIC_FLOW_v1 §7 / §8; drop 15 Assignment-Engine tables and 19 Assignment-Engine enums per §14.1 / §17; relocate `buyer_company_role` enum to the identity layer before the drop; rename the `certified_packages` family to `provenance_packages` with the `certification_hash_at_issue` column rename and the `package_artifact_type.certificate` value rename <!-- allow-banned: rename-mapping narrative per §9 compound-ban clarification -->.
- **Tests** — net-new T4 acceptance test suite covering the five scenarios in REMEDIATION_PLAN L532, keyed to KD-9 being resolved.
- **Auth gating** — `AUTH_WIRED` env-var plumbing: introduced default-false in deploy 1, flipped true at P5.
- **UI cutover** — replace the 13 retiring API routes and their 9 consuming UI pages with spec-canonical replacements; behind feature flag; sequenced in deploy 2. The per-consumer map lives in the companion document `P4_UI_DEPRECATION_AUDIT.md`.
- **Doc retirement** — retire legacy spec docs that predate ECONOMIC_FLOW_v1 and contradict it.

### 1.3 Deferred to P5 / P6 / v2

- `AUTH_WIRED=true` flip, prod assertion, platform fee rate-lock confirmation — P5.
- T&Cs / GDPR runbook / retention runbook — P6.
- Admin trail viewer — P7.
- Retainer model, service-hybrid, milestone workflow, review workflow — permanently out of v1 per ECONOMIC_FLOW_v1 §1 / §2 / §13.

### 1.4 Not in scope for v1 ever

Per ECONOMIC_FLOW_v1 §1 and §13 and by revision-5 Q4 adjudication: retainer relationships, service-hybrid offer types, multi-stage milestone workflows, platform-run review consoles, and catalog/bundle purchase paths. `transactions` and `transaction_line_items` are preserved specifically because their `catalog_purchase` and `bundle_purchase` paths are §1 out-of-scope and do not belong in the economic-layer rewrite (per §14.1 preserve block).

---

## 2. Dependencies & sequence

### 2.1 §14.1 P0–P7 chain

Authoritative dependency chain lives in ECONOMIC_FLOW_v1 §14.1. P4 depends on P0 → P1 → P2 → P3 being landed; P4 delivers the schema and route surface; P5 performs the hard cut. This plan does not re-derive the chain — read the spec.

### 2.2 Hard prerequisites

These must be true before any P4 work begins.

| # | Prerequisite | Current state (2026-04-20) | Owner |
|---|---|---|---|
| 1 | ECONOMIC_FLOW_v1 revision 6 landed and tagged | ✓ at `b73816e` / `checkpoint/economic-flow-v1-rev6-20260420` | complete |
| 2 | P4 audit corrections landed | ✓ at `4e61a7a` | complete |
| 3 | `P4_PREREQUISITES.md` Entry 1 scope reflects **both** `buyer_company_memberships.role` and `company_memberships.role` | ✓ per `4e61a7a` | complete |
| 4 | `P4_PREREQUISITES.md` Entry 2 resolved via trigger-body inspection (strings + trigger names only; no internal table references) | ✓ inspected during P4 audit 2026-04-20; see concern 1 §4.2 M2 | complete |
| 5 | `P4_PREREQUISITES.md` Entry 3 resolved via companion `P4_UI_DEPRECATION_AUDIT.md` | pending — drafted alongside this plan | P4 planning author |
| 6 | `P4_PREREQUISITES.md` Entry 4 resolved | ✓ at revision 6 | complete |
| 7 | KD-9 fix landed — Vitest env-loading works; RLS verifiable in CI; 17 file-load errors cleared | **pending** — current baseline 875/1/9 + 17 file-load errors per REMEDIATION_PLAN appendix F | P0 owner |
| 8 | Pre-P4 test baseline ≥ post-T0 numbers with zero file-load errors | **pending** — depends on #7 | P0 owner |
| 9 | Founder sign-off on this plan under §15 review gate (§14.1 sunset sub-clause is the governed section) | pending — Gate 3 of P4 planning | founder |

**#7 is the hard blocker.** Without KD-9 resolved, concern 2 (acceptance tests) cannot run green, and therefore P4 acceptance cannot be evidenced.

### 2.3 Parallel workstreams acceptable

Inside P4 these can run in parallel with the critical path:

- Concern 3 (AUTH_WIRED plumbing) — independent of the schema migration; safe to ship before concerns 1/2/4.
- Concern 5 (legacy doc retirement) — post-migration cleanup; can sequence anywhere after concern 1 lands.

The critical path is: concern 1 (schema) → concern 2 (tests) → concern 4 (UI).

---

## 3. Pre-P4 gate checklist

Do not begin concern 1 drafting until all items below are ✓:

1. KD-9 resolved; `bun run test` reports zero file-load errors.
2. Post-fix baseline recorded and cited in a one-line PR note.
3. `P4_UI_DEPRECATION_AUDIT.md` drafted and approved under §15.
4. This plan approved under §15 review gate.
5. Feature branch created: `feat/p4-economic-cutover` (see §13).
6. A fresh Supabase local dev project provisioned for migration testing.
7. Stripe Connect test-mode credentials confirmed accessible in the dev environment.

---

## 4. Concern 1 — Schema migration set

### 4.1 Goal

Deliver the spec-canonical economic-layer schema with RLS, triggers, and the ledger hash chain. Retire Assignment Engine artefacts. Execute the preserve-with-rename cluster. Do this as five sequenced migrations, each independently verifiable, with matching rollback machinery.

### 4.2 Migrations

The five migrations land in this order. Each is a separate file to keep failure surfaces small (per risk R2). No single migration exceeds ~30 statements where avoidable.

---

#### M1 — `buyer_company_role` identity-layer relocation

**Filename.** `supabase/migrations/20260421000001_relocate_buyer_company_role.sql`

**Depends on.** None (must run before M3).

**DDL skeleton.**

```sql
-- Create the identity-owned type that will outlive the Assignment Engine drop.
CREATE TYPE identity.buyer_company_role AS ENUM ('admin', 'content_commit_holder', 'editor');

-- Switch dependent columns to the new type.
ALTER TABLE buyer_company_memberships
  ALTER COLUMN role TYPE identity.buyer_company_role
  USING role::text::identity.buyer_company_role;

ALTER TABLE company_memberships
  ALTER COLUMN role TYPE identity.buyer_company_role
  USING role::text::identity.buyer_company_role;

-- Old public.buyer_company_role remains until M3 drops the Assignment Engine
-- enum family (reviewer_role etc. still reference the old type until then).
```

**Note on schema choice.** The `identity.` schema prefix above is a placeholder for "an identity-layer location that is not the `public` default the Assignment Engine enums live in." If Frontfiles has no existing identity schema, use a clearly-named standalone type name such as `identity_buyer_company_role` in `public` and adjust accordingly. Decision deferred to Claude Code; either resolves the sequencing risk.

**Acceptance.** After M1: `\d buyer_company_memberships` and `\d company_memberships` both show the new type; seed rows readable; old `public.buyer_company_role` still exists.

**Rollback.** `supabase/migrations/_rollbacks/20260421000001_relocate_buyer_company_role.DOWN.sql` — reverse the two ALTER COLUMNs back to `public.buyer_company_role`, then `DROP TYPE identity.buyer_company_role`.

---

#### M2 — `certified`-family → `provenance`-family rename <!-- allow-banned: rename-mapping narrative per §9 compound-ban clarification -->

**Filename.** `supabase/migrations/20260421000002_rename_certified_to_provenance.sql`

**Depends on.** M1.

**DDL skeleton.**

```sql
-- Table renames
ALTER TABLE certified_packages          RENAME TO provenance_packages;
ALTER TABLE certified_package_items     RENAME TO provenance_package_items;
ALTER TABLE certified_package_artifacts RENAME TO provenance_package_artifacts;

-- Column rename
ALTER TABLE provenance_package_items
  RENAME COLUMN certification_hash_at_issue TO provenance_hash_at_issue;

-- Enum value rename
ALTER TYPE package_artifact_type RENAME VALUE 'certificate' TO 'provenance_record';

-- Trigger name hygiene (optional but clean)
ALTER TRIGGER trg_certified_packages_updated_at ON provenance_packages
  RENAME TO trg_provenance_packages_updated_at;
ALTER TRIGGER trg_certified_packages_protect ON provenance_packages
  RENAME TO trg_provenance_packages_protect;

-- Error-string hygiene inside protect_ready_package() function body
CREATE OR REPLACE FUNCTION protect_ready_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION
      'Cannot modify a revoked provenance package (id=%)',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'ready' THEN
    -- governed-field guard unchanged; only the error message updates
    IF   NEW.package_number              IS DISTINCT FROM OLD.package_number
      OR NEW.transaction_id              IS DISTINCT FROM OLD.transaction_id
      OR NEW.kind                        IS DISTINCT FROM OLD.kind
      OR NEW.owner_user_id               IS DISTINCT FROM OLD.owner_user_id
      OR NEW.owner_company_id            IS DISTINCT FROM OLD.owner_company_id
      OR NEW.total_buyer_pays_cents      IS DISTINCT FROM OLD.total_buyer_pays_cents
      OR NEW.total_creator_receives_cents IS DISTINCT FROM OLD.total_creator_receives_cents
      OR NEW.total_platform_earns_cents  IS DISTINCT FROM OLD.total_platform_earns_cents
      OR NEW.generated_at               IS DISTINCT FROM OLD.generated_at
      OR NEW.ready_at                    IS DISTINCT FROM OLD.ready_at
    THEN
      RAISE EXCEPTION
        'Cannot modify governed fields on a finalized provenance package (id=%, status=%)',
        OLD.id, OLD.status
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION protect_ready_package() IS
  'Revoked packages: blocks all modifications (terminal state).  Ready packages: locks governed fields; allows status transition, revoked_at, version, updated_at.';
```

**Acceptance.** After M2: `\d provenance_packages`, `\d provenance_package_items`, `\d provenance_package_artifacts` all exist; old names do not; `provenance_hash_at_issue` column exists; enum `package_artifact_type` contains `provenance_record` (not `certificate`); `protect_ready_package()` source text contains no banned-term substring.

**Rollback.** Reverse each rename. The enum-value rename reversal uses `ALTER TYPE package_artifact_type RENAME VALUE 'provenance_record' TO 'certificate'` <!-- allow-banned: rollback-rename mapping per §9 compound-ban clarification -->.

---

#### M3 — Assignment Engine drop (15 tables + 19 enums)

**Filename.** `supabase/migrations/20260421000003_drop_assignment_engine.sql`

**Depends on.** M1, M2. **Must** run after M1 (otherwise `CASCADE` takes `buyer_company_memberships` and `company_memberships` with it). May run before or after M4 as long as M4 does not reference dropped names.

**DDL skeleton.**

```sql
-- Drop retiring tables (per §17 crosswalk, 15 entries).
-- Listed in dependency-safe order.
DROP TABLE IF EXISTS special_offer_events      CASCADE;
DROP TABLE IF EXISTS special_offer_threads     CASCADE;
DROP TABLE IF EXISTS offer_checkout_intents    CASCADE;
DROP TABLE IF EXISTS assignment_events         CASCADE;
DROP TABLE IF EXISTS assignment_dispute_cases  CASCADE;
DROP TABLE IF EXISTS ccr_amended_fields        CASCADE;
DROP TABLE IF EXISTS commission_change_requests CASCADE;
DROP TABLE IF EXISTS review_records            CASCADE;
DROP TABLE IF EXISTS service_logs              CASCADE;
DROP TABLE IF EXISTS evidence_items            CASCADE;
DROP TABLE IF EXISTS fulfilment_submissions    CASCADE;
DROP TABLE IF EXISTS milestones                CASCADE;
DROP TABLE IF EXISTS escrow_records            CASCADE;
DROP TABLE IF EXISTS assignment_rights_records CASCADE;
DROP TABLE IF EXISTS assignments               CASCADE;

-- Drop retiring enums (per §17 crosswalk, 19 entries).
-- assignment_state and dispute_state must be dropped before M4 recreates them
-- under the same name with new values.
DROP TYPE IF EXISTS special_offer_event_type            CASCADE;
DROP TYPE IF EXISTS special_offer_auto_cancel_reason    CASCADE;
DROP TYPE IF EXISTS special_offer_status                CASCADE;
DROP TYPE IF EXISTS reviewer_role                       CASCADE;
DROP TYPE IF EXISTS dispute_filer_role                  CASCADE;
DROP TYPE IF EXISTS assignment_dispute_resolution       CASCADE;
DROP TYPE IF EXISTS assignment_dispute_scope            CASCADE;
DROP TYPE IF EXISTS assignment_dispute_trigger          CASCADE;
DROP TYPE IF EXISTS ccr_state                           CASCADE;
DROP TYPE IF EXISTS review_determination                CASCADE;
DROP TYPE IF EXISTS evidence_item_kind                  CASCADE;
DROP TYPE IF EXISTS fulfilment_type                     CASCADE;
DROP TYPE IF EXISTS milestone_type                      CASCADE;
DROP TYPE IF EXISTS assignment_class                    CASCADE;
DROP TYPE IF EXISTS offer_party                         CASCADE;
DROP TYPE IF EXISTS dispute_state                       CASCADE;  -- spec-canonical dispute_state recreated in M4
DROP TYPE IF EXISTS milestone_state                     CASCADE;
DROP TYPE IF EXISTS assignment_sub_state                CASCADE;
DROP TYPE IF EXISTS assignment_state                    CASCADE;  -- spec-canonical assignment_state recreated in M4

-- Drop the now-orphaned public.buyer_company_role type (identity-layer copy in M1 is authoritative)
DROP TYPE IF EXISTS public.buyer_company_role;
```

**Acceptance.** After M3: `SELECT COUNT(*) FROM pg_tables WHERE tablename IN (<15 names>)` returns 0; `SELECT COUNT(*) FROM pg_type WHERE typname IN (<19 names>)` returns 0; `buyer_company_memberships` and `company_memberships` queryable with role column type matching M1's relocation target; no orphan FK references reported by `\d+` on preserved tables.

**Rollback.** Inverse migration is not meaningful (the retiring tables and enums are net-gone by design; re-creating them would undo the architectural cutover). Rollback strategy is `git revert` of the M3 commit combined with a DB restore from the pre-M3 snapshot. This is the only migration in the set whose rollback is out-of-band — deliberate, documented, and stapled to the pre-P4 backup checklist (§12.1).

---

#### M4 — Spec-canonical DDL

**Filename.** `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`

**Depends on.** M3.

**DDL shape (skeleton only; full DDL derives from ECONOMIC_FLOW_v1 §7 / §8). Source of truth is the spec. Any drift between this skeleton and the spec is a spec-win. Do not invent enum values, column names, or column types that do not appear verbatim in §4 / §5 / §7 / §8 / §8.2a / §8.3 / §8.4 / §12.4.**

```sql
-- ── Enums ──
-- offer_state per §4: only the six persisted states. `draft` is client-only and
-- never hits the DB ("Drafts never hit the DB", §4), so it MUST NOT appear here.
CREATE TYPE offer_state AS ENUM (
  'sent', 'countered', 'accepted', 'rejected', 'expired', 'cancelled'
);

-- assignment_state per §5: nine states, exactly.
CREATE TYPE assignment_state AS ENUM (
  'active', 'delivered', 'revision_requested', 'accepted_by_buyer',
  'cashed_out', 'disputed', 'refunded', 'split', 'dispute.under_appeal'
);

-- offer_target_type per §7 inline.
CREATE TYPE offer_target_type AS ENUM (
  'single_asset', 'asset_pack', 'single_brief', 'brief_pack'
);

-- NOT CREATE TYPE (spec uses text + CHECK for these; honour spec literally):
--   • disputes.state         — text + CHECK per §7 disputes block ("enum pinned")
--   • ledger_events.thread_type — text + CHECK per §8.3 DDL block
--   • disputes.reason_code   — text + CHECK per §7 comment ("enumerated per §12.4")
--   • disputes.resolution    — text + CHECK per §7 comment
-- NOT a DDL enum at all (lives inside an event payload, not as a column type):
--   • dispute evidence_type  — 'asset_file'|'text_statement'|'external_link'|'other' per §8.2a
-- NOT in the spec at any layer (do NOT create):
--   • actor_kind             — actor_handles has no such column (§8.4)

-- ── actor_handles per §8.4 (pseudonymisation layer) ──
CREATE TABLE public.actor_handles (
  handle        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tombstoned_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── offers per §7 ──
CREATE TABLE public.offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES public.users(id),
  creator_id        uuid NOT NULL REFERENCES public.users(id),
  target_type       offer_target_type NOT NULL,
  gross_fee         numeric(12,2) NOT NULL,
  platform_fee_bps  int NOT NULL,            -- snapshotted at offer creation, locked for the life of the offer (F16)
  currency          char(3) NOT NULL,
  rights            jsonb NOT NULL,
  current_note      text,                    -- 500-char cap enforced by trigger
  expires_at        timestamptz NOT NULL,
  state             offer_state NOT NULL,
  cancelled_by      uuid REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> creator_id)             -- self-dealing prevention
);

-- ── offer_assets per §7 (target_type in single_asset | asset_pack) ──
CREATE TABLE public.offer_assets (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  position int  NOT NULL,
  PRIMARY KEY (offer_id, asset_id)                  -- subsumes §7 UNIQUE(offer_id, asset_id)
);

-- ── offer_briefs per §7 (target_type in single_brief | brief_pack) ──
CREATE TABLE public.offer_briefs (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  position int  NOT NULL,
  spec     jsonb NOT NULL,
  PRIMARY KEY (offer_id, position)
);

-- ── assignments (shape derived from §5 + §6 + §8.5 + §11.5) ──
-- Fee is NOT snapshotted on assignments. Per §6: "Assignment never re-snapshots
-- the fee. All money values are derived from the originating offer via join on
-- assignments.offer_id → offers.gross_fee, offers.platform_fee_bps."
CREATE TABLE public.assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     uuid NOT NULL UNIQUE REFERENCES public.offers(id),
  state        assignment_state NOT NULL,
  delivered_at timestamptz,                  -- clock origin for 14d auto-accept (§5, §14.2)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── assignment_deliverables per §7 / §11.5 ──
CREATE TABLE public.assignment_deliverables (
  assignment_id  uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  piece_ref      text NOT NULL,
  revision_cap   int  NOT NULL,              -- copied from offer_briefs.spec.revision_cap at creation
  revisions_used int  NOT NULL DEFAULT 0,
  delivered_at   timestamptz,
  PRIMARY KEY (assignment_id, piece_ref)
);

-- ── disputes per §7 (revision 4) ──
CREATE TABLE public.disputes (
  dispute_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       uuid NOT NULL REFERENCES public.assignments(id),
  opener_actor_handle uuid NOT NULL REFERENCES public.actor_handles(handle),
  opened_at           timestamptz NOT NULL DEFAULT now(),
  reason_code         text NOT NULL
    CHECK (reason_code IN (
      -- buyer-initiated per §12.4
      'delivery_incomplete', 'delivery_off_brief', 'rights_mismatch', 'unresponsive_creator',
      -- creator-initiated per §12.4
      'creator_cannot_deliver', 'buyer_fraud_suspicion',
      -- shared
      'other'
    )),
  evidence_refs       jsonb,
  state               text NOT NULL
    CHECK (state IN ('opened', 'resolved', 'appealed', 'appeal_resolved')),  -- §7 "enum pinned"
  resolution          text
    CHECK (resolution IS NULL OR resolution IN ('accepted_by_buyer', 'refunded', 'split')),
  resolution_note     text,
  resolved_at         timestamptz,
  appeal_deadline     timestamptz,            -- resolved_at + 14d per §12.4a
  appeal_resolved_at  timestamptz,
  appeal_rationale    text
);

-- ── ledger_events per §8.3 (single polymorphic table; offer/assignment/dispute threads) ──
CREATE TABLE public.ledger_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_type     text NOT NULL CHECK (thread_type IN ('offer', 'assignment', 'dispute')),
  thread_id       uuid NOT NULL,
  event_type      text NOT NULL,                       -- namespaced: offer.*, assignment.*, dispute.*
  payload_version text NOT NULL DEFAULT 'v1',          -- §8.3 literal: text default 'v1'
  payload         jsonb NOT NULL,                      -- transactional facts only (§8.2 payload discipline)
  actor_ref       uuid NOT NULL REFERENCES public.actor_handles(handle) ON DELETE RESTRICT,
  prev_event_hash text,                                 -- null on first event in a thread
  event_hash      text NOT NULL,                        -- computed server-side in trigger per §8.3 formula
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_events_thread ON public.ledger_events(thread_type, thread_id, created_at);

-- ── RLS ──
ALTER TABLE public.offers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_briefs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actor_handles           ENABLE ROW LEVEL SECURITY;

-- Policy shapes per §7 (offers RLS line) and §8.3 / §8.4 RLS blocks — policies
-- are enumerated in full inside the migration. Shapes summarised here:
--   offers / offer_assets / offer_briefs         — buyer or creator on the parent offer may SELECT; no public; service-role never used
--   assignments / assignment_deliverables        — buyer or creator on the underlying offer may SELECT
--   disputes                                     — party to the assignment or platform admin may SELECT
--   ledger_events                                — party to the thread (resolved via actor_ref → actor_handles.auth_user_id = auth.uid()) or platform admin may SELECT; NO INSERT/UPDATE/DELETE from any non-service role (writes go through SECURITY DEFINER transition functions that own the hash-chain invariant)
--   actor_handles                                — user may SELECT only the row where auth_user_id = auth.uid(); platform admin may SELECT all

-- ── Triggers (per §7 hard constraints + §8.3 hash chain) ──
-- Enumerated here; each body spelled out in full in the migration.
--   T1  same-creator invariant on offer_assets (asset.creator_id = offer.creator_id)
--   T2  target_type XOR — an offer populates offer_assets OR offer_briefs, not both
--   T3  500-char cap on offers.current_note (§7 hard constraint)
--   T4  max 20 rows per offer across offer_assets / offer_briefs (F9)
--   T5  ledger hash-chain enforcement (below)
--   T6  updated_at autotouch on offers / assignments

-- T5 — ledger hash-chain enforcement per §8.3
CREATE OR REPLACE FUNCTION enforce_ledger_hash_chain() RETURNS trigger AS $$
DECLARE
  latest_hash text;
BEGIN
  SELECT event_hash INTO latest_hash
    FROM public.ledger_events
    WHERE thread_type = NEW.thread_type AND thread_id = NEW.thread_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

  IF latest_hash IS DISTINCT FROM NEW.prev_event_hash THEN
    RAISE EXCEPTION
      'Ledger hash chain violation: expected prev_event_hash=%, got %',
      latest_hash, NEW.prev_event_hash
      USING ERRCODE = 'check_violation';
  END IF;

  -- §8.3 formula: sha256(prev_event_hash || payload_version || event_type
  --                     || canonicalised payload || created_at ISO-8601 || actor_ref).
  -- Canonicalisation of the jsonb payload is implementation-specific and must be
  -- agreed between this trigger and the concern-2 Vitest client-side recomputer
  -- (same canonicaliser on both sides; otherwise hashes will not match).
  NEW.event_hash := encode(
    digest(
      COALESCE(NEW.prev_event_hash, '') || '|' ||
      NEW.payload_version                || '|' ||
      NEW.event_type                     || '|' ||
      NEW.payload::text                  || '|' ||
      to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
      NEW.actor_ref::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_events_hash_chain
  BEFORE INSERT ON public.ledger_events
  FOR EACH ROW EXECUTE FUNCTION enforce_ledger_hash_chain();
```

**Acceptance.** After M4: every table, enum, RLS policy, trigger, index, and constraint enumerated in ECONOMIC_FLOW_v1 §7 and §8 is present and queryable; `bun run test -- db/rls` exits green; hash-chain trigger round-trip verified in the same migration via inline DO blocks.

**Rollback.** Matching DOWN file drops the new tables, enums, triggers, and policies in reverse dependency order.

---

#### M5 — System actor handle seed

**Filename.** `supabase/migrations/20260421000005_seed_system_actor.sql`

**Depends on.** M4.

**DDL skeleton.**

```sql
-- Canonical system actor per §8.4 — referenced by every platform-originated
-- ledger event (cron expirations, 14d auto-accept, dispute admin rulings,
-- independent-review rulings, asset-unavailable force-termination).
--
-- The handle is a sentinel UUID, locked for the life of the platform per §8.4.
-- Claude Code fixes the exact UUID during M5 drafting and documents the choice
-- in the M5 header comment. Route handlers load this UUID via a single
-- server-side config constant; it is never exposed to clients.
--
-- Recommended sentinel (subject to M5 drafting):
--   '00000000-0000-0000-0000-000000000001'::uuid

INSERT INTO public.actor_handles (handle, auth_user_id, tombstoned_at)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, NULL, NULL)
ON CONFLICT (handle) DO NOTHING;
```

**Acceptance.** Exactly one row exists in `public.actor_handles` with `handle` equal to the sentinel UUID chosen in M5; `auth_user_id IS NULL`; `tombstoned_at IS NULL`. The sentinel value is recorded in the M5 header comment and in the server-side config constant introduced under concern 3.

**Rollback.** `DELETE FROM public.actor_handles WHERE handle = '<sentinel>'::uuid`. Safe only if no `ledger_events` reference it — which is true immediately post-M5. After P4 → P5 runtime traffic, rollback of M5 is not safe.

---

### 4.3 Preflight introspection

Mirror the existing `supabase/migrations/_preflight/20260420010000_rename_introspection.sql` pattern. Before M2, a preflight script queries `pg_tables` and `pg_type` for the rename-source names and the rename-target names. Script exits non-zero if any source missing or any target already present.

**Filename.** `supabase/migrations/_preflight/20260421000002_rename_introspection.sql`.

### 4.4 Rollback machinery

Each migration's DOWN file lives at `supabase/migrations/_rollbacks/<migration>.DOWN.sql`. Consistent with the existing `_rollbacks/20260420010000_rename_direct_offer_to_special_offer.DOWN.sql` precedent. Exception: M3 has no meaningful DOWN (see §4.2 M3 note); its rollback path is `git revert` + DB restore.

### 4.5 Acceptance criteria for concern 1

All of:

1. Five migrations apply cleanly against a fresh Supabase dev project in sequence.
2. All four DOWN files (M1, M2, M4, M5) apply cleanly after their parent migration.
3. Pre-M3 snapshot captured (`pg_dump`), retained 30 days as M3 rollback material.
4. Banned-term lint (`rg -n 'certif\|immutab\|tamper.proof' supabase/migrations/20260421*.sql`) returns only lines inside `allow-banned` markers or inside rename-mapping strings.
5. `\d` on each spec-canonical table matches §7; `\dT` on each enum matches §8.
6. Concern-2 test suite passes (inter-dependency with §5).

### 4.6 Day estimate

| Step | Days |
|---|---|
| M1 drafting + local round-trip | 1 |
| M2 drafting + local round-trip + trigger-body verification | 1 |
| M3 drafting + CASCADE impact audit + local round-trip | 1–2 |
| M4 drafting (wide surface: DDL + RLS + triggers + hash chain) + local round-trip | 3–4 |
| M5 drafting (trivial) | 0.5 |
| Preflight scripts + rollback files | 1 |
| Integration run against dev project + fixes | 2 |
| **Concern 1 total** | **9.5–11.5 days** |

---

## 5. Concern 2 — T4 acceptance test suite

### 5.1 Goal

Deliver the five-scenario acceptance suite from REMEDIATION_PLAN L532 as executable Vitest tests against a live Supabase dev project. This suite is what evidences P4 "done."

### 5.2 Test scenarios

Per REMEDIATION_PLAN L532, expanded:

1. **Schema presence.** `CREATE TABLE offers / assignments / disputes / ledger_events / actor_handles / assignment_deliverables` all present; columns match §7; enums match §8.
2. **System actor seed.** Single `actor_handles` row with `handle` equal to the sentinel UUID fixed in M5; `auth_user_id IS NULL`; `tombstoned_at IS NULL`.
3. **Hash-chain round-trip.** Run: `offer.sent` → `offer.countered` → `offer.accepted` → `assignment.delivered` → `assignment.accepted_by_buyer` → `assignment.cashed_out`. Assert six `ledger_events` rows written across two threads (offer thread and assignment thread); `prev_hash`/`event_hash` chain unbroken in each thread; recomputing `event_hash` client-side from `prev_hash || payload` produces the stored hash.
4. **Dispute dual-thread emit.** Trigger `dispute.opened` mid-assignment; assert `disputes` row created, `assignment.disputed` event emitted on assignment thread AND `dispute.opened` event emitted on dispute thread per §8.2a; three subsequent `dispute.evidence_submitted` events land on dispute thread with working hash chain.
5. **Stripe escrow ordering under failure injection.** Simulate Stripe Connect transfer failure mid-cashout; assert platform state reconciles per §8.5 (no ledger event for the failed transfer; `assignment.cashed_out` not emitted until retry succeeds).

### 5.3 Test location and fixtures

**File.** `src/lib/economic-flow/__tests__/p4-acceptance.test.ts` (net-new directory `src/lib/economic-flow/`).

**Fixtures.** Test uses a dedicated dev-project Supabase DB that the suite resets between scenarios. Helper at `src/lib/test/economic-flow-fixtures.ts` seeds a deterministic buyer + creator + asset set.

**Stripe.** Test-mode Stripe Connect credentials read from `.env.test`; failure injection uses Stripe's test-clock plus explicit HTTP mock for the transfer-failure case.

### 5.4 Dependencies

- KD-9 resolved (Vitest env loading works).
- Concern 1 complete (or at least M1–M4 landed in the dev project).
- `SUPABASE_TEST_DB_URL` env var and RLS test-runner plumbing available.

### 5.5 Acceptance criteria for concern 2

1. `bun run test -- p4-acceptance` passes five scenarios against a fresh dev project.
2. Suite runs in CI and gates the P4 branch merge.
3. Each scenario's assertion text matches §7 / §8 / §8.2a / §8.5 language to prevent spec drift.

### 5.6 Day estimate

5–8 days.

---

## 6. Concern 3 — AUTH_WIRED plumbing

### 6.1 Goal

Introduce a per-environment gate that controls whether the new auth flow (spec-canonical actor resolution, RLS-bound session clients) is active or the legacy scaffolding path is used. Default false in deploy 1; flipped true at P5.

### 6.2 Files

| File | Change |
|---|---|
| `src/lib/env.ts` | Add `AUTH_WIRED: boolean` to the parsed env schema; read from `process.env.FFF_AUTH_WIRED`; default false; invalid values throw at boot |
| `src/lib/auth/require-actor.ts` (new) | `requireActor(req)` returns the spec-canonical actor; fail-closed when `AUTH_WIRED=false` and request hits a gated route |
| `src/middleware.ts` or equivalent | Gate the 13 retiring routes' replacements behind `AUTH_WIRED`; return `FEATURE_DISABLED` 404 when false (matches the existing `FFF Sharing is not enabled` pattern on posts routes) |
| `.env.example` | Document `FFF_AUTH_WIRED` with default false |
| `.env.test` | `FFF_AUTH_WIRED=true` for test-environment coverage of the live-path |

### 6.3 Behavior

- `AUTH_WIRED=false` (default, deploy 1): new auth and spec-canonical routes return `FEATURE_DISABLED`. The UI treats this response as "feature coming soon" — handled in concern 4.
- `AUTH_WIRED=true` (P5 cutover): new auth active; legacy routes already 410-gone post-M3 (no rollback surface for legacy routes after M3).
- Fail-closed: if the env var is unset, missing, or invalid, behavior is as `false`.

### 6.4 Tests

- Unit: `require-actor.ts` correctness under both flag states.
- Integration: middleware emits `FEATURE_DISABLED` on a gated route when `AUTH_WIRED=false`; emits normal response when `true`.
- Coverage: at least one test per flag state.

### 6.5 Acceptance criteria for concern 3

1. `FFF_AUTH_WIRED` parsed in `src/lib/env.ts`; mis-parsed values throw at boot.
2. Middleware returns `FEATURE_DISABLED` on retiring-route replacements when flag is false.
3. P5 hard-cut requires only `.env.production` setting `FFF_AUTH_WIRED=true` (no code change).
4. Both-state test coverage in CI.

### 6.6 Day estimate

2–3 days.

---

## 7. Concern 4 — UI cutover

### 7.1 Goal

Retire the 13 API routes and their 9 consuming UI pages; replace with spec-canonical routes and UI; sequence cutover behind the `AUTH_WIRED` flag so deploy 1 can ship migration + plumbing without breaking user flows.

### 7.2 Deliverable

The authoritative per-consumer map lives at `docs/audits/P4_UI_DEPRECATION_AUDIT.md`. That document enumerates every UI page, component, hook, and fetch call-site that consumes a retiring route; classifies each as delete, rewrite, or migrate; sequences retirements vs. the migration cut-over.

This section of the plan does not duplicate the audit — it governs the interaction between the audit's per-consumer classifications and the P4 schedule.

### 7.3 Feature flag mechanism

Concern 3's `AUTH_WIRED` serves double duty:

- Deploy 1 ships migration + UI **code** for the new routes, gated `AUTH_WIRED=false` → the new code path returns `FEATURE_DISABLED`. Legacy UI pages are left in place for the deploy-1 window since the old routes were dropped at M3 but the UI hasn't cut over yet — conflict resolved by ensuring the old UI pages either are behind an intermediate "coming soon" splash OR are fully replaced in deploy 1. The audit document makes this per-page call.
- Deploy 2 flips `AUTH_WIRED=true` and activates the new UI paths end-to-end.

The intermediate window (M3 landed, `AUTH_WIRED=false`) must be zero-traffic in production. This is enforced by scheduling the M3 migration and the `AUTH_WIRED=true` flip within the **same** deploy window — i.e., in practice, deploys 1 and 2 can collapse into a single deploy for environments where a multi-hour "feature disabled" window is not acceptable.

### 7.4 Two-deploy vs single-deploy sequencing

| Strategy | Pro | Con | Default |
|---|---|---|---|
| Single-deploy (M1–M5 + UI cutover + `AUTH_WIRED=true` all in one push) | No feature-disabled window; cleaner UX | All-or-nothing rollback; higher release-night risk | Recommended for staging and dev |
| Two-deploy (M1–M5 + plumbing, then later UI cutover + flag flip) | Smaller per-release surface; independently testable in prod | Feature-disabled window requires UI splash | Recommended for production if release window is short |

Final pick is a release-engineering call to be made at Gate 3.5 (not a governance gate) — this plan supports either.

### 7.5 Acceptance criteria for concern 4

Enumerated in `P4_UI_DEPRECATION_AUDIT.md`; summary:

1. Zero call sites in `src/**` reference the 13 retiring routes post-cutover.
2. All 9 retiring UI pages either deleted or rewritten against spec-canonical routes.
3. `AssetRightsModule.tsx` buyer CTA points at the new offer-creation flow.
4. No `src/components/assignment/**` references in production code paths post-cutover (directory may remain in git history as a dead-letter until concern 5).

### 7.6 Day estimate

7–12 days. Depends on the audit's classification split between delete / rewrite / migrate — established in the UI audit doc.

---

## 8. Concern 5 — Legacy doc retirement

### 8.1 Goal

Retire repository-root docs that predate ECONOMIC_FLOW_v1 and contradict the spec-canonical surface. Post-P4 cleanup; not gating for P5.

### 8.2 Target docs

Inspected at repo root 2026-04-20:

| Doc | Disposition | Rationale |
|---|---|---|
| `SPECIAL_OFFER_SPEC.md` | **delete** | Superseded by ECONOMIC_FLOW_v1 §4 / §7 / §8; describes retired routes |
| `ASSIGNMENT_DISPUTE_TAXONOMY.md` | **delete** | Superseded by ECONOMIC_FLOW_v1 §7 / §8.2a / §12.4 |
| `P5_PAUSED_HANDOFF_20260418.md` | **archive** to `docs/history/` | Process artefact; valuable audit trail, not governing |
| `CLAUDE_CODE_PROMPT_SEQUENCE.md` | **review and retain or archive** | Status TBD — may still govern non-economic-layer work |
| `PLATFORM_BUILD.md`, `PLATFORM_REVIEWS.md`, `ROADMAP.md`, `FEATURE_APPROVAL_ROADMAP.md`, `INTEGRATION_READINESS.md`, `KD-9-audit.md` | **review, likely retain** | Not flagged as contradicting ECONOMIC_FLOW_v1; audited one-by-one |

### 8.3 Acceptance criteria for concern 5

1. Each target doc has an explicit disposition decision recorded.
2. Archived docs moved to `docs/history/` preserving filename.
3. Deleted docs removed in a single commit with message explaining the supersession.
4. `git log --follow` preserves history for archived docs.

### 8.4 Day estimate

0.5–1 day.

---

## 9. P4 → P5 cutover gate

### 9.1 Gate criteria

All must be true before P5 hard-cut:

1. Concern 1 acceptance met on production DB (migration dry-run on a prod snapshot passed; production-snapshot verified).
2. Concern 2 acceptance met in CI on the merge candidate.
3. Concern 3 deploy-1 shipped; `FFF_AUTH_WIRED=false` confirmed in prod.
4. Concern 4 either deployed or queued in deploy-2 per chosen sequencing.
5. Stripe Connect platform account verified in prod with test-mode → live-mode transition complete.
6. Platform fee rate (F16) confirmed via spec-level signoff note attached to the commit.
7. Backups of pre-P4 DB retained for 30 days minimum.

### 9.2 Cutover mechanics

P5 hard-cut is an environment-variable flip: `FFF_AUTH_WIRED=false` → `true` on production. Deploy, verify, monitor. Rollback path in §12.3.

### 9.3 Post-cutover prod assertion

Within 24h of the flip, the following must be true in prod:

1. One `actor_handles` row with `handle` equal to the M5 sentinel UUID, `auth_user_id IS NULL`, `tombstoned_at IS NULL`.
2. At least one `offers` row created via the spec-canonical flow.
3. Zero 5xx from the spec-canonical routes over the last 1h.
4. `ledger_events.prev_hash`/`event_hash` chain intact per thread (sampled).

---

## 10. Risk register

| # | Risk | Severity | Mitigation | Status |
|---|---|---|---|---|
| R1 | `buyer_company_role` relocation sequencing error takes out preserved identity-layer tables | Critical | M1 lands before M3 in separate migration; preflight verifies enum presence in both schemas; both `buyer_company_memberships` and `company_memberships` ALTER COLUMN covered | Mitigated by plan |
| R2 | Migration transaction size hits edge-case constraint or lock contention | High | Split into 5 independent migrations; each has DOWN (M1, M2, M4, M5) or snapshot-backed rollback (M3); pre-M3 `pg_dump` retained 30 days | Mitigated by plan |
| R3 | UI breaks at deploy because consumer audit incomplete | High | `P4_UI_DEPRECATION_AUDIT.md` is gating prerequisite; deploy-2 gated behind `AUTH_WIRED` flag | Mitigated by plan |
| R4 | Test infrastructure cannot verify P4 (KD-9 unresolved; file-load errors persist) | High | KD-9 promoted to hard pre-P4 prerequisite (§2.2 #7) | Open; depends on P0 owner |
| R5 | Hash-chain invariant violated in production under concurrent inserts | Medium-High | Server-side hash computation; `FOR UPDATE` lock on latest thread event in the trigger; concurrent-insert fuzz test in concern 2 | Mitigated by plan; verify in concern 2 |

---

## 11. Day-count rollup

| Concern | Days |
|---|---|
| Pre-P4 work (KD-9 + baseline + UI audit doc finalization + plan approval) | 3–5 |
| Concern 1 — Schema migration set | 9.5–11.5 |
| Concern 2 — T4 acceptance tests | 5–8 |
| Concern 3 — AUTH_WIRED plumbing | 2–3 |
| Concern 4 — UI cutover | 7–12 |
| Concern 5 — Legacy doc retirement | 0.5–1 |
| Integration + incident response buffer | 4–6 |
| **Total honest days** | **31–46.5 days** |
| **Calendar weeks at solo velocity** | **8–12 weeks** |

Critical path: pre-P4 → concern 1 → concern 2 → concern 4. Concerns 3 and 5 run in parallel.

---

## 12. Rollback plan

### 12.1 Migration-level rollback

Per-migration DOWN files exist for M1, M2, M4, M5. Apply in reverse sequence. M3 rollback is out-of-band: `git revert` of the M3 commit plus DB restore from the pre-M3 snapshot.

**Snapshot retention.** The pre-M3 snapshot (`pg_dump` of the full DB immediately before M3 applies) is retained 30 days in secure storage with access limited to the P4 migration author and platform owner.

### 12.2 UI cutover mid-deploy rollback

If deploy-2 (UI cutover) encounters a blocker mid-release:

1. Set `FFF_AUTH_WIRED=false` immediately.
2. All spec-canonical UI routes now emit `FEATURE_DISABLED`.
3. No data integrity impact — ledger and schema untouched.
4. Fix the UI issue at leisure; re-deploy.

### 12.3 `AUTH_WIRED` emergency revert

If `AUTH_WIRED=true` flip produces prod errors:

1. Set `FFF_AUTH_WIRED=false` via env-var update.
2. New traffic hits `FEATURE_DISABLED`. In-flight requests complete against the live path (possibly producing partial data).
3. Post-mortem on which ledger events landed mid-revert; hash-chain integrity verified as part of post-revert audit.
4. This path is for emergencies only — normal behavior is to roll forward, not back.

---

## 13. Handoff pattern

### 13.1 Branch and commit topology

**Recommended (default):**

- Feature branch `feat/p4-economic-cutover` off `main`.
- One commit per concern inside the branch; each commit tagged `checkpoint/p4-concern-N-20260421` on exit.
- Merge to `main` only at P5 hard-cut, as a single merge-commit. The merge is the P5 hard-cut event.

**Alternative (staged-main):**

- Commits land on `main` as concerns complete, behind `AUTH_WIRED=false`.
- P5 flip is a pure env-var change, no merge event.

**Default pick.** Feature branch. Rationale: atomic rollback if acceptance fails; clean `git log` demarcation of the P4 era; matches the tagged-checkpoint pattern used through ECON_FLOW revisions.

**Decision requested at Gate 3.** Founder ratifies the feature-branch default, or picks staged-main instead.

### 13.2 Gate-per-concern discipline

Each concern produces an exit report when Claude Code finishes drafting. Founder reviews the exit report (same Phase-A-through-D pattern used in ECON_FLOW revisions 4/5/6) before Claude Code begins the next concern.

### 13.3 Directive template

Each concern's Claude Code directive has this shape:

```
PHASE: P4 Concern N — <name>
SCOPE: <one-paragraph scope from this plan>
GATE: Do not open any file outside §<section>'s Files list. If a
      precondition mismatches, STOP and report.
PRECONDITIONS: <from §<section>'s Depends-on>
DELIVERABLES: <from §<section>'s Files / DDL skeleton / test list>
ACCEPTANCE: <from §<section>'s Acceptance criteria>
VERIFY: <specific commands; lint; banned-term check>
COMMIT: <message template, with Co-Authored-By line>
EXIT REPORT: <git status, diff-stat, test output, sha>
```

Directives are drafted in this session (by me) before being handed to Claude Code. This mirrors the ECON_FLOW revision 4 / 5 / 6 and housekeeping workflow.

---

## 14. Revision history

**Revision 1 — 2026-04-20.** Initial plan drafted under Gate 3a skeleton approval. Authors: founder + Claude (Cowork). Concurrent deliverable: `P4_UI_DEPRECATION_AUDIT.md` drafted alongside. Pending founder sign-off under §15 review gate (§14.1 Assignment Engine sunset sub-clause is the governed section).

---

_End of P4 Implementation Plan._
