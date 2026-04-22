-- ════════════════════════════════════════════════════════════════
-- P4 concern 1 — M4: spec-canonical economic-layer DDL.
-- Lands the eight §7 tables (offers, offer_assets, offer_briefs,
-- assignments, assignment_deliverables, disputes, ledger_events,
-- actor_handles), the three §4/§5/§7-derived enums, the §8.3 ledger
-- hash chain, §7 hard-constraint triggers, and RLS policies per
-- §7/§8.3/§8.4.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M4
-- Spec:      docs/specs/ECONOMIC_FLOW_v1.md §4, §5, §6, §7, §8 (header),
--            §8.2, §8.2a, §8.3, §8.4, §8.5, §11.5, §12.4
--
-- Source-of-truth rule (directive §M4). Every enum value, column
-- name, and column type in this migration must appear verbatim in
-- §4 / §5 / §7 / §8 / §8.2a / §8.3 / §8.4 / §12.4. If this file
-- drifts from the spec, the spec wins.
--
-- Known open items surfaced in exit report:
--   - §7 offer_assets.asset_id fk(assets) — no `public.assets` table
--     exists on the live DB. The authoritative asset table is
--     `public.vault_assets` (§14.1 "out of retirement scope"). This
--     migration wires the FK to public.vault_assets(id) so the
--     migration applies cleanly. Surfaced for founder review.
--   - `is_platform_admin()` function — v1 has no platform-admin role
--     defined. This migration installs a stub that returns FALSE so
--     the §8.3/§8.4 admin-read clauses compile; re-definable when an
--     admin role surfaces (concern 3 or later).
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Enums (three; §4, §5, §7) ──────────────────────────────────

-- offer_state per §4: SIX persisted values. `draft` is client-only
-- per §4 ("Drafts never hit the DB") and MUST NOT appear here.
CREATE TYPE public.offer_state AS ENUM (
  'sent',
  'countered',
  'accepted',
  'rejected',
  'expired',
  'cancelled'
);

-- assignment_state per §5: NINE values exactly, including the
-- literal 'dispute.under_appeal' (with the dot, per §5 table row).
CREATE TYPE public.assignment_state AS ENUM (
  'active',
  'delivered',
  'revision_requested',
  'accepted_by_buyer',
  'cashed_out',
  'disputed',
  'refunded',
  'split',
  'dispute.under_appeal'
);

-- offer_target_type per §7 inline declaration.
CREATE TYPE public.offer_target_type AS ENUM (
  'single_asset',
  'asset_pack',
  'single_brief',
  'brief_pack'
);

-- Note on spec-literal text+CHECK columns (NOT enums):
--   disputes.state             — text+CHECK per §7 ("enum pinned")
--   disputes.reason_code       — text+CHECK per §7 / §12.4
--   disputes.resolution        — text+CHECK per §7
--   ledger_events.thread_type  — text+CHECK per §8.3 literal DDL
-- Note on spec-literal payload fields (NOT DDL at all):
--   dispute evidence_type      — lives inside the
--                                `dispute.evidence_submitted` payload
--                                per §8.2a; not a column type.
-- Note on non-existence:
--   actor_kind                 — NOT in spec (§8.4 has no such column).


-- ── actor_handles per §8.4 ────────────────────────────────────
-- Pseudonymisation layer. Events reference parties via handle, not
-- auth user id. System actor row is seeded in M5.
CREATE TABLE public.actor_handles (
  handle        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tombstoned_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS predicate needs fast (auth_user_id = auth.uid()) lookup.
CREATE UNIQUE INDEX actor_handles_auth_user_id_unique
  ON public.actor_handles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;


-- ── offers per §7 ─────────────────────────────────────────────
CREATE TABLE public.offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES public.users(id),
  creator_id        uuid NOT NULL REFERENCES public.users(id),
  target_type       public.offer_target_type NOT NULL,
  gross_fee         numeric(12,2) NOT NULL,                    -- total paid by buyer (§7)
  platform_fee_bps  int NOT NULL,                              -- snapshotted at offer creation, locked for offer life (§7 / F16)
  currency          char(3) NOT NULL,
  rights            jsonb NOT NULL,                            -- shape per §7 rights-template paragraph
  current_note      text,                                      -- 500-char cap enforced by trigger (§7)
  expires_at        timestamptz NOT NULL,
  state             public.offer_state NOT NULL,
  cancelled_by      uuid REFERENCES public.users(id),          -- populated only on cancel (§7)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_self_dealing_prevention CHECK (buyer_id <> creator_id)
);

