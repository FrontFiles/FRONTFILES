# A.3 Special Offer — Drift Audit

**Date:** 2026-04-23
**Scope:** audit-only; no code changes, no PR.
**Dispatch:** D1/D2/D3 reconciliation of claimed drift surfaced in `A5_FFF_DESIGN_AUDIT_2026-04-23.md` §7.2 / Special Offer audit (this session, pre-dispatch).
**Authority stack consulted:** `SPECIAL_OFFER_SPEC.md` v1.0; `docs/specs/ECONOMIC_FLOW_v1.md` §4; `PLATFORM_BUILD.md` State Machines §row 5; `FEATURE_APPROVAL_ROADMAP.md` §A.0 (P3, P4) and §A.3; `docs/audits/P4_UI_DEPRECATION_AUDIT.md` Draft 1 §2.1 / §3.1; `docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md` Draft 3.1.

---

## §0 — Headline

**The "drift" surfaced in the prior audit (D1/D2/D3) is not drift of the ordinary "code diverged from spec" kind.** The repo contains **two parallel engineering programs** occupying the A.3 Special Offer domain simultaneously:

- **System 1 — `SpecialOffer` (legacy, post-A.0-P3 rename from `DirectOffer`).** Lives in `src/lib/special-offer/**`, `src/lib/types.ts` (`SpecialOffer*` types), `src/lib/db/schema.ts` (`SpecialOffer*Row`), `src/app/api/special-offer/**`. 8-state model per `SPECIAL_OFFER_SPEC.md` §E.2. A.0-P3 landed 2026-04-18 (per `FEATURE_APPROVAL_ROADMAP.md:120-130`); A.0-P4 landed the types sweep (per L135-142).
- **System 2 — `Offer` (new, `ECONOMIC_FLOW_v1.md`-aligned).** Lives in `src/lib/offer/**`, `src/app/api/offers/**`. 6-state model per `ECONOMIC_FLOW_v1.md` §4. Delivered by P4 concern 4A.2 Parts A / B1 / B2; detail-UI half in flight as directive `P4_CONCERN_4A_2_C2_DIRECTIVE.md` Draft 3.1.

System 1 is slated for retirement at P4 cutover per `P4_UI_DEPRECATION_AUDIT.md` §2.1. System 2 is the forward target. Both are presently loaded in the repo because the migration has not yet cutover.

**But** — within System 2 itself, there is a genuine secondary drift: the six-state enum's first-state name disagrees across its own authorities (`PLATFORM_BUILD.md` says `pending`; `ECONOMIC_FLOW_v1.md` §4 says `sent`; code says `sent`). That is an intra-System-2 ambiguity worth locking.

Verdicts summarised in §5.

---

## §1 — D1: State count matrix

### §1.1 Every state from every source

Matrix: `state_name × source × code_presence`. Each row is one distinct state name as it appears in at least one authority. Columns:

| Column | Meaning |
|---|---|
| `SPEC_v1` | State name appears in `SPECIAL_OFFER_SPEC.md` §E.2 (authority line numbers: [SPECIAL_OFFER_SPEC.md:411-425](SPECIAL_OFFER_SPEC.md:411)). |
| `ECON_§4` | State name appears in `ECONOMIC_FLOW_v1.md` §4 state-machine table ([L37-47](docs/specs/ECONOMIC_FLOW_v1.md:37)). |
| `PB` | State name appears in `PLATFORM_BUILD.md` State Machines §row 5 ([L74](PLATFORM_BUILD.md:74)). |
| `TYPES` | Appears in `src/lib/types.ts` (System 1 `SpecialOfferStatus` union at [types.ts:88-96](src/lib/types.ts:88)). |
| `OFFER_TYPES` | Appears in `src/lib/offer/types.ts` (System 2 `OfferState` union at [offer/types.ts:49-56](src/lib/offer/types.ts:49)). |
| `SCHEMA` | Appears as a string-typed column value annotated in `src/lib/db/schema.ts` ([L355-374](src/lib/db/schema.ts:355)). |

Matrix:

