# Certified-Terminology Sweep Directive

**Status:** DRAFT v1 · **Date:** 2026-04-23 · **Owner:** João Nuno Martins
**Governs:** Repo-wide audit + remediation of the `certified` / `certification` / `Certified` token family across `src/`.
**Trigger:** FEATURE_APPROVAL_ROADMAP.md O-A0-5 (opened 2026-04-23 as part of A.5 FFF code-ground-truth audit).
**Cross-references:** `CLAUDE.md` §9; `ECONOMIC_FLOW_v1.md` §9; `.claude/agents/frontfiles-context.md` §Protected terms; `FEATURE_APPROVAL_ROADMAP.md` §A.0 / O-A0-5.

---

## 1. Purpose

Close the terminology-discipline gap between the governing authorities (`CLAUDE.md` §9, `ECONOMIC_FLOW_v1.md` §9, `frontfiles-context.md`) and the current state of the codebase, which has **304 occurrences of `certified*` tokens across ~50 files in `src/`.**

This is **not** a sweep-replace. "Certified" in this codebase has two distinct usage classes — one canonical-authorized (retain), one casual/inflated (replace). Per-site classification is the core work; replacement is the tail.

## 2. Authority chain and the tension to resolve

Three governing authorities touch "certified" with **overlapping but not identical rules**:

| Source | Rule |
|---|---|
| `ECONOMIC_FLOW_v1.md` §9 | **"Banned: `certified`, `tamper-proof`, `immutable`, `guaranteed immutable`. Allowed: `tamper-evident`, `independently reviewable`, `provenance-aware`, `verifiable`."** Hard ban scoped to the economic-layer spec surface. |
| `CLAUDE.md` (root) §9 | *"Do not use `certified` or `certification` casually. Prefer precise language such as verifiable, tamper-evident, independently reviewable, or provenance-aware when appropriate."* Reserve-for-narrow-contexts rule. |
| `.claude/agents/frontfiles-context.md` §Protected terms | *"Do not use casually. Reserved for specific provenance-attested contexts only. When tempted to use, substitute `verifiable`, `tamper-evident`, `independently reviewable`, or `provenance-aware`."* Reserve-for-narrow-contexts rule. |

**Resolved reading:** the economic-layer ban is the strictest surface; elsewhere the reserve-for-specific-provenance-attested-contexts rule applies. Both rules converge on: **keep the canonical Spec §10.2 `CertifiedPackage` concept; replace everything that falls outside that narrow, specific, provenance-attested context.**

## 3. Current-state audit

**Total hits:** 304 occurrences across ~50 files (grep: `certified|Certified|CERTIFIED|certification|Certification|certify|Certify` in `src/**`).

### 3.1 Distribution by category