CREATE INDEX offers_buyer_id_idx         ON public.offers (buyer_id);
CREATE INDEX offers_creator_id_idx       ON public.offers (creator_id);
CREATE INDEX offers_state_expires_at_idx ON public.offers (state, expires_at);


-- ── offer_assets per §7 (single_asset | asset_pack) ───────────
-- Spec §7 writes `asset_id uuid fk(assets)`; live DB has no
-- `public.assets` table. Authoritative asset table is
-- `public.vault_assets` (§14.1 preserved-as-is). FK wired to
-- vault_assets(id); surfaced as open item in exit report.
CREATE TABLE public.offer_assets (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.vault_assets(id),
  position int  NOT NULL,
  PRIMARY KEY (offer_id, asset_id)                              -- subsumes §7 UNIQUE(offer_id, asset_id)
);

CREATE INDEX offer_assets_asset_id_idx ON public.offer_assets (asset_id);


-- ── offer_briefs per §7 (single_brief | brief_pack) ───────────
CREATE TABLE public.offer_briefs (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  position int  NOT NULL,
  spec     jsonb NOT NULL,                                      -- {title, deadline_offset_days, deliverable_format, revision_cap, notes}
  PRIMARY KEY (offer_id, position)
);


-- ── assignments (§5 / §6 / §8.5 / §11.5) ──────────────────────
-- §6 invariant: "Assignment never re-snapshots the fee. All money
-- values are derived from the originating offer via join on
-- assignments.offer_id → offers.gross_fee, offers.platform_fee_bps."
-- No gross_fee column. No platform_fee_bps column.
CREATE TABLE public.assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     uuid NOT NULL UNIQUE REFERENCES public.offers(id),
  state        public.assignment_state NOT NULL,
  delivered_at timestamptz,                                     -- clock origin for 14d auto-accept (§5, §14.2)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assignments_state_delivered_at_idx ON public.assignments (state, delivered_at);


-- ── assignment_deliverables per §7 / §11.5 ────────────────────
CREATE TABLE public.assignment_deliverables (
  assignment_id  uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  piece_ref      text NOT NULL,                                 -- matches offer_briefs.position or stable slug
  revision_cap   int  NOT NULL,                                 -- copied from offer_briefs.spec.revision_cap at creation
  revisions_used int  NOT NULL DEFAULT 0,
  delivered_at   timestamptz,
  PRIMARY KEY (assignment_id, piece_ref)
);


-- ── disputes per §7 (rev 4) ───────────────────────────────────
-- state / reason_code / resolution are text+CHECK per §7 literal
-- comment ("enum pinned" / "enumerated per §12.4 reason codes").
-- Seven reason codes per §12.4 (not five): buyer-initiated
-- (delivery_incomplete, delivery_off_brief, rights_mismatch,
-- unresponsive_creator, other) + creator-initiated
-- (creator_cannot_deliver, buyer_fraud_suspicion, other).
CREATE TABLE public.disputes (
  dispute_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       uuid NOT NULL REFERENCES public.assignments(id),
  opener_actor_handle uuid NOT NULL REFERENCES public.actor_handles(handle),
  opened_at           timestamptz NOT NULL DEFAULT now(),
  reason_code         text NOT NULL,
  evidence_refs       jsonb,
  state               text NOT NULL,
  resolution          text,
  resolution_note     text,
  resolved_at         timestamptz,
  appeal_deadline     timestamptz,                              -- resolved_at + 14d per §12.4a
  appeal_resolved_at  timestamptz,
  appeal_rationale    text,
  CONSTRAINT disputes_reason_code_check CHECK (reason_code IN (
    'delivery_incomplete',
    'delivery_off_brief',
    'rights_mismatch',
    'unresponsive_creator',
    'creator_cannot_deliver',
    'buyer_fraud_suspicion',
    'other'
  )),
  CONSTRAINT disputes_state_check CHECK (state IN (
    'opened',
    'resolved',
    'appealed',
    'appeal_resolved'
  )),
  CONSTRAINT disputes_resolution_check CHECK (
    resolution IS NULL OR resolution IN ('accepted_by_buyer', 'refunded', 'split')
  )
);