| State name | `SPEC_v1` | `ECON_§4` | `PB` | `TYPES` | `OFFER_TYPES` | `SCHEMA` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `buyer_offer_pending_creator` | ✓ | — | — | ✓ | — | via status (string-typed) |
| `creator_counter_pending_buyer` | ✓ | — | — | ✓ | — | via status |
| `buyer_counter_pending_creator` | ✓ | — | — | ✓ | — | via status |
| `accepted_pending_checkout` | ✓ | — | — | ✓ | — | via status |
| `declined` | ✓ | — | — | ✓ | — | via status (+ `TERMINAL_OFFER_STATUSES`) |
| `auto_cancelled` | ✓ | — | — | ✓ | — | via status (+ `auto_cancel_reason` column) |
| `completed` | ✓ | — | — | ✓ | — | via status (+ `TERMINAL_OFFER_STATUSES`) |
| `expired` | ✓ | ✓ | ✓ | ✓ | ✓ | via status |
| `draft` | — | ✓ (client-only, not persisted) | — | — | — | — (not persisted) |
| `sent` | — | ✓ | — | — | ✓ | — (new `offers` table, not in legacy schema) |
| `countered` | — | ✓ | ✓ | — | ✓ | — (new table) |
| `accepted` | — | ✓ | ✓ | — | ✓ | — (new table) |
| `rejected` | — | ✓ | ✓ | — | ✓ | — (new table) |
| `cancelled` | — | ✓ | ✓ | — | ✓ | — (new table) |
| `pending` | — | — | ✓ | — | — | — (contradicts ECON_§4 / code — see §1.4) |

### §1.2 Citations

- **`SPECIAL_OFFER_SPEC.md` §E.2:**
  - [L417](SPECIAL_OFFER_SPEC.md:417): `buyer_offer_pending_creator | Creator`
  - [L418](SPECIAL_OFFER_SPEC.md:418): `creator_counter_pending_buyer | Buyer`
  - [L419](SPECIAL_OFFER_SPEC.md:419): `buyer_counter_pending_creator | Creator`
  - [L420](SPECIAL_OFFER_SPEC.md:420): `accepted_pending_checkout | Buyer (checkout)`
  - [L421-425](SPECIAL_OFFER_SPEC.md:421): `declined`, `expired`, `auto_cancelled`, `completed` — terminal.
  - **Total: 8 states.**
- **`ECONOMIC_FLOW_v1.md` §4:**
  - [L41-47](docs/specs/ECONOMIC_FLOW_v1.md:41): `draft` (client-only), `sent`, `countered`, `accepted`, `rejected`, `expired`, `cancelled`.
  - **Total: 6 persisted + 1 client-only draft.**
- **`PLATFORM_BUILD.md`:**
  - [L74](PLATFORM_BUILD.md:74): `| Offer | 6: pending, countered, accepted, rejected, expired, cancelled | Spec S10.4 |`.
  - **Total: 6 states named. Note:** names do NOT byte-match `ECONOMIC_FLOW_v1.md` §4 (`pending` vs `sent`). Attribution is "Spec S10.4" but the Canonical-Spec §10.4 clause maps to the 8-state System 1 per `SPECIAL_OFFER_SPEC.md` header (`Authority: Canonical Specification v1.1 — Spec 6.5, 6.6, 7.4, 8.7, 9.6, 10.1, 10.4, 10.5`). See §1.4 for the surfaced contradiction.
- **`src/lib/types.ts`:**
  - [L88-96](src/lib/types.ts:88): `SpecialOfferStatus` union — 8 members matching `SPECIAL_OFFER_SPEC.md` §E.2 byte-for-byte.
  - [L98-107](src/lib/types.ts:98): `SPECIAL_OFFER_STATUS_LABELS` record — 8 keys, UX-facing labels.
  - [L109-111](src/lib/types.ts:109): `TERMINAL_OFFER_STATUSES` — 4 terminal (`declined`, `expired`, `auto_cancelled`, `completed`).
- **`src/lib/offer/types.ts`:**
  - [L49-56](src/lib/offer/types.ts:49): `OfferState` union — 6 members matching `ECONOMIC_FLOW_v1.md` §4 byte-for-byte.
- **`src/lib/special-offer/types.ts`:**
  - [L51-80](src/lib/special-offer/types.ts:51): `VALID_OFFER_TRANSITIONS` record — 8 keys, fully-enumerated transition graph matching `SPECIAL_OFFER_SPEC.md` §E.1.

### §1.3 Verdict on D1 (state count 8 vs 6)

**Not drift in the "code diverged from spec" sense.** Two distinct programs each declare a state model:

- **System 1 (8 states):** Authority = `SPECIAL_OFFER_SPEC.md` v1.0 + Canonical Spec §10.4 as referenced there. State model is rich/turn-aware (`*_pending_*` names carry whose-turn-it-is information). Code realisations: `src/lib/types.ts` + `src/lib/special-offer/**` + `/api/special-offer/**` routes. Has a reducer (`src/lib/special-offer/reducer.ts`) that honours the 8-state transition table.
- **System 2 (6 states):** Authority = `ECONOMIC_FLOW_v1.md` §4. State model is simpler/enum-only (whose-turn-it-is is derived from `current_offer_by` + side at runtime, not encoded in the state name). Code realisations: `src/lib/offer/**` + `/api/offers/**` routes (Supabase-backed, RPC-guarded).

