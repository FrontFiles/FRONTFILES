# P4 UI Deprecation Audit

**Status.** Draft 1, 2026-04-20. Companion document to `docs/audits/P4_IMPLEMENTATION_PLAN.md` concern 4. Gate 3 pending founder approval.

**Governs.** The UI-layer retirement and replacement work at P4 cutover per ECONOMIC_FLOW_v1 §14.1 (revision 6) and `docs/audits/P4_PREREQUISITES.md` Entry 3. Paired with the master plan; not independently executable.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` §7, §8, §14.1, §17; `docs/audits/P4_IMPLEMENTATION_PLAN.md` §1.2, §4, §7, §13; `docs/audits/P4_PREREQUISITES.md` Entry 3.

---

## 1. Purpose & scope

### 1.1 What this document produces

This document is the first-class deliverable required by `P4_PREREQUISITES.md` Entry 3. It enumerates every UI surface that consumes any of the 13 retiring API routes, classifies each consumer (delete / rewrite / migrate), and sequences the UI retirements relative to the schema migration cutover.

### 1.2 What this document does not decide

- Net-new spec-canonical UI design under §7 / §8 — scope of a separate design + build pass, referenced here only as "replacement surface" without locking its shape.
- Route paths for the replacement API surface — decided in concern 1 of the master plan (schema) and in any future API spec; this audit only calls out which old paths stop serving.
- When `AUTH_WIRED` flips — that is P5 under §14.1 and concern 3 of the master plan; this audit assumes it is plumbed default-false at deploy 1 and flipped at P5.

### 1.3 Component-count discrepancy flag

ECONOMIC_FLOW_v1 §14.1 cites "19 assignment-domain components." This audit counts 17 in `src/components/assignment/` plus 1 offer entry-point fragment in `src/components/asset/AssetRightsModule.tsx` (the `OfferModal` sub-component) for a total of 18. The discrepancy of 1 is not chased here — the inventory below is the source of truth for what actually gets retired. `ECONOMIC_FLOW_v1` §14.1 can be amended to "18" in a subsequent revision if desired; alternatively, if a 19th component is discovered during concern 4 execution, append it to §3.2 as an addendum.

---

## 2. Retiring API route inventory

All 13 routes below retire at P4 per ECONOMIC_FLOW_v1 §17. None are preserved. None are renamed. Each serves as an entry in the consumer map at §3.

### 2.1 Direct Offer surface — 4 routes

| # | Route | File | Consumers |
|---|---|---|---|
| 1 | `POST /api/special-offer` | `src/app/api/special-offer/route.ts` | `AssetRightsModule.OfferModal` (stubbed — see §4.3), no production caller today |
| 2 | `GET /api/special-offer` | same file (multi-verb) | no production UI caller (vault page reads from store) |
| 3 | `POST /api/special-offer/[id]/accept` | `src/app/api/special-offer/[id]/accept/route.ts` | `src/app/vault/offers/page.tsx:333` |
| 4 | `POST /api/special-offer/[id]/counter` | `src/app/api/special-offer/[id]/counter/route.ts` | `src/app/vault/offers/page.tsx:385` |
| 5 | `POST /api/special-offer/[id]/decline` | `src/app/api/special-offer/[id]/decline/route.ts` | `src/app/vault/offers/page.tsx:446` |

Note: routes 1 and 2 share `src/app/api/special-offer/route.ts` (POST + GET). Counted as one retirement artefact; §17 reports the route family count of 4 (create, accept, counter, decline), which is the correct semantic count.

### 2.2 Assignment surface — 9 routes

| # | Route | File | Consumers |
|---|---|---|---|
| 1 | `POST /api/assignment` | `src/app/api/assignment/route.ts` | `src/components/assignment/NewAssignmentWizard.tsx:242` |
| 2 | `GET /api/assignment` | same file | no production UI caller (reads via `mockAssignments`) |
| 3 | `GET /api/assignment/[id]` | `src/app/api/assignment/[id]/route.ts` | no production UI caller (reads via `getAssignment` from store) |
| 4 | `POST /api/assignment/[id]/accept` | `src/app/api/assignment/[id]/accept/route.ts` | `src/components/assignment/AssignmentShell.tsx:83` |
| 5 | `POST /api/assignment/[id]/cancel` | `src/app/api/assignment/[id]/cancel/route.ts` | `src/components/assignment/AssignmentShell.tsx:153` |
| 6 | `POST /api/assignment/[id]/fulfil` | `src/app/api/assignment/[id]/fulfil/route.ts` | `src/components/assignment/FulfilmentComposer.tsx:209` |
| 7 | `POST /api/assignment/[id]/review-open` | `src/app/api/assignment/[id]/review-open/route.ts` | no production UI caller today (server-route scaffolded ahead of the panel wiring) |
| 8 | `POST /api/assignment/[id]/review` | `src/app/api/assignment/[id]/review/route.ts` | no production UI caller today (same note as #7) |
| 9 | `POST /api/assignment/[id]/dispute` | `src/app/api/assignment/[id]/dispute/route.ts` | `src/components/assignment/DisputePanel.tsx:185` |
| 10 | `POST /api/assignment/[id]/ccr` | `src/app/api/assignment/[id]/ccr/route.ts` | `src/components/assignment/CCRComposer.tsx:132`, `src/components/assignment/CCRComposer.tsx:249` |

Rows 1 and 2 share `src/app/api/assignment/route.ts`; rows 7 and 8 are called out separately because they are distinct files and distinct semantic operations. Route-family count is 9 per §17 (create, get, accept, cancel, fulfil, review-open, review, dispute, ccr).

### 2.3 Count reconciliation

4 (offer family) + 9 (assignment family) = 13 routes retired, matching ECONOMIC_FLOW_v1 §17. ✓

---

## 3. UI consumer inventory

### 3.1 Pages (9) — app-router surfaces

| # | Path | Purpose | Classification |
|---|---|---|---|
| 1 | `src/app/vault/offers/page.tsx` | Buyer-side offer inbox (accept/counter/decline) | **DELETE** — replacement page is a §7 Direct Offer view; entirely new shape under event-sourced offers |
| 2 | `src/app/vault/assignments/page.tsx` | Assignment list for a user | **DELETE** — replacement is a §8 assignments list view |
| 3 | `src/app/vault/disputes/page.tsx` | Disputes list for a user | **DELETE** — replacement is a §9 disputes view |
| 4 | `src/app/assignment/page.tsx` | Top-level assignment list (separate from vault/) | **DELETE** — redundant with vault/assignments replacement; route path itself retires |
| 5 | `src/app/assignment/new/page.tsx` | Create-assignment entry point | **DELETE** — v1 assignments are created from accepted offers per §7.5, not via a standalone new-assignment wizard |
| 6 | `src/app/assignment/disputes/page.tsx` | Staff dispute console entry | **DELETE** — admin surface out of P4 scope; P7 admin trail viewer replaces as needed |
| 7 | `src/app/assignment/[id]/page.tsx` | Assignment detail view | **DELETE** — replacement is a §8 assignment detail view |
| 8 | `src/app/assignment/[id]/activate/page.tsx` | Assignment activation flow | **DELETE** — v1 activation model is not a separate page per §8.3 |
| 9 | `src/app/assignment/[id]/fund/page.tsx` | Assignment funding flow | **DELETE** — v1 funding is a §7.5 post-offer-acceptance step, not a standalone page |

### 3.2 Components (18) — `src/components/assignment/` plus one asset fragment

| # | File | Has fetch call-site? | Classification |
|---|---|---|---|
| 1 | `AssignmentOverview.tsx` | no (reads context) | **DELETE** |
| 2 | `AssignmentProvider.tsx` | no (context provider) | **DELETE** |
| 3 | `AssignmentShell.tsx` | yes — accept (L83), cancel (L153) | **DELETE** |
| 4 | `CCRComposer.tsx` | yes — ccr (L132, L249) | **DELETE** |
| 5 | `CCRPanel.tsx` | no | **DELETE** |
| 6 | `DisputePanel.tsx` | yes — dispute (L185) | **DELETE** |
| 7 | `DocumentsPanel.tsx` | no | **DELETE** |
| 8 | `FulfilmentComposer.tsx` | yes — fulfil (L209) | **DELETE** |
| 9 | `MilestoneList.tsx` | no | **DELETE** — milestone model is v2+ per ECONOMIC_FLOW_v1 §13 |
| 10 | `NewAssignmentWizard.tsx` | yes — POST /api/assignment (L242) | **DELETE** |
| 11 | `ProvisionalReleasePanel.tsx` | no | **DELETE** |
| 12 | `ReviewConsole.tsx` | no (logic present but review/review-open wiring was stubbed) | **DELETE** — review workflow is v2+ per §13 |
| 13 | `RightsPanel.tsx` | no | **DELETE** |
| 14 | `StaffDisputeConsole.tsx` | no (has a commented mock at L553) | **DELETE** |
| 15 | `StaffDisputeQueue.tsx` | no | **DELETE** |
| 16 | `TimelinePanel.tsx` | no | **DELETE** |
| 17 | `shared.tsx` | no (shared utilities) | **DELETE** |
| 18 | `src/components/asset/AssetRightsModule.tsx` — `OfferModal` fragment | no (stub — see §4.3) | **REWRITE** — keep the buyer entry point; rewire submit handler to spec-canonical offer-create route |

### 3.3 Support libraries — `src/lib/assignment/` (15 files) and `src/lib/special-offer/` (7 files)

| Directory | Files | Classification |
|---|---|---|
| `src/lib/assignment/` | `api-helpers.ts`, `closing-reducer.ts`, `closing-types.ts`, `closing.ts`, `context.ts`, `errors.ts`, `events.ts`, `guards.ts`, `jobs.ts`, `mock-data.ts`, `reducer.ts`, `selectors.ts`, `services.ts`, `store.ts`, `types.ts` | **DELETE (whole directory)** — Assignment Engine state machine wholesale retires under §14.1 |
| `src/lib/special-offer/` | `api-helpers.ts`, `guards.ts`, `index.ts`, `reducer.ts`, `services.ts`, `store.ts`, `types.ts` | **DELETE (whole directory)** — Direct Offer store wholesale retires; event-sourced offers under §7 are the replacement |

### 3.4 Tests tied to retiring UI / routes

| Directory | Files | Classification |
|---|---|---|
| `src/lib/assignment/__tests__/` | `api-helpers.test.ts`, `closing.test.ts`, `defect-coverage.test.ts`, `events.test.ts`, `guards.test.ts`, `helpers.ts` (shared), `jobs.test.ts`, `qa-coverage.test.ts`, `reducer.test.ts`, `selectors.test.ts`, `services.test.ts` | **DELETE (whole directory)** — tests co-retire with their source; replacement test suite is concern 2 of the master plan, keyed to the spec-canonical surface |
| `src/lib/special-offer/__tests__/` | `guards.test.ts`, `services.test.ts`, `helpers.ts` (shared) | **DELETE (whole directory)** |

### 3.5 Hooks

No custom hooks were located under `src/hooks/` or elsewhere tied to the retiring routes. All state access flows through `src/lib/assignment/context.ts` (React context provider) or direct `fetch()` call-sites. If concern 4 execution discovers a hook missed here, append it to this section as an addendum.

### 3.6 Total UI retirement surface

- **9** app-router pages → DELETE all
- **18** components → DELETE 17; REWRITE 1 (AssetRightsModule `OfferModal`)
- **22** support-lib files across `src/lib/assignment/` and `src/lib/special-offer/` → DELETE all
- **13** retiring test files across both `__tests__/` directories → DELETE all
- **13** API route files → DELETE all (schema concern, not UI concern; listed here for completeness)

---

## 4. Per-consumer classification detail

### 4.1 DELETE policy

A consumer classified **DELETE** means: the file is removed in concern 4. Its functionality does not carry forward — either because it is v2+ per ECONOMIC_FLOW_v1 §13 (milestones, review workflow, multi-stage fulfilment, staff dispute console) or because the replacement surface is of a materially different shape under §7 / §8 (event-sourced offers, ledger-backed assignments) such that rewriting the existing component would produce an inferior result compared to a net-new spec-canonical component.

### 4.2 REWRITE policy (applies to exactly 1 consumer)

A consumer classified **REWRITE** means: the component file survives in the same location but its internal fetch / handler logic is rewritten to target the new spec-canonical route. Applies only to `src/components/asset/AssetRightsModule.tsx` — specifically the `OfferModal` sub-component, which is the buyer-side "make an offer" entry point. The outer `AssetRightsModule` surface (CTA button, modal shell, form shape) preserves; the submit handler is rewired to whatever spec-canonical offer-create route is defined in concern 1.

### 4.3 Stub-state note on `OfferModal`

As of the 2026-04-20 audit, `src/components/asset/AssetRightsModule.tsx:185` tracks a local `submitted` state and displays a confirmation without actually calling the API. In other words, the buyer-side "create offer" path is a UI-only stub today. This is favourable for P4: there is no production API wiring to un-wire. The REWRITE consists of adding the submit call-site once the new route exists, rather than rerouting an existing call-site.

### 4.4 MIGRATE policy (applies to zero consumers)

No consumer in this audit is classified **MIGRATE**. The absence is intentional: a migration would mean preserving a consumer's shape and redirecting it to a renamed route. Because no retiring route is renamed (all 13 are DELETE per §17), no MIGRATE entries exist. If a future revision of ECONOMIC_FLOW_v1 §17 reclassifies any retiring route as preserve-with-rename, re-run this audit against that revision.

---

## 5. Sequencing relative to migration cutover

### 5.1 Two-deploy sequencing

Per `P4_IMPLEMENTATION_PLAN.md` §7 and `REMEDIATION_PLAN_20260418.md` L528, P4 ships across two deploys:

| Deploy | Ships | UI state |
|---|---|---|
| Deploy 1 | Concern 1 (schema migrations M1–M5) + Concern 2 (acceptance tests) + Concern 3 (AUTH_WIRED plumbing default-false) | No UI change. Retiring surface still live. Spec-canonical surface not yet visible. |
| Deploy 2 | Concern 4 (UI cutover) + Concern 5 (legacy doc retirement) | Retiring pages/components deleted atomically with their replacement pages/components landing in the same merge. Flipped together. |

### 5.2 Why UI cutover is all-or-nothing at deploy 2

A split UI cutover (partial delete + partial replacement across multiple deploys) creates a window where some vault/ pages render against the new schema while others still attempt to call retired routes. That is the exact failure mode that a hard-cut design avoids. The replacement pages are landed in the same deploy as the deletions.

### 5.3 Feature-flag shape

The replacement UI is built under a feature flag (proposed name `FFF_ECONOMIC_V1_UI`, default off) through concern 4. Deploy 2 flips the flag to on at the same time the retiring surface is deleted. Flag scope is strictly UI — no runtime branching in API routes or database code. Flag lives for the duration of deploy-2 rollout then retires in a follow-up housekeeping commit.

### 5.4 Order inside deploy 2

A sensible internal ordering inside concern 4:

1. Land the new spec-canonical pages and components behind the flag (feature-off). No user-visible change.
2. Smoke-test the flag-on path in preview / staging.
3. In the same PR (or an immediately-following PR) delete the retiring pages, components, and support libs.
4. Flip the flag on in production.
5. In a follow-up commit, remove the flag scaffolding now that the old surface is gone.

Concern 4 execution may deviate from this exact step order; the invariant is that retiring surface does not exist in the deployed bundle at the moment the flag flips on.

### 5.5 Rollback story

If deploy 2 is rolled back post-flag-flip, the retiring UI is gone from the bundle but the replacement UI will be re-hidden by the flag. The vault/ pages temporarily return 404. This is acceptable behaviour for a rollback window because:

- Deploy 1 already landed the schema, so the database is in the spec-canonical shape regardless of UI state;
- The 13 retiring API routes were deleted alongside the UI that consumed them;
- The buyer / creator surface can be served read-only via the signed-in dashboard in the interim.

If this is judged insufficient, concern 4 can add a minimum-viable fallback page at the three vault/ route paths that renders "maintenance mode" copy. Founder call during concern 4 execution.

---

## 6. Acceptance criteria

**UI cutover is complete when all of the following hold true:**

1. None of the 9 pages in §3.1 exist in the repo at HEAD.
2. None of the 17 DELETE-classified components in §3.2 exist in the repo at HEAD.
3. `src/lib/assignment/` and `src/lib/special-offer/` directories do not exist in the repo at HEAD.
4. `src/components/asset/AssetRightsModule.tsx` exists and its `OfferModal` submit handler calls the spec-canonical offer-create route (defined in concern 1) rather than setting local state alone.
5. The 13 retiring API route files in §2 do not exist in the repo at HEAD (overlaps with concern 1 acceptance; re-asserted here for completeness).
6. Replacement pages and components for §7 / §8 surfaces exist and are behind feature flag `FFF_ECONOMIC_V1_UI` until concern 4 deploy day.
7. `bun run test` reports zero failures, zero file-load errors, and the concern 2 acceptance test suite is green.
8. `grep -r "special-offer\|/api/assignment" src/ --include="*.ts" --include="*.tsx"` returns zero matches (other than in legacy historical docs, which are out of source and governed by concern 5).
9. `bun run build` succeeds.
10. Manual smoke path: buyer submits an offer via AssetRightsModule → offer lands in spec-canonical `offers` table → creator view renders the thread → accept path produces an `assignments` row → ledger events are written. Concern 2 tests cover the automated version; this is the live-preview confirmation.

---

## 7. Open items

| # | Item | Resolution path |
|---|---|---|
| 1 | Component-count discrepancy (§14.1 says 19, this audit counts 18) | Not blocking. Concern 4 execution may surface the 19th; if so, append to §3.2. Otherwise amend §14.1 to 18 in a subsequent spec revision. |
| 2 | Replacement page shape (§7 Direct Offer view, §8 assignments view, §9 disputes view) | Not scope of this audit. Governed by concern 4 design pass; must land before deploy 2 cut. |
| 3 | Feature-flag name `FFF_ECONOMIC_V1_UI` | Proposed; ratify during concern 4 kickoff. Must match `src/lib/env.ts` naming convention (FFF_ prefix). |
| 4 | Whether to keep maintenance-mode fallback pages at the three vault/ routes during rollback | Founder call during concern 4 execution. |
| 5 | Hook audit — none found under `src/hooks/` for retiring routes | If concern 4 discovers a custom hook that's tied to the retiring surface, append to §3.5. |

---

## 8. Handoff

Concern 4 of `P4_IMPLEMENTATION_PLAN.md` is the governing section for execution. This audit is the source of truth for the retirement inventory; the master plan governs the overall P4 sequencing, gates, and branch topology. The per-concern directive template lives in master plan §13.3 — concern 4's directive should cite this audit by path and embed the §6 acceptance criteria verbatim.

---

## 9. Revision history

- **2026-04-20 — Draft 1.** Initial audit. Inventory compiled from direct repo reconnaissance: `ls` of `src/components/assignment/`, `src/lib/assignment/`, `src/lib/special-offer/`, `src/app/api/assignment/`, `src/app/api/special-offer/`; `grep` for `/api/(assignment|special-offer)` across `src/`; inspection of `src/components/asset/AssetRightsModule.tsx` for the OfferModal stub state. Count reconciled against ECONOMIC_FLOW_v1 §17 (13 routes matched). Component-count discrepancy flagged in §1.3 and §7 item 1.

---

_End of P4 UI deprecation audit._
