# Blue Protocol — Trust Badge Verification Audit

**Date:** 2026-04-26
**Author:** BP-D4 verification pass per `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`
**Scope:** Verify the Trust Badge implementation status against claims in `.claude/agents/frontfiles-blue-protocol.md`
**Reads underlying:** Agent doc; `src/components/platform/TrustBadge.tsx`; `src/lib/types.ts`; `src/lib/identity/types.ts`; `src/lib/identity/store.ts`; `src/lib/db/schema.ts`

---

## Verdict

**IMPLEMENTED, but with two material drifts vs. the agent doc:**

1. **State count drift** — agent doc says "Trust Badge — 2 states: `verified`, `trusted`." Code reality is `(TrustTier × TrustBadge)` — 2 tiers (`standard`, `protected_source`) × 2 badges (`verified`, `trusted`) = **4 distinct displayed surfaces**. The agent's "2 states" framing is incomplete because it ignores the tier dimension.
2. **Default-on drift** — agent rule "A `trusted` creator earns that from sustained track record" implies earned. Reality: `trust_badge` defaults to `'verified'` for every creator at profile creation (`src/lib/identity/store.ts:546`). No earning logic exists. Every creator starts as "Verified Creator" or "Verified Protected Source" by default.

Trust Badge is real code that ships labels, but the trust posture the agent doc describes (earned, evidence-backed, distinct from ValidationDeclaration) is not enforced today.

---

## What the agent doc claims

Per `.claude/agents/frontfiles-blue-protocol.md`:

- "**Trust Badge** — 2 states: `verified`, `trusted` (per Spec S7.9-7.11)"
- Rule #5: "Trust Badge is a creator attribute, not an asset attribute. `Trust Badge` (2 states) is on `users`. ValidationDeclaration (5/7 states) is on assets. A `trusted` creator earns that from sustained track record; it does not flow down to assets automatically. Never write code that derives asset validation from creator trust."
- Rule #1 implication: "Never bundle Trust Badge and ValidationDeclaration language. They are distinct."

---

## What actually exists in code

### Component

`src/components/platform/TrustBadge.tsx` (53 lines):

```typescript
const BADGE_LABELS: Record<TrustTier, Record<TrustBadgeType, string>> = {
  standard: {
    verified: 'Verified Creator',
    trusted: 'Trusted Creator',
  },
  protected_source: {
    verified: 'Verified Protected Source',
    trusted: 'Trusted Protected Source',
  },
}
```

Visual: blue (`#0000ff`) shield icon with check mark + label text. Matches Design Canon (single brand color for trust signals).

### Type model

`src/lib/types.ts` defines `TrustTier` and `TrustBadge as TrustBadgeType`. Imported by:
- `TrustBadge.tsx` (component)
- `src/lib/identity/types.ts` (creator profile facet)
- `src/lib/identity/store.ts` (mutation logic)
- `src/data/{users,profiles,creators}.ts` (data layer)

### Where it lives in the data model

Per `src/lib/identity/types.ts:109`:

```typescript
trust_badge?: CreatorProfileRow['trust_badge']
```

`trust_badge` is a column on `CreatorProfileRow` — i.e., on the creator profile facet of the user, not directly on `users`. This MATCHES the agent doc rule #5 ("Trust Badge is a creator attribute") in spirit — though the agent doc says "on `users`" which is technically wrong (it's on the creator profile, which is a facet of users).

### Default behavior

Per `src/lib/identity/store.ts:546`:

```typescript
trust_badge: input.trust_badge ?? existing?.trust_badge ?? 'verified',
```

**Every creator profile defaults to `trust_badge: 'verified'`** at creation. There is no logic that defaults to anything else based on track record, evidence, or onboarding completion.

This is the second material drift: the agent's "earned" framing is not enforced.

---

## The drifts in detail

### Drift 1: State count

| Source | States | Distinct displayed values |
|---|---|---|
| Agent doc | 2 (verified, trusted) | 2 |
| Code | 2 tiers × 2 badges | 4 ('Verified Creator', 'Trusted Creator', 'Verified Protected Source', 'Trusted Protected Source') |

