# P4 Concern 3 — Claude Code Directive

**Status.** Drafted 2026-04-21 under `P4_IMPLEMENTATION_PLAN.md` §13.3 template. **Not yet dispatched.** Dispatch readiness in §D.

**Governs.** A single execution session with Claude Code. One concern, one exit report. Derived from `docs/audits/P4_IMPLEMENTATION_PLAN.md` §6.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` §7, §8, §8.4, §14.1; `docs/audits/P4_IMPLEMENTATION_PLAN.md` §6 (concern 3 body), §7 (concern 4 — the consumer of this directive's output), §10 (risk register R3); `docs/audits/P4_CONCERN_1_DIRECTIVE.md` §C ("Concern 3 — separate directive; can run in parallel with concerns 1–2"); `docs/audits/P4_UI_DEPRECATION_AUDIT.md` §2 (the 13 retiring routes whose replacements concern 3 plumbs the gate for); `docs/audits/P4_CONCERN_2_DECISION_MEMO.md` (FF_INTEGRATION_TESTS pattern that concern 3's flag mirrors at the request layer).

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 3 — AUTH_WIRED plumbing

SCOPE
You are implementing concern 3 of the P4 cutover for Frontfiles per
docs/audits/P4_IMPLEMENTATION_PLAN.md §6. Goal: deliver per-environment
infrastructure that gates the spec-canonical request surface (actor
resolution + retiring-route replacements) behind a single boolean flag
defaulting false in deploy 1 and flipped true at P5. Specifically:
  (a) parse FFF_AUTH_WIRED in the env schema;
  (b) ship a `requireActor(req)` helper that resolves the request's
      actor against `actor_handles` (§8.4) when the flag is on and
      fails closed when the flag is off;
  (c) ship an `isAuthWired()` flag accessor matching the existing
      `isFffSharingEnabled()` pattern;
  (d) wire FFF_AUTH_WIRED=true into the Vitest worker env so concern
      4's replacement routes (when they land) see the live-path by
      default in test mode; offer a both-state coverage idiom that
      concern 4 + future routes can copy.
This concern ships ZERO route handlers. It is plumbing only. Concern
4 is the first consumer.

GATE
Do not open, read, or modify any file outside the paths listed in
§DELIVERABLES below. You may read any spec or audit doc for context;
do not modify specs or audits. Do not touch the 13 retiring API route
files (src/app/api/special-offer/**/* and src/app/api/assignment/**/*)
— those retire under concern 4, not here.

If any precondition below mismatches, STOP and report. Do not attempt
workarounds.

PRECONDITIONS (verify in order; stop at first failure)
1. On branch feat/p4-economic-cutover. If not, stop.
2. `git status` is clean (no uncommitted changes).
3. HEAD is at or descended from commit 63fce73 (P4 concerns 1 + 2
   landed). Cite the actual HEAD SHA in your exit report.
4. `bun run test` reports `0 failed | 1072 passed | 9 skipped` (or the
   same shape with concern-1 schema-derived counts; the invariant is
   ZERO failures and ZERO file-load errors). If non-zero failures,
   stop — concern 3 must land on a green tree.
5. docs/audits/P4_IMPLEMENTATION_PLAN.md §6 exists and is committed.
6. docs/audits/P4_UI_DEPRECATION_AUDIT.md §2 enumerates the 13 retiring
   routes — used as the concern-4 consumer reference, no edits here.
7. src/lib/env.ts contains the existing `flags` object pattern at
   approximately lines 262–272 (a getter-per-flag idiom reading live
   process.env). If the shape has shifted, surface and stop — your
   `flags.authWired` getter must match the surrounding idiom.
8. src/lib/flags.ts contains `isFffSharingEnabled()` as the existing
   per-route guard precedent. Confirm before adding `isAuthWired()`
   alongside.

DELIVERABLES (four files; one is an EDIT, three are NEW)
File list, in the order you should produce them:
  1. EDIT  src/lib/env.ts
  2. EDIT  src/lib/flags.ts
  3. NEW   src/lib/auth/require-actor.ts
  4. NEW   src/lib/auth/__tests__/require-actor.test.ts
  5. EDIT  vitest.config.ts

Per-file requirements:

(1) src/lib/env.ts
  - Add to the `envSchema` server-only section:
      FFF_AUTH_WIRED: z
        .enum(['true', 'false'])
        .default('false')
        .describe('Gates the spec-canonical request surface (requireActor + the 13 retiring routes\' replacements). Default false in deploy 1; flipped true at P5.')
  - Add to the `rawEnv` server-only section:
      FFF_AUTH_WIRED: process.env.FFF_AUTH_WIRED,
  - Add a getter to `flags`, matching the surrounding idiom:
      get authWired(): boolean {
        return process.env.FFF_AUTH_WIRED === 'true'
      },
  - Do NOT add FFF_AUTH_WIRED to `clientSchema` — this is a server-only
    flag; it must never reach the client bundle. Read the comment block
    at L132–147 before editing if you are unsure.
  - Do NOT add a NEXT_PUBLIC_ variant. There is no client surface for
    the gate — the spec-canonical UI lives behind FFF_ECONOMIC_V1_UI
    (concern 4), which is a separate flag.

(2) src/lib/flags.ts
  - Add an `isAuthWired()` accessor below the existing
    `isRealUploadEnabled()`. Match its docblock + body shape:
      /**
       * AUTH_WIRED — spec-canonical request-surface gate.
       *
       * When false (the default in deploy 1), every spec-canonical
       * route handler that is the replacement for one of the 13
       * retiring routes (per P4_UI_DEPRECATION_AUDIT.md §2) returns
       * `FEATURE_DISABLED` 404. When true (P5 cutover), the live
       * `requireActor()` resolution and route bodies execute.
       *
       * Server-only flag. Read at the top of each spec-canonical
       * route handler via the FFF Sharing pattern:
       *
       *   if (!isAuthWired()) {
       *     return errorResponse('FEATURE_DISABLED', 'Auth not wired.', 404)
       *   }
       *
       * Concern 3 ships the helper. Concern 4 wires it into each
       * replacement route handler.
       */
      export function isAuthWired(): boolean {
        return flags.authWired
      }

(3) src/lib/auth/require-actor.ts
  - Server-only module. Begin with `'use server'` directive — match
    the convention at src/lib/auth/provider.ts L1.
  - Export a single function:
      export async function requireActor(
        req: Request,
      ): Promise<RequireActorResult>
  - Discriminated-union return shape:
      type RequireActorResult =
        | { ok: true; actor: Actor }
        | { ok: false; reason: 'FEATURE_DISABLED' | 'UNAUTHENTICATED' | 'ACTOR_NOT_FOUND' }

      type Actor = {
        handle: string       // uuid — actor_handles.handle (§8.4)
        authUserId: string   // uuid — actor_handles.auth_user_id (§8.4)
      }
  - Behaviour:
      a. If `isAuthWired()` is false → return
         `{ ok: false, reason: 'FEATURE_DISABLED' }`. Fail-closed.
      b. If flag is true: resolve auth.uid() from the Supabase session
         on the request. If absent → return
         `{ ok: false, reason: 'UNAUTHENTICATED' }`.
      c. Look up the actor_handles row where auth_user_id = auth.uid()
         AND tombstoned_at IS NULL. If none → return
         `{ ok: false, reason: 'ACTOR_NOT_FOUND' }`.
      d. On hit → return `{ ok: true, actor: { handle, authUserId } }`.
  - Use the existing Supabase server-client factory (look up the
    canonical import path before writing — DO NOT invent a new client
    helper). The provider pattern in src/lib/auth/provider.ts is a
    reference for how server-only modules talk to Supabase admin /
    service-role clients.
  - Header docblock must cite:
      - ECONOMIC_FLOW_v1 §8.4 (actor_handles shape and tombstone semantics)
      - docs/audits/P4_IMPLEMENTATION_PLAN.md §6.2 (this directive's
        source-of-truth row in the concern-3 file table)
      - docs/audits/P4_CONCERN_3_DIRECTIVE.md (this file)
  - Do NOT export `Actor` from anywhere except this module — concern 4
    will import it from here. Single source of truth for the spec-
    canonical actor shape.
  - The system-actor sentinel UUID (seeded by M5 at
    supabase/migrations/20260421000005_seed_system_actor.sql) MUST
    NOT be returned by `requireActor`. The §8.4 last-line invariant
    "never exposed to clients" is satisfied trivially here because
    the sentinel row has auth_user_id = NULL, so the lookup at step
    (c) cannot match it for any real auth.uid(). Add an inline
    comment citing this so the next reader doesn't add a redundant
    explicit guard.

(4) src/lib/auth/__tests__/require-actor.test.ts
  - Use the dual-mode pattern from src/lib/providers/__tests__/service.test.ts
    (concern 2 memo): mock-mode by default; integration mode opt-in
    via FF_INTEGRATION_TESTS=1. Mock mode covers all four behaviour
    branches via stubbed Supabase client; integration mode (when run
    against a reachable dev DB) verifies the real auth.uid() →
    actor_handles lookup.
  - Both flag states MUST be covered. Use Vitest's vi.stubEnv:
      // Off path
      vi.stubEnv('FFF_AUTH_WIRED', 'false')
      const r = await requireActor(req)
      expect(r).toEqual({ ok: false, reason: 'FEATURE_DISABLED' })
      vi.unstubAllEnvs()

      // On path
      vi.stubEnv('FFF_AUTH_WIRED', 'true')
      // ...
  - vi.stubEnv works because flags.authWired reads live process.env
    on every access (CCP Pattern-a Option 2b — the same idiom that
    backs flags.fffSharing and flags.realUpload). Confirm liveness
    by reading the env.ts comment at L256–261 before writing tests.
  - Minimum four cases:
      1. Flag off → FEATURE_DISABLED.
      2. Flag on + no session → UNAUTHENTICATED.
      3. Flag on + session present + no actor_handles row → ACTOR_NOT_FOUND.
      4. Flag on + session present + actor_handles row present → ok=true,
         actor shape matches `{ handle, authUserId }`.

(5) vitest.config.ts
  - Add `FFF_AUTH_WIRED: 'true'` to the existing `test.env` forwarding
    block. Rationale: when concern 4 lands the spec-canonical replacement
    route handlers (each beginning with `if (!isAuthWired()) return ...`),
    the default test-suite run must exercise the live path so the new
    routes get real coverage. Tests that need the off path stub the env
    explicitly per (4) above.
  - Do NOT change the FF_INTEGRATION_TESTS handling from concern 2.
    AUTH_WIRED is orthogonal to integration-vs-mock routing in
    src/lib/providers/store.ts; both gates coexist.
  - If vitest.config.ts has shifted shape since concern 2, follow the
    surrounding idiom and surface the diff in your exit report.

DECISIONS RESOLVED (do not re-litigate during execution)

D1. Plan §6.2 names `src/middleware.ts or equivalent` for the gate.
    No middleware.ts exists today. The "or equivalent" is the
    per-route guard pattern already used by
    src/app/api/posts/**/*.ts (`if (!isFffSharingEnabled()) return
    errorResponse('FEATURE_DISABLED', '...', 404)`). This directive
    chooses the per-route guard. No new middleware file is created.
    Concern 4's directive will instruct each replacement route handler
    to call `isAuthWired()` at the top.

D2. Plan §6.2 names `.env.test` for FFF_AUTH_WIRED=true. No .env.test
    file exists today; Vitest env hydration goes through
    vitest.config.ts `test.env` forwarding (concern 2 memo). This
    directive uses the existing forwarding mechanism — see (5)
    above — rather than introducing a new dotfile. Same outcome,
    one less moving part.

D3. Plan §6.2 names `.env.example` for documenting FFF_AUTH_WIRED. No
    .env.example exists today. The Zod schema in src/lib/env.ts is
    the single source of truth (with `.describe()` strings on every
    flag — see existing entries L60–73). This directive documents
    FFF_AUTH_WIRED via the `.describe()` string in (1), not via a new
    .env.example file. If the founder later wants .env.example as a
    contributor onboarding aid, it is a separate housekeeping commit
    covering all 30+ env vars — out of scope here.

D4. Plan §6.5 AC #2 reads "Middleware returns FEATURE_DISABLED on
    retiring-route replacements when flag is false." The replacement
    routes do not exist in concern 3 — they are concern 4 deliverables.
    This directive narrows AC #2 to the unit-level assertion on
    `requireActor` (case 1 in (4) above). The integration-level
    assertion ("a real spec-canonical route returns FEATURE_DISABLED
    when flag off") moves to concern 4's acceptance criteria, where
    the routes actually exist. Recorded in the AC list below.

BANNED TERMS
Per ECONOMIC_FLOW_v1 §9 and project conventions, the following terms
are banned in new code and new comments: certified, certification,
tamper-proof, immutable. Acceptable terms: verifiable, tamper-evident,
provenance-aware, independently reviewable.

No expected occurrences in concern 3 — the surface is auth + flag
plumbing, far from the rename family. Run
`rg -n 'certif|immutab|tamper.proof' src/lib/env.ts src/lib/flags.ts src/lib/auth/require-actor.ts src/lib/auth/__tests__/require-actor.test.ts vitest.config.ts`
and confirm zero matches.

ACCEPTANCE CRITERIA (all must hold)
1. `FFF_AUTH_WIRED` parsed in src/lib/env.ts with default 'false';
   invalid values throw at module load (Zod enum enforces this
   automatically).
2. `requireActor()` returns `{ ok: false, reason: 'FEATURE_DISABLED' }`
   when `isAuthWired()` is false. Verified by unit test case 1.
   (Plan §6.5 AC #2 narrowed per D4 above; integration assertion
   deferred to concern 4.)
3. P5 hard-cut requires only setting `FFF_AUTH_WIRED=true` in
   `.env.production` — no source-code change. Verified by
   `rg -n 'FFF_AUTH_WIRED' src/` returning matches ONLY in
   src/lib/env.ts (parse + flags getter). Every other consumer
   reads through `isAuthWired()` or `flags.authWired`.
4. Both-state test coverage in CI: cases 1 and 2-4 in (4) above
   collectively cover both flag states.
5. `bun run test` reports zero failures, zero file-load errors.
   Concern-2 baseline (1072 passed | 9 skipped) plus the new test
   file's cases. Cite the exact post-fix counts in your exit report.
6. `bun run typecheck` (or the equivalent `tsc --noEmit` invocation
   per AGENTS.md) passes with zero errors.
7. `requireActor` is the SOLE export of src/lib/auth/require-actor.ts
   — the `Actor` and `RequireActorResult` types are exported so
   concern 4's route handlers can consume them, but nothing else.
   No re-exports from other auth modules.
8. No edits outside the five files in §DELIVERABLES. `git diff --name-only`
   returns exactly those five paths.
9. `'use server'` directive present at the top of require-actor.ts
   (matches src/lib/auth/provider.ts convention).
10. Banned-term lint returns zero matches across the five touched
    files.

VERIFY COMMANDS
Run all of these and include output in your exit report:
  - `git status`
  - `git diff --name-only` (must list exactly the 5 files in §DELIVERABLES)
  - `rg -n 'certif|immutab|tamper.proof' src/lib/env.ts src/lib/flags.ts src/lib/auth/require-actor.ts src/lib/auth/__tests__/require-actor.test.ts vitest.config.ts`
  - `rg -n 'FFF_AUTH_WIRED' src/`  (expected: only env.ts matches; the test file accesses via vi.stubEnv string literal which also matches — that is fine and expected)
  - `bun run test 2>&1 | tail -20`
  - `bun run typecheck 2>&1 | tail -20`  (or equivalent per AGENTS.md)

COMMIT
A single concern-scoped commit. Commit message template:

  feat(auth): P4 concern 3 — AUTH_WIRED plumbing

  Implements docs/audits/P4_IMPLEMENTATION_PLAN.md §6:
  - Adds FFF_AUTH_WIRED to env schema (default false)
  - Adds isAuthWired() accessor (mirrors isFffSharingEnabled)
  - Adds requireActor(req) — fail-closed when flag off; resolves
    actor_handles row when flag on
  - Wires FFF_AUTH_WIRED=true into Vitest test.env so concern 4
    replacement routes see live path by default
  - Both-state unit coverage via vi.stubEnv

  Directive: docs/audits/P4_CONCERN_3_DIRECTIVE.md
  Plan: docs/audits/P4_IMPLEMENTATION_PLAN.md §6
  Spec: docs/specs/ECONOMIC_FLOW_v1.md §8.4

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1–5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:
  1. Preconditions check — each of #1–#8 with PASS/FAIL and a line
     explaining why.
  2. File list — every file you created or edited, with line counts
     (or +/- diff stats for edits).
  3. Decisions log — confirm D1–D4 from §A above were honored as
     written, OR cite where you deviated and why.
  4. Banned-term lint — full output of the rg command.
  5. Acceptance checklist — each of criteria 1–10 with PASS/FAIL.
  6. Test-run output — tail of `bun run test`.
  7. Typecheck output — tail of `bun run typecheck` (or equivalent).
  8. Open items — anything you spotted that warrants founder review
     before concern 4 begins (e.g., Supabase server-client factory
     turned out to have a different shape than provider.ts; auth.uid()
     resolution requires a different request-shape than the discriminated
     union assumes; spec/plan conflict you couldn't resolve in-line).
  9. Commit SHA.
  10. Suggested next directive — "proceed to concern 4" or "pause for
      founder review of X."
```

