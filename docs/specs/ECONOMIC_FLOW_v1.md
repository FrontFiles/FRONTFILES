# ECONOMIC_FLOW_v1.md

**Status:** LOCKED 2026-04-20 (revision 2, post red-team pass 2)
**Governs:** Path A v1 economic layer — offers, assignments, event trail, pack primitives
**Cross-references:** `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` §Decisions; `docs/audits/REMEDIATION_PLAN_20260418.md` tiers T1, T4; tier P0–P7 sequencing (see §14)
**Terminology:** See §9. Banned: "certified", "tamper-proof", "immutable", "guaranteed immutable". Allowed: "tamper-evident", "independently reviewable", "provenance-aware", "verifiable".

---

## 1. Scope

Defines the economic flow for single-shot commissions and rights grants on Frontfiles. Covers offer negotiation, assignment execution, event emission, and pack (multi-item) mechanics. Does **not** cover: auth wiring (see T1), payment provider integration specifics (see T4 payments subsection), portfolio/asset discovery (separate spec).

This spec is build-governing. Any implementation that diverges from it must land as a concurrent spec amendment, not as silent drift.

## 1.1 Platform role

Frontfiles acts as an **agent** facilitating a direct sale between creator (seller of record) and buyer (purchaser). The platform is not a principal, does not take title to editorial content, and does not act as merchant of record for the underlying work. Platform fees are compensation for facilitation services (listing, negotiation infrastructure, escrow coordination via Stripe Connect, dispute administration, ledger integrity). Tax treatment follows from this role: creator is responsible for income and, where applicable, VAT on gross consideration; platform is responsible for tax on its fee only (§14.4 elaborates).

## 2. Principles

- **Single-shot only.** Retainer deferred to v2, gated by ≥20 completed briefs + ≥3 explicit buyer asks for monthly.
- **Durable from day 1** (Path A). Exposure gated by `AUTH_WIRED=false` until T1+T4 both green.
- **Atomic pack.** Creator accepts or rejects the whole pack. Partial acceptance via counter with modified composition. One offer = one contract.
- **Uniform rights across a pack.** Different rights = separate offers.
- **Same creator only per offer.** Cross-creator bundling is out of scope. Enforced at DB level via triggers (§7).
- **Full economic event trail.** Pseudonymize actor on GDPR erasure.
- **Terminology discipline** per §9.
- **Transition atomicity.** State transition row + event row write in a single DB transaction (§8.5).

## 3. Actors

- **Buyer.** Brand, publication, commissioner, or other creator acting as commissioner. Initiates offers.
- **Creator.** Journalist, photographer, editor, or other editorial contributor. Receives offers, negotiates, delivers.
- **Platform.** Event-trail custodian, dispute arbiter, fee custodian, payment custodian.

## 4. Offer state machine

| State | Entered via | Exits to |
|---|---|---|
| `draft` | Buyer opens composer (**client-side only, not persisted**) | `sent`, or discarded (no DB row, no event) |
| `sent` | Buyer publishes (first DB write) | `countered`, `accepted`, `rejected`, `expired`, `cancelled` |
| `countered` | Either side counters | `countered` (re-counter), `accepted`, `rejected`, `expired`, `cancelled` |
| `accepted` | Either side accepts | terminal — triggers assignment creation |
| `rejected` | Either side rejects, or force-terminate (F10) | terminal |
| `expired` | Timer fires | terminal |
| `cancelled` | Buyer withdraws before counterparty acts | terminal |

Counter resets the expiration clock for the receiving side. Default expiration 7 days, buyer-configurable at send time (F3).

**Drafts never hit the DB.** The composer holds draft state in client memory. Only `sent` creates the first `offers` row. This eliminates a class of GDPR and orphan-row concerns and avoids an `offer.draft_created` event entirely.

**Cancellation window.** Buyer may cancel while in `sent` or `countered` and the counterparty has **not** yet responded since the last buyer action. Once the creator counters or acts, buyer must wait for the next turn before cancelling. Cancellation emits `offer.cancelled`. After `accepted`, the flow is cancellation via dispute, not offer cancellation.

## 5. Assignment state machine