Each system is internally consistent and each maps to its own spec byte-exactly. The 8-vs-6 "drift" dissolves once you recognise that System 1 is slated for retirement and System 2 is the forward target (see §2 + §3).

### §1.4 CRITICAL FLAG-39 / FLAG-26 surface — intra-System-2 ambiguity

`PLATFORM_BUILD.md` [L74](PLATFORM_BUILD.md:74) and `ECONOMIC_FLOW_v1.md` §4 [L41-47](docs/specs/ECONOMIC_FLOW_v1.md:41) disagree on the first-state name of the 6-state enum. Neither clearly references the other; both claim "6 states" but name them differently:

| Position | `PLATFORM_BUILD.md:74` | `ECONOMIC_FLOW_v1.md` §4 | `src/lib/offer/types.ts:49-56` |
|---|---|---|---|
| 1 (first persisted) | `pending` | `sent` | `sent` |
| 2 | `countered` | `countered` | `countered` |
| 3 | `accepted` | `accepted` | `accepted` |
| 4 | `rejected` | `rejected` | `rejected` |
| 5 | `expired` | `expired` | `expired` |
| 6 | `cancelled` | `cancelled` | `cancelled` |

`PLATFORM_BUILD.md`'s attribution ("Spec S10.4") is ambiguous: Canonical Spec §10.4 is the same section `SPECIAL_OFFER_SPEC.md` cites for the 8-state system. If §10.4 upstream has 8 states, then `PLATFORM_BUILD.md` mis-cites. If §10.4 has 6 with `pending`, then `ECONOMIC_FLOW_v1.md` and the code drift away from upstream.

**Per FLAG-26: byte-exact prescribed text (`pending` vs `sent`) diverges across in-repo authorities. I do not reverse-engineer which is right.** The code matches `ECONOMIC_FLOW_v1.md`. `PLATFORM_BUILD.md` does not.

**Per FLAG-39: surfacing contradiction, not silently picking.** Options (not decided in this audit):

1. `PLATFORM_BUILD.md:74` typo-fix: `pending` → `sent`. Assumes ECON is authoritative.
2. `ECONOMIC_FLOW_v1.md` §4 rename: `sent` → `pending`. Assumes PLATFORM_BUILD is authoritative. Cascades into code + migrations.
3. Canonical Spec §10.4 (upstream Notion) is the tiebreaker — read it; pick whichever in-repo spec matches; fix the other.

This contradiction is **live right now** and would make any net-new work on System 2 state-copy (e.g., C2 directive §F1 `@/lib/offer/state-copy`) pick one arbitrarily. Decision recommended before C2 Prompt 6.

---

## §2 — D2: Route-path enumeration

### §2.1 Every offer-adjacent route file in the repo

**System 1 — `/api/special-offer/*` (4 route files, post-A.0-P3 rename):**

| # | Route | File | References `@/lib/special-offer/*` |
|---|---|---|---|
| 1 | `POST /api/special-offer` (create) + `GET /api/special-offer` (list) | [src/app/api/special-offer/route.ts](src/app/api/special-offer/route.ts) | ✓ services, store, api-helpers |
| 2 | `POST /api/special-offer/[id]/accept` | [src/app/api/special-offer/[id]/accept/route.ts](src/app/api/special-offer/[id]/accept/route.ts) | ✓ |
| 3 | `POST /api/special-offer/[id]/counter` | [src/app/api/special-offer/[id]/counter/route.ts](src/app/api/special-offer/[id]/counter/route.ts) | ✓ |
| 4 | `POST /api/special-offer/[id]/decline` | [src/app/api/special-offer/[id]/decline/route.ts](src/app/api/special-offer/[id]/decline/route.ts) | ✓ |

Route family count: 4 (create, accept, counter, decline). Matches `P4_UI_DEPRECATION_AUDIT.md` §2.1 and `ECONOMIC_FLOW_v1.md` §17 retirement list.

**System 2 — `/api/offers/*` (6+ route files, P4 concern 4A.2 Part B1 + B2):**

