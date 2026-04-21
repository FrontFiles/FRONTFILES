# P4 Concern 4 — Design Lock

**Status.** Draft 1, 2026-04-21. Gate: founder approval pending.

**Governs.** The architecture, naming, decomposition, and sub-phase sequencing of concern 4's build pass (spec-canonical replacement surface for ECONOMIC_FLOW_v1). Concrete input to the forthcoming directives `P4_CONCERN_4A_1_DIRECTIVE.md` through `P4_CONCERN_4A_6_DIRECTIVE.md` (build sub-phases) and `P4_CONCERN_4B_DIRECTIVE.md` (tear-down + flag flip).

**Does not govern.**
- Pixel-level visual design, typography, colour tokens, ARIA specifics, copy voice. Those land in the individual sub-phase directives, downstream of this lock.
- Spec-canonical behaviour — that is set by `docs/specs/ECONOMIC_FLOW_v1.md` (offer/assignment/dispute state machines, the 20 events, hash-chain rules, atomicity). This document binds to spec; it does not re-litigate it.
- Retirement inventory — that is set by `P4_UI_DEPRECATION_AUDIT.md`. This document cites that inventory; it does not re-audit.
- Deploy-gate mechanics — the two-deploy model is locked by `P4_IMPLEMENTATION_PLAN.md` §7 and `P4_UI_DEPRECATION_AUDIT.md` §5. This document threads flags into that model but does not change it.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` §4, §5, §7, §8, §12, §14.1, §17; `docs/audits/P4_UI_DEPRECATION_AUDIT.md` §2, §3, §5, §6; `docs/audits/P4_IMPLEMENTATION_PLAN.md` §6, §7; `docs/audits/P4_CONCERN_3_DIRECTIVE.md` §C (token-extraction + `isAuthWired()` contract).

---

## 1. Purpose & scope

### 1.1 What this doc produces

A single architectural lock that translates the ECONOMIC_FLOW_v1 spec from *state-machine-and-event-shape* terms into *filesystem-and-route* terms. The output is: concrete route paths, concrete page paths, a library decomposition, a component decomposition, a flag strategy, and a sub-phase sequence. Once founder-approved, downstream sub-phase directives consume this lock verbatim — no implementer re-derives the naming or the sequence.

### 1.2 What this doc does NOT decide (delegates downstream)

- The exact internal layout of each replacement page (grid, sections, copy). Sub-phase directives handle it per surface.
- The React component API of each new component beyond its prop-level role. The sub-phase directive defines the exact prop contract when the component is built.
- The precise SQL of each event-writing transaction. §8.5 of the spec already specifies the transactional shape; the 4A.1 directive binds the transaction-wrapper helper to that SQL verbatim.
- Notification wiring (§12.3). That surface is its own concern and is deferred to a post-concern-4 sub-phase (provisionally 4C, out of deploy 2's merge-gate). Flagged in §10.

### 1.3 What this doc inherits (spec-given, not re-decided)

- Offer state machine (§4): 7 states, 4 user-initiated terminal transitions, 1 system-initiated (`expired`), 1 buyer-only (`cancelled`).
- Assignment state machine (§5): 8 states + `dispute.under_appeal` sub-state.
- Offer / child-table schemas (§7): `offers`, `offer_assets`, `offer_briefs`, `assignment_deliverables`, `disputes`.
- Event catalogue (§8): 20 events in three namespaces (`offer.*` 6, `assignment.*` 9, `dispute.*` 5).
- Storage shape (§8.3): single polymorphic `ledger_events` table with hash chain.
- Actor handles (§8.4): `actor_handles` as the pseudonymisation layer; `system` sentinel handle for platform-originated events.
- Atomicity (§8.5): every state mutation paired with an event emission in the same DB transaction.
- Stripe acceptance flow (§8.5): outer DB lock → PaymentIntent create → inner DB transaction → void-on-rollback. Idempotency key = `offer.id + ':accept'`.
- Terminology discipline (§9) and banned terms (certified, verified-as-identity-claim, tamper-proof, immutable).

---

## 2. Naming conventions (lock)

### 2.1 API route base paths

| Surface | Base path | Rationale |
|---|---|---|
| Offers | `/api/offers` | Flat, matches table name, aligns with `/api/posts` precedent |
| Assignments | `/api/assignments` | Same pattern |
| Disputes | `/api/disputes` | Same pattern |
| Ledger reads | `/api/ledger` | Thread-scoped event history for event-trail viewers |

**Not** `/api/v1/*`. The `v1` designation lives in the payload version field (§8.6), not the URL. The `/api/v2/batch/*` surface is unrelated and stays where it is.

### 2.2 Page base paths

Replacement pages REUSE the existing vault paths:

| Retiring path | Replacement path (same URL) | Lands at |
|---|---|---|
| `/vault/offers` | `/vault/offers` | Buyer's offer inbox (list + detail-on-click) |
| `/vault/assignments` | `/vault/assignments` | Dual-actor assignment list |
| `/vault/disputes` | `/vault/disputes` | Dispute list for a user (either side) |
| `/assignment/*` (top-level tree) | *no replacement path* | Entire `src/app/assignment/` tree is DELETE-only per `P4_UI_DEPRECATION_AUDIT.md` §3.1. Detail view collapses into `/vault/assignments/[id]`. |

Detail pages (new, no retiring analogue at the same path):

| Path | Purpose |
|---|---|
| `/vault/offers/[id]` | Offer detail + counter/accept/reject UI + event trail |
| `/vault/assignments/[id]` | Assignment detail + delivery/revision/accept UI + event trail |
| `/vault/disputes/[id]` | Dispute detail + evidence submission + state + event trail |

**Rationale for URL reuse.** User mental model is preserved (bookmarks, muscle memory). Retiring surface is deleted from the repo in the same merge that the replacement lands, so no collision window exists. The `FFF_ECONOMIC_V1_UI` flag gates the replacement surface on; deletions gate the retiring surface off at the same commit (§5.2 of audit).

### 2.3 Library module paths

```
src/lib/
├── ledger/                      (new)  — event writer, hash chain, actor-ref resolution
│   ├── writer.ts                        — insert helper with transaction wrapper
│   ├── hash.ts                          — sha256 chain helper (canonicalisation)
│   ├── actor.ts                         — handle resolver (incl. system sentinel)
│   ├── types.ts                         — thread_type, event_type unions
│   └── __tests__/…
├── offer/                       (new)  — offer domain logic
│   ├── state.ts                         — transition guards (draft→sent, sent→countered, …)
│   ├── composer.ts                      — pack composition helpers (client-safe)
│   ├── pricing.ts                       — fee decomposition (gross / platform / net-to-creator)
│   ├── rights.ts                        — rights template registry + override validation
│   ├── types.ts
│   └── __tests__/…
├── assignment/                  (new)  — spec-canonical assignment domain
│   ├── state.ts                         — transition guards
│   ├── delivery.ts                      — piece delivery + revision round helpers
│   ├── cashout.ts                       — Stripe clearance → cashed_out event helper
│   ├── types.ts
│   └── __tests__/…
├── dispute/                     (new)
│   ├── state.ts                         — transition guards incl. cool-down
│   ├── evidence.ts                      — evidence_ref validation + emission guard
│   ├── reason-codes.ts                  — enumerated from §12.4
│   ├── types.ts
│   └── __tests__/…
└── stripe/                      (extend existing or new)
    └── offer-accept.ts                  — PaymentIntent create + idempotency key + void-on-rollback
```

The old `src/lib/assignment/` directory is DELETE-ONLY per `P4_UI_DEPRECATION_AUDIT.md` §3.3. The new `src/lib/assignment/` is a green-field directory reusing the name — filesystem-level overwrite at tear-down (4B).

**Cross-reference:** the old `src/lib/special-offer/` does NOT get a direct replacement at the same path. Its functionality reshards into `src/lib/offer/` (creation, composition) and `src/lib/ledger/` (persistence, events).

### 2.4 Event-type strings

Locked by §8 of the spec; this document restates them here for cross-referencing by sub-phase directives:

- Offer: `offer.created`, `offer.countered`, `offer.accepted`, `offer.rejected`, `offer.expired`, `offer.cancelled`
- Assignment: `assignment.created`, `assignment.piece_delivered`, `assignment.delivered`, `assignment.revision_requested`, `assignment.accepted_by_buyer`, `assignment.cashed_out`, `assignment.disputed`, `assignment.refunded`, `assignment.split`
- Dispute: `dispute.opened`, `dispute.evidence_submitted`, `dispute.resolved`, `dispute.appealed`, `dispute.appeal_resolved`

Twenty types total. Matches §8 count.

### 2.5 Component filename convention

Existing convention (`src/components/assignment/AssignmentShell.tsx`) is PascalCase with surface-prefix. Replacement components follow the same:

```
src/components/
├── offer/                       (new directory)
│   ├── OfferInboxList.tsx
│   ├── OfferCard.tsx
│   ├── OfferDetailView.tsx
│   ├── OfferCounterEditor.tsx       — structured composition-diff editor (§12.1)
│   ├── OfferPreviewPanel.tsx        — read-only pack preview (§12.1)
│   ├── PackComposer.tsx             — multi-select composer (§12.1)
│   ├── FeeTransparencyPanel.tsx     — §12.1 buyer fee breakdown
│   ├── RightsTemplatePicker.tsx
│   └── ExpirationSelector.tsx
├── assignment/                  (new directory — old DELETED first in 4B)
│   ├── AssignmentList.tsx
│   ├── AssignmentDetailView.tsx
│   ├── DeliverPiecePanel.tsx
│   ├── RevisionRequestPanel.tsx
│   ├── BuyerAcceptPanel.tsx
│   └── RightsGrantConfirmation.tsx   — asset-pack branch
├── dispute/                     (new directory)
│   ├── DisputeList.tsx
│   ├── DisputeDetailView.tsx
│   ├── OpenDisputeButton.tsx
│   ├── EvidenceSubmitter.tsx
│   ├── DisputeReasonPicker.tsx
│   └── AppealPanel.tsx               — §12.4a creator appeal
└── shared/
    ├── EventTrailViewer.tsx          — renders ledger_events for a thread
    ├── StateBadge.tsx                — §12.1/§9-compliant state badges
    └── ActorLabel.tsx                — resolves actor_ref → display (handles system/tombstoned)
```

Sub-phase directives may refine individual component APIs; filenames as listed are the lock.

---

## 3. API route inventory

### 3.1 Offer routes — 5 user-driven

| Verb | Path | Emits | Guard |
|---|---|---|---|
| `POST` | `/api/offers` | `offer.created` | `isAuthWired()` + `requireActor()` |
| `POST` | `/api/offers/[id]/counter` | `offer.countered` | same |
| `POST` | `/api/offers/[id]/accept` | `offer.accepted` + `assignment.created` (dual-row emit per §8.5) | same |
| `POST` | `/api/offers/[id]/reject` | `offer.rejected` | same |
| `POST` | `/api/offers/[id]/cancel` | `offer.cancelled` | same |
| `GET` | `/api/offers` | — (read) | same; returns buyer's or creator's depending on actor |
| `GET` | `/api/offers/[id]` | — (read) | same; RLS enforces party-to-thread |

Note: `offer.expired` is system-originated (§3.5 below) — no user route.

### 3.2 Assignment routes — 6 user-driven + 1 read

| Verb | Path | Emits | Guard |
|---|---|---|---|
| `POST` | `/api/assignments/[id]/deliver-piece` | `assignment.piece_delivered` | isAuthWired + requireActor (creator only) |
| `POST` | `/api/assignments/[id]/deliver` | `assignment.delivered` | creator only |
| `POST` | `/api/assignments/[id]/revision-request` | `assignment.revision_requested` | buyer only; brief-pack only |
| `POST` | `/api/assignments/[id]/accept-delivery` | `assignment.accepted_by_buyer` (manual) | buyer only |
| `POST` | `/api/assignments/[id]/confirm-rights-grant` | `assignment.delivered` (asset-pack path) | creator only |
| `GET` | `/api/assignments` | — (read) | returns buyer's + creator's |
| `GET` | `/api/assignments/[id]` | — (read) | RLS |

Note: `assignment.accepted_by_buyer` (auto-accept at 14d), `assignment.cashed_out`, `assignment.disputed`, `assignment.refunded`, `assignment.split` are all emitted as side-effects of other surfaces:
- Auto-accept: cron (§3.5)
- Cashed_out: Stripe webhook handler (§3.5)
- Disputed/refunded/split: dispute routes below (dual-thread emit per §8.5)

`assignment.created` is not a standalone route — it fires inside the `offer.accept` transaction per §8.5.

### 3.3 Dispute routes — 5 user-driven + 1 admin

| Verb | Path | Emits | Guard |
|---|---|---|---|
| `POST` | `/api/disputes` | `dispute.opened` + `assignment.disputed` (dual-thread emit) | isAuthWired + requireActor |
| `POST` | `/api/disputes/[id]/submit-evidence` | `dispute.evidence_submitted` | either party; server guard blocks once state reaches `resolved` or `appeal_resolved` per §8.2a |
| `POST` | `/api/disputes/[id]/appeal` | `dispute.appealed` | creator only; within 14d of `dispute.resolved` |
| `POST` | `/api/disputes/[id]/resolve` | `dispute.resolved` + `assignment.{refunded,split,accepted_by_buyer}` (dual-thread) | **admin-only**; guard: actor must carry admin role (resolution path §3.6) |
| `POST` | `/api/disputes/[id]/appeal-resolve` | `dispute.appeal_resolved` + `assignment.{refunded,split,accepted_by_buyer}` | **reviewer-only**; §12.4b independent reviewer |
| `GET` | `/api/disputes` | — (read) | user's disputes, either side |
| `GET` | `/api/disputes/[id]` | — (read) | RLS |

### 3.4 Ledger read route

| Verb | Path | Purpose |
|---|---|---|
| `GET` | `/api/ledger?thread_type=<offer\|assignment\|dispute>&thread_id=<uuid>` | Returns event stream for a thread. Backs `EventTrailViewer`. RLS: party-to-thread only. |

### 3.5 Cron / timer / webhook handlers

These run outside the `(user)` surface and emit events via the `system` handle (§8.4).

| Trigger | Emits | Notes |
|---|---|---|
| Offer expiration cron (hourly) | `offer.expired` | Scans `offers` where `expires_at < now() AND state IN ('sent','countered')`. |
| Assignment auto-accept cron (daily) | `assignment.accepted_by_buyer` (auto=true) | Scans `assignments` where `state='delivered' AND delivered_at < now() - interval '14 days'`. Payload includes `{v, by_actor_id: system, auto: true}`. |
| Stripe webhook `transfer.created` → `transfer.succeeded` | `assignment.cashed_out` | Handler already partially scaffolded under `src/app/api/stripe/*` (out of this lock's primary scope; flagged in §10 for reverify). |

Cron jobs live under `src/app/api/cron/*` (Next.js 16 cron pattern; Vercel schedules) or a Supabase Edge Function; placement decided at 4A.1 sub-phase.

### 3.6 Admin/reviewer actor role

The spec does not yet specify the admin/reviewer auth model in spec-canonical terms. Dispute resolve + appeal-resolve routes require an admin-only guard. Options:

- **Option A:** Extend `requireActor()` to return `actor.roles: Set<'admin'|'reviewer'>` (new column on `actor_handles` or separate `actor_roles` table).
- **Option B:** Hard-coded admin handle list in env (`FFF_ADMIN_HANDLES`, comma-separated UUIDs).

Flagged as open product question §10.1 — not blocking 4A.1 (ledger writer) or 4A.2 (offer). Resolve before 4A.4 (dispute).

### 3.7 Event emission map (route → event)

For cross-reference when wiring the event writer. Count: 20 event types, all covered.

| Event | Emitting surface |
|---|---|
| `offer.created` | `POST /api/offers` |
| `offer.countered` | `POST /api/offers/[id]/counter` |
| `offer.accepted` | `POST /api/offers/[id]/accept` (co-emits `assignment.created`) |
| `offer.rejected` | `POST /api/offers/[id]/reject` |
| `offer.expired` | cron |
| `offer.cancelled` | `POST /api/offers/[id]/cancel` |
| `assignment.created` | co-emitted inside `POST /api/offers/[id]/accept` |
| `assignment.piece_delivered` | `POST /api/assignments/[id]/deliver-piece` |
| `assignment.delivered` | `POST /api/assignments/[id]/deliver` or `…/confirm-rights-grant` |
| `assignment.revision_requested` | `POST /api/assignments/[id]/revision-request` |
| `assignment.accepted_by_buyer` | `POST /api/assignments/[id]/accept-delivery` OR cron (auto) |
| `assignment.cashed_out` | Stripe webhook |
| `assignment.disputed` | co-emitted inside `POST /api/disputes` |
| `assignment.refunded` | co-emitted inside `POST /api/disputes/[id]/resolve` or `…/appeal-resolve` |
| `assignment.split` | same |
| `dispute.opened` | `POST /api/disputes` |
| `dispute.evidence_submitted` | `POST /api/disputes/[id]/submit-evidence` |
| `dispute.resolved` | `POST /api/disputes/[id]/resolve` |
| `dispute.appealed` | `POST /api/disputes/[id]/appeal` |
| `dispute.appeal_resolved` | `POST /api/disputes/[id]/appeal-resolve` |

---

## 4. Page inventory

### 4.1 Replacement pages

| Path | Surface | Actor context | Replaces |
|---|---|---|---|
| `/vault/offers` | Offer inbox (list + counters summary) | Buyer primary; creator sees "offers I received" variant | `src/app/vault/offers/page.tsx` |
| `/vault/offers/[id]` | Offer detail: composition, rights, fee, counter editor, accept/reject/cancel controls, event trail | Dual-actor, role-aware UI | net-new |
| `/vault/assignments` | Assignment list: active / delivered / accepted / disputed tabs | Dual-actor | `src/app/vault/assignments/page.tsx` + `/assignment/*` top-level tree (DELETE) |
| `/vault/assignments/[id]` | Assignment detail: progress, delivery controls (creator), accept/revision controls (buyer), event trail, dispute entry | Dual-actor | `src/app/assignment/[id]/page.tsx` (DELETE; collapses here) |
| `/vault/disputes` | Dispute list for a user | Either side | `src/app/vault/disputes/page.tsx` |
| `/vault/disputes/[id]` | Dispute detail: state, evidence, appeal controls, event trail | Either side + admin view variant | net-new (staff console is post-v1 per §13) |
| — (invoked from asset page) | Pack composer | Buyer | `src/components/asset/AssetRightsModule.tsx` `OfferModal` REWRITE |

**Pack composer is a modal**, invoked from the asset detail page. Not a standalone route. This is decisive; §12.1 says "Pack composer" without specifying. Modal is chosen because (a) buyer is already on the asset page when they decide to offer, and (b) the composer mutates client-side state until `offer.created` — no need for URL-addressable composer state pre-send.

### 4.2 Route-path reuse: old deletes, new lands same URL

The three `/vault/*` paths reuse. Collision avoided by ordering:

1. During 4A.*: new pages land at new filenames under a flag-gated route group (see §4.3).
2. During 4B: old `page.tsx` files are deleted in the same commit the new ones take over the path.

Implementation detail: during 4A development, new pages can live at a temporary path (e.g., `/vault/v1/offers`) behind the flag, then get renamed to the target path in the 4B tear-down commit. Alternative: use the route group `(v1)` to scope them without affecting URL. Sub-phase 4A.2 directive picks the concrete approach.

### 4.3 Cross-surface navigation

- Buyer submits offer via `PackComposer` on asset page → `POST /api/offers` → redirect to `/vault/offers/[id]`.
- Offer accepted → server creates assignment atomically → client navigation redirect to `/vault/assignments/[id]`.
- Assignment delivered → buyer sees CTA to accept; clicking accept stays on same page, re-renders with new state.
- Dispute opened from assignment detail → creates dispute row atomically → redirect to `/vault/disputes/[id]`.

Redirect targets are server-returned (Next.js 16 `redirect()` from route handler) to keep client logic thin.

### 4.4 Asset-detail rewire

`src/components/asset/AssetRightsModule.tsx` `OfferModal` currently stubs `submitted` state (audit §4.3). REWRITE replaces the stub with:

```
handleSubmit → POST /api/offers with single-asset shape → on 2xx, close modal + toast + redirect to /vault/offers/[id]
```

No other AssetRightsModule change. The outer CTA, modal shell, and form shape preserve.

---

## 5. Component decomposition

Locked in §2.5 above. Sub-phase directives land the files; this section is the filename authority.

Two cross-cutting components warrant explicit notes:

**`shared/EventTrailViewer.tsx`.** Consumes `GET /api/ledger?thread_type=X&thread_id=Y`. Renders each event with:
- Event type (human label)
- Actor label (via `ActorLabel`)
- Timestamp
- Short payload summary (fee change, piece_ref, reason code)
- Optional "verify hash" disclosure panel — expands to show `prev_event_hash`, current `event_hash`, and the concatenated preimage for independent verification (§8.3 claim: tamper-evident, independently reviewable).

**`shared/StateBadge.tsx`.** Renders §9-compliant labels: "Offer pending," "Rights grant complete," "Pack delivered," etc. Never "Certified" or "Verified" (banned terms). Single source of state-string → human-label mapping; imported everywhere a state displays.

---

## 6. Library decomposition

Locked in §2.3 above. Three notes:

### 6.1 `src/lib/ledger/writer.ts` — the centre of gravity

**Division of labour: hash chain is Postgres-side.** Concern 1 shipped `enforce_ledger_hash_chain()` as a BEFORE INSERT trigger (see `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` L427-466). The trigger:
- Reads the latest `event_hash` for `(NEW.thread_type, NEW.thread_id)`;
- Validates `NEW.prev_event_hash = latest_hash` (or both NULL for the first event on the thread); throws otherwise;
- Computes `NEW.event_hash = sha256(prev_event_hash || '|' || payload_version || '|' || event_type || '|' || canonical_payload || '|' || created_at_iso || '|' || actor_ref)` via `pgcrypto`.

Therefore TS-side does **not** compute hashes. TS-side responsibility is:

1. **Runtime payload validation** (Zod schema per event type, 20 schemas).
2. **Load last `event_hash` on the thread** (single `SELECT event_hash FROM ledger_events WHERE thread_type=$1 AND thread_id=$2 ORDER BY created_at DESC LIMIT 1`) to pass as `prev_event_hash`.
3. **Execute `INSERT ... RETURNING event_hash`** and return the trigger-computed hash to the caller.

Single canonical export:

```ts
export type EmitEventArgs<T extends EventType> = {
  db: SupabaseClient;             // service-role client inside caller's RPC/transaction
  threadType: 'offer' | 'assignment' | 'dispute';
  threadId: string;
  eventType: T;
  payload: EventPayload<T>;       // typed per event; runtime-validated via Zod
  actorRef: string;               // handle UUID
};

export type EmitEventResult =
  | { ok: true; eventHash: string; eventId: string }
  | { ok: false; reason: 'PAYLOAD_VALIDATION_FAILED' | 'HASH_CHAIN_VIOLATION' | 'INSERT_FAILED'; detail: string };

export async function emitEvent<T extends EventType>(args: EmitEventArgs<T>): Promise<EmitEventResult>
```

Caller always loads `prev_event_hash` server-side before calling (inside the same atomic txn/RPC). The writer itself does NOT load it — isolating the writer from thread-scan concerns keeps it trivially testable.

**Caller responsibility** (not this module's): running BEGIN/COMMIT (for route handlers, this means wrapping in a Postgres RPC — see §6.1a below), doing the business-state UPDATE, catching errors to void Stripe PaymentIntents.

### 6.1a Atomicity via Postgres RPCs (deferred to 4A.2)

Supabase's JS client has no client-side transaction support. Per §8.5 of the spec, every business-state UPDATE must be paired atomically with the ledger INSERT. The correct pattern:

- Each business operation (`offer.created`, `offer.accepted`, `offer.countered`, …) has a dedicated Postgres function (e.g., `public.rpc_create_offer`, `public.rpc_accept_offer`).
- Route handler calls the RPC via `supabase.rpc('rpc_create_offer', {...})`.
- RPC body does: row-lock (where applicable) → business UPDATE/INSERT → call a shared internal helper for the ledger insert → RETURN `event_hash`.
- Payload Zod-validation happens TS-side BEFORE the RPC call.

The full RPC catalogue is scope of 4A.2/4A.3/4A.4 (one RPC per user-driven route). 4A.1 ships only:
- The TS-side types, schemas, and the writer helper that each RPC would call (if routes did the INSERT from TS; kept for tests and for any route that doesn't need a paired business UPDATE — e.g., `dispute.evidence_submitted` is pure ledger append).
- A single example RPC `public.rpc_append_ledger_event(thread_type, thread_id, event_type, payload, actor_ref, prev_event_hash)` that wraps the raw insert for the pure-append case.

### 6.1b Known concern-1 defect (flagged, not fixed in 4A.1)

`enforce_ledger_hash_chain()` is susceptible to a concurrent-insert race: under default `read committed` isolation, two concurrent transactions both inserting onto the same thread can each read the same `latest_hash`, each pass trigger validation, and both commit — forking the chain. Fix is a `UNIQUE (thread_type, thread_id, prev_event_hash)` constraint (second insert fails uniqueness). Not a 4A.1 concern; flagged as concern-1 defect to be patched in a dedicated follow-up migration **before** 4A.2 lands its first write-path route.

### 6.2 `src/lib/offer/state.ts` — transition guards

One function per user action (`canCounter`, `canAccept`, `canReject`, `canCancel`). Each takes `{ offer: OfferRow; actor: Actor }` and returns `{ allowed: boolean; reason?: string }`. No DB access from these helpers — pure functions over already-loaded rows. Route handlers call the helper, query the row, then trust the result.

### 6.3 Shared types

`src/lib/ledger/types.ts` owns the union:

```ts
export type EventType =
  | 'offer.created' | 'offer.countered' | … (20 total)

export type EventPayload<T extends EventType> = … (discriminated union)
```

Typed payloads prevent the test-fixture drift that burned concern 2.

---

## 7. Flag strategy

### 7.1 `FFF_AUTH_WIRED` — routes only (concern 3, existing)

Every new route handler opens with:

```ts
if (!isAuthWired()) return errorResponse('FEATURE_DISABLED', 'Auth not wired.', 404)
const actorResult = await requireActor(req)
if (!actorResult.ok) return errorResponse(actorResult.reason, …, 401)
```

`isAuthWired()` ships from concern 3. `requireActor()` ships from concern 3 (token extraction via Authorization Bearer header — open item may revisit to cookie).

### 7.2 `FFF_ECONOMIC_V1_UI` — pages only (new, added in 4A.1)

Every new page opens with:

```ts
import { isEconomicV1UiEnabled } from '@/lib/flags'
import { notFound } from 'next/navigation'

export default function Page(…) {
  if (!isEconomicV1UiEnabled()) notFound()
  …
}
```

Client components do not read this flag — only server components (page.tsx) gate. This keeps the client bundle free of flag branching.

### 7.3 Deploy 1 vs deploy 2 behaviour matrix

| Flag | Deploy 1 | Deploy 2 |
|---|---|---|
| `FFF_AUTH_WIRED` | `false` (route = 404) | `true` (route active) |
| `FFF_ECONOMIC_V1_UI` | `false` (page = 404) | `true` (page renders) |

During 4A.* development pre-deploy, both flags default `false`. The new pages and routes exist in the repo but are invisible to users. Retiring surface remains fully operational. This is the clean "ship behind flag" window.

### 7.4 Rollback

If deploy 2 rolls back post-flip:
- Both flags revert to `false` via env change.
- New pages → 404 (via `isEconomicV1UiEnabled()` returning false).
- New routes → 404 (via `isAuthWired()` returning false).
- Retiring pages/routes are already deleted from the bundle → the three `/vault/*` URLs return 404.
- Per audit §5.5 this is acceptable. Founder may add maintenance-mode fallback pages if insufficient (decision deferred to 4B).

---

## 8. Retiring → replacement map

| Retiring artefact | Replacement |
|---|---|
| `src/app/api/special-offer/route.ts` (POST + GET) | `src/app/api/offers/route.ts` (POST + GET) |
| `src/app/api/special-offer/[id]/accept/route.ts` | `src/app/api/offers/[id]/accept/route.ts` |
| `src/app/api/special-offer/[id]/counter/route.ts` | `src/app/api/offers/[id]/counter/route.ts` |
| `src/app/api/special-offer/[id]/decline/route.ts` | `src/app/api/offers/[id]/reject/route.ts` (renamed to `reject` per spec terminology) |
| `src/app/api/assignment/route.ts` (POST + GET) | `src/app/api/assignments/route.ts` (GET only — no standalone create path; `POST /api/offers/[id]/accept` creates) |
| `src/app/api/assignment/[id]/route.ts` | `src/app/api/assignments/[id]/route.ts` |
| `src/app/api/assignment/[id]/accept/route.ts` | (DELETE-only; buyer accept of delivery is `POST /api/assignments/[id]/accept-delivery`) |
| `src/app/api/assignment/[id]/cancel/route.ts` | (DELETE-only; spec v1 has no standalone cancel — use dispute instead) |
| `src/app/api/assignment/[id]/fulfil/route.ts` | `src/app/api/assignments/[id]/deliver/route.ts` |
| `src/app/api/assignment/[id]/review-open/route.ts` | (DELETE-only; review workflow is v2+ per §13) |
| `src/app/api/assignment/[id]/review/route.ts` | (DELETE-only; same) |
| `src/app/api/assignment/[id]/dispute/route.ts` | `src/app/api/disputes/route.ts` (dispute-centric routing, not assignment-child) |
| `src/app/api/assignment/[id]/ccr/route.ts` | (DELETE-only; CCR/"creator-change-request" concept absorbed into `assignment.revision_requested` event + dispute for cannot-deliver) |
| `src/app/vault/offers/page.tsx` | `src/app/vault/offers/page.tsx` (same path, new implementation) |
| `src/app/vault/assignments/page.tsx` | `src/app/vault/assignments/page.tsx` (same path) |
| `src/app/vault/disputes/page.tsx` | `src/app/vault/disputes/page.tsx` (same path) |
| `src/app/assignment/` (entire subtree) | (DELETE-only; collapses to `/vault/assignments/[id]`) |
| 17 components in `src/components/assignment/` | new `src/components/assignment/*` per §2.5 — name reuse, filesystem overwrite in 4B |
| 1 fragment: `AssetRightsModule.tsx` `OfferModal` | REWRITE in place |
| `src/lib/assignment/` (15 files) | new `src/lib/assignment/*` per §2.3 — name reuse, filesystem overwrite in 4B |
| `src/lib/special-offer/` (7 files) | folds into new `src/lib/offer/*` (not same path) |

**Count reconciliation (against `P4_UI_DEPRECATION_AUDIT.md` §3.6):**
- 9 retiring pages → 6 new pages (three collapse at same URL; one modal; two DELETE-only)
- 17 DELETE components → ~20 new components (exact count is indicative; sub-phase directives refine)
- 22 DELETE lib files → ~15 new lib files (event writer consolidates common logic)
- 13 DELETE routes → 16 new routes (disputes is 5 routes vs 1; read routes separated)
- 13 DELETE test files → test files land with their source in sub-phases

---

## 9. Sub-phase sequencing

### 9.1 4A.1 — Event-writer library + flag scaffolding

**Scope.** Narrow. No hash math (Postgres trigger owns it). No business-side RPCs (deferred to 4A.2).

Files in scope:
- `src/lib/ledger/types.ts` — `EventType` union (20 strings), `EventPayload<T>` discriminated union per §8 spec.
- `src/lib/ledger/schemas.ts` — Zod schema per event type (20 schemas), exported as `EventPayloadSchemas: Record<EventType, z.ZodType>`.
- `src/lib/ledger/system-actor.ts` — exports `SYSTEM_ACTOR_HANDLE = '00000000-0000-0000-0000-000000000001'` (matches the `00000000-0000-0000-0000-000000000001` UUID seeded by `supabase/migrations/20260421000005_seed_system_actor.sql`). Single source of truth for the §8.4 sentinel; resolves the deferral chain from concern 1 directive §A M5.
- `src/lib/ledger/writer.ts` — `emitEvent()` per §6.1; pure TS-side payload validation + INSERT.
- `src/lib/ledger/__tests__/{schemas,writer,system-actor}.test.ts` — unit tests; writer tests use a stubbed Supabase client.
- `src/lib/env.ts` — add `FFF_ECONOMIC_V1_UI` env var.
- `src/lib/flags.ts` — add `isEconomicV1UiEnabled()` accessor (server-only).
- `vitest.config.ts` — add `forwardedEnv.FFF_ECONOMIC_V1_UI = 'true'` (mirrors the FFF_AUTH_WIRED pattern from concern 3).
- `supabase/migrations/<timestamp>_rpc_append_ledger_event.sql` — minimal RPC that wraps `INSERT INTO ledger_events (...) RETURNING event_hash`. One RPC, used by 4A.4's `evidence_submitted` (pure ledger append; no paired business UPDATE) and as a test-bench for the writer.

**Output.** Type-safe event-emission primitive ready for 4A.2/4A.3/4A.4 routes to use. Flag scaffolding ready for replacement pages to gate themselves.

**Acceptance.**
1. All 20 event types in `EventType`; all 20 `EventPayload<T>` discriminated; all 20 Zod schemas exported.
2. `emitEvent()` rejects payload not matching its event-type schema with `reason: 'PAYLOAD_VALIDATION_FAILED'`.
3. `emitEvent()` returns `{ ok: true, eventHash, eventId }` on successful insert against a stubbed/seeded local DB.
4. Hash chain violation surfaces as `{ ok: false, reason: 'HASH_CHAIN_VIOLATION' }` (mock the trigger throw or test against local Supabase with deliberate stale `prevEventHash`).
5. `SYSTEM_ACTOR_HANDLE` constant exported and matches the seeded UUID byte-for-byte.
6. `isEconomicV1UiEnabled()` follows the `isAuthWired()` pattern: false by default, enables on `FFF_ECONOMIC_V1_UI=true`.
7. `bun run test` reports zero new failures; `bun run build` green.
8. RPC migration applies cleanly (`supabase db reset` or apply-against-clean-clone passes).

**Blocks.** 4A.2, 4A.3, 4A.4 all depend on the writer + types + schemas. UI gating in any new page depends on `isEconomicV1UiEnabled()`.

**Does not block.** Concurrent-insert race fix (§6.1b) — that lands as a concern-1 follow-up before 4A.2's first write-path route, but does not gate 4A.1 itself.

**Directive filename.** `P4_CONCERN_4A_1_DIRECTIVE.md`

### 9.2 4A.2 — Offer surface

**Scope.** `src/lib/offer/*`, `src/app/api/offers/**`, `src/components/offer/*`, `src/app/vault/offers/**` (new files; old retire in 4B), `src/app/api/offers/**/__tests__/*.test.ts`. Includes `AssetRightsModule.tsx` REWRITE.

**Output.** 5 user-driven offer routes + 2 read routes, plus pages and components, all gated by `FFF_AUTH_WIRED` / `FFF_ECONOMIC_V1_UI`.

**Acceptance.** Buyer can compose + send + cancel an offer; creator can counter + accept + reject; all 6 offer events land in `ledger_events` with valid hash chain; concern 2 acceptance test suite remains green.

**Blocks.** 4A.3 (assignment.created co-emits here); 4A.5 (pack composer rewires AssetRightsModule).

**Directive filename.** `P4_CONCERN_4A_2_DIRECTIVE.md`

### 9.3 4A.3 — Assignment surface

**Scope.** `src/lib/assignment/*` (new), `src/app/api/assignments/**`, `src/components/assignment/*` (new), `src/app/vault/assignments/**` (new pages).

**Output.** 6 user-driven assignment routes + 2 read routes + auto-accept cron scaffold + cashed_out Stripe webhook wiring.

**Acceptance.** Creator can deliver piece / deliver / confirm-rights-grant; buyer can accept-delivery / request-revision; auto-accept cron emits `assignment.accepted_by_buyer` after 14d for `delivered` rows.

**Blocks.** 4A.4 (dispute thread relates to assignments).

**Directive filename.** `P4_CONCERN_4A_3_DIRECTIVE.md`

### 9.4 4A.4 — Dispute surface

**Scope.** `src/lib/dispute/*`, `src/app/api/disputes/**`, `src/components/dispute/*`, `src/app/vault/disputes/**`.

**Output.** 5 dispute routes (incl. admin resolve + reviewer appeal-resolve) + read routes + reason-code enum + evidence-submission guards.

**Acceptance.** Either party can open dispute; evidence submission respects state guard (§8.2a); admin resolve dual-emits on dispute thread + assignment thread; cool-down (§5) enforced.

**Dependency.** §3.6 admin/reviewer auth model must resolve before this phase.

**Directive filename.** `P4_CONCERN_4A_4_DIRECTIVE.md`

### 9.5 4A.5 — Cross-cutting (pack composer, fee panel, AssetRightsModule rewire)

**Scope.** `PackComposer`, `FeeTransparencyPanel`, `RightsTemplatePicker`, `ExpirationSelector`, and the `AssetRightsModule.tsx` submit-handler REWRITE. Scope overlaps with 4A.2 but is split to keep 4A.2's route/page diff focused.

Decision: **fold this into 4A.2** rather than keep as a separate phase. Revising §9 to reflect: 4A.5 is absorbed into 4A.2. Renumber 4A.6 → 4A.5.

### 9.5' (formerly 4A.6) — UI flag gating sweep

**Scope.** Ensure every new page opens with the `isEconomicV1UiEnabled()` guard. Ensure `FFF_ECONOMIC_V1_UI` is added to `src/lib/env.ts`, `src/lib/flags.ts`, `vitest.config.ts` forwarding. Parallel to 4A.1 — the flag must exist before pages are written. Actually: this work belongs entirely inside 4A.1 (lib scaffolding) — no separate phase needed.

**Final revised sequence:**
- **4A.1** — Event-writer lib + `FFF_ECONOMIC_V1_UI` flag scaffolding (env, flags, vitest forwarding)
- **4A.2** — Offer surface (routes + pages + components + AssetRightsModule rewire + pack composer)
- **4A.3** — Assignment surface (routes + pages + components + cron + Stripe webhook)
- **4A.4** — Dispute surface (routes + pages + components + admin/reviewer guard)
- **4B** — Tear-down + flag flip

### 9.6 4B — Tear-down + flip

**Scope.**
- DELETE all 13 retiring API route files
- DELETE all 9 retiring pages (3 get filesystem overwrite from new implementations; 6 are pure removal — the `/assignment/*` top-level tree and `assignment/new`, `assignment/[id]/activate`, `assignment/[id]/fund`)
- DELETE all 17 DELETE-classified components
- DELETE `src/lib/assignment/` (old) and `src/lib/special-offer/` entirely
- DELETE 13 test files in retiring `__tests__/` dirs
- Flip `FFF_ECONOMIC_V1_UI=true` and `FFF_AUTH_WIRED=true` in production env
- Smoke-path verify per audit §6 AC #10

**Acceptance.** All 10 ACs in `P4_UI_DEPRECATION_AUDIT.md` §6 pass.

**Directive filename.** `P4_CONCERN_4B_DIRECTIVE.md`

---

## 10. Open product questions

Non-blocking for 4A.1, but must resolve by the indicated phase:

| # | Question | Must resolve by |
|---|---|---|
| 1 | Admin/reviewer auth model (§3.6): role column on `actor_handles` vs env-list | 4A.4 kickoff |
| 2 | Auto-accept cron placement: Next.js 16 route-handler cron vs Supabase Edge Function | 4A.3 kickoff |
| 3 | Stripe webhook handler — is existing `src/app/api/stripe/*` scaffold spec-canonical, or rewrite? | 4A.3 kickoff |
| 4 | Notifications (§12.3): in-scope for 4A or deferred to post-concern-4? Currently deferred. Confirm. | 4B kickoff (deploy 2 should or should not include notification surface) |
| 5 | Maintenance-mode fallback pages at the three `/vault/*` URLs during rollback (audit §5.5 open item 4) | 4B kickoff |
| 6 | Concern 3 open item — bearer-vs-cookie token extraction — will this change by 4A.2? | 4A.2 kickoff; resolve via concern 3.5 spin-off first |
| 7 | Event-trail viewer: always inline in detail page vs. expandable panel | 4A.2 kickoff (affects OfferDetailView layout) |
| 8 | Component-count discrepancy (audit §1.3 / §7): 18 vs 19 | ignorable unless surface in 4A execution |

---

## 11. Acceptance criteria for this lock

This design lock is "locked" when:

1. Founder approves §2 naming conventions (route paths, page paths, lib paths, component paths).
2. Founder approves §3 API inventory (20 events all covered; 16 new routes + 1 ledger read + cron + webhook).
3. Founder approves §4 page inventory and URL-reuse strategy.
4. Founder approves §7 flag strategy (page gating via `FFF_ECONOMIC_V1_UI` server-only).
5. Founder approves §9 sub-phase sequence (4A.1 → 4A.2 → 4A.3 → 4A.4 → 4B).
6. Open questions §10 items 1–3 have a named resolution path by the time the corresponding sub-phase directive is drafted.

Once locked, the first executable directive (`P4_CONCERN_4A_1_DIRECTIVE.md`) can be drafted directly from §2, §3.1–3.4 scope lines, §6.1 writer contract, and §7 flag lines.

---

## 12. Revision history

- **2026-04-21 — Draft 1.** Initial lock. Derived from: re-read of `ECONOMIC_FLOW_v1.md` §4/§5/§7/§8/§12; `P4_UI_DEPRECATION_AUDIT.md` §2/§3/§5/§6; repo state check (`ls src/app/`, `ls src/app/api/`, `find src/app -type d`, `ls supabase/migrations/`) confirming zero replacement route stubs pre-exist (concern 1 landed DDL only). Sub-phase sequence §9 revised mid-draft to absorb 4A.5/4A.6 into earlier phases; retained in revision history for trace.
- **2026-04-21 — Draft 2 (self-red-team before 4A.1 dispatch).** Three corrections:
  1. §6.1 writer contract rewritten. Hash computation and `prev_event_hash` validation are Postgres-trigger responsibilities (`enforce_ledger_hash_chain()` in concern 1 migration L427-466). TS-side `emitEvent()` is now: Zod payload validation + `INSERT ... RETURNING event_hash`. Caller loads prior hash.
  2. §6.1a added — atomicity via Postgres RPC-per-operation (Supabase JS has no client-side transactions). RPC catalogue deferred to 4A.2/4A.3/4A.4. 4A.1 ships one utility RPC only.
  3. §6.1b flags a concern-1 defect: `enforce_ledger_hash_chain()` has a concurrent-insert race under read-committed isolation. Fix is a `UNIQUE (thread_type, thread_id, prev_event_hash)` constraint; lands as a concern-1 follow-up before 4A.2's first write-path route. Not blocking 4A.1.
  4. §9.1 rewritten with narrow scope (types, schemas, system-actor constant, writer, flag scaffolding, one utility RPC). Original scope described a fatter writer that duplicated trigger responsibilities.

---

_End of P4 concern 4 design lock._
