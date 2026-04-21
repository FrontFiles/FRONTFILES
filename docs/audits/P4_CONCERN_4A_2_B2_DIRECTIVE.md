# P4 Concern 4A.2 — Part B2 Directive

**Stripe accept surface.** The acceptance leg of the offer lifecycle: `POST /api/offers/[id]/accept`, the `rpc_accept_offer_commit` RPC, the `offer-accept.ts` orchestrator, the Stripe client + error classifier, and the retirement of the legacy `/api/special-offer/*` mock surface.

---

## §REVISIONS

| Rev | Origin | Change |
|---|---|---|
| R1 | Prompt 1 red-team | Pre-flight audit item 6 line-range corrected from `L107-115` to `L100-106` for `OfferAcceptedPayloadSchema`; payload shape inlined (strict `{v, by_actor_id}`). |
| R2 | Prompt 1 red-team | F7 authorised to TIGHTEN the existing permissive `canAccept` to buyer-only. AC16 clarified accordingly. Rationale: a permissive preflight would let a creator trigger a Stripe PI create before the RPC rejects them — wasted API call + forensic trace on the Stripe dashboard. |
| R3 | Prompt 1 red-team | `bun test` replaced by `bun run test` throughout. `bun test` triggers Bun's native runner, which bypasses `vitest.config.ts` env-boot setup and produces spurious failures. `bun run test` → `vitest run` is the canonical command. |
| R4 | Prompt 1 red-team | F5 RPC body simplified: unused `DECLARE` locals `v_creator_id` and `v_target_type` dropped; UPDATE `RETURNING` narrowed to `buyer_id INTO v_buyer_id`. |
| R5a | Prompt 2 execution | F5 RPC body aliases the helper's actual OUT columns: `SELECT r.out_event_id, r.out_event_hash INTO ...`. The directive draft wrote `r.event_id, r.event_hash` — that would not compile. Ground truth: `20260421000011_rpc_offer_business.sql` L122 `RETURNS TABLE (out_event_id uuid, out_event_hash text)`. |
| R5b | Prompt 2 execution | F1 §3 REVOKE/GRANT narrowed to match the actual Part A pattern: `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated`. The directive draft said "REVOKE FROM PUBLIC, anon, authenticated" — that's paranoid overlay, not what `rpc_counter_offer` at `20260421000011` L877-882 does. Mirror Part A verbatim. |
| R6 | Prompt 3 execution | F3's apiVersion pin is the literal string `'2026-03-25.dahlia'`, set in code verbatim — not read dynamically. In `stripe@22.0.2`, `Stripe.DEFAULT_API_VERSION` as a top-level class static returns `undefined`; the SDK's actual default lives in `node_modules/stripe/cjs/apiVersion.d.ts` as `ApiVersion = "2026-03-25.dahlia"`. F2 recorded: `stripe@22.0.2` (SDK), `2026-03-25.dahlia` (API). These are B2's freeze point. |
| R7 | Prompt 6 pre-flight | F4's unsupported-currency branch RETURNS `{ ok: false, kind: 'preflight', httpStatus: 400, code: 'UNSUPPORTED_CURRENCY', message: ... }` — does NOT throw. This reconciles F4 step 4's "throw on unsupported currency" language with F4's own "orchestrator does not throw" invariant; the invariant wins. The `preflight` discriminant in F4's result union now has a real use (previously it was speculative, since route-level canAccept runs before acceptOffer). |
| R8 | Prompt 6 pre-flight | F4 does NOT modify `src/lib/offer/rpc-errors.ts`. AC16 freezes B1 files outside state.ts. The 23505 double-accept race (if it somehow bypasses the optimistic UPDATE) falls through classifyRpcError's unknown branch → surfaces as INTERNAL + Sentry alert. Acceptable for B2: the race is astronomically rare and the reconcile-fail surface already exists for catastrophic scenarios. F5's inline comment at the assignments INSERT is informational, not an authorisation to extend rpc-errors.ts. |
| R9 | Prompt 7 post-F9 red-team | F5 migration's three non-actor RAISE EXCEPTIONs were missing `USING ERRCODE` clauses. PL/pgSQL defaults to SQLSTATE `P0001` when unset; the B1 classifier (rpc-errors.ts) dispatches `offer_not_found` + `invalid_state` on `P0003` (disambiguated by SQLERRM prefix) and `not_party` on `P0004`. Without the clauses, all three raises would emit P0001 at runtime and be mis-classified as `unknown` → 500 INTERNAL. Added `USING ERRCODE = 'P0003'` (offer_not_found, invalid_state) and `USING ERRCODE = 'P0004'` (not_party). One-line inline comment above each raise names the classifier branch it feeds. The L154 actor_mismatch raise was already correct — untouched. SQLERRM strings unchanged (classifier substring match depends on literal `'offer_not_found'` / `'invalid_state'` / `'not_party'` prefixes). Files: `supabase/migrations/20260421000012_offer_accept_stripe.sql`. |
| R10 | Prompt 7 post-F9 red-team | F4's `OfferAcceptResult.ok: true` success branch omitted `paymentIntentId` and `clientSecret`. F6's route handler needs `clientSecret` to return to the browser so the client-side `stripe.confirmCardPayment()` can complete the charge. Extended the success union with both fields (`clientSecret: string`, non-nullable). Added a defensive null-check on `pi.client_secret` in F4 step 6: if Stripe returns a PI without one (invariant violation; always-present on fresh PIs created without `confirm:true`), the orchestrator routes to `kind: 'stripe_create'`, HTTP 502, `STRIPE_UNAVAILABLE`, with a pino `logger.error` + `Sentry.captureMessage({ level: 'error' })` (not `'fatal'` — DB untouched, PI orphaned not charged, no reconcile needed). F9 Case 1 happy-path assertion extended to match the 7-field success shape; explicit `.toBe` checks added for `paymentIntentId` + `clientSecret`. Files: `src/lib/offer/offer-accept.ts`, `src/lib/offer/tests/offer-accept.test.ts` (Case 1 only). |
| R11 | Prompt 9 preamble post-F6 red-team | F6 preflight `not_party` HTTP status is 403, not 409 as the directive §F6 error-surface table listed. R2 tightened accept to buyer-only, making `not_party` a role-boundary identity check rather than a state-adjacent denial. The B1 classifier downstream dispatches `NOT_PARTY → 403` for the same condition when the RPC raises it, so preflight + RPC surface coherently at the HTTP layer. B1 counter's uniform 409/409 preflight is a carry-over from counter's either-party semantics and does not transfer to accept's buyer-only shape. §F6 error-surface table updated to `not_party → 403 NOT_PARTY` and `invalid_state → 409 INVALID_STATE`. Files: `docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md`. |
| R12 | Prompt 11 audit + Prompt 12 formalization | F11 deferred to follow-up concern 4A.2.C per D13 UI-rewrite trigger. Caller audit captured in §F11-AUDIT. |

---

## §METADATA