| # | Route | File | References `@/lib/offer/*` |
|---|---|---|---|
| 1 | `POST /api/offers` (create) + `GET /api/offers` (list) | [src/app/api/offers/route.ts](src/app/api/offers/route.ts) | ✓ types, composer, rights, rpc-errors |
| 2 | `GET /api/offers/[id]` (detail) | [src/app/api/offers/[id]/route.ts](src/app/api/offers/[id]/route.ts) | ✓ |
| 3 | `POST /api/offers/[id]/accept` | [src/app/api/offers/[id]/accept/route.ts](src/app/api/offers/[id]/accept/route.ts) | ✓ offer-accept (Stripe PaymentIntent integration) |
| 4 | `POST /api/offers/[id]/counter` | [src/app/api/offers/[id]/counter/route.ts](src/app/api/offers/[id]/counter/route.ts) | ✓ |
| 5 | `POST /api/offers/[id]/reject` | [src/app/api/offers/[id]/reject/route.ts](src/app/api/offers/[id]/reject/route.ts) | ✓ |
| 6 | `POST /api/offers/[id]/cancel` | [src/app/api/offers/[id]/cancel/route.ts](src/app/api/offers/[id]/cancel/route.ts) | ✓ |

Route family count: 6 (create, get, accept, counter, reject, cancel). Plus paired test files (`__tests__/*.route.test.ts`). Matches C2 directive §CONTEXT: "B1 + B2 concerns shipped the server-side mutation contract — `POST /api/offers/[id]/{accept,counter,reject,cancel}`, `POST /api/offers`".

### §2.2 UI consumer enumeration

Grep target: `fetch('/api/special-offer` and `fetch('/api/offers` across `src/**`.

**UI callers of `/api/special-offer/*`:** Per `P4_UI_DEPRECATION_AUDIT.md` §2.1 consumer column, the legacy routes were called from three sites in `src/app/vault/offers/page.tsx`:

- Line 333 — accept
- Line 385 — counter
- Line 446 — decline

**However — that file has since been replaced.** The SCAFFOLD directive `P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md` §F5 (per `/vault/offers/page.tsx` header comment [L3-7](src/app/vault/offers/page.tsx:3)) replaced the 561-LoC mock page with a 26-LoC server-component flag gate that delegates to `OffersListClient`. The replacement no longer calls `/api/special-offer/*` at all.

Current-state grep confirms: **zero `fetch('/api/special-offer` call sites remain in `src/**`** (re-run of the grep cited in `P4_UI_DEPRECATION_AUDIT.md` §2.1 returns 0 on the live tree).

**UI callers of `/api/offers/*`:** grep returns 2 live references:
- [src/hooks/useSession.ts:20](src/hooks/useSession.ts:20) — JSDoc example (not a real fetch).
- [src/app/vault/offers/_components/OffersListClient.tsx:143](src/app/vault/offers/_components/OffersListClient.tsx:143) — actual fetch call to `/api/offers` (list).
- [src/app/vault/offers/[id]/_components/OfferDetailClient.tsx:214](src/app/vault/offers/[id]/_components/OfferDetailClient.tsx:214) — `fetch(\`/api/offers/${id}\`)` — template-literal form, would not match a plain string regex. Confirmed via separate grep.

Plus C2 directive's future rewire of [src/components/asset/AssetRightsModule.tsx OfferModal](src/components/asset/AssetRightsModule.tsx) per Prompt 7 → will add a `POST /api/offers` call.

### §2.3 Verdict on D2 (route path drift)

**Not drift. Two coexisting route families in a migration window.**

- `/api/special-offer/*` — legacy (post-A.0-P3 rename from `/api/direct-offer/*`). Routes are present on disk but have **zero live UI consumers** post-SCAFFOLD rewrite. They are slated for deletion in successor concern 4A.2.C per `P4_UI_DEPRECATION_AUDIT.md` §2.1 + `P4_CONCERN_4A_2_C2_DIRECTIVE.md` §STATUS "Successor" line.
- `/api/offers/*` — new (ECONOMIC_FLOW_v1 aligned). Live UI consumers active in SCAFFOLD (`OffersListClient`, `OfferDetailClient`) and being expanded through C2 directive Prompts 4–8.

No "third route name" missed by P3 — grep across `src/app/api/**` returns only the two families. P3's claim ("landed 2026-04-18") is accurate for the legacy rename; the new `/api/offers/*` family is net-new scaffolding, not covered by A.0 rename because it was added after P3.

Route discipline: the legacy retirement is on a separate concern (4A.2.C, successor to C2) and should not bleed into C2's scope.

### §2.4 Minor residue (flagged, not a drift per se)