CREATE INDEX disputes_assignment_id_idx ON public.disputes (assignment_id);
CREATE INDEX disputes_opener_handle_idx ON public.disputes (opener_actor_handle);


-- ── ledger_events per §8.3 ────────────────────────────────────
-- Single polymorphic table; thread_type text+CHECK per §8.3 literal.
-- Hash-chain computation lives in the BEFORE INSERT trigger below.
-- payload_version is `text default 'v1'` per §8.3 literal.
-- prev_event_hash (NOT prev_hash). created_at (NOT emitted_at).
-- actor_ref → actor_handles(handle) (NOT actor_handles(id)).
CREATE TABLE public.ledger_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_type     text NOT NULL CHECK (thread_type IN ('offer', 'assignment', 'dispute')),
  thread_id       uuid NOT NULL,
  event_type      text NOT NULL,                                -- namespaced: offer.*, assignment.*, dispute.*
  payload_version text NOT NULL DEFAULT 'v1',
  payload         jsonb NOT NULL,                               -- transactional facts only (§8.2 discipline)
  actor_ref       uuid NOT NULL REFERENCES public.actor_handles(handle) ON DELETE RESTRICT,
  prev_event_hash text,                                          -- first row in a thread may be null
  event_hash      text NOT NULL,                                 -- computed by trigger per §8.3 formula
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- §8.3 literal index.
CREATE INDEX ledger_events_thread
  ON public.ledger_events (thread_type, thread_id, created_at);

-- RLS-predicate support: fast lookups for "party to the thread via
-- actor_ref → actor_handles.auth_user_id = auth.uid()".
CREATE INDEX ledger_events_actor_ref_idx ON public.ledger_events (actor_ref);


-- ── Platform-admin stub function ──────────────────────────────
-- Referenced by §8.3 / §8.4 admin-read policies. v1 has no platform
-- admin role; this stub returns FALSE so policies compile and reject
-- admin access by default. Redefinable in concern 3 or later without
-- touching the policies themselves.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT FALSE
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Stub: v1 has no platform-admin role. Returns FALSE. Redefined when the admin role lands (concern 3 or later). Referenced by ledger_events / disputes / actor_handles RLS.';


-- ── Trigger bodies ────────────────────────────────────────────

-- T1  Same-creator invariant on offer_assets (§7).
--     Every asset in an offer must belong to the same creator as
--     the offer's creator_id.
CREATE OR REPLACE FUNCTION public.enforce_offer_assets_same_creator()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  offer_creator uuid;
  asset_creator uuid;
BEGIN
  SELECT creator_id INTO offer_creator FROM public.offers      WHERE id = NEW.offer_id;
  SELECT creator_id INTO asset_creator FROM public.vault_assets WHERE id = NEW.asset_id;
  IF offer_creator IS NULL THEN
    RAISE EXCEPTION 'offer_assets.offer_id=% references no offer', NEW.offer_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF asset_creator IS NULL THEN
    RAISE EXCEPTION 'offer_assets.asset_id=% references no asset', NEW.asset_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF offer_creator <> asset_creator THEN
    RAISE EXCEPTION
      'offer_assets: asset creator (%) differs from offer creator (%)',
      asset_creator, offer_creator
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offer_assets_same_creator
  BEFORE INSERT OR UPDATE ON public.offer_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_assets_same_creator();


