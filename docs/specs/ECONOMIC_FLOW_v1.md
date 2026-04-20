# ECONOMIC_FLOW_v1.md

**Status:** LOCKED 2026-04-20 (revision 4)
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
| `accepted_by_buyer` | Buyer accepts delivery, or 14-day auto-accept window elapses (clock origin: `assignments.delivered_at`) | `cashed_out`, `disputed` (buyer within 14d of delivered OR creator-initiated as `creator_cannot_deliver`, until `cashed_out`; both paths blocked if assignment has a prior terminal dispute resolution per §5 cool-down clause below) |
| `cashed_out` | Stripe transfer clears to creator | terminal |
| `disputed` | Buyer opens within 14 days of `accepted_by_buyer`, or creator opens any time before `cashed_out` | `accepted_by_buyer`, `refunded`, `split` |
| `refunded` | Dispute resolved toward buyer | terminal (may be reopened into `dispute.under_appeal` within the §12.4a appeal window) |
| `split` | Dispute resolved proportionally | terminal (may be reopened into `dispute.under_appeal` within the §12.4a appeal window) |
| `dispute.under_appeal` | Creator appeals any terminal dispute outcome (`accepted_by_buyer`, `refunded`, `split`) within the §12.4a appeal window | `accepted_by_buyer`, `refunded`, `split` (decided by independent-review path §12.4b; terminal — no second appeal) |

**Dispute windows.**
- Buyer-initiated: from `delivered` onward, through 14 days after `accepted_by_buyer` (clock origin: `assignments.delivered_at` for auto-accept path, or manual acceptance timestamp). After 14d post-acceptance, accepted is final and transitions to `cashed_out` on Stripe clearance.
- Creator-initiated: any time before `cashed_out` (creator raises only after realizing they cannot deliver — payload reason `creator_cannot_deliver` — or counterparty fraud suspicion).

**Dispute cool-down.** Once any dispute on an assignment has reached terminal resolution — whether `dispute.resolved` (admin ruling) or `dispute.appeal_resolved` (independent-review ruling) — no further creator-initiated dispute may be opened on the same assignment. Server-side guard: check for existence of a prior `dispute.resolved` or `dispute.appeal_resolved` event on the dispute thread keyed to `assignment_id`. Buyer-initiated disputes after a prior resolution are similarly blocked. This closes the re-entry loop admitted by the `accepted_by_buyer → disputed` exit.

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
  rights          jsonb not null               -- shape: {template: 'editorial_one_time'|'editorial_with_archive_12mo'|'commercial_restricted'|'custom', params: jsonb, is_transfer: bool}; "custom" flagged for admin review per F7
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