- `src/app/api/special-offer/route.ts` [L65](src/app/api/special-offer/route.ts:65): `actionType: 'direct-offer.create'` — rate-limit namespace key not updated during P3 rename. Per `FEATURE_APPROVAL_ROADMAP.md:142` this is deferred to P6 consolidated sweep.
- `src/app/api/special-offer/route.ts` [L24](src/app/api/special-offer/route.ts:24): comment mentions "D-DO lock decisions" — stale code comment. Also P6.

---

## §3 — D3: Type-name map

### §3.1 Every offer-adjacent type in the repo

**System 1 — `SpecialOffer*` types:**

| Type | File:line | Shape |
|---|---|---|
| `SpecialOfferStatus` | [src/lib/types.ts:88-96](src/lib/types.ts:88) | 8-state string literal union |
| `SPECIAL_OFFER_STATUS_LABELS` | [types.ts:98-107](src/lib/types.ts:98) | `Record<SpecialOfferStatus, string>` |
| `TERMINAL_OFFER_STATUSES` | [types.ts:109-111](src/lib/types.ts:109) | `SpecialOfferStatus[]` (4 members) |
| `SpecialOfferThread` | [types.ts:658-677](src/lib/types.ts:658) | Runtime-state shape (camelCase, cents-as-number, `listedPriceAtOpen`, `currentOfferAmount`, `roundCount`, etc.) |
| `SpecialOfferEvent` | [types.ts:697-706](src/lib/types.ts:697) | Event shape per §C.3 event log |
| `SpecialOfferEventType` | [types.ts:685-695](src/lib/types.ts:685) | 10-value union (`buyer_offer`, `creator_counter`, ..., `completed`) |
| `SpecialOfferAutoCancelReason` | [types.ts:679-683](src/lib/types.ts:679) | 4-value union |
| `SpecialOfferThreadRow` | [src/lib/db/schema.ts:355-374](src/lib/db/schema.ts:355) | DB-row shape (snake_case, status as `string // SpecialOfferStatus`) |
| `SpecialOfferEventRow` | [schema.ts:376-385](src/lib/db/schema.ts:376) | DB-row shape for events |
| `OfferCheckoutIntentRow` | [schema.ts:387-396](src/lib/db/schema.ts:387) | DB-row shape for the buyer-checkout bridge |
| `SpecialOfferEngineState` | [src/lib/special-offer/types.ts:25-28](src/lib/special-offer/types.ts:25) | `{ thread: SpecialOfferThread \| null; events: SpecialOfferEvent[] }` |
| `SpecialOfferAction` | [special-offer/types.ts:34-45](src/lib/special-offer/types.ts:34) | Reducer action union (10 actions, matches event types 1:1) |
| `VALID_OFFER_TRANSITIONS` | [special-offer/types.ts:51-80](src/lib/special-offer/types.ts:51) | 8-keyed transition graph |
| `CreateOfferInput`, `CounterOfferInput`, `AcceptOfferInput`, `DeclineOfferInput` | [special-offer/types.ts:86-113](src/lib/special-offer/types.ts:86) | Service-layer inputs |
| `EligibilityResult` | [special-offer/types.ts:119-122](src/lib/special-offer/types.ts:119) | `{ eligible: boolean; reason?: string }` |
| `OfferCheckoutIntent` | [special-offer/types.ts:128-137](src/lib/special-offer/types.ts:128) | Runtime-state shape for the checkout bridge (camelCase mirror of `OfferCheckoutIntentRow`) |

**System 2 — `Offer*` types:**

| Type | File:line | Shape |
|---|---|---|
| `OfferState` | [src/lib/offer/types.ts:49-56](src/lib/offer/types.ts:49) | 6-state string literal union |
| `OfferTargetType` | [offer/types.ts:39-41](src/lib/offer/types.ts:39) | Derived from `OfferCreatedPayloadSchema.shape.target_type` (ledger-schemas surface) |
| `PlatformFeeBps` | [offer/types.ts:63](src/lib/offer/types.ts:63) | `number` (0-10000 basis points) |
| `RightsTemplateId` | [offer/types.ts:71-75](src/lib/offer/types.ts:71) | 4-value union (per `ECONOMIC_FLOW_v1.md` §F15) |
| `Rights` | [offer/types.ts:81-85](src/lib/offer/types.ts:81) | `{ template: RightsTemplateId; params: Record<string, unknown>; is_transfer: boolean }` |
| `OfferRow` | [offer/types.ts:95-110](src/lib/offer/types.ts:95) | DB-row shape (snake_case, `gross_fee`, `platform_fee_bps`, `current_note`, `expires_at`, `state`, `cancelled_by`) |
| `OfferAssetRow` | [offer/types.ts:112-116](src/lib/offer/types.ts:112) | DB-row shape for `offer_assets` join table |
| `OfferBriefRow`, `OfferBriefSpec` | [offer/types.ts:118-131](src/lib/offer/types.ts:118) | DB-row + payload shape for `offer_briefs` |
| `AssignmentDeliverableRow` | [offer/types.ts:133-139](src/lib/offer/types.ts:133) | Adjacent DDL — cross-references `assignments` |

