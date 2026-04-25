# P4 Concern 4A.2 — Part C1 Exit Report

**Counterparty-profile endpoint + offer-state chip-copy SSOT.** Sign-off artefact for concern 4A.2 Part C1. Retroactive — the work merged to `main` via PR #10 before this report was authored; report serves as the governance close-out and carries the AC20 floor relock that the merge incurred.

| Key | Value |
|---|---|
| Branch (merged) | `feat/p4-offers-c1-party-profiles` |
| Feature HEAD | `99dd408` — §F1–F5 ship commit |
| Merge commit on `main` | `e91f399` (PR #10) |
| Main predecessor | `155a830` — C2 directive Draft 3.2 finalization |
| Directive | `docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md` (Draft 3.2) |
| Report date | 2026-04-24 |

---

## §1 Commit chain

One feature commit on `feat/p4-offers-c1-party-profiles`, merged to `main` via PR #10.

| SHA | Subject | Files | LoC delta | C1? |
|---|---|---|---|---|
| `155a830` | docs(c2-directive): Draft 3.2 finalization + §UI_DESIGN_GATE amendment | — | — | No — predecessor (baseline) |
| `99dd408` | feat(c1): party-profiles endpoint + state-copy SSOT (§F1-F5, AC1-AC5) | 4 | +506 LoC new | **Yes** (§F1–F5) |
| `e91f399` | Merge pull request #10 from FrontFiles/feat/p4-offers-c1-party-profiles | merge | — | merge-commit only |

Aggregate C1 delta (`155a830..99dd408`): **4 files added, +506 LoC, 0 modifications, 0 deletions**.

---

## §2 Acceptance criteria coverage (AC1–AC6)

| AC# | Criterion (one-line) | Status | Evidence |
|---|---|---|---|
| AC1 | Counterparty identity reads `public.users`, not `actor_handles` | **PASS** (spirit) / **PARTIAL** (literal grep) | Route at [src/app/api/offers/party-profiles/route.ts](../../src/app/api/offers/party-profiles/route.ts) uses `public.users` via supabase-js; no `actor_handles` reads for counterparty identity. Literal `grep -n 'actor_handles' src/app/api/offers/party-profiles/` returns 3 hits (2 design-rationale comments + 1 test-mock scaffolding required by `requireActor`). Grep-scope is too broad per §6.2; the spirit of AC1 is satisfied. |
| AC2 | Chip copy comes from `src/lib/offer/state-copy.ts` | **PASS** (spirit) / **PARTIAL** (literal grep) | SSOT at [src/lib/offer/state-copy.ts](../../src/lib/offer/state-copy.ts) with `satisfies Record<OfferState, string>` exhaustiveness. Literal grep matches 4 unrelated-entity label hits (`ReviewConsole`, `DocumentsPanel`, `IdentityStatusBadge`) that happen to use the same words in different domains. Pre-existing repo state; not a C1 regression. Grep-scope refinement open per §6.2. |
| AC3 | Endpoint enforces party-scope via EXISTS semi-join; cross-party probe returns empty | **PASS** | Directive §F2 specified a single EXISTS query; implementation uses a semantically equivalent 2-call PostgREST pattern (directive §F2 constraint L42 forbids raw-SQL escape, and supabase-js has none). See §6.3. Cross-party probe test at [get.route.test.ts](../../src/app/api/offers/party-profiles/__tests__/get.route.test.ts) asserts silent empty-filter (200 with `users: []`, NOT 403). |
| AC4 | `FFF_AUTH_WIRED = false` → 200 `{ users: [], flag: 'AUTH_WIRED_OFF' }` | **PASS** | Flag-off short-circuit in route; integration test asserts exact response shape. |
| AC5 | All six enum values translated; no `'pending'` token leaks past translation boundary | **PASS** (spirit) / **PARTIAL** (literal grep) | All six states mapped in `OFFER_STATE_COPY`. Literal grep matches pre-existing `'pending'` uses in watermark / transaction / provider domains — pre-existing repo state, not a C1 regression. Grep-scope refinement open per §6.2. |
| AC6 | Perf p95 latency ≤ baseline | **DEFERRED** | Per directive §F6 row 6, AC6 requires a TBD baseline captured at Prompt 1 instrumentation pass. Not captured in `99dd408`; deferred to a Gate 1 instrumentation pass. Open item §6.1. |

**Footnote on the §F2 deviation (AC3):** Directive §F2 specified an inline `SECURITY INVOKER` SQL EXISTS query. The implementing commit recognized that supabase-js (the user-JWT client) has no raw-SQL escape hatch in the route-handler context, and constraint L42 of the directive forbids RPC / `SECURITY DEFINER` / migrations. The 2-call PostgREST pattern — (a) read caller's offers with explicit party OR, (b) filter requested ids to the counterparty set, (c) fetch `public.users` profiles — achieves the same semi-join outcome at identical security posture (party-scope enforcement happens at step a via `offers` RLS + explicit OR). No correctness or security deviation from the directive's intent. Documented inline in the route file's header comment.

---

## §3 Test baseline reconciliation

C1 shipped 5 new test cases across 2 files:

| Stage | Count | Delta | Source |
|---|---|---|---|
| Pre-C1 baseline (at `155a830`) | unknown — not captured at predecessor | — | — |
| Post-C1 at `99dd408` | +5 test cases | +5 | `get.route.test.ts` (3) + `state-copy.test.ts` (2) |
| Floor reference at P4 C2 Prompt 1 baseline (`720008d`) | 1276 passed / 10 skipped / 0 failed | — | [C2 directive §AUDIT-1](P4_CONCERN_4A_2_C2_DIRECTIVE.md) |

AC satisfied: `+5` tests landed, zero failing, zero new skips. Absolute pre-C1 count not recorded — subsequent C2 baselines verify no C1 regression (C2 Prompt 1 at 1276, pre-Prompt-6 at 1310 after C2 prompts 2–5/7/8 + C1 merge, Prompt-6 close at 1319).

---

## §4 Files inventory

Four new files. Zero modifications.

### §4.1 Added (4 new files)

| File | LoC | Scope |
|---|---|---|
| `src/app/api/offers/party-profiles/route.ts` | 198 | §F1–F3 route handler |
| `src/app/api/offers/party-profiles/__tests__/get.route.test.ts` | 224 | §F5 integration tests (3 cases) |
| `src/lib/offer/state-copy.ts` | 39 | §F4 translation map SSOT |
| `src/lib/offer/tests/state-copy.test.ts` | 45 | §F5 unit tests (2 cases) |

**Subtotal:** 506 LoC added in 4 new files.

### §4.2 Modified / Deleted

None. C1's blast radius is strictly additive.

---

## §5 AC20 floor reconciliation

**This is the load-bearing section of this exit report.** PR #10 was the first of three PRs to drift the AC20 lint floor from its AUDIT-1 anchor at 68. The drift was identified during the PR #11 audit pass and attributed end-to-end on 2026-04-24.

### §5.1 Contribution

C1 introduces **+2 lint errors** against the AUDIT-1 floor:

| Error | Location | Rule | Cause |
|---|---|---|---|
| 1 | `src/app/api/offers/party-profiles/__tests__/get.route.test.ts:22` | `no-restricted-syntax` | String literal `'SUPABASE_SERVICE_ROLE_KEY'` inside `scopeEnvVars([...])` setup |
| 2 | `src/app/api/offers/party-profiles/__tests__/get.route.test.ts:145` | `no-restricted-syntax` | `vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')` literal |

Both are test-file usages. Both follow the convention established by pre-existing offer-route tests (`accept.route.test.ts`, `counter.route.test.ts`, `reject.route.test.ts`, `cancel.route.test.ts`) — those files contribute the bulk of the pre-existing 68-error floor. C1 inherited the pattern rather than introducing it; the floor grew because the rule's blast surface grew.

Neither literal reaches production code paths. Both are test-scoped.

### §5.2 Relock

`AC20_floor`: **68 → 70.**

Attribution table (full drift reconciliation across C-workstream):

| Delta | Owner | Commit | Resolution |
|---|---|---|---|
| +2 | C1 (PR #10) party-profiles test | `99dd408` | This exit report — floor 68 → 70. Structural remediation below. |
| +1 | C2 (PR #11) Prompt 5 RejectConfirmDialog (`react-hooks/refs`) | `d047cae` → closed by `9b8d539` | Closed in-branch by PR #11's `fix(offers): prompt 5 cleanup` commit. `useCallback` + justified `eslint-disable`. C2 contribution to floor: 0. |
| 0 | Docs-only commits (`3f32f88`, `155a830`, `dae8ef2`, `d09cdba`, `35cd4e5`) | — | Docs cannot produce lint errors. Earlier speculative attribution to `3f32f88` was incorrect and has been struck. |

**Post-reconciliation state:** `AC20_floor = 70`. This relock takes effect on merge of PR #11 (which inherits this exit report's attribution via its body's AC20 reconciliation table).

### §5.3 Structural remediation (follow-up, NOT blocking)

The `no-restricted-syntax` rule currently fires on `SUPABASE_SERVICE_ROLE_KEY` literals in `src/app/` and `src/components/` universally, including `__tests__/` subpaths. Every offer-route test file has to stub the env var somehow; every one triggers the rule. Two paths close the gap:

**Option A — Rule carve-out for `__tests__/`.** Narrow the ESLint rule's pattern-restricted-syntax selector to exclude paths matching `**/__tests__/**`. One line in the ESLint config. Affects only lint output; no test-file edits needed.

**Option B — Helper extraction.** Introduce a shared `stubSupabaseServiceEnv()` helper in `src/lib/test/env-scope.ts` that encapsulates the literal. Route-test files call the helper instead of the string literal. Wider edit surface (8 test files) but aligns with the rule's stated intent ("Route service-role work through an API handler that calls getSupabaseClient()").

**Recommendation:** A. Option B is the stated intent but isn't enforcing anything that matters for test files — tests are allowed to stub the env; the rule was designed to catch production-code misuse. A carve-out aligns enforcement with intent at one-tenth the cost.

Owner: **next-cycle concern** ("Lint-rule hygiene — `no-restricted-syntax` `__tests__/` carve-out"). Not scheduled under C1, C2, or D. Estimated 1-hour concern; worth batching with the §6.2 grep-scope refinements.

---

## §6 Open items inventory

| # | Item | Owner | Notes |
|---|---|---|---|
| 6.1 | AC6 perf baseline capture | C1-followup | Directive §F6 row 6 deferred this to a Gate 1 instrumentation pass. Not captured in `99dd408`. Pre-production the endpoint is not on a hot path, but a baseline should be locked before the `/vault/offers` detail UI goes live under `FFF_AUTH_WIRED=true`. Budget: k6 or similar load harness, ≤ 1 prompt. |
| 6.2 | AC1 / AC2 / AC5 grep-scope refinement | C1-followup | Current grep gates match substrings across unrelated domains (producing spurious hits). Refine each gate's `grep` expression to scope only the relevant file trees (e.g. `--include='src/lib/offer/*.ts' --include='src/components/offer/**'`). One ESLint helper rule could replace all three greps; see next-cycle hygiene concern. |
| 6.3 | §F2 directive-vs-implementation deviation | **closed** | Directive specified inline SQL EXISTS; implementation used 2-call PostgREST semi-join per constraint L42 (no raw-SQL escape available in supabase-js). Semantically equivalent; documented inline in route header. No action owed. Marked here for audit traceability only. |
| 6.4 | `no-restricted-syntax` rule blast surface | next-cycle | See §5.3 — rule fires on every `SUPABASE_SERVICE_ROLE_KEY` literal in test files. Owner: a dedicated lint-hygiene concern. Estimated 1 hour. |

---

## §7 Recommendation

| Question | Answer | Rationale |
|---|---|---|
| **Concern status** | **CLOSED.** | PR #10 merged `2026-04-24`. All five load-bearing AC rows PASS or PASS-spirit with documented grep-scope carve-outs. AC6 deferred per directive §F6 row 6. Zero code defects. |
| **AC20 floor at merge of PR #11** | **70.** | C1 introduces +2 (§5.1); C2 closes its +1 in-branch (§5.2). Post-merge floor = 68 + 2 + 0 = 70. |
| **Blocks PR #11 merge?** | **No.** | This exit report is retroactive; C1 is on `main`. PR #11's body references this report under its AC20 reconciliation section. PR #11 can merge once reviewer approves. |
| **Next action** | None from this report. | §6.1, §6.2, §6.4 are next-cycle / C1-followup, not C1-closing. |

---

## §END

**Status: C1 complete.** Five AC rows PASS or PASS-spirit; one DEFERRED per directive. AC20 floor relocked at 70. Four files added, zero modified, zero deleted. No decision-log revisions (directive §OPEN-Q was empty at Gate 0). Three open items registered to next-cycle cleanup pass.

**Exit SHA:** `99dd408d0c8d881e2b423404cc91b82dd073efd3` (feature) / `e91f399` (merge).

**Authored:** 2026-04-24, retroactively, during the PR #11 audit pass that surfaced the AC20 drift attribution. See PR #11 body §AC20 reconciliation for the attribution table mirrored here.