---

## B — What the directive governs

This directive hands one concern to Claude Code. After concern 3's exit report is reviewed under §13.2 gate-per-concern discipline, a separate directive for concern 4 follows. The five concerns + two gates shape is in the plan.

Concern 3 is **plumbing-only**. It ships:
- one env-schema row,
- one flag accessor,
- one server-only auth helper with both-state unit tests,
- one Vitest config edit.

Total surface: ~5 files, ~150 lines of new code + tests. The 2–3 day estimate in plan §6.6 is the founder-review-and-revise-and-redispatch loop, not the keystroke count.

## C — What the directive does NOT govern

- **Concern 4 (UI cutover).** Wires `isAuthWired()` into each spec-canonical replacement route handler at the top, with the `errorResponse('FEATURE_DISABLED', '...', 404)` body. Also lands the replacement routes themselves and the UI cutover. Separate directive; depends on concerns 1 + 3 both landed; scoped against `P4_UI_DEPRECATION_AUDIT.md`.
- **Concern 5 (legacy doc retirement).** Separate directive; post-concern-4.
- **Building any spec-canonical route handler.** Out of scope. Concern 3 is the helper, not the consumers.
- **Touching the 13 retiring route files.** They retire under concern 4 (deletion); concern 3 must not edit them — they are the source of the gate, not the gate itself.
- **Creating `.env.example` or `.env.test` as new files.** Resolved against in D2 + D3 of §A.
- **Creating `src/middleware.ts`.** Resolved against in D1 of §A.
- **Adding a NEXT_PUBLIC_ variant of the flag.** The UI gate is the separate `FFF_ECONOMIC_V1_UI` flag (concern 4 owns it); FFF_AUTH_WIRED is server-only.
- **Merge to `main`.** Explicitly forbidden at concern 3. Merge is a P5 event.
- **Flipping `FFF_AUTH_WIRED=true` in `.env.production`.** That is a P5 deploy-engineering action, not a code change.