### §3.2 Conceptual overlap

The two systems have overlapping concepts with different names and different shapes:

| Concept | System 1 (runtime + row) | System 2 (row only) | Shape overlap |
|---|---|---|---|
| The offer itself | `SpecialOfferThread` (runtime) + `SpecialOfferThreadRow` (DB) | `OfferRow` (DB) | **Incompatible.** `SpecialOfferThread` is per-buyer-per-asset-per-licence with rounds + a listed-price snapshot + 8-state status. `OfferRow` is buyer-creator-pair with a `target_type` (single_asset / asset_pack / single_brief / brief_pack), jsonb rights, and 6-state. Not reshapeable into each other without a migration. |
| Events | `SpecialOfferEvent` / `SpecialOfferEventRow` | (no direct equivalent — System 2 uses ledger events via `@/lib/ledger/schemas`) | **Disjoint.** System 1 has a local events table; System 2 emits to a platform-wide ledger. |
| Transitions | `VALID_OFFER_TRANSITIONS` (8-keyed) | (no equivalent export; guards-based via `src/lib/offer/state.ts` — `canAccept`, `canCounter`, `canReject`, `canCancel`, `canExpire`) | **Disjoint.** Different modelling paradigms (graph vs. per-guard predicates). |
| Checkout handoff | `OfferCheckoutIntent` (runtime) + `OfferCheckoutIntentRow` (DB) | (none in `src/lib/offer/**` — checkout handoff is deferred to a future concern per C2 §D11) | System 1 has a concrete bridge. System 2 will add one when its checkout-UI concern lands. |
| Actions / inputs | `CreateOfferInput` et al. (camelCase, flat) | Zod schemas in each route file (snake_case payload, per-endpoint) | Disjoint. |

### §3.3 Verdict on D3 (type name drift)

**Not drift. Two legitimately different type systems.** `SpecialOfferThread` and `OfferRow` are NOT two names for the same concept; they are **two different modelling choices for overlapping product semantics**. The shapes differ materially:

- `SpecialOfferThread` assumes one-buyer-one-asset-one-licence with round caps + listed-price snapshot. Matches `SPECIAL_OFFER_SPEC.md`'s negotiation-flow framing.
- `OfferRow` assumes one-buyer-one-creator with a pack (`single_asset` / `asset_pack` / `single_brief` / `brief_pack`) + rights jsonb. Matches `ECONOMIC_FLOW_v1.md`'s §7 table shape — which explicitly supports briefs (commission work), not just assets.

The renaming claim ("SpecialOfferThread drifted to OfferRow") is inaccurate. The right statement is: **System 2 introduced a more general type (`OfferRow`) that covers both asset-direction AND brief-direction offers, and System 1's asset-only type is being retired in favor of it.**

No action to take on D3 as a type rename. The right action is the System-1-retirement work already scoped in successor concern 4A.2.C.

---

## §4 — Implications for C2 Prompts 4 / 5 / 6

C2 directive governs `/vault/offers/[id]` detail-UI + mutation-button surface. Inspecting each active prompt against the drift surfaced above:

### §4.1 Prompt 4 — `OfferActions.tsx` (accept / counter / reject / cancel buttons)

