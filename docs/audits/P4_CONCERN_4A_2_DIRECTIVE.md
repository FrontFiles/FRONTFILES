# P4 Concern 4A.2 — Offer Surface (Part A: Business RPCs + Offer Lib)

**Status.** Drafted 2026-04-21 on top of `feat/p4-economic-cutover` commit `e9a0bc0` (P4 Concern 1 trigger-race + D8 require-actor cleanup). First slice of the `P4_CONCERN_4_DESIGN_LOCK.md` §9.2 offer-surface build. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the Postgres-side business RPC catalogue (5 RPCs + 1 retry helper) for the offer state machine, plus the TS-side `src/lib/offer/*` domain helpers (state, pricing, rights, composer, types) and their unit tests. **No** route handlers, **no** pages, **no** components in this slice — those land in Parts B1/B2 and C1/C2 (separate follow-on directives). Intentional narrowing to keep the exit-report surface verdicatable.

**Relationship to §9.2 full scope.** Design lock §9.2 bundles the full offer surface into one sub-phase (routes + pages + components + AssetRightsModule REWRITE + pack composer). One Claude Code session cannot safely land all of it — the diff is ~30+ files and the exit-report surface becomes un-verdicatable in a single pass. This directive splits 4A.2 into **six dispatchable parts** (sequence: **A → B1 → B2 → C1 → C2 → D**):

- **Part A** (this directive) — business RPCs + `src/lib/offer/*` + unit tests. ~9 files. One session.
- **Part B1** (`P4_CONCERN_4A_2_B1_DIRECTIVE.md`, drafted after Part A exits clean) — the five non-accept offer route handlers (`POST /api/offers`, `POST /api/offers/[id]/counter`, `POST /api/offers/[id]/reject`, `POST /api/offers/[id]/cancel`, `GET /api/offers/[id]`), TS-side error-classification wrapper, route-level integration tests. No Stripe. ~8 files.
- **Part B2** (`P4_CONCERN_4A_2_B2_DIRECTIVE.md`, drafted after Part B1 exits clean) — the accept route (`POST /api/offers/[id]/accept`) and the §8.5 Stripe PaymentIntent straddle wrapper (outer state read → PaymentIntent create → `rpc_accept_offer` → void-on-failure), Stripe-straddle integration tests, idempotency-key contract. Isolated so the Stripe concern has its own exit report. ~5 files.
- **Part C1** (`P4_CONCERN_4A_2_C1_DIRECTIVE.md`, drafted after Part B2 exits clean) — `/vault/offers` + `/vault/offers/[id]` pages and the lib-heavy, copy-light components (`OfferInboxList`, `OfferCard`, `OfferDetailView`, `FeeTransparencyPanel`, `ExpirationSelector`, shared `EventTrailViewer`, `StateBadge`, `ActorLabel`). ~12 files.
- **Part C2** (`P4_CONCERN_4A_2_C2_DIRECTIVE.md`, drafted after Part C1 exits clean AND counsel-final rights-template copy lands) — the composition-heavy and rights-heavy surfaces: `PackComposer`, `OfferCounterEditor`, `OfferPreviewPanel`, `RightsTemplatePicker`, and the `src/components/asset/AssetRightsModule.tsx` `OfferModal` REWRITE. Gated on counsel-finalised template bodies per §D. ~8 files.
- **Part D** (`P4_CONCERN_4A_2_D_DIRECTIVE.md`, drafted after Part C2 exits clean) — offer expiration cron (Supabase Edge Function; `offer.expired` system event per §3.5). Resolves timer placement open question §10.2.

