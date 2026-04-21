# P4 Concern 4A.2 — Offer Surface (Part B1: Non-accept Route Handlers)

**Status.** Drafted 2026-04-21 on top of `feat/p4-economic-cutover` commit `7e197cd` (Part A: offer-surface business RPC catalogue + `src/lib/offer/*` domain library). Second slice of the `P4_CONCERN_4_DESIGN_LOCK.md` §9.2 offer-surface build. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. Ships the five **non-accept** offer route handlers that consume Part A's RPC catalogue:

- `POST /api/offers` — `rpc_create_offer`
- `POST /api/offers/[id]/counter` — `rpc_counter_offer`
- `POST /api/offers/[id]/reject` — `rpc_reject_offer`
- `POST /api/offers/[id]/cancel` — `rpc_cancel_offer`
- `GET  /api/offers/[id]` — party-only read

Plus a TS-side SQLSTATE+SQLERRM error-classification wrapper (`src/lib/offer/rpc-errors.ts`), a user-JWT Supabase client helper (`src/lib/db/client.ts` EDIT), and Vitest route-level integration tests per route. **No** Stripe, **no** accept route, **no** pages, **no** components, **no** list endpoint in this slice — those land in B2 / C1 / C2 / D (separate follow-on directives).

**Relationship to §9.2 full scope.** B1 is one of six dispatchable parts that together land design-lock §9.2's offer surface. Sequence: **A (done) → B1 (this directive) → B2 → C1 → C2 → D**. Each part is dispatched only after the prior part's exit report clears verdict. B1 is intentionally narrow — five route handlers, one error classifier, one client-helper extension, five test files — so the exit-report surface stays verdictable in a single pass.