- **Depends on:** System 2's 6-state `OfferState` + `OfferRow.state` field + `POST /api/offers/[id]/{accept,counter,reject,cancel}`.
- **Does not depend on:** System 1's 8-state `SpecialOfferStatus`, any `SpecialOffer*` type, or `/api/special-offer/*`.
- **D1 impact:** **NONE directly.** Prompt 4 operates only in System 2. Visibility matrix per C2 directive §SCOPE item 5 uses `state === 'sent' || state === 'countered'` — matches both `ECONOMIC_FLOW_v1.md` §4 and code. The PLATFORM_BUILD.md `pending` divergence does not touch Prompt 4 because no user-facing copy would need to render `pending` (the directive's AC5 test covers the 6 state × role combinations without naming strings).
- **D2 impact:** NONE. Prompt 4 targets `/api/offers/*` exclusively.
- **D3 impact:** NONE. Prompt 4 imports `OfferRow` only.
- **Clear to proceed.**

### §4.2 Prompt 5 — `CounterComposerDialog.tsx` + `RejectConfirmDialog.tsx`

- **Depends on:** same System-2 contract as Prompt 4. No state name strings in user copy.
- **D1 impact:** NONE.
- **D2 impact:** NONE.
- **D3 impact:** NONE.
- **Clear to proceed.**

### §4.3 Prompt 6 — `OfferDetailClient.tsx` rewrite

- **Depends on:** `OfferRow`, `OfferAssetRow`, `OfferBriefRow`, `PartyProfileMap` (C1 dependency, V12 SOFT), and **`@/lib/offer/state-copy` SSOT** per directive §F1.
- **D1 impact:** **MATERIAL.** The state-copy SSOT must decide how to render the 6-state enum in user-facing text. This is where the intra-System-2 ambiguity surfaced in §1.4 bites:
  - Code state `sent` — `ECONOMIC_FLOW_v1.md` calls it `sent`; `PLATFORM_BUILD.md` calls it `pending`. User-facing label selection is unresolved.
  - System 1's 8-state labels (`SPECIAL_OFFER_STATUS_LABELS` at [types.ts:98-107](src/lib/types.ts:98)) provide one candidate mapping — `Awaiting Creator`, `Counter-offer`, `Declined`, `Expired`, `Cancelled` — but those map 8→8, not 6→6. To render System 2 states, the SSOT would need a new mapping, probably dependent on `(state × viewerRole)` to capture whose-turn-it-is information System 2 doesn't carry in the state name.
  - **Recommendation before Prompt 6:** resolve §1.4 (pick `pending` or `sent`), then author `@/lib/offer/state-copy` per C1 Draft 3.1 §F4 (dependency chain unchanged; this audit only surfaces the blocker, does not resolve it).
- **D2 impact:** Minor — the `attachment_not_public` placeholder copy for offer attachments references System-2 semantics; no legacy `/api/special-offer/*` coupling.
- **D3 impact:** NONE. Prompt 6 imports only `OfferRow` + Part-C1 type exports.
- **Gate before Prompt 6:** §1.4 resolution + `state-copy` SSOT authoring. Neither is Prompt 4/5 scope.

### §4.4 Summary

| Prompt | D1 (state count) | D2 (routes) | D3 (types) | Can proceed now? |
|---|---|---|---|---|
| 4 (OfferActions) | NONE | NONE | NONE | ✓ |
| 5 (dialogs) | NONE | NONE | NONE | ✓ |
| 6 (detail rewrite) | MATERIAL (§1.4) | NONE | NONE | Blocked on §1.4 + state-copy SSOT (separate concern) |

Prompts 7, 8, 9, 10, 11 follow the same System-2-only pattern and do not re-introduce drift dependence.

---

## §5 — Recommended next move per drift

### §5.1 D1 — state count (8 vs 6)

**Position taken:** the 8-vs-6 question is not a "drift to fix" at the state-count level. It is a program-boundary question. System 1 and System 2 each declare their own state machine. System 1 retires at successor concern 4A.2.C.

**Real action needed:** formalize the System-1-retirement expectation in a governance note so future readers don't re-discover the two systems and re-file "drift." Specifically:

- Amend `FEATURE_APPROVAL_ROADMAP.md` §A.3 evidence pack to note that A.3 sign-off runs against System 2 (`ECONOMIC_FLOW_v1.md` §4, `src/lib/offer/**`, `/api/offers/**`) while System 1 remains loaded during the retirement window. Current evidence-pack text at [L206](FEATURE_APPROVAL_ROADMAP.md:206) still names `/api/special-offer/*` + 8-state machine exclusively.
- Add a one-line pointer in `SPECIAL_OFFER_SPEC.md` (v1.0) header that the spec describes System 1 and that the forward-going implementation is per `ECONOMIC_FLOW_v1.md` §4. Spec stays as historical authority; ECON takes over as forward authority.
- Successor concern 4A.2.C is already authored per C2 directive §STATUS "Successor" line. No new dispatch needed for the retirement itself — just the governance-note cleanup above.

**Proposed home:** A single short dispatch (docs-only, no code) that authors the governance note + roadmap amendment. Budget: 15-30 min.

### §5.2 D1 *secondary* — intra-System-2 ambiguity (`pending` vs `sent`)

**Position taken:** this IS a genuine contradiction. `PLATFORM_BUILD.md:74` and `ECONOMIC_FLOW_v1.md:41-47` cannot both be right. Code matches ECON. PLATFORM_BUILD mis-matches.

**Real action needed:** founder ruling (per FLAG-39), then a one-line fix.

**Three options:**
1. **ECON is authoritative** (most likely — ECON is post-revision 9, the active canonical spec). `PLATFORM_BUILD.md:74` one-line typo-fix: `pending` → `sent`. Zero code impact.
2. **PLATFORM_BUILD is authoritative.** `ECONOMIC_FLOW_v1.md` §4 rename + `src/lib/offer/types.ts:50` rename + all route handlers + all migrations + all tests. Cascades hugely. Very unlikely the right answer.
3. **Upstream Canonical Spec §10.4** (Notion) is the tiebreaker. Someone reads it, picks a side, fixes the loser.

**Proposed home:** founder decision memo OR a micro-dispatch with B/C analysis. Blocks Prompt 6 (where state-copy SSOT labels get defined) but NOT Prompts 4 or 5.

### §5.3 D2 — route-path rename

**Position taken:** not drift. Two coexisting route families in a migration window. Retirement of `/api/special-offer/*` is owned by successor concern 4A.2.C and is already in the plan.

**Real action needed:** none beyond what 4A.2.C already specifies. The `FEATURE_APPROVAL_ROADMAP.md:206` evidence-pack text should be updated per §5.1 to reference `/api/offers/*` as the forward-going route family.

**Proposed home:** rolled into the §5.1 governance-note dispatch.

### §5.4 D3 — type-name rename

**Position taken:** not drift. `SpecialOfferThread` and `OfferRow` model different product scopes (asset-only vs. asset+brief). System 1 retires with its types; System 2's types go forward.

**Real action needed:** none beyond §5.1.

### §5.5 Residue items (flagged, not scope-carrying)

- `actionType: 'direct-offer.create'` rate-limit key at [src/app/api/special-offer/route.ts:65](src/app/api/special-offer/route.ts:65) — deferred to A.0 P6 sweep per `FEATURE_APPROVAL_ROADMAP.md:142`. Will be obviated when the whole file deletes at 4A.2.C.
- Stale "D-DO lock decisions" comment at [special-offer/route.ts:24](src/app/api/special-offer/route.ts:24) — same bucket.

### §5.6 Recommended ordering

| Order | Action | Effort | Blocks |
|---|---|---|---|
| 1 | **Founder ruling on §1.4 (`pending` vs `sent`)** | ≤15 min | Blocks Prompt 6 state-copy SSOT authoring |
| 2 | **Governance-note dispatch** (updates `FEATURE_APPROVAL_ROADMAP.md §A.3` evidence pack + header note on `SPECIAL_OFFER_SPEC.md`) | 15-30 min, docs-only | Blocks nothing; improves future-reader clarity |
| 3 | **Resume C2 directive at Prompt 4** | Per C2 directive | Nothing — Prompt 4 is unblocked by this audit |
| 4 | (parallel) **Author `state-copy` SSOT** — but under C1 concern, not C2 | Per C1 | Prompt 6 prerequisite |
| 5 | (scheduled) **Successor concern 4A.2.C** — legacy `/api/special-offer/*` + `src/lib/special-offer/**` + `src/lib/types.ts SpecialOffer*` retirement | Per its own dispatch | Closes System 1 |

---

## §6 — Verification / discipline traces

- **FLAG-26 honoured** — `PLATFORM_BUILD.md:74` vs `ECONOMIC_FLOW_v1.md:41-47` byte-exact divergence surfaced (§1.4), not resolved by reverse-engineering.
- **FLAG-39 honoured** — intra-System-2 contradiction surfaced with three options enumerated; no silent pick.
- **FLAG-33 honoured** — audit-only. No git ops. No code changes.
- **No dispatch-vs-IP contradiction** from this audit's own dispatch — findings align with the stated scope.

### §6.1 Sources cited with line numbers

All citations in this doc use `file:line` or `file § section` with grep-anchored content. No claim from memory without a current-state citation.

### §6.2 What this audit did NOT do

- Did not read the upstream Canonical Spec §10.4 (Notion) — per authority chain that document is upstream and was not in scope inputs.
- Did not inventory migrations (`supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` and siblings) — those are DB-shape authoritative but not part of the claimed D1/D2/D3 drift.
- Did not examine `src/lib/special-offer/guards.ts`, `reducer.ts`, `services.ts`, `store.ts` contents in detail — the public surfaces (types + transition table) were sufficient to establish the 8-state shape. If System 1 retirement is executed, a line-by-line audit at that point is appropriate.

---

*End of A.3 Special Offer drift audit. Zero code changes. Ready for founder review of §5 recommendations, especially §5.2 (the `pending` / `sent` ambiguity, which is the only finding that materially blocks C2 Prompt 6 progression).*