-- T2  target_type XOR — an offer populates offer_assets OR
--     offer_briefs, not both (§7).
--     Installed on both child tables so either side's INSERT blocks
--     if it contradicts the parent's target_type or if the other
--     side already has rows for that offer.
CREATE OR REPLACE FUNCTION public.enforce_offer_target_type_xor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_target_type public.offer_target_type;
BEGIN
  SELECT target_type INTO parent_target_type
    FROM public.offers WHERE id = NEW.offer_id;

  IF parent_target_type IS NULL THEN
    RAISE EXCEPTION 'offer % not found', NEW.offer_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF TG_TABLE_NAME = 'offer_assets' THEN
    IF parent_target_type NOT IN ('single_asset', 'asset_pack') THEN
      RAISE EXCEPTION
        'offer_assets row for offer %: parent target_type=% disallows asset rows',
        NEW.offer_id, parent_target_type
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.offer_briefs WHERE offer_id = NEW.offer_id) THEN
      RAISE EXCEPTION
        'offer_assets: offer % already has brief rows (target_type XOR violated)',
        NEW.offer_id
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'offer_briefs' THEN
    IF parent_target_type NOT IN ('single_brief', 'brief_pack') THEN
      RAISE EXCEPTION
        'offer_briefs row for offer %: parent target_type=% disallows brief rows',
        NEW.offer_id, parent_target_type
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.offer_assets WHERE offer_id = NEW.offer_id) THEN
      RAISE EXCEPTION
        'offer_briefs: offer % already has asset rows (target_type XOR violated)',
        NEW.offer_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offer_assets_target_type_xor
  BEFORE INSERT OR UPDATE ON public.offer_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_target_type_xor();

CREATE TRIGGER trg_offer_briefs_target_type_xor
  BEFORE INSERT OR UPDATE ON public.offer_briefs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_target_type_xor();


-- T3  500-char cap on offers.current_note (§7 hard constraint).
--     Trigger not CHECK because spec marks current_note as text
--     (not varchar(500)); keeps type flexible, enforces limit on
--     mutation.
CREATE OR REPLACE FUNCTION public.enforce_offers_note_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_note IS NOT NULL AND length(NEW.current_note) > 500 THEN
    RAISE EXCEPTION
      'offers.current_note exceeds 500-char cap (%)',
      length(NEW.current_note)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offers_note_cap
  BEFORE INSERT OR UPDATE OF current_note ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offers_note_cap();


-- T4  Max 20 items per offer across offer_assets/offer_briefs (F9).
CREATE OR REPLACE FUNCTION public.enforce_offer_max_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_items int;
BEGIN
  SELECT
    (SELECT count(*) FROM public.offer_assets WHERE offer_id = NEW.offer_id) +
    (SELECT count(*) FROM public.offer_briefs WHERE offer_id = NEW.offer_id)
    INTO total_items;

  IF total_items > 20 THEN
    RAISE EXCEPTION
      'offer % exceeds pack-size cap of 20 items (%)',
      NEW.offer_id, total_items
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offer_assets_max_items
  AFTER INSERT ON public.offer_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_max_items();

CREATE TRIGGER trg_offer_briefs_max_items
  AFTER INSERT ON public.offer_briefs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_max_items();