**Cross-references.**
`docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §2.3 (library decomposition), §3.1 (offer route inventory — **this directive implements five of the six offer routes; accept is Part B2**), §6.1a (atomicity via business RPCs — closed in Part A for offers), §7 (flag strategy — **this directive consumes `FFF_AUTH_WIRED` per D14 of Part A**); `docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md` §DECISIONS D8 (server-sentinel rationale for `requireActor`), §EXIT REPORT 10(a) (Authorization header token extraction — **this directive consumes that surface**); `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md` (Part A) — **full context: sections D1 through D15, the §DELIVERABLES surface, and §ACCEPTANCE CRITERIA.** This directive closes Part A exit-report open items **15(b)** (cancel coverage via route integration tests) and rides on Part A's D15 (system-actor filter on cancel last-turn guard) and D3 (txn-per-HTTP-request semantics); `docs/specs/ECONOMIC_FLOW_v1.md` §4 (offer state machine), §7 (offer shape + triggers), §8.1 (offer payload rows), §8.4 (actor handles), §8.5 (transition atomicity — **accept Stripe straddle is explicitly out of B1 scope**), §F16 (platform-fee rate-lock on `offer.created` — enforced by the RPC; route handler passes the current bps); `supabase/migrations/20260421000011_rpc_offer_business.sql` (Part A — **this directive's authoritative RPC surface**; error codes P0001-P0008 at L71-83); `supabase/migrations/20260421000005_seed_system_actor.sql` (system sentinel `00000000-0000-0000-0000-000000000001`); `src/lib/auth/require-actor.ts` (canonical actor resolution — **this directive's only auth surface**); `src/lib/offer/index.ts` (Part A barrel — **this directive's only domain surface**); `src/lib/api/validation.ts` (`parseBody` / `parseParams` tuple-return pattern — **this directive's only request-parsing surface**); `src/app/api/v2/batch/__tests__/route.test.ts` (reference pattern for route integration tests — `scopeEnvVars` + `withEnv` + direct handler invocation).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 4A.2 — Offer Surface Part B1
       (non-accept offer route handlers + SQLSTATE error-
       classification wrapper + user-JWT Supabase client helper
       + Vitest route integration tests; accept + Stripe
       straddle deferred to Part B2; pages + components deferred
       to Parts C1/C2; cron deferred to Part D)

SCOPE
You are building the five non-accept offer route handlers that
sit on top of Part A's Postgres business RPC catalogue, plus the
supporting TS-side plumbing to:

  (1) Resolve the request's actor via requireActor() and surface
      the Supabase access token.
  (2) Build a user-JWT Supabase client whose auth.uid() resolves
      inside SECURITY DEFINER RPCs (so the RPC actor-auth guard
      at P0008 passes cleanly).
  (3) Classify Postgres-side P0001-P0008 SQLSTATE+SQLERRM pairs
      into a stable TS discriminated union mapped to HTTP status.
  (4) Validate request bodies with Zod (parseBody) and dynamic
      params with Zod (parseParams).
  (5) Return spec-canonical { data } / { error: { code, message } }
      JSON responses.

Five routes. One error classifier. One client-helper extension.
Five route-level integration test files.

Routes:

  (R1) POST /api/offers                 → rpc_create_offer
  (R2) POST /api/offers/[id]/counter    → rpc_counter_offer
  (R3) POST /api/offers/[id]/reject     → rpc_reject_offer
  (R4) POST /api/offers/[id]/cancel     → rpc_cancel_offer
  (R5) GET  /api/offers/[id]            → party-only read (no RPC)

Explicit narrowing:
  - ZERO accept route. POST /api/offers/[id]/accept is Part B2
    because its §8.5 Stripe PaymentIntent straddle is a distinct
    concern that deserves its own exit report.
  - ZERO Stripe. No PaymentIntent code, no webhook, no
    idempotency-key threading. Part B2.
  - ZERO list endpoint. GET /api/offers (no id) is party-filtered
    inbox rendering; Part C1 owns it alongside the
    /vault/offers page that consumes it.
  - ZERO pages or components. Parts C1/C2.
  - ZERO cron. Part D.
  - ZERO changes to Part A's migration 20260421000011. If a bug
    surfaces in the RPC catalogue during B1 integration testing,
    STOP and report. Do NOT patch the migration in this session.
  - ZERO changes to src/lib/offer/* from Part A. The library is
    frozen at commit 7e197cd; B1 consumes it via the barrel
    export at src/lib/offer/index.ts only.
  - ZERO changes to src/lib/ledger/* (writer, schemas, types).
  - ZERO changes to src/lib/auth/require-actor.ts. The Part A
    (via 4A.1) contract is load-bearing; B1 consumes the
    discriminated-union result unchanged.
  - ZERO changes to the retiring src/app/api/special-offer/**
    tree. The old mock-backed surface keeps serving traffic
    behind the OFF flag until 4B.

PRECONDITIONS (exit if any fail)
 1. Working directory is the Frontfiles repo root
    (/path/to/frontfiles with an `AGENTS.md` at the root).
 2. Current branch is feat/p4-economic-cutover.
 3. HEAD includes commit 7e197cd (Part A: offer RPC catalogue +
    src/lib/offer/*). Verify with
    `git log --oneline -1 7e197cd` — must resolve. Additional
    commits beyond 7e197cd are allowed iff they touch ONLY
    `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` (this file).
    Verify via
    `git diff --name-only 7e197cd..HEAD` — any path other than
    the directive file in the diff fails the precondition. Cite
    the actual diff output in exit-report §1.
 4. `git status --porcelain` is clean (no staged, no unstaged, no
    untracked beyond `.claude/settings.local.json` which is
    expected to be gitignored — verify with
    `git check-ignore .claude/settings.local.json`).
 5. supabase/migrations/20260421000011_rpc_offer_business.sql
    exists and is exactly 1151 lines. If the line count differs,
    STOP — the migration has been modified off-session and the
    baseline is invalid.
 6. src/lib/offer/{types,state,pricing,rights,composer,index}.ts
    all exist and all typecheck. Verify with
    `ls src/lib/offer/*.ts` — must list exactly 6 .ts files
    (plus the tests/ directory).
 7. src/lib/auth/require-actor.ts exists and exports
    `requireActor` with the RequireActorResult discriminated
    union. Do NOT read the file body — trust the symbol table.
 8. src/lib/db/client.ts exists and exports `getSupabaseClient`
    (service-role, existing) and `_resetSupabaseClient`. B1
    extends the module; does NOT rewrite it.
 9. src/lib/api/validation.ts exports `parseBody`, `parseParams`,
    and `parseQuery`. B1 consumes the existing tuple-return
    surface; does NOT modify validation.ts.
10. src/lib/flags.ts exports `isAuthWired`. Consumed only
    indirectly via requireActor; B1 does NOT import it directly
    (requireActor already gates on the flag).
11. src/lib/ledger/types.ts exports `EventPayload<'offer.created'>`
    and `EventPayload<'offer.countered'>`. B1 consumes these
    types through src/lib/offer/composer.ts.
12. Part A baseline: `bun run test` passes at exactly **1169
    passed + 10 skipped** (Part A exit-report commit 7e197cd).
    Any drift here is a blocker — investigate before proceeding.
    Cite the baseline tail in exit-report §1.
13. `bun run typecheck` is clean at 7e197cd.
14. `bun run build` is green at 7e197cd.
15. env.ts schema has NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
    all REQUIRED. B1 relies on the anon key being present
    server-side (it is a `NEXT_PUBLIC_*` var, so it IS in the
    client bundle AND readable from server code via
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY).
16. No existing src/app/api/offers/** tree. Verify with
    `ls src/app/api/offers 2>/dev/null || echo ABSENT` — must
    print ABSENT. If present, STOP and report; a prior session
    left scaffolding that needs reconciliation before B1 can
    build on it.
17. No existing src/lib/offer/rpc-errors.ts. Verify with
    `ls src/lib/offer/rpc-errors.ts 2>/dev/null || echo ABSENT`
    — must print ABSENT.

DELIVERABLES (13 files: 12 new + 1 edit)

ALL paths are relative to the repo root.

NEW files:

  (F1) src/app/api/offers/route.ts
       - POST handler for rpc_create_offer.
       - Signature: `export async function POST(request: NextRequest)`
       - Flow:
           a. requireActor(request) → discriminated-union result;
              ok:false → 404 { error: { code: 'FEATURE_DISABLED' } }
              when reason=FEATURE_DISABLED; 401
              { error: { code: 'UNAUTHENTICATED' } } when reason=
              UNAUTHENTICATED; 403
              { error: { code: 'ACTOR_NOT_FOUND' } } when reason=
              ACTOR_NOT_FOUND.
           b. parseBody(request, CreateOfferBody, 'POST /api/offers').
              CreateOfferBody Zod schema (defined in-file):
                { creatorId: uuid,
                  targetType: OfferCreatedPayloadSchema.shape.target_type
                    (imported from '@/lib/ledger/schemas'),
                  grossFee: number positive,
                  platformFeeBps: number int in [0, 10000],
                  currency: string length 3,
                  rights: RightsSchema (imported from
                    src/lib/offer),
                  expiresAt: datetime ISO string,
                  note: string max 2000,
                  items: unknown[] (validated next step via
                    validatePackComposition) }
              DO NOT accept buyerId in the body (D8): the buyer
              is the authenticated caller, resolved from
              actor.authUserId.
              DO NOT re-declare the target_type enum literals.
              `TargetTypeSchema` is private inside
              `src/lib/ledger/schemas.ts` (not exported);
              reach into `OfferCreatedPayloadSchema.shape.target_type`
              — the DDL-bound enum — to avoid drift from the
              `offer_target_type` Postgres ENUM.
           c. validatePackComposition({ targetType, items }) —
              errors surface as 400 VALIDATION_ERROR with the
              PackErrCode in the body.
           d. Build p_payload via buildOfferCreatedPayload using
              the composed items (asset UUIDs for asset-packs;
              spec slot refs for brief-packs — match Part A §8.1).
           e. getSupabaseClientForUser(accessToken) — the
              extracted Bearer token from the request.
           f. client.rpc('rpc_create_offer', { p_actor_ref:
              actor.handle, p_buyer_id: actor.authUserId,
              p_creator_id: body.creatorId, p_target_type:
              body.targetType, p_gross_fee: body.grossFee,
              p_platform_fee_bps: body.platformFeeBps,
              p_currency: body.currency, p_rights: body.rights,
              p_current_note: body.note, p_expires_at:
              body.expiresAt, p_items: body.items, p_payload }).
           g. If error → classifyRpcError(error) → HTTP status +
              body per §D4 table.
           h. If ok → return 201 { data: { offerId, eventId,
              eventHash } }.

  (F2) src/app/api/offers/[id]/route.ts
       - GET handler for a single offer (party-only read).
       - Signature: `export async function GET(
            request: NextRequest,
            ctx: { params: Promise<{ id: string }> }
         )`
       - Flow:
           a. requireActor → as F1.
           b. parseParams(ctx.params, z.object({ id: z.string().uuid() }),
              'GET /api/offers/[id]').
           c. getSupabaseClientForUser(accessToken).
           d. SELECT from `offers` WHERE id = params.id LIMIT 1.
              Joined read: offer row + offer_assets rows + offer_briefs
              rows (depending on target_type). Use two queries (one
              for the offer, one for the child rows based on
              target_type) — no SQL function composition in B1.
           e. If row missing → 404 { error: { code: 'OFFER_NOT_FOUND',
              message: 'Offer not found' } }.
           f. Party-only guard: if actor.authUserId !==
              offer.buyer_id AND actor.authUserId !==
              offer.creator_id, return 404 (NOT 403) — surface
              parity with "not found" prevents non-party
              enumeration of other parties' offer IDs. (D6)
              NOTE: under user-JWT + `offers_party_select` RLS
              (migration 20260421000004 L506-508), a non-party
              SELECT returns zero rows — step e already emits
              404 in that case. This step is belt-and-braces:
              it documents the intended authorisation and
              guards against a future drift where the service-
              role client is wired in by mistake. It cannot
              fire in production on the user-JWT path.
           g. On success → 200 { data: OfferView } where OfferView
              is the composed shape:
                { offer: OfferRow,
                  assets: AssetRow[] | null,
                  briefs: BriefRow[] | null }
              (exactly one of assets / briefs is non-null per
              target_type per §7 XOR).

  (F3) src/app/api/offers/[id]/counter/route.ts
       - POST handler for rpc_counter_offer.
       - Signature: `export async function POST(
            request: NextRequest,
            ctx: { params: Promise<{ id: string }> }
         )`
       - Flow:
           a. requireActor → as F1.
           b. parseParams(ctx.params, z.object({ id: uuid }), ...).
           c. parseBody with CounterOfferBody Zod:
                { newGrossFee: number positive,
                  newNote: string max 2000,
                  newExpiresAt: datetime ISO string,
                  addedItems?: unknown[],
                  removedItems?: unknown[],
                  newRights: RightsSchema }
              addedItems / removedItems default to [] when omitted;
              pack-composition diff is validated at the RPC by
              the T1/T2/T4 triggers + the T1 same-creator check.
              B1 does NOT re-run validatePackComposition for
              counters — the composition shape across a counter
              is "add/remove delta" which validatePackComposition
              does not cover. Part A's DDL triggers own the
              enforcement.
           d. PREFLIGHT: load offer row (no FOR UPDATE), run
              canCounter({ offer, actorUserId: actor.authUserId }).
              If allowed=false → return 409
              { error: { code: reason, message } } where reason
              is the guard's TS-side string ('invalid_state' /
              'not_party'). The RPC is the authoritative
              boundary; this preflight saves the round-trip on
              the common failure paths. (D2)
           e. Build p_payload via buildOfferCounteredPayload with
              byActorId = actor.handle (NOT authUserId — §8.1
              by_actor_id field is `actor_handles.handle` per
              spec §7.1 ledger_events.actor_ref = UUID handle),
              before = { gross_fee, items, rights, current_note }
              from the preflight offer load + a second query for
              the current items (asset ids or brief slot refs),
              after = body fields.
           f. getSupabaseClientForUser(accessToken).
           g. client.rpc('rpc_counter_offer', { p_actor_ref:
              actor.handle, p_offer_id: params.id, p_payload,
              p_new_gross_fee: body.newGrossFee, p_new_note:
              body.newNote, p_new_expires_at: body.newExpiresAt,
              p_added_items: body.addedItems ?? [], p_removed_items:
              body.removedItems ?? [], p_new_rights: body.newRights }).
           h. If error → classifyRpcError → §D4 table.
           i. If ok → return 200 { data: { eventId, eventHash } }.

  (F4) src/app/api/offers/[id]/reject/route.ts
       - POST handler for rpc_reject_offer.
       - Signature: as F3.
       - Flow:
           a. requireActor.
           b. parseParams id.
           c. parseBody with RejectOfferBody Zod:
                { reasonCode: enum of the counsel-approved reason
                  codes; for v1 ship { 'terms_rejected',
                  'price_too_low', 'rights_mismatch',
                  'deadline_infeasible', 'other' },
                  note?: string max 2000 }
           d. PREFLIGHT canReject; failure → 409.
           e. Build payload:
                { v: 1, by_actor_id: actor.handle, reason_code,
                  note: body.note ?? '' }
              This matches the spec §8.1 offer.rejected payload
              shape. (Part A lib does NOT ship a buildOfferRejectedPayload
              helper — inline the literal object here, matching the
              Zod schema in src/lib/ledger/schemas.ts.)
           f. client.rpc('rpc_reject_offer', { p_actor_ref:
              actor.handle, p_offer_id: params.id, p_payload }).
           g. Classify errors; success → 200 { data: { eventId,
              eventHash } }.

  (F5) src/app/api/offers/[id]/cancel/route.ts
       - POST handler for rpc_cancel_offer.
       - Signature: as F3.
       - Flow:
           a. requireActor.
           b. parseParams id.
           c. parseBody with CancelOfferBody Zod:
                { reasonCode: enum { 'buyer_withdrew',
                  'duplicate', 'other' }, note?: string max 2000 }
           d. PREFLIGHT: load offer row (no FOR UPDATE), run
              canCancel({ offer, actorUserId: actor.authUserId })
              — NO `lastEventActorRef`. Rationale: the user-JWT
              client cannot see the counterparty's events under
              the `ledger_events_party_select` RLS policy
              (migration 20260421000004 L613-622), so the route
              has no production-reachable signal for
              NOT_LAST_TURN. The RPC's D15 system-actor-filtered
              guard is the authoritative catch (P0005 → 409
              NOT_LAST_TURN via classifier). The preflight here
              still short-circuits INVALID_STATE and NOT_PARTY
              cleanly — both are off the offer row, visible to
              parties under `offers_party_select`. Failure → 409
              { error: { code: reason, message } }.
           e. Build payload:
                { v: 1, by_actor_id: actor.handle, reason_code,
                  note: body.note ?? '' }
           f. client.rpc('rpc_cancel_offer', { p_actor_ref:
              actor.handle, p_offer_id: params.id, p_payload }).
           g. Classify errors; success → 200 { data: { eventId,
              eventHash } }.

  (F6) src/lib/offer/rpc-errors.ts
       - TS-side classifier for Part A's P0001-P0008 SQLSTATE
         + SQLERRM pairs. Pattern mirrors src/lib/ledger/writer.ts
         L133-158 (scoped SQLSTATE + SQLERRM substring match;
         plain SQLSTATE alone is unsafe).
       - Exports:

           export type OfferRpcErrorKind =
             | 'retry_exhausted'
             | 'rate_limit'
             | 'invalid_state'
             | 'offer_not_found'
             | 'not_party'
             | 'not_last_turn'
             | 'not_system'
             | 'not_yet_expired'
             | 'actor_mismatch'
             | 'unknown'

           export type ClassifiedRpcError = {
             kind: OfferRpcErrorKind
             httpStatus: number
             code: string      // stable string for API response body
             message: string   // sanitized for client (no PII, no SQL)
             raw: { code?: string; message?: string }
           }

           export function classifyRpcError(
             err: { code?: string; message?: string } | null | undefined,
           ): ClassifiedRpcError

       - Classification rules (scoped SQLSTATE + SQLERRM substring):

           P0001 + 'retry exhausted' →
             { kind: 'retry_exhausted', httpStatus: 503,
               code: 'LEDGER_CONTENTION',
               message: 'Ledger write contention; retry shortly.' }

           P0002 + 'rate_limit' →
             { kind: 'rate_limit', httpStatus: 429,
               code: 'RATE_LIMIT',
               message: 'Maximum pending offers with this counterparty reached.' }

           P0003 + 'offer_not_found' →
             { kind: 'offer_not_found', httpStatus: 404,
               code: 'OFFER_NOT_FOUND',
               message: 'Offer not found.' }

           P0003 + 'invalid_state' →
             { kind: 'invalid_state', httpStatus: 409,
               code: 'INVALID_STATE',
               message: 'Offer is not in a transitionable state.' }

           P0004 + 'not_party' →
             { kind: 'not_party', httpStatus: 403,
               code: 'NOT_PARTY',
               message: 'Not a party on this offer.' }

           P0005 + 'not_last_turn' →
             { kind: 'not_last_turn', httpStatus: 409,
               code: 'NOT_LAST_TURN',
               message: 'Cancellation requires the last turn to be yours.' }

           P0006 + 'not_system' →
             { kind: 'not_system', httpStatus: 403,
               code: 'NOT_SYSTEM',
               message: 'This operation is system-only.' }

           P0007 + 'not_yet_expired' →
             { kind: 'not_yet_expired', httpStatus: 409,
               code: 'NOT_YET_EXPIRED',
               message: 'Offer has not yet expired.' }

           P0008 + 'actor_mismatch' →
             { kind: 'actor_mismatch', httpStatus: 401,
               code: 'ACTOR_MISMATCH',
               message: 'Session actor does not match the authenticated user.' }

           default / unmatched →
             { kind: 'unknown', httpStatus: 500,
               code: 'INTERNAL',
               message: 'Internal server error.' }

       - All SQLSTATE matches run `err.code === 'Pxxxx'` first,
         then substring the SQLERRM. Substring-only matching is
         REJECTED (it would mis-classify a generic P0003 RAISE
         that happens to contain the word 'not_found' in unrelated
         text). Both the migration's RAISE messages use a stable
         prefix — 'offer_not_found: <uuid>' and
         'invalid_state: offer is <state>' — which disambiguates
         the two P0003 cases cleanly.
       - Logger discipline (D9): the classifier does NOT log.
         Callers log a single line with { route, kind, code,
         rawCode: raw.code } — no SQLERRM body, no payload, no
         user identifiers.

  (F7) src/lib/offer/tests/rpc-errors.test.ts
       - Table-driven coverage of every P0001-P0008 branch,
         the default 'unknown' branch, and the scoping
         discipline (a P0003 that does NOT contain
         'offer_not_found' or 'invalid_state' falls through to
         'unknown' — do NOT let it be silently classified as
         'offer_not_found'). Include a case for null / undefined
         input. Include a case for an error with code=P0003 and
         message='invalid_state: offer is expired' (confirming
         the prefix match is case-sensitive as written).

  (F8) src/app/api/offers/__tests__/create.route.test.ts
       - POST /api/offers route integration tests. Shape mirrors
         src/app/api/v2/batch/__tests__/route.test.ts:
           - scopeEnvVars([NEXT_PUBLIC_SUPABASE_URL,
             NEXT_PUBLIC_SUPABASE_ANON_KEY,
             SUPABASE_SERVICE_ROLE_KEY, FFF_AUTH_WIRED]).
           - withEnv() helper for per-test flag mutation.
           - Each `it` constructs a Request (absolute URL for
             Next.js route handlers) and invokes the imported
             POST handler directly.
         Coverage (AT LEAST):
           (a) FFF_AUTH_WIRED unset → 404 FEATURE_DISABLED.
           (b) FFF_AUTH_WIRED=true, no Authorization header → 401
               UNAUTHENTICATED.
           (c) FFF_AUTH_WIRED=true, malformed JWT → 401
               UNAUTHENTICATED (mocked Supabase auth.getUser to
               fail).
           (d) FFF_AUTH_WIRED=true, valid JWT but no
               actor_handles row → 403 ACTOR_NOT_FOUND.
           (e) Valid actor, missing body fields → 400
               VALIDATION_ERROR with field path.
           (f) Valid actor, body fails validatePackComposition
               (e.g. items=[]) → 400 VALIDATION_ERROR /
               item_count_out_of_range.
           (g) Valid actor, RPC succeeds → 201 with data.offerId,
               data.eventId, data.eventHash (mock the RPC).
           (h) Valid actor, RPC returns P0002 → 429 RATE_LIMIT.
           (i) Valid actor, RPC returns P0008 → 401 ACTOR_MISMATCH.
         All tests mock the Supabase client (auth.getUser,
         from(), rpc()) at the getSupabaseClient /
         getSupabaseClientForUser module seam — do NOT require a
         live Supabase instance. The live-mode end-to-end
         assertion lives in Part A's inline DO-block (creates →
         counters validated there); B1 tests are unit-level on
         the route boundary.

  (F9)  src/app/api/offers/[id]/__tests__/get.route.test.ts
        - GET /api/offers/[id] integration tests. Coverage:
            (a-d) Flag + auth branches (as F8).
            (e) Valid actor, nonexistent offer → 404
                OFFER_NOT_FOUND.
            (f) Valid actor, offer exists but actor is NOT a
                party → 404 (NOT 403; see D6).
            (g) Valid actor, actor is buyer, asset-pack offer →
                200 with data.offer + data.assets populated,
                data.briefs = null.
            (h) Valid actor, actor is creator, brief-pack offer
                → 200 with data.briefs populated, data.assets =
                null.

  (F10) src/app/api/offers/[id]/counter/__tests__/counter.route.test.ts
        - POST counter integration tests. Coverage:
            (a-d) Flag + auth branches.
            (e) Valid actor, state='accepted' (preflight fails
                canCounter) → 409 INVALID_STATE without RPC call.
            (f) Valid actor, non-party preflight → 409 NOT_PARTY
                without RPC call.
            (g) Valid actor, preflight passes, RPC returns
                P0003 invalid_state (concurrent transition raced
                the preflight) → 409 INVALID_STATE.
            (h) Valid actor, preflight + RPC succeed → 200 with
                data.eventId, data.eventHash.

  (F11) src/app/api/offers/[id]/reject/__tests__/reject.route.test.ts
        - POST reject integration tests. Coverage:
            (a-d) Flag + auth.
            (e) Body reasonCode outside enum → 400 VALIDATION_ERROR.
            (f) Preflight canReject fails (invalid_state or
                not_party) → 409 without RPC call.
            (g) Preflight passes, RPC returns P0003 invalid_state
                (concurrent transition raced the preflight) →
                409 INVALID_STATE via classifier. Race-path
                parity with F10(g) / F12(h).
            (h) Preflight + RPC succeed → 200.

  (F12) src/app/api/offers/[id]/cancel/__tests__/cancel.route.test.ts
        - POST cancel integration tests. Coverage:
            (a-d) Flag + auth.
            (e) Non-buyer cancel attempt → 409 NOT_PARTY
                (preflight catches; state.ts canCancel returns
                not_party: cancel is buyer-only). Realistic
                under RLS: creator can SELECT the offer row via
                `offers_party_select`, so the route reaches
                canCancel and short-circuits in memory.
            (f) Buyer cancel, creator holds the last turn → RPC
                returns P0005 → 409 NOT_LAST_TURN via classifier.
                Mocked RPC returns the P0005 SQLSTATE+SQLERRM
                pair. The preflight does NOT short-circuit this
                case — see D2 scope exception. The test asserts
                the RPC was actually called (no preflight
                bypass).
            (g) Buyer cancel, state='accepted' → 409
                INVALID_STATE without RPC call (preflight
                catches via canCancel state check).
            (h) Buyer cancel, RPC returns P0003 invalid_state
                (race: creator transitioned the offer between
                preflight and RPC) → 409 INVALID_STATE via
                classifier.
            (i) Buyer cancel, preflight + RPC succeed → 200 with
                data.eventId, data.eventHash.

EDITS:

  (F13) src/lib/db/client.ts
        - Add `getSupabaseClientForUser(accessToken: string):
          SupabaseClient`.
        - Uses env.NEXT_PUBLIC_SUPABASE_ANON_KEY (NOT service-
          role) + `global.headers.Authorization = 'Bearer ' +
          accessToken` so the user's JWT is forwarded on every
          underlying HTTP call. This is what makes `auth.uid()`
          resolve inside SECURITY DEFINER RPC bodies; the
          service-role client's `auth.uid()` returns NULL and
          would fail P0008. (D1)
        - NOT cached at module level: one client per
          authenticated request (tokens are per-request). Return
          a fresh client each call. This is a tradeoff — creating
          a client per request costs ~constant memory allocation
          but supports correct isolation. If p99 latency shows
          measurable overhead in load testing (post-P5), revisit
          with a token-keyed LRU cache.
        - Preserve the existing `getSupabaseClient()` (service-
          role) — Part D cron still needs it for rpc_expire_offer.
          Do NOT remove or rename.
        - Preserve `_resetSupabaseClient` and `isSupabaseConfigured`.
        - Update the module-level JSDoc to cover the two clients
          (service-role: system-side; user-JWT: user-side
          request handlers).

TXN BOUNDARY
Each of R1-R5 runs in its own Postgres transaction by virtue of
running in its own HTTP request via the RPC call. This is the
canonical Next.js App Router + Supabase RPC semantics — one
request, one server-side txn, implicit BEGIN...COMMIT around the
single rpc() call. The Part A Draft 5 in-migration DO-block
txn-pinned-`now()` pathology does NOT apply here: each RPC sees
`now()` advance cleanly between requests, so the cancel last-
turn guard's `ORDER BY created_at DESC` lookup is deterministic
in production traffic. (D3)

IDENTITY CONTRACT (UUID-native everywhere)
Part A §DECISIONS Draft 4 locked the IDENTITY CONTRACT: state.ts
guards compare `actorUserId: string` (= auth.users.id) against
OfferRow.buyer_id / creator_id. B1 route handlers consume this
contract:

  - `actor.authUserId` from requireActor → passed to
    canCounter / canAccept / canReject / canCancel as
    `actorUserId`. This is the auth.users.id UUID.

  - `actor.handle` from requireActor → passed to RPCs as
    `p_actor_ref` (the Part A migration signature types it as
    `uuid` and the RPC body resolves handle → auth_user_id via
    actor_handles before the `auth.uid()` check). This is the
    actor_handles.handle UUID (pseudonymised §8.4).

  - Payload `by_actor_id` field (§8.1) is the handle, NOT the
    authUserId. ledger_events.actor_ref is typed as UUID-handle
    per spec §7.1 and §8.4.

  - cancel route does NOT pass `lastEventActorRef` to canCancel.
    Draft 1 specified a handle→auth_user_id resolution for this
    parameter; Draft 2 dropped it because RLS on ledger_events
    makes the route-side preflight signal unreachable. The
    state.ts parameter still exists for future callers; B1 is
    no longer one of them. (D11 retains the naming-drift item
    as tidy backlog on state.ts.)

DO NOT mix handle vs authUserId across the three remaining
surfaces (state.ts guards, RPC params, payload by_actor_id).
Every place the code touches either surface must be explicit
about which is being passed. Any fuzziness here is a real
security bug: P0008 exists because the RPC caller can lie about
p_actor_ref to impersonate another user.

RESPONSE SHAPE CONTRACT (D7)
Success:  HTTP 2xx, body { data: <payload> }
Failure:  HTTP 4xx / 5xx, body { error: { code, message,
                                          fields? } }
  - `code` is a stable SCREAMING_SNAKE_CASE identifier.
  - `message` is a one-liner safe for client display. No SQL,
    no stack traces, no PII.
  - `fields` appears only on 400 VALIDATION_ERROR and contains
    the Zod flatten().fieldErrors map.
  - DO NOT return the raw Postgres error message in any
    production path. The classifier's `raw` field is logged
    server-side but never serialized to the client.
  - DO NOT return the computed event_hash on failure paths
    (success-only).
  - Content-Type is application/json on every response.

SECURITY — BUYER DERIVED FROM SESSION (D8)
POST /api/offers MUST derive `p_buyer_id` from the authenticated
actor (`actor.authUserId`), NOT from the request body. Accepting
a `buyerId` body field would let a compromised or malicious
token create offers on behalf of arbitrary buyers. The offer-
creation surface is the only route that needs this treatment;
the other four all look up existing offer rows by id and use
the RPC's party guard to validate membership.

CreatorId DOES come from the body: for the create case the
buyer chooses which creator to send the offer to. The self-
dealing CHECK in migration 20260421000004 L97 prevents
creatorId === buyerId at the DDL layer.

BANNED TERMS
  rg -n 'certif|immutab|tamper.proof' \
     src/app/api/offers/ \
     src/lib/offer/rpc-errors.ts \
     src/lib/db/client.ts
  Must return zero matches. Provenance-aware / verifiable /
  independently-reviewable are acceptable substitutes per
  project CLAUDE.md.

DECISIONS

D1 — User-JWT Supabase client via anon key + Bearer header.
  The service-role client bypasses auth.uid() (returns NULL)
  and would trip P0008 actor_mismatch on every user-facing RPC.
  `getSupabaseClientForUser(accessToken)` uses
  NEXT_PUBLIC_SUPABASE_ANON_KEY as the API key and threads the
  user's JWT as `Authorization: Bearer <token>` on every HTTP
  call. This is the canonical Supabase pattern for user-scoped
  SDK access on the server. Alternative (JWT verification +
  service-role client with explicit auth.uid() SET LOCAL) was
  considered and REJECTED — it duplicates Supabase auth logic
  client-side, violates the "Postgres is the authoritative
  boundary" principle Part A established, and bypasses the RLS
  policies that enforce per-party visibility on the underlying
  tables (offer + child reads in F2, offer loads in F3/F4/F5
  preflights).

D2 — Preflight state.ts guards; RPC is authoritative.
  Route handlers run canCounter / canReject / canCancel as a
  preflight BEFORE hitting the RPC. This saves a round-trip on
  the common 409 INVALID_STATE / 409 NOT_PARTY paths. But the
  preflight is advisory — the RPC runs its own row-locked state
  check and its result is the source of truth. If the preflight
  says allowed but the RPC returns P0003 / P0004 / P0005, the
  route handler surfaces the RPC result (race between preflight
  read and RPC execution). Tests F8-F12 cover both the
  preflight-short-circuit paths AND the RPC-overrides-preflight
  race paths.

  SCOPE EXCEPTION — cancel NOT_LAST_TURN is RPC-only.
  The `ledger_events_party_select` policy (migration
  20260421000004 L613-622) grants a user visibility on a ledger
  row iff that row's `actor_ref` resolves to their own
  `auth.uid()`. A buyer's user-JWT client cannot see the
  creator's `offer.countered` event. Therefore the cancel route
  has no production-reachable way to short-circuit NOT_LAST_TURN
  at preflight — any client-visible "last actor" is always the
  buyer themselves. canCancel is called without
  `lastEventActorRef`; the RPC's D15 system-actor-filtered guard
  (P0005) is the authoritative catch. The cancel preflight
  still catches INVALID_STATE and NOT_PARTY cleanly from the
  offer row.

D3 — Cancel D15 works under HTTP-per-txn semantics.
  Part A Draft 5 narrowed the inline DO-block from a triad
  (create → counter → cancel) to a pair (create → counter)
  because txn-pinned `now()` made the cancel assertion flaky
  inside a single migration txn. In B1, each RPC call runs in
  its own HTTP request — one request, one txn, `now()` advances
  cleanly — so the cancel last-turn ORDER BY works as intended.
  Part A §EXIT REPORT 15(b) cancel coverage lands in F12 as
  route integration tests, which is the correct level for this
  property.

D4 — HTTP error-status table (consumed by all 5 routes via F6).

  Postgres surface              → HTTP  code                 notes
  ─────────────────────────────── ───── ──────────────────── ─────
  P0001 retry_exhausted           503   LEDGER_CONTENTION   transient
  P0002 rate_limit                429   RATE_LIMIT          include Retry-After? (deferred; header not set in B1)
  P0003 invalid_state             409   INVALID_STATE       state-machine violation
  P0003 offer_not_found           404   OFFER_NOT_FOUND     id miss or RLS-hidden
  P0004 not_party                 403   NOT_PARTY           auth but not a party
  P0005 not_last_turn             409   NOT_LAST_TURN       cancel-specific
  P0006 not_system                403   NOT_SYSTEM          unreachable from B1 (expire is service-role)
  P0007 not_yet_expired           409   NOT_YET_EXPIRED     unreachable from B1
  P0008 actor_mismatch            401   ACTOR_MISMATCH      token impersonation
  (unknown SQLSTATE)              500   INTERNAL            opaque fallback

  TS-surface errors               → HTTP  code
  ─────────────────────────────── ───── ──────────────────
  requireActor FEATURE_DISABLED   404   FEATURE_DISABLED
  requireActor UNAUTHENTICATED    401   UNAUTHENTICATED
  requireActor ACTOR_NOT_FOUND    403   ACTOR_NOT_FOUND
  parseBody / parseParams fail    400   VALIDATION_ERROR
  validatePackComposition fail    400   VALIDATION_ERROR (create only)
  state.ts guard returns false    409   <reason-as-code>

D5 — No idempotency keys in B1. The accept route + Stripe
  straddle (Part B2) needs an idempotency-key contract (retry-
  safe PaymentIntent + RPC pairing). The non-accept routes in
  B1 are single-RPC atomic — a retry of the same create /
  counter / reject / cancel will either succeed idempotently at
  the application level (RPC rejects duplicate state transitions
  via P0003) or is genuinely a new event. Shipping idempotency
  in B1 would introduce a request-ID store concern that serves
  nothing in this slice.

D6 — GET party-only surface parity with "not found". The
  GET /api/offers/[id] endpoint returns 404 (NOT 403) for
  non-parties. Rationale: leaking the existence of an offer to
  a non-party lets an attacker enumerate offer IDs and confirm
  which buyer/creator pairs are in negotiation — a privacy
  leak. 404 also matches the behaviour when the row simply
  doesn't exist, so the two paths are indistinguishable from
  outside. This is the same party-surface-parity pattern
  applied elsewhere in the §8.4 actor-handles design.

D7 — Response shape is { data } / { error: { code, message,
  fields? } }. Applies to all 5 routes. Matches the existing
  src/lib/api/validation.ts VALIDATION_ERROR shape at the 400
  branch. DOES NOT match src/app/api/special-offer legacy
  envelope — the retiring surface stays on its legacy shape
  until 4B.

D8 — Create route derives buyerId from session, NOT body.
  See SECURITY section above. This is the one route where the
  buyer identity MUST come from authentication. Counter /
  reject / cancel look up existing offer rows and rely on the
  RPC party guard (P0004) to validate membership.

D9 — Logger discipline. Route handlers log ONE structured pino
  line per request at `info` on success, `warn` on 4xx, `error`
  on 5xx. Fields: { route, method, actorHandle, outcome,
  httpStatus, rpcKind?, eventId? }. NO payload contents, NO
  SQLERRM bodies, NO tokens, NO PII. The classifier's `raw`
  field is logged only at `error` severity and never serialized
  to the client. pino redaction (configured globally at
  src/lib/logger.ts) is the backstop.

D10 — Out-of-scope explicitly. No Stripe code, no
  PaymentIntent, no webhook handler, no accept route. Those
  are Part B2. No pages, no components, no list endpoint. Those
  are C1. No cron. That's D. Any file outside §DELIVERABLES
  ABSOLUTELY MUST NOT be touched — see ACCEPTANCE CRITERION 11.

D11 — state.ts lastEventActorRef param naming drift preserved.
  Part A Draft 4 locked state.ts `canCancel`'s third parameter
  as `lastEventActorRef?: string`, typed/documented as an
  auth.users.id UUID. The name carries a ledger-vocabulary
  connotation ("actor_ref") that diverges from the auth-domain
  type it carries. Draft 2 of B1 no longer passes the
  parameter (cancel preflight calls `canCancel({ offer,
  actorUserId })` only — see D2 / D12), so this drift becomes
  even more clearly orphaned tech debt: zero callers in the
  codebase pass it. Fixing it is still a non-trivial rename
  (touches state.test.ts and the parameter signature). Not a
  blocker; remains tidy backlog. A future consumer that needs
  a "last turn" signal will likely come from a server-side
  surface (Part D cron via service-role client, which CAN see
  all events) — at that point the rename + the server-side
  caller can land together.

D12 — No last-actor query in the cancel route.
  Draft 1 specified an inline `SELECT actor_ref FROM
  ledger_events ... WHERE actor_ref <> system_sentinel ORDER BY
  created_at DESC LIMIT 1` plus a handle→auth_user_id
  resolution, intended to feed canCancel's `lastEventActorRef`
  for a preflight NOT_LAST_TURN short-circuit. Draft 2 red-team
  found the design structurally dead under
  `ledger_events_party_select` RLS — the buyer's user-JWT
  client cannot see the creator's events, so the query always
  returns the buyer's own handle and the short-circuit is
  unreachable in production. The route now calls canCancel
  without `lastEventActorRef`, and NOT_LAST_TURN is caught
  exclusively by the RPC (P0005 → 409 via classifier). Two
  round-trips removed from every cancel request. See D2 scope
  exception.

D13 — GET /api/offers list endpoint deferred to C1.
  The Part A §9.2 full scope lists a list/inbox endpoint, but
  Part C1's `/vault/offers` page is the only consumer and
  will define the filter semantics (party, state, pagination).
  Shipping it speculatively in B1 would freeze a contract
  before we know the UI's needs.

D14 — isAuthWired() gate → 404 FEATURE_DISABLED.
  requireActor returns reason=FEATURE_DISABLED when the flag
  is off. All 5 routes in B1 map this to HTTP 404 with body
  { error: { code: 'FEATURE_DISABLED' } }. 404 (NOT 501 / 503)
  matches the FFF Sharing pattern established in 4A.1 — a
  flag-off surface is indistinguishable from a non-existent
  surface from the outside.

D15 — actor_ref on ledger_events IS the handle UUID, not
  auth_user_id. Part A migration's rpc_*_offer functions take
  `p_actor_ref uuid` and resolve it to an auth_user_id via
  actor_handles. The ledger_events.actor_ref column stores the
  HANDLE (per spec §7.1 and §8.4 — handles ARE the
  pseudonymisation layer). B1 route handlers pass
  `actor.handle` (NOT `actor.authUserId`) as `p_actor_ref` and
  as the payload `by_actor_id` field across all five routes.
  No route in B1 crosses handle ↔ auth_user_id boundaries on
  the TS side: `actor.authUserId` is used only against
  `OfferRow.buyer_id` / `creator_id` (state.ts guards);
  `actor.handle` is used only against the RPC parameter and
  payload surfaces. (Draft 1's cancel-route handle→authUserId
  resolution is gone per D12.)

ACCEPTANCE CRITERIA (all must hold)

 1. The 12 new files listed in §DELIVERABLES F1-F12 exist at
    their exact paths and line counts are reasonable (no
    zero-byte stubs, no 2000+ LoC blobs).

 2. The single edit to `src/lib/db/client.ts` (F13) adds
    `getSupabaseClientForUser` and preserves `getSupabaseClient`
    + `_resetSupabaseClient` + `isSupabaseConfigured`. Verify
    with `git diff src/lib/db/client.ts`.

 3. `bun run typecheck` clean.

 4. `bun run build` green. The Next.js App Router must generate
    route handlers for:
      POST /api/offers
      GET  /api/offers/[id]
      POST /api/offers/[id]/counter
      POST /api/offers/[id]/reject
      POST /api/offers/[id]/cancel
    Verify in the build output (Next.js prints the generated
    routes).

 5. `bun run test` → 1169 baseline + N new tests, all passing.
    Zero non-skip regressions. Report the new-test count N.
    Expected N ≈ 40-55 across the 5 route tests + rpc-errors
    (8 statuses × 5 routes partial coverage + classifier
    table-driven).

 6. `rg -n 'certif|immutab|tamper.proof'
       src/app/api/offers/
       src/lib/offer/rpc-errors.ts
       src/lib/db/client.ts`
    returns zero matches.

 7. `rg -n "from '@/lib/offer'|from '@/lib/auth/require-actor'|from '@/lib/db/client'|from '@/lib/api/validation'|from '@/lib/ledger/schemas'"
       src/app/api/offers/`
    shows imports ONLY from those five modules (plus
    `next/server`, `zod`, and `@/lib/logger`). Any other import
    is a scope breach.

 8. `rg -n 'stripe|STRIPE|PaymentIntent' src/app/api/offers/
       src/lib/offer/rpc-errors.ts src/lib/db/client.ts`
    returns zero matches — no Stripe leakage into B1.

 9. `rg -n 'isAuthWired|isEconomicV1UiEnabled'
       src/app/api/offers/`
    returns zero matches. requireActor is the only
    flag-aware surface the route handlers touch directly.
    (Draft 1 used `\|` which ripgrep treats as a literal pipe
    character — the regex matched no real symbol and silently
    passed. Draft 2 uses bare `|` for proper alternation.)

10. `rg -n 'getSupabaseClient\(' src/app/api/offers/`
    returns zero matches — user-facing routes MUST use
    `getSupabaseClientForUser`. The service-role client is
    reserved for system-side callers (Part D cron).

11. `git diff --stat 7e197cd..HEAD` shows changes ONLY in the
    13 files listed (12 new + `src/lib/db/client.ts`) plus the
    `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` file itself
    if it was committed in the same branch (which it must be
    per §D). Any other path in the diff is a scope breach.

12. Single commit, no squash, no amend, on feat/p4-economic-cutover.

13. D1 (user-JWT client) and D4 (error-status table) are
    reflected in the module headers of `src/lib/db/client.ts`
    (updated) and `src/lib/offer/rpc-errors.ts` (new).

14. Preconditions 3, 5, 6, 8, 15, 16, 17 are explicitly cited
    in exit-report §1 with their PASS/FAIL determination and
    the actual command output that confirmed it.

15. Preconditions 12 (baseline 1169+10), 13 (typecheck), 14
    (build) each carry a cited tail of their command output in
    exit-report §1.

COMMIT
Single concern-scoped commit. Template:

  feat(offer): P4 concern 4A.2 Part B1 — non-accept offer routes

  Five non-accept offer route handlers on top of Part A's RPC
  catalogue, plus the TS-side SQLSTATE error classifier and a
  user-JWT Supabase client helper.

  * src/app/api/offers/route.ts — POST create; derives buyerId
    from session (D8), validates pack composition, snapshots
    platform_fee_bps per §F16 (the RPC owns the snapshot; this
    route passes the current bps and the DDL enforces the lock).

  * src/app/api/offers/[id]/route.ts — GET single offer (party-
    only surface; non-party returns 404, not 403; D6).

  * src/app/api/offers/[id]/counter/route.ts — POST counter;
    preflight canCounter, inline buildOfferCounteredPayload,
    RPC is authoritative (D2).

  * src/app/api/offers/[id]/reject/route.ts — POST reject;
    enum-restricted reasonCode; preflight canReject.

  * src/app/api/offers/[id]/cancel/route.ts — POST cancel;
    buyer-only; preflight catches INVALID_STATE + NOT_PARTY
    only (RLS on ledger_events makes route-side NOT_LAST_TURN
    unreachable — the RPC's D15 guard is authoritative via
    P0005). See D2 / D12.

  * src/lib/offer/rpc-errors.ts — scoped SQLSTATE + SQLERRM
    classifier for P0001-P0008. Pattern mirrors
    src/lib/ledger/writer.ts L133-158 (SQLSTATE-only matching
    is unsafe).

  * src/lib/db/client.ts — added getSupabaseClientForUser for
    user-JWT RPC access; service-role getSupabaseClient
    preserved for Part D cron.

  * Route integration tests at src/app/api/offers/**/__tests__/*
    + src/lib/offer/tests/rpc-errors.test.ts — table-driven
    per route + per error kind; all mock the Supabase client at
    the module seam.

  Decision D1 (user-JWT client via anon key + Bearer) resolves
  the service-role auth.uid() gap identified during B1 audit.
  D2 / D12 scope the cancel preflight to INVALID_STATE +
  NOT_PARTY only, after the Draft 2 red-team found that
  `ledger_events_party_select` RLS makes route-side
  NOT_LAST_TURN short-circuits structurally unreachable.
  D3 (HTTP-per-txn semantics) closes Part A §EXIT REPORT 15(b)
  open item on cancel coverage via F12 route integration tests.

  Directive: docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md
  Builds on: 7e197cd
  Unblocks: 4A.2 Part B2 (accept route + Stripe straddle)

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1-5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:

 1. Preconditions check — each of #1-17 with PASS/FAIL + a line
    explaining why. Cite the actual HEAD SHA, the output of
    `git diff --name-only 7e197cd..HEAD`, the Part A baseline
    test tail (1169 passed + 10 skipped), migration 20260421000011
    line count (must be 1151), and the `ls src/lib/offer` output
    (must list exactly 6 .ts files + tests/).

 2. File list — every file created / edited with line counts.
    Must be 12 new + 1 edit = 13 files total.

 3. Route handlers — paste the exported handler signature lines
    from each of F1-F5 (one line per handler). Confirm each
    uses requireActor + parseBody/parseParams +
    getSupabaseClientForUser + classifyRpcError (for the four
    POST routes) or the party-filter read (for F2 GET).

 4. classifyRpcError signature + exhaustive-enum confirmation.
    Paste the function body so the scoped SQLSTATE+SQLERRM match
    discipline is visible.

 5. getSupabaseClientForUser body. Confirm the anon key is used
    and the Authorization header is set per-request.

 6. Decisions log — confirm D1-D15 from §A were honoured as
    written OR cite where you deviated and why.

 7. Test summary — per-file `it` count, total N, no
    regressions. Cite the tail of `bun run test`.

 8. Acceptance checklist — each of criteria 1-15 with
    PASS/FAIL.

 9. Typecheck output — tail of `bun run typecheck`.

10. Build output — tail of `bun run build` confirming the five
    route handlers appear in the generated routes list.

11. Scope-breach lint — paste the output of each `rg` command
    from acceptance criteria 6-10 (expect empty).

12. git diff --stat 7e197cd..HEAD — paste. Every path must be
    listed in §DELIVERABLES or be the directive file.

13. Commit SHA.

14. Open items — anything warranting founder review before
    Part B2. Must include AT LEAST:
    (a) Any deviation from D1 (the user-JWT client pattern).
        None expected; flag if you hit a library / version
        surprise.
    (b) Whether the Retry-After header on 429 responses was
        added (deferred explicitly; flag if you added it for
        any reason).
    (c) Any Postgres error surfaced during testing that wasn't
        in the P0001-P0008 catalogue (indicates a Part A bug).
    (d) The state.ts lastEventActorRef naming-drift open item
        (D11) remains on the tidy backlog.
    (e) Confirmation that no route test requires a live
        Supabase — all mock at the module seam.

15. Suggested next directive — "proceed to P4_CONCERN_4A_2_B2"
    (accept route + §8.5 Stripe PaymentIntent straddle) or
    "pause for founder review of X" if you spotted anything
    material.
```

---

## B — Scope confirmation

Part B1 is the **second of six directives** (A → B1 → B2 → C1 → C2 → D) that together land design-lock §9.2's offer surface.

**Part B1 (this directive) covers:**

- Five non-accept offer route handlers: `POST /api/offers`, `GET /api/offers/[id]`, `POST /api/offers/[id]/counter`, `POST /api/offers/[id]/reject`, `POST /api/offers/[id]/cancel`.
- One SQLSTATE + SQLERRM error classifier (`src/lib/offer/rpc-errors.ts`) covering P0001-P0008 with scoped matching discipline that mirrors `src/lib/ledger/writer.ts`.
- One extension to `src/lib/db/client.ts` adding `getSupabaseClientForUser(accessToken)` using anon key + Authorization Bearer header so RPC `auth.uid()` resolves inside SECURITY DEFINER bodies.
- Vitest route-level integration tests per route + unit tests for the classifier, all mocking Supabase at the module seam.

**Part B1 does NOT cover:**

- The accept route (`POST /api/offers/[id]/accept`) and the §8.5 Stripe PaymentIntent straddle wrapper. Part B2.
- The list/inbox endpoint (`GET /api/offers` without id). Part C1 alongside the `/vault/offers` page.
- Pages (`/vault/offers`, `/vault/offers/[id]`) and components (`OfferInboxList`, `OfferCard`, `OfferDetailView`, `FeeTransparencyPanel`, `ExpirationSelector`, shared `EventTrailViewer`, `StateBadge`, `ActorLabel`). Part C1.
- Composition- and rights-heavy components (`PackComposer`, `OfferCounterEditor`, `OfferPreviewPanel`, `RightsTemplatePicker`) plus `AssetRightsModule.tsx` `OfferModal` REWRITE. Part C2 — gated on counsel-finalised template bodies.
- Offer expiration cron (Supabase Edge Function calling `rpc_expire_offer`). Part D.
- Idempotency-key plumbing. Part B2 owns it (Stripe-straddle territory).
- Any change to Part A's migration, `src/lib/offer/*`, `src/lib/auth/require-actor.ts`, `src/lib/ledger/*`, or `src/lib/api/validation.ts`.

**Part B1 closes these upstream open items:**

- `P4_CONCERN_4A_2_DIRECTIVE.md` §EXIT REPORT **15(b)** — cancel coverage via route integration tests. F12 covers this through preflight (state + party) + RPC-mocked classifier paths (NOT_LAST_TURN, race-INVALID_STATE).
- Audit-identified gap: service-role Supabase client cannot satisfy the P0008 `auth.uid()` guard on user-facing RPCs. Resolved by F13 (`getSupabaseClientForUser`) per D1.
- Draft 2 red-team gap: route-side cancel preflight depended on `ledger_events` reads that RLS structurally hides. Resolved by D2 / D12 (cancel preflight scoped to INVALID_STATE + NOT_PARTY; RPC owns NOT_LAST_TURN).

**Part B1 does NOT close:**

- `P4_CONCERN_4A_2_DIRECTIVE.md` §EXIT REPORT **15(a)** rights-template counsel-review status — stays open until Part C2.
- state.ts `lastEventActorRef` naming drift — deferred to a tidy concern per D11.
- `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT **10(b)** canonicalisation — carried forward, not blocking.
- `P4_CONCERN_4A_1_DIRECTIVE.md` §EXIT REPORT **10(d)** for assignment `rights_diff` and dispute `evidence_refs` — deferred to 4A.3 / 4A.4.

---

## C — Red-team pass

Six traps I considered and ruled on before writing the directive. Calling them out so there's no retro-fit later.

**1. "Why not use the existing service-role `getSupabaseClient` for the RPCs? It already bypasses RLS."**

Bypassing RLS is not the blocker. The RPC's actor-auth guard at P0008 (`auth_user_id ... IS DISTINCT FROM auth.uid()`) compares the handle-resolved auth_user_id against Postgres's `auth.uid()` function. `auth.uid()` reads the JWT from the `request.jwt.claims` session variable, which is set by the Supabase client based on its Authorization header. The service-role client sends `Authorization: Bearer <service-role-key>`, so `auth.uid()` returns NULL — and every user-facing RPC trips P0008. The two options are:

  (i) Route through a user-JWT client that forwards the caller's token (D1 — what B1 does).
  (ii) Run the RPC under service-role and `SET LOCAL request.jwt.claims = <synthesised>` before the rpc() call.

Option (ii) duplicates Supabase auth logic in TS code and fights the abstraction — the Supabase-JS client already knows how to forward tokens correctly. Option (i) is the canonical pattern and keeps Postgres as the authoritative boundary. Rejected (ii) up front.

**2. "Why run the state.ts preflight at all if the RPC is authoritative?"**

Two reasons. First, the preflight catches 409 INVALID_STATE / 409 NOT_PARTY without a Postgres round-trip, which matters under contention (a hot thread with many refresh-polling clients hitting a locked RPC). Second, the preflight lets us return a cleaner error vocabulary on the common cases — the RPC surfaces a SQLSTATE + SQLERRM pair that we classify; the preflight gives us the guard's `reason` string directly with no classification step.

The preflight is NOT load-bearing for correctness — tests F10(g), F11(g), F12(f), F12(h) explicitly cover the case where the preflight passes but the RPC returns the failure SQLSTATE (a concurrent transition raced between preflight read and RPC call). In that path the RPC result is surfaced; the preflight's "allowed" result does not override Postgres.

Scope exception for cancel: NOT_LAST_TURN cannot be caught at preflight on the user-JWT client because `ledger_events_party_select` (migration 20260421000004 L613-622) only shows the buyer their own events — the creator's "last turn" is invisible. The cancel preflight catches INVALID_STATE and NOT_PARTY only; the RPC's D15 guard is the authoritative catch for NOT_LAST_TURN. See D2 / D12.

**3. "Why not ship the GET list endpoint in B1 to unblock C1?"**

Because the list endpoint's contract (filters, pagination, sort, party scoping) depends on what the C1 page needs, and C1 is the only consumer. Shipping it speculatively means either over-engineering (cursor pagination, multi-filter param parsing, facet counts — none of which C1 may need) or under-specifying (a minimal endpoint that C1 then asks to extend in a follow-on, fragmenting the "offer list" surface). The single-offer GET in F2 covers the detail-page read path cleanly; C1 can co-design the list endpoint with its consuming page. This is the same logic Part A applied when deferring the accept route to B2.

**4. "Why not inline the last-actor query in the cancel route?"**

Draft 1 DID inline it, following the D15 system-actor-filter pattern from the Part A RPC. The Draft 2 red-team found the query's output unusable from a user-JWT client: `ledger_events_party_select` RLS filters the buyer's view to events they themselves emitted, so the query always returns the buyer's own handle — never the creator's. The resulting `lastEventActorRef` is structurally guaranteed to equal the buyer's `authUserId`, meaning canCancel's NOT_LAST_TURN check on the route side can never fire. The RPC (which runs SECURITY DEFINER with BYPASSRLS via its owner role) CAN see all events and catches the real case via P0005. Inlining the query in B1 adds two round-trips for no production-reachable signal. Draft 2 removes it; cancel is now one RPC call, full stop.

**5. "Why 404 instead of 403 on non-party GET? The user IS authenticated."**

Party-surface parity with "not found" prevents offer-ID enumeration. An authenticated attacker could otherwise probe offer IDs until they get a 403 instead of a 404 and confirm that a particular pair (buyer, creator) is in negotiation — a privacy leak even before any field is disclosed. This is the same pattern the `actor_handles` design uses to prevent probing which auth_user_ids have handles (§8.4 tombstone + never-exposed invariant). The 404 masks the underlying 403 without changing the authorisation semantics.

**6. "The state.ts `lastEventActorRef` naming drift is a real bug — why not fix it in B1?"**

It's tech debt, not a bug, and Draft 2 leaves it even more isolated: B1 no longer passes the parameter at all (Draft 2's cancel preflight calls `canCancel({ offer, actorUserId })` only). Fixing the rename now would touch state.ts + state.test.ts for zero callers. The natural moment to land it is when Part D's expiration cron — which runs server-side under the service-role client and CAN see all events — needs a similar last-turn read; at that point the rename and the new caller can land together. Flagged as D11.

---

## D — Dispatch readiness

Checklist before paste:

- [ ] Founder reviewed §A directive body and verdicted D1 (user-JWT client via anon key + Bearer header). This is the one load-bearing architectural decision in B1.
- [ ] Founder verdicted D2 (preflight state.ts + RPC-authoritative, with cancel NOT_LAST_TURN scope exception) and agrees the race paths in tests F10(g), F11(g), F12(f), F12(h) cover the preflight-override semantics.
- [ ] Founder verdicted D4 (error-status HTTP table). Any change here requires classifier + route + test updates in lockstep.
- [ ] Founder verdicted D6 (GET returns 404 on non-party — NOT 403).
- [ ] Founder verdicted D8 (POST /api/offers derives buyerId from session — NOT body).
- [ ] Founder verdicted D13 (list endpoint deferred to C1, not shipped speculatively).
- [ ] Founder verdicted D11 (state.ts `lastEventActorRef` naming drift preserved; rename is tidy backlog).
- [ ] Founder reviewed the six-part split (A → B1 → B2 → C1 → C2 → D) and confirms the sequence.
- [ ] Part A commit `7e197cd` is pushed to origin `feat/p4-economic-cutover` and remains HEAD on that branch (modulo this directive file).
- [ ] This directive committed to `docs/audits/` on the same branch BEFORE dispatch. Precondition 3 allows the directive commit on top of `7e197cd`.
- [ ] Fresh Claude Code session, working directory is the repo root, no other work in progress.

When all boxes clear, paste §A verbatim into Claude Code. Wait for the exit report. Do not accept an implicit "all looks good" — demand the terminal-paste-ready report per §EXIT REPORT.

---

## E — Revision history

- **2026-04-21 — Draft 1.** Drafted. Second slice of design-lock §9.2 (offer surface). Covers the five non-accept offer route handlers (`POST /api/offers`, `GET /api/offers/[id]`, counter, reject, cancel), the P0001-P0008 SQLSTATE classifier, and the user-JWT Supabase client helper. Builds on Part A commit `7e197cd`. Closes Part A §EXIT REPORT 15(b) (cancel route integration coverage) and resolves the audit-identified service-role `auth.uid()` gap via D1. Parts B2 (accept + Stripe straddle), C1 (pages + lib-heavy components + list endpoint), C2 (composition- and rights-heavy components + AssetRightsModule rewrite, counsel-gated), and D (expiration cron) follow as separate directives after each exit report clears.

- **2026-04-21 — Draft 2.** Red-team corrections against the live RLS surface and three drafting bugs. Material change: F5 cancel route no longer runs an inline `ledger_events` query + handle→auth_user_id resolution — Draft 1's design was structurally dead under `ledger_events_party_select` (migration 20260421000004 L613-622), which restricts a buyer's user-JWT view to events they themselves emitted. Cancel preflight now catches INVALID_STATE + NOT_PARTY only; RPC P0005 is the authoritative NOT_LAST_TURN catch. Cascading edits: D2 (scope exception added), D11 (state.ts naming drift now orphaned tech debt), D12 (rewritten — no inline query), D15 (cancel handle-resolution paragraph removed), IDENTITY CONTRACT bullet on `lastEventActorRef` rewritten, F12(f)/(g)/(h)/(i) reframed (preflight short-circuits removed where unreachable, RPC-mocked classifier paths added), commit-template cancel bullet revised. Non-cancel changes: Acceptance Criterion 9 regex fix (`\|` → `|`; the original was a literal-pipe match that silently passed); F1 step b explicitly directs the implementer to `OfferCreatedPayloadSchema.shape.target_type` (TargetTypeSchema is private); F2 step f annotated as belt-and-braces under RLS. §C trap #2, trap #4, trap #6 updated to match. Two DB round-trips removed from every cancel request. SCOPE, preconditions, F1-F4 / F6-F11 / F13, D1, D3-D10, D13-D14, six-part sequence — unchanged.