## D — Dispatch readiness checklist

This directive does **not** ship to Claude Code until all of the following are ✓:

| # | Gate | State | Blocker? |
|---|---|---|---|
| 1 | P4 plan + UI audit + concern 1 directive committed | ✓ — landed on `feat/p4-economic-cutover` | No |
| 2 | Concern 1 (M1–M5) landed and accepted | ✓ — commit `9ba00e4` | No |
| 3 | Concern 2 (Tests) landed and accepted | ✓ — commits `17ec6f0` + `c0224ca` + `63fce73`; suite reports `1072 passed | 9 skipped | 0 failed` | No |
| 4 | Founder reviews this directive before dispatch | pending | Yes |
| 5 | Working tree clean immediately before dispatch | founder runs `git status` immediately before pasting §A | Yes (procedural) |

Note: per `P4_CONCERN_1_DIRECTIVE.md` §C and plan §6, concern 3 is logically independent of concerns 1 and 2 — it could have been dispatched in parallel. In practice it landed after to keep the dispatch queue serial, which loses no time given the 2–3 day estimate. The gate-3 row above confirms concerns 1 + 2 landed on the same branch, so concern 3 starts from the integrated state, not from a parallel branch needing rebase.

---

## E — Proposed dispatch sequence

1. ✓ Concern 1 landed at `9ba00e4`.
2. ✓ Concern 2 landed at `17ec6f0` (decision memo finalized at `63fce73`).
3. Founder reviews this directive (§A body).
4. Founder confirms working tree is clean: `git status` returns nothing.
5. Founder dispatches the §A body to Claude Code in a fresh session, on branch `feat/p4-economic-cutover`.
6. Claude Code produces exit report.
7. Founder reviews exit report; approves or requests revisions.
8. On approval, draft `P4_CONCERN_4_DIRECTIVE.md` against `P4_UI_DEPRECATION_AUDIT.md` §6 acceptance criteria.

---

## F — Revision history

- **2026-04-21 — Draft 1.** Initial directive drafted per plan §13.3 template after concerns 1 + 2 landed. Red-team pass against plan §6 surfaced four ambiguities resolved inline in §A as decisions D1–D4: middleware vs per-route guard (resolved → per-route, matching FFF Sharing precedent); .env.test absence (resolved → use existing `vitest.config.ts` `test.env` forwarding instead); .env.example absence (resolved → defer; Zod schema is source of truth); AC #2 integration assertion (resolved → narrowed to unit-level here, integration assertion moves to concern 4 acceptance). Concern 3 surface confirmed as ~5 files / ~150 lines — proportional to plan §6.6's 2–3 day estimate, which is dominated by the founder-review loop, not keystrokes.

---

_End of P4 concern 3 directive._