-- T5  Ledger hash-chain enforcement per §8.3.
--     Formula: sha256(prev_event_hash || payload_version ||
--              event_type || canonical payload ||
--              created_at ISO-8601 || actor_ref).
--     No thread_type, no thread_id in the digest.
--     NEW.created_at is evaluated AFTER Postgres has filled in the
--     DEFAULT now() (BEFORE INSERT on table-level default still
--     sees the computed default value).
CREATE OR REPLACE FUNCTION public.enforce_ledger_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  latest_hash text;
BEGIN
  SELECT event_hash INTO latest_hash
    FROM public.ledger_events
    WHERE thread_type = NEW.thread_type
      AND thread_id   = NEW.thread_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

  IF latest_hash IS DISTINCT FROM NEW.prev_event_hash THEN
    RAISE EXCEPTION
      'ledger_events hash-chain violation: expected prev_event_hash=%, got %',
      latest_hash, NEW.prev_event_hash
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.event_hash := encode(
    extensions.digest(
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
$$;

CREATE TRIGGER trg_ledger_events_hash_chain
  BEFORE INSERT ON public.ledger_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ledger_hash_chain();


-- T6  updated_at autotouch on offers / assignments.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.offers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_briefs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actor_handles           ENABLE ROW LEVEL SECURITY;


-- offers: buyer or creator on the row itself may SELECT (§7 RLS
-- line). No public. Service role never used for offer routes per
-- §7 — writes go through user-JWT clients with explicit INSERT/
-- UPDATE policies.
CREATE POLICY offers_party_select ON public.offers
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY offers_buyer_insert ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY offers_party_update ON public.offers
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR creator_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR creator_id = auth.uid());


-- offer_assets: buyer or creator on the parent offer may SELECT /
-- INSERT / DELETE (composer + counter paths).
CREATE POLICY offer_assets_party_select ON public.offer_assets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_assets.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));

CREATE POLICY offer_assets_party_write ON public.offer_assets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_assets.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_assets.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));


-- offer_briefs: buyer or creator on the parent offer may SELECT /
-- INSERT / DELETE (composer + counter paths).
CREATE POLICY offer_briefs_party_select ON public.offer_briefs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_briefs.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));

CREATE POLICY offer_briefs_party_write ON public.offer_briefs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_briefs.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_briefs.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));


-- assignments: buyer or creator on the underlying offer may SELECT.
CREATE POLICY assignments_party_select ON public.assignments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = assignments.offer_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));


-- assignment_deliverables: buyer or creator on the underlying offer
-- may SELECT.
CREATE POLICY assignment_deliverables_party_select ON public.assignment_deliverables
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.offers      o ON o.id = a.offer_id
    WHERE a.id = assignment_deliverables.assignment_id
      AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
  ));


-- disputes: party to the underlying assignment OR platform admin
-- may SELECT.
CREATE POLICY disputes_party_select ON public.disputes
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.offers      o ON o.id = a.offer_id
      WHERE a.id = disputes.assignment_id
        AND (o.buyer_id = auth.uid() OR o.creator_id = auth.uid())
    )
  );


-- ledger_events: party to the thread (resolved via actor_ref →
-- actor_handles.auth_user_id = auth.uid()) or platform admin may
-- SELECT. NO INSERT / UPDATE / DELETE from any non-service role
-- (§8.3 append-only invariant). Writes go through SECURITY
-- DEFINER transition functions (concern 3 onward) that own the
-- hash-chain invariant via trigger T5.
CREATE POLICY ledger_events_party_select ON public.ledger_events
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.actor_handles ah
      WHERE ah.handle = ledger_events.actor_ref
        AND ah.auth_user_id = auth.uid()
    )
  );


-- actor_handles: user may SELECT only the row where auth_user_id
-- = auth.uid(); platform admin may SELECT all (§8.4).
CREATE POLICY actor_handles_self_select ON public.actor_handles
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR auth_user_id = auth.uid());


