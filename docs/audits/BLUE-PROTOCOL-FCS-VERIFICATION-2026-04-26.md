# Blue Protocol — FCS Verification Audit

**Date:** 2026-04-26
**Author:** BP-D4 verification pass per `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`
**Scope:** Verify the Frontfiles Certification System (FCS, levels L1-L4) implementation status against claims in `.claude/agents/frontfiles-blue-protocol.md`
**Reads underlying:** Agent doc; `src/lib/types.ts`; `src/components/composer/PublishConfirmation.tsx`

---

## Verdict

**NOT IMPLEMENTED as a structured system. FCS is a label and a single boolean, not a four-level evidence ladder.**

The agent doc describes FCS as a tiered evidence model with four progressive levels (L1-L4), each with specific evidence requirements. The code reality is:

- A single boolean `assemblyVerified` (described as "FCS Layer 4")
- A single display label "Source assets (FCS Layer 4 Assembly)" in the composer publish confirmation surface
- A single comment "Authority: FCS owns Declaration state"

That's it. **L1, L2, and L3 do not exist anywhere in code.** There is no `fcs_level` enum, no `frontfiles_certification` table, no `src/lib/fcs/` module, no progressive evidence model, no transition logic between levels. `assemblyVerified` is just a flag someone sets.

This is the largest gap of the three BP-D4 verifications — much more aspirational than CEL (which has at least one partition) or Trust Badge (which is implemented but has drifts).

---

## What the agent doc claims

Per `.claude/agents/frontfiles-blue-protocol.md`:

- "**Levels L1-L4** (referenced in Composer as 'FCS L4')"
- "L4 = Assembly Verification applied to Composed Articles"
- "Each level has specific evidence requirements (to be articulated in `CANONICAL_SPEC.md`)"
- Rule #5: "Never let automated systems promote an asset to `fully_validated` unilaterally. AI signals contribute evidence; they don't earn Blue Protocol alone. Human editorial approval is required for L4 / `fully_validated`."
- Rule #6: "Never shortcut the FCS levels. L4 requires L1-L3 evidence. Don't skip tiers."

The agent doc is explicit that FCS levels are sequential (L1 → L2 → L3 → L4) and each has evidence requirements. None of this is in code.

---

## What actually exists in code

### Entire FCS surface area in code

| File | Line | Content |
|---|---|---|
| `src/lib/types.ts` | 48 | Comment: "Authority: FCS owns Declaration state" |
| `src/lib/types.ts` | 588 | `assemblyVerified: boolean // FCS Layer 4` |
| `src/components/composer/PublishConfirmation.tsx` | 52 | Display string: "Source assets (FCS Layer 4 Assembly)" |

That is the totality of FCS implementation. **Three references, all referencing L4 only, none implementing the level model.**

### What does NOT exist