| Category | Files | Hit count | Class |
|---|---|---|---|
| Canonical Spec §10.2 types (`interface CertifiedPackage`, fields `certifiedAt`, `certificationHash`, `certifiedPackageId`) | `src/lib/types.ts`, `src/lib/db/schema.ts`, `src/lib/entitlement/types.ts`, `src/lib/documents/types.ts`, `src/lib/transaction/types.ts`, `src/lib/fulfilment/store.ts`, `src/lib/assignment/events.ts`, `src/lib/entitlement/services.ts`, `src/lib/transaction/finalization.ts`, API route handlers, `src/lib/onboarding/types.ts`, `src/lib/onboarding/constants.ts` | ~35+ | **A (retain)** |
| Mock field assignments referencing canonical fields (`certifiedAt: '2026-03-XX...'`, `certificationHash: '0x...'`) | `src/lib/mock-data.ts` (136), `src/data/assets.ts`, `src/data/articles.ts`, `src/data/creator-content.ts`, `src/data/index.ts`, `src/lib/documents/mock-data.ts`, test helpers | ~150+ | **A (retain)** — valid field values |
| User-facing UI copy naming the canonical "Certified Package" product | `src/app/checkout/[assetId]/page.tsx`, `src/app/checkout/review/page.tsx`, `src/app/article/[id]/page.tsx`, `src/app/vault/transactions/page.tsx`, `src/components/asset/AssetRightsModule.tsx`, `src/components/platform/VaultDetailDrawer.tsx` (subset of 10 hits), `src/components/assignment/DocumentsPanel.tsx`, `src/components/post/PostMetaStrip.tsx` | ~25 | **A (retain)** — names the canonical product |
| Casual / inflated claims about content quality | `src/components/feed/FeedLeftRail.tsx:216`, `src/components/feed/FeedEmptyState.tsx`, `src/components/feed/FeedRightRail.tsx`, `src/app/page.tsx`, `src/app/feed/page.tsx`, `src/components/onboarding/steps/PhaseLaunch.tsx`, `src/components/onboarding/steps/PhaseReaderMinimal.tsx`, `src/components/onboarding/steps/PhaseRolePicker.tsx`, `src/components/platform/ProfileContent.tsx`, `src/components/platform/FrontfolioContent.tsx`, `src/components/platform/VaultStatusPanel.tsx`, `src/components/platform/ProfileLeftRail.tsx`, `src/components/discovery/DiscoveryMap.tsx`, `src/components/discovery/DiscoveryAgentPanel.tsx`, `src/app/creator/[handle]/frontfolio/page.tsx` | ~30 | **B (replace)** |
| Creator-bio standardized template ("X certified assets across Y Stories") | `src/data/creators.ts` (24 hits; a single templated phrasing repeated across all creator fixtures) | 24 | **B (replace)** |
| Narrative / commentary in mock posts + social + spotlight | `src/data/posts.ts` (4), `src/data/social.ts` (9), `src/data/spotlight.ts` (5 — "New certified coverage in this cluster"), `src/data/users.ts` (1) | ~19 | **B (replace)** |
| Code identifier `certifiedAssets` | `src/data/index.ts:126` | 1 | **B (rename — aggregator identifier)** |

**Class A total:** ~210 hits (~69%).
**Class B total:** ~74 hits (~24%).
**Uncertain / needs per-site read:** ~20 hits (~7%). Lives in `src/components/assignment/*` + `src/components/platform/VaultDetailDrawer.tsx` — mixed Class A product references and Class B inflated-quality copy; cannot classify without reading each.

### 3.2 Classification principle

**Class A — retain.** Each of:
- Type declarations naming `CertifiedPackage`, `certifiedAt`, `certificationHash`, `certifiedPackageId` (per Spec §10.2).
- Mock field values assigned to Class A fields.
- UI copy that literally names the "Certified Package" product (the delivered bundle of licence + hash-chain + signed documents).
- `// CERTIFIED PACKAGE (Spec §10.2)` comment headers.

**Class B — replace.** Each of:
- Claims about content being "certified" as a quality descriptor ("certified coverage", "certified stories", "certified catalogue").
- Claims about platform or creator actions being "certified" ("Frontfiles certified the frames", "certified end-to-end", "dual-certified").
- Aggregate counts named with `certified*` ("X certified assets across Y Stories", `certifiedAssets` aggregator field).
- Feed/onboarding/empty-state copy generically invoking the token.
- Any UI phrase that would read identically with "verifiable", "verified", "fully-validated", or "provenance-aware" substituted.

**Uncertain — classify at execution.** Sites where reading the surrounding component is required to decide whether the token names the canonical product or generalizes the term. Handle per-site in execution, not in bulk.

## 4. Replacement vocabulary

For Class B sites, use this mapping. Pick by context; do not mechanically pattern-match.