-- ── Hash-chain round-trip verification (acceptance #7) ────────
-- Inserts two events on the same thread, asserts:
--   (a) event 2's prev_event_hash equals event 1's event_hash
--       (chain linkage preserved by T5);
--   (b) recomputing event_hash off-trigger using the §8.3 formula
--       reproduces the stored value byte-for-byte (formula
--       parity between trigger and off-trigger recompute).
-- Uses a disposable actor_handle whose cleanup happens after the
-- two events are deleted (ON DELETE RESTRICT on ledger_events.
-- actor_ref forces this order).
DO $verify$
DECLARE
  test_actor            uuid;
  test_thread           uuid;
  stored_hash_1         text;
  stored_hash_2         text;
  stored_prev_2         text;
  stored_payload_1      jsonb;
  stored_payload_2      jsonb;
  stored_event_type_1   text;
  stored_event_type_2   text;
  stored_payload_v_1    text;
  stored_payload_v_2    text;
  stored_created_at_1   timestamptz;
  stored_created_at_2   timestamptz;
  recomputed_hash_1     text;
  recomputed_hash_2     text;
BEGIN
  -- Disposable actor for the round-trip. Not the M5 system actor —
  -- keeps the M5 seed surface clean.
  INSERT INTO public.actor_handles (auth_user_id, tombstoned_at)
    VALUES (NULL, NULL)
    RETURNING handle INTO test_actor;

  test_thread := gen_random_uuid();

  -- Event 1 — first on thread, prev_event_hash NULL.
  INSERT INTO public.ledger_events (
    thread_type, thread_id, event_type, payload,
    actor_ref, prev_event_hash, event_hash
  ) VALUES (
    'offer', test_thread, 'offer.created',
    '{"v":1,"_test":"hash-chain-rt-1"}'::jsonb,
    test_actor, NULL, ''  -- event_hash overwritten by T5
  )
  RETURNING event_hash, payload, event_type, payload_version, created_at
    INTO stored_hash_1, stored_payload_1, stored_event_type_1,
         stored_payload_v_1, stored_created_at_1;

  -- Event 2 — second on same thread, prev_event_hash = event 1's hash.
  INSERT INTO public.ledger_events (
    thread_type, thread_id, event_type, payload,
    actor_ref, prev_event_hash, event_hash
  ) VALUES (
    'offer', test_thread, 'offer.countered',
    '{"v":1,"_test":"hash-chain-rt-2"}'::jsonb,
    test_actor, stored_hash_1, ''
  )
  RETURNING event_hash, prev_event_hash, payload, event_type,
            payload_version, created_at
    INTO stored_hash_2, stored_prev_2, stored_payload_2,
         stored_event_type_2, stored_payload_v_2, stored_created_at_2;

  -- (a) Chain linkage.
  IF stored_prev_2 IS DISTINCT FROM stored_hash_1 THEN
    RAISE EXCEPTION
      'hash-chain round-trip: event 2 prev_event_hash=% does not match event 1 event_hash=%',
      stored_prev_2, stored_hash_1;
  END IF;

  -- (b) Off-trigger recompute of event 1 matches stored.
  recomputed_hash_1 := encode(
    extensions.digest(
      COALESCE(''::text, '')         || '|' ||  -- prev_event_hash was NULL → COALESCE to ''
      stored_payload_v_1             || '|' ||
      stored_event_type_1            || '|' ||
      stored_payload_1::text         || '|' ||
      to_char(stored_created_at_1 AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
      test_actor::text,
      'sha256'
    ),
    'hex'
  );
  IF recomputed_hash_1 <> stored_hash_1 THEN
    RAISE EXCEPTION
      'hash-chain round-trip: event 1 recomputed=% ≠ stored=%',
      recomputed_hash_1, stored_hash_1;
  END IF;

  -- (b) Off-trigger recompute of event 2 matches stored.
  recomputed_hash_2 := encode(
    extensions.digest(
      stored_hash_1                  || '|' ||
      stored_payload_v_2             || '|' ||
      stored_event_type_2            || '|' ||
      stored_payload_2::text         || '|' ||
      to_char(stored_created_at_2 AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
      test_actor::text,
      'sha256'
    ),
    'hex'
  );
  IF recomputed_hash_2 <> stored_hash_2 THEN
    RAISE EXCEPTION
      'hash-chain round-trip: event 2 recomputed=% ≠ stored=%',
      recomputed_hash_2, stored_hash_2;
  END IF;

  -- Cleanup: delete events first (ON DELETE RESTRICT on actor_ref),
  -- then the disposable actor_handle.
  DELETE FROM public.ledger_events WHERE thread_id = test_thread;
  DELETE FROM public.actor_handles  WHERE handle   = test_actor;

  RAISE NOTICE 'M4 hash-chain round-trip verified: chain linkage OK, off-trigger recompute matches stored for both events.';
END
$verify$;


COMMIT;
