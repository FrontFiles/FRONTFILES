# Blue Protocol — CEL Verification Audit

**Date:** 2026-04-26
**Author:** BP-D4 verification pass per `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`
**Scope:** Verify the Certification Event Log (CEL) implementation status against the claims in `.claude/agents/frontfiles-blue-protocol.md`
**Reads underlying:** Agent doc; `supabase/migrations/20260408230004_assignment_engine_events.sql`; `src/lib/assignment/events.ts`; `src/lib/assignment/services.ts`; `PLATFORM_BUILD.md`; `ASSIGNMENT_DISPUTE_TAXONOMY.md`

---

## Verdict

**PARTIAL — implemented as a federated pattern with ONE active partition (assignment_events). The asset-validation partition that the agent doc relies on does NOT exist.**

The agent doc treats CEL as a single asset-level append-only ledger. The code treats CEL as an architectural pattern: domain-specific event tables marked as "CEL integration." Only the `assignment_events` partition has actually been built.

This matters for BP-D3 (expand to 7 states + wire dispute outcomes): the new `disputed → invalidated` and `under_review → manifest_invalid` transitions need a CEL partition to write to, and there isn't one for asset-validation events. BP-D3 needs to either build a new partition first, overload the assignment partition, or skip the logging (violates Blue Protocol agent rule #2).

---

## What the agent doc claims about CEL

Per `.claude/agents/frontfiles-blue-protocol.md` §"Certification event log (CEL)":

- "CEL rows are permanent, append-only, ordered per-asset"
- "CEL is rendered in asset detail + vault drawer"
- "Every validation state transition writes a CEL event"
- "CEL events record: `(asset_id, prior_state, new_state, trigger, actor_id, timestamp, evidence_refs[])`"

Per agent rule #2: "No validation-state transition happens without a corresponding CEL row."

Per `PLATFORM_BUILD.md`:
- Line 116: "Asset detail (`/asset/[id]`) — metadata, provenance, licensing sidebar, CEL"
- Line 163: "CEL (Certification Event Log) displayed in Asset detail and Vault drawer"

Per `ASSIGNMENT_DISPUTE_TAXONOMY.md`:
- Line 48: "CEL records the finding permanently against the asset" (Type 1 Fraud)
- Line 71, 93, 116, 141: similar language across other dispute types

---

## What actually exists in code

### Implemented partition: `assignment_events`

Migration `supabase/migrations/20260408230004_assignment_engine_events.sql` — landed:

- Table: `assignment_events`
- Comment: "Append-only event log for assignment lifecycle. **CEL integration.** No UPDATE or DELETE permitted."
- Migration's own header comment: "Integration with the Certification Event Log (CEL)" + "rather than an enum, because the CEL is a shared system and new [event types can be added without migration]"

So CEL is conceptualized in the schema layer as a **federated pattern**: each domain has its own append-only event table that contributes to "the CEL" as a logical aggregation. `assignment_events` is the first (and currently only) physical partition.

### Code references to CEL

| File | Line | What it does |
|---|---|---|
| `src/lib/assignment/events.ts` | 2 | "Assignment Engine — CEL Event Emission" |
| `src/lib/assignment/events.ts` | 6 | "In production, these will write to the persistent CEL store." |
| `src/lib/assignment/services.ts` | 7 | JSDoc: "Emits CEL events" |
| `src/lib/upload/types.ts` | 328 | Comment: "Compatible with CEL-oriented event model" |
| `supabase/seed.sql` | 381 | "ASSIGNMENT EVENTS — CEL entries for audit trail" |

All references either (a) describe the assignment partition or (b) note compatibility with a CEL-oriented model. No code writes to or queries from a unified asset-level CEL.

### What does NOT exist

- No `cel_events` or `certification_events` table
- No `asset_certification_events` table (the asset-validation partition the agent doc relies on)
- No `src/lib/cel/` module providing a unified CEL API
- No code path that writes a CEL row on `vault_assets.declaration_state` change (the validation state transition the agent doc says must always log)
- No "asset detail CEL panel" or "vault drawer CEL section" implementation found in this audit (verified by absence of `<CEL` or `<EventLog` patterns in the searched components — full UI verification deferred)

---

## Implications for BP-D3 (expand to 7 states + wire dispute outcomes)

BP-D3 needs to write CEL rows for:
- Dispute Type 1 (Fraud) upheld → asset transitions to `invalidated`
- Dispute Type 5 (Rights Violation) upheld → asset transitions to `invalidated`
- Provenance manifest validation failure → asset transitions to `manifest_invalid`
- Any other validation state transition (per agent rule #2)

Today, none of those transitions has a target CEL partition. Three options:

| Option | Approach | Trade-off |
|---|---|---|
| **A** | Build new `asset_certification_events` partition (new migration + helpers). Wire BP-D3 transitions to write here. | Cleanest; matches the agent doc's per-asset event model; net-new schema; ~30-50 lines of migration + helpers. **Recommended.** |
| **B** | Overload `assignment_events` to also cover validation transitions. Add a `'validation_state_change'` event type. | Smaller diff; but conflates two domains under one table; violates the federated-partition pattern the schema established. |
| **C** | Ship BP-D3 without CEL logging; backfill in a follow-up directive. | Violates Blue Protocol agent rule #2 ("No validation-state transition happens without a corresponding CEL row"). Reject. |

**Recommendation: Option A.** New directive needed: **BP-D3.5** — "Build asset_certification_events partition" — composed before BP-D3 ships. Adds one migration + one helper module. Small.

---

## Recommended additions to the directive list

Insert between BP-D2 and BP-D3 in `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`:

```
| BP-D2.5 | Build asset_certification_events CEL partition |
  Create new migration adding asset_certification_events table
  (asset_id, prior_state, new_state, trigger, actor_id, timestamp,
   evidence_refs[]) with append-only RLS posture matching
   assignment_events. Add src/lib/cel/asset-events.ts helper module
   with emit() function. NO UI surface in this directive — that
   comes when BP-D3 wires the first transitions and surfaces them
   in asset detail.
  Owner: Claude (composition)
  Predecessor: BP-D2 (founder choice locked)
  Output: new migration + src/lib/cel/asset-events.ts + tests
  Approval gate: founder ratifies migration shape before code
```

Then BP-D3's predecessor becomes BP-D2.5 (was: BP-D2 + BP-D4).

This makes BP-D3 cleanly executable — by the time it composes, the partition exists.

---

## Open follow-on (out of this verification's scope)

- **Asset-detail CEL panel UI** — agent doc says CEL is "rendered in asset detail + vault drawer." Did not verify whether any UI surface exists for displaying assignment_events or a future asset_certification_events stream. Recommend separate verification audit before any "CEL is shown to users" claim is shipped publicly.
- **Other partitions** — only `assignment_events` exists today. Future domains (provenance, upload commit, payment, declaration) may each warrant their own partitions per the federated pattern. Not in BP-D3 scope; flagged for future architectural review.

---

End of CEL verification.