**Cross-references.**
`docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §2.3 (library decomposition), §3.1 (offer route inventory — Part B1/B2 scope), §6.1 (writer contract), §6.1a (atomicity via Postgres RPCs — **this directive implements the catalogue**), §6.1b (concurrent-insert race — closed by M6 upstream), §7 (flag strategy — Parts B1/B2/C1/C2 scope), §9.2 (sub-phase scope); `docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md` §DECISIONS D4 (business RPCs deferred to 4A.2+ — **this directive ships the catalogue**) and D7 (`rights` / `rights_diff` typed `z.unknown()` pending 4A.2 tightening), §EXIT REPORT 10(d) `rights` / `rights_diff` as `unknown` (**this directive tightens `rights` schema for the offer surface**); `docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(a) retry policy for CONCURRENT_CHAIN_ADVANCE and HASH_CHAIN_VIOLATION and 13(b) isolation choice vs UNIQUE-only (**this directive resolves both as D1 and D2**); `docs/specs/ECONOMIC_FLOW_v1.md` §4 (offer state machine), §7 (offer shape + triggers + max-3-pending rate limit at L152), §8.1 (offer payload rows), §8.3 (ledger storage shape), §8.4 (actor handles + system sentinel), §8.5 (transition atomicity — including the Stripe acceptance straddle flow), §11 (pack mechanics), §F9 (pack size), §F15 (rights templates — counsel-reviewed bodies land in Part C2), §F16 (platform-fee rate-lock; distinct from §7's max-3-pending rate limit); `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` L61-66 (`offer_target_type` enum), L68-94 (offers table + CHECK), L96-113 (`offer_assets`, `offer_briefs`), L222-243 (`ledger_events` shape), L427-468 (trigger body — **unchanged**); `supabase/migrations/20260421000005_seed_system_actor.sql` (system actor seed); `supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql` (UNIQUE prev-hash index — load-bearing for Part A's retry helper); `supabase/migrations/20260421000010_rpc_append_ledger_event.sql` (utility RPC — cited for pattern; not modified).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 4A.2 — Offer Surface Part A
       (business RPCs + src/lib/offer/* domain helpers;
       Parts B1/B2 route handlers and Parts C1/C2 UI follow
       as separate directives)

SCOPE
You are building the Postgres-side business RPC catalogue for the
five user-driven offer state transitions (plus one system-side
expiration RPC), and the TS-side `src/lib/offer/*` domain-helper
library that route handlers in Parts B1/B2 will consume. Each business
RPC atomically pairs the `offers`-table state mutation with the
matching `ledger_events` emission per ECONOMIC_FLOW_v1 §8.5, using
an in-function bounded retry loop that catches the two hash-chain
error paths (trigger-raised `23514` and UNIQUE-raised `23505` from
migration 20260421000006) and re-reads the thread tail before
retrying.

Six RPCs total, one shared retry helper:

  (1) rpc_create_offer        — emits offer.created (first event
                                on a fresh thread; prev = NULL)
  (2) rpc_counter_offer       — emits offer.countered (composition
                                diff + fee + rights + note + new
                                expires_at; may mutate offer_assets
                                or offer_briefs rows)
  (3) rpc_accept_offer        — emits offer.accepted AND in the
                                same txn creates the assignments
                                row AND emits assignment.created
                                on the new assignment thread
                                (dual-row emit per §8.5)
  (4) rpc_reject_offer        — emits offer.rejected
  (5) rpc_cancel_offer        — emits offer.cancelled (buyer only;
                                guard enforced in the RPC)
  (6) rpc_expire_offer        — emits offer.expired (system-only;
                                caller must pass the system-actor
                                handle; the cron that invokes this
                                lands in Part D)

Plus:

  _emit_offer_event_with_retry — internal PL/pgSQL helper that
    encapsulates the N=3 bounded retry loop for the ledger_events
    INSERT. Called from each of the 6 RPCs immediately after the
    business-side UPDATE. Centralises the retry surface so the
    same code path runs under both the hash-chain trigger (23514)
    and the UNIQUE index race (23505) error cases.

TS-side library:

  src/lib/offer/types.ts      — OfferRow, OfferAssetRow, OfferBriefRow,
                                OfferTargetType, OfferState,
                                PlatformFeeBps branded-ish type
  src/lib/offer/state.ts      — pure transition guards (canCounter,
                                canAccept, canReject, canCancel):
                                takes an already-loaded OfferRow +
                                the acting actor handle, returns
                                { allowed, reason? }
  src/lib/offer/pricing.ts    — fee decomposition (grossToNet,
                                netToCreator, platformFeeBasisPoints,
                                formatting helpers for UI)
  src/lib/offer/rights.ts     — v1 rights template registry (the
                                three counsel-reviewed templates
                                per §F15 + the 'custom' flag), Zod
                                tightening of the 'rights' field
                                currently at z.unknown() in
                                src/lib/ledger/schemas.ts
  src/lib/offer/composer.ts   — pack composition validators (item
                                count, same-creator pre-check,
                                mixed-media OK) + PayloadBuilder
                                helpers that produce
                                OfferCreatedPayload and
                                OfferCounteredPayload in their
                                spec-canonical §8.1 shape
  src/lib/offer/index.ts      — barrel export
  src/lib/offer/tests/*.test.ts — unit tests per module

Explicit narrowing:
  - ZERO route handlers in this directive. Parts B1/B2
    create src/app/api/offers/** — deferred.
  - ZERO pages or components. Parts C1/C2.
  - ZERO Stripe integration. rpc_accept_offer emits the events
    and creates the assignments row; the TS-side Stripe
    PaymentIntent straddle flow (§8.5 steps 3-6) wraps the RPC
    in Part B2.
  - ZERO changes to src/lib/ledger/*. The writer contract at
    src/lib/ledger/writer.ts stays as-is; business RPCs do their
    own INSERT INTO ledger_events inline and rely on the trigger
    to compute event_hash. (The writer's emitEvent() remains the
    surface for pure-append events like dispute.evidence_submitted
    in 4A.4.)
  - ZERO changes to enforce_ledger_hash_chain() trigger body.
  - ZERO changes to existing migrations.
  - ZERO changes to the retiring src/app/api/special-offer/**
    tree. Retires under 4B.
  - Cron for offer.expired is deferred to the Part D directive;
    rpc_expire_offer exists but has no caller in this commit.

GATE
Do not open, read, or modify any file outside the paths listed in
§DELIVERABLES. You may read any spec, audit, or migration file for
context; do not modify them. Do not touch route handlers, pages,
components, or the 13 retiring route files.

If any precondition below mismatches, STOP and report. Do not
attempt workarounds.

PRECONDITIONS (verify in order; stop at first failure)
 1. On branch feat/p4-economic-cutover. If not, stop.
 2. `git status` is clean (no uncommitted changes, no stray files).
 3. Execution-surface state matches commit e9a0bc0 (P4 Concern 1
    trigger-race + D8 require-actor cleanup). Commits beyond
    e9a0bc0 are permitted ONLY if they touch
    `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md` (docs-only
    authoring of this directive — required by §D dispatch
    readiness). Verify via:
      git diff --name-only e9a0bc0..HEAD
    The output must be empty OR contain only the single path
    `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md`. Any other path
    in the diff → stop and report. The execution surface has
    drifted and the directive must be re-validated. Cite the
    actual output in the exit report §1.
 4. `bun run test` reports 1105 passed | 10 skipped | 0 failed
    (the baseline after e9a0bc0). Any failure or file-load error
    → stop.
 5. `bun run build` completes green. Report the final line.
 6. `bun run typecheck` completes with zero output. If the script
    is missing or fails, stop.
 7. Postgres version preflight via local Supabase:
      SELECT version();
    Must report PostgreSQL 15.0 or higher. The
    _emit_offer_event_with_retry helper's EXCEPTION WHEN
    unique_violation branch depends on the UNIQUE index from
    migration 20260421000006, which itself requires PG15+
    (NULLS NOT DISTINCT).
 8. `supabase/migrations/20260421000006_ledger_events_unique_prev_hash.sql`
    exists and contains the literal string
    `ledger_events_thread_prev_hash_unique`. If not, stop — the
    race-closure constraint is missing and the retry helper's
    23505 branch has nothing to catch.
 9. `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
    L61-66 matches the offer_target_type enum shape:
      CREATE TYPE public.offer_target_type AS ENUM (
        'single_asset', 'asset_pack', 'single_brief', 'brief_pack'
      );
    If the enum body has drifted, stop — composer.ts and the RPCs
    depend on this shape.
10. `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
    contains the `offers` table DDL with columns
      id, buyer_id, creator_id, target_type, gross_fee,
      platform_fee_bps, currency, rights, current_note,
      expires_at, state, cancelled_by, created_at, updated_at
    and a CHECK (buyer_id != creator_id) constraint. If the column
    set has drifted, stop.
11. `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
    contains the `offer_assets` and `offer_briefs` child tables
    with the triggers that enforce "items belong to same creator"
    and "exactly one child table populated per target_type." If
    these triggers are missing, stop — the business RPC bodies
    rely on DDL-side enforcement rather than duplicating in PL.
12. `supabase/migrations/20260421000005_seed_system_actor.sql`
    exists and seeds handle `00000000-0000-0000-0000-000000000001`
    with `auth_user_id = NULL`. If not, stop — rpc_expire_offer
    depends on this row for its actor-auth guard to pass when
    called with the sentinel handle.
13. `src/lib/offer/` directory does NOT exist. If it does, stop —
    any partial prior slice must be reviewed first.
14. `supabase/migrations/20260421000011_rpc_offer_business.sql`
    does NOT exist. If it does, stop — the migration slot is
    occupied.
15. `rg -n "SYSTEM_ACTOR_HANDLE" src/lib/ledger/system-actor.ts`
    matches. The constant must resolve to the seeded handle UUID
    for the rpc_expire_offer test.
16. `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md` exists on disk
    (this file). If not, stop.
17. `ledger_events` table row count. Verify via
    `SELECT count(*) FROM public.ledger_events;`. Report the
    number. A non-empty baseline is not blocking but must be
    cited in the exit report — the tests must not assume an
    empty thread.
18. `assignment_deliverables` table exists in the current
    DDL. Verify via
    `rg -n 'CREATE TABLE public.assignment_deliverables'
       supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
    — must match at L163 of migration `20260421000004`. If the
    table is absent or the match line differs, STOP. This
    precondition exists because `rpc_accept_offer` populates
    `assignment_deliverables` rows atomically with the accept
    transition (see DELIVERABLE rpc_accept_offer step 6 and
    D14 below). Cite the matched line number in the exit
    report.
19. `offers` table row count is 0. If non-zero, stop — the
    business RPC smoke tests create and reference offers by
    fresh UUIDs; a non-empty baseline is not blocking for
    production but must be reconciled before this migration's
    inline DO-block assertions run.

DELIVERABLES (9 files; 1 NEW migration, 8 NEW lib/test files)

  NEW  supabase/migrations/20260421000011_rpc_offer_business.sql
       Six RPCs + one internal retry helper.

       _emit_offer_event_with_retry(p_thread_type, p_thread_id,
         p_event_type, p_payload, p_actor_ref) RETURNS TABLE
         (event_id uuid, event_hash text):
         Loops up to 3 attempts. Each iteration:
           (i)   re-reads SELECT event_hash FROM ledger_events
                 WHERE thread_type=p_thread_type AND thread_id=
                 p_thread_id ORDER BY created_at DESC, id DESC
                 LIMIT 1 into v_prev_hash (NULL on first event).
           (ii)  INSERT INTO ledger_events (thread_type, thread_id,
                 event_type, payload_version, payload, actor_ref,
                 prev_event_hash) VALUES (...).
           (iii) On 23514 (check_violation) whose SQLERRM contains
                 'ledger_events hash-chain violation' OR on 23505
                 (unique_violation) whose SQLERRM contains
                 'ledger_events_thread_prev_hash_unique': increment
                 attempt, pg_sleep(backoff[attempt]), retry.
                 Any other 23514 or 23505 → RAISE (not our race).
           (iv)  Exhausted retries → RAISE EXCEPTION with
                 ERRCODE='P0001' and a message that cites the
                 thread + attempt count. The caller (route handler
                 in Parts B1/B2) surfaces this as a 503 with a retry
                 hint.
         Backoff table: ARRAY[0.01, 0.03, 0.10] seconds. Values
         chosen to let a single contending writer clear within
         ~150ms total. Not configurable.

       rpc_create_offer(p_actor_ref, p_buyer_id, p_creator_id,
         p_target_type, p_gross_fee, p_platform_fee_bps, p_currency,
         p_rights, p_current_note, p_expires_at, p_items jsonb,
         p_payload jsonb) RETURNS TABLE (offer_id uuid,
         event_id uuid, event_hash text):
         - Actor-auth guard (D5 below).
         - Rate-limit guard (D7): if (SELECT count(*) FROM offers
           WHERE buyer_id=p_buyer_id AND creator_id=p_creator_id
           AND state IN ('sent','countered')) >= 3 then RAISE with
           ERRCODE='P0002', message 'rate_limit: max 3 pending
           offers per buyer/creator'. (Per spec §7 L152 — this is
           the application-layer max-3-pending rule, NOT §F16 which
           is the unrelated platform-fee rate-lock.)
         - INSERT INTO offers (...) VALUES (...) RETURNING id INTO
           v_offer_id. State = 'sent'. platform_fee_bps snapshotted
           here per §F16 (platform-fee rate-lock).
         - Populate child table per p_target_type:
             'single_asset' | 'asset_pack' → INSERT INTO
               offer_assets (offer_id, asset_id, position) from
               the JSON array; rely on the DDL trigger that
               enforces same-creator-of-asset.
             'single_brief' | 'brief_pack' → INSERT INTO
               offer_briefs (offer_id, position, spec) from the
               JSON array.
           Max-20 enforced via a CHECK or via a COUNT guard inside
           the RPC (see D8 — whichever is idempotent and matches
           the DDL trigger; prefer DDL-side enforcement).
         - Call _emit_offer_event_with_retry('offer', v_offer_id,
           'offer.created', p_payload, p_actor_ref) INTO v_event_id,
           v_event_hash.
         - RETURN v_offer_id, v_event_id, v_event_hash.

       rpc_counter_offer(p_actor_ref, p_offer_id, p_payload,
         p_new_gross_fee, p_new_note, p_new_expires_at,
         p_added_items jsonb, p_removed_items jsonb,
         p_new_rights jsonb) RETURNS TABLE (event_id uuid,
         event_hash text):
         - Actor-auth guard.
         - SELECT ... FROM offers WHERE id=p_offer_id FOR UPDATE
           (row-lock).
         - Guard: state IN ('sent','countered'); else RAISE
           ERRCODE='P0003' message 'invalid_state: offer is %'
           with actual state.
         - Guard: p_actor_ref resolves to buyer_id OR creator_id of
           the offer; else RAISE ERRCODE='P0004' 'not_party'.
         - Mutate offer_assets / offer_briefs per
           p_added_items / p_removed_items. Same child table as
           the original target_type (composition-type change
           across asset ↔ brief is NOT allowed in v1; RAISE if
           the JSON shape mismatches the stored target_type).
         - UPDATE offers SET state='countered',
           gross_fee=p_new_gross_fee, current_note=p_new_note,
           rights=p_new_rights, expires_at=p_new_expires_at,
           updated_at=now() WHERE id=p_offer_id.
         - Emit via helper.

       rpc_accept_offer(p_actor_ref, p_offer_id, p_payload)
         RETURNS TABLE (assignment_id uuid, offer_event_id uuid,
         offer_event_hash text, assignment_event_id uuid,
         assignment_event_hash text):
         - Actor-auth guard.
         - Row-lock + state guard ('sent' | 'countered' only).
         - Party guard (buyer or creator).
         - UPDATE offers SET state='accepted', updated_at=now().
         - Emit offer.accepted on 'offer' thread via helper.
         - INSERT INTO assignments (offer_id, state='active',
           created_at, updated_at, ...) RETURNING id INTO
           v_assignment_id. Derive expected_piece_count from
           offer_briefs row count (brief-pack) or offer_assets
           row count (asset-pack); copy target_type.
         - Build assignment.created payload per spec §8.2:
           {v:1, offer_id, target_type, expected_piece_count}.
         - Emit assignment.created on 'assignment' thread via
           helper (fresh thread → prev=NULL on first attempt;
           the helper handles it).
         - Populate assignment_deliverables rows for brief-pack
           (one row per offer_briefs row, copying revision_cap
           from offer_briefs.spec.revision_cap).
         - RETURN the four identifiers.
         NOTE: this RPC does NOT touch Stripe. The Part B2 route
         handler wraps this in the §8.5 straddle flow (outer
         state read → Stripe PaymentIntent → this RPC → void on
         RPC failure). The RPC idempotency surface is just the
         state guard: a replay of rpc_accept_offer on an already-
         accepted offer raises P0003.

       rpc_reject_offer(p_actor_ref, p_offer_id, p_payload)
         RETURNS TABLE (event_id uuid, event_hash text):
         - Actor-auth + row-lock + state guard ('sent' |
           'countered').
         - Party guard.
         - UPDATE offers SET state='rejected', updated_at=now().
         - Emit offer.rejected via helper.

       rpc_cancel_offer(p_actor_ref, p_offer_id, p_payload)
         RETURNS TABLE (event_id uuid, event_hash text):
         - Actor-auth + row-lock + state guard.
         - Buyer-only guard: p_actor_ref MUST resolve to
           offers.buyer_id. Creator-initiated cancel is not a v1
           path (§4 spec: "Cancellation via dispute after
           accepted, not offer cancellation").
         - "Last turn was buyer's" guard (spec §4): look at the
           most recent NON-SYSTEM event on the offer thread
           (SELECT ... FROM ledger_events WHERE thread_type='offer'
           AND thread_id=p_offer_id AND actor_ref !=
           '00000000-0000-0000-0000-000000000001'::uuid ORDER BY
           created_at DESC, id DESC LIMIT 1); if its actor_ref
           resolves to the offer's creator, RAISE ERRCODE='P0005'
           'not_last_turn'. Excluding the system sentinel from
           this lookup is load-bearing — see D15. For the first
           event on the thread — offer.created by buyer — this
           guard trivially passes.
         - UPDATE offers SET state='cancelled',
           cancelled_by=<buyer_user_id>, updated_at=now().
         - Emit offer.cancelled via helper.

       rpc_expire_offer(p_actor_ref, p_offer_id, p_payload)
         RETURNS TABLE (event_id uuid, event_hash text):
         - System-actor-only guard: p_actor_ref MUST equal the
           handle of the seeded system row
           (00000000-0000-0000-0000-000000000001). Any other
           actor → RAISE ERRCODE='P0006' 'not_system'.
         - Row-lock + state guard ('sent' | 'countered').
         - Guard: offers.expires_at < now(). Else RAISE
           ERRCODE='P0007' 'not_yet_expired' — protects against
           cron race conditions when a buyer just extended.
         - UPDATE offers SET state='expired', updated_at=now().
         - Emit offer.expired via helper.

       Inline DO-block assertion at the end of the migration file
       (same precedent as 20260421000004 L642-750 and
       20260421000006's assertion): creates a disposable
       actor_handle, creates a minimal buyer + creator user pair
       via the existing seed pattern (or references an existing
       seed row if one is already in scope — cite the source),
       calls rpc_create_offer + rpc_counter_offer + rpc_cancel_offer
       end-to-end, asserts the ledger_events rows land with
       correct prev_event_hash chain, and RAISE NOTICE on success.
       If any step RAISEs, the whole migration txn rolls back.
       The assertion does NOT exercise rpc_accept_offer (no
       assignments row infra in an assertion block) or
       rpc_expire_offer (requires sleep). It covers create →
       counter → cancel, which is the minimum smoke triad that
       proves the retry helper + the happy path.

       CLEANUP (sentinel-scoped — load-bearing for non-empty
       baselines): the assertion DO-block MUST embed a unique
       sentinel value in the `payload.note` field of every row
       it writes (offers, ledger_events, offer_assets or
       offer_briefs if populated). Sentinel format:
       `'P4_4A_2_ASSERTION_SENTINEL_' || gen_random_uuid()::text`,
       captured into a local variable at the top of the
       DO-block. Every INSERT emitted by the assertion threads
       the sentinel into `payload.note` (for events) and into
       `offers.current_note` (for the offer row) so that
       cleanup can identify the assertion's own rows by exact
       sentinel match. Cleanup is reverse-FK-order but
       WHERE-clause-scoped on the sentinel: DELETE FROM
       ledger_events WHERE payload->>'note' LIKE sentinel || '%';
       DELETE FROM offer_assets / offer_briefs WHERE
       offer_id IN (SELECT id FROM offers WHERE
       current_note LIKE sentinel || '%'); DELETE FROM offers
       WHERE current_note LIKE sentinel || '%'; DELETE FROM
       actor_handles WHERE handle = v_disposable_handle;
       DELETE FROM auth.users WHERE id IN
       (v_buyer_id, v_creator_id). The `LIKE sentinel || '%'`
       pattern accommodates buildOfferCreatedPayload's note
       formatting. This matches the pattern established in
       migration `20260421000006_ledger_events_unique_prev_hash.sql`
       (which uses `payload->>'_test' = 'unique-prev-hash-row-1'`
       for its own sentinel scope) and makes cleanup safe under
       any `ledger_events` / `offers` baseline, including
       production-like seeded states. A reverse-FK-order DELETE
       without sentinel scoping is REJECTED up front — if the
       assertion's writes cannot be unambiguously identified by
       sentinel match, the DO-block must RAISE before cleanup
       runs.

  NEW  src/lib/offer/types.ts
       - OfferTargetType = 'single_asset' | 'asset_pack' |
                           'single_brief' | 'brief_pack'
       - OfferState = 'sent' | 'countered' | 'accepted' |
                      'rejected' | 'expired' | 'cancelled'
         (NOT 'draft' — drafts never hit DB per §4.)
       - PlatformFeeBps = number (0-10000 range; runtime
         validated via Zod in composer.ts; branded type optional
         — judgment call, keep it simple unless 4A.3+ needs it)
       - OfferRow type mirroring the DB shape exactly (from §7
         spec).
       - OfferAssetRow, OfferBriefRow, AssignmentDeliverableRow.
       - RightsTemplateId = 'editorial_one_time' |
         'editorial_with_archive_12mo' |
         'commercial_restricted' | 'custom' (§F15).

  NEW  src/lib/offer/state.ts
       Pure transition guards; no DB access. Each function takes
       { offer: OfferRow; actorHandle: string; lastEventActorRef?:
       string } and returns { allowed: boolean; reason?: string }.

         canCounter({ offer, actorHandle })
           allowed if offer.state ∈ {'sent','countered'} AND
           actorHandle ∈ {offer.buyer_handle, offer.creator_handle}.

         canAccept({ offer, actorHandle })
           same state predicate. Party-only.

         canReject({ offer, actorHandle })
           same.

         canCancel({ offer, actorHandle, lastEventActorRef })
           allowed if offer.state ∈ {'sent','countered'} AND
           actorHandle === offer.buyer_handle AND
           (lastEventActorRef is undefined OR
            lastEventActorRef === offer.buyer_handle).
           CONTRACT: `lastEventActorRef` is the actor_ref of
           the most recent NON-SYSTEM event on the offer
           thread (system actor UUID
           '00000000-0000-0000-0000-000000000001' filtered
           out). The Part B1 route handler is responsible for
           applying this filter when loading the value — if
           the literal last event was emitted by the system
           actor, the caller must walk back through the
           ledger until it finds a non-system event (or
           return undefined if none exists). The guard itself
           treats `lastEventActorRef` as already-filtered.
           This mirrors the Postgres-side filter in
           `rpc_cancel_offer` (see D15).

         canExpire({ offer, now })
           allowed if offer.state ∈ {'sent','countered'} AND
           offer.expires_at < now. Callers pass `now` for
           testability; default to Date.now() inside route
           handlers.

       NOTE: the state-machine-level rules duplicate the Postgres
       guards. That's intentional: TS-side preflight gives a
       clean 409/422 before we burn a round-trip; the RPC is the
       authoritative boundary.

       Do NOT load offers, actor_handles, or ledger_events from
       these functions. Pure over already-loaded rows.

  NEW  src/lib/offer/pricing.ts
       - netToCreator(grossFee, platformFeeBps): number
         grossFee * (10000 - platformFeeBps) / 10000. Round to
         2 decimal places using round-half-even (banker's
         rounding) to avoid systemic asymmetric rounding in
         favour of buyer or creator over time.
       - platformFeeAmount(grossFee, platformFeeBps): number
         grossFee - netToCreator(...). Derived, not independently
         computed, to keep the two values sum-exactly equal to
         grossFee.
       - formatCurrency(amount, currency): string
         Intl.NumberFormat with currency display. Currency string
         validated against ISO 4217 subset (minimal — just the
         three-letter length check; full ISO validation is
         deferred).
       - feeBreakdown(grossFee, platformFeeBps, currency):
         { gross, platformFee, netToCreator, currency,
           displayGross, displayPlatformFee, displayNetToCreator }
         Centralised shape for the FeeTransparencyPanel that Part
         C renders.

  NEW  src/lib/offer/rights.ts
       - RIGHTS_TEMPLATES registry keyed by RightsTemplateId.
         Each entry has EXACTLY three fields: { id:
         RightsTemplateId; label: string; is_transfer:
         boolean }. Per §F15, v1 ships exactly three counsel-
         reviewed template identifiers plus 'custom'. Do NOT
         ship `default_params`, `terms`, `clauses`, or any
         other legal-bearing copy in this directive's registry
         — the counsel-final template BODIES (clause copy,
         default params, jurisdictional carve-outs) land in
         Part C2, gated on counsel sign-off per §D. Part A
         ships only the identifier + label + transfer-flag,
         which is all the Part B1/B2 routes and Part C1 pages
         need to validate and render.
       - RightsSchema: Zod schema tightening the spec §8.1 and
         §8.2 payloads' `rights` / `rights_diff` field (currently
         z.unknown() in src/lib/ledger/schemas.ts). Shape:
         { template: RightsTemplateId; params: z.record(
           z.string(), z.unknown()); is_transfer: boolean }.
         `params` stays open-valued in Part A because the
         counsel-final shape is unlocked here; Part C2 tightens
         `params` once the template bodies ship.
         Closes `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT
         10(d) for the offer payloads. Assignment- and dispute-
         side `rights_diff` tightening stays deferred to 4A.3 /
         4A.4.
       - validateRights(rights: unknown): ParseResult<Rights>
         Wraps RightsSchema.safeParse; template='custom' entries
         are admitted but flagged (per §F7 "flagged for admin
         review"). The flag is a boolean on the return type, not
         a DB side-effect here — admin review lives downstream.

       IMPORTANT: do NOT modify src/lib/ledger/schemas.ts in
       this directive. Part B1/B2 (route handlers) will import
       RightsSchema from src/lib/offer/rights.ts and compose it
       into a stricter OfferCreatedPayload validator at the route
       boundary. Centralising the lax `z.unknown()` tightening
       there — not here in the schemas.ts surface — keeps the
       ledger/schemas.ts file bound tightly to §8 spec shapes
       and lets the offer surface own its domain tightening.

  NEW  src/lib/offer/composer.ts
       - validatePackComposition({ targetType, items }):
         + targetType ∈ the four enum values.
         + items length ∈ [1, 20] per §F9.
         + items are string UUIDs (for asset packs) or brief
           specs { title, deadline_offset_days, deliverable_format,
           revision_cap, notes } (for brief packs).
         Returns Ok<PackComposition> | Err<{ code, message }>.
       - buildOfferCreatedPayload({ targetType, items, grossFee,
         platformFeeBps, currency, rights, expiresAt, note }):
         Returns an OfferCreatedPayload (typed via the ledger
         EventPayload<'offer.created'>) conformant to §8.1.
       - buildOfferCounteredPayload({ byActorId, before: OfferRow,
         after: { grossFee, items, rights, note, expiresAt } }):
         Computes the added_items / removed_items diff and
         returns an OfferCounteredPayload per §8.1. This is the
         TS-side spec §8.5 composition-diff computer.

       No fetch, no DB access. Pure.

  NEW  src/lib/offer/index.ts
       Barrel: re-export types, state, pricing, rights, composer.

  NEW  src/lib/offer/tests/state.test.ts
       One `describe` per guard (canCounter, canAccept, canReject,
       canCancel, canExpire). Table-driven. Must cover:
       - happy-path allowed for each party where allowed
       - rejection by state (e.g., canCounter on 'accepted')
       - rejection by party (non-party attempts)
       - canCancel rejection when last event actor is creator
       - canCancel rejection when actor is creator
       - canCancel ALLOWED when lastEventActorRef is the
         buyer-handle even though a more recent system event
         occurred on the thread (D15 contract — caller is
         responsible for system-actor filtering; the guard
         treats the filtered value as authoritative). Include
         a comment citing D15 so future readers understand
         the caller contract.
       - canExpire rejection when expires_at > now

  NEW  src/lib/offer/tests/pricing.test.ts
       - netToCreator exactness (grossFee * (1 - bps/10000))
       - platformFeeAmount + netToCreator === grossFee
       - banker's rounding behaviour at half-cent edges
       - feeBreakdown displayCurrency handling for EUR, USD, GBP

  NEW  src/lib/offer/tests/rights.test.ts
       - RightsSchema accepts each of the four template ids
       - Rejects unknown template
       - 'custom' is admitted but flagged
       - RIGHTS_TEMPLATES registry keys === RightsTemplateId
         values (exhaustive invariant)

  NEW  src/lib/offer/tests/composer.test.ts
       - validatePackComposition: length bounds (0 fails, 1 OK,
         20 OK, 21 fails)
       - targetType-shape mismatch (e.g., asset-pack with brief
         specs)
       - buildOfferCreatedPayload produces a payload that passes
         OfferCreatedPayloadSchema (import from
         src/lib/ledger/schemas.ts; round-trip validate)
       - buildOfferCounteredPayload diff: added + removed items
         are computed correctly from before/after arrays

IMPLEMENTATION STEPS (in order)

Step 1 — Write the migration
Read supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
L61-243 for the relevant DDL shapes, L427-468 for the trigger
body, and L642-750 for the inline assertion precedent. Read
supabase/migrations/20260421000006 for the retry error-code
surface and the DO-block pattern. Read
supabase/migrations/20260421000010_rpc_append_ledger_event.sql
for the existing RPC's return-shape pattern.

Create supabase/migrations/20260421000011_rpc_offer_business.sql:

  A. Header comment. Must cite:
     - Design lock §9.2 (this directive's phase)
     - Design lock §6.1a (atomicity via Postgres RPCs — the
       contract this file implements)
     - Spec §8.5 (transition atomicity, incl. §8.5 accept +
       assignment.created dual-emit)
     - Spec §8.1, §8.2 (payload rows for offer.* and
       assignment.created)
     - Migration 20260421000006 (UNIQUE prev-hash index — the
       23505 error surface the retry helper catches)
     - Migration 20260421000004 L427-468 (the trigger — 23514
       surface)
     - P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT
       13(a) retry policy + 13(b) isolation — explicitly state
       those are resolved in this migration's helper (see D1
       and D2 below)

  B. BEGIN; ... COMMIT; wrapper per precedent.

  C. Create the _emit_offer_event_with_retry helper. PL/pgSQL.
     STABLE? No — it mutates ledger_events. SECURITY DEFINER,
     SET search_path = public, pg_temp (defensive against
     search-path injection per Postgres SECURITY DEFINER
     guidance). LANGUAGE plpgsql.

     Inside: DECLARE loop variables, LOOP, inner
     BEGIN/EXCEPTION/END sub-txn, catch SQLSTATE '23514' and
     '23505' with SQLERRM substring match for the specific
     trigger RAISE and index name respectively. EXIT on
     success. RAISE after max retries.

  D. Create each of the six RPCs. PL/pgSQL. SECURITY DEFINER.
     SET search_path = public, pg_temp.

     Each RPC opens with the actor-auth guard (D5):
       IF (SELECT auth_user_id FROM actor_handles
           WHERE handle = p_actor_ref
             AND tombstoned_at IS NULL)
          IS DISTINCT FROM auth.uid()
       THEN RAISE EXCEPTION 'actor_mismatch'
              USING ERRCODE = 'P0008';
       END IF;
     EXCEPT rpc_expire_offer, which instead guards:
       IF p_actor_ref != '00000000-0000-0000-0000-000000000001'::uuid
       THEN RAISE EXCEPTION 'not_system'
              USING ERRCODE = 'P0006';
       END IF;

  E. GRANT EXECUTE ON FUNCTION ... TO authenticated; for each of
     the six user-driven RPCs. rpc_expire_offer grants to the
     `service_role` role only (cron invokes via service-role
     Supabase client; see Part D directive).

  F. Inline DO-block assertion (create → counter → cancel
     smoke triad). Mirror migration 20260421000006's assertion
     shape: sentinel-scoped cleanup (see DELIVERABLES
     §CLEANUP block above), disposable actor, disposable
     users if needed (auth.users rows; use gen_random_uuid()
     and the minimal shape), RAISE NOTICE on success, RAISE
     EXCEPTION with clear message on any step-level failure.
     Cleanup: reverse FK order SCOPED BY SENTINEL match on
     payload.note / current_note — NOT a blanket reverse-FK
     DELETE. Sentinel format
     `'P4_4A_2_ASSERTION_SENTINEL_' || gen_random_uuid()::text`
     captured into `v_sentinel` at the top of the DO-block and
     threaded into every INSERT the assertion performs.

     If the assertion needs auth.users rows and creating them
     from within a migration is infrastructurally awkward on
     the local Supabase dev path, fall back to: use an
     existing seeded dev-user pair (confirm via
     `SELECT id FROM auth.users LIMIT 2` during preflight)
     and cite the fallback in the exit report.

  G. COMMIT.

Step 2 — Write src/lib/offer/types.ts
Single file, typed only. No runtime. Import OfferTargetType
from src/lib/ledger/schemas.ts' TargetTypeSchema z.infer type
to stay in lockstep — DO NOT redeclare the union.

Step 3 — Write src/lib/offer/pricing.ts
Pure functions only. Use Number.EPSILON-aware comparisons where
rounding matters. Use Intl.NumberFormat for display.

Step 4 — Write src/lib/offer/rights.ts
RIGHTS_TEMPLATES as a const object. RightsSchema as a Zod
object. validateRights wrapper.

Step 5 — Write src/lib/offer/state.ts
Pure guards per the shape in §DELIVERABLES. Export a
TransitionGuardResult = { allowed: true } | { allowed: false;
reason: string }.

Step 6 — Write src/lib/offer/composer.ts
validatePackComposition + buildOfferCreatedPayload +
buildOfferCounteredPayload per the shape in §DELIVERABLES.

Step 7 — Write src/lib/offer/index.ts
Barrel exports.

Step 8 — Write the four test files
Use existing test runner conventions from
src/lib/ledger/tests/*.test.ts. Use the namespace import
`import * as z from 'zod'` per 4A.1 D-decision on Zod import
shape.

Step 9 — Run the full verification suite
- `bun run typecheck` → zero output
- `bun run build` → Compiled successfully
- `bun run test` → baseline 1105 + N new tests; report delta
- `rg -n 'certif|immutab|tamper.proof' supabase/migrations/20260421000011_rpc_offer_business.sql src/lib/offer/` → zero matches
- Local Supabase migration apply + `\d+ public` sanity check:
  each of the six RPC signatures visible.

Step 10 — Single concern-scoped commit.

DECISIONS RESOLVED (do not re-litigate during execution)

D1 Retry policy is in-Postgres (_emit_offer_event_with_retry),
   not TS-side. N=3 bounded, backoff ARRAY[0.01, 0.03, 0.10]
   seconds via pg_sleep. Closes
   P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT 13(a).
   TS-side route handlers (Parts B1/B2) do NOT retry; they
   receive the final classified result (success or P0001
   exhausted retries) and propagate. Rationale: in-RPC retry
   keeps the row-lock held across attempts (no lock-drop-and-
   reacquire race), and the retry surface for all six RPCs is a
   single helper — centralised observability, one code path.

   Row-lock scope lock-in (R1): the row-lock acquired by
   SELECT ... FOR UPDATE inside each business RPC is held
   ONLY for the duration of that RPC's execution —
   worst-case ~150ms (3 × 0.10s backoff ceiling, plus trivial
   work). In Part B2, the §8.5 Stripe straddle flow explicitly
   does NOT hold this row-lock across the Stripe PaymentIntent
   RTT. The sequence is: (outer) state read without FOR UPDATE
   → Stripe PaymentIntent create (~500ms-2s, NO DB row-lock
   held) → `rpc_accept_offer` invoked only AFTER PaymentIntent
   succeeds (row-lock acquired then released within the RPC,
   <150ms) → Stripe void-on-failure (idempotency-keyed). The
   Part B2 directive must state this lock-scope constraint
   explicitly; a naïve "row-lock straddling the PaymentIntent"
   implementation is REJECTED up front.

D2 Isolation is read-committed (Postgres default). NOT
   SERIALIZABLE. Closes
   P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT 13(b).
   Rationale: UNIQUE (thread_type, thread_id, prev_event_hash)
   NULLS NOT DISTINCT from migration 20260421000006 is the
   correctness backstop; SERIALIZABLE adds read-set-conflict
   abort cost at scale with zero additional correctness over
   UNIQUE + retry. Reconsider post-P5 only if observed race
   rate materially exceeds the modelled single-digit-percent
   baseline.

D3 One RPC per business operation. Six RPCs (create, counter,
   accept, reject, cancel, expire). Not one polymorphic RPC,
   not a shared "rpc_offer_state_transition" switch. Per-
   operation RPCs are cleaner for PostgREST RLS, for
   observability (each RPC appears as a distinct trace span),
   and for the GRANT surface (expire is service_role only;
   the others are authenticated).

D4 SECURITY DEFINER + search_path pinned. Each RPC runs with
   elevated privileges but enforces its own actor-auth guard
   via auth.uid() === actor_handles.auth_user_id. search_path
   pinned to `public, pg_temp` per Postgres SECURITY DEFINER
   guidance (prevents search-path-based privilege escalation).

D5 Actor-auth guard shape:
     IF (SELECT auth_user_id FROM actor_handles
         WHERE handle = p_actor_ref AND tombstoned_at IS NULL)
        IS DISTINCT FROM auth.uid()
     THEN RAISE 'actor_mismatch' ERRCODE 'P0008';
     END IF;
   Uses IS DISTINCT FROM so NULL auth_user_id (tombstoned OR
   system actor) never matches a real auth.uid(). The
   rpc_expire_offer guard is a literal equality check against
   the system actor handle UUID — the auth.uid() path does
   not apply there because cron invokes via service_role.

D6 Stripe is OUT of scope for Part A. rpc_accept_offer emits
   events and creates the assignment row but does not call
   Stripe. The TS-side §8.5 straddle flow (outer state read →
   PaymentIntent create → rpc_accept_offer → void-on-failure)
   is Part B2's work. Rationale: Stripe wiring adds ~200 LoC of
   TS and moves the exit-report surface out of "pure SQL +
   pure TS lib" territory. Keeping Part A dispatchable in one
   session.

D7 Rate limit (max 3 pending per buyer-creator per spec §7
   L152) enforced in rpc_create_offer via an in-RPC COUNT
   guard. Duplicates no existing DDL constraint; §7's max-3-
   pending is an application-layer rule, not a DB invariant.
   Race-safe because the COUNT runs inside the same txn as
   the INSERT and the rate-limit ceiling is asymmetric (a
   concurrent fourth insert will succeed at this guard;
   subsequent reads will see 4 pending — acceptable v1
   approximation; tightening to a session-level advisory
   lock deferred unless observed abuse). Do NOT conflate with
   §F16 — that's the platform-fee rate-LOCK (snapshotted on
   `offer.created` and locked for the life of the offer), a
   separate concern handled at the INSERT itself.

D8 Max-20-items constraint enforcement. Prefer the DDL trigger
   from migration 20260421000004 over duplicating in PL. If the
   DDL trigger does not exist (precondition 11 catches this),
   stop and report.

D9 `rights` payload tightening lives in src/lib/offer/rights.ts,
   not in src/lib/ledger/schemas.ts. The ledger schemas stay
   bound to §8 spec shapes (z.unknown() for `rights` and
   `rights_diff`); the offer-domain tightening is composed in
   at the route boundary in Parts B1/B2. Rationale: ledger schemas
   are the "spec surface"; rights templates are the "domain
   policy." Separating them keeps the ledger surface portable
   across future payload-shape changes.

D10 Canonicalisation (P4_CONCERN_4A_1_DIRECTIVE.md §EXIT
    REPORT 10(b), carried forward as
    P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT
    13(c)) remains open. Not this directive's scope. The
    trigger computes event_hash from a jsonb::text cast today;
    any canonicalisation formalisation (sorted keys, explicit
    whitespace) is a separate migration.

D11 Migration slot is 20260421000011. Groups with the RPC
    block (000010 = rpc_append_ledger_event; 000011 = business
    RPC catalogue; 000012+ reserved for Parts B1/B2/C1/C2/D additions).

D12 `rpc_expire_offer` is callable in Part A but has no caller
    yet. The cron lives in Part D. Rationale: having the RPC
    defined now lets Part C1 render an offer-list page that
    shows 'expired' offers correctly even before the cron
    wires up, because any pre-seeded 'expired' rows will
    exist in the DB from test fixtures.

D13 No new MCP / SDK / util dependencies. PL/pgSQL only in the
    migration; TypeScript + Zod only in the lib. Same surface
    as 4A.1 and the trigger-race follow-up.

D14 `rpc_accept_offer` populates `assignment_deliverables`
    rows atomically at accept time (for brief-pack offers,
    one row per offer_briefs row, copying revision_cap from
    offer_briefs.spec.revision_cap). The `assignment_deliverables`
    table itself is owned by 4A.3 per design lock §9.3, and
    its mutation RPCs (rpc_submit_deliverable, rpc_accept_
    deliverable, rpc_request_revision) land in 4A.3. Part A
    owns ONLY the atomic populate step at accept — no other
    writes, no reads outside the accept txn. This cross-phase
    coupling is intentional and acknowledged: pushing the
    populate to 4A.3 would either (a) leave an
    assignment without deliverable rows between accept and the
    first 4A.3-era UPDATE, breaking the "assignment.created
    event implies deliverable scaffold exists" invariant, or
    (b) force a second event on the fresh assignment thread in
    4A.3 just to populate rows, complicating the thread's head
    state. Keeping the populate inside `rpc_accept_offer` is
    the correct atomicity boundary. Precondition 18 asserts
    the table exists in the current DDL (migration
    `20260421000004` L163); if the assertion fails, STOP and
    re-validate this directive before dispatch.

D15 `rpc_cancel_offer` "last turn was buyer's" guard filters
    system-actor events out of the lookup (see DELIVERABLE
    rpc_cancel_offer step 3). Rationale: spec §F10 allows the
    system actor to emit events mid-thread (e.g., future
    force-termination paths, admin interventions) without
    advancing the state machine beyond what a party action
    would. Without the filter, a buyer who saw a system event
    after their own last turn would fail the "last turn was
    mine" check and be trapped in the offer — unable to
    cancel through no fault of their own. Filtering
    `actor_ref != '00000000-0000-0000-0000-000000000001'`
    restores the intended semantics: "the last PARTY action
    on this offer was the buyer's." The TS-side pure guard
    `canCancel` in `src/lib/offer/state.ts` receives
    `lastEventActorRef` from the caller, and the caller (Part
    B1 route handler) MUST apply the same system-actor filter
    when loading it — this is specified in the state.ts
    contract below. A unit test case in
    `src/lib/offer/tests/state.test.ts` covers the scenario
    where the literal last event is system but the last non-
    system event was buyer's (guard allows cancel).

BANNED TERMS
  rg -n 'certif|immutab|tamper.proof' \
     supabase/migrations/20260421000011_rpc_offer_business.sql \
     src/lib/offer/
  Must return zero matches. Provenance-aware / verifiable /
  independently-reviewable are acceptable substitutes per
  project CLAUDE.md and P4_CONCERN_1_DIRECTIVE.md.

ACCEPTANCE CRITERIA (all must hold)
 1. supabase/migrations/20260421000011_rpc_offer_business.sql
    exists with the exact filename.
 2. The migration defines _emit_offer_event_with_retry plus
    the six RPCs rpc_create_offer, rpc_counter_offer,
    rpc_accept_offer, rpc_reject_offer, rpc_cancel_offer,
    rpc_expire_offer. Each RPC body runs in SECURITY DEFINER
    with search_path pinned.
 3. Migration applies cleanly in a fresh local Supabase
    `supabase db reset`-equivalent run. The inline DO-block
    assertion completes and emits its RAISE NOTICE.
 4. After apply, all six RPC signatures are visible via
    `SELECT proname, pronargs FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'rpc_%_offer';`
    (or an equivalent `\df public.rpc_*_offer` introspection).
 5. `src/lib/offer/{types,state,pricing,rights,composer,index}.ts`
    all exist, all typecheck. No unused exports.
 6. `src/lib/offer/tests/{state,pricing,rights,composer}.test.ts`
    all exist. All new tests pass.
 7. OfferTargetType in src/lib/offer/types.ts is derived from
    (or identical to) TargetTypeSchema in
    src/lib/ledger/schemas.ts. Zero drift between the two
    surfaces.
 8. `bun run test` → 1105 baseline + N new tests passed.
    Zero failures, zero file-load errors. Report the actual
    new-test count.
 9. `bun run build` green.
10. `bun run typecheck` clean.
11. `rg -n 'certif|immutab|tamper.proof'
       supabase/migrations/20260421000011_rpc_offer_business.sql
       src/lib/offer/` returns zero matches.
12. `rg -n 'from .@/lib/ledger/writer.'
       src/lib/offer/` returns zero matches — the offer lib
    MUST NOT import the writer in Part A (the business RPCs do
    their own INSERTs; the writer stays reserved for pure-
    append events in 4A.4).
13. `rg -n 'use server\|isAuthWired\|requireActor'
       src/lib/offer/` returns zero matches — no route-handler
    plumbing in the lib. Parts B1/B2 are where auth guards live.
14. Zero changes to any file outside §DELIVERABLES. Verify
    with `git diff --stat` in the exit report.
15. Exactly 9 files created per §DELIVERABLES (1 migration +
    8 lib/test files).
16. Single commit, no squash, no amend, on
    feat/p4-economic-cutover.
17. D1 (in-RPC retry) and D2 (read-committed + UNIQUE-only)
    from P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT
    13(a) and 13(b) are explicitly addressed by the migration
    header comment AND by the helper body itself.
18. Precondition 18 (`assignment_deliverables` table
    existence) passes. Exit report §1 lists PASS with the
    matched L163 line number from migration
    `20260421000004`.

COMMIT
Single concern-scoped commit. Template:

  feat(offer): P4 concern 4A.2 Part A — business RPC catalogue + offer lib

  Ships the Postgres-side business RPC catalogue for the offer
  state machine (5 user-driven + 1 system RPC), a shared
  in-function retry helper that closes the hash-chain race at
  the RPC boundary, and the `src/lib/offer/*` domain helpers
  consumed by the Parts B1/B2 route handlers.

  * supabase/migrations/20260421000011 —
    _emit_offer_event_with_retry: N=3 bounded retry on 23514
    (hash-chain trigger) and 23505 (UNIQUE prev-hash index);
    pg_sleep backoff [10ms, 30ms, 100ms]; centralises the race
    surface for all six business RPCs.
    rpc_create_offer: inserts offer + child table rows, rate-
    limit guard (max 3 pending per buyer-creator, spec §7 L152;
    platform_fee_bps snapshot per §F16), emits offer.created.
    rpc_counter_offer: row-lock + state guard + party guard;
    mutates composition; emits offer.countered with diff.
    rpc_accept_offer: row-lock + state guard + party guard;
    emits offer.accepted AND creates assignments row AND
    populates assignment_deliverables rows for brief-packs
    (atomic cross-phase populate per D14) AND emits
    assignment.created on the new assignment thread (dual-
    thread emit per §8.5; Stripe straddle lands in Part B2).
    rpc_reject_offer / rpc_cancel_offer / rpc_expire_offer:
    round out the state machine.
    Inline DO-block asserts the create → counter → cancel
    triad end-to-end.

  * src/lib/offer/types.ts, state.ts, pricing.ts, rights.ts,
    composer.ts, index.ts — pure-TS domain helpers. state.ts
    mirrors the Postgres guards (preflight; the RPC is the
    authoritative boundary). rights.ts ships the §F15 template
    identifier + label + transfer-flag registry (counsel-final
    template bodies land in Part C2) and tightens the
    z.unknown() `rights` field in the ledger payload schemas
    (closes P4_CONCERN_4A_1_DIRECTIVE.md §EXIT REPORT 10(d)
    for the offer surface). composer.ts owns the pack-
    composition validators and the offer.created /
    offer.countered payload builders.

  * Unit tests at src/lib/offer/tests/* — table-driven per
    module.

  Decisions D1 (in-RPC retry, N=3, pg_sleep backoff) and D2
  (read-committed + UNIQUE-only) close
  P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md §EXIT REPORT 13(a)
  and 13(b). D9 (rights tightening in offer lib) closes
  P4_CONCERN_4A_1_DIRECTIVE.md §EXIT REPORT 10(d) for the
  offer surface; assignment- and dispute-side `rights_diff`
  tightening stays deferred to 4A.3 / 4A.4.

  Directive: docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md
  Builds on: e9a0bc0
  Unblocks: 4A.2 Part B1 (non-accept route handlers)

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1-5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:

 1. Preconditions check — each of #1-19 with PASS/FAIL + a line
    explaining why. Cite the actual HEAD SHA, Postgres version,
    baseline test count, and ledger_events / offers / auth.users
    row counts (from preconditions 17 and 19 and any lookup
    needed for the inline assertion). Precondition 18 is the
    `assignment_deliverables` table-existence check at
    `20260421000004` L163.
 2. File list — every file created with line counts. Must be
    exactly 9 files.
 3. Migration body — paste the helper signature + the six RPC
    signatures (not full bodies; signatures + key guards only).
    Cite the RAISE NOTICE emitted by the inline assertion.
 4. _emit_offer_event_with_retry body — paste the full function
    body. Confirm SQLSTATE/SQLERRM matchers are scoped (both
    code AND substring) — not plain code-only.
 5. Per-RPC guard summary — for each RPC, list the guards
    executed in order (actor-auth, row-lock, state, party,
    domain-specific). One line per RPC.
 6. TS lib summary — for each of the six lib files, cite the
    exports and the test-coverage delta.
 7. Decisions log — confirm D1-D15 from §A were honoured as
    written OR cite where you deviated and why. (D14 covers the
    atomic `assignment_deliverables` populate at `rpc_accept_offer`
    per S1 resolution; D15 covers the system-actor filter on
    `rpc_cancel_offer`'s last-turn guard per S2 resolution — both
    land in this draft-2 pass and require explicit exit-time
    confirmation.)
 8. Banned-term lint — full output of the rg command.
 9. Acceptance checklist — each of criteria 1-18 with PASS/FAIL.
10. Test-run output — tail of `bun run test`. Cite the delta
    from the 1105 baseline (report the new-test count; any
    non-skip regression → FAIL).
11. Typecheck output — tail of `bun run typecheck`.
12. Build output — tail of `bun run build`.
13. Migration-apply output — tail showing the RAISE NOTICE
    from the inline assertion and no ROLLBACK.
14. Commit SHA.
15. Open items — anything warranting founder review before
    Part B1. Must include AT LEAST:
    (a) Whether `rights` template bodies in
        RIGHTS_TEMPLATES are counsel-reviewed-final or
        placeholder. If placeholder, flag that counsel review
        is required before P5.
    (b) Whether the inline assertion used a fallback
        (existing seeded dev-user pair) per §DELIVERABLES
        note F — cite which pair and the justification.
    (c) Whether any Postgres error code beyond P0001-P0008
        was introduced; if so, list them.
    (d) The 4A.1 `rights_diff` tightening for assignment and
        dispute payloads remains open for 4A.3 / 4A.4.
16. Suggested next directive — "proceed to P4_CONCERN_4A_2_B1"
    (non-accept offer route handlers + TS-side error-classification
    wrapper; the §8.5 Stripe-straddle accept route is Part B2's
    scope) or "pause for founder review of X" if you spotted
    anything material.
```

---

## B — Scope confirmation

Part A is the **first of six directives** (A → B1 → B2 → C1 → C2 → D) that together land design lock §9.2's offer surface. The full §9.2 scope (routes + Stripe straddle + pages + composition-heavy components + AssetRightsModule REWRITE + pack composer + expiration cron) cannot land in one Claude Code session without compromising the exit-report surface. Splitting into six dispatchable parts preserves the verdict-gate cadence established by concerns 1 through 4A.1 and isolates the counsel-copy dependency to Part C2.

**Part A (this directive) covers:**
- Postgres business RPC catalogue: `rpc_create_offer`, `rpc_counter_offer`, `rpc_accept_offer`, `rpc_reject_offer`, `rpc_cancel_offer`, `rpc_expire_offer`.
- Shared `_emit_offer_event_with_retry` helper that closes the hash-chain race at the RPC boundary (resolving `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(a)).
- `src/lib/offer/*` TS domain helpers: types, state guards, pricing, rights template registry, composer, barrel.
- Unit tests per lib module.
- Inline migration assertion covering the create → counter → cancel smoke triad.

**Part A does NOT cover:**
- The five non-accept offer route handlers (`POST /api/offers`, `POST /api/offers/[id]/counter`, `POST /api/offers/[id]/reject`, `POST /api/offers/[id]/cancel`, `GET /api/offers/[id]`). Part B1.
- The accept route handler (`POST /api/offers/[id]/accept`) and its §8.5 Stripe PaymentIntent straddle wrapper. Part B2.
- `/vault/offers` + `/vault/offers/[id]` pages and the lib-heavy, copy-light components (`OfferInboxList`, `OfferCard`, `OfferDetailView`, `FeeTransparencyPanel`, `ExpirationSelector`, shared `EventTrailViewer`, `StateBadge`, `ActorLabel`). Part C1.
- The composition- and rights-heavy components (`PackComposer`, `OfferCounterEditor`, `OfferPreviewPanel`, `RightsTemplatePicker`) plus the `src/components/asset/AssetRightsModule.tsx` `OfferModal` REWRITE. Part C2 — gated on counsel-finalised template bodies per §D.
- Offer expiration cron (Supabase Edge Function). Part D follow-on.
- Route-level acceptance test suite for the non-accept offer routes. Part B1 owns these since they exercise those route handlers.
- Stripe-straddle integration tests for the accept route. Part B2.
- `rights_diff` tightening for assignment and dispute payloads. 4A.3 and 4A.4.

**Part A closes these upstream open items:**
- `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT **13(a)** — retry policy for `CONCURRENT_CHAIN_ADVANCE` and `HASH_CHAIN_VIOLATION`: resolved as in-RPC bounded retry, N=3, pg_sleep backoff (D1).
- `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT **13(b)** — isolation choice (SERIALIZABLE vs UNIQUE-only): resolved as read-committed + UNIQUE-only (D2).
- `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT **10(d)** for the offer surface only — `rights` field tightening in `src/lib/offer/rights.ts` (D9). Assignment- and dispute-side `rights_diff` tightening remain deferred.

**Part A does NOT close:**
- `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT **10(b)** canonicalisation (carried forward in `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(c); D10) — remains long-term, not blocking.
- `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT **10(d)** for assignment `rights_diff` and dispute `evidence_refs` — deferred to 4A.3 / 4A.4.

---

## C — Red-team pass

Four traps I considered and ruled on before writing the directive. Calling them out explicitly so there's no retro-fit later.

**1. "Why not use the existing `emitEvent()` writer instead of duplicating the INSERT inside each RPC?"**

The writer at `src/lib/ledger/writer.ts` is a TS-side surface. It calls `rpc_append_ledger_event` (the utility RPC from migration 20260421000010), which is a pure-append path with no paired business UPDATE. The business RPCs here — `rpc_create_offer`, `rpc_accept_offer`, etc. — combine a business-table mutation (`UPDATE offers SET state = ...` or `INSERT INTO assignments`) with the ledger INSERT inside one PL/pgSQL txn. Calling `rpc_append_ledger_event` from inside another RPC would work but adds a layer for no gain: we still need the retry loop around the ledger INSERT, and the helper already encapsulates that. The writer stays reserved for 4A.4's `dispute.evidence_submitted` (pure ledger append with no paired business UPDATE) per the design lock's intent.

**2. "Why in-RPC retry instead of TS-side retry at the route handler?"**

Considered both. TS-side retry at the route handler has one advantage: it releases and re-acquires the row-lock cleanly between attempts, which matches the spirit of read-committed semantics. But it adds a round-trip cost per retry, requires the TS wrapper to know the ledger error codes, and fans out the retry surface across six route handlers (duplication). In-RPC retry keeps the row-lock held across attempts, centralises the retry shape in one PL helper, and lets route handlers stay dumb. The row-lock held across `pg_sleep(0.01)` + `pg_sleep(0.03)` + `pg_sleep(0.10)` ≈ 140ms worst case; under the v1 expected contention (single-digit concurrent writes per offer thread per hour), this is fine. Reconsider post-P5 only if observed p99 RPC latency under contention exceeds 200ms.

**3. "Why split `rpc_accept_offer` from the Stripe PaymentIntent flow?"**

The spec §8.5 accept flow straddles TS and Postgres:
1. TS: row-lock + state read (outer)
2. TS: Stripe PaymentIntent create (network round-trip, ~500ms-2s)
3. TS: call `rpc_accept_offer` (inner atomic block)
4. TS: on RPC failure, Stripe void via API (idempotency key = `offer.id + ':accept'`)

Keeping Stripe out of Part A means the RPC is purely atomic — one txn, one state transition, one event emission — and the Stripe concern lives entirely in the TS wrapper. This mirrors how `rpc_append_ledger_event` stays pure-DB in 4A.1 while the TS-side `emitEvent()` owns the Zod validation concern. Clean boundary. The Part B2 directive will spell out the Stripe wrapper in detail.

**4. "Why tighten `rights` in `src/lib/offer/rights.ts` instead of in `src/lib/ledger/schemas.ts`?"**

The ledger schemas surface binds to spec §8 exactly — payload shapes per event type. The spec intentionally left `rights` as an opaque jsonb field (§8.1: "`rights`: jsonb") because the rights template registry is a domain concern that lives above the ledger. Tightening `rights` in the ledger schemas would couple the ledger surface to the offer surface's domain model and make future payload versioning harder (e.g., if `rights` shape changes in v=2, the ledger schema bump drags in the offer domain's schema bump). Keeping them separate: ledger stays `z.unknown()` for `rights`, offer domain owns the validator, route handlers compose them at the boundary via `RightsSchema.and(OfferCreatedPayloadSchema)`-style pattern in Parts B1/B2.

---

## D — Dispatch readiness

Checklist before paste:

- [ ] Founder reviewed §A directive body and verdicted D1 (in-RPC retry) and D2 (read-committed + UNIQUE-only). Both resolve `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(a) and 13(b).
- [ ] Founder reviewed the six-part split (A → B1 → B2 → C1 → C2 → D) per §Relationship to §9.2 full scope, and approves the sequence. Each part is dispatched only after the prior part's exit report clears verdict.
- [ ] Founder verdicted D6 (Stripe deferred to Part B2), D12 (`rpc_expire_offer` exists but cron lands in Part D), and D14 (`assignment_deliverables` populate is owned by Part A's `rpc_accept_offer`; 4A.3 owns mutation RPCs on the table).
- [ ] Founder verdicted D15 (rpc_cancel_offer last-turn guard filters system-actor events; state.ts `lastEventActorRef` contract requires caller-side system-actor filtering) and confirms the new state.test.ts case covering a buyer cancel after a system event.
- [ ] Founder verdicted R1 (row-lock NOT held across Stripe PaymentIntent RTT — see D1 lock-in clause). Part B2 directive will re-state this constraint.
- [ ] Founder approves the rights template registry shape for Part A: **identifiers + label + transfer-flag only**. No `default_params`, no clause copy, no legal-bearing body — Part A ships empty-shaped params (`z.record(z.string(), z.unknown())`). **Part C2 dispatch is GATED on counsel-finalised template bodies landing first.** Counsel sign-off on the three v1 template bodies (`editorial_one_time`, `editorial_with_archive_12mo`, `commercial_restricted`) is a prerequisite for drafting the Part C2 directive.
- [ ] Counsel-finalisation tracker: Part C2 directive MUST NOT be drafted until counsel has delivered the three final template bodies (clauses + default params + jurisdictional notes). Founder confirms this gate is owned outside this directive and is tracked separately.
- [ ] Commit `e9a0bc0` pushed to origin `feat/p4-economic-cutover` (confirmed earlier in session).
- [ ] This directive committed to `docs/audits/` on the same branch.
- [ ] Fresh Claude Code session, working directory is the repo root, no other work in progress.

When all boxes clear, paste §A verbatim into Claude Code. Wait for the exit report. Do not accept an implicit "all looks good" — demand the terminal-paste-ready report per §EXIT REPORT.

---

## E — Revision history

- **2026-04-21 — Draft 1.** Drafted. First slice of design lock §9.2 (offer surface). Covers Postgres business RPC catalogue + `src/lib/offer/*` domain helpers + unit tests. Builds on `e9a0bc0`. Uses migration slot `20260421000011`. Closes `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(a) retry policy (via in-RPC retry D1) and 13(b) isolation choice (via read-committed + UNIQUE-only D2), plus `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT 10(d) `rights` tightening for the offer surface (via D9). Parts B1/B2/C1/C2/D follow as separate directives after each exit report clears.
- **2026-04-21 — Draft 2 (verdict revisions).** Founder-commissioned verdict returned Draft 1 for revision with 3 blockers, 2 material risks, 3 secondary fixes. All applied:
    - **Blocker 1 (fabricated citations).** Rebound D1/D2 citations to `P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` §EXIT REPORT 13(a) and 13(b). Rebound D9 citation to `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT 10(d). Rebound D10 canonicalisation citation to `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT 10(b) / carried forward to §EXIT REPORT 13(c). Stripped the hallucinated D4 "lazy import for Supabase client" description — 4A.1's D4 is "business RPCs deferred to 4A.2+." All "4A.1 exit-report" body references rewritten with correct filename + section citations.
    - **Blocker 2 (§F16 → §7).** Corrected the max-3-pending rate-limit citation to spec §7 L152 (application-layer rule) in rpc_create_offer, D7, and the COMMIT template. Retained §F16 only where it belongs: the platform-fee rate-LOCK on `offer.created`. Added explicit disambiguation note on D7 to prevent future conflation.
    - **Blocker 3 (rights templates).** Stripped `default_params` and all clause-body fields from the Part A `RIGHTS_TEMPLATES` registry. Part A now ships only `{id, label, is_transfer}` per entry. `RightsSchema.params` is `z.record(z.string(), z.unknown())` in Part A; tightens in Part C2 once counsel-final template bodies ship. Added a §D dispatch checkbox gating Part C2 on counsel finalisation.
    - **R1 (PaymentIntent row-lock scope).** Added a lock-in clause to D1 stating the row-lock held inside each RPC is <150ms and is NOT held across the Stripe PaymentIntent RTT in Part B2. Part B2 directive will re-state this; the naïve straddle is REJECTED up front.
    - **R2 (part split).** Rewrote §Relationship to §9.2 full scope for a six-part sequence: A → B1 → B2 → C1 → C2 → D. Part B split into B1 (non-accept routes) + B2 (accept route + Stripe straddle). Part C split into C1 (lib-heavy pages + low-copy components) + C2 (composition-heavy + rights-heavy + AssetRightsModule rewrite, gated on counsel copy).
    - **S1 (cross-phase coupling).** Added precondition 18 verifying `assignment_deliverables` exists at migration `20260421000004` L163. Added D14 acknowledging Part A's atomic populate of the table at `rpc_accept_offer`; 4A.3 owns mutation RPCs. Renumbered prior precondition 18 (offers row count) to 19; updated acceptance criterion 17 and exit-report precondition check accordingly.
    - **S2 (cancel guard).** Changed `rpc_cancel_offer` last-turn guard to filter `actor_ref != system sentinel` when reading the most-recent-non-system event. Added D15 explaining the rationale. Tightened state.ts `canCancel` contract to require caller-side system-actor filtering on `lastEventActorRef`. Added new state.test.ts case covering the scenario where a system event is the literal last event but the buyer is the last party actor (cancel ALLOWED).
    - **S3 (DO-block cleanup).** Rewrote the inline DO-block assertion cleanup from "reverse FK order" to sentinel-scoped deletion. Sentinel format `'P4_4A_2_ASSERTION_SENTINEL_' || gen_random_uuid()::text` threaded into `payload.note` and `offers.current_note`; cleanup filters exclusively on sentinel match. Matches the pattern in migration `20260421000006`. Blanket reverse-FK DELETE is REJECTED up front.
- **2026-04-21 — Draft 3 (precondition 3 self-consistency fix).** Dispatched Part A to Claude Code; execution halted at precondition 3 because the original wording ("HEAD is commit e9a0bc0. If HEAD is not e9a0bc0 — or there is any commit beyond e9a0bc0 — stop and report.") is self-inconsistent with §D's requirement that this directive be committed to `docs/audits/` on the same branch before dispatch. Committing the directive itself unavoidably advances HEAD past `e9a0bc0`. Rewrote precondition 3 to allow commits beyond `e9a0bc0` iff they touch ONLY `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md`, verified via `git diff --name-only e9a0bc0..HEAD`. Any path other than the directive file in the diff still fails the precondition. Exit report §1 must cite the actual output of the diff command. No change to execution scope — drift guard still blocks any code-path commit on top of `e9a0bc0`.