| State | Entered via | Exits to |
|---|---|---|
| `active` | `offer.accepted` fires | `delivered` |
| `delivered` | Asset-pack: creator confirms rights grant. Brief-pack: all expected pieces delivered. | `accepted_by_buyer`, `revision_requested`, `disputed` |
| `revision_requested` | Buyer requests revision (**brief-pack only**; asset-pack has no revisions) | `delivered` (loop; cap per `assignment_deliverables`) |
| `accepted_by_buyer` | Buyer accepts delivery, or 14-day auto-accept window elapses | `cashed_out`, `disputed` (creator-initiated only, until `cashed_out`) |
| `cashed_out` | Stripe transfer clears to creator | terminal |
| `disputed` | Buyer opens within 14 days of `accepted_by_buyer`, or creator opens any time before `cashed_out` | `accepted_by_buyer`, `refunded`, `split` |
| `refunded` | Dispute resolved toward buyer | terminal (may be reopened into `dispute.under_appeal` within the §12.4a appeal window) |
| `split` | Dispute resolved proportionally | terminal (may be reopened into `dispute.under_appeal` within the §12.4a appeal window) |
| `dispute.under_appeal` | Creator appeals any terminal dispute outcome (`accepted_by_buyer`, `refunded`, `split`) within the §12.4a appeal window | `accepted_by_buyer`, `refunded`, `split` (decided by independent-review path §12.4b; terminal — no second appeal) |

**Dispute windows.**
- Buyer-initiated: 14 days after `accepted_by_buyer`. After that, accepted is final and transitions to `cashed_out` on Stripe clearance.
- Creator-initiated: any time before `cashed_out` (creator raises only after realizing they cannot deliver — payload reason `creator_cannot_deliver` — or counterparty fraud suspicion).

## 6. Cross-domain handoff

`offer.accepted` creates the `assignment` row and emits `assignment.created` **in the same DB transaction**. `assignments.offer_id` FK back to origin. Fee, composition, and rights scope travel from offer to assignment unchanged — the offer is the negotiated contract, the assignment is the execution vehicle.

Assignment never re-snapshots the fee. All money values are derived from the originating offer via join on `assignments.offer_id → offers.gross_fee, offers.platform_fee_bps`.

## 7. Offer shape

Canonical structure. T4 migrations implement this directly.

```
offers {
  id              uuid pk
  buyer_id        uuid fk(users) not null
  creator_id      uuid fk(users) not null
  target_type     enum('single_asset', 'asset_pack', 'single_brief', 'brief_pack') not null
  gross_fee       numeric(12,2) not null       -- total paid by buyer
  platform_fee_bps int not null                -- snapshotted at offer creation and locked for the life of the offer
  currency        char(3) not null
  rights          jsonb not null               -- uniform scope; one rights config per offer
  current_note    text                         -- 500-char max, enforced by trigger
  expires_at      timestamptz not null
  state           offer_state not null
  cancelled_by    uuid fk(users)               -- populated only on cancel; nullable
  created_at      timestamptz not null
  updated_at      timestamptz not null
  CHECK (buyer_id != creator_id)               -- self-dealing prevention
}

offer_assets {                                  -- for target_type in ('single_asset', 'asset_pack')
  offer_id uuid fk(offers)
  asset_id uuid fk(assets)
  position int
  UNIQUE(offer_id, asset_id)
  -- Trigger: asset.creator_id must equal offer.creator_id
}

offer_briefs {                                  -- for target_type in ('single_brief', 'brief_pack')
  offer_id uuid fk(offers)
  position int
  spec     jsonb                                -- {title, deadline_offset_days, deliverable_format, revision_cap, notes}
}

assignment_deliverables {                       -- tracks revision rounds per piece (brief-pack)
  assignment_id uuid fk(assignments)
  piece_ref     text not null                   -- matches offer_briefs.position or stable slug
  revision_cap  int not null                    -- copied from offer_briefs.spec.revision_cap at creation
  revisions_used int not null default 0
  delivered_at  timestamptz
  PRIMARY KEY (assignment_id, piece_ref)
}
```

N=1 is not special-cased. A `single_asset` offer has exactly one row in `offer_assets`; an `asset_pack` has ≥2. Same for briefs.

Hard constraints:

- All items within an offer belong to the same creator (DB **trigger**, not check constraint — triggers allow cross-row lookups)
- `target_type` determines which child table is populated (exactly one of `offer_assets` or `offer_briefs` per offer; enforced by trigger)
- Max 20 items per offer in v1 (F9)
- Self-dealing prevention via `CHECK (buyer_id != creator_id)`
- Rate limit (application layer): max **3 pending offers** per buyer per creator. 4th attempt blocked at composer submit. Resets as offers reach any terminal state.