| Source phrase | Replacement | Rationale |
|---|---|---|
| "certified asset(s)" | "verifiable asset(s)" OR "fully-validated asset(s)" | The latter is stronger when the asset is in Blue Protocol `fully_validated` state; the former is safer default. |
| "certified coverage" | "verifiable coverage" OR "provenance-aware coverage" | Drops inflation while preserving meaning. |
| "certified stories" / "certified catalogue" | "verified stories" / "verified catalogue" | Neutral, factual. |
| "certified frames" | "fully-validated frames" OR "tamper-evident frames" | Context-dependent: use "fully-validated" when Blue Protocol state is implied; use "tamper-evident" for provenance-preservation emphasis. |
| "dual-certified" | "dual-attested" OR "provenance-cross-verified" | Removes marketing inflation. |
| "certified end-to-end" | "provenance-preserved end-to-end" | Preserves the end-to-end claim, removes certification overclaim. |
| "Frontfiles certified [something]" | "Frontfiles validated [something]" OR "Frontfiles verified [something]" | Platform doesn't certify (per CLAUDE.md §9); it validates and preserves provenance. |
| "AI-certified" / "certified by AI" | **ALWAYS replace** with "AI-flagged for review" or "AI-suggested" | Per CLAUDE.md §9 + frontfiles-context.md: AI never certifies; AI suggests / flags / analyzes. |
| "New certified coverage in this cluster" (spotlight mock) | "New verified coverage in this cluster" | Direct substitution. |
| "X certified assets across Y Stories" (creator bio template) | "X verified assets across Y Stories" OR "X fully-validated assets across Y Stories" | Founder picks which flavor at dispatch (affects all 24 creator bios). |
| `certifiedAssets` (identifier) | `verifiedAssets` OR `fullyValidatedAssets` | Pick at dispatch; cascades to one call site (`src/data/index.ts:126`). |

## 5. Tiered execution plan

Three tiers, each its own PR. Tier 1 goes first (user exposure urgency); Tier 2 second; Tier 3 third.

### 5.1 Tier 1 — User-facing UI copy (Class B only)

**Scope.** All Class B hits in `src/app/**/page.tsx`, `src/components/**/*.tsx` (excluding platform components that name the Certified Package product).

**Target files (confirmed Class B).**
- `src/components/feed/FeedLeftRail.tsx:216` (feed footer)
- `src/components/feed/FeedEmptyState.tsx`
- `src/components/feed/FeedRightRail.tsx` (5 hits)
- `src/app/page.tsx` (landing)
- `src/app/feed/page.tsx` (2 hits)
- `src/components/onboarding/steps/PhaseLaunch.tsx` (3 hits)
- `src/components/onboarding/steps/PhaseReaderMinimal.tsx` (2 hits)
- `src/components/onboarding/steps/PhaseRolePicker.tsx` (1 hit)
- `src/components/platform/ProfileContent.tsx` (3 hits — verify per-site)
- `src/components/platform/FrontfolioContent.tsx` (1 hit)
- `src/components/platform/VaultStatusPanel.tsx` (2 hits — verify per-site)
- `src/components/platform/ProfileLeftRail.tsx` (1 hit)
- `src/components/discovery/DiscoveryMap.tsx` (1 hit)
- `src/components/discovery/DiscoveryAgentPanel.tsx` (1 hit)
- `src/app/creator/[handle]/frontfolio/page.tsx` (1 hit)
- `src/components/post/PostMetaStrip.tsx` (1 hit — verify)

**Target files (mixed — classify at execution).**
- `src/components/platform/VaultDetailDrawer.tsx` (10 hits — likely mix of Certified Package product refs and Class B)
- `src/components/assignment/DocumentsPanel.tsx` (4 hits)
- `src/components/assignment/TimelinePanel.tsx` (1 hit)
- `src/components/assignment/StaffDisputeConsole.tsx` (4 hits)

**Exclusions (Class A — do not touch).**
- `src/app/checkout/[assetId]/page.tsx` — "Certified Package will be delivered to your account" + 5 similar (canonical product name).
- `src/app/checkout/review/page.tsx` (2 hits — canonical product name).
- `src/app/article/[id]/page.tsx` (1 hit — verify, likely Class A).
- `src/app/vault/transactions/page.tsx` (2 hits — verify, likely Class A).

