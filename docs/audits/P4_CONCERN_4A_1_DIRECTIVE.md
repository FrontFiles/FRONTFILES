# P4 Concern 4A.1 — Claude Code Directive

**Status.** Drafted 2026-04-21 under `P4_IMPLEMENTATION_PLAN.md` §13.3 template, scoped per `P4_CONCERN_4_DESIGN_LOCK.md` §9.1. **Not yet dispatched.** Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Concern 4A.1 — the event-writer library + `FFF_ECONOMIC_V1_UI` flag scaffolding. One concern, one exit report. Concern 4A.2 (offer surface) is the first consumer.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` §8 (event catalogue incl. §8.1 offer / §8.2 assignment / §8.2a dispute payload tables), §8.3 (storage shape + hash-chain preimage), §8.4 (actor_handles + system sentinel), §8.5 (atomicity), §8.6 (payload versioning), §9 (terminology discipline); `docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §2.3 (library path lock), §6.1 (writer contract — hash math is Postgres-side), §6.1a (atomicity via RPC; deferred), §6.1b (concern-1 trigger race flag), §7 (flag strategy), §9.1 (this sub-phase's scope); `docs/audits/P4_CONCERN_3_DIRECTIVE.md` (template shape + `isAuthWired()` precedent); `docs/audits/P4_CONCERN_1_DIRECTIVE.md` §M5 (system-actor seed — this directive ships its TS-side constant, closing the M5 deferral chain); `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` L427-466 (`enforce_ledger_hash_chain()` trigger — the piece of code that owns hash computation); `supabase/migrations/20260421000005_seed_system_actor.sql` (seeds sentinel UUID `00000000-0000-0000-0000-000000000001`).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 4A.1 — Event-writer library + FFF_ECONOMIC_V1_UI scaffolding

SCOPE
You are implementing sub-phase 4A.1 of the P4 economic cutover for
Frontfiles per docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §9.1. Goal:
ship the spec-canonical ledger-event writer primitive (types, Zod
payload schemas, system-actor constant, writer helper) plus the
server-only page-gating flag `FFF_ECONOMIC_V1_UI` that 4A.2/4A.3/4A.4
will consume.

Explicit narrowing:
  - ZERO route handlers. 4A.2/4A.3/4A.4 own those.
  - ZERO replacement pages. Same.
  - ZERO business-state RPCs (e.g. rpc_create_offer, rpc_accept_offer).
    Those are 4A.2+ deliverables. This concern ships ONE utility RPC
    only: `rpc_append_ledger_event` — pure ledger append used by
    4A.4's `dispute.evidence_submitted` (no paired business UPDATE)
    and as a test bench for the writer.
  - ZERO changes to `enforce_ledger_hash_chain()`. The concurrent-
    insert race flagged in Design Lock §6.1b lands as a dedicated
    concern-1 follow-up migration BEFORE 4A.2's first write-path
    route. Not scope here.
  - ZERO TS-side sha256 computation. Per Design Lock §6.1 and spec
    §8.3, the trigger owns hash math + prev_event_hash validation.
    TS-side `emitEvent()` does Zod validation + INSERT ... RETURNING
    event_hash. The trigger returns the computed hash via the RETURNING
    clause.

GATE
Do not open, read, or modify any file outside the paths listed in
§DELIVERABLES below. You may read any spec or audit doc for context;
do not modify specs or audits (including the design lock). Do not
touch the 13 retiring route files (src/app/api/special-offer/**/* and
src/app/api/assignment/**/*) — those retire under 4B, not here. Do
not touch `enforce_ledger_hash_chain()` or any existing migration.

If any precondition below mismatches, STOP and report. Do not attempt
workarounds.

PRECONDITIONS (verify in order; stop at first failure)
1. On branch feat/p4-economic-cutover. If not, stop.
2. `git status` shows clean tree except possibly the untracked design
   lock at docs/audits/P4_CONCERN_4_DESIGN_LOCK.md. Any other
   uncommitted change → stop.
3. HEAD is at or descended from commit e994439 (vitest.config.ts
   NODE_ENV cast fix on top of concern 3 at 2e99b65). Cite the actual
   HEAD SHA in your exit report.
4. `bun run test` reports `1083 passed | 10 skipped | 0 failed` (or
   identical invariant: ZERO failures, ZERO file-load errors, counts
   may shift by ±5 if the tree has advanced but the zero-failure
   invariant must hold). Report actual counts.
5. `bun run build` completes green. Report the final "Compiled
   successfully" line.
6. docs/audits/P4_CONCERN_4_DESIGN_LOCK.md exists on disk (may be
   untracked pending founder commit; this directive was drafted
   against it). If missing → stop.
7. docs/specs/ECONOMIC_FLOW_v1.md §8.1, §8.2, §8.2a each contain
   payload tables for every event listed in §EVENT INVENTORY below.
   If any row is missing or malformed → stop and list the gap.
8. supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
   contains the `enforce_ledger_hash_chain()` trigger defined as
   BEFORE INSERT ON public.ledger_events. Confirm; your RPC body
   relies on that trigger existing.
9. supabase/migrations/20260421000005_seed_system_actor.sql inserts
   handle `00000000-0000-0000-0000-000000000001` into
   public.actor_handles. Confirm; this is the byte sequence your
   SYSTEM_ACTOR_HANDLE constant MUST match.
10. src/lib/env.ts contains `FFF_AUTH_WIRED` in envSchema at
    approximately L70-75 and in the `flags` object at L280-282.
    Your `FFF_ECONOMIC_V1_UI` rows go alongside, matching idiom.
11. src/lib/flags.ts contains `isAuthWired()` at L81-83. Your
    `isEconomicV1UiEnabled()` goes directly below, matching docblock
    + body shape.
12. vitest.config.ts contains `forwardedEnv.FFF_AUTH_WIRED = 'true'`
    at approximately L78. Your `FFF_ECONOMIC_V1_UI = 'true'` line
    goes alongside.
13. No directory `src/lib/ledger/` or `src/lib/economic-flow/` exists.
    Both paths must be clean — this concern creates `src/lib/ledger/`.
    If either exists → stop and report.

EVENT INVENTORY (the 20 event types; payload rows in spec §8)

OFFER (6, spec §8.1)
  - offer.created       { v, target_type, items, gross_fee, platform_fee_bps, currency, rights, expires_at, note }
  - offer.countered     { v, by_actor_id, fee_before, fee_after, added_items, removed_items, rights_diff, note_before, note_after, expires_at }
  - offer.accepted      { v, by_actor_id }
  - offer.rejected      { v, by_actor_id?, reason, affected_item_ids? }
  - offer.expired       { v, last_active_actor_id }
  - offer.cancelled     { v, by_actor_id }

ASSIGNMENT (9, spec §8.2)
  - assignment.created             { v, offer_id, target_type, expected_piece_count }
  - assignment.piece_delivered     { v, piece_ref, submitted_at }
  - assignment.delivered           { v, at }
  - assignment.revision_requested  { v, piece_ref, note, rounds_used, rounds_remaining }
  - assignment.accepted_by_buyer   { v, by_actor_id, auto: bool }
  - assignment.cashed_out          { v, amount, net_to_creator, payment_ref }
  - assignment.disputed            { v, by_actor_id, reason, evidence_refs }
  - assignment.refunded            { v, amount_to_buyer, rationale }
  - assignment.split               { v, amount_to_creator, amount_to_buyer, rationale }

DISPUTE (5, spec §8.2a)
  - dispute.opened                 { v, by_actor_id, assignment_id, reason, evidence_refs }
  - dispute.evidence_submitted     { v, submitter_actor_handle, evidence_ref, evidence_type: 'asset_file'|'text_statement'|'external_link'|'other', submitted_at }
  - dispute.resolved               { v, by_actor_id, outcome: 'accepted_by_buyer'|'refunded'|'split', amount_to_buyer?, amount_to_creator?, rationale }
  - dispute.appealed               { v, by_actor_id, grounds }
  - dispute.appeal_resolved        { v, by_actor_id, outcome: 'accepted_by_buyer'|'refunded'|'split', rationale }

If you read spec §8.1/§8.2/§8.2a and the payload shape above for any
row disagrees with the spec row, the SPEC wins — flag the discrepancy
in your exit report §Open items and derive the Zod schema from the
spec row. Do NOT silently follow the directive row.

DELIVERABLES (10 files; 5 NEW lib files, 3 NEW tests, 3 EDITs, 1 NEW migration)
Produce in this order:
  1. NEW   src/lib/ledger/types.ts
  2. NEW   src/lib/ledger/schemas.ts
  3. NEW   src/lib/ledger/system-actor.ts
  4. NEW   src/lib/ledger/writer.ts
  5. NEW   src/lib/ledger/__tests__/schemas.test.ts
  6. NEW   src/lib/ledger/__tests__/system-actor.test.ts
  7. NEW   src/lib/ledger/__tests__/writer.test.ts
  8. EDIT  src/lib/env.ts
  9. EDIT  src/lib/flags.ts
 10. EDIT  vitest.config.ts
 11. NEW   supabase/migrations/<next-timestamp>_rpc_append_ledger_event.sql

Per-file requirements:

(1) src/lib/ledger/types.ts
  - Header docblock citing: design lock §2.3 + §6.1 + §9.1; spec §8,
    §8.1, §8.2, §8.2a, §8.3, §8.6.
  - Export:
      export type ThreadType = 'offer' | 'assignment' | 'dispute'

      export type EventType =
        | 'offer.created' | 'offer.countered' | 'offer.accepted'
        | 'offer.rejected' | 'offer.expired' | 'offer.cancelled'
        | 'assignment.created' | 'assignment.piece_delivered'
        | 'assignment.delivered' | 'assignment.revision_requested'
        | 'assignment.accepted_by_buyer' | 'assignment.cashed_out'
        | 'assignment.disputed' | 'assignment.refunded' | 'assignment.split'
        | 'dispute.opened' | 'dispute.evidence_submitted'
        | 'dispute.resolved' | 'dispute.appealed' | 'dispute.appeal_resolved'
  - Export `EventPayload<T extends EventType>` as a conditional-type
    map from each EventType literal to its TS payload shape. Shapes
    come from the §EVENT INVENTORY table above, verified against spec
    §8.1/§8.2/§8.2a. Use `number` for amounts/fees/bps/rounds; `string`
    for UUIDs, refs, ISO timestamps, notes, reasons, outcomes; `readonly
    string[]` for `items`, `added_items`, `removed_items`,
    `affected_item_ids`, `evidence_refs`; `unknown` (NOT `any`) for
    `rights`, `rights_diff` pending later tightening in 4A.2 —
    document the `unknown` choice in a block comment.
  - The `v` field is `1` as a literal type on every payload: `v: 1`.
    This is the spec §8.6 pre-consumer-exception convention — start
    at v=1 across all events. Do NOT widen to `number`.
  - Enumerated string unions for outcome values (e.g.
    `'accepted_by_buyer' | 'refunded' | 'split'`) and for
    evidence_type, matching the spec rows.
  - NO runtime exports. This file is types only. Zod schemas live in
    schemas.ts (file 2).
  - NO re-export of `Actor` or `RequireActorResult` — those live in
    src/lib/auth/require-actor.ts (concern 3) and callers import
    from there directly.

(2) src/lib/ledger/schemas.ts
  - Header docblock citing same as (1).
  - Use the namespace import `import * as z from 'zod'` — see
    src/lib/env.ts L36 for the rationale block on why `import { z }`
    is unsafe under Vitest 4 / rolldown.
  - Export one Zod schema per event type. Naming convention:
      export const OfferCreatedPayloadSchema = z.object({ ... })
      export const AssignmentCreatedPayloadSchema = z.object({ ... })
      ...
    Total: 20 named exports.
  - Export a single aggregated dispatch object:
      export const EventPayloadSchemas = {
        'offer.created': OfferCreatedPayloadSchema,
        'offer.countered': OfferCounteredPayloadSchema,
        ...
      } as const satisfies Record<EventType, z.ZodTypeAny>
  - Every schema:
      - starts with `v: z.literal(1)`
      - uses `.strict()` so unknown keys fail validation (catch drift
        early; the pre-consumer exception §8.6 makes this safe)
      - uses z.string().uuid() for `by_actor_id`, `last_active_actor_id`,
        `submitter_actor_handle`, `offer_id`, `assignment_id`, `piece_ref`
      - uses z.string().datetime() for `at`, `submitted_at`, `expires_at`
      - uses z.number().int().nonnegative() for `rounds_used`,
        `rounds_remaining`, `platform_fee_bps`, `expected_piece_count`
      - uses z.number() for monetary fields (`gross_fee`, `fee_before`,
        `fee_after`, `amount`, `net_to_creator`, `amount_to_buyer`,
        `amount_to_creator`); integer-vs-float tightening deferred to
        when the money type lands — do NOT invent Money types here
      - uses z.boolean() for `auto`
      - uses z.string() for free-text `note`, `reason`, `rationale`,
        `grounds`, `payment_ref`, `currency`
      - uses z.unknown() for `rights` and `rights_diff` (see (1) note)
      - uses z.enum([...]) for `evidence_type` and `outcome`
      - marks `by_actor_id?`, `reason?`, `affected_item_ids?`,
        `amount_to_buyer?`, `amount_to_creator?` as `.optional()`
        where the spec row has a `?` suffix
  - Runtime assertion inside this module (immediately after
    EventPayloadSchemas is declared) that verifies the dispatch map
    covers all 20 EventType literals. Sketch:
      // Compile-time + runtime belt-and-braces: the `satisfies` check
      // above is compile-time; this is the runtime counterpart so a
      // missing key surfaces at module load, not at first emission.
      const _allEventTypes: ReadonlyArray<EventType> = [
        'offer.created','offer.countered','offer.accepted',
        'offer.rejected','offer.expired','offer.cancelled',
        'assignment.created','assignment.piece_delivered',
        'assignment.delivered','assignment.revision_requested',
        'assignment.accepted_by_buyer','assignment.cashed_out',
        'assignment.disputed','assignment.refunded','assignment.split',
        'dispute.opened','dispute.evidence_submitted',
        'dispute.resolved','dispute.appealed','dispute.appeal_resolved',
      ]
      for (const t of _allEventTypes) {
        if (!(t in EventPayloadSchemas)) {
          throw new Error(`EventPayloadSchemas missing key: ${t}`)
        }
      }

(3) src/lib/ledger/system-actor.ts
  - Header docblock citing: spec §8.4 ("System actor" — never exposed
    to clients; locked for the life of the platform); concern-1 seed
    migration at supabase/migrations/20260421000005_seed_system_actor.sql;
    concern-1 directive §M5 (deferred the TS-side constant to "concern
    3"; that deferral was never taken up; this file closes it);
    design lock §2.3 (flat `src/lib/ledger/` chosen over the
    originally-named `src/lib/economic-flow/system-actor.ts` — see
    D1 below).
  - Single runtime export:
      export const SYSTEM_ACTOR_HANDLE =
        '00000000-0000-0000-0000-000000000001' as const
  - Comment block immediately above the constant: "Locked for the life
    of the platform per spec §8.4. Matches the UUID seeded by
    supabase/migrations/20260421000005_seed_system_actor.sql. MUST NOT
    be exposed in any client bundle — this module is server-only. The
    §8.4 'never exposed to clients' invariant is preserved structurally
    in requireActor() (see src/lib/auth/require-actor.ts) because the
    seeded row has auth_user_id = NULL and cannot match any real
    auth.uid() lookup."
  - NO `'use server'` directive. This file is a single const export;
    it is imported by server-only callers (ledger/writer.ts + future
    cron handlers + dispute admin paths in 4A.4). The module graph
    will enforce server-only-ness because callers are server-only.
    Avoid 'use server' because that marks every export as a Server
    Function and a plain string constant should not be a Server
    Function.

(4) src/lib/ledger/writer.ts
  - Header docblock citing: design lock §6.1 (writer contract — hash
    math is Postgres-side); design lock §6.1a (atomicity is caller's
    responsibility via RPC); spec §8.3 (storage shape + hash preimage);
    spec §8.5 (atomicity); spec §8.6 (payload versioning).
  - 'use server' directive at file top.
  - Imports:
      import * as z from 'zod'
      import type { SupabaseClient } from '@supabase/supabase-js'
      import type { EventType, EventPayload, ThreadType } from './types'
      import { EventPayloadSchemas } from './schemas'
  - Export the arg + result types exactly as locked in design lock §6.1:
      export type EmitEventArgs<T extends EventType> = {
        db: SupabaseClient
        threadType: ThreadType
        threadId: string       // uuid
        eventType: T
        payload: EventPayload<T>
        actorRef: string       // uuid — actor_handles.handle
        prevEventHash: string | null
      }

      export type EmitEventResult =
        | { ok: true; eventHash: string; eventId: string }
        | { ok: false; reason: 'PAYLOAD_VALIDATION_FAILED' | 'HASH_CHAIN_VIOLATION' | 'INSERT_FAILED'; detail: string }
  - NOTE the `prevEventHash` field above — it is an arg, not a
    side-load. Per design lock §6.1 the caller loads the prior hash
    (inside its atomic RPC, where it holds the row lock) and passes
    it in. The writer does NOT query for the prior hash; if it did,
    it would race against its own caller's RPC body.
  - Export:
      export async function emitEvent<T extends EventType>(
        args: EmitEventArgs<T>,
      ): Promise<EmitEventResult>
  - Behaviour, in order:
      a. Look up the Zod schema via EventPayloadSchemas[args.eventType].
         If absent (should be unreachable given the compile-time
         `satisfies` check in schemas.ts, but belt-and-braces for runtime),
         return { ok: false, reason: 'PAYLOAD_VALIDATION_FAILED',
                   detail: `No schema for event type: ${args.eventType}` }.
      b. Run `schema.safeParse(args.payload)`. If !success, return
         { ok: false, reason: 'PAYLOAD_VALIDATION_FAILED',
                   detail: <flattened Zod issues as a single string> }.
      c. Call the Supabase RPC `rpc_append_ledger_event` (file 11 below)
         with the validated payload, thread_type, thread_id, event_type,
         actor_ref, prev_event_hash. Reason for using the RPC rather
         than a direct `supabase.from('ledger_events').insert(...)`:
         the RPC returns the trigger-computed `event_hash` via a
         RETURNING-equivalent path, and centralises the canonical insert
         shape so 4A.2+'s business RPCs can call the same internal
         SQL helper if they want (rather than re-inlining the insert
         columns; this keeps the column list in one place).
      d. On Supabase error: distinguish the trigger's
         HASH_CHAIN_VIOLATION RAISE (the trigger at migration L427-466
         raises with a specific error text; match on it) from generic
         insert failures. If it matches trigger text, return
         { ok: false, reason: 'HASH_CHAIN_VIOLATION', detail: error.message }.
         Otherwise return { ok: false, reason: 'INSERT_FAILED', detail: error.message }.
         (Your exit report must cite the exact RAISE message the
         trigger uses so this matcher is grounded in the real text.)
      e. On success: the RPC returns a single row `{ id, event_hash }`.
         Return { ok: true, eventHash: row.event_hash, eventId: row.id }.
  - The writer MUST NOT log payload contents at any level, per §8
    payload-discipline note and §12 PII concerns. A `console.debug`
    or logger.info carrying only event_type + thread_type + thread_id +
    eventId is acceptable. Payload itself stays in the DB.
  - Canonicalisation is NOT a writer concern — the trigger computes
    sha256 over the canonicalised payload jsonb. TS-side passes the
    payload as-is; Postgres stores jsonb which is lexicographically
    ordered on write in practice (note: spec §8.3 does NOT pin
    canonicalisation formally; flag this as a known open risk in
    exit report §Open items — out-of-scope to fix here).

(5) src/lib/ledger/__tests__/schemas.test.ts
  - Use `import { describe, it, expect } from 'vitest'`.
  - Cases (minimum):
      1. EventPayloadSchemas has all 20 keys (iterate EventType
         literals and expect(EventPayloadSchemas).toHaveProperty(t)).
      2. A valid offer.created payload parses cleanly.
      3. An offer.created payload with `v: 2` fails parse (literal
         enforcement).
      4. An offer.created payload with an extra unknown key fails
         parse (`.strict()` enforcement).
      5. A dispute.resolved payload with outcome='split' and both
         amount_to_buyer + amount_to_creator parses.
      6. A dispute.resolved payload with outcome='nonsense' fails
         parse (z.enum enforcement).
      7. An assignment.accepted_by_buyer payload with auto=false
         parses; with auto='false' (string) fails.
      8. An offer.rejected payload omitting by_actor_id parses (the
         ? makes it optional).
  - No DB access. Pure Zod + fixture tests.

(6) src/lib/ledger/__tests__/system-actor.test.ts
  - Single case: SYSTEM_ACTOR_HANDLE === '00000000-0000-0000-0000-000000000001'.
  - Second case: constant passes a uuid v4-or-any-variant regex (belt:
    `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
  - Third case: constant is `readonly` at the type level — use
    `expectTypeOf(SYSTEM_ACTOR_HANDLE).toEqualTypeOf<'00000000-0000-0000-0000-000000000001'>()`
    or equivalent. If expectTypeOf isn't configured, a value-equality
    assertion is enough.
  - No DB access.

(7) src/lib/ledger/__tests__/writer.test.ts
  - Mock-only; do NOT hit a live Supabase instance. Integration-mode
    writer tests with a real DB are deferred to 4A.2 (where the first
    real INSERT paths land as part of business RPCs).
  - Stub the Supabase client. Pattern: build a minimal object with an
    `rpc()` method that returns a resolved promise shaped like
    `{ data: [{ id, event_hash }], error: null }` or
    `{ data: null, error: { message: <str> } }`.
  - Cases (minimum six):
      1. Valid offer.created payload → `{ ok: true, eventHash, eventId }`.
      2. Payload with `v: 2` → `{ ok: false, reason: 'PAYLOAD_VALIDATION_FAILED' }`.
      3. Unknown event_type at runtime (cast through `as any`) →
         `{ ok: false, reason: 'PAYLOAD_VALIDATION_FAILED' }`.
      4. Supabase returns error message matching the trigger's
         hash-chain RAISE text → `{ ok: false, reason: 'HASH_CHAIN_VIOLATION' }`.
      5. Supabase returns any other error → `{ ok: false, reason: 'INSERT_FAILED' }`.
      6. The `payload` contents field is never passed to console.*
         or logger.* at log-level higher than debug. Assert by
         spying on console.info/console.log and checking neither
         received the payload's free-text field contents. (This
         tests the PII discipline; if your logger module is
         different, adapt — the invariant is "payload text does
         not appear in logs above debug level").

(8) src/lib/env.ts — EDIT
  - Add to envSchema server-only section (alongside FFF_AUTH_WIRED at
    ~L70-75):
      FFF_ECONOMIC_V1_UI: z
        .enum(['true', 'false'])
        .default('false')
        .describe('Gates the spec-canonical replacement pages (offer / assignment / dispute surfaces). Server-only; checked in page.tsx server components via isEconomicV1UiEnabled(). Default false in deploy 1; flipped true at 4B alongside FFF_AUTH_WIRED.'),
  - Add to `rawEnv` server-only section:
      FFF_ECONOMIC_V1_UI: process.env.FFF_ECONOMIC_V1_UI,
  - Add a getter to `flags`, matching the surrounding idiom:
      get economicV1Ui(): boolean {
        return process.env.FFF_ECONOMIC_V1_UI === 'true'
      },
  - Do NOT add FFF_ECONOMIC_V1_UI to `clientSchema`. Server-only.
  - Do NOT add a NEXT_PUBLIC_ variant. Page.tsx server components
    read server-side; there is no client-bundle need.

(9) src/lib/flags.ts — EDIT
  - Add below `isAuthWired()`:
      /**
       * ECONOMIC_V1_UI — spec-canonical replacement-page gate.
       *
       * When false (the default in deploy 1 and throughout 4A.*
       * development), the replacement pages at /vault/offers,
       * /vault/offers/[id], /vault/assignments, /vault/assignments/[id],
       * /vault/disputes, and /vault/disputes/[id] call `notFound()`
       * from their page.tsx server component. When true (flipped
       * at 4B alongside FFF_AUTH_WIRED), the replacement pages
       * render.
       *
       * Server-only flag. Read at the top of each replacement
       * page.tsx via the pattern:
       *
       *   import { isEconomicV1UiEnabled } from '@/lib/flags'
       *   import { notFound } from 'next/navigation'
       *
       *   export default function Page(...) {
       *     if (!isEconomicV1UiEnabled()) notFound()
       *     ...
       *   }
       *
       * Orthogonal to FFF_AUTH_WIRED, which gates request-surface
       * route handlers. Deploy 2 flips both flags in the same
       * env change; rollback flips both back. See
       * docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §7.3.
       *
       * 4A.1 ships the accessor. 4A.2/4A.3/4A.4 wire it into each
       * replacement page.tsx.
       */
      export function isEconomicV1UiEnabled(): boolean {
        return flags.economicV1Ui
      }

(10) vitest.config.ts — EDIT
  - Add alongside the existing `forwardedEnv.FFF_AUTH_WIRED = 'true'`
    line (~L78):
      // Default the economic-v1 UI flag ON in the test worker env
      // so 4A.2+'s replacement page.tsx server components render
      // through the live path under `bun run test`. Tests that need
      // the notFound() branch stub explicitly via vi.stubEnv.
      forwardedEnv.FFF_ECONOMIC_V1_UI = 'true'
  - Do NOT touch the FFF_AUTH_WIRED line. Do NOT change the NODE_ENV
    cast pattern landed at e994439. Do NOT change FF_INTEGRATION_TESTS
    handling from concern 2.

(11) supabase/migrations/<next-timestamp>_rpc_append_ledger_event.sql
  - Pick a timestamp strictly greater than 20260421000005 (the system-
    actor seed). Recommended: 20260421000010 — leaves
    20260421000006–000009 reserved for the concern-1 trigger race
    fix and any other prep work that lands BEFORE 4A.2. If a
    migration at that slot already exists, bump. Cite the chosen
    timestamp in the exit report.
  - Header comment citing:
      - P4 concern 4A.1 directive (this file)
      - P4_CONCERN_4_DESIGN_LOCK.md §6.1 + §6.1a (why one utility RPC)
      - spec §8.3 (storage shape) + §8.5 (atomicity — the business
        RPCs that call this one will wrap it in their own BEGIN/COMMIT;
        this RPC alone does not wrap)
      - supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
        (`enforce_ledger_hash_chain()` trigger — referenced, not
        modified)
  - Body:
      CREATE OR REPLACE FUNCTION public.rpc_append_ledger_event(
        p_thread_type     text,
        p_thread_id       uuid,
        p_event_type      text,
        p_payload_version text,
        p_payload         jsonb,
        p_actor_ref       uuid,
        p_prev_event_hash text
      ) RETURNS TABLE (id uuid, event_hash text)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        RETURN QUERY
        INSERT INTO public.ledger_events (
          thread_type, thread_id, event_type,
          payload_version, payload, actor_ref,
          prev_event_hash
        )
        VALUES (
          p_thread_type, p_thread_id, p_event_type,
          p_payload_version, p_payload, p_actor_ref,
          p_prev_event_hash
        )
        RETURNING ledger_events.id, ledger_events.event_hash;
      END;
      $$;

      -- Grant: service_role only. This RPC is called from server-
      -- side writer.ts using the service-role client. It must NOT
      -- be reachable from the anon or authenticated roles —
      -- clients go through the 4A.2+ business RPCs.
      REVOKE ALL ON FUNCTION public.rpc_append_ledger_event FROM PUBLIC;
      REVOKE ALL ON FUNCTION public.rpc_append_ledger_event FROM anon;
      REVOKE ALL ON FUNCTION public.rpc_append_ledger_event FROM authenticated;
      GRANT EXECUTE ON FUNCTION public.rpc_append_ledger_event TO service_role;
  - Do NOT wrap in BEGIN/COMMIT — a single INSERT is already atomic
    under Postgres. Business operations that pair an UPDATE with this
    INSERT will be their own RPCs (4A.2+) and wrap their own
    transaction; inlining BEGIN here would not help and would risk
    nested-transaction confusion when this RPC is eventually called
    from inside another function.
  - The function does NOT compute `event_hash` — the BEFORE INSERT
    trigger `enforce_ledger_hash_chain()` on ledger_events computes
    it and writes NEW.event_hash before the row is persisted. The
    RETURNING clause surfaces the trigger's output back to TS.

DECISIONS RESOLVED (do not re-litigate during execution)

D1. Design lock §2.3 chose `src/lib/ledger/` over the earlier-planned
    `src/lib/economic-flow/system-actor.ts` path (which was named in
    concern 1 directive §M5 and in the M5 seed migration's comment
    block at line ~23). The flat `ledger/` path is chosen because:
    (a) it matches the domain ("ledger events") rather than a
    marketing phrase ("economic flow"); (b) it keeps the writer,
    types, schemas, and the system-actor constant in one directory
    rather than splitting across two; (c) no other file currently
    imports `economic-flow` — there is nothing to migrate. The
    migration comment at M5 is a historical note; you do NOT update
    it. Ship the constant at src/lib/ledger/system-actor.ts and move
    on.

D2. Hash computation is Postgres-trigger-owned, NOT TS-side. Per
    spec §8.3 preimage formula and migration 20260421000004's
    `enforce_ledger_hash_chain()` at L427-466 (BEFORE INSERT trigger
    using pgcrypto's digest()), the trigger reads prev_event_hash
    from the row and the prior event's event_hash from the thread,
    validates equality, and computes NEW.event_hash. Therefore
    writer.ts does NOT import or use any sha256 library. If you
    notice a crypto import creeping in, you are building the wrong
    thing — stop and re-read design lock §6.1.

D3. Caller owns prev_event_hash lookup. The writer's EmitEventArgs
    includes `prevEventHash: string | null`. The caller (a business
    RPC from 4A.2+, or a test harness) is responsible for reading
    the prior hash INSIDE the same atomic transaction that holds
    the row lock, then passing it in. The writer DOES NOT query for
    it. Rationale: if the writer queried, it would race against its
    own caller's RPC body — two reads from two statements inside
    the same RPC can see different states under read-committed.
    Concentrating the read in the caller, inside the same txn as
    the lock, eliminates the race at the writer boundary.

D4. Atomicity via business-operation RPCs — deferred to 4A.2+, not
    scope of 4A.1. Per design lock §6.1a, each user-driven route
    (offer.create, offer.accept, …) gets its own Postgres RPC that
    wraps (row-lock → business UPDATE → prev_hash SELECT → call
    rpc_append_ledger_event → RETURN event_hash). 4A.1 ships ONLY
    `rpc_append_ledger_event` — the primitive. It is used directly
    by dispute.evidence_submitted (in 4A.4, which is a pure ledger
    append with no paired business UPDATE) and as a test bench for
    writer.ts. All business RPCs come in their owner sub-phase.

D5. Concern-1 trigger race (design lock §6.1b) is FLAGGED, NOT
    FIXED, in this concern. The `enforce_ledger_hash_chain()`
    trigger is susceptible to a concurrent-insert race under
    read-committed isolation: two concurrent inserts on the same
    thread can both read the same latest_hash, each pass validation,
    both commit, and fork the chain. The fix is a
    `UNIQUE (thread_type, thread_id, prev_event_hash)` constraint on
    ledger_events — it converts the race into a unique-violation
    on the second insert, which the RPC can retry or surface as
    HASH_CHAIN_VIOLATION. This fix is a concern-1 follow-up
    migration and must land BEFORE 4A.2 ships its first write-path
    route. 4A.1 MUST NOT add this UNIQUE constraint inline — doing
    so would conflate two concerns. Include this as an open item
    in your exit report so the founder can sequence the follow-up
    migration before 4A.2 is dispatched.

D6. No `'use server'` directive on system-actor.ts. Rationale: the
    file exports a single string const. 'use server' marks every
    export as a Server Function (Next.js 16 convention), which is
    wrong for a plain data constant. Server-only-ness is enforced
    by the module graph: only server-only callers (writer.ts,
    future cron handlers, dispute admin RPC call sites) import
    this module, and those callers are themselves 'use server' or
    live under src/app/api/. Any attempt to import from a client
    component will be caught by Next.js's server/client boundary
    check — no directive needed here.

D7. `rights` and `rights_diff` payload fields are typed as `unknown`
    in types.ts and `z.unknown()` in schemas.ts at this stage.
    Rationale: the rights template registry and override shape are
    not yet finalised (deferred to 4A.2's `src/lib/offer/rights.ts`
    per design lock §2.3). Tightening these to a specific shape in
    4A.1 would force a schema migration at 4A.2; leaving them
    unknown is the honest "we don't know the shape yet" signal.
    The pre-consumer exception (spec §8.6) explicitly allows
    this — breaking payload shape changes can happen in-place at
    v=1 until the first production consumer ships at P5. 4A.2
    directive will update both files as its first task.

BANNED TERMS
Per ECONOMIC_FLOW_v1 §9 and project conventions, the following terms
are banned in new code and new comments: certified, certification,
tamper-proof, immutable. Acceptable terms: verifiable, tamper-evident,
provenance-aware, independently reviewable.

Expected occurrences in this concern: ZERO. Run

  rg -n 'certif|immutab|tamper.proof' \
    src/lib/ledger/ src/lib/env.ts src/lib/flags.ts \
    vitest.config.ts supabase/migrations/*_rpc_append_ledger_event.sql

and confirm zero matches. Spec-wording references in docblocks that
cite §8.3's meta-negation ("does not claim immutable") are allowed
with an `allow-banned` inline tag, matching the convention at
docs/specs/ECONOMIC_FLOW_v1.md §8 preamble.

ACCEPTANCE CRITERIA (all must hold)
1. `src/lib/ledger/types.ts` exports `EventType` as a union of
   exactly the 20 literals in §EVENT INVENTORY, and `EventPayload<T>`
   as a conditional map covering all 20. Verified by TS compile and
   the schema-count test.
2. `src/lib/ledger/schemas.ts` exports 20 per-event schemas plus
   `EventPayloadSchemas` whose keys match EventType 1:1. The
   runtime belt-and-braces loop throws if any key is missing.
   Verified by schemas.test.ts case 1.
3. `emitEvent()` returns `{ ok: false, reason: 'PAYLOAD_VALIDATION_FAILED' }`
   on any Zod parse failure. Verified by writer.test.ts cases 2-3.
4. `emitEvent()` returns `{ ok: false, reason: 'HASH_CHAIN_VIOLATION' }`
   when the Supabase error message matches the trigger's
   hash-chain RAISE text. Verified by writer.test.ts case 4.
5. `emitEvent()` returns `{ ok: true, eventHash, eventId }` on
   successful mock RPC response. Verified by writer.test.ts case 1.
6. `SYSTEM_ACTOR_HANDLE` constant equals
   `'00000000-0000-0000-0000-000000000001'` byte-for-byte. Verified
   by system-actor.test.ts.
7. `isEconomicV1UiEnabled()` follows the `isAuthWired()` pattern:
   false by default, true when `FFF_ECONOMIC_V1_UI=true`. Reads
   live process.env on every call (no module-load cache). Verified
   by manual spot-check at the test harness level — no dedicated
   test file required for this wrapper (see concern 3 precedent for
   isAuthWired, which has its coverage via require-actor tests).
8. `bun run test` reports zero failures, zero file-load errors.
   Baseline 1083 passed + the new tests (count will increase by
   ~15–20). Cite exact counts.
9. `bun run build` completes green. Cite the "Compiled successfully"
   line.
10. `bun run typecheck` passes (or whichever `tsc --noEmit` invocation
    is canonical per AGENTS.md). Zero errors.
11. `rpc_append_ledger_event` migration applies cleanly. If a local
    Supabase is available, run `supabase db reset` and verify no
    error. If not, verify the SQL is syntactically valid by running
    `supabase migrations lint` or equivalent; cite the output.
12. Exactly the 11 files in §DELIVERABLES are created or modified.
    `git diff --name-only --diff-filter=AM && git status --short`
    returns exactly those paths.
13. Zero banned-term matches per the rg command in §BANNED TERMS.
14. No TS-side sha256/crypto import in any new file (D2). Verified
    by `rg -n 'crypto|sha256|digest' src/lib/ledger/` returning
    only comment-string matches that cite §8.3 or the trigger — no
    imports from 'crypto', 'node:crypto', '@noble/hashes', or similar.
15. No directory `src/lib/economic-flow/` created (D1). Verified by
    `ls src/lib/economic-flow 2>&1` returning "No such file".

VERIFY COMMANDS
Run all of these and include output in your exit report:
  - `git status --short`
  - `git diff --name-only --diff-filter=AM`
  - `rg -n 'certif|immutab|tamper.proof' src/lib/ledger/ src/lib/env.ts src/lib/flags.ts vitest.config.ts supabase/migrations/*_rpc_append_ledger_event.sql`
  - `rg -n 'crypto|sha256|digest' src/lib/ledger/`
  - `rg -n 'FFF_ECONOMIC_V1_UI' src/` (expected: only env.ts + flags.ts matches; the test files do not gate by this flag)
  - `rg -n 'SYSTEM_ACTOR_HANDLE' src/ supabase/` (expected: matches in system-actor.ts + system-actor.test.ts ONLY; spec/migration files have the UUID by literal, not the constant name)
  - `ls src/lib/economic-flow 2>&1 || true`
  - `bun run test 2>&1 | tail -20`
  - `bun run typecheck 2>&1 | tail -20` (or equivalent per AGENTS.md)
  - `bun run build 2>&1 | tail -20`

COMMIT
A single concern-scoped commit. Commit message template:

  feat(ledger): P4 concern 4A.1 — event-writer library + ECONOMIC_V1_UI flag

  Implements docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §9.1:
  - Adds src/lib/ledger/ (types, schemas, system-actor constant, writer)
  - Adds FFF_ECONOMIC_V1_UI env flag + isEconomicV1UiEnabled() accessor
  - Wires FFF_ECONOMIC_V1_UI=true into Vitest test.env so 4A.2+
    replacement page.tsx server components render live in tests
  - Adds supabase migration rpc_append_ledger_event — utility RPC
    wrapping the ledger_events insert (trigger-owned hash chain)
  - 20 per-event Zod payload schemas derived from spec §8.1 / §8.2 /
    §8.2a; EventPayloadSchemas dispatch map + compile-time `satisfies`
    check + runtime belt-and-braces presence check
  - SYSTEM_ACTOR_HANDLE constant closes the M5 deferral chain from
    concern 1 directive (moved path from `src/lib/economic-flow/` to
    `src/lib/ledger/` per design lock §2.3 / D1)

  ZERO route handlers, ZERO replacement pages, ZERO business-state
  RPCs — those ship in 4A.2/4A.3/4A.4. ZERO TS-side hash computation —
  Postgres trigger enforce_ledger_hash_chain() owns that (design lock
  §6.1 / D2). Concern-1 concurrent-insert race (design lock §6.1b)
  FLAGGED, NOT FIXED — dedicated concern-1 follow-up migration lands
  before 4A.2.

  Directive: docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md
  Design lock: docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §9.1
  Spec: docs/specs/ECONOMIC_FLOW_v1.md §8, §8.3, §8.4, §8.5

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1–5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:
  1. Preconditions check — each of #1–#13 with PASS/FAIL + a line
     explaining why.
  2. File list — every file created or edited, with line counts
     (or +/- diff stats for edits). Cite the migration timestamp
     you picked.
  3. Event inventory reconciliation — for each of the 20 events,
     confirm the payload fields in your Zod schema match the spec
     row (§8.1 / §8.2 / §8.2a). Cite any fields where you chose a
     tighter or looser Zod constraint than the spec row implies.
     Flag any spec-vs-directive disagreement.
  4. Decisions log — confirm D1–D7 from §A were honored as written,
     OR cite where you deviated and why.
  5. Banned-term lint — full output of the rg command.
  6. Acceptance checklist — each of criteria 1–15 with PASS/FAIL.
  7. Test-run output — tail of `bun run test`.
  8. Typecheck output — tail of `bun run typecheck` (or equivalent).
  9. Build output — tail of `bun run build`.
 10. Open items — anything you spotted that warrants founder review
     before 4A.2 begins. Must include AT LEAST:
     (a) concern-1 trigger race fix (D5) — MUST land before 4A.2
         dispatches its first write-path route
     (b) canonicalisation formalisation — spec §8.3 does not pin
         jsonb canonicalisation; you passed payload as-is relying on
         Postgres jsonb sort order
     (c) the exact RAISE message used by `enforce_ledger_hash_chain()`
         — cite it verbatim so the founder can verdict whether your
         writer.ts HASH_CHAIN_VIOLATION matcher is grounded
     (d) `rights` / `rights_diff` as `unknown` (D7) — 4A.2 tightens
 11. Commit SHA.
 12. Suggested next directive — "proceed to concern-1 trigger race
     follow-up" or "pause for founder review of X."
```

---

## B — What the directive governs

This directive hands one concern to Claude Code. After 4A.1's exit report is reviewed under §13.2 gate-per-concern discipline, a separate directive for the concern-1 trigger race follow-up (per D5) lands next, THEN 4A.2 (offer surface).

Concern 4A.1 is **library + flag scaffolding only**. It ships:
- 4 new library files (`types.ts`, `schemas.ts`, `system-actor.ts`, `writer.ts`) in a new `src/lib/ledger/` directory;
- 3 new test files;
- 3 small edits (`env.ts`, `flags.ts`, `vitest.config.ts`) adding the `FFF_ECONOMIC_V1_UI` flag alongside `FFF_AUTH_WIRED`;
- 1 new migration creating the utility RPC `rpc_append_ledger_event`.

Total surface: ~11 files, ~500-700 lines including schemas and tests. The bulk is the 20 Zod schemas; the writer itself is small.

## C — What the directive does NOT govern

- **Concerns 4A.2 / 4A.3 / 4A.4 (surface builds).** Offer / assignment / dispute route handlers, replacement pages, domain components. Separate directives; each depends on 4A.1 landed.
- **Concern 4B (tear-down + flip).** Deletes the 13 retiring routes, 17 DELETE components, old `src/lib/assignment/` + `src/lib/special-offer/`; flips both flags. Separate directive; last in the sequence.
- **Concern-1 trigger race fix.** The `UNIQUE (thread_type, thread_id, prev_event_hash)` constraint. Flagged by D5 here, landed as a dedicated follow-up migration before 4A.2.
- **Business-state RPCs** (`rpc_create_offer`, `rpc_accept_offer`, `rpc_counter_offer`, `rpc_deliver_piece`, `rpc_resolve_dispute`, …). Each lands in its owner sub-phase. 4A.1 ships only `rpc_append_ledger_event`.
- **Route handlers calling the writer.** None exist after 4A.1. Writer has tests-only consumers.
- **Replacement pages.** No page.tsx file is created or edited. The flag accessor exists for 4A.2+ to consume.
- **AssetRightsModule rewire.** Part of 4A.2 (absorbed from the earlier-labeled 4A.5 per design lock §9).
- **Notifications (§12.3), maintenance-mode rollback pages.** Deferred per design lock §10.
- **Merge to `main`.** Explicitly forbidden. Merge is a P5 event.
- **Flipping `FFF_ECONOMIC_V1_UI=true` in `.env.production`.** A 4B deploy event, not a code change.

## D — Dispatch readiness checklist

This directive does **not** ship to Claude Code until all of the following are ✓:

| # | Gate | State | Blocker? |
|---|---|---|---|
| 1 | P4 concerns 1, 2, 3 landed on `feat/p4-economic-cutover` | ✓ — concerns 1 (`9ba00e4`) + 2 (`17ec6f0`/`c0224ca`/`63fce73`) + 3 (`1a60e7f`/`2e99b65`); tree green at `e994439` (vitest NODE_ENV cast fix) | No |
| 2 | `bun run build` green at HEAD | ✓ — verified after `e994439` | No |
| 3 | `bun run test` = `1083 passed \| 10 skipped \| 0 failed` | ✓ — last reported state | No |
| 4 | `P4_CONCERN_4_DESIGN_LOCK.md` committed (currently untracked) | pending — founder verdicts lock Draft 2 (§6.1 Postgres-side hash chain correction + §9.1 narrow scope) then commits | Yes |
| 5 | Founder reviews this directive before dispatch | pending | Yes |
| 6 | Working tree clean immediately before dispatch | founder runs `git status` immediately before pasting §A | Yes (procedural) |

Gate 4 is the critical one. The design lock is the source of truth this directive cites; it must be committed before the directive is dispatched so Claude Code can read it from the committed tree.

---

## E — Proposed dispatch sequence

1. ✓ Concern 1 landed at `9ba00e4`.
2. ✓ Concern 2 landed at `17ec6f0` (decision memo at `63fce73`).
3. ✓ Concern 3 landed at `2e99b65` (directive at `1a60e7f`).
4. ✓ Vitest NODE_ENV cast fix landed at `e994439`.
5. Founder verdicts `P4_CONCERN_4_DESIGN_LOCK.md` Draft 2 (particularly §6.1 rewrite + §9.1 narrow scope).
6. Founder commits the design lock (`docs(audits): P4 concern 4 design lock`).
7. Founder verdicts this directive (§A body).
8. Founder confirms working tree clean (`git status` returns nothing).
9. Founder dispatches the §A body to Claude Code in a fresh session, on branch `feat/p4-economic-cutover`.
10. Claude Code produces exit report.
11. Founder verdicts exit report; approves or requests revisions.
12. On approval, draft the **concern-1 trigger race follow-up directive** (D5) — must land before 4A.2 dispatches.
13. After trigger race fix lands, draft `P4_CONCERN_4A_2_DIRECTIVE.md` against design lock §9.2.

---

## F — Revision history

- **2026-04-21 — Draft 1.** Initial directive drafted after `P4_CONCERN_4_DESIGN_LOCK.md` Draft 2 (which corrected §6.1 to locate hash math Postgres-side and narrowed §9.1 scope after a red-team pass before dispatch). Structural deviation from `P4_CONCERN_3_DIRECTIVE.md`: this directive cites `P4_CONCERN_4_DESIGN_LOCK.md §9.1` as the scope source-of-truth rather than `P4_IMPLEMENTATION_PLAN.md §X`, because concern 4 was described monolithically in the plan and the design lock is the first sub-phase decomposition. Seven decisions resolved inline (D1 flat `src/lib/ledger/` path over the deferred `src/lib/economic-flow/` path; D2 hash math is Postgres-trigger-owned; D3 caller loads prev_event_hash; D4 business RPCs deferred to 4A.2+; D5 concern-1 trigger race flagged not fixed here; D6 no 'use server' on system-actor.ts; D7 `rights`/`rights_diff` typed `unknown` pending 4A.2 tightening). One carryover gate: the design lock (`P4_CONCERN_4_DESIGN_LOCK.md`) is currently untracked and must be committed before this directive dispatches (§D gate 4).

---

_End of P4 concern 4A.1 directive._