**No DB row until `sent`.** Composer drafts live in client state only. First DB write is the `sent` transition which inserts the `offers` row + emits `offer.created` event atomically.

RLS: buyer and creator can read their own offers and child rows. Service-role never used for offer routes. No public access.

## 8. Event catalogue

**Fifteen event types.** Namespaced (`offer.*`: 6; `assignment.*`: 9). Append-only. jsonb payload with embedded `v` version field (start at `v=1`; increment on breaking payload shape changes).

- **Payload discipline:** payloads carry transactional facts only (amounts, timestamps, state identifiers, reasons, piece_refs, rate-lock snapshots). Payloads MUST NOT contain names, email addresses, IP addresses, or raw auth identifiers. Party references are made via `actor_ref` only.
- **Tamper-evidence:** each row carries `event_hash`, a sha256 digest over (`prev_event_hash`, `payload_version`, `event_type`, canonicalised `payload`, `created_at` ISO-8601, `actor_ref`), forming an append-only hash chain per thread. The chain is independently verifiable; the platform does not claim it is immutable or certified — only tamper-evident and independently reviewable.

### 8.1 Offer events

| Event | Emitted on | Payload (v=1) |
|---|---|---|
| `offer.created` | Offer published, `draft` → `sent` | `{v, target_type, items, gross_fee, platform_fee_bps, currency, rights, expires_at, note}` |
| `offer.countered` | Any counter | `{v, by_actor_id, fee_before, fee_after, added_items, removed_items, rights_diff, note_before, note_after, expires_at}` |
| `offer.accepted` | Either side accepts | `{v, by_actor_id}` |
| `offer.rejected` | Either side rejects, or force-termination (F10) | `{v, by_actor_id?, reason}` |
| `offer.expired` | Expiration timer fires | `{v, last_active_actor_id}` |
| `offer.cancelled` | Buyer withdraws before counterparty acts since last buyer turn | `{v, by_actor_id}` |

### 8.2 Assignment events

| Event | Emitted on | Payload (v=1) |
|---|---|---|
| `assignment.created` | On `offer.accepted` (same transaction) | `{v, offer_id, target_type, expected_piece_count}` |
| `assignment.piece_delivered` | Creator delivers a piece (brief-pack only) | `{v, piece_ref, submitted_at}` |
| `assignment.delivered` | All pieces in, or asset-pack rights confirmed | `{v, at}` |
| `assignment.revision_requested` | Buyer requests revision (brief-pack only) | `{v, piece_ref, note, rounds_used, rounds_remaining}` |
| `assignment.accepted_by_buyer` | Buyer accepts delivery, or auto-accept after 14d | `{v, by_actor_id, auto: bool}` |
| `assignment.cashed_out` | Stripe transfer clears to creator | `{v, amount, net_to_creator, payment_ref}` |
| `assignment.disputed` | Either party opens dispute | `{v, by_actor_id, reason, evidence_refs}` |
| `assignment.refunded` | Dispute resolved toward buyer | `{v, amount_to_buyer, rationale}` |
| `assignment.split` | Dispute resolved proportionally | `{v, amount_to_creator, amount_to_buyer, rationale}` |

### 8.3 Storage & RLS

Single polymorphic table keyed by `thread_type` + `thread_id`, covering offer, assignment, and dispute threads:

```
public.ledger_events(
  id              uuid primary key default gen_random_uuid(),
  thread_type     text not null check (thread_type in ('offer','assignment','dispute')),
  thread_id       uuid not null,
  event_type      text not null,         -- namespaced: offer.created, assignment.delivered, dispute.opened, ...
  payload_version text not null default 'v1',
  payload         jsonb not null,         -- transactional facts only (see §8.2 discipline)
  actor_ref       uuid not null references public.actor_handles(handle) on delete restrict,
  prev_event_hash text,                   -- first row in a thread may be null
  event_hash      text not null,          -- sha256(prev_event_hash || payload_version || event_type || payload_canonical || created_at_iso || actor_ref)
  created_at      timestamptz not null default now()
);
create index ledger_events_thread on public.ledger_events(thread_type, thread_id, created_at);
```