**Estimated LoC.** ~40 single-line edits + 5–10 multi-line paragraph edits. PR size: S–M.

**Acceptance.** Tier 1 grep post-PR: zero Class B `certified*` hits in listed files; Class A product-name hits preserved with inline code comment citing Spec §10.2.

### 5.2 Tier 2 — Mock data / fixtures (Class B only)

**Scope.** All Class B narrative text in mock data files.

**Target files.**
- `src/data/creators.ts` — 24 hits, all the standardized bio template *"X certified assets across Y Stories"*. Single-pattern sweep.
- `src/data/spotlight.ts` — 5 hits, all the `displayReason: 'New certified coverage in this cluster'` template.
- `src/data/social.ts` — 9 hits, narrative `body:` strings in comment fixtures.
- `src/data/posts.ts` — 4 hits, narrative `body:` strings in post fixtures.
- `src/data/users.ts` — 1 hit, narrative bio.
- `src/data/creator-content.ts` — 8 hits (classify: Class A if field assignments, Class B if narrative).
- `src/data/articles.ts` — 12 hits (classify per-site).
- `src/data/assets.ts` — 2 hits (classify per-site).

**Exclusions.**
- `src/lib/mock-data.ts` — 136 hits, **all Class A** (field assignments to `certifiedAt` and similar canonical fields). Do not touch.
- `src/lib/documents/mock-data.ts` — 6 hits (classify; likely Class A).
- Test helpers (`__tests__/helpers.ts` files) — likely Class A.

**Estimated LoC.** ~50 single-line edits across the 8 files listed. PR size: M.

**Acceptance.** Tier 2 grep post-PR: zero Class B `certified*` hits in listed files. Test run green (mock data shape unchanged; only string values differ).

### 5.3 Tier 3 — Code identifier rename

**Scope.** The one identified Class B code identifier: `certifiedAssets` in `src/data/index.ts:126`.

**Rename choice (founder picks at dispatch).**
- **Option A:** `verifiedAssets` (neutral, minimal semantic change).
- **Option B:** `fullyValidatedAssets` (stronger, maps to Blue Protocol state name).

**Target.** `src/data/index.ts:126` definition + any call sites (grep at execution).

**Estimated LoC.** 1 definition rename + N call-site updates. PR size: S.

**Acceptance.** Build green, tests green, grep shows zero `certifiedAssets` remaining.

## 6. Classification rubric — per-site decision procedure

When executing, follow this decision tree on each hit:

```
1. Does the hit reference `CertifiedPackage` interface, its fields, or name the product?
   ├─ Yes → Class A. RETAIN. Optionally annotate with `// Spec §10.2` comment.
   └─ No  → continue to 2.

2. Is the hit a field assignment (`certifiedAt: ...`, `certificationHash: ...`, `certifiedPackageId: ...`)?
   ├─ Yes → Class A. RETAIN.
   └─ No  → continue to 3.

3. Does the hit claim content/coverage/catalogue/frames/work is "certified" as a quality descriptor?
   ├─ Yes → Class B. REPLACE per §4 mapping.
   └─ No  → continue to 4.

4. Does the hit attribute "certify" as a verb to Frontfiles, creators, or AI?
   ├─ Yes → Class B. REPLACE per §4 mapping.
   └─ No  → continue to 5.

5. Is the hit an aggregator/count identifier using `certified*` (e.g., `certifiedAssets`)?
   ├─ Yes → Class B. RENAME per §5.3.
   └─ No  → UNCERTAIN. Read surrounding 10 lines; escalate to founder if unresolved.