- No `FCSLevel` or `FcsLevel` enum
- No `fcs_level` column on `vault_assets` or any other table
- No `frontfiles_certification` table
- No `src/lib/fcs/` module
- No L1, L2, or L3 references anywhere in code (verified via word-boundary grep on `\bL[123]\b` against the codebase — would expect spurious matches; confirmed no FCS-context hits)
- No evidence-gathering logic
- No level-transition rules
- No "L4 requires L1-L3" enforcement (the agent doc rule that there's no logic to enforce)

### What `assemblyVerified` actually does

The single boolean `assemblyVerified` (per `src/lib/types.ts:588`) appears to be a flag on a composed-article model (the surrounding type has fields suggesting article composition). The composer's `PublishConfirmation.tsx` displays a label when this is true. There is no audit of HOW it gets set, by whom, or with what evidence. From this verification's surface, `assemblyVerified` is essentially:

```
assemblyVerified: boolean  // someone sets this somewhere; UI displays "FCS Layer 4 Assembly"
```

That's not Assembly Verification in any meaningful sense. It's a label.

---

## The gap, plainly

The agent doc describes a four-level certification system with progressive evidence requirements. The code has a single boolean and a display string. Every claim the agent doc makes about FCS — level transitions, evidence requirements, sequential gating, anti-shortcut rules — is aspirational. There is nothing in code to enforce or even represent these claims.

If a public-facing page today says anything like "Frontfiles certifies content through a multi-level FCS process," **that statement is not backed by code**. Per CLAUDE.md item 9 (avoid legally risky language; be careful with certification claims), this is a real exposure.

A counsel or external reviewer asked "show me the FCS levels in your code" would find a comment, a boolean, and a label. That's all.

---

## Implications for BP track

1. **BP-D1 (`CANONICAL_SPEC.md`) scope expands meaningfully.** Must articulate the full FCS model from scratch:
   - L1, L2, L3, L4 definitions
   - Evidence requirements per level
   - Sequential vs parallel gating
   - Who/what advances an asset between levels (creator action, AI signal, human editorial review, automated rule)
   - Coupling with ValidationDeclaration (does L4 = `fully_validated`? Or are they orthogonal?)
   - Coupling with assemblyVerified (is the existing boolean the L4 indicator, or does it become deprecated?)

2. **BP-D3 (expand to 7 states + wire dispute) is unaffected directly** — ValidationDeclaration and FCS are separate models per the agent doc. But the agent doc rule #5 ("Human editorial approval is required for L4 / `fully_validated`") implies a coupling: L4 is the evidence basis for `fully_validated`. If FCS doesn't exist as a system, then no asset can EVER be promoted to `fully_validated` legitimately under the agent's rules. Today, `fully_validated` is in the enum but there's no path to reach it. **This is consistent with the audit finding that no asset starts at `fully_validated` (per agent rule #3) and there's no transition logic.**

3. **NEW directive needed: BP-D6 — FCS specification + minimal implementation.** Likely the largest BP directive. Sequenced after BP-D1 ratifies the spec.

4. **Audit any user-facing page that mentions "FCS" or "certification."** Per CLAUDE.md item 9 trust-language posture, language must match what's actually implemented. Today, the composer's "Source assets (FCS Layer 4 Assembly)" label is technically backed by the `assemblyVerified` boolean — but the boolean's meaning is unclear, and the user-facing claim of "Layer 4" is misleading because there are no Layers 1-3 to be at the apex of.

---

## Recommended additions to the directive list

Add to `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`:

```
| BP-D6 | FCS specification + minimal implementation |
  Largest BP directive. Two phases:
  (a) Spec: articulate L1-L4 in CANONICAL_SPEC.md (evidence
      requirements per level, gating rules, coupling with
      ValidationDeclaration, fate of existing assemblyVerified
      boolean). Founder ratification.
  (b) Implementation: enum, schema (likely fcs_level column on
      vault_assets), transition logic, evidence-gathering hooks,
      audit logging via the asset_certification_events partition
      (BP-D2.5). UI: badges per level, progression indicator on
      asset detail. Audit user-facing copy that references FCS
      and bring it into truth alignment.
  Owner: Claude (composition; multi-pass) after founder decision
  Predecessor: BP-D1 (spec) + BP-D2.5 (CEL partition) + BP-D5
              (Trust Badge resolved, since both touch trust UI)
  Output: spec; migration; src/lib/fcs/ module; UI; tests; copy
          audit
  Approval gate: two-step — founder ratifies spec before
                 implementation; founder ratifies implementation
                 plan before code

| BP-D7 | FCS user-facing copy audit + correction (URGENT short-term) |
  Pre-BP-D6 short-term mitigation: audit every user-facing page,
  email, and marketing surface that uses "FCS," "Frontfiles
  Certification," "Layer 4," or similar language. Correct any
  language that overclaims relative to the implementation status
  documented in BLUE-PROTOCOL-FCS-VERIFICATION-2026-04-26.md.
  Specifically: the composer's "Source assets (FCS Layer 4
  Assembly)" label needs review — either softer language or a
  caveat that the underlying system is in development.
  Owner: Claude (audit + edits) + founder review
  Predecessor: none (can run today as a defensive measure)
  Output: copy audit findings + edits
  Approval gate: founder reviews proposed copy changes
```

BP-D7 is flagged as URGENT because it's the only BP-D directive that addresses live user exposure — every other BP-D directive resolves architecture for future work. BP-D7 protects against current overclaiming.

---

## Open follow-on (out of this verification's scope)

- **Public-facing pages mentioning FCS** — did not enumerate every page that uses "FCS" or "Layer 4" language. BP-D7 audit pass would do this comprehensively.
- **Marketing material, terms of service, AI processing disclosure** — per agent doc dependency on Task #25 ("Legal pages live"). These pages may reference FCS in ways that need correction or caveating until BP-D6 ships.
- **Composer's `assemblyVerified` provenance** — did not trace HOW this boolean gets set. If it's set by an automated process (AI signal, simple rule, etc.), the agent doc rule #5 may be violated already today.

---

End of FCS verification.
