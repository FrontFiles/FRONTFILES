# Blue Protocol — User-Facing Copy Audit (BP-D7)

**Date:** 2026-04-26
**Author:** BP-D7 defensive copy audit per `BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md`
**Scope:** Identify live user-facing language that overclaims relative to the actual implementation status documented in BP-D4 verification audits. Propose corrections.
**Reads underlying:** `BLUE-PROTOCOL-FCS-VERIFICATION-2026-04-26.md`, `BLUE-PROTOCOL-TRUST-BADGE-VERIFICATION-2026-04-26.md`, `BLUE-PROTOCOL-CEL-VERIFICATION-2026-04-26.md`; full repo grep of trust/cert/verify language

---

## Implementation status (2026-04-26, post-founder ratification)

All five high-severity findings (C-1 + C-2 + H-1 + H-2 + H-3) APPLIED in code. M-1 and M-2 deferred per audit's "LATER" tag. LOW (code comments) deferred per audit's "defer" tag.

### Critical framing — what BP-D7-IMPL did and didn't do

**BP-D7-IMPL changed user-facing copy. It did NOT change truth-model semantics.**

This distinction matters and must be preserved by future contributors:

- **What changed:** the language users see (checkout copy, badge labels, composer label, mock event descriptions, recommendation panel title)
- **What did NOT change:** the underlying trust/validation/FCS data model, the schema, the type definitions, the default values in the identity store, the event type identifiers, the validation declaration enum
- **Implications:**
  - Code may still store `trust_badge: 'verified'` on every new creator (default unchanged); only the rendered text was softened
  - Mock event identifiers (`type: 'fcs_layer_complete'`) still reference FCS-like concepts; only the human-readable description text was softened
  - The 5-vs-7 ValidationDeclaration drift remains unresolved in code (BP-D1, BP-D2, BP-D3 territory)
  - The FCS L1-L4 system is still aspirational (BP-D6 territory)
  - The Trust Badge earning logic still does not exist (BP-D5 territory)

**This was deliberate.** BP-D7 is a defensive language pass, not a model fix. Closing the inflated user-facing claims fast — without forcing concurrent schema/logic redesign — is the right scope for this stage. The model fixes happen in their proper directives (BP-D1, BP-D5, BP-D6) when the canonical spec lands.

If a future reviewer or contributor sees the softened labels and assumes "trust badges are working" or "FCS is implemented," they will be wrong. The audit docs in this directory remain the authoritative description of actual implementation status.

| ID | Status | Files touched | Note |
|---|---|---|---|
| C-1 | ✅ APPLIED | `src/app/checkout/[assetId]/page.tsx:277` | FCS proper-noun claim removed; legal acknowledgment language preserved |
| C-2 | ✅ APPLIED | `src/components/platform/TrustBadge.tsx:11-20` (label policy + new labels) + `src/components/platform/ProfileLeftRail.tsx:40` (hardcoded label) + `src/app/creator/[handle]/frontfolio/page.tsx:373` (hardcoded label) | Labels collapsed to tier-only ("Frontfiles Creator" / "Protected Source"). Verified/Trusted distinction removed in display until BP-D5 ships earning logic. Schema and default unchanged (still `'verified'`); component code-comment documents the policy. |
| H-1 | ✅ APPLIED | `src/components/composer/PublishConfirmation.tsx:52` | "FCS Layer 4 Assembly" → "assembly verified" |
| H-2 | ✅ APPLIED | `src/lib/mock-data.ts:1414` + `:1435` | FCS L1-L3 / Layer 4 references replaced with truthful provenance language; hash prefix `fcs-` → `fff-` |
| H-3 | ✅ APPLIED | `src/data/recommendations.ts:295` + `src/data/spotlight.ts:2` | "FCS Spotlight" → "Editor's Pick" |
| M-1 | DEFERRED | (state badge comment + rendered label audit) | Per audit "LATER" tag |
| M-2 | DEFERRED | (mock-fixture density of fully_validated) | Per audit "LATER" tag |
| LOW | DEFERRED | code comments + tests | Per audit "defer" tag; will be cleaned during BP-D5/D6 implementation |

**Follow-up flagged but NOT applied in this pass** (out of BP-D7 scope, queued for separate directives):

- Event type identifier `'fcs_layer_complete'` in `mock-data.ts` lines 1413, 1434 — machine-readable; less urgent than the description text, but should be renamed when the event-type system gets a dedicated cleanup pass
- Metadata field `{ layer: 4, articleId: '...' }` in mock-data.ts:1437 — same machine-readable concern
- Marketing site / landing page / public docs — out of `src/`; needs separate audit
- Email templates (`src/lib/email/templates/`) — likely contains Trust Badge or validation language; needs follow-up audit before any C-2 fix ships in production-emailed contexts
- Legal pages (terms, privacy, AI processing disclosure, creator agreement) — needs counsel-led revision per agent doc dependency on Task #25
- Vault drawer + asset detail provenance panels — known consumers; not deeply read in this pass