The `protected_source` tier is a **wholly new dimension** that doesn't appear in the agent doc at all. This is similar to the Blue Protocol 5-vs-7 state drift but in the other direction — code has more dimensions than the agent doc captures.

Possible interpretations:
- (a) The agent doc is stale; `protected_source` was added later as a journalism-specific tier (matches FF's editorial posture)
- (b) The `protected_source` tier should be folded back into `standard` (and the labels merged)
- (c) The tier dimension is correct but the agent doc needs revision

Without `CANONICAL_SPEC.md` (still not landed per BP-D1), there's no authoritative source to settle this. **Add to BP-D1's responsibility: spec must explicitly enumerate Trust Badge tiers AND badges, not just badges.**

### Drift 2: Default-on vs earned

Agent doc rule (paraphrased): trust must be earned through track record.
Code reality: every creator starts at `verified`. No earning logic exists.

This means today, every newly-created creator profile shows "Verified Creator" or "Verified Protected Source" on the platform — **before they have done anything to earn verification**. For a serious editorial platform, this is a real legal/trust language risk per CLAUDE.md item 9 ("Avoid fuzzy, inflated, or legally risky language; be especially careful with provenance, trust, verification, certification claims").

The "verified" word, displayed by default to every creator, is inflationary by exactly the kind that the agent doc is meant to prevent.

Possible interpretations:
- (a) The default should be a NEW state — e.g., `unverified` or `pending_verification` — that isn't currently in the enum
- (b) The default is a "soft verified" that requires email + identity but no track record (in which case the agent doc's "earned" rule needs softening)
- (c) The default is wrong and should be flagged for immediate fix

Without spec authority (BP-D1), can't pick. But this is worth founder attention — possibly more urgent than the 5-vs-7 ValidationDeclaration drift, because Trust Badge labels are user-facing language displayed across many surfaces today.

---

## Implications for BP track

1. **BP-D1 (`CANONICAL_SPEC.md`) scope expands.** Must enumerate Trust Badge model in full: tier dimension, badge dimension, default state, earning rules. Not just "2 states."

2. **BP-D3 (expand to 7 states + wire dispute) is unaffected by Trust Badge drift.** ValidationDeclaration and Trust Badge are independent per agent rule #5. BP-D3 can proceed without resolving Trust Badge.

3. **NEW directive needed: BP-D5 — Trust Badge default state decision + earning logic.** Sequenced after BP-D1 ratifies the spec. Likely addresses both drifts together.

---

## Recommended additions to the directive list

Add to `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`:

```
| BP-D5 | Trust Badge default state + earning logic |
  Resolve the two drifts:
  (a) Decide whether protected_source tier belongs alongside
      standard (4 displayed values) or should be folded (2 displayed
      values matching the agent doc).
  (b) Decide whether default `trust_badge: 'verified'` is correct
      (likely add `unverified` or `pending_verification` state, gate
      `verified` on completed onboarding evidence, gate `trusted` on
      track record signal yet to define).
  Update TrustBadge.tsx labels accordingly. Add migration if new
  enum value introduced. Add seed-creator earning logic (or document
  why default-on is acceptable in CANONICAL_SPEC).
  Owner: Claude (composition + audit-first read of every Trust Badge
  consumer surface) after founder decision
  Predecessor: BP-D1 (canonical spec ratified)
  Output: updated TrustBadge.tsx; possible migration; possible new
  identity store rules; updated CANONICAL_SPEC §Trust Badge
  Approval gate: founder ratifies the two decisions before code
```

---

## Open follow-on (out of this verification's scope)

- **Trust Badge consumer surfaces** — TrustBadge.tsx is rendered in many components per discovery (DiscoveryResultsGrid, AssetCard, ProfileLeftRail, ProfileContent, etc.). Did not enumerate every consumer here. BP-D5 audit-first pass should map every render site so the default-on fix doesn't surface inconsistencies.
- **`protected_source` tier semantics** — what does it actually mean? Is it self-declared, evidence-gated, founder-granted? Did not find a process around it in this audit. Likely needs spec definition in BP-D1.

---

End of Trust Badge verification.