disputes {                                      -- dispute thread, one per escalation on an assignment
  dispute_id           uuid pk default gen_random_uuid()
  assignment_id        uuid fk(assignments) not null
  opener_actor_handle  uuid fk(actor_handles.handle) not null
  opened_at            timestamptz not null default now()
  reason_code          text not null             -- enumerated per §12.4 reason codes
  evidence_refs        jsonb                     -- array of storage URIs; nullable
  state                text not null             -- enum pinned: 'opened'|'resolved'|'appealed'|'appeal_resolved' (transition order); state machine documented in §8.2a
  resolution           text                      -- enum: 'accepted_by_buyer','refunded','split'; null until resolved
  resolution_note      text                      -- admin-written, surfaced to both parties
  resolved_at          timestamptz
  appeal_deadline      timestamptz               -- set on state→resolved; resolved_at + 14d per §12.4a
  appeal_resolved_at   timestamptz
  appeal_rationale     text
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

**Twenty event types.** Namespaced (`offer.*`: 6; `assignment.*`: 9; `dispute.*`: 5). Append-only. jsonb payload with embedded `v` version field (start at `v=1`; increment on breaking payload shape changes, subject to the pre-consumer exception in §8.6).

- **Payload discipline:** payloads carry transactional facts only (amounts, timestamps, state identifiers, reasons, piece_refs, rate-lock snapshots). Payloads MUST NOT contain names, email addresses, IP addresses, or raw auth identifiers. Party references are made via `actor_ref` only.
- **Tamper-evidence:** each row carries `event_hash`, a sha256 digest over (`prev_event_hash`, `payload_version`, `event_type`, canonicalised `payload`, `created_at` ISO-8601, `actor_ref`), forming an append-only hash chain per thread. The chain is independently verifiable; the platform does not claim it is immutable or certified — only tamper-evident and independently reviewable. <!-- allow-banned: meta-negation in §8 preamble declaring what the hash chain does NOT claim -->

### 8.1 Offer events

| Event | Emitted on | Payload (v=1) |
|---|---|---|
| `offer.created` | Offer published, `draft` → `sent` | `{v, target_type, items, gross_fee, platform_fee_bps, currency, rights, expires_at, note}` |
| `offer.countered` | Any counter | `{v, by_actor_id, fee_before, fee_after, added_items, removed_items, rights_diff, note_before, note_after, expires_at}` |
| `offer.accepted` | Either side accepts | `{v, by_actor_id}` |
| `offer.rejected` | Either side rejects, or force-termination (F10) | `{v, by_actor_id?, reason, affected_item_ids?}` |
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

### 8.2a Dispute events

Dispute events live on the `dispute` thread, keyed by `disputes.dispute_id` (§7). Each dispute gets its own hash chain, independent of the associated assignment thread.

| Event | Emitted on | Payload (v=1) |
|---|---|---|
| `dispute.opened` | Either party initiates dispute (buyer from `delivered` or `accepted_by_buyer` within 14d; creator from `active`, `delivered`, or `accepted_by_buyer` with `creator_cannot_deliver`) | `{v, by_actor_id, assignment_id, reason, evidence_refs}` |
| `dispute.evidence_submitted` | Either party submits additional evidence while `disputes.state IN ('opened','appealed')`; `system` actor NOT permitted (always a party act); server-side guard blocks emission once state reaches `resolved` or `appeal_resolved`; single-thread emit (ledger-only, no payment-surface coupling — dual-thread invariant does NOT apply); append-only (evidence cannot be withdrawn) | `{v, submitter_actor_handle, evidence_ref, evidence_type: 'asset_file'|'text_statement'|'external_link'|'other', submitted_at}` |
| `dispute.resolved` | Platform admin decides dispute; assignment state transitions in same transaction | `{v, by_actor_id (admin), outcome: 'accepted_by_buyer'|'refunded'|'split', amount_to_buyer?, amount_to_creator?, rationale}` |
| `dispute.appealed` | Creator invokes appeal within 14d of `dispute.resolved` (§12.4a) | `{v, by_actor_id (creator), grounds}` |
| `dispute.appeal_resolved` | Independent reviewer decides appeal (§12.4b); terminal — no second appeal | `{v, by_actor_id (reviewer), outcome: 'accepted_by_buyer'|'refunded'|'split', rationale}` |

**Dual-thread emit invariant.** When a dispute resolution or appeal resolution changes the assignment's terminal state, BOTH the dispute-thread event (`dispute.resolved` or `dispute.appeal_resolved`) AND the corresponding assignment-thread event (`assignment.accepted_by_buyer`, `assignment.refunded`, or `assignment.split`) are emitted in the same DB transaction per §8.5. This preserves §2's rule that every state mutation is paired with an event on its thread.

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

**System actor.** A canonical `system` row is seeded in `actor_handles` at migration time:

- `handle`: fixed sentinel UUID, documented in the T4 migration and locked for the life of the platform.
- `auth_user_id`: NULL (never mapped to a real user).
- `tombstoned_at`: NULL (never tombstoned).

All platform-originated events — cron-driven expiration and 14-day auto-accept (§14.2), asset-unavailable force-termination (§F10), dispute admin rulings (§8.2a `dispute.resolved`), appeal independent-review rulings (§8.2a `dispute.appeal_resolved`) — MUST reference the `system` handle via `actor_ref`. Route handlers load this handle via a single server-side config constant; it is never exposed to clients.

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

**Stripe charge ordering (`offer.accepted`).** The full acceptance flow:

1. Route handler opens an outer DB transaction and takes a row-level lock on the offer (`SELECT ... FOR UPDATE`).
2. Offer state validated (`state IN ('sent','countered')`); if stale, abort with 409 Conflict.
3. Stripe PaymentIntent created with `idempotency_key = offer.id + ':accept'`, destination = platform escrow balance, `capture_method = automatic`.
4. On Stripe success: inner DB transaction runs the atomicity block above (UPDATE offer state, INSERT `offer.accepted` event, INSERT assignment, INSERT `assignment.created` event), COMMIT.
5. On Stripe failure: abort outer transaction; offer remains in prior state; no events emitted.
6. On DB commit failure after Stripe success: void the PaymentIntent via Stripe API using the same idempotency key. If the void itself fails, enqueue a reconciliation job for platform admin with `severity=critical` and log. This is the only path where Stripe state and DB state can diverge transiently; admin reconciles manually.

Idempotency: because the Stripe idempotency key derives from `offer.id`, replay of the accept call returns the same PaymentIntent and cannot double-charge.

**Composition-change counter (`offer.countered` with item diff).** A counter that modifies composition mutates child tables in the same transaction:

```
BEGIN;
  UPDATE offers
    SET state='countered', gross_fee=$new_fee, current_note=$new_note,
        expires_at=$new_exp, updated_at=now()
    WHERE id=$1 AND state IN ('sent','countered');
  DELETE FROM offer_assets WHERE offer_id=$1 AND asset_id = ANY($removed_ids);
  INSERT INTO offer_assets (offer_id, asset_id, position) VALUES (...)
    ON CONFLICT (offer_id, asset_id) DO NOTHING;
  INSERT INTO ledger_events (thread_type, thread_id, event_type, payload, actor_ref, prev_event_hash, event_hash)
    VALUES ('offer', $1, 'offer.countered', $payload, $actor_ref, $prev_hash, $hash);
COMMIT;
```

Payload carries the full composition diff: `{v, by_actor_id, fee_before, fee_after, added_items, removed_items, rights_diff, note_before, note_after, expires_at}`.

**Dual-thread emit (dispute or appeal resolution).** When a resolution changes assignment state, two events fire on two threads in one transaction:

```
BEGIN;
  UPDATE assignments SET state=$new_state, updated_at=now()
    WHERE id=$assignment_id AND state IN ('disputed','dispute.under_appeal');
  UPDATE disputes SET state=$new_state, resolution=$outcome,
         resolved_at=COALESCE(resolved_at, now()),
         appeal_resolved_at=CASE WHEN $new_state='appeal_resolved' THEN now() ELSE appeal_resolved_at END
    WHERE dispute_id=$dispute_id;
  INSERT INTO ledger_events (thread_type, thread_id, event_type, ...)
    VALUES ('dispute', $dispute_id, $dispute_event_type, ...);  -- 'dispute.resolved' or 'dispute.appeal_resolved'
  INSERT INTO ledger_events (thread_type, thread_id, event_type, ...)
    VALUES ('assignment', $assignment_id, $assignment_event_type, ...);  -- 'assignment.refunded' / '.split' / '.accepted_by_buyer'
COMMIT;
```

Each event uses its own thread's `prev_event_hash` chain. Dispute thread and assignment thread remain independently verifiable.

### 8.6 Payload versioning

Consumers dispatch on the `v` field at application layer. Payload shape changes require a bump (`v=1` → `v=2`) and a dual-read period. Additive changes (new optional fields) may stay at the current `v`.

**Pre-consumer exception.** Until the first production consumer ships (P5 hard cut), breaking payload shape changes may be applied in-place at `v=1` without a bump or dual-read period. This exception expires at P5; after P5, all breaking changes require `v` bump + dual-read window. Exception usage is logged in §15 revision entries.

### 8.7 GDPR erasure (Art. 17) and portability (Art. 20)

**Erasure:** on verified request, the user's row in `public.actor_handles` is tombstoned (`tombstoned_at = now()`, `auth_user_id = null`). Ledger events are preserved — the counterparty retains the full transactional record. Actor identity at read time resolves to "deleted actor" once tombstoned. The hash chain remains intact; no event rows are mutated.

**Portability:** on verified request, the platform exports every ledger event row where the user's (pre-erasure) handle appears as `actor_ref`, serialised as JSON, including the hash chain links for independent verification. Export is delivered within 30 days of request per GDPR Art. 12(3).

**Retention boundary:** see §16.

**Post-archival portability.** After the 6-year archival rotation (§16), `actor_ref` values in archival rows are replaced by `sha256(actor_ref)`. A portability request from a subject whose handle has been rotated cannot be joined deterministically to their original ledger events. In that case, the platform derives the hash of the subject's (now-tombstoned) handle at request time and returns matching archival rows, with an export header disclosing that subject identity beyond the 6-year window is not platform-resolvable and that the returned hash is the subject's own hash of record. If no match exists (e.g., subject never transacted), the export states this explicitly.

## 9. Terminology discipline

**Tamper-evidence mechanism.** "Tamper-evident" in this spec is backed by the per-thread sha256 hash chain defined in §8 (header) and §8.3: each ledger event row digests (`prev_event_hash`, `payload_version`, `event_type`, canonicalised `payload`, `created_at` ISO-8601, `actor_ref`), so any mutation of a prior row breaks the chain and is detectable on independent replay. The platform makes no claim beyond that — the chain is tamper-evident and independently reviewable, not certified, not tamper-proof, not immutable. Permitted alternatives when describing offer/assignment state locks: "locked at offer creation", "fixed for the life of the offer", "append-only", "hash-chained".

**Allowed:**
tamper-evident, independently reviewable, provenance-aware, verifiable, on-platform, editorial rights, rights scope, rights grant, rights transfer (only when ownership changes hands, not the v1 default), commission, brief, assignment, offer, counter, pack, locked at offer creation, fixed for the life of the offer, append-only, hash-chained.

**Banned:**
certified, certification, tamper-proof, immutable, guaranteed immutable, blockchain-verified (unless actually on-chain), fully-licensed (imprecise), secured (overclaim), bulletproof, rock-solid, enterprise-grade (marketing filler), verified (without subject — "verified by whom?").

Compound identifiers inherit the ban. The live-code table name `certified_packages` (and its child tables `certified_package_items`, `certified_package_artifacts`) fall under the ban by implication and must be renamed before any spec-surface reference can land CI-clean. Rename target for the P4 migration: `provenance_packages` / `provenance_package_items` / `provenance_package_artifacts`. The `package_artifact_type` enum value `certificate` renames to `provenance_record`; the column `certification_hash_at_issue` renames to `provenance_hash_at_issue`. See §14.1 "Preserve with banned-term rename at P4" sub-block and §17 crosswalk for item-level action. <!-- allow-banned: meta-reference to banned terms in §9's own inventory clarification -->

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
| F8 | In-flight offer fate on account deletion | Force-resolve first. Account deletion blocked while counterparty has standing — defined as: any `offers.state IN ('sent','countered')` with the deleting user as buyer or creator; any `assignments.state NOT IN ('cashed_out','refunded','split')` involving the user; any `disputes.state NOT IN ('resolved','appeal_resolved')` involving the user. On erasure of a user whose threads are all terminal-resolved, their `actor_handles` row is tombstoned per §8.7; ledger events are preserved with actor label resolving to "deleted actor". |
| F9 | Pack size limits | Min 1 (N=1 is the single case). Max 20 per offer in v1. |
| F10 | Asset availability during pending pack offer | Available to other buyers. First-to-accept wins. Pending offers on already-accepted assets force-terminated via `offer.rejected` with `{reason: 'asset_no_longer_available', affected_item_ids}` (payload schema per §8.1 and §11.4). Both sides notified. |
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
- On `assignment.revision_requested` for piece P, `assignment_deliverables.delivered_at` for P is cleared to NULL in the same transaction; `revisions_used` is incremented by 1.
- Redelivery of piece P fires `assignment.piece_delivered` again, setting `delivered_at` afresh.
- Assignment transitions `revision_requested → delivered` when all rows in `assignment_deliverables` again have `delivered_at IS NOT NULL` — same predicate as `active → delivered`, re-evaluated on each piece-delivered event.

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
- **Creator asset-withdrawal action.** Creator may withdraw an asset from their portfolio via portfolio management view. Withdrawal triggers a server-side pass over all `offers.state IN ('sent','countered')` referencing the asset; each is force-terminated via `offer.rejected` with `{reason: 'asset_no_longer_available', affected_item_ids}`. Identical mechanism and notification surface to §F10 (asset-accepted-elsewhere path).

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
- **Reason codes (enumerated).** Buyer-initiated: `delivery_incomplete`, `delivery_off_brief`, `rights_mismatch`, `unresponsive_creator`, `other`. Creator-initiated: `creator_cannot_deliver`, `buyer_fraud_suspicion`, `other`. "Other" requires a free-text rationale in the payload; admin reviews at higher scrutiny.
- Opens `disputed` state; platform admin receives notification; flow moves to admin dispute queue (P7 UI; v1 uses SQL dashboard).

### 12.4a Creator appeal window

The creator may appeal any platform decision in a dispute within **14 calendar days** of the decision being communicated. Appeal must be initiated via the in-platform dispute view and must include a written statement of grounds. The thread state transitions to `dispute.under_appeal` (§5).

### 12.4b Independent-review path

An appealed decision is reviewed by a reviewer outside the original decision line (in v1: a founder-level reviewer not previously involved; post-v1: an external ombuds panel when volume justifies). The reviewer receives the ledger events, the dispute record, and both parties' statements. The reviewer's decision is recorded as a `dispute.appeal_resolved` event and is terminal.

### 12.5 Preserved from scaffold

- Single-asset offer UI (now renders as N=1 case of pack model)
- Creator portfolio browse

### 12.6 Deprecated at P5 hard cut

This section enumerates backend API routes only. UI surfaces are enumerated in the P4 implementation plan's UI deprecation audit.

- Map-store-backed offer/assignment flows
- `mockVaultAssets` fixture file
- Any remaining UI referring to removed Stripe webhook path
- API route `/api/special-offer/route.ts`
- API route `/api/special-offer/[id]/accept/route.ts`
- API route `/api/special-offer/[id]/counter/route.ts`
- API route `/api/special-offer/[id]/decline/route.ts`
- API route `/api/assignment/route.ts`
- API route `/api/assignment/[id]/route.ts`
- API route `/api/assignment/[id]/accept/route.ts`
- API route `/api/assignment/[id]/cancel/route.ts`
- API route `/api/assignment/[id]/ccr/route.ts`
- API route `/api/assignment/[id]/dispute/route.ts`
- API route `/api/assignment/[id]/fulfil/route.ts`
- API route `/api/assignment/[id]/review/route.ts`
- API route `/api/assignment/[id]/review-open/route.ts`

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
- **T4** to land at P4 — every table, RLS policy, trigger, and constraint enumerated in §7 and §8 is net-new to the codebase as of revision 5 (no existing migration implements them). The P4 migration introduces them as the canonical economic layer. See §14.1 "Assignment Engine sunset" sub-clause below and §17 crosswalk for the replacement map.
- **KD-9 resolved** — RLS verifiable in CI (Vitest env loading fixed)
- **P3 asset cutover** complete before P4 ships (offers need real assets to reference)

Sequence per remediation plan: P0 (KD-9 + polish) → P1 (T1 auth) → P2 (T4 schema + RLS) → P3 (asset cutover) → P4 (offers + assignments cutover with pack primitives) → P5 (hard cut + AUTH_WIRED=true + prod assertion + platform fee confirmed) → P6 (T&Cs + GDPR runbook) → P7 (admin trail viewer, deferred).

**Assignment Engine sunset (P4 hard cut).** At P4, the live-code economic-layer tables and their append-only event tables — all products of a retainer-oriented Assignment Engine design that predates revision 3's agent-model declaration (§1.1) — are dropped in the same migration that lands the spec-canonical `offers` / `assignments` / `disputes` / `ledger_events` / `actor_handles` shapes. No dual-mode retrofit of the legacy stores is performed (founder adjudication, 2026-04-20: "P4 is net-new only"). The migration SQL that creates the retired tables and enums remains in version control for provenance and for any future retainer-model re-introduction permitted only if a compatible v2 shape ships.

Retired tables (15, all economic-layer):
`assignments`, `assignment_rights_records`, `escrow_records`, `milestones`, `fulfilment_submissions`, `evidence_items`, `service_logs`, `review_records`, `commission_change_requests`, `ccr_amended_fields`, `assignment_dispute_cases`, `assignment_events`, `special_offer_threads` (renamed from `direct_offer_threads` at 2026-04-20), `special_offer_events` (renamed from `direct_offer_events` at 2026-04-20), `offer_checkout_intents`.

Retired state / status enums (5, of which two carry value-collisions with the spec's new enums of the same name):
`assignment_state` (collides — replaced by the spec's `assignment_state` with different values per §5), `assignment_sub_state`, `milestone_state`, `dispute_state` (collides — replaced by the spec's `dispute_state` per §7 with values `opened | resolved | appealed | appeal_resolved`), `special_offer_status` (renamed from `direct_offer_status`).

Retired event-type / classification enums (14):
`special_offer_event_type` (renamed from `direct_offer_event_type`), `special_offer_auto_cancel_reason` (renamed from `direct_offer_auto_cancel_reason`), `offer_party`, `assignment_class`, `milestone_type`, `fulfilment_type`, `evidence_item_kind` (value-collides with the spec's new `evidence_type` per §8.2a — different values), `review_determination`, `ccr_state`, `assignment_dispute_trigger`, `assignment_dispute_scope`, `assignment_dispute_resolution`, `dispute_filer_role`, `reviewer_role`.

Explicitly out of retirement scope — these tables remain on the preserved path and are untouched by the P4 migration: `vault_assets` + `asset_media` family, `licence_grants` (and the shared `licence_type` enum), `users`, `user_granted_types`, `creator_profiles`, `buyer_accounts`, `buyer_company_memberships`, `companies`, `posts` family, `providers` family, `watermark_profiles` family, `upload_batches`, `asset_embeddings`, `ai_analysis`, `audit_log`, `download_events`.

**Preserve with banned-term rename at P4.** The following product-surface tables and identifiers are preserved but require renames at the P4 migration to land CI-clean under §9's banned-term rule (§9 clarification on compound identifiers):

- **Table renames:** `certified_packages` → `provenance_packages`; `certified_package_items` → `provenance_package_items`; `certified_package_artifacts` → `provenance_package_artifacts`. <!-- allow-banned: rename mapping — old identifiers cited as the rename source -->
- **Column rename:** `certification_hash_at_issue` → `provenance_hash_at_issue`. <!-- allow-banned: rename mapping — old column cited as the rename source -->
- **Enum value rename:** `package_artifact_type` value `certificate` → `provenance_record` (other values unchanged). <!-- allow-banned: rename mapping — old enum value cited as the rename source -->
- **Preserved as-is (no rename):** `transactions` and `transaction_line_items`. Rationale: these tables serve `catalog_purchase` and `bundle_purchase` commerce paths that are explicitly §1 out-of-scope for ECONOMIC_FLOW_v1, plus `negotiated_purchase` which integrates with the spec's offer flow. They do not duplicate `ledger_events` — `ledger_events` is the audit spine (hash-chained per §8.3), `transactions` is the commerce state machine; the two coexist.
- **Trigger follow-up:** if the body of `protect_ready_package()` references any of the renamed tables by name, update the internal references in the same P4 migration.

Note on `package_artifact_type`: parent enum preserves; only the `certificate` value renames to `provenance_record` (enumerated above). Other values (`licence_agreement`, `original_file`, `contract_with_frontfiles`, `invoice`, `payment_receipt`, `payout_summary`) unchanged. <!-- allow-banned: parent-enum preserve clarification for an already-enumerated rename mapping -->

**Preserve without rename at P4.** Enums preserved without rename at P4 — no §9 banned tokens in values, tied to preserved or renamed tables.

- `transaction_kind` (values: `catalog_purchase`, `bundle_purchase`, `negotiated_purchase`) — tied to preserved `transactions`; catalog and bundle paths are §1 out-of-scope for ECONOMIC_FLOW_v1.
- `transaction_status` (values: `draft`, `pending_payment`, `paid`, `fulfilling`, `fulfilled`, `cancelled`, `failed`, `refunded`) — commerce states on preserved `transactions`.
- `package_kind` (values: `buyer_pack`, `creator_pack`) — tied to `provenance_packages`; "pack" is §9-canonical.
- `package_status` (values: `building`, `ready`, `failed`, `revoked`) — state labels on `provenance_packages`.
- `artifact_status` (values: `pending`, `generated`, `available`, `failed`, `revoked`) — state labels on `provenance_package_artifacts`.
- `buyer_company_role` (values: `admin`, `content_commit_holder`, `editor`) — tied to identity-layer `buyer_company_memberships`. Must be relocated to a migration that runs before the P4 Assignment Engine drop. Target migration chosen by P4 author. Technical detail: see `docs/audits/P4_PREREQUISITES.md` Entry 1.

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

Spec review gate: any change to §4, §5, §7, §8, §9, §10, §14.1 Assignment Engine sunset sub-clause, or §17 requires founder sign-off before implementation begins. (Gate widened by revision 5; legitimacy of §10 inclusion verified on Art. 17 grounds — F8 tombstone semantics with §8.7 cross-reference.)

**Revision 4 — 2026-04-20.** Red-team pass 4 findings applied. Dispute event set expanded to 5 (added `dispute.evidence_submitted`). `disputes` table added to §7 with `state` enum pinned (`opened | resolved | appealed | appeal_resolved`). §8.5 expanded with Stripe charge ordering, composition counter, and dual-thread emit blocks. §8.6 pre-consumer exception added. §8.7 post-archival portability (GDPR Art. 20) added. §5 dispute cool-down row added. §11.5 hash-chain operational invariants expanded by three bullets. §12.1 creator asset-withdrawal bullet added. §12.4 reason-codes enum added. F8 and F10 rewritten. See red-team-pass-4 record at end of document for detailed findings.

**Revision 5 — 2026-04-20.** Governance correction, not a product redesign. Red-team pass 5 not applicable. Q4 of `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` §Product questions adjudicated: **single-shot brief** — retainer model is out of scope for v1, deferred to v2 per §2 and §13. This closes the memo's Q4 `[pending]` marker (see concurrent amendment A). Six further edits made: (i) §14.1 T4-landed line truth-corrected — the spec's §7/§8 tables are net-new and will land at P4, not retrofitted; (ii) §14.1 Assignment Engine sunset sub-clause added enumerating 15 retired tables and 19 retired enums (see new §17 crosswalk for item-level detail); (iii) §14.1 "Preserve with banned-term rename at P4" sub-block added covering the `certified_packages` family rename to `provenance_packages` (plus `certification_hash_at_issue` column rename to `provenance_hash_at_issue` and `package_artifact_type` value rename `certificate` → `provenance_record`) and preserving `transactions` + `transaction_line_items` as-is (rationale: serves catalog/bundle/negotiated purchase paths; catalog and bundle are §1 out-of-scope; does not duplicate `ledger_events` — audit spine vs. commerce state machine); (iv) §12.6 deprecation list extended with 13 retiring route paths plus an intro line noting the section is backend routes only (UI surfaces enumerated in P4 implementation plan's UI deprecation audit); (v) §9 banned-term inventory clarifies compound identifier ban and names the `certified_packages` → `provenance_packages` rename target; (vi) new §17 crosswalk appendix maps every retiring live-code entity to its spec-canonical replacement and P4 migration action. Concurrent amendments: (a) `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` §Product questions Q4 adjudicated; (b) `docs/audits/REMEDIATION_PLAN_20260418.md` T4 tier body rewritten to point at §14.1 P0–P7. Payload version stays at v=1 per §8.6 pre-consumer exception (no event shape changes). §15 review-gate widened by this revision from §4/§5/§7/§8 to §4/§5/§7/§8/§9/§10/§14.1 Assignment Engine sunset sub-clause/§17. §10 inclusion verified on Art. 17 grounds — F8 carries the tombstone + standing semantics with §8.7 cross-reference. Founder sign-off obtained for §9 / §10 (F-answer stability) / §12.6 / §14.1 / §15 / §17 edits of revision 5. Seven founder-review enums pending separate adjudication (see §14.1 Founder review required sub-block). <!-- allow-banned: rename-mapping narrative — old identifiers cited as rename sources per §9 compound-ban clarification -->

**Revision 6 (2026-04-20).** Closes the "Founder review required" sub-block added in revision 5. Seven enums adjudicated: six preserve without rename at P4 (`transaction_kind`, `transaction_status`, `package_kind`, `package_status`, `artifact_status`, `buyer_company_role`); one confirms parent-enum preservation under the existing "Preserve with banned-term rename at P4" sub-block (`package_artifact_type` — value rename `certificate` → `provenance_record` already captured in revision 5). `buyer_company_role` carries a P4 migration-sequencing prerequisite recorded in `docs/audits/P4_PREREQUISITES.md` Entry 1 — the enum must be relocated to a migration that runs before the P4 Assignment Engine drop; target migration chosen by P4 author. The "Founder review required" sub-block is removed. §17 crosswalk rows flipped from `? founder review` to definite fates (row count unchanged at 61). No architectural change beyond mechanical closure of revision 5's open footnotes. Founder sign-off recorded; gate (§4, §5, §7, §8, §9, §10, §14.1 sunset sub-clause, §17) honored. <!-- allow-banned: rename-mapping narrative — old identifiers cited as rename sources per §9 compound-ban clarification -->

See red-team-pass-4 record at end of document for detailed findings on revision 4.

## 16. Retention

Ledger events are retained in the primary store for **6 years** after the final terminal-state transition of their thread. After 6 years, events are rotated to cold archival with hashed identifiers only (`actor_ref` replaced by `sha256(actor_ref)`); the primary-store rows are removed. The hash chain is preserved in archival form and remains independently verifiable. Actor handles tombstoned under §8.7 follow the same schedule, keyed off the last thread they participated in. The retention clock may be extended on a per-thread basis where an active legal obligation (hold, subpoena, regulator request) requires it, for the duration of that obligation.

## 17. Appendix — live-code-to-spec crosswalk

Traceability for the P4 Assignment Engine sunset. One row per live-code entity retired, renamed, preserved, or held for founder review. Reader of the live schema at any point can trace each entity to its spec-canonical replacement and the P4 migration action. See §14.1 "Assignment Engine sunset" sub-clause for the prose description.

| Live-code entity | Kind | Spec-canonical replacement | P4 migration action |
|---|---|---|---|
| `assignments` (Assignment Engine shape) | table | `assignments` (spec §7 — linked to `offers` via `offer_id`, fee derived by join) | drop |
| `assignment_rights_records` | table | absorbed into `offers.rights` jsonb (spec §7) | drop |
| `escrow_records` | table | no direct replacement — Stripe Connect is authoritative; platform mirror absorbed into `ledger_events` `assignment.cashed_out` payload (spec §8.2) | drop |
| `milestones` | table | no replacement (v1 is single-shot per §2; no milestones) | drop |
| `fulfilment_submissions` | table | no replacement (brief-pack delivery tracked via `assignment_deliverables` per §7 / §11.5) | drop |
| `evidence_items` | table | `dispute.evidence_submitted` events per §8.2a (for dispute context); no general-purpose replacement | drop |
| `service_logs` | table | no replacement (service-hybrid model is not in v1 scope) | drop |
| `review_records` | table | no replacement (review workflow is not in v1 scope) | drop |
| `commission_change_requests` | table | no replacement (composition change via `offer.countered` counter per §11.3) | drop |
| `ccr_amended_fields` | table | no replacement (covered by `offer.countered` payload diff per §8.1) | drop |
| `assignment_dispute_cases` | table | `disputes` (spec §7, revision 4) | drop |
| `assignment_events` | table | `ledger_events` polymorphic on `thread_type='assignment'` (spec §8.3) | drop |
| `special_offer_threads` (fka `direct_offer_threads`) | table | `offers` (spec §7) | drop |
| `special_offer_events` (fka `direct_offer_events`) | table | `ledger_events` polymorphic on `thread_type='offer'` (spec §8.3) | drop |
| `offer_checkout_intents` | table | absorbed into `assignment.created` event transaction per §8.5 Stripe-ordering block | drop |
| `assignment_state` enum | state enum | `assignment_state` per §5 (new values; hard collision with old) | drop-then-recreate with spec values |
| `assignment_sub_state` enum | state enum | no replacement | drop |
| `milestone_state` enum | state enum | no replacement | drop |
| `dispute_state` enum (Assignment Engine) | state enum | `dispute_state` per §7 disputes table (new values `opened|resolved|appealed|appeal_resolved`; hard collision with old) | drop-then-recreate with spec values |
| `special_offer_status` (fka `direct_offer_status`) | state enum | `offer_state` per §4 | drop |
| `assignment_class` enum | classification enum | replaced by `offers.target_type` enum per §7 (different shape) | drop |
| `milestone_type` enum | classification enum | no replacement | drop |
| `fulfilment_type` enum | classification enum | no replacement | drop |
| `evidence_item_kind` enum | classification enum | `evidence_type` per §8.2a (different shape, different values) | drop |
| `review_determination` enum | classification enum | no replacement | drop |
| `ccr_state` enum | state enum | no replacement | drop |
| `assignment_dispute_trigger` enum | classification enum | `reason_code` per §12.4 (different shape) | drop |
| `assignment_dispute_scope` enum | classification enum | no replacement (disputes are assignment-scoped only in spec per §7) | drop |
| `assignment_dispute_resolution` enum | classification enum | `disputes.resolution` text-enum per §7 (`accepted_by_buyer|refunded|split`) | drop |
| `dispute_filer_role` enum | classification enum | carried implicitly in `dispute.opened` payload per §8.2a | drop |
| `reviewer_role` enum | classification enum | no replacement | drop |
| `special_offer_event_type` (fka `direct_offer_event_type`) enum | event enum | free-form `event_type text` column on `ledger_events` per §8.3 (event name strings) | drop |
| `special_offer_auto_cancel_reason` (fka `direct_offer_auto_cancel_reason`) enum | classification enum | `offer.rejected` payload `reason` field per §8.1 / §F10 | drop |
| `offer_party` enum | classification enum | carried in `actor_ref` via `actor_handles` per §8.4 | drop |
| `/api/special-offer/route.ts` | route | new spec-canonical offer routes (P4 net-new) | drop |
| `/api/special-offer/[id]/accept/route.ts` | route | new spec-canonical accept route (P4 net-new) | drop |
| `/api/special-offer/[id]/counter/route.ts` | route | new spec-canonical counter route (P4 net-new) | drop |
| `/api/special-offer/[id]/decline/route.ts` | route | new spec-canonical reject route (P4 net-new) | drop |
| `/api/assignment/route.ts` | route | absorbed into new offer-accept flow (assignments are derived by join per §6) | drop |
| `/api/assignment/[id]/route.ts` | route | new spec-canonical assignment read route (P4 net-new) | drop |
| `/api/assignment/[id]/accept/route.ts` | route | new spec-canonical buyer-accept-delivery route per §5 | drop |
| `/api/assignment/[id]/cancel/route.ts` | route | no replacement (cancellation via dispute per §5 prose) | drop |
| `/api/assignment/[id]/ccr/route.ts` | route | no replacement (composition change via `offer.countered` counter per §11.3) | drop |
| `/api/assignment/[id]/dispute/route.ts` | route | new spec-canonical dispute routes per §12.4 / §8.2a (P4 net-new) | drop |
| `/api/assignment/[id]/fulfil/route.ts` | route | new spec-canonical piece-delivered / delivered routes per §11.5 (P4 net-new) | drop |
| `/api/assignment/[id]/review/route.ts` | route | no replacement (review workflow is not in v1 scope) | drop |
| `/api/assignment/[id]/review-open/route.ts` | route | no replacement | drop |
| `transactions` | table | distinct from `ledger_events` — `ledger_events` is the hash-chained audit spine per §8.3; `transactions` is the commerce state machine for catalog/bundle/negotiated purchase paths | preserve (out-of-scope purchase paths per §1) |
| `transaction_line_items` | table | scoped with `transactions` | preserve (out-of-scope purchase paths per §1) |
| `certified_packages` | table | product-surface deliverable (buyer pack / creator pack); no spec replacement | preserve-with-rename → `provenance_packages` <!-- allow-banned: rename mapping --> |
| `certified_package_items` | table | scoped with parent | preserve-with-rename → `provenance_package_items` <!-- allow-banned: rename mapping --> |
| `certified_package_artifacts` | table | scoped with parent | preserve-with-rename → `provenance_package_artifacts` <!-- allow-banned: rename mapping --> |
| `certification_hash_at_issue` (column on `certified_package_artifacts`) | column | same semantics | preserve-with-rename → `provenance_hash_at_issue` <!-- allow-banned: rename mapping --> |
| `package_artifact_type` value `certificate` | enum value | provenance-record surface | preserve-with-value-rename → `provenance_record` <!-- allow-banned: rename mapping --> |
| `buyer_company_role` enum | classification enum | used by preserved `buyer_company_memberships` (identity layer) | preserve (relocate before P4 drop — see P4_PREREQUISITES Entry 1) |
| `transaction_kind` enum | classification enum | tied to preserved `transactions` | preserve (out-of-scope purchase paths per §1) |
| `transaction_status` enum | state enum | tied to preserved `transactions` | preserve (commerce states) |
| `package_kind` enum | classification enum | tied to renamed `provenance_packages` family | preserve (product-surface labels) |
| `package_status` enum | state enum | tied to renamed `provenance_packages` family | preserve (state labels) |
| `artifact_status` enum | state enum | tied to renamed `provenance_package_artifacts` | preserve (state labels) |
| `package_artifact_type` enum (full scope beyond the `certificate` value rename) | classification enum | tied to renamed `provenance_package_artifacts` | preserve with value rename (certificate → provenance_record; captured in rev 5 preserve-with-rename block) <!-- allow-banned: rename-mapping context, fate-column cross-reference --> |

**Red-team passes applied:** 2 (2026-04-20). Fixes integrated: C1–C11, I1–I10, M3–M5. Self-dealing prevention, Stripe Connect escrow (replacing manual-capture error), `offers.cancelled` state, `assignment_deliverables` revision table, platform fee rate-lock (F16), 14-day dispute window, creator-initiated dispute path, transition atomicity, client-side-only drafts, rate limiting, timer infrastructure, FX/VAT stubs.

**Red-team pass 3 applied:** 3 (2026-04-20). Rethink through ethics / creator-empowerment / simplicity / legal-safety lenses. R1 agent-model declaration (§1.1). R2 unified ledger_events with pseudonymous actor_handles, hash-chained tamper-evidence, payload discipline (§8.3 / §8.4 / §8 header / §8.7). R3 retention schedule (§16), creator appeal right with independent review (§5 / §12.4a / §12.4b), data portability (§8.7), tamper-evidence mechanism (§9), terminology lock strengthened (§9). Founder sign-off obtained under §15 for §5 / §8 / §9 / §12.4 changes. Pre-consumer: payload stays at v=1 per §8.6 exception.

**Red-team pass 4 applied:** 4 (2026-04-20). Scenario-driven walkthrough against revision 3 surfaced 19 items (7 blocks, 7 fixes, 5 notes). Blocks resolved: G1 (dispute event catalogue §8.2a added with 4 events: dispute.opened, dispute.resolved, dispute.appealed, dispute.appeal_resolved; total event count 19); G2 (canonical system actor seeded in §8.4); G3 (dispute cool-down prose added to §5 — no re-dispute after any prior terminal resolution); G7 (Stripe charge ordering added to §8.5 with pre-commit charge / post-commit void-on-failure reconciliation); G11 (buyer-initiated dispute window harmonized across §5 table, §5 prose, §12.4); G12 (disputes table added to §7; thread_id source clarified); G13 (dual-thread emit example added to §8.5). Fixes: G5 (§8.7 post-archival portability); G8 + G9 (§11.5 delivered_at lifecycle + multi-piece retrigger); G10 (§8.5 composition-change counter example); A1 (§7 rights jsonb shape); A2 (§12.4 enumerated reason codes); A3 (§8.1 offer.rejected payload carries affected_item_ids). Notes: G4 (§5 clock origin inline); G6 (§8.6 pre-consumer exception clause); G14 + A5 (§F8 rewrite with standing enumeration); A4 (§12.1 creator asset-withdrawal surface). Founder sign-off obtained under §15 for §4 / §5 / §7 / §8 / §12 changes. Payload stays at v=1 per §8.6 pre-consumer exception.