These are tracked for a follow-up "BP-D7.1 — extended copy audit" directive if needed.

---

---

## Verdict

**Two CRITICAL exposures, three HIGH exposures, two MEDIUM exposures, and a long tail of LOW (code-only) references.** The two critical findings are user-facing and have legal/trust language risk under CLAUDE.md item 9 (avoid inflated language; be careful with provenance, trust, verification, certification claims). Both should be addressed before any other BP-D directive ships.

The full surface is summarized below with proposed corrections. None of these edits are made yet — they require founder review.

---

## CRITICAL findings (immediate action recommended)

### C-1. Checkout page: buyer-facing legal acknowledgment of "FCS processing"

**File:** `src/app/checkout/[assetId]/page.tsx` line 277

**Current copy:**
> "This asset has been processed by the Frontfiles Certification System (FCS). The Validation Declaration above reflects the current provenance and integrity status. By proceeding, you acknowledge this declaration."

**The problem:**
This is buyer-facing language asking the buyer to *legally acknowledge* a declaration based on "the Frontfiles Certification System (FCS)." Per `BLUE-PROTOCOL-FCS-VERIFICATION-2026-04-26.md`, FCS is essentially a label and a single boolean — there is no L1, L2, or L3 system, no progressive evidence ladder, no certification process as the agent doc describes.

A buyer who later disputes the asset's provenance and discovers there's no FCS in the way the language implies could argue the acknowledgment was procured under misleading representation. This is the highest-exposure finding in the entire audit.

**Proposed correction:**
> "This asset's Validation Declaration above reflects the provenance and integrity information currently documented for this work on Frontfiles. By proceeding, you acknowledge this declaration."

**Rationale:**
- Drops the proper-noun "Frontfiles Certification System (FCS)" claim — the system isn't built as described
- "Provenance and integrity information currently documented for this work" is accurate: it describes what the platform knows and shows
- Preserves the buyer's acknowledgment of the declaration (the legal hook stays intact)
- Per agent rule #1: prefer `verifiable`, `provenance-aware`, `independently reviewable`

**Severity if shipped wrong:** Legal exposure on every transaction.

---

### C-2. TrustBadge default = `verified` for every creator

**Files:**
- `src/lib/identity/store.ts:546` — defaults `trust_badge: 'verified'`
- `src/components/platform/TrustBadge.tsx:13-18` — labels "Verified Creator" / "Verified Protected Source" / "Trusted Creator" / "Trusted Protected Source"
- `src/components/platform/ProfileLeftRail.tsx:40` — displays "Verified Creator"
- `src/app/creator/[handle]/frontfolio/page.tsx:373` — tooltip "Verified Creator"

**The problem:**
Per `BLUE-PROTOCOL-TRUST-BADGE-VERIFICATION-2026-04-26.md`: every creator profile defaults to `trust_badge: 'verified'` at creation. There is no earning logic. Today, "Verified Creator" displays across the platform for every creator regardless of evidence. The agent doc rule explicitly says "A `trusted` creator earns that from sustained track record" — implying both badges are earned. They aren't.

A creator who has done nothing other than create an account is shown to other users and buyers as "Verified Creator." This is the kind of inflationary language CLAUDE.md item 9 specifically warns against.

**Proposed correction (two-step):**