Append-only. RLS: party to the thread (resolved via `actor_ref` → `actor_handles`) + platform admin can read. No updates or deletes from any role.

### 8.4 Actor handles (pseudonymisation layer)

Events reference parties via `actor_ref`, a stable pseudonymous handle — never the auth user id directly. Mapping lives in:

```
public.actor_handles(
  handle        uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete set null,
  tombstoned_at timestamptz,
  created_at    timestamptz not null default now()
);
```

RLS: a user may read only the handle row that maps to their own auth_user_id. Platform admin may read all. Ledger events resolve actor identity via this table at read time only.

### 8.5 Transition atomicity

Every state mutation and its event emission occur inside a single DB transaction:

```
BEGIN;
  UPDATE offers SET state = 'accepted', updated_at = now() WHERE id = $1 AND state IN ('sent', 'countered');
  INSERT INTO ledger_events (thread_type, thread_id, event_type, payload, actor_ref, prev_event_hash, event_hash)
    VALUES ('offer', $1, 'offer.accepted', $payload, $actor_ref, $prev_hash, $hash);
  -- On offer.accepted only:
  INSERT INTO assignments (offer_id, ...) VALUES (...);
  INSERT INTO ledger_events (thread_type, thread_id, event_type, payload, actor_ref, prev_event_hash, event_hash)
    VALUES ('assignment', $assignment, 'assignment.created', $assignment_payload, $actor_ref, NULL, $assignment_hash);
COMMIT;
```

Rollback on any failure. Never emit an event without a state mutation, and never mutate state without an event. Enforced via server-side route handlers (no direct client writes). Event consumers (notifications, admin dashboards) are downstream of commit.

### 8.6 Payload versioning

Consumers dispatch on the `v` field at application layer. Payload shape changes require a bump (`v=1` → `v=2`) and a dual-read period. Additive changes (new optional fields) may stay at the current `v`.

### 8.7 GDPR erasure (Art. 17) and portability (Art. 20)

**Erasure:** on verified request, the user's row in `public.actor_handles` is tombstoned (`tombstoned_at = now()`, `auth_user_id = null`). Ledger events are preserved — the counterparty retains the full transactional record. Actor identity at read time resolves to "deleted actor" once tombstoned. The hash chain remains intact; no event rows are mutated.

**Portability:** on verified request, the platform exports every ledger event row where the user's (pre-erasure) handle appears as `actor_ref`, serialised as JSON, including the hash chain links for independent verification. Export is delivered within 30 days of request per GDPR Art. 12(3).

**Retention boundary:** see §16.

## 9. Terminology discipline

**Tamper-evidence mechanism.** "Tamper-evident" in this spec is backed by the per-thread sha256 hash chain defined in §8 (header) and §8.3: each ledger event row digests (`prev_event_hash`, `payload_version`, `event_type`, canonicalised `payload`, `created_at` ISO-8601, `actor_ref`), so any mutation of a prior row breaks the chain and is detectable on independent replay. The platform makes no claim beyond that — the chain is tamper-evident and independently reviewable, not certified, not tamper-proof, not immutable. Permitted alternatives when describing offer/assignment state locks: "locked at offer creation", "fixed for the life of the offer", "append-only", "hash-chained".

**Allowed:**
tamper-evident, independently reviewable, provenance-aware, verifiable, on-platform, editorial rights, rights scope, rights grant, rights transfer (only when ownership changes hands, not the v1 default), commission, brief, assignment, offer, counter, pack, locked at offer creation, fixed for the life of the offer, append-only, hash-chained.

**Banned:**
certified, certification, tamper-proof, immutable, guaranteed immutable, blockchain-verified (unless actually on-chain), fully-licensed (imprecise), secured (overclaim), bulletproof, rock-solid, enterprise-grade (marketing filler), verified (without subject — "verified by whom?").

**Naming locks:**
- Multi-item offer is a **pack**, not "bundle" or "collection." (Founder call: "pack" wins across product and marketing surfaces.)
- Existing-work offer = **asset-pack** / **single_asset**.
- New-commission offer = **brief-pack** / **single_brief**.
- Fee-to-creator = **net payout**. Fee-taken-by-platform = **platform fee**. Total paid by buyer = **gross fee**.
- Asset-pack delivery = **rights grant** (default: license, not transfer). **rights transfer** reserved for actual ownership change, flagged explicitly in rights template.

