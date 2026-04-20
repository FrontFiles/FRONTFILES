# T0.5 — Special Offer Decision Memo

**Date authored:** 2026-04-20
**Status:** draft — awaits João's answers to §Product questions before T4 can execute
**Tier origin:** T0.5 in [REMEDIATION_PLAN_20260418.md](REMEDIATION_PLAN_20260418.md)
**Feature gate:** A.3 (SPECIAL OFFER) per [FEATURE_APPROVAL_ROADMAP.md](../../FEATURE_APPROVAL_ROADMAP.md)

---

## Vocabulary

Path labels used throughout this memo and [REMEDIATION_PLAN_20260418.md](REMEDIATION_PLAN_20260418.md):

- **Path A — live persistence lock.** Special-offer and assignment state moves to Supabase behind the existing dual-mode pattern; A.3 re-locks at v1.0-scaffold with real persistence, with v1.0-live re-lock following once T1 / T2 close auth.
- **Path B — scaffolding-only de-scope.** The current in-memory `Map` stores are hard-gated to dev; prod routes return 501; A.3 does not re-lock until a separate live-persistence programme is scoped.
- **Path C — hybrid.** Special-offer takes Path A; assignment stays on Path B until the editorial-contract product brief is scoped.

---

## Subject systems

Audit finding cross-refs come from [CODEBASE_AUDIT_20260418.md](CODEBASE_AUDIT_20260418.md).

- `src/lib/special-offer/store.ts` — three module-level `Map`s, zero Supabase branch (audit B-1).
- `src/lib/assignment/store.ts` — `new Map(mockAssignments.map(...))` at module load, no Supabase branch (audit B-2).
- `src/app/api/special-offer/route.ts` — reads assets from `mockVaultAssets` fixture rather than `vault_assets` (audit B-3).

## Answer options (no ranking)

- **Path A — Live persistence.** Special-offer + assignment state moves to Supabase behind the dual-mode pattern already in post/identity/entitlement stores.
- **Path B — Scaffolding-only.** Current in-memory stores are treated as scaffolding; prod-route wiring is deleted and `Map` stores hard-gated to dev.
- **Path C — Hybrid.** Special-offer persists live; assignment stays scaffolding-only until the editorial contract product brief is scoped.

## Product questions

_Awaiting João's answers. Each question must have either an explicit answer or a dated deferral before T4 can start._

1. **Retention.** Are active special-offer threads and assignments intended to survive a Vercel deploy / Supabase failover / server restart?  — **[pending]**
2. **Audit obligations.** Does the editorial product commitment include an audit trail of negotiation events? — **[pending]**
3. **Asset source.** `vault_assets` exclusive, or dual-mode with a gate flag? — **[pending]**
4. **Assignment shape.** Single-shot brief or ongoing editorial contract? — **[pending]**
5. **Cutover semantics.** Restart-loss acceptable at cutover, or migration plan required? — **[pending]**

### Full text from plan T0.5 spec (authoritative)

The short-form summaries above are a quick-reference index. The authoritative question text below is transcribed verbatim from [REMEDIATION_PLAN_20260418.md](REMEDIATION_PLAN_20260418.md) §T0.5. João answers against these when filling in; the short-form versions above can be updated in parallel or left as index labels.

1. **Retention.** Are active special-offer threads and assignments intended to survive a Vercel deploy / a Supabase failover / a server restart? If "no" — state the reason and the expected demo horizon. If "yes" — proceed to Q2.
2. **Audit obligations.** Does the editorial product commitment include an audit trail of negotiation events (offer-sent, counter-sent, accepted, declined) that a journalist or buyer could later request? If yes, persistence is non-optional and `direct_offer_events` / `special_offer_events` must be wired.
3. **Asset source.** When the special-offer route resolves an asset, should it consult `vault_assets` (DB) exclusively, or should it continue to resolve through a seed fixture in dev? If dual-mode, is the flag `isSupabaseEnvPresent` (global) or a dedicated `FFF_REAL_OFFERS` gate (scoped)?
4. **Assignment shape.** Does "assignment" in the v1 spec mean a single-shot brief (commission one story for one fee) or an ongoing editorial contract (retainer, multi-delivery)? Persistence model, indexes, and lifecycle events differ. Answer before T4 begins.
5. **Cutover semantics.** If persistence is live and an in-memory offer already exists on a running instance at the moment of cutover, is restart-loss acceptable? If not, state the migration plan (replay from events, re-drive from `direct_offer_events`, or accept hard-cut).