```

## 7. Open items

| # | Item | Blocks |
|---|---|---|
| O-CS-1 | Founder ratification on Class A preservation of `CertifiedPackage` Spec §10.2 concept. Default: retain. Alternative: rename the canonical concept itself (would require upstream Spec §10.2 amendment, multi-file structural rename, DB migration). | All tiers — sets scope. |
| O-CS-2 | Founder ratification on `certifiedAssets` rename target: `verifiedAssets` OR `fullyValidatedAssets`. | Tier 3. |
| O-CS-3 | Founder ratification on bio-template flavor: "verified assets" OR "fully-validated assets" (affects 24 creator bios). | Tier 2. |
| O-CS-4 | Should Tier 1 include adding inline `// Spec §10.2` annotations on retained Class A UI copy sites (for future-reviewer clarity)? | Tier 1. |
| O-CS-5 | Dispatch ordering — Tier 1 → Tier 2 → Tier 3 (recommended), or parallel if separate reviewers available? | All tiers. |

## 8. Verification per tier

Each tier's PR must pass:

| Check | Method |
|---|---|
| Build clean | `npm run build` exit 0 |
| Type clean | `tsc --noEmit` clean |
| Test baseline invariant | `npm run test` = pre-tier pass count (no regressions) |
| Lint unchanged or improved | `npm run lint` = pre-tier error count (no new errors) |
| Grep acceptance | Zero Class B `certified*` hits in target file list (per-tier) |
| Class A preservation | Every Class A hit in-scope for the tier remains textually identical (or gains an inline Spec §10.2 annotation if O-CS-4 approves) |
| Manual read | Founder or reviewer reads the full diff before merge |

## 9. Approval gates

| Gate | Produces |
|---|---|
| G-CS0 | This directive signed-off (founder approves classification + mapping + tier structure) |
| G-CS1 | O-CS-1, O-CS-2, O-CS-3 resolved; open items closed |
| G-CS2 | Tier 1 PR landed, all verification checks green |
| G-CS3 | Tier 2 PR landed, all verification checks green |
| G-CS4 | Tier 3 PR landed, all verification checks green |
| G-CS5 | Final sweep: repo-wide grep `certified|Certified|CERTIFIED` matches only Class A occurrences. O-A0-5 in `FEATURE_APPROVAL_ROADMAP.md` marked RESOLVED. |

## 10. Non-goals

- **Not a pure find-replace.** Every hit requires classification before replacement.
- **Not touching upstream Canonical Spec §10.2.** The Certified Package product concept stands unless O-CS-1 resolves otherwise.
- **Not renaming DB columns.** `certifiedAt`, `certification_hash`, etc. are Spec §10.2 identifiers; renaming them is a separate directive if ever needed (major structural change).
- **Not touching test fixtures** that assign Class A field values.
- **Not covering other banned/discipline-protected terms** (`tamper-proof`, `immutable`, `guaranteed immutable`, `AI-verified`) in this directive. Those get their own sweep if/when needed.

## 11. Pattern — lesson for future terminology sweeps

The `certified` token is a **structurally-embedded canonical concept** in this repo (Spec §10.2). A naive find-replace would have corrupted 210+ legitimate field references and broken the Certified Package product. **Future terminology sweeps must start with a classification audit, not a replacement batch.** Any directive that ships "sweep and replace X with Y" without a per-site classification rubric should be rejected on principle.

## 12. Approval

This directive requires founder sign-off before any tier dispatches.

- **To approve as-is:** reply `CS-DIRECTIVE-APPROVED`. Tier 1 composes next.
- **To approve with corrections:** reply `CS-DIRECTIVE-APPROVE-WITH-CORRECTIONS` and specify corrections.
- **To revise before approval:** reply `CS-DIRECTIVE-REVISE` with sections to revise.
- **To reject:** reply `CS-DIRECTIVE-REJECT` with reason.

Sign-off produces gate marker `G-CS0`.

---

*End of document — DRAFT v1. Locks at v2 on founder sign-off.*