CI enforcement: grep-based pre-commit hook on `docs/**`, `src/**/*.ts`, `src/**/*.tsx` fails on any banned term. Exceptions (quoted banned terms in documentation warning *against* them) allowed via inline `<!-- allow-banned: reason -->` marker. See T4 exit criteria.

## 10. Locked answers — F1–F16

| # | Question | Locked value |
|---|---|---|
| F1 | Offer target: asset or brief? | Both. `target_type` variants handle each. |
| F2 | Payment authorization timing | **Stripe Connect with separate charge/transfer.** Platform charges buyer in full at `offer.accepted` into platform escrow. Platform transfers net payout to creator Stripe Connect account at `accepted_by_buyer` → `cashed_out`. Dispute window holds funds in escrow. Not manual-capture (7-day auth window insufficient). |
| F3 | Offer expiration | Per-counter. Each counter resets receiver's clock. 7-day default, buyer-configurable at send (min 24h, max 30d). |
| F4 | Negotiation medium | Structured counter + 500-char note field (`offers.current_note`, plus `note_before/after` in `offer.countered` payload). No free chat. |
| F5 | Revision rounds | Negotiated per offer. Default in UI: 1 round per piece. Brief-pack only. Asset-pack has zero revision rounds. |
| F6 | Platform fee transparency | Visible to both sides. Buyer sees "you pay X, creator receives Y." |
| F7 | Rights scope surface | Platform-curated template library, counsel-reviewed, v1 fixed set (see F15). Override allowed only within legal bounds; "custom" entries flagged for admin review. |
| F8 | In-flight offer fate on account deletion | Force-resolve first. Account deletion blocked while counterparty has standing. Pseudonymize on erasure of closed-state rows. |
| F9 | Pack size limits | Min 1 (N=1 is the single case). Max 20 per offer in v1. |
| F10 | Asset availability during pending pack offer | Available to other buyers. First-to-accept wins. Pending offers on already-accepted assets force-terminated via `offer.rejected` with `{reason: 'asset_no_longer_available'}`. Both sides notified. |
| F11 | Pack pricing display | Per-item reference price (informational, from creator's list price if set) + pack total (the only negotiated value). |
| F12 | Mixed-media packs | Allowed. Rights uniformity constrains what mixes make sense; schema allows all. |
| F13 | Counter changes composition | Allowed. UI surfaces diff explicitly: added items, removed items, fee delta, note delta. |
| F14 | Revision rounds for brief-pack | Per-deliverable, tracked in `assignment_deliverables`. Cap negotiated at offer level, applies to each piece separately. |
| F15 | Pack rights uniformity | Hard-enforced. Different rights per item = separate offers. v2 may allow per-item rights. V1 rights templates: (a) editorial one-time, (b) editorial with archive (12mo), (c) commercial with restrictions. Counsel-reviewed before T4 exit. |
| F16 | Platform fee rate-lock | `platform_fee_bps` snapshotted on `offer.created`, locked for the life of the offer and its assignment. v1 default **1500 bps (15%)** — **placeholder pending business confirmation before P5**. A platform-wide rate change applies only to offers created after the change. |

## 11. Pack mechanics

### 11.1 Composition

- Min 1, max 20 items per offer (v1)
- Same creator only (DB-enforced via trigger on `offer_assets` and `offer_briefs`)
- Mixed-media allowed (photo + text + video)
- Rights config is uniform across all items

### 11.2 Pricing

- Single total gross fee for the whole pack (`offers.gross_fee`)
- Net payout = `gross_fee * (10000 - platform_fee_bps) / 10000`
- Per-item reference price shown in UI, drawn from creator's list price if set (else blank)
- Reference price is informational. Only pack total is negotiated.

### 11.3 Atomic negotiation

- Pack accepted or rejected as a whole
- Partial acceptance achieved via counter with modified composition
- Counter can modify: fee, composition (add/remove items), rights scope, expiration, note — or any combination
- Each counter is a full new atomic proposal that supersedes the prior round

### 11.4 Asset availability during pending pack offer

- Pack offer does **not** reserve its items
- Multiple concurrent offers on the same asset are allowed; first-to-accept wins
- When an asset becomes unavailable mid-negotiation (accepted in another offer, or removed by creator), pending offers referencing it are force-terminated via `offer.rejected` with payload `{reason: 'asset_no_longer_available', affected_item_ids}`
- Both sides notified via in-app notification + email

### 11.5 Brief-pack delivery tracking

- Each piece delivered fires `assignment.piece_delivered` with `{piece_ref, submitted_at}`; `assignment_deliverables.delivered_at` set in same transaction
- Assignment transitions `active → delivered` when all rows in `assignment_deliverables` have `delivered_at IS NOT NULL`
- Revision rounds per-deliverable; `assignment_deliverables.revisions_used < revision_cap` gate enforced server-side; cap snapshotted at assignment creation from offer terms

### 11.6 Asset-pack delivery

- Assignment phase is minimal — no creation work, only rights grant confirmation
- Transition to `delivered` on creator confirming rights grant via a single action in assignment view
- No revision rounds (nothing to revise)
- Transition to `cashed_out` follows the same Stripe transfer path as brief-pack

## 12. UX surfaces

### 12.1 Net-new in v1 (P4 scope)

- **Pack composer.** Multi-select from creator portfolio for asset-packs; brief-slot builder for brief-packs. Total-price input. Rights config (template picker + override). Expiration selector. 500-char note field.
- **Pack preview.** Read-only summary. Both sides see identical view during negotiation.
- **Pack counter UI.** Structured composition-diff editor (add/remove items) + fee + rights + note. Visual diff from last round ("Creator removed 2 items, added 1, proposed fee €X → €Y, updated note").
- **Assignment view (extended).** For brief-pack: per-piece progress derived from `assignment_deliverables` + event trail. For asset-pack: rights-grant confirmation state.
- **State badges.** Reflect §9 discipline. Allowed: "Offer pending," "Rights grant complete," "Pack delivered." Never: "Certified," "Verified."
- **Fee transparency panel.** Buyer-side: "Gross fee €X. Platform fee €Y. Creator receives €Z." Snapshot shown once `offer.created`.

### 12.2 Offer cancellation UX

- Cancel button shown in buyer view of `sent` or `countered` offers where last turn was buyer's.
- Confirmation modal: "Cancel this offer? The creator will be notified. You can send a new offer any time."
- On confirm, `offer.cancelled` fires, state = `cancelled`, creator in-app notification + email.

### 12.3 Notifications

- In-app toast + persisted notification row + email on every terminal transition (accepted, rejected, expired, cancelled, delivered, accepted_by_buyer, cashed_out, refunded, split).
- In-app + persisted only (no email) on non-terminal (countered, piece_delivered, revision_requested).
- Email deduplication: max one per hour per user per offer thread.

### 12.4 Dispute raise UX

- Buyer: button visible in `delivered` and `accepted_by_buyer` (within 14d) states.
- Creator: button visible in `active` and `delivered` states with label "Can't deliver — open dispute."
- Both routes require reason code + optional evidence upload.
- Opens `disputed` state; platform admin receives notification; flow moves to admin dispute queue (P7 UI; v1 uses SQL dashboard).

### 12.4a Creator appeal window

The creator may appeal any platform decision in a dispute within **14 calendar days** of the decision being communicated. Appeal must be initiated via the in-platform dispute view and must include a written statement of grounds. The thread state transitions to `dispute.under_appeal` (§5).

### 12.4b Independent-review path

An appealed decision is reviewed by a reviewer outside the original decision line (in v1: a founder-level reviewer not previously involved; post-v1: an external ombuds panel when volume justifies). The reviewer receives the ledger events, the dispute record, and both parties' statements. The reviewer's decision is recorded as a `dispute.appeal_resolved` event and is terminal.

### 12.5 Preserved from scaffold

- Single-asset offer UI (now renders as N=1 case of pack model)
- Creator portfolio browse

### 12.6 Deprecated at P5 hard cut

- Map-store-backed offer/assignment flows
- `mockVaultAssets` fixture file
- Any remaining UI referring to removed Stripe webhook path

## 13. Out of scope for v1

- Retainer / recurring engagement model — v2, gated by demand
- Cross-creator bundling — v2 at earliest, likely never (different product)
- Per-item rights within a pack — v2
- Free-text negotiation chat alongside structured counter — v2
- Admin dispute-resolution UI — P7, post-launch (v1 uses SQL dashboard + manual transfer)
- Public offer marketplace — not planned
- VAT/sales-tax collection by platform — **stubbed in v1** (see §14 Tax)
- Creator payout in non-base currency with platform-managed FX — see §14 FX

## 14. Dependencies, infrastructure, tax, FX

### 14.1 Dependencies

This spec assumes and requires:

- **T1** landed — `requireActor` available; user-JWT Supabase clients available
- **T4** landed — all tables, RLS policies, triggers, constraints from §7 and §8
- **KD-9 resolved** — RLS verifiable in CI (Vitest env loading fixed)
- **P3 asset cutover** complete before P4 ships (offers need real assets to reference)

Sequence per remediation plan: P0 (KD-9 + polish) → P1 (T1 auth) → P2 (T4 schema + RLS) → P3 (asset cutover) → P4 (offers + assignments cutover with pack primitives) → P5 (hard cut + AUTH_WIRED=true + prod assertion + platform fee confirmed) → P6 (T&Cs + GDPR runbook) → P7 (admin trail viewer, deferred).

### 14.2 Timer infrastructure

- Offer expiration and 14-day auto-accept implemented via **Supabase Edge Functions on cron**, hourly tick.
- Cron reads rows where `expires_at < now() AND state IN ('sent', 'countered')` and rows where `assignment.state = 'delivered' AND delivered_at < now() - interval '14 days'`, emits the appropriate event in a transaction.
- Idempotent: event emission checks state is still valid inside the transaction.
- Observability: every cron tick logs count-by-type to platform admin dashboard.

### 14.3 FX policy (v1)

- Offer created in currency X charges buyer in X, pays creator in X.
- Conversion to creator's bank currency happens at Stripe Connect payout, using Stripe's FX at transfer time. Creator sees FX as Stripe's line item, not a platform concern.
- **FX is not rate-locked by platform in v1.** Rate locks = v2 feature if demand emerges.

### 14.4 VAT / Sales tax (v1 stub)

- Platform fee is charged gross; tax treatment on platform fee handled at platform entity level (out of scope here, counsel-led).
- Net payout treated as creator's gross revenue; creator responsible for their own tax reporting in v1.
- T&Cs (T6) must make this explicit.
- Platform VAT-MOSS / OSS registration and tax invoicing = v2.

## 15. Revision policy

Changes to this spec land via commit to this file. §Decisions (in T0.5 memo) takes precedence on contradiction. Any change to a state machine or event catalogue shape requires a concurrent payload version bump (`v=1` → `v=2`) if it breaks existing consumer shapes. Additive-only changes (new optional fields, new terminal states) may stay at the current `v`.

Spec review gate: any change to §4, §5, §7, §8 requires founder sign-off before implementation begins.

## 16. Retention

Ledger events are retained in the primary store for **6 years** after the final terminal-state transition of their thread. After 6 years, events are rotated to cold archival with hashed identifiers only (`actor_ref` replaced by `sha256(actor_ref)`); the primary-store rows are removed. The hash chain is preserved in archival form and remains independently verifiable. Actor handles tombstoned under §8.7 follow the same schedule, keyed off the last thread they participated in. The retention clock may be extended on a per-thread basis where an active legal obligation (hold, subpoena, regulator request) requires it, for the duration of that obligation.

**Red-team passes applied:** 2 (2026-04-20). Fixes integrated: C1–C11, I1–I10, M3–M5. Self-dealing prevention, Stripe Connect escrow (replacing manual-capture error), `offers.cancelled` state, `assignment_deliverables` revision table, platform fee rate-lock (F16), 14-day dispute window, creator-initiated dispute path, transition atomicity, client-side-only drafts, rate limiting, timer infrastructure, FX/VAT stubs.

**Red-team pass 3 applied:** 3 (2026-04-20). Rethink through ethics / creator-empowerment / simplicity / legal-safety lenses. R1 agent-model declaration (§1.1). R2 unified ledger_events with pseudonymous actor_handles, hash-chained tamper-evidence, payload discipline (§8.3 / §8.4 / §8 header / §8.7). R3 retention schedule (§16), creator appeal right with independent review (§5 / §12.4a / §12.4b), data portability (§8.7), tamper-evidence mechanism (§9), terminology lock strengthened (§9). Founder sign-off obtained under §15 for §5 / §8 / §9 / §12.4 changes. Pre-consumer: payload stays at v=1 per §8.6 exception.