| Key | Value |
|---|---|
| Branch | `feat/p4-economic-cutover` |
| Predecessor commit | `ec694ab` (B1 — five non-accept routes + classifier + user-JWT client) |
| Predecessor directive | `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` |
| Governing spec | `docs/specs/ECONOMIC_FLOW_v1.md` §8.2, §8.5, §F7, §F16 |
| Governing design lock | `docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §9.2 |
| Target commit message | `feat(p4/4A.2/B2): Stripe accept surface — PI straddle + dual-row emit + special-offer retire` |
| Ships to | `main` via PR |

---

## §SCOPE

### In-scope

Eleven deliverables (F1-F11 below). Implementation surface is deliberately narrow: one new route, one new RPC, one new library module, one new migration, one new Stripe client + classifier, tests, and the deletion of the legacy mock surface.

### Out-of-scope (hard boundary with 4A.3)

The following are explicit NO-OPs for B2. Any change to these files or surfaces is a scope violation and must be backed out before PR:

- `src/lib/assignment/*` — assignment domain logic (state transitions, delivery, cashout). B2 inserts the assignment row + emits `assignment.created` ONLY. Zero further assignment surface.
- Any `assignment.*` event beyond `assignment.created`.
- `src/app/api/stripe/**` — the webhook surface. Does not exist today; does not get created by B2.
- Stripe Connect split transfers, `transfer_data`, `on_behalf_of`, `application_fee_amount`. B2's PI create targets the platform balance ONLY.
- `admin_reconciliation_jobs` table, admin UI, reconciliation state machine.
- AssetRightsModule rewrite (separate 4A.2 concern, not B2).
- Dispute surface (`src/lib/dispute/*`), webhook canonicality, auto-accept cron (`rpc_expire_offer` — Part D).
- Any change to B1's five route handlers, the `rpc-errors.ts` classifier, `db/client.ts`, `state.ts`, or `composer.ts`. B2 reads these; it does not mutate them.

### Non-goals

- Perfect multi-currency support. B2 ships with the working assumption that `currency.minor_unit = 100` (USD-like). JPY/KWD support is a 4A.3 or later refinement; flag with a TODO comment and surface the constraint via a runtime check that throws on unsupported currencies.
- Retry logic on the orchestrator side. The only retry lives in `_emit_offer_event_with_retry` at the DB layer. The orchestrator surfaces the first failure, applies the void-on-rollback path if applicable, and returns.

---

## §PRE-FLIGHT AUDIT

Read these files BEFORE writing any code. Each is a reference or contract this directive assumes you have inspected:

1. `docs/specs/ECONOMIC_FLOW_v1.md` §8.2 (L165-246 — offer/assignment event catalogues), §8.5 (L249-313 — transition atomicity + Stripe charge ordering + dual-thread emit), §F7, §F16.
2. `docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` §9.2 (4A.2 scope), §10 (open questions), §11 (acceptance criteria).
3. `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` — governing predecessor. Every B2 route pattern mirrors B1.
4. `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`:
   - L48-57 `assignment_state` ENUM (first value = `'active'` — the initial state).
   - L150-157 `assignments` table (six columns: `id, offer_id UNIQUE, state, delivered_at, created_at, updated_at`). No fee/composition/rights columns — those stay on `offers` and are read-through.
   - L224+ `ledger_events` table.
5. `supabase/migrations/20260421000011_rpc_offer_business.sql`:
   - L86-220 `_emit_offer_event_with_retry` — polymorphic helper. First argument is `p_thread_type text`. B2 calls it twice per successful accept: once with `'offer'`, once with `'assignment'`. The "offer" in the function name is legacy; the function accepts any thread_type.
   - L232-240 RPC header pattern (header comment + signature + RAISE EXCEPTION conventions).
6. `src/lib/ledger/schemas.ts`:
   - L100-106 `OfferAcceptedPayloadSchema` — strict `{v: literal(1), by_actor_id: uuid}`. Only two fields. F4's orchestrator builds exactly `{v: 1, by_actor_id: <actor_handle UUID>}` — no Stripe PI id, no amount, no currency in the payload.
   - L133-141 `AssignmentCreatedPayloadSchema` — frozen `{v, offer_id, target_type, expected_piece_count}`, strict.
7. `src/lib/offer/rpc-errors.ts` (B1, 214 LoC) — the pattern F8 mirrors for Stripe errors.
8. `src/lib/db/client.ts` (B1, 168 LoC) — the dual-mode pattern F3 mirrors for the Stripe client.
9. `src/lib/env.ts` L99-103 — Stripe env slots already reserved, all optional. F3 must preserve dual-mode (env absent → Stripe-disabled throw inside the client factory, not at import time).
10. `src/lib/offer/state.ts` — the `canAccept` guard's current implementation. Confirm it already exists or extend it to mirror `canCounter`/`canCancel` shape.
11. `src/app/api/offers/[id]/counter/route.ts` (B1, 314 LoC) — the mutation-route pattern F6 mirrors.
12. `src/app/api/special-offer/**` — the legacy mock surface F11 deletes. Audit `src/app/`, `src/components/`, `src/lib/` for any caller BEFORE writing F11.

If any of items 4-6 contradicts this directive's stated facts, STOP and surface the contradiction. Do not paper over.

---

## §DELIVERABLES

Eleven files land in B2. Each F# below specifies location, shape, and the invariants Claude Code must honour.

### F1 — Migration: `20260421000012_offer_accept_stripe.sql`

Single migration that adds both the payment linkage columns AND the accept RPC. Atomic, single-concern, matches the Part A pattern (`20260421000011` is one file for the whole offer RPC catalogue).

File: `supabase/migrations/20260421000012_offer_accept_stripe.sql`

Structure, top to bottom:

1. Header comment block (mirror `20260421000011` format). State: which concern, which spec sections, what this file adds, what invariants hold.
2. `ALTER TABLE public.offers ADD COLUMN stripe_payment_intent_id text NULL;`
3. `ALTER TABLE public.offers ADD COLUMN stripe_idempotency_key text NULL;`
4. Partial unique indexes:
   ```sql
   CREATE UNIQUE INDEX offers_stripe_pi_id_uniq
     ON public.offers (stripe_payment_intent_id)
     WHERE stripe_payment_intent_id IS NOT NULL;

   CREATE UNIQUE INDEX offers_stripe_idem_key_uniq
     ON public.offers (stripe_idempotency_key)
     WHERE stripe_idempotency_key IS NOT NULL;
   ```
5. `COMMENT ON COLUMN` for each new column — one sentence stating purpose and §8.5 reference.
6. `CREATE OR REPLACE FUNCTION public.rpc_accept_offer_commit(...)` — see F5 for the full signature and body contract.
7. `COMMENT ON FUNCTION` for the new RPC — same format as `rpc_counter_offer` et al.
8. `REVOKE ALL ON FUNCTION` from PUBLIC, anon, authenticated. `GRANT EXECUTE` to the appropriate role (mirror `rpc_counter_offer`).
9. No RLS policy changes. The new columns inherit `offers`' existing RLS (`offers_party_select`, etc. from migration 20260421000004). The RPC runs SECURITY DEFINER and bypasses RLS by construction.

Rollback considerations: the migration is forward-only. Down-migration is out of scope for Frontfiles (migration 20260421000004 pattern). Do NOT generate a `.down.sql` file.

### F2 — Install Stripe SDK

`bun add stripe` (no version pin — resolve to the current stable).

Record the resolved version in the exit report. Update `package.json`. Do NOT commit `bun.lock` changes separately; let the install produce the lockfile update in the same commit.

Pin the API version inside F3's client init to the SDK's **default** for the resolved major (read from `Stripe.DEFAULT_API_VERSION` or the SDK's types; do NOT invent a version string). Recording the API version in a comment above the client init is mandatory — this is the freeze point for B2's Stripe surface.

### F3 — Stripe client singleton

File: `src/lib/stripe/client.ts`

Mirror the pattern in `src/lib/db/client.ts`. Expose:

```ts
import Stripe from 'stripe'
import { env } from '@/lib/env'

let _client: Stripe | null = null

export function getStripeClient(): Stripe {
  if (_client) return _client
  const key = env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'Stripe not configured. Set STRIPE_SECRET_KEY.',
    )
  }
  _client = new Stripe(key, {
    // apiVersion pinned to the SDK's default for the installed major.
    // Resolved at F2 install time (stripe@22.0.2) from
    // node_modules/stripe/cjs/apiVersion.d.ts → ApiVersion constant.
    // The top-level static `Stripe.DEFAULT_API_VERSION` is undefined
    // in v22, so we pin the literal string verbatim here (R6). Any
    // future SDK major upgrade MUST re-run this resolution and bump
    // the literal in the same commit.
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
  })
  return _client
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY)
}

export function _resetStripeClient(): void {
  _client = null
}
```

Top-of-file header comment (mirror `db/client.ts`): explain dual-mode contract — env absent → callers short-circuit via `isStripeConfigured`, the factory throws if called without env. Explain why module-level singleton is safe (stateless SDK).

Do NOT log or export the secret key anywhere.

### F4 — Accept orchestrator

File: `src/lib/offer/offer-accept.ts`

The straddle's command centre. Owns: idempotency-key derivation, PI create, inner RPC call, void-on-rollback, reconcile-fail structured log.

Export signature (R10-revised — success branch carries PI id + client secret):

```ts
export type OfferAcceptResult =
  | {
      ok: true
      paymentIntentId: string                  // R10 — from PI create
      clientSecret: string                     // R10 — non-nullable; F6 returns this to the browser
      offerEventId: string
      offerEventHash: string
      assignmentId: string
      assignmentEventId: string
      assignmentEventHash: string
    }
  | {
      ok: false
      kind:
        | 'preflight'           // offer state / party check failed before PI
        | 'stripe_create'       // PI create failed OR fresh PI had null client_secret (R10)
        | 'db_commit_voided'    // inner RPC failed, PI voided cleanly
        | 'db_commit_reconcile' // inner RPC failed AND void failed — reconcile needed
        | 'unknown'
      httpStatus: number
      code: string
      message: string
    }

export async function acceptOffer(args: {
  supabase: SupabaseClient       // user-JWT client, B1 pattern
  stripe: Stripe                 // F3 client
  actorHandle: string            // actor_handles.handle
  actorAuthUserId: string        // actor.authUserId — buyer must match offer.buyer_id
  offer: OfferRow                // pre-loaded row (route did this)
  expectedPieceCount: number     // from asset-pack item count OR brief-pack slot count
}): Promise<OfferAcceptResult>
```

Internal flow, in this exact order:

1. Build `idempotencyKey = ${offer.id}:accept`. Store as a local const; reuse for PI create AND void.
2. Build `offerAcceptedPayload` per `OfferAcceptedPayloadSchema` (verify shape during pre-flight audit step 6).
3. Build `assignmentCreatedPayload` per `AssignmentCreatedPayloadSchema`: `{v: 1, offer_id: offer.id, target_type: offer.target_type, expected_piece_count}`.
4. Compute `amountInMinorUnits`. Spec currently assumes `minor_unit = 100`. Throw on any currency outside `['USD', 'EUR', 'GBP']` with a clear error — 4A.3 extends this with a proper currency-table abstraction. Formula: `Math.round(offer.gross_fee * 100)`. Guard against NaN / non-finite.
5. Call `stripe.paymentIntents.create({...}, { idempotencyKey })`. Parameters:
   - `amount: amountInMinorUnits`
   - `currency: offer.currency.toLowerCase()`
   - `capture_method: 'automatic'`
   - `metadata: { offer_id, buyer_id: offer.buyer_id, creator_id: offer.creator_id, actor_handle: actorHandle, event_type: 'offer.accepted' }`
   - No `destination`, no `transfer_data`, no `on_behalf_of`, no `application_fee_amount`.
6. On `stripe.paymentIntents.create` throw → classify via F8's `classifyStripeError`. Return `{ ok: false, kind: 'stripe_create', ...classified }`. Offer state untouched.
   - (R10) On PI create success BUT `pi.client_secret` is null → `logger.error` + `Sentry.captureMessage({ level: 'error' })` + return `{ ok: false, kind: 'stripe_create', httpStatus: 502, code: 'STRIPE_UNAVAILABLE', message: ... }`. This is a Stripe invariant violation (a fresh PI without `confirm:true` must carry a client_secret), but the DB is untouched, so no reconcile is needed — just surface as 502 so the route returns a retriable error.
7. On PI success → capture BOTH `paymentIntent.id` AND `paymentIntent.client_secret` (R10). Call `supabase.rpc('rpc_accept_offer_commit', {...})`.
8. On RPC error → attempt void:
   ```ts
   try {
     await stripe.paymentIntents.cancel(paymentIntentId, undefined, { idempotencyKey })
   } catch (voidErr) {
     logger.error({
       route: 'offer-accept',
       event: 'accept.reconcile_needed',
       severity: 'critical',
       offerId: offer.id,
       buyerId: offer.buyer_id,
       creatorId: offer.creator_id,
       paymentIntentId,
       idempotencyKey,
       dbCommitErrorCode: classifiedRpcError.code,
       stripeVoidErrorCode: extractStripeCode(voidErr),
     }, '[offer-accept] reconcile required')
     return { ok: false, kind: 'db_commit_reconcile', httpStatus: 500, code: 'RECONCILE_NEEDED', message: 'Payment-to-state reconciliation required.' }
   }
   return { ok: false, kind: 'db_commit_voided', ...classifiedRpcError }
   ```
9. On RPC success → row-shape validate, return `{ ok: true, paymentIntentId, clientSecret, offerEventId, offerEventHash, assignmentId, assignmentEventId, assignmentEventHash }` (R10 — paymentIntentId + clientSecret captured at step 7 are surfaced on the success branch; the five event/assignment ids come from the RPC's RETURNING TABLE shape).

Invariants the orchestrator must preserve:

- **The idempotency key is derived, never client-supplied.** Even if the body carried one, ignore it.
- **The PI is never created inside a DB txn.** The outer-DB-txn-with-lock pattern from §8.5 is deliberately REPLACED by the D1 optimistic UPDATE (see §DECISIONS). The orchestrator runs outside any DB txn boundary.
- **The void call uses the same `idempotencyKey`.** Stripe treats this as a no-op replay safely.
- **Sentry/logger.error with `severity: 'critical'` is the reconcile-fail surface.** Do not add retry; do not add DB writes.
- **Every error branch returns `{ ok: false, ... }`.** The orchestrator does not throw.

Top-of-file header comment must document the four failure shapes and reference §8.5 explicitly.

### F5 — RPC: `rpc_accept_offer_commit`

Lives inside F1's migration file. Single inner-txn RPC. Mirrors `rpc_counter_offer`'s shape from Part A.

Signature:

```sql
CREATE OR REPLACE FUNCTION public.rpc_accept_offer_commit(
  p_actor_ref             uuid,    -- actor_handles.handle (NOT auth.uid()). D15 B1.
  p_offer_id              uuid,
  p_payment_intent_id     text,    -- from Stripe
  p_idempotency_key       text,    -- offer.id + ':accept'
  p_payload_offer         jsonb,   -- offer.accepted payload
  p_payload_assignment    jsonb    -- assignment.created payload
) RETURNS TABLE (
  offer_event_id        uuid,
  offer_event_hash      text,
  assignment_id         uuid,
  assignment_event_id   uuid,
  assignment_event_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer_id      uuid;
  v_row_count     int;
  v_assignment_id uuid;
BEGIN
  -- Actor-auth guard (P0008 — B1 D15 discipline).
  IF NOT EXISTS (
    SELECT 1 FROM public.actor_handles
    WHERE handle = p_actor_ref AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'actor_mismatch: handle does not belong to caller'
      USING ERRCODE = 'P0008';
  END IF;

  -- Optimistic conditional UPDATE — the D1 replacement for §8.5's
  -- row-level lock. Stamps state flip + Stripe linkage in one write.
  -- Only buyer_id is needed downstream (party check); creator_id and
  -- target_type are resolvable from payload args, no need to re-fetch.
  UPDATE public.offers
     SET state                     = 'accepted',
         stripe_payment_intent_id  = p_payment_intent_id,
         stripe_idempotency_key    = p_idempotency_key,
         updated_at                = now()
   WHERE id = p_offer_id
     AND state IN ('sent', 'countered')
   RETURNING buyer_id
     INTO v_buyer_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    -- Either not found OR not in {sent, countered}. Disambiguate:
    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE id = p_offer_id) THEN
      -- P0003 + 'offer_not_found' prefix → rpc-errors.ts offer_not_found dispatch → 404 (R9).
      RAISE EXCEPTION 'offer_not_found: %', p_offer_id
        USING ERRCODE = 'P0003';
    ELSE
      -- P0003 + 'invalid_state' prefix → rpc-errors.ts invalid_state dispatch → 409 (R9).
      RAISE EXCEPTION 'invalid_state: offer is not in sent/countered'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- Party check (belt-and-braces; RLS already gates, but SECURITY
  -- DEFINER bypasses RLS).
  IF auth.uid() IS DISTINCT FROM v_buyer_id THEN
    -- P0004 + 'not_party' prefix → rpc-errors.ts not_party dispatch → 403 (R9).
    RAISE EXCEPTION 'not_party: accept is buyer-only'
      USING ERRCODE = 'P0004';
  END IF;

  -- Emit offer.accepted on the offer thread.
  SELECT r.event_id, r.event_hash
    INTO offer_event_id, offer_event_hash
    FROM public._emit_offer_event_with_retry(
      'offer', p_offer_id, 'offer.accepted', p_payload_offer, p_actor_ref
    ) AS r;

  -- Insert the assignment row. Initial state = 'active' (enum first value).
  INSERT INTO public.assignments (offer_id, state)
    VALUES (p_offer_id, 'active')
    RETURNING id INTO v_assignment_id;

  assignment_id := v_assignment_id;

  -- Emit assignment.created on the assignment thread.
  SELECT r.event_id, r.event_hash
    INTO assignment_event_id, assignment_event_hash
    FROM public._emit_offer_event_with_retry(
      'assignment', v_assignment_id, 'assignment.created', p_payload_assignment, p_actor_ref
    ) AS r;

  RETURN NEXT;
END;
$$;
```

Invariants:

- **Single DB transaction.** Postgres wraps every function call in an implicit txn under supabase-js. If the `_emit_*` retry exhausts, RAISE P0001 unwinds the whole thing — offer UPDATE, assignment INSERT, both events all rolled back.
- **`assignments.offer_id` is UNIQUE.** Double-accept (somehow reaching the INSERT twice) fails at the DB layer with SQLSTATE 23505. The B1 `classifyRpcError` classifier already surfaces this; add a narrow case in F8 if the surface differs from the existing `P0002`/`P0008` handling (it will — this is a new SQLSTATE for this RPC).
- **Guard ordering matters.** Actor-auth first (P0008), then state-via-conditional-UPDATE, then party check (defense in depth), then event emissions. Matches Part A discipline.
- **`GRANT EXECUTE` to `authenticated`** (mirror `rpc_counter_offer`). Do NOT grant to `anon`.

### F6 — Route handler

File: `src/app/api/offers/[id]/accept/route.ts`

Mirror `src/app/api/offers/[id]/counter/route.ts` (B1, 314 LoC). Flow:

1. `requireActor(request)` → surface 404/401/403 per B1 pattern.
2. `parseParams(ctx.params, ParamsSchema, ROUTE)` → UUID validation.
3. `parseBody(request, AcceptOfferBody, ROUTE)` — see schema below.
4. Extract bearer token → `getSupabaseClientForUser(accessToken)`.
5. Load offer via user-JWT client: `SELECT * FROM offers WHERE id = $1`. 404 if not found.
6. Run preflight `canAccept({ offer, actorUserId: actor.authUserId })` — mirror B1 `canCounter` guard pattern. Returns `{ allowed: true } | { allowed: false, reason: 'invalid_state:...' | 'not_party:...' }`. Map to 409 per B1 pattern. (Extend `state.ts` to add `canAccept` if not present — see F7.)
7. Compute `expectedPieceCount`: load the relevant child-row count. For `single_asset` / `asset_pack`: `SELECT count(*) FROM offer_assets WHERE offer_id = $1`. For `brief_pack`: `SELECT count(*) FROM offer_briefs WHERE offer_id = $1`.
8. Short-circuit if Stripe is not configured: `if (!isStripeConfigured()) return errorResponse(503, 'FEATURE_DISABLED', 'Payment provider not configured.')`. This is the dual-mode escape — dev/test environments without `STRIPE_SECRET_KEY` surface 503 rather than a mid-flight crash.
9. Call `acceptOffer({...})` from F4.
10. Branch on `result.ok`:
    - `true` → `return NextResponse.json({ data: {...event ids/hashes + assignment_id }}, { status: 200 })`.
    - `false` → `return errorResponse(result.httpStatus, result.code, result.message)`. Structured log at warn/error based on httpStatus (mirror B1).

Body schema:

```ts
const AcceptOfferBody = z.object({}).strict()
```

Yes, empty. The accept action takes no body payload — the acceptance decision is implicit in the POST. Future extensions (e.g. buyer-supplied note) go here; B2 ships empty-strict so unknown-keys fail loud.

Error surface (explicit):

| HTTP | Code | Source |
|---|---|---|
| 404 | `FEATURE_DISABLED` | `requireActor` — flag off |
| 401 | `UNAUTHENTICATED` | requireActor / missing bearer |
| 403 | `ACTOR_NOT_FOUND` | requireActor |
| 400 | `VALIDATION_ERROR` | Zod params |
| 404 | `OFFER_NOT_FOUND` | offer load returns no row |
| 409 | `INVALID_STATE` | `canAccept` preflight OR RPC `invalid_state` |
| 403 | `NOT_PARTY` | `canAccept` preflight OR RPC `not_party` (R11-revised — was 409; buyer-only accept makes this an identity check, aligning with the B1 classifier's P0004 → 403 dispatch) |
| 401 | `ACTOR_MISMATCH` | RPC P0008 |
| 402 | `CARD_DECLINED` | Stripe card error |
| 400 | `STRIPE_INVALID_REQUEST` | Stripe invalid request |
| 429 | `RATE_LIMIT` | Stripe rate limit |
| 502 | `STRIPE_UNAVAILABLE` | Stripe API / connection error |
| 503 | `FEATURE_DISABLED` | Stripe env unset |
| 503 | `LEDGER_CONTENTION` | RPC P0001 |
| 500 | `RECONCILE_NEEDED` | commit fail + void fail |
| 500 | `INTERNAL` | unknown |

Success shape:

```ts
{
  data: {
    offerEventId: string
    offerEventHash: string
    assignmentId: string
    assignmentEventId: string
    assignmentEventHash: string
  }
}
```

Status 200 (not 201 — the offer is modified, not created; mirror `counter`).

### F7 — `canAccept` extension in `state.ts`

File: `src/lib/offer/state.ts`

If `canAccept` does not exist, add it. **If it does exist and its shape diverges from below, AMEND it to match.** Current HEAD has a permissive version that allows either party and checks state first — that must be tightened to buyer-only, party-check-first, exactly as specified. Rationale: a permissive preflight would let a creator trigger a Stripe PI create before the inner RPC rejects them — a wasted API call plus a forensic trace on the Stripe dashboard for a transaction that should never have left the platform.

This is the ONLY permitted modification to `state.ts` under B2 (see AC16).

```ts
export function canAccept(args: {
  offer: OfferRow
  actorUserId: string
}): { allowed: true } | { allowed: false, reason: string } {
  if (args.offer.buyer_id !== args.actorUserId) {
    return { allowed: false, reason: 'not_party: accept is buyer-only' }
  }
  if (args.offer.state !== 'sent' && args.offer.state !== 'countered') {
    return { allowed: false, reason: `invalid_state: offer is ${args.offer.state}` }
  }
  return { allowed: true }
}
```

Ordering is load-bearing: **party check first, state check second.** Reason strings are the exact literals above — they are grepped by the route's error-code mapping.

No `lastEventActorRef` parameter (accept is not last-turn-gated; buyer accepts creator's last counter OR the original sent offer, either way buyer is authorized). Mirrors B1's `canCancel` simplification (D12).

Update the `TransitionGuardResult` return type / existing signature only insofar as needed to match; if the existing `canAccept` already returns `TransitionGuardResult`, keep that type — the discriminant shape is equivalent.

### F8 — Stripe error classifier

File: `src/lib/stripe/errors.ts`

Classify a Stripe SDK error into the same `ClassifiedRpcError`-style shape B1 uses for DB errors. Do NOT bolt onto `src/lib/offer/rpc-errors.ts` — Stripe's error surface is fundamentally different (SDK-typed errors, not SQLSTATE + SQLERRM).

Shape:

```ts
export type ClassifiedStripeError = {
  kind:
    | 'card_declined'
    | 'invalid_request'
    | 'rate_limit'
    | 'unavailable'
    | 'authentication'
    | 'idempotency_mismatch'
    | 'unknown'
  httpStatus: number
  code: string     // stable response code for the route's error body
  message: string  // user-facing (not Stripe's raw message — redact PII)
  raw: { code?: string; type?: string; statusCode?: number }
}

export function classifyStripeError(err: unknown): ClassifiedStripeError {
  // Dispatch on err instanceof Stripe.errors.StripeCardError, etc.
  // See https://docs.stripe.com/api/errors for the type vocabulary.
}
```

Mapping:

| Stripe error class | kind | httpStatus | code |
|---|---|---|---|
| `StripeCardError` | `card_declined` | 402 | `CARD_DECLINED` |
| `StripeInvalidRequestError` | `invalid_request` | 400 | `STRIPE_INVALID_REQUEST` |
| `StripeRateLimitError` | `rate_limit` | 429 | `RATE_LIMIT` |
| `StripeAPIError` | `unavailable` | 502 | `STRIPE_UNAVAILABLE` |
| `StripeConnectionError` | `unavailable` | 502 | `STRIPE_UNAVAILABLE` |
| `StripeAuthenticationError` | `authentication` | 500 | `INTERNAL` (log as critical — config drift) |
| `StripeIdempotencyError` | `idempotency_mismatch` | 409 | `IDEMPOTENCY_MISMATCH` |
| anything else | `unknown` | 500 | `INTERNAL` |

User-facing `message` must NOT leak Stripe's raw message (could contain card last-4, BIN, etc.). Use static strings per kind.

### F9 — Orchestrator unit tests

File: `src/lib/offer/tests/offer-accept.test.ts`

Vitest. Mock the Supabase RPC client and the Stripe client. Five branches, each with at least one explicit test:

1. **Happy path.** PI create succeeds, RPC succeeds. Asserts the result shape and that Stripe was called with the derived idempotency key + no `destination` + correct `amount` / `currency`.
2. **PI create fails (card declined).** Stripe throws `StripeCardError`. Asserts RPC was NOT called, result is `{ ok: false, kind: 'stripe_create', httpStatus: 402, code: 'CARD_DECLINED' }`.
3. **RPC fails (stale state).** PI create succeeds, RPC throws with `invalid_state:` SQLERRM. Asserts void was called with the same idempotency key, void succeeds, result is `{ ok: false, kind: 'db_commit_voided', httpStatus: 409, code: 'INVALID_STATE' }`.
4. **RPC fails AND void fails.** PI create succeeds, RPC throws, void throws. Asserts the structured `severity: 'critical'` log was emitted with all required fields, result is `{ ok: false, kind: 'db_commit_reconcile', httpStatus: 500, code: 'RECONCILE_NEEDED' }`.
5. **Unsupported currency.** Input `offer.currency = 'JPY'`. Asserts the orchestrator throws BEFORE any Stripe call.

Use `vi.fn()` for the Stripe client; do NOT hit real Stripe even in test mode.

### F10 — Route integration tests

File: `src/app/api/offers/[id]/accept/tests/route.test.ts`

Mirror the pattern in B1's route tests (`src/app/api/offers/[id]/counter/tests/route.test.ts` if present; otherwise `src/app/api/offers/route.test.ts`). Use the same supabase-mock harness + a new stripe-mock harness.

Coverage:

1. Happy path → 200, correct body shape, assignment row observable via follow-up query.
2. Unauth (no bearer) → 401.
3. Flag off → 404 FEATURE_DISABLED.
4. Stripe unconfigured → 503 FEATURE_DISABLED.
5. Offer not found → 404.
6. Non-buyer caller → 403 NOT_PARTY (R11).
7. Offer state = `accepted` (already accepted) → 409 INVALID_STATE (preflight).
8. Race: preflight passes, RPC returns invalid_state (simulated via mock) → 409 with void-called assertion.
9. Body has unknown key → 400 VALIDATION_ERROR.
10. Stripe card error → 402 CARD_DECLINED.
11. Commit fails + void fails → 500 RECONCILE_NEEDED with critical log assertion.

### F11 — Retire `/api/special-offer/*` and `src/lib/special-offer/*`

**STATUS: DEFERRED (R12).** This concern no longer retires the legacy surface. See §F11-AUDIT for the caller graph captured during Prompt 11; see §F11-DEFER-RATIONALE for why. The original retirement plan below is preserved for historical continuity.

**Separate commit** inside the same branch. Land F1-F10 as commit N; land F11 as commit N+1.

Pre-deletion audit (MUST COMPLETE BEFORE DELETION):

1. Run the equivalent of `grep -rn "special-offer\|special_offer\|SpecialOffer\|direct-offer\|directOffer" src/` over the entire tree. Record every hit.
2. For each hit that is NOT inside `src/app/api/special-offer/**` or `src/lib/special-offer/**` (i.e. external callers): evaluate whether it is a live reference or dead/documentation.
3. If ANY external live caller exists that cannot be migrated to the new `/api/offers/**` surface within B2's footprint, STOP and surface the caller list to the founder. The special-offer deletion commit is BLOCKED until resolved — either migrate the caller, or explicitly defer F11 to a trailing tidy commit on a follow-up branch.
4. If zero external live callers: proceed to deletion.

Deletion surface (remove entire directories + any imports):

- `src/app/api/special-offer/` (including `[id]/accept`, `[id]/counter`, `[id]/decline` subroutes).
- `src/lib/special-offer/` (`services.ts`, `store.ts`, `api-helpers.ts`, any others).
- Any in-memory mock data scoped exclusively to special-offer in `src/lib/mock-data.ts`.
- Any UI components under `src/components/` that exclusively serve special-offer (audit required; do NOT delete components that serve the new `/api/offers/*` surface or shared vault screens).

Commit message for the deletion: `chore(p4/4A.2/B2): retire legacy /api/special-offer mock surface`

If the audit surfaces ambiguity, err toward NOT deleting and flagging for founder review. Reverting an over-eager deletion is harder than shipping F11 as a follow-up.

### §F11-AUDIT

Caller classification table, captured verbatim from Prompt 11. Row numbering preserved.

| # | File | Line(s) | Category | Call-type | Migration complexity | Notes |
|---|---|---|---|---|---|---|
| 1 | `src/app/api/special-offer/route.ts` | 1-116 | route-definition | write | trivial (delete) | POST create + GET list. Imports from `@/lib/special-offer/{services,store,api-helpers}`. 116 LoC. |
| 2 | `src/app/api/special-offer/[id]/accept/route.ts` | 1-46 | route-definition | write | trivial (delete) | Legacy accept endpoint — replaced by `/api/offers/[id]/accept` (B2). 46 LoC. |
| 3 | `src/app/api/special-offer/[id]/counter/route.ts` | 1-41 | route-definition | write | trivial (delete) | Legacy counter — replaced by `/api/offers/[id]/counter` (B1). 41 LoC. |
| 4 | `src/app/api/special-offer/[id]/decline/route.ts` | 1-40 | route-definition | write | trivial (delete) | No direct replacement — the new surface uses `/api/offers/[id]/reject`. Call-type rename ('decline' → 'reject'). 40 LoC. |
| 5 | `src/lib/special-offer/services.ts` | 1-559 | server-caller | declaration | trivial (delete) | Business logic module. `SpecialOfferError`, `createOffer`, `creatorAccept`, `buyerAccept`, `creatorCounter`, `buyerCounter`, `creatorDecline`, `expireOffer`, `autoCancel`, `completeOffer`, `sweepAutoCancel`. 559 LoC. |
| 6 | `src/lib/special-offer/store.ts` | 1-77 | server-caller | declaration | trivial (delete) | In-memory `Map<string, ...>` stores for threads + events + checkout intents. Not DB-backed. 77 LoC. |
| 7 | `src/lib/special-offer/guards.ts` | 1-251 | server-caller | declaration | trivial (delete) | State/party guards for the legacy thread model. 251 LoC. |
| 8 | `src/lib/special-offer/reducer.ts` | 1-40 | server-caller | declaration | trivial (delete) | React-style reducer; orphaned (no UI importer). 40 LoC. |
| 9 | `src/lib/special-offer/api-helpers.ts` | 1-44 | server-caller | declaration | trivial (delete) | `success`, `errorResponse`, `resolveThread`, `withOfferError` helpers. 44 LoC. |
| 10 | `src/lib/special-offer/types.ts` | 1-137 | type-definition | declaration | trivial (delete) | `SpecialOfferEngineState`, `SpecialOfferAction`, `VALID_OFFER_TRANSITIONS`. 137 LoC. |
| 11 | `src/lib/special-offer/index.ts` | 1-4 | type-definition | declaration | trivial (delete) | Barrel. 4 LoC. |
| 12 | `src/lib/special-offer/__tests__/services.test.ts` | 1-684 | test | declaration | trivial (delete) | 684 LoC of service tests — deletes with the module. |
| 13 | `src/lib/special-offer/__tests__/guards.test.ts` | 1-386 | test | declaration | trivial (delete) | 386 LoC of guard tests — deletes with the module. |
| 14 | `src/lib/special-offer/__tests__/helpers.ts` | 1-77 | fixture-or-mock | declaration | trivial (delete) | Test fixture factories (makeThread, makeEvent). 77 LoC. |
| **15** | **`src/app/vault/offers/page.tsx`** | 7, 9, 14-17, 25, 88, 101, 112, 135-138, 243-249, 260, 275, 278, 333, 385, 413, 446, 532 | **client-caller** | **write** | **semantic (UI rewrite)** | **561 LoC Next.js App Router page. `'use client'`. Imports 6 SpecialOffer* symbols from `@/lib/types`. Uses mockThreads/mockEvents for initial state. Three fetch calls at L333/L385/L446 to `/api/special-offer/[id]/{accept,counter,decline}`. NOT flag-gated (no `notFound()` / `isEconomicV1UiEnabled()` check). THE ONLY LIVE EXTERNAL CALLER OUTSIDE THE SPECIAL-OFFER MODULE ITSELF.** |
| 16 | `src/lib/types.ts` | 88-108, 653-707, 1002 | type-definition | declaration | mechanical + semantic | Defines `SpecialOfferStatus` (union), `SPECIAL_OFFER_STATUS_LABELS`, `TERMINAL_OFFER_STATUSES`, `SPECIAL_OFFER_MAX_ROUNDS`, `SPECIAL_OFFER_DEFAULT_RESPONSE_MINUTES`, `SPECIAL_OFFER_MIN_RESPONSE_MINUTES`, `SPECIAL_OFFER_MAX_RESPONSE_MINUTES`, `SpecialOfferThread`, `SpecialOfferAutoCancelReason`, `SpecialOfferEventType`, `SpecialOfferEvent`. Also L1002: a `'special_offer'` string literal inside `LicenceSourceType` union. ~100 LoC of type surface; removal cascades into #15. |
| 17 | `src/lib/db/schema.ts` | 355-379, 415-416 | type-definition | declaration | mechanical | `SpecialOfferThreadRow`, `SpecialOfferEventRow` row-shape interfaces; `TABLE_NAMES.special_offer_threads` + `TABLE_NAMES.special_offer_events`. ~20 LoC. Note: the backing DB tables were DROPPED by `20260421000003_drop_assignment_engine.sql`; these types are orphaned schema. |
| 18 | `src/lib/entitlement/__tests__/helpers.ts` | 45 | fixture-or-mock | declaration | mechanical | Single line: `source_type: 'special_offer'` inside a licence-grant test fixture. Depends on #16 L1002's enum value. |
| 19 | `src/lib/offer/offer-accept.ts` | 88 | doc (header comment) | reference | trivial | Header comment: `* - No import from \`@/lib/special-offer\`.` Amended by Prompt 12 to reference 4A.2.C follow-up rather than F11. |
| 20 | `supabase/migrations/20260421000003_drop_assignment_engine.sql` | 49-50, 77-80 | migration-or-rpc | write | blocked-by-scope | Historical migration that ALREADY drops `special_offer_events` + `special_offer_threads` tables and enum types. Immutable history; do not re-edit. |
| 21 | `supabase/migrations/20260420010000_rename_direct_offer_to_special_offer.sql` | multi | migration-or-rpc | declaration | blocked-by-scope | Historical rename migration (direct_offer → special_offer). Immutable. References stay. |
| 22 | `supabase/migrations/20260420020000_refresh_licence_grants_source_type_comment.sql` | 7, 29 | migration-or-rpc | declaration | blocked-by-scope | Historical comment refresh referencing 'special_offer' as an enum value + doc text. Immutable. |
| 23 | `supabase/migrations/_preflight/20260420010000_rename_introspection.sql` | multi | migration-or-rpc | declaration | blocked-by-scope | Preflight canary for the rename migration. Tool/support file. |
| 24 | `supabase/migrations/_rollbacks/20260420010000_rename_direct_offer_to_special_offer.DOWN.sql` | multi | migration-or-rpc | declaration | blocked-by-scope | Rollback script for the rename. Tool/support file. |
| 25 | `docs/specs/ECONOMIC_FLOW_v1.md` | (multi) | doc | reference | trivial (optional) | Spec document mentions. Could add a "sunset" note but no functional requirement. |
| 26 | `docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md` | §F11 + refs | doc | reference | trivial | This directive itself — mentions F11 retirement. Updated inline as part of this concern. |
| 27 | `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` | (multi) | doc | reference | trivial | Predecessor directive — mentions special-offer as the retiring surface. Historical. |
| 28 | `docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md` | (multi) | doc | reference | trivial | 4A.2 parent directive. Historical. |
| 29 | `docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md` | (multi) | doc | reference | trivial | 4A.1 directive. Historical. |
| 30 | `docs/audits/P4_CONCERN_3_DIRECTIVE.md` | (multi) | doc | reference | trivial | AUTH_WIRED directive — mentions special-offer as legacy. Historical. |
| 31 | `docs/audits/P4_CONCERN_4_DESIGN_LOCK.md` | (multi) | doc | reference | trivial | Design lock. Historical. |
| 32 | `docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md` | (multi) | doc | reference | trivial | Concern-1 directive. Historical. |
| 33 | `docs/audits/P4_UI_DEPRECATION_AUDIT.md` | (multi) | doc | reference | trivial | Deprecation audit. Literally lists the 13 retiring routes including special-offer. |
| 34 | `docs/audits/P4_IMPLEMENTATION_PLAN.md` | (multi) | doc | reference | trivial | Implementation plan. |
| 35 | `docs/audits/REMEDIATION_PLAN_20260418.md` | (multi) | doc | reference | trivial | Historical audit. |
| 36 | `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` | (multi) | doc | reference | trivial | Dedicated decision memo about special-offer — the origin artefact. |
| 37 | `docs/audits/CODEBASE_AUDIT_20260418.md` | (multi) | doc | reference | trivial | Codebase audit snapshot. |
| 38 | `INTEGRATION_READINESS.md` | (multi) | doc | reference | trivial | Integration roadmap. |
| 39 | `FEATURE_APPROVAL_ROADMAP.md` | (multi) | doc | reference | trivial | Roadmap. |
| 40 | `P5_PAUSED_HANDOFF_20260418.md` | (multi) | doc | reference | trivial | P5 handoff memo. |
| 41 | `SPECIAL_OFFER_SPEC.md` | full file | doc | reference | trivial (rename or delete) | Standalone spec doc for the legacy surface. |
| 42 | `CLAUDE_CODE_PROMPT_SEQUENCE.md` | (multi) | doc | reference | trivial | Prompt sequence doc. |
| 43 | `PLATFORM_REVIEWS.md` | (multi) | doc | reference | trivial | Review doc. |
| 44 | `.claude/agents/frontfiles-context.md` | (multi) | doc | reference | trivial | Claude Code agent context file. |

**Count by category**
- route-definition: 4 (#1-4)
- server-caller: 5 (#5-9, all inside `src/lib/special-offer/`)
- client-caller: **1** — `src/app/vault/offers/page.tsx` (#15)
- test: 2 (#12-13)
- fixture-or-mock: 2 (#14, #18)
- type-definition: 4 (#10-11 in special-offer, #16-17 shared)
- migration-or-rpc: 5 (#20-24, all historical)
- doc: 18 (#19 + #25-44)
- config-or-env: 0
- dead-code: 0 strictly; #8 reducer.ts is structurally orphaned (no importer outside the module)

**Count by migration complexity**
- trivial: 14 (route files, lib files, tests, fixtures, doc comment at #19)
- mechanical: 3 (#16 types.ts, #17 schema.ts, #18 entitlement fixture)
- **semantic: 1** — `src/app/vault/offers/page.tsx` (UI rewrite; decisive D13 trigger)
- blocked-by-scope: 5 (historical migrations; immutable)
- blocked-by-B1: 0 (AC16-frozen files list does not overlap the graph)

**Blast-radius assessment**
- **Inside B2's natural edit surface**: none. B2 did not touch any special-offer file.
- **Outside B2 that would need modification**: `src/app/vault/offers/page.tsx` (semantic rewrite, 561 LoC), `src/lib/types.ts` (remove ~100 LoC of SpecialOffer* surface + 1 enum literal), `src/lib/db/schema.ts` (remove 2 row types + 2 TABLE_NAMES entries), `src/lib/entitlement/__tests__/helpers.ts` (1-line fixture change).
- **AC16-frozen files in the graph**: **zero**. The special-offer graph does not overlap AC16's narrow freeze list.

**Estimated LoC delta for full retirement**

| Scope | LoC |
|---|---|
| Delete 4 route files | 243 |
| Delete 7 lib files | 1,112 |
| Delete 3 test/fixture files | 1,147 |
| **Deletions subtotal** | **2,502** |
| Edit `src/lib/types.ts` (remove SpecialOffer* + enum value) | ~100 |
| Edit `src/lib/db/schema.ts` (remove row types + TABLE_NAMES) | ~20 |
| Edit `src/lib/entitlement/__tests__/helpers.ts` (1-line fixture) | 1 |
| **Surgical edits subtotal** | **~121** |
| Rewrite `src/app/vault/offers/page.tsx` (or shell-out + replacement) | **~500-800 (semantic)** |
| **Total net delta** | **~3,100-3,400 LoC** |

### §F11-DEFER-RATIONALE

Three pillars justify the defer (four bullets — the fourth flags an adjacent architectural gap surfaced during audit):

1. **UI-regression pillar.** `src/app/vault/offers/page.tsx` carries three live POST fetches to `/api/special-offer/[id]/{accept,counter,decline}` at L333, L385, and L446. The page is `'use client'` with no `notFound()` gate, no `isEconomicV1UiEnabled()` check, and no feature-flag short-circuit. Deleting the four legacy route files while the page is still live ships three broken buttons on `/vault/offers` — a user-visible regression on a route buyers can reach. That's not a tidy-commit footprint; it's a deploy-time defect waiting to surface.

2. **LoC-delta pillar.** Full retirement is ~3,100-3,400 LoC of net change (2,502 LoC of deletions + ~121 LoC of surgical cross-module edits + ~500-800 LoC of UI rewrite). Directive §D13 Branch (a) requires "LoC delta below ~200". The actual delta is 15-17× over threshold. Folding this into B2 would push the PR past any sane single-concern reviewing footprint and bury the Stripe accept surface inside a cleanup commit.

3. **Licence-enum pillar.** `licence_source_type` ENUM carries a `'special_offer'` value (migration `20260420010000` L208). Removing the value requires a pre-flight scan of `licence_grants.source_type` for rows still bound to it; any remaining row blocks `ALTER TYPE ... DROP VALUE`. Data-integrity migrations with scan-gates are their own design exercise and sit outside B2's Stripe-accept scope. The safe split is to retire the TS-side surface in the follow-up concern and leave the DB enum value in place (or handle it in a separate migration once a data scan confirms zero live `'special_offer'` grants).

4. **Flags.ts architectural gap (adjacent finding).** `src/lib/flags.ts` L86-93 documents a planned `isEconomicV1UiEnabled()` gate architecture for `/vault/offers`, `/vault/offers/[id]`, `/vault/assignments`, `/vault/assignments/[id]`, `/vault/disputes`, and `/vault/disputes/[id]` — but the gate was never wired into `src/app/vault/offers/page.tsx`. The follow-up concern must build the flag-gated replacement page AND delete the legacy surface atomically, otherwise a half-migrated state ships where the old page still renders but the flag-off short-circuit is missing.

### §F11-FOLLOWUP-SCOPE

**Working name.** `4A.2.C — Legacy special-offer sunset + /vault/offers replacement page`.

**Scope summary** (5 bullets):
- Delete all 14 special-offer files flagged `trivial` in §F11-AUDIT (4 route files, 7 lib files, 3 test/fixture files). Deletions are idempotent; no orphan imports outside the module itself.
- Mechanical edits to `src/lib/types.ts` (remove the SpecialOffer* type surface, ~100 LoC), `src/lib/db/schema.ts` (remove 2 orphaned row types + 2 `TABLE_NAMES` entries), and `src/lib/entitlement/__tests__/helpers.ts` (1-line fixture: `source_type: 'special_offer'` → replacement enum value).
- Build the flag-gated replacement page at `/vault/offers` per the `flags.ts` L86-93 architecture (`isEconomicV1UiEnabled()` short-circuit to `notFound()` when off). The replacement consumes the new `/api/offers/*` surface (B1+B2) and renders against real buyer/creator data, not mock threads.
- Resolve the `licence_source_type` enum value: either (a) leave the `'special_offer'` value in place with TS-side removal only (zero DB migration, simplest), or (b) ship a new migration with a pre-flight data-scan gate on `licence_grants.source_type`. Path (a) is preferred unless a data scan confirms zero live `'special_offer'` grants.
- Delete `SPECIAL_OFFER_SPEC.md` (standalone legacy spec doc, row #41). Audit docs and implementation plans (rows #25-44 except #41) may receive inline "superseded" stubs but the core text stays for historical continuity.

**Dependencies.** B2 shipped (commit `98481b7` or its descendant on `main`). `ECONOMIC_V1_UI` flag scaffolding is already present in `src/lib/flags.ts` (L86-93 + `isEconomicV1UiEnabled()` accessor).

**Non-goals.** Does NOT touch any B1/B2 code path. Does NOT modify `/api/offers/*` or `rpc_accept_offer_commit`. Does NOT revisit AC16 freezes. Does NOT alter the Stripe straddle.

**Suggested sizing.** Single concern, single directive, estimated ~3,500 LoC net delta (deletions dominate). Splits naturally into two commits: (1) replacement page + flag-gate wiring, (2) legacy deletion + shared-type surgery. Both land on the same branch.

---

## §DECISIONS

These decisions are LOCKED. Do not re-debate during implementation. If execution surfaces a contradiction with any decision below, STOP and surface — do not silently deviate.

### D1 — Optimistic conditional UPDATE in place of §8.5's row-level lock

**Decision:** Replace §8.5 L269's `SELECT ... FOR UPDATE` + outer DB txn with an **inner-RPC-only** conditional UPDATE: `UPDATE offers SET state = 'accepted', ... WHERE id = $1 AND state IN ('sent', 'countered')`. Zero rows affected → RAISE invalid_state → Stripe PI voided by the orchestrator.

**Why over the spec's literal primitive:**
- `@supabase/supabase-js` has no connection-scoped txn surface. Each RPC call is its own txn, so a `FOR UPDATE` lock in a prelock RPC is released before Stripe is called — the lock does not cross the HTTP boundary. To hold a lock across Stripe, we'd need advisory locks + a release surface + a stuck-lock reaper cron. That's three new failure modes for a strictly weaker position.
- The spec's lock exists to deliver three guarantees: (a) no double-accept, (b) no accept-without-charge, (c) no charge-without-accept. Conditional UPDATE + server-derived idempotency key delivers all three:
  - (a) Postgres row locking during UPDATE serializes concurrent updates. Loser sees zero rows affected.
  - (b) PI create precedes the UPDATE; state only flips after the PI id is in hand.
  - (c) Void-on-rollback using the same idempotency key.
- Advisory locks remain available as a layered addition if a concurrency hole surfaces later. B2's surface does not preclude them.

**Spec-compliance framing:** document this in F5's RPC header comment and F6's route header. Explicit deviation, explicit reasoning, same guarantees.

### D2 — PI linkage lives on `offers`, not `assignments`

**Decision:** Two new columns on `offers`: `stripe_payment_intent_id text NULL` and `stripe_idempotency_key text NULL`, both partial-unique indexed WHERE NOT NULL.

**Why `offers` not `assignments`:**
- The offer row exists pre-inner-txn; the assignment row does not. Idempotency surface must live where the pre-Stripe write lands, so replay paths can resolve the PI without depending on assignment existence.
- §8.5 treats the PI as a facet of the accept transition, which is an offer-state event. The assignment is the downstream execution vehicle; its row is created as a consequence of the PI, not as its owner.
- Partial unique indexes tolerate NULL during negotiation and enforce uniqueness once stamped. The idempotency key is deterministic from `offer.id + ':accept'`, so uniqueness is structurally guaranteed — the UNIQUE constraint is belt-and-braces against a rogue writer.

**Do not migrate these columns to `assignments` in 4A.3.** Domain-accurate placement stays on `offers` at archival.

### D3 — Reconciliation is log-only in B2

**Decision:** When the inner RPC fails AND the PI void also fails, emit a structured `severity: 'critical'` Sentry alert + pino log with the full payload (offer id, buyer id, creator id, PI id, idempotency key, db error code, stripe void error code, `event: 'accept.reconcile_needed'`). Do NOT create an `admin_reconciliation_jobs` table.

**Why:**
- A DB table implies admin UI, a state machine, RLS, and query surface. That's 4A.3 admin-tooling scope alongside webhook handling and dispute admin rulings.
- §8.5's void-fail path is rare-plus-catastrophic. Log + alert is the cheapest correct surface for "must never be silent, must never accumulate."

**4A.3 handoff note in F4's header comment:** state explicitly that `admin_reconciliation_jobs` is the 4A.3 successor surface and that the log schema in F4 is the contract that feeds it.

### D4 — Special-offer retirement ships as a separate commit inside B2

**Decision:** F1-F10 land as commit N. F11 lands as commit N+1. Both in the same PR.

**Why separate commit:**
- Surgical revert if an unexpected caller surfaces post-merge.
- Clean reviewer diff: the replacement and the removal are distinct units.
- The caller-audit gate in F11 can block the deletion commit without blocking the replacement commit.

If the caller audit surfaces a blocker, F11 defers to a follow-up branch; the PR still lands F1-F10 and closes B2's primary scope.

### D5 — Stripe SDK resolves at install; API version pinned to SDK default

**Decision:** `bun add stripe` with no version pin. Whatever resolves is B2's version. Pin F3's `apiVersion` to the SDK's default for the resolved major (read from `Stripe.DEFAULT_API_VERSION` or the SDK types). Record both the resolved SDK version and the resolved API version in the exit report.

**Why over a hard-coded major pin:** the SDK major drifts between when a directive is written and when Claude Code runs it. Pinning from memory invites a stale version. The audit-first principle says: install the current stable, record what you got, and make the record the spec. Future concern-level upgrades explicitly re-run this install and bump the recorded values.

**Why pin `apiVersion` at all:** decouples a future server-side SDK upgrade from a silent Stripe API behaviour change. The pin is the contract.

### D6 — No Stripe Connect in B2

**Decision:** PI create targets the platform balance. No `transfer_data`, `destination`, `on_behalf_of`, or `application_fee_amount`.

**Why:** Creator payout via Connect split happens on `assignment.cashed_out`, which is 4A.3 scope. B2's accept flow escrows funds at the platform, full stop.

### D7 — Amount conversion: `gross_fee * 100`, whitelist = `USD / EUR / GBP`

**Decision:** Amount-in-minor-units computed as `Math.round(offer.gross_fee * 100)`. Currency must be in `['USD', 'EUR', 'GBP']`; anything else throws before Stripe is called.

**Why this set:** professional editorial content transacts predominantly in these three — USD (editorial lingua franca), EUR (Frontfiles' operating jurisdiction), GBP (UK media). Covers >80% of target-market offer volume.

**Why not broader (CAD / AUD / JPY / etc.):** JPY (minor_unit=1) and KWD (minor_unit=1000) break the `* 100` formula. CAD and AUD work mechanically but add untested paths for marginal volume. 4A.3 lands a proper currency table (`currencies.code, minor_unit, display_symbol`) and replaces the inline whitelist with a DB-backed lookup.

**Flag in F4 header comment as `D-ACCEPT-7`.** The UI should also refuse to submit offers in unsupported currencies; that's a separate UI-side concern, not B2 scope.

### D8 — Stripe error classifier is a separate file from RPC errors

**Decision:** `src/lib/stripe/errors.ts` is net-new. Do NOT bolt onto `src/lib/offer/rpc-errors.ts`.

**Why:** Stripe errors dispatch on SDK-typed error instances (`err instanceof Stripe.errors.StripeCardError`). RPC errors dispatch on SQLSTATE + SQLERRM substring. Mixing them couples two unrelated vocabularies into one file.

### D9 — PI metadata carries forensic context

**Decision:** Stripe PI `metadata` field carries `{offer_id, buyer_id, creator_id, actor_handle, event_type: 'offer.accepted'}`.

**Why:** Stripe dashboards and webhook debuggers surface `metadata`. Post-incident forensics (and future 4A.3 webhook handlers) need the offer/actor context without having to join back to the DB.

**Keep `metadata` under 500 chars total.** Stripe caps at 500 chars per value + 50 keys total.

### D10 — Idempotency key is deterministic, persisted for audit

**Decision:** Key = `${offer.id}:accept` computed server-side on every call. Persisted to `offers.stripe_idempotency_key` on successful inner RPC for audit/forensics.

**Why:** The key is structurally deterministic from `offer.id`, so persistence is belt-and-braces, not functional. Audit queries ("what idempotency key did we use for this offer?") become trivial SELECTs instead of recomputes.

### D11 — Accept route accepts an empty-strict body

**Decision:** `AcceptOfferBody = z.object({}).strict()`. No buyer-note field, no buyer-selected payment method, no custom idempotency key.

**Why:** The accept action is a decision, not a payload. Unknown keys fail loud. If the UX later wants a buyer note, a single additive field change is trivial — premature extensibility here is noise.

### D12 — `canAccept` takes no `lastEventActorRef`

**Decision:** Mirror B1's D12 (`canCancel` simplification). `canAccept` checks party + state only.

**Why:** Accept is buyer-only; the buyer is authorized regardless of whose counter was last. No last-turn reconciliation is required. Keep the guard shape consistent with B1.

### D13 — F11 caller-audit threshold rule

**Decision:** The caller audit's outcome determines F11's fate deterministically. No founder ping mid-execution.

- **Zero live external callers** → ship F11 as commit 2 per the directive.
- **1-2 live external callers AND the migration is route-internal only (no UI component rewrite)** → migrate them to the new `/api/offers/**` surface inside B2, then ship F11.
- **>2 live external callers OR any live caller requires a UI component rewrite** → DEFER F11 entirely. Document the caller list in the exit report. Ship F1-F10 only.

**Why the threshold:** 1-2 route-internal callers is tidy-grade work; folding them in keeps B2 coherent. Anything larger is scope creep that risks destabilising the PR. The threshold makes the call deterministic and auditable.

**Claude Code does NOT ask for permission mid-audit.** The rule fires on audit results. Exit report documents which branch fired and why.

---

## §ACCEPTANCE CRITERIA

Every criterion is objectively verifiable. Exit report must address each by number.

1. **Typecheck clean.** `bun run typecheck` (or equivalent) returns zero errors. No `@ts-ignore`, no `any`, no suppression directives added.
2. **Lint clean.** `bun run lint` passes. No new suppressions.
3. **Build green.** `bun run build` completes without warnings that reference B2 files.
4. **Tests pass.** Full test suite (not just new tests) ends green. The canonical command is `bun run test` (which resolves to `vitest run` via `package.json`). **Do not run `bun test`** — that triggers Bun's native runner which bypasses `vitest.config.ts`'s env-boot setup and produces spurious failures. Establish the baseline at runtime: run `bun run test` at branch head BEFORE starting implementation and record the green + skipped counts. Post-B2 green count must be ≥ baseline-green + F9-tests + F10-tests. Post-B2 skipped count must be ≤ baseline-skipped (zero new skips). Both baseline numbers appear in the exit report.
5. **Migration applies cleanly.** `20260421000012_offer_accept_stripe.sql` applies forward without error on a fresh DB. Running it twice in sequence fails loudly (expected — migrations are not idempotent at the file level).
6. **Migration has no stray DDL.** Only the ALTER TABLEs, partial unique indexes, the RPC, its comment, and the GRANT/REVOKEs described in F1. No unrelated schema changes.
7. **Route error surface matches the table in F6.** Every listed code appears in at least one test assertion.
8. **PI is never created with `destination` / `transfer_data` / `on_behalf_of` / `application_fee_amount`.** F9 test #1 asserts this explicitly.
9. **Idempotency key matches `${offer.id}:accept` exactly.** F9 test #1 asserts this explicitly.
10. **Void uses the same idempotency key.** F9 test #3 asserts this explicitly.
11. **Reconcile log emits with all nine fields** (`offerId, buyerId, creatorId, paymentIntentId, idempotencyKey, dbCommitErrorCode, stripeVoidErrorCode, severity: 'critical', event: 'accept.reconcile_needed'`). F9 test #4 asserts this explicitly.
12. **`_emit_offer_event_with_retry` is called twice per successful accept** — once with `'offer'`, once with `'assignment'` — in that order. F5 implements this; F10 integration test can assert via ledger_events row inspection.
13. **Assignment row has `state = 'active'` on creation.** F10 integration test asserts.
14. **`offers.stripe_payment_intent_id` and `offers.stripe_idempotency_key` both non-NULL after successful accept.** F10 integration test asserts.
15. **Special-offer retirement ships as a separate commit** OR the exit report explicitly documents why F11 was deferred (with the caller list that blocked it).
16. **Zero changes to B1 files outside `state.ts`.** `git diff ec694ab..HEAD --stat` surfaces no modifications to: `src/lib/offer/rpc-errors.ts`, `src/lib/db/client.ts`, `src/lib/offer/composer.ts`, `src/app/api/offers/route.ts`, `src/app/api/offers/[id]/route.ts`, `src/app/api/offers/[id]/counter/route.ts`, `src/app/api/offers/[id]/reject/route.ts`, `src/app/api/offers/[id]/cancel/route.ts`. `state.ts` may have `canAccept` ADDED OR TIGHTENED to match F7's shape (buyer-only, party-check first), but no other changes.
17. **No unrelated file changes.** Every changed file is listed in F1-F11 or is a test file adjacent to one of them. No drive-by tidies, no lint autofixes on unrelated files, no README updates.
18. **Every new file has a header comment** in the B1 format: route, concern, scope, spec reference.
19. **No secrets in logs.** Grep the new code for `STRIPE_SECRET_KEY`, `secret`, `key` in log output — no hits. PI id and idempotency key are OK to log; the Stripe secret key is NOT.
20. **Sentry error instrumentation.** The reconcile-fail path fires Sentry via `@sentry/nextjs` (already installed) with the structured payload. F9 test #4 verifies.

---

## §CARRY-FORWARD FROM B1

The following B1-era concerns remain open and are NOT resolved by B2. They are logged here so they don't drop out of the backlog, not so B2 touches them:

- **D11 B1 — `state.ts lastEventActorRef` naming drift** (tidy backlog; zero callers). Unchanged by B2.
- **D4 B1 — Retry-After header on 429.** Unchanged. B2's 429 surfaces from Stripe rate-limit; Retry-After remains deferred.
- **Schema thickening for `OfferRejectedPayloadSchema` / `OfferCancelledPayloadSchema` to carry `reason_code` + `note`** — C2 decision point, unchanged.

---

## §A — EXECUTION PROTOCOL (TURN-BY-TURN)

B2 runs as **thirteen sequential prompts**, one per turn. The founder delivers each prompt to Claude Code, reviews the result, red-teams, and only then delivers the next prompt. No megaprompt. No batched deliverables. Each prompt has a single verifiable outcome and explicit return shape.

| # | Prompt | Purpose | Code? | Approval gate before next |
|---|---|---|---|---|
| 1 | Pre-flight audit + baseline | Verify the 12 pre-flight facts, run `bun run test`, record baseline | No | Founder red-teams audit report |
| 2 | F1 migration | Write migration 20260421000012 (ALTERs + indexes + RPC) and apply locally | Yes | Founder verifies migration applies cleanly |
| 3 | F2 install Stripe SDK | `bun add stripe`; record resolved SDK + apiVersion | Yes | Founder records the two version strings |
| 4 | F3 + F8 | Stripe client singleton + Stripe error classifier | Yes | Founder diffs both files against B1 patterns |
| 5 | F7 `canAccept` | Extend `state.ts` with `canAccept` guard | Yes | Founder verifies B1 state.ts is otherwise untouched |
| 6 | F4 orchestrator | `src/lib/offer/offer-accept.ts` | Yes | Founder reads the straddle top-to-bottom |
| 7 | F9 orchestrator tests | 5-branch Vitest file | Yes | Founder verifies all 5 branches green |
| 8 | F6 route handler | `src/app/api/offers/[id]/accept/route.ts` | Yes | Founder diffs against B1 counter route |
| 9 | F10 route tests | 11-case Vitest file | Yes | Founder verifies all 11 cases green |
| 10 | CI + commit 1 | typecheck + lint + build + full test suite, then commit F1-F10 | Yes | Founder verifies green; commit SHA recorded |
| 11 | F11 caller audit | Run grep, classify hits, fire D13 branch | No | Founder reviews caller list + which D13 branch fired |
| 12 | F11 execute OR defer | Delete + commit 2 OR document deferral | Yes/No | Founder verifies deletion is clean OR deferral is documented |
| 13 | Exit report | Structured AC1-AC20 + D1-D13 report | No | Founder red-teams full report before PR |

**Invariant:** Claude Code never skips ahead. Every prompt stops at the stated return shape and waits for the next prompt. If a prompt surfaces a blocker, STOP and return the blocker — do not improvise.

**The prompts themselves are delivered in chat**, not stored in this directive. This keeps the spec stable and the execution log live. The founder's chat record is the authoritative execution trail.

---

## §END

**Status: finalized. Ready for Claude Code.**

All thirteen decisions (D1-D13) are locked. All twenty acceptance criteria (AC1-AC20) are verifiable. Any post-run edit to F1-F11, D1-D13, or AC1-AC20 requires an explicit revision note at the top of this file.

The four pre-sign-off questions from the draft are resolved in-place:

- **D5 Stripe SDK version** → `bun add stripe` with no pin; apiVersion pinned to SDK default; both recorded in the exit report.
- **D7 currency whitelist** → `USD / EUR / GBP`.
- **F11 caller-audit policy** → D13 threshold rule (0 callers → ship; 1-2 route-internal → migrate + ship; >2 or UI rewrite → defer, document).
- **AC4 baseline** → runtime-established via `bun run test` at branch head; both counts recorded in the exit report.

**Next action:** paste §A into Claude Code on branch `feat/p4-economic-cutover` at `ec694ab`. Red-team the exit report before PR.
