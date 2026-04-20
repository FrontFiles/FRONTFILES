# KD-9 Follow-up — Claude Code Fix Directive

**Status.** Drafted 2026-04-20 under `P4_IMPLEMENTATION_PLAN.md` §13.3 template. **Not yet dispatched.** This directive covers the **KD-9 follow-up family** documented in `REMEDIATION_PLAN_20260418.md` appendix F — the 17 Vitest file-load errors that surfaced after the attested KD-9 main program (exit criteria ATTESTED at commit `79df5cf`, 2026-04-18, per `KD-9-audit.md` §F). It does **not** re-open the main program.

**Governs.** A single execution session with Claude Code. One concern, one exit report. Parallel-track to P4; clears a hard prerequisite gate for P4 concern 2 (`P4_IMPLEMENTATION_PLAN.md` §2.2 #7).

**Cross-references.** `docs/audits/REMEDIATION_PLAN_20260418.md` appendix F (baseline + fingerprints); `docs/audits/P4_IMPLEMENTATION_PLAN.md` §2.2 #7–#8 and §2.3 #2 (PR-note discipline); `docs/audits/P4_CONCERN_1_DIRECTIVE.md` §D #5; `KD-9-audit.md` §F (attestation anchor — informational only, do not re-open); `docs/audits/P4_UI_DEPRECATION_AUDIT.md` §3.3 (support-lib `src/lib/assignment/` directory on DELETE list) + §3.4 (fingerprint-2 test file on DELETE list).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: KD-9 follow-up — clear 17 Vitest file-load errors

READ FIRST
Read `AGENTS.md` at repo root and the relevant guide in
`node_modules/next/dist/docs/` before writing any code. This repo runs
Next 16.2.2 + Vitest 4.1.2 + rolldown — APIs, conventions, and file
structure may differ from your training data. Heed deprecation notices.

SCOPE
You are resolving the two failure fingerprints documented in
docs/audits/REMEDIATION_PLAN_20260418.md appendix F. Before any tests
execute, 17 test files currently fail to load under `bun run test`:

  Fingerprint 1 (16 files) — `Error: Environment validation failed —
    see errors above. This is a fail-fast by design.` — thrown from
    src/lib/env.ts top-level Zod parse at module-load time, under
    Vitest 4 with rolldown transform. The parse fails because
    required NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
    SUPABASE_SERVICE_ROLE_KEY values are undefined at the point the
    test file's import graph reaches env.ts.

  Fingerprint 2 (1 file) — `Error: Cannot find module
    '@/lib/assignment/store'` — thrown by a dynamic `require(...)`
    call on line 200 of src/lib/assignment/__tests__/api-helpers.test.ts.
    The alias `@/` does not resolve through CJS `require()` under
    Vitest 4 / rolldown; only through static `import` or dynamic
    `import()`. The target file src/lib/assignment/store.ts exists and
    is statically imported on line 20 of the same test file.

Goal: post-fix, `bun run test` returns zero file-load errors and the
pass count is ≥ the pre-fix baseline of 875.

This is NOT a re-open of the KD-9 main program. That program's exit
criteria were ATTESTED at commit 79df5cf (2026-04-18) per KD-9-audit.md
§F. The 17 file-load errors are a follow-up family that emerged after
attestation, driven by Vitest/rolldown loader timing and one stale
CJS require — not by any of the (a) env-cache or (b) fixture-drift
patterns the main program resolved. Do not scope-creep into mock-mode
sentinels, dual-mode stores, fixture seeding, or any KD-9 main-program
surface.

GATE
Do not open, read, or modify any file outside the list below, except
to read a spec/audit doc for context (reading is permitted, mutation
is not). If investigation surfaces a surface not listed, STOP and
surface it — do not silently expand scope.

Allowed file surface:
  - src/lib/env.ts                         (READ — diagnose only; see
                                            hard invariant below)
  - vitest.config.ts                       (EDIT allowed)
  - vitest.setup.ts                        (EDIT allowed)
  - src/lib/assignment/__tests__/api-helpers.test.ts   (EDIT allowed —
                                            fingerprint 2 target)
  - Any new Vitest global-setup file you introduce under repo root
    (e.g. vitest.global-setup.ts)          (CREATE allowed if needed)

HARD INVARIANT on src/lib/env.ts
You may not weaken, re-order, or conditionalize the production
fail-fast behaviour documented in the file header. Specifically:
  - The server-side schema must still throw at module-load time when
    any required var is missing. Deployment safety depends on this.
  - You may not add a `NODE_ENV === 'test'` branch that skips the
    parse, downgrades errors to warnings, or relaxes required fields.
  - You may not remove the `throw new Error('Environment validation
    failed...')` line.
If a fix requires touching env.ts, STOP and surface it — the preferred
root cause of fingerprint 1 is loader timing in Vitest, not env.ts
itself. Acceptable surface in env.ts, if any at all, is limited to
restructuring how `rawEnv` is assembled so tests can pre-populate
process.env reliably — and only if vitest.setup / vitest.config /
globalSetup options exhaust first.

If any precondition below mismatches, STOP and report. Do not attempt
workarounds.

PRECONDITIONS (verify in order; stop at first failure)
1. On branch fix/kd-9-followup. Create it from main if it does not
   exist; do not dispatch on main.
2. `git status` is clean (no uncommitted changes).
3. .env.local exists in repo root and contains values for
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
   SUPABASE_SERVICE_ROLE_KEY that validate against the schemas in
   src/lib/env.ts (NEXT_PUBLIC_SUPABASE_URL must be a valid URL; the
   two keys must be non-empty strings). A non-empty-but-malformed URL
   still produces fingerprint 1. If any value is missing or invalid,
   STOP — this is a founder-logistics prerequisite, not a code fix.
4. Running `bun run test 2>&1 | tee /tmp/kd9fu-baseline.log` produces
   the expected baseline:
     - 875 passed, 1 failed, 9 skipped
     - 17 test files fail to load before any test in them executes
     - 16 of those 17 show fingerprint 1; 1 shows fingerprint 2
   Record the exact counts observed; cite them in your exit report.
   STOP and surface if any of these hold:
     - pass / skipped / file-load counts drift by more than ±2 on any
       single dimension, OR
     - failed count exceeds 1 (i.e. any new test-logic failure beyond
       the pre-fix single failure), OR
     - the fingerprint distribution across the 17 load errors does
       not match the 16 / 1 split.
   The world moved and this directive's assumptions need review.

DELIVERABLES
One commit (or a small commit series) on fix/kd-9-followup that:
  1. Clears fingerprint 1 by fixing Vitest env-loading timing so that
     `.env.local` values populate process.env BEFORE any test file's
     top-level import graph reaches src/lib/env.ts. The preferred
     mechanisms, in order:
       (i)   A `globalSetup` option in vitest.config.ts that loads
             envs before workers spawn.
       (ii)  Moving the `loadEnvConfig` call from vitest.setup.ts
             into vitest.config.ts top-level (side-effect of config
             module evaluation).
       (iii) Vitest's `test.env` config option with values pulled
             from .env.local at config evaluation time.
     Pick whichever cleanly clears the 16 file-load errors without
     violating the env.ts hard invariant. If more than one works,
     pick the one with the smallest surface and the least runtime
     cost; justify in your exit report.
  2. Clears fingerprint 2 by replacing the CJS `require(...)` on line
     200 of src/lib/assignment/__tests__/api-helpers.test.ts with a
     static import — either add `listAssignments` to the existing
     import block on line 20, or use a top-level `import { ... } from
     '@/lib/assignment/store'`. Do not use `await import()` at the
     call site; the test function is synchronous and the module is
     already statically imported. Note: this file is on the DELETE
     list per P4_UI_DEPRECATION_AUDIT.md §3.4 (tests tied to retiring
     UI/routes; §3.3 lists the parent support-lib directory), so this
     edit is deliberately minimal — do not refactor anything else in it.

ACCEPTANCE (every item must pass)
1. `bun run test 2>&1 | tee /tmp/kd9fu-post.log` reports zero file-
   load errors. Every test file successfully loads and executes its
   tests (each test inside may pass, fail, or skip on its own merits
   — only the load-time failure counts against this criterion).
2. No-regression gate: every test that passed pre-fix still passes
   post-fix. The absolute pass count SHOULD increase once the 16
   fingerprint-1 files and the 1 fingerprint-2 file begin executing
   — newly-loaded tests that pass are welcome and expected. Prove
   no-regression by test name, not by count delta: diff the sorted
   list of passing test IDs pre-fix vs. post-fix; the pre-fix set
   must be a subset of the post-fix set.
3. Failed count ≤ 1 pre-fix (unchanged) — or if you clear the 1
   pre-fix failure as a side effect of env fixes, note it in the exit
   report and explain why.
4. Skipped count = 9 (unchanged).
5. src/lib/env.ts production fail-fast behaviour preserved: the
   server-side schema still throws at module-load time when any
   required var is missing. Prove this statically per VERIFY step 3
   (quote the post-fix code paths + argue in prose); do NOT run a
   live-mutation check on .env.local.
6. No changes to test semantics: no `.skip()` / `.todo()` / `.only()`
   added or removed; no test assertions modified.
7. One-line PR-style note captured in the commit body citing the
   pre-fix and post-fix baseline counts, per plan §2.3 #2.
8. Newly-loaded tests that fail on their own logic (not on load) do
   NOT count as regressions against #2, but MUST be enumerated in the
   exit report under Open Items for founder review. Classify each as
   (a) pre-existing latent bug surfaced by loading, or (b) fresh break
   introduced by the env-loader mechanism chosen. Do not silently
   paper over them; do not auto-skip; do not fix them in this scope.

VERIFY (commands to run and cite output for, in the exit report)
  - `bun run test 2>&1 | tail -40` — post-fix summary
  - `diff <(grep -c '^FAIL ' /tmp/kd9fu-baseline.log)
          <(grep -c '^FAIL ' /tmp/kd9fu-post.log)` — delta-check
  - Static invariant proof (do NOT mutate .env.local): in the exit
    report, quote the post-fix src/lib/env.ts lines that (a) build
    `rawEnv`, (b) branch server vs client via `isServer`, and (c) call
    `envSchema.safeParse(rawEnv)` + `throw new Error('Environment
    validation failed...')`. Argue in prose that these lines still
    execute at module-load time on the server under NODE_ENV=production
    and would throw if any required var were undefined. Also quote any
    new code you added in vitest.config.ts / vitest.setup.ts /
    globalSetup, and argue it runs ONLY in the test harness (never
    under `bun run dev` or `bun run build`). This replaces the old
    live-mutation check — rationale: editing a local secrets file
    with a restore step is brittle and offers no stronger guarantee
    than reading the code does.

COMMIT
Single commit (or small commit series) with message starting:
  fix(test-env): KD-9 follow-up — clear 17 Vitest file-load errors

Body cites pre-fix baseline (875/1/9 + 17 file-load) and post-fix
baseline (e.g. 891/1/9 + 0 file-load — exact numbers from your run),
plus one sentence per fingerprint on the mechanism chosen. End with:

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. Founder reviews the exit report first.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:
  1. Preconditions check — #1–#4 with PASS/FAIL and a line each.
  2. Baseline observed — exact counts from /tmp/kd9fu-baseline.log.
  3. Fingerprint 1 mechanism — which of (i)/(ii)/(iii) (or other)
     you picked, and why.
  4. Fingerprint 2 mechanism — diff of the import block + call site.
  5. Files changed — list with line counts.
  6. Post-fix counts — exact, from /tmp/kd9fu-post.log.
  7. Invariant proof — the fail-fast check from VERIFY step 3.
  8. Acceptance checklist — criteria 1–8 with PASS/FAIL.
  9. Open items — anything flagged for founder review (e.g. an
     env-loader path you ruled out and why).
 10. Commit SHA(s).
 11. Suggested next action — "ready for P4 concern 1 dispatch" or
     "pause for founder review of X."
```

---

## B — What the directive governs

This directive hands one scoped fix to Claude Code: the 17 Vitest file-load errors. It clears the hard-blocker condition on `P4_IMPLEMENTATION_PLAN.md` §2.2 #7 and the soft-blocker condition on `P4_CONCERN_1_DIRECTIVE.md` §D #5. It does **not** hand the whole P4 cutover — that's gated behind the concern-1 through concern-5 directive series.

## C — What the directive does NOT govern

- The attested KD-9 main program (env-cache + fixture-drift families). That exit is anchored at commit `79df5cf` per `KD-9-audit.md` §F and is not reopened here.
- Any of the P4 concern directives (concerns 1–5). Separate artefacts.
- Deletion of `src/lib/assignment/__tests__/api-helpers.test.ts`. That happens in P4 concern 4 per `P4_UI_DEPRECATION_AUDIT.md` §3.4 (tests tied to retiring UI/routes; §3.3 covers the support-library directory itself). The fingerprint-2 fix here is deliberately throwaway — a minimal two-line edit to a file on the DELETE list, not a refactor.
- `.env.local` provisioning. Founder logistics.
- Merge of `fix/kd-9-followup` to `main`. Founder reviews the exit report; merge is a follow-up action, not part of this directive.

## D — Dispatch readiness checklist

This directive does **not** ship to Claude Code until all of the following are ✓:

| # | Gate | State | Blocker? |
|---|---|---|---|
| 1 | This directive reviewed by founder before dispatch | ✗ — pending | Yes |
| 2 | Branch `fix/kd-9-followup` created off `main` | ✗ — not created | Yes |
| 3 | `.env.local` contains non-empty required Supabase keys | unknown — founder logistics | Yes |
| 4 | Pre-fix baseline matches REMEDIATION_PLAN §F (875/1/9 + 17 file-load) within ±2 on each dimension | unknown — verify at precondition check | No (handled inside the directive) |

## E — Proposed dispatch sequence

1. Founder commits this directive (`docs/audits/KD_9_FIX_DIRECTIVE.md`) to `main`.
2. Founder creates `fix/kd-9-followup` off that commit.
3. Founder confirms `.env.local` has the three required keys.
4. Founder reviews the §A body one last time.
5. Founder dispatches the §A body to Claude Code in a fresh session, on branch `fix/kd-9-followup`.
6. Claude Code produces the exit report and a commit.
7. Founder reviews the exit report; approves or requests revisions.
8. On approval, founder merges `fix/kd-9-followup` into `main`.
9. `P4_IMPLEMENTATION_PLAN.md` §2.2 #7 and §2.2 #8 flip from ✗ to ✓. Concern-1 dispatch §D #5 flips from ✗ to ✓ (residual: §D #1–#3, #7 still blocking per the concern-1 directive).

## F — Notes for reviewer

**Why fingerprint 2 is a two-line edit, not a refactor.** `src/lib/assignment/__tests__/api-helpers.test.ts` is on the DELETE list per `P4_UI_DEPRECATION_AUDIT.md` §3.4 (tests tied to retiring UI/routes — the whole `src/lib/assignment/__tests__/` directory retires with the Assignment Engine under P4 concern 4; §3.3 covers the parent support-library directory `src/lib/assignment/` itself). Fixing the CJS require cleanly clears the file-load error without investing in code that's scheduled for deletion within weeks. An alternative — adding a Vitest exclude pattern in `vitest.config.ts` for that file — was rejected because it requires a matching cleanup in concern 4 and introduces a config entry that drifts from state if concern 4 slips.

**Why the fingerprint-1 preferred mechanism is `globalSetup`, not `setupFiles`.** `setupFiles` in Vitest 4 runs per-worker and is not guaranteed to execute before a test file's hoisted top-level ESM imports. `globalSetup` runs in the main process before worker spawn — strictly ordered. If the fix resolves cleanly via `setupFiles` in the current Vitest 4 minor, that's acceptable; if not, `globalSetup` is the structural fix. Moving the `loadEnvConfig` call into `vitest.config.ts` top-level (option ii) also works because config module evaluation is strictly synchronous and predates any worker dispatch — and it's the smallest change. Claude Code picks; this directive does not prescribe.

**Why the env.ts hard invariant.** Production misconfiguration safety depends on the server-side schema throwing at import time. The temptation under `NODE_ENV === 'test'` is to downgrade to a warning — that would silently survive a future deploy where the same module is imported under `NODE_ENV=production` with a broken env, because the fail-fast path was conditionalized on `NODE_ENV` and someone removed the conditional. The invariant here says: don't open that door. Fix the loader, not the gate.

---

## G — Revision history

- **2026-04-20 — Draft 1.** Initial directive drafted under P4 plan §13.3 template. Scope: the 17 Vitest file-load errors documented in REMEDIATION_PLAN §F. Not yet dispatched; dispatch blocked by §D items 1–3. Related commit series: `e7e2f9f` (P4 plan + concern-1 directive + UI audit + spec rev-6 header bump). Anchored to KD-9-audit.md §F attestation at `79df5cf` (not reopened). Committed at `4366852`.
- **2026-04-20 — Draft 2.** Pre-dispatch red-team corrections applied. Ten edits, no scope change:
  - **M1 — PRECONDITIONS #3.** Tightened .env.local requirement from "non-empty values" to "values that validate against src/lib/env.ts schemas" (URL validity for `NEXT_PUBLIC_SUPABASE_URL`; non-empty strings for the two keys). Malformed-but-present values also trip fingerprint 1.
  - **M2 — ACCEPTANCE #2.** Reframed the no-regression gate. Pre-fix pass count was 875 because 17 files failed to load; post-fix the pass count SHOULD increase once those files execute. The gate is no-regression by test name (pre-fix passing set must be a subset of post-fix passing set), not a fixed count.
  - **M3 — ACCEPTANCE #8 (new).** Newly-loaded tests that fail on their own logic (not on load) are classified as Open Items for founder review. Does not count as regression; must not be silently skipped or fixed in this scope. Pre-empts the silent-gap risk where fingerprint-1 resolution surfaces latent bugs.
  - **M4 — VERIFY step 3.** Replaced the live `.env.local` mutate-and-restore check with a static proof: quote the post-fix env.ts + test-harness code paths in the exit report, argue invariant preservation in prose. Rationale: the live mutation offered no stronger guarantee than reading the code does, and carried non-trivial restore-failure risk on a local secrets file. Downstream update to ACCEPTANCE #5 so it cites VERIFY step 3 rather than a dev-run.
  - **m1 — PRECONDITIONS #4.** Tolerance clause tightened: ±2 on any single dimension OR failed count > 1 OR fingerprint split drift all trigger STOP. Prior wording only called out ±2.
  - **m2 — ACCEPTANCE #7.** Citation fix: PR-note discipline is plan §2.3 #2, not §2.2 #8 (§2.2 #8 is the acceptance condition itself, not the PR-note rule).
  - **m3 — §C and §F cross-refs.** Both corrected from `P4_UI_DEPRECATION_AUDIT.md` §3.3 to §3.4. §3.3 covers the support-library directory (`src/lib/assignment/`); §3.4 covers the tests tied to retiring UI/routes (`src/lib/assignment/__tests__/`, including the fingerprint-2 file). Cross-reference list at the top of the directive updated to name both sections explicitly.
  - **a1 — READ FIRST.** Added an AGENTS.md + `node_modules/next/dist/docs/` read-first pointer at the top of the §A body. Claude Code's training data pre-dates Next 16.2.2 + Vitest 4.1.2 + rolldown; reading these before coding is a repo-wide invariant per AGENTS.md and should not be assumed.
  - **Housekeeping — EXIT REPORT §8.** Range updated from "criteria 1–7" to "criteria 1–8" to match the new acceptance clause.
  - Not yet dispatched; §D gates 1–3 still pending. Committed at `22b515e`.
- **2026-04-20 — Draft 3.** Founder-approved sweep of the two out-of-scope drift items flagged in Draft 2. Two edits, no scope or semantic change — citation precision only:
  - **s1 — §E step 9 typo.** `§2.3 #8` → `§2.2 #8`. §2.3 #2 remains the PR-note discipline cited in ACCEPTANCE #7; §2.2 #8 is the acceptance condition that flips on this fix.
  - **s2 — §A DELIVERABLES #2 precision.** `P4_UI_DEPRECATION_AUDIT.md §3.3` → `§3.4 (tests tied to retiring UI/routes; §3.3 lists the parent support-lib directory)`. Brings the dispatched body in line with §C and §F (both corrected in Draft 2 / m3). §3.3 was not strictly wrong — the parent directory listing implied the subtree — but §3.4 is the precise cite for the specific test file.
  - Directive now fully citation-consistent across §A / §C / §E / §F / top cross-reference list. No further red-team sweeps planned pre-dispatch.
  - Not yet dispatched; §D gates 1–3 still pending.

---

_End of KD-9 follow-up fix directive._