---

## Front-end scope options

Three classes of front-end work, graded by when they can safely land relative to Path A (live persistence).

### Class 1 — Presentation polish (safe during Path A)

#### Inventory of the three Special Offer surfaces

| Surface | File | LOC | Status | One-line note |
|---|---|---|---|---|
| Creator vault list | `src/app/vault/offers/page.tsx` | 561 | **partial** | Visually on-brand (black / `#0000ff` / uppercase tracking, brutalist-leaning). State is seeded from **inline `mockThreads` / `mockEvents` constants** at [lines 25–95](../../src/app/vault/offers/page.tsx#L25), then mutated locally via `onThreadUpdate`; the page never issues a mount-time `GET /api/special-offer` — it only calls accept/counter/decline. No loading, error, or empty-plus-no-connection states. |
| Buyer inline CTA + modal | `src/components/asset/AssetRightsModule.tsx` (invoked by `src/app/asset/[id]/page.tsx`) | ~165 (module) / 149 (page) | **placeholder** | CTA at [AssetRightsModule.tsx:143–151](../../src/components/asset/AssetRightsModule.tsx#L143) opens an `OfferModal` (same file, [L172–209+](../../src/components/asset/AssetRightsModule.tsx#L172)). The modal's `handleSubmit` does `setSubmitted(true)` **without calling `POST /api/special-offer`** — no thread is created. Pure UI stub. |
| Shared Special Offer components | — | 0 | **placeholder** | No `src/components/special-offer/` directory exists. `ThreadCard`, `NegotiationEvent`, and status-pill rendering are inline in `vault/offers/page.tsx`; offer entry is inline in `AssetRightsModule.tsx`. Zero reuse between creator and buyer sides. |

Also adjacent: `src/app/checkout/[assetId]/page.tsx` (402 LOC) is **polished** on the happy path as the handoff consumer; it is not itself a Special Offer surface but the flow terminus. Residue: label `"Direct Offer banner"` ([checkout/[assetId]/page.tsx:166](../../src/app/checkout/[assetId]/page.tsx#L166)) and comment `/** Direct Offer handoff — negotiated amount in EUR cents */` ([:30](../../src/app/checkout/[assetId]/page.tsx#L30)) — J-category residue left after P1–P5.

#### Minimal Class 1 scope — bring all three surfaces to the Frontfiles editorial standard

Frontfiles editorial standard, as inferred from the existing vault/offers + checkout surfaces: brutalist-leaning, black / blue `#0000ff` / white, uppercase tracking-widest labels, minimal decoration, monospace for numbers, hard borders over shadows, 10px–12px body text with bold-to-communicate-hierarchy.

**Proposed file list:**

1. **Create `src/components/special-offer/` directory** with four extracted components:
   - `ThreadCard.tsx` — extracted from [vault/offers/page.tsx:234+](../../src/app/vault/offers/page.tsx#L234). Used on creator surface now; re-usable on a future buyer "my offers" surface.
   - `NegotiationTimeline.tsx` — extracted from the `events.map(evt => <NegotiationEvent .../>)` inside `ThreadCard`.
   - `OfferAmountDisplay.tsx` — the `€{(amount/100).toFixed(2)}` mono-bold price block used in ~5 places across vault/offers + checkout + (future) modal.
   - `OfferStatusBadge.tsx` — the `inline-flex items-center text-[9px] font-bold uppercase` status pill, driven by `STATUS_STYLES` map.
2. **Harden `OfferModal` in `AssetRightsModule.tsx`** — wire `handleSubmit` to `POST /api/special-offer`, display server-returned validation errors, handle the already-exists case (server returns the existing thread), success-state navigation to `/vault/offers#thread-<id>` (or creator-side equivalent for buyer). This is the only Class 1 item that calls a write API — keeps it inside the "presentation polish" frame because no new state shape is introduced; the API already exists and the modal already has form state.
3. **Polish `vault/offers/page.tsx` partition headers** — the `Active (N)` / `Resolved (N)` labels are 10px uppercase tracking-widest slate-400; lift them to sticky section heads with a thin black rule above, matching the brutalist-stripe pattern used in vault sidebar.
4. **Empty-state redesign** — the `<EmptyPanel message="No resolved offers" />` fallback ([vault/offers/page.tsx:220](../../src/app/vault/offers/page.tsx#L220)) uses the generic platform empty panel; replace with a Special-Offer-specific zero-state copy ("No resolved offers yet. Accepted and declined offers will appear here.").
5. **J-residue sweep on checkout** — rename `"Direct Offer banner"` → `"Special Offer banner"` ([checkout/[assetId]/page.tsx:166](../../src/app/checkout/[assetId]/page.tsx#L166)) and update the inline comment at [:30](../../src/app/checkout/[assetId]/page.tsx#L30) + [:84](../../src/app/checkout/[assetId]/page.tsx#L84) + [:119](../../src/app/checkout/[assetId]/page.tsx#L119). No behavioural change; this closes 4 lines of J-residue inside the checkout flow that is already in Path A's touch surface.

**Estimated calendar days at full-time pace:** **3 days.**
- Day 1 — extract 4 shared components (1, above) + adopt them in `vault/offers/page.tsx`. No visual regression expected (extraction is mechanical).
- Day 2 — wire `OfferModal` to `POST /api/special-offer`, test creator-receives-thread flow end-to-end against the mock store (2, above).
- Day 3 — partition header polish + empty state + J-residue sweep + visual QA at small / medium / large breakpoints (3, 4, 5 above).

### Class 2 — State-binding UI (post-T4)

#### Does a typed adapter boundary exist?

**No.** UI components call the HTTP API directly via `fetch('/api/special-offer/...')` with inline response typing. Evidence:

- `src/app/vault/offers/page.tsx:333` — `await fetch('/api/special-offer/${thread.id}/accept', …)` then `const { data } = await res.json()` — no shared client.
- `src/app/vault/offers/page.tsx:385` — same pattern for counter.
- `src/app/vault/offers/page.tsx:446` — same pattern for decline.
- `src/components/asset/AssetRightsModule.tsx` — the buyer `OfferModal` has no `fetch` call at all; the server is never reached.

Compare with `src/lib/post/client.ts` ([:64](../../src/lib/post/client.ts#L64), [:212](../../src/lib/post/client.ts#L212)) — the `post` domain has a typed client module. The `special-offer` domain does not have an equivalent file. There is no `src/lib/special-offer/client.ts`; imports from `@/lib/special-offer/*` are all server-side (from the API routes themselves, per the audit's import grep).

#### Conclusion — flag as T4 prerequisite

Introducing `src/lib/special-offer/client.ts` is a **T4 prerequisite**, not a separate refactor. The reason: the moment `store.ts` gains a Supabase branch (Path A of T4), the UI cannot meaningfully switch from "inline mock + local state updates" to "load from server, refresh on event" without a typed adapter to consume. Without the adapter, every call-site in `vault/offers/page.tsx` would re-implement the fetch + parse + error-handling inline, multiplying the drift risk.

**Proposed adapter shape (to land inside T4, not before):**

```ts
// src/lib/special-offer/client.ts — T4 introduces this
export async function listThreadsForCreator(creatorId: string):
  Promise<{ thread: SpecialOfferThread; events: SpecialOfferEvent[] }[]>

export async function listThreadsForBuyer(buyerId: string):
  Promise<{ thread: SpecialOfferThread; events: SpecialOfferEvent[] }[]>

export async function createOffer(input: CreateOfferInput):
  Promise<{ thread: SpecialOfferThread; events: SpecialOfferEvent[] }>

export async function respondToOffer(
  threadId: string,
  action: 'accept' | 'counter' | 'decline',
  payload: AcceptPayload | CounterPayload | DeclinePayload,
): Promise<{ thread: SpecialOfferThread; events: SpecialOfferEvent[] }>
```

Every UI call-site swaps its inline `fetch` for one of these four functions. Once T4 Branch A lands and `store.ts` is DB-backed, the `list*` functions return real rows; without the adapter there is no clean swap.

**Fields / shapes most likely to change between in-memory and DB-backed persistence** (cited from `src/lib/types.ts` `SpecialOfferThread` / `SpecialOfferEvent`):

- `createdAt`, `updatedAt`, `resolvedAt` — currently ISO strings produced by `new Date().toISOString()` in JS; DB will populate via `now()` in Postgres. String shape stays; drift risk is tz-handling edge cases.
- `expiresAt` — currently `new Date(Date.now() + N * 60_000).toISOString()` at thread open; DB will compute via trigger or deterministic column. Shape stays.
- `amount` fields (`listedPriceAtOpen`, `currentOfferAmount`, `acceptedAmount`) — integer cents in both. Shape stays.
- `checkoutIntentId` — today `null` until accept; DB adds FK constraint to `offer_checkout_intents` table. Nullable shape stays.
- `metadata` on events — currently `null` in all mock events; DB column is `jsonb`. Real shape emerges once we commit to structured event metadata (e.g., decline reason codes, IP-hash audit, user-agent).
- `autoCancelReason` — string discriminator; DB must enum-constrain.

### Class 3 — Flow / UX architecture

#### Literal behaviour of the checkout handoff at `/checkout/[assetId]`

**Route:** `src/app/checkout/[assetId]/page.tsx` — `'use client'`, `export const dynamic = 'force-dynamic'`.

**Params it reads:**
- `params.assetId` — from path.
- `searchParams.get('offerAmount')` — offer amount in cents, `parseInt(..., 10)`.
- `searchParams.get('licence')` — cast to `LicenceType | null` (no Zod).
- `searchParams.get('threadId')` — string.

**Assumed state at entry:**
1. An asset exists in `mockVaultAssets.find(a => a.id === assetId)` — otherwise renders "Asset not found."
2. If `offerAmountParam && offerLicenceParam` both present → **offer handoff mode**: skips the `licence_selection` step, enters at `declaration_review`, sets `selectedLicence = offerLicenceParam`, shows the "Direct Offer banner" (J residue), and overrides pricing with `offerAmountCents`.
3. If absent → standard list-price checkout from asset row's `creatorPrice`.

**State machine:** reducer over 5 steps (`licence_selection → declaration_review → confirm_before_signing → price_confirmation → payment_capture`). `GO_BACK` action has one guard: in offer-handoff mode, it cannot reach `licence_selection` (the licence was already agreed upstream).

**Economics:**
- `basePrice = state.offerAmount ?? asset.creatorPrice ?? 0`
- `buyerMarkup = round(basePrice * PLATFORM_FEES.direct.buyerMarkup)` — note the key `direct.*` is J-residue
- `buyerPays = basePrice + buyerMarkup`
- `creatorReceives = basePrice - round(basePrice * PLATFORM_FEES.direct.creatorFee)`

**Payment:** `COMPLETE_PAYMENT` reducer action flips `paymentComplete: true` — there is no real payment plumbing; no Stripe call, no webhook round-trip. The "Certified Package will be delivered" copy is a placeholder.

#### Dependency decomposition

| Flow concern | Blocked by | Why |
|---|---|---|
| "Who is the buyer committing to this offer?" | **T1 / T2 (session identity)** | The checkout page currently renders identically regardless of actor; `buyerId` is never resolved. Once T1 lands, the actor must be authenticated before `payment_capture` can honour the agreed price. Until T2 flips `AUTH_WIRED=true`, this flow is behind a 501 wall. |
| "Does this URL's `offerAmount` match the agreed thread price?" | **T4 (persistent offer state)** | Today the query param is trusted. A buyer can navigate to `/checkout/asset-001?offerAmount=1&licence=editorial&threadId=anything` and the page accepts it. Closing this tamper vector requires fetching the thread by `threadId` and verifying `thread.acceptedAmount === offerAmountCents` — which requires the thread to exist in a real store readable by the authenticated buyer. That is T4. |
| "Does the buyer see 'their' past offers on a buyer-side inbox?" | **T4** | No buyer-side offer inbox exists today. `vault/offers` is creator-only. A buyer surface needs DB-backed querying for a buyer's threads — impossible against an in-memory `Map` that evaporates on restart. |
| "Visual polish, component extraction, shared primitives" | **neither — safe during Path A** | Class 1 scope. Does not touch actor resolution or persistence shape. |
| "Expiry countdown precision, resolve-time race" | T4 | Today `formatTimeRemaining` computes from `thread.expiresAt` client-side; server state can drift since the `expiresAt` value is written once at thread open (JS `Date.now()`). Post-T4 this becomes a Postgres-computed column and server truth. |

---

## Conclusion — what to bundle into Path A without expanding the calendar by more than 2 days

Path A is "Live persistence for special-offer and assignment" (T4 Branch A). Bundling Class 1 items is safe because they do not depend on session identity (T1/T2) and do not change the store interface that T4 is wiring.

**Bundle into Path A (estimated additive budget: ≤ 2 days):**

1. **Shared-component extraction — typed against a canonical spec-derived interface, not `store.ts` row shape** — `ThreadCard`, `NegotiationTimeline`, `OfferAmountDisplay`, `OfferStatusBadge` into `src/components/special-offer/`. Components **must** be typed against a **minimal canonical interface derived from [SPECIAL_OFFER_SPEC.md](../../SPECIAL_OFFER_SPEC.md)**, not against the current `store.ts` return shape. This is what makes the components survive T4 without rework: `store.ts` row shape will change (snake_case rows, nullable columns, jsonb metadata, Postgres-side timestamps), but the rendered fields will not.

   **Proposed canonical interfaces (minimal — only fields the components actually render):**

   ```ts
   // src/components/special-offer/types.ts — UI canonical contract
   //
   // Derived from SPECIAL_OFFER_SPEC.md §A/§B/§C, NOT from
   // src/lib/db/schema.ts. A mapper in src/lib/special-offer/client.ts
   // (introduced by T4-day-1) adapts SpecialOfferThread → ThreadState
   // and SpecialOfferEvent → EventState.

   export type OfferActor = 'buyer' | 'creator' | 'system'
   export type OfferParty = 'buyer' | 'creator'

   export interface AmountState {
     cents: number
     currency: 'EUR'         // spec v1 locks to EUR
   }

   export interface ThreadState {
     id: string
     status: SpecialOfferStatus   // taxonomy from spec §B.2
     roundCount: number
     maxRounds: number            // 3 per spec §B.1 / SPECIAL_OFFER_MAX_ROUNDS
     licenceType: LicenceType
     listedPriceAtOpen: AmountState
     currentOffer: { amount: AmountState; by: OfferParty }
     expiresAt: string | null     // ISO; null once terminal
   }

   export interface EventState {
     id: string
     type: SpecialOfferEventType
     actor: OfferActor
     amount: AmountState | null
     message: string | null
     createdAt: string            // ISO
   }
   ```

   **Fields deliberately NOT on these interfaces** — even though present on `SpecialOfferThread` today: `buyerId`, `creatorId`, `assetId`, `createdAt`, `updatedAt`, `resolvedAt`, `acceptedAmount`, `checkoutIntentId`, `autoCancelReason`, `creatorResponseWindowMinutes`, `metadata`. Rationale: these drive navigation, routing, audit, and state-machine logic — **not rendering**. They stay on `SpecialOfferThread` (transport/DB row shape) but do not leak into component props. This is the canonical-vs-transport distinction that keeps Class-1 components stable under T4.

   **~1 day** (extraction + mapper + call-site adoption in `vault/offers/page.tsx`).
2. **J-residue sweep on checkout** — rename `"Direct Offer banner"` / inline comments. 4 lines total in `src/app/checkout/[assetId]/page.tsx`. **~0.25 day.** Already in Path A's touch surface.
3. **Empty-state redesign on `vault/offers`** — replace `<EmptyPanel .../>` with Special-Offer-specific zero-state. **~0.25 day.**
4. **`OfferModal` wiring — Class 2 work bundled under exception.** Buyer-side `POST /api/special-offer` hookup with server validation / error handling. **~0.5 day.** This item is explicitly **Class 2 work, not Class 1**, bundled into Path A only under the exception below:

   > Wiring the modal now creates real threads against the in-memory `Map` store. Every server restart evaporates them. **Internal demo users (founder + internal collaborators) will hit this** — the v1.0-scaffold never reaches external counterparties (see §v1.0-scaffold lock doc — required disclosures). When T4 lands, the `POST` call-site reworks — but that is a single point of change, not a scatter. This tradeoff is accepted only because Path A without wire-up is not actually demoable *internally*: a creator-side `/vault/offers` page that can accept / counter / decline is meaningless if no buyer can ever create a thread. Without Item 4, Path A ships half a feature.

   The exception is bounded: Item 4 touches exactly one call-site (`OfferModal.handleSubmit` in `src/components/asset/AssetRightsModule.tsx`) and it gets rewritten once when T4 lands. No other buyer-side write call-sites are added in Path A. If the exception's scope expands mid-implementation, revisit.

**Total additive budget:** ~2 days. Fits the 2-day cap.

**Explicitly NOT bundled (do not attempt inside Path A):**

- **Adapter boundary (`src/lib/special-offer/client.ts`)** — this IS part of T4 proper (prerequisite), not a bundleable polish item. Treat as T4-day-1 work.
- **Checkout URL-param tamper closure** — requires DB-backed thread verification; lives entirely inside T4 Branch A. Not a polish item.
- **Buyer-side offer inbox** — new product surface; outside Path A scope.
- **Real payment plumbing in `/checkout/[assetId]`** — this is Phase 5 Stripe work, gated on G4 per [ROADMAP.md](../../ROADMAP.md). Do not touch.
- **Partition header polish on `vault/offers`** — deferred from the Class-1 list above; nice-to-have that doesn't fit the 2-day cap when weighed against the other four items.

---

## v1.0-scaffold lock doc — required disclosures

**The v1.0-scaffold lock is an internal versioning artifact.** It does not constitute a public release or allowlist beta launch. External counterparties do not access the scaffold implementation.

With that framing, if Path A (or the Path C `A.special-offer` phase) ships and the A.3 feature gate is re-locked at a **v1.0-scaffold** level rather than v1.0-live, the accompanying lock doc must carry the explicit disclosures below. This list is **not** the lock doc itself — it is the **required-disclosure checklist** that governs drafting of the lock doc later.

| # | Required disclosure | Source / evidence | Closes when |
|---|---|---|---|
| 1 | Offer state is held in an in-memory `Map` (`src/lib/special-offer/store.ts`). **Offer state does not survive server restart, deploy, instance swap, or scale-out.** (Affects only internal demo state; no external user is ever exposed to the failure mode.) | Audit B-1; memo §Subject systems | T4 |
| 2 | `POST /api/special-offer` resolves assets from the `mockVaultAssets` fixture (`src/lib/mock-data.ts`), **not from the `vault_assets` table.** Real-creator assets are not offerable through the scaffold. (Internal development-time limitation.) | Audit B-3; memo §Subject systems | T4 |
| 3 | `/checkout/[assetId]` accepts `?offerAmount=&licence=&threadId=` as trusted query params **without verifying them against the thread record.** Price-tamper surface exists inside the scaffold; it does not reach external users because the scaffold is not externally routed. | Memo §Class 3 | T4 (requires thread verification via typed client) |
| 4 | Authentication is header-trust (`x-frontfiles-user-id`) + body-identity (`buyerId` / `actorId` / `requesterId` / `responderId` / `authorId`). **Impersonation surface exists inside the scaffold.** It does not reach external users because no external caller is routed to scaffold API paths. | Audit A-2 / A-3; REMEDIATION_PLAN §Grounding A/B | T1 (501 wall) → T2 (real session) |
| 5 | **No external access.** The scaffold is reachable only via development origins, staging origins, and localhost. Production domains do not route any caller to scaffold API paths. There is no allowlist beta, no soft-launch, and no external-counterparty tier during v1.0-scaffold. | Lock-doc obligation | v1.0-live re-lock (T1 + T2 + T4) |
| 6 | **v1.0-scaffold is explicitly an internal versioning artifact, not v1.0-live.** A separate lock pass at v1.0-live must be executed once T1, T2, and T4 have closed disclosures 1–4. v1.0-scaffold does **not** constitute a public release, allowlist beta, or soft-launch under any circumstances. | Governance; the ladder in PLATFORM_REVIEWS.md | T1 + T2 + T4 |

Any lock doc drafted without all six disclosures, or drafted in a way that describes v1.0-scaffold as an external-facing release tier, is **non-conformant** with this memo's governance intent. The disclosure numbers above are the headings the lock doc should carry verbatim.

---

## Path cost — grounded estimate

**Pace assumption:** João available full-time (all-day + evenings), reviews 3–4 tier PRs per day, takes one rest day per week → **6 working days per calendar week**. Estimates are ranges, not point commitments — scope creep, integration surprises, and review cycles compound.

### Path A — live persistence

Path A is not just T4 Branch A in isolation. Shipping it in a demoable, non-impersonable form requires its sequenced prerequisites (T0, T0b, T1, T2, T3) and the 2-day polish bundle. The tiers compose:

| Tier | Working-day range | Notes |
|---|---|---|
| T0 | 0.5–1 | Delete unsigned webhook + sanitise 3 `api-helpers` error bodies |
| T0b | 0.25 | `package.json` only |
| T1 | 2–3 | `requireActor` stub + 19-route sweep; mechanical but test-heavy |
| T1b | 0.5 | Memo only |
| T2 | 4–6 | Supabase SSR wiring + cookie / JWT resolution + 14 `requireGrant` adoptions |
| T2b | 0.5 | Memo only |
| T3 | 3–4 | `userClient` factory + 15 call-site migrations + justification audit |
| T4 Branch A — core | 5–7 | Dual-mode `store.ts` on special-offer + assignment + mappers + integration tests + route rewire against `vault_assets` |
| T4 Branch A — bundled polish | 2 | Class-1 extraction + J-sweep + empty state + `OfferModal` wire-up (Item 4 exception) |
| Buffer (QA, bugfix, review churn) | 3–5 | Unknown-unknowns; compound on T2/T3/T4 boundaries |
| **Total** | **21–29 working days** | |

At 6 working days per calendar week → **Path A top-line range: ~3.5–5 calendar weeks.**

### Path B — scaffolding-only

Path B is a de-scope: hard-gate the `Map` stores to dev, delete prod wiring, accept that the offer surface is not a live feature.

| Tier | Working-day range | Notes |
|---|---|---|
| T0 | 0.5–1 | Same as Path A |
| T0b | 0.25 | Same as Path A |
| T4 Branch B | 2–3 | `FFF_DEV_STORES_ENABLED` gate + prod-route 501 + remove `mockVaultAssets` import in route |
| Buffer | 1 | |
| **Total** | **4–5 working days** | |

At 6 working days per calendar week → **Path B top-line range: ~1 calendar week.**

### Path C — hybrid

Scope depends on which domain persists. If `special-offer` persists but `assignment` stays scaffolding-only: roughly Path A minus ~2 working days (one store instead of two; one integration-test surface instead of two). **Hybrid top-line range: ~3–4.5 calendar weeks.**

### Caveats on these estimates

- These ranges assume no blocking answer is missing from §Product questions. If Q4 (assignment shape) is still pending when T4 starts, the assignment side of Path A cannot proceed and the schedule collapses toward Path C.
- Any scope added during implementation (new feature asks, design revisions, a real Stripe attach) pushes the top end up by proportional amounts — the estimates do NOT include feature scope beyond what the memo enumerates.
- The buffer line is deliberately wide (3–5 days): historically the T2/T3/T4 boundary surfaces integration friction that reducer-level testing does not catch.

---

_End of memo. João: fill in the five §Product questions answers before T4 starts._
