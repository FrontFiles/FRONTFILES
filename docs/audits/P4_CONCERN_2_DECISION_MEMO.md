# P4 Concern 2 — Decision Memo

**Status.** Closed. Committed on `feat/p4-economic-cutover` at `17ec6f0`.
**Supersedes.** `P4_CONCERN_2_DIRECTIVE.md` (pre-draft, obsolete — see §Cleanup).
**Consumes.** `P4_CONCERN_2_PRE_DRAFT_INPUTS.md` (pre-draft scratchpad; retain for audit trail).

---

## What this closes

Post-KD-9 the Vitest suite reported `Tests 18 failed | 1055 passed | 9 skipped`. The 18 failures clustered in two files:

- `src/lib/providers/__tests__/service.test.ts` — 17 failures.
- `src/lib/db/__tests__/rls.test.ts` — 1 failure (the suite-level `describe` block).

Root cause was pure routing, not schema or fixture. KD-9 hydrated `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into worker `process.env` via `vitest.config.ts` `test.env` forwarding. `src/lib/providers/store.ts` `getMode()` read those keys and flipped to `'real'`, sending every service call to an unreachable Supabase URL. `rls.test.ts` had a self-gate on the same keys and flipped from self-skip to execute-and-fail for the same reason.

Post-fix suite: **1072 passed | 9 skipped | 0 failed** in 2.58s.

---

## Decision

**Path 3 from pre-draft inputs: flag-based opt-in via `FF_INTEGRATION_TESTS=1`.**

Under Vitest (`NODE_ENV === 'test'`), `getMode()` returns `'mock'` unless `FF_INTEGRATION_TESTS=1` is set. `rls.test.ts` gates its `describe`/`describe.skip` on the same flag.

This **decouples the providers mode decision from Supabase key presence**. The keys must remain present in worker `process.env` — `src/lib/env.ts:40-49` Zod-parses them at module load and crashes without them — but their presence alone no longer opts every Vitest run into live-Supabase routing.

Outside Vitest the flag has no effect: production and dev servers set `NODE_ENV` to `production` or `development`, never `test`, so the branch is unreachable and mode derivation matches pre-concern-2 behaviour byte-for-byte.

---

## Why Path 3

The five paths from `P4_CONCERN_2_PRE_DRAFT_INPUTS.md` §1 evaluated as follows:

| Path | Approach | Rejected because |
|------|----------|------------------|
| 1 | Filter Supabase keys from `test.env` forwarding | Insufficient — Vitest 4 / rolldown workers inherit parent `process.env`. Filtering `test.env` alone changed zero failure counts (tried, 18 remained). |
| 2 | Delete keys from parent `process.env` in `vitest.config.ts` | Catastrophic — breaks `src/lib/env.ts:40-49` Zod parse at module load. Tried and broke 16 test files (1054 → 876 passing). Reverted. |
| 3 | `FF_INTEGRATION_TESTS` flag in `getMode()` + `rls.test.ts` gate | **Chosen.** Keeps env.ts contract intact; mode decision is explicit; no production-code cost. |
| 4 | Preflight ping in `beforeAll` with skip-on-unreachable | Hides real CI breakage behind a network condition. Rejected for concern 2. |
| 5 | Standardise on `supabase start` local dev | Requires Docker + Supabase CLI in every contributor loop and CI runner. Over-scoped for concern 2; deferred as a possible future CI upgrade. |

Path 3 was the pre-draft's provisional recommendation for `service.test.ts`. We extended it to `rls.test.ts` as well (pre-draft recommended Path 4 there; we preferred flag-consistency over preflight ceremony since RLS tests and service tests share the same integration-mode semantics).

---

## Files changed

- **`src/lib/providers/store.ts`** — `getMode()` gains a 5-line test-harness escape. Comment block rewritten to document the decoupling.
- **`src/lib/db/__tests__/rls.test.ts`** — `envPresent` gate extended with `integrationMode` flag; suite self-skips unless opted in.
- **`src/lib/providers/__tests__/service.test.ts`** — header rewritten to describe the new routing contract; one regex at L137 widened to accept both real-mode (`duplicate key` from Postgres 23505) and mock-mode (`active connection already exists`) uniqueness-violation messages. Test bodies otherwise untouched.

No changes to `vitest.config.ts` — KD-9's env-hydration shape is preserved unchanged.

---

## How to run

- **Default (mock mode):** `bun run test` — mock-routes providers; `rls.test.ts` self-skips.
- **Integration mode:** `FF_INTEGRATION_TESTS=1 bun run test` — routes providers through live Supabase; runs `rls.test.ts` against real Postgres. Requires a reachable Supabase instance matching the keys in `.env.local`.

Until P5 stands up a CI-reachable Supabase with post-P4 schema, integration mode is a manual local-loop tool — not yet wired into CI.

---

## What concerns 3/4/5 still need

- **Concern 3 (app-side).** Thread P4 economic schema renames through API routes, services, and server actions. Unblocked by this commit.
- **Concern 4 (UI).** Consumer-side copy and label updates for the renamed fields/surfaces. Depends on concern 3.
- **Concern 5 (cleanup).** Remove deprecated aliases, legacy column shims, and any transitional compatibility code introduced across concerns 1–4.
- **P5 (merge).** Landing `feat/p4-economic-cutover` to main. Integration-mode wiring in CI is a P5-or-later decision.

---

## Cleanup

- `docs/audits/P4_CONCERN_2_DIRECTIVE.md` is **obsolete**. It was a heavyweight dispatch directive drafted early in the session and abandoned when the fix turned out to be a 30-line edit that didn't need a dispatched subagent. Delete it; this memo replaces it.
- `docs/audits/P4_CONCERN_2_PRE_DRAFT_INPUTS.md` is **retained** as the audit trail for path selection.

---

_End of P4 Concern 2 decision memo._