**Short-term defensive fix (this BP-D7 directive scope):** change the default-on label to a narrower, defensible claim.
- Replace `'verified'` default with a new label state that's accurate to what's actually verified at signup. Options:
  - `'email_verified'` → "Email Verified" (assuming email is verified during signup; this is accurate)
  - `'self_declared'` → "Self-Declared Creator" (transparent)
  - Drop the badge entirely until earned (no display at all)

  Most defensible: drop the badge entirely until earned. UI shows nothing trust-related on creator-by-default profiles. Earned badges (which don't have implementation yet) appear later.

**Long-term fix (BP-D5 scope):** introduce proper earning logic + new schema state. The short-term fix is a defensive holdover until BP-D5 ships.

**Rationale:**
- The current `'verified'` default makes a claim that isn't backed
- Per agent rule #1 (terminology discipline), "Verified" is exactly the kind of word that needs evidence behind it
- The fix preserves the future earning model (BP-D5 introduces real `verified` and `trusted` states earned through evidence)

**Severity if shipped wrong:** Platform-wide overclaiming. Affects every creator profile.

---

## HIGH findings

### H-1. Composer publish confirmation: "Source assets (FCS Layer 4 Assembly)"

**File:** `src/components/composer/PublishConfirmation.tsx:52`

**Current copy:**
> "Source assets (FCS Layer 4 Assembly)"

**The problem:**
"Layer 4" implies a tier of a system. There are no Layers 1-3 in code. The label claims a position in a hierarchy that doesn't exist.

**Proposed correction:**
> "Source assets — assembly verified"

OR, if the founder wants to preserve the structural language for future BP-D6 implementation:
> "Source assets — assembly checked" *(with no mention of "Layer 4" or "FCS")*

**Rationale:**
- "Assembly verified" describes what the boolean `assemblyVerified` actually represents (someone set the flag)
- Drops the "Layer 4" tier claim until the tier system actually exists
- Composer flow remains functional; just the copy softens

---

### H-2. Mock data: "FCS L1-L3 complete" / "FCS Layer 4 assembly certification"

**File:** `src/lib/mock-data.ts:1414, 1435`

**Current copy:**
- Line 1414: `description: 'FCS L1-L3 complete. Validation Declaration: Fully Validated. Hash: fcs-f3a6b9c2'`
- Line 1435: `description: 'FCS Layer 4 assembly certification. Article: fcs-art-a1b2c3'`

**The problem:**
These are mock fixture descriptions that render to users (likely in event log or asset detail panels). They reference L1, L2, L3, L4 — none of which exist. Even though they're mock, they shape user expectations and create a false impression of system capability.

**Proposed correction:**
- Line 1414 → `description: 'Provenance manifest verified. Validation Declaration: Fully Validated. Hash: fff-f3a6b9c2'`
- Line 1435 → `description: 'Assembly verification recorded. Article reference: art-a1b2c3'`

**Rationale:**
- Drops L1-L3-L4 references entirely from mock fixtures
- Replaces with language that's truthful about what the platform currently does
- Hash prefix changed from `fcs-` to `fff-` to remove the FCS naming claim from machine-readable fields too

---

### H-3. "FCS Spotlight" recommendations title

**Files:**
- `src/data/recommendations.ts:295` — `title: 'FCS Spotlight'`
- `src/data/spotlight.ts:2` — `// FRONTFILES — FCS Spotlight Dataset`

**The problem:**
"FCS Spotlight" is a recommendations panel title displayed to users. It implies a curation based on FCS levels. There is no FCS curation logic.

**Proposed correction:**
- Line 295 → `title: 'Provenance Spotlight'` (preserves the trust/quality framing without claiming FCS)
- OR `title: 'Editor's Pick'` (cleaner; doesn't claim provenance or FCS)
- OR `title: 'Featured Work'` (most generic; safest)

Recommend `'Editor's Pick'` — it's accurate (someone editorial picked these), doesn't overclaim, and matches FF's editorial posture.

Update `src/data/spotlight.ts` comment correspondingly.

---

## MEDIUM findings

### M-1. State badge labels reference FCS

**File:** `src/components/platform/StateBadge.tsx:8`

**Current copy:** Comment: `// Validation Declaration states (FCS)`

**The problem:** Comment-only, but the file renders state badges to users. The "(FCS)" parenthetical in the code comment suggests the badges are tied to an FCS system that doesn't exist as described. The badges themselves should be audited for the labels they render — not done in this audit pass.

**Proposed correction:** Update comment to `// Validation Declaration states`. Audit the actual rendered labels in a follow-up pass (deferred — out of BP-D7 scope unless founder wants now).

---

### M-2. Mock-fixture density of `fully_validated` assets

**File:** `src/data/assets.ts` — 30+ assets seeded with `validationDeclaration: 'fully_validated'`

**The problem:** The agent doc rule #3 says: "A newly uploaded asset never starts at `fully_validated`. Default initial state is `provenance_pending`." Mock fixtures predominantly set assets at the apex tier. Per the audit, no evidence pipeline exists — so live UI shows many "fully validated" assets without any actual basis.

For dev/demo purposes, this is acceptable IF the mock context is clearly labeled. Today it's not — the mock dataset and the production dataset use the same model and the same UI rendering, so a user looking at the platform sees "Blue Protocol" badges everywhere.

**Proposed correction (one of):**
- (a) Reduce the proportion of mock assets at `fully_validated` to ~20% of the dataset (keeps the badge visible in demo flows but doesn't dominate)
- (b) Add a "demo content" badge or watermark when mock-mode is active (purely UX; doesn't change the data)
- (c) Leave as-is and rely on the post-PR-5 cutover to replace mock data with real assets at `provenance_pending`

Recommend (a) for short-term defensiveness, plus (c) as the eventual fix when real upload runs in production.

---

## LOW findings (code-only; not user-facing)

These reference FCS / trust / certification in code comments, type definitions, test files, or internal services. They do not surface to users directly. They can be updated lazily as part of BP-D5 / BP-D6 implementation.

| File | Line | Reference |
|---|---|---|
| `src/lib/types.ts` | 48 | Comment: "Authority: FCS owns Declaration state" |
| `src/lib/types.ts` | 588 | Comment: `// FCS Layer 4` |
| `src/lib/upload/types.ts` | 6, 111, 174, 209 | Comments referencing FCS levels |
| `src/lib/assignment/services.ts` | 13 | Comment: "FCS owns provenance state" |
| `src/lib/assignment/guards.ts` | 8 | Comment: "does not check Vault or FCS authority" |
| `src/lib/assignment/__tests__/*` | various | Test descriptions referencing FCS |

**Action:** none required from BP-D7. Will be cleaned up as part of BP-D6 (FCS spec + implementation) when the actual FCS module is built and the comments can reference it accurately.

---

## False positives (cleared during audit; not findings)

These showed up in the discovery search but are NOT trust-language exposures:

| File | Why it's not a finding |
|---|---|
| `src/lib/bolt/sources.ts` `TrustedSource` / `TIER_1`-`TIER_4` | Internal classification of external publication sources for the BOLT cross-ref system. Not Trust Badge. Different domain. |
| `src/app/newsroom/[orgSlug]/manage/verification/*` (entire newsroom verification flow) | This is **newsroom org domain verification** (DNS TXT records + email OTP), which IS implemented and IS evidence-backed. The "verification" word here is accurate. Different system from Trust Badge. |
| `src/app/api/newsroom/orgs/[orgSlug]/verifications/*` | Same as above — newsroom-side, evidence-backed verification. |

---

## Recommended action sequence

1. **Founder reviews this audit** and ratifies the C-1 (checkout) and C-2 (Trust Badge default) corrections. These are the load-bearing fixes.
2. **Claude composes a short PR** (call it BP-D7-IMPL) that applies the ratified copy changes. Scope: ~5-10 file edits, no schema changes, no logic changes. ~30 min composition.
3. **Founder reviews the PR** before merge.
4. **Long-term fixes** (BP-D5 for proper Trust Badge earning, BP-D6 for actual FCS implementation) proceed on their own track per the main directive list.

The C-1 and C-2 fixes are short-term defensive copy changes, not the structural fixes. They protect against live language exposure until BP-D5 and BP-D6 land.

---

## Open follow-on (out of this audit's scope)

- **Marketing site / landing page / public docs** — did not audit anything outside `src/`. If FF has a marketing site with FCS / "verified" / "certified" language, it needs a parallel audit pass. Recommend separate directive.
- **Email templates** — `src/lib/email/templates/` exists but did not pass through the discovery here. Likely contains Trust Badge or validation language in onboarding / notification emails. Worth a follow-up audit pass before any C-2 fix ships (so emails don't continue to send "Verified Creator" language while the UI changes).
- **Legal pages** (terms, privacy, AI processing disclosure, creator agreement) — per agent doc dependency on Task #25. Likely contain FCS / certification language that needs founder + counsel review. Out of scope here; flag for BP-D7 follow-up or counsel-led revision.
- **Vault drawer + asset detail provenance panels** — known consumers of validation/FCS language but not deeply read here. Could surface additional findings.

Estimated total follow-up audit scope: ~2-4 hours depending on how broadly you want to sweep.

---

## Summary table for ratification

| ID | File | Severity | Current → Proposed | Approval needed |
|---|---|---|---|---|
| C-1 | `checkout/[assetId]/page.tsx:277` | CRITICAL | "processed by the Frontfiles Certification System (FCS)" → "provenance and integrity information currently documented for this work" | YES |
| C-2 | `identity/store.ts:546` + display sites | CRITICAL | Default `trust_badge: 'verified'` → drop default badge display until earned (or "Email Verified" narrower claim) | YES |
| H-1 | `composer/PublishConfirmation.tsx:52` | HIGH | "Source assets (FCS Layer 4 Assembly)" → "Source assets — assembly verified" | YES |
| H-2 | `mock-data.ts:1414, 1435` | HIGH | "FCS L1-L3 complete" / "FCS Layer 4 assembly certification" → drop FCS levels; replace with "Provenance manifest verified" / "Assembly verification recorded" | YES |
| H-3 | `recommendations.ts:295` + `spotlight.ts:2` | HIGH | "FCS Spotlight" → "Editor's Pick" (or similar) | YES |
| M-1 | `StateBadge.tsx:8` (comment) | MEDIUM | Comment cleanup; audit rendered labels in follow-up | LATER |
| M-2 | `data/assets.ts` mock dataset density | MEDIUM | Reduce `fully_validated` density to ~20% of fixtures | LATER |
| LOW (multiple) | code comments + tests | LOW | Lazy cleanup as part of BP-D5/D6 | NO (defer) |

---

End of BP-D7 user-facing copy audit.
