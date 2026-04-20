# P4 Concern 2 — Pre-Draft Inputs

**Purpose.** Capture concerns surfaced during execution of `KD_9_FIX_DIRECTIVE.md` §A that belong under the not-yet-drafted **P4 Concern 2 (Tests)** directive of `P4_IMPLEMENTATION_PLAN.md`. This file is an inputs scratchpad for that directive — not the directive itself, not a remediation plan, not a green-light gate. Each entry follows the `P4_PREREQUISITES.md` template: Current state / Risk / Action / Owner.

**Provenance.** Surfaced 2026-04-20 by the post-fix test sweep at `/tmp/kd9fu-post.log` after KD-9 §A landed on `fix/kd-9-followup` (commits `4336844` main fix, `bc5343c` cleanup). Pre-fix baseline at `/tmp/kd9fu-baseline.log`.

---

## 1. Supabase-dependent test failures from mock-vs-live gate flip

**Current state.** Post-KD-9 the suite reports `Test Files 2 failed | 45 passed (47)` and `Tests 18 failed | 1055 passed | 9 skipped (1082)`. The 18 failures concentrate in two files:

- `src/lib/db/__tests__/rls.test.ts` — 1 failure, the suite-level `RLS — anon vs service_role` describe block. This file gates itself at L40–41 with `const envPresent = Boolean(url && anonKey && serviceKey); const d = envPresent ? describe : describe.skip`. Pre-KD-9 the env vars were not loading into the worker process, so `envPresent` was `false` and the suite registered as `1 skipped`. Post-KD-9 the env hydrates into worker `process.env` via `vitest.config.ts` `test.env` forwarding, `envPresent` flips to `true`, the suite executes, and the seed insert against the configured Supabase URL fails because the sandbox cannot reach it.
- `src/lib/providers/__tests__/service.test.ts` — 17 failures across `createConnection`, `revokeConnection`, `findActiveConnection`, `setConnectionStatus`, `recordWebhookEvent`, and `verifyAndIngestWebhook` describe blocks. The mode selector at `src/lib/providers/store.ts:34` is `function getMode() { return isSupabaseEnvPresent() ? 'real' : 'mock' }`. Pre-KD-9 the file was in the 17 file-load-error set (Fingerprint 1 — `loadEnvConfig` short-circuited under `NODE_ENV=test`, Zod parse threw at module load, file ran zero tests). Post-KD-9 the file loads cleanly, env is present, `getMode()` returns `'real'`, every service call routes through the live Supabase client, and the inserts fail with `INSERT_FAILED` because the sandbox cannot reach the configured Supabase URL. Note: the file's L4–7 header comment claims "they don't touch Supabase — `isSupabaseConfigured()` returns false in the test env, so every service call routes through the in-memory implementation" — that comment is now stale given KD-9 hydration. The file's `afterEach` at L51–60 already conditions on `isSupabaseEnvPresent()` for cleanup, so the file was always written dual-mode-capable; KD-9 simply flipped which branch runs.

Cross-cutting fact: `isSupabaseConfigured()` (`src/lib/db/client.ts:68`) delegates to `isSupabaseEnvPresent()` (`src/lib/env.ts:245`), which reads live `process.env` on every call against the three Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). All three are present in repo `.env.local` and now reach worker processes via `vitest.config.ts` `test.env` forwarding (the KD-9 fix shape).

**Risk.** Three distinct hazards, listed in increasing order of severity:

- **Local-loop noise.** Anyone running `bun x vitest` on a fresh clone with `.env.local` populated but no reachable Supabase (sandbox, offline, Supabase project paused) gets 18 red lines that look like real regressions. Past pattern in this repo was that those tests self-skipped or failed at file load — the new failure mode is louder and easier to misread.
- **CI-mode ambiguity.** P4 Concern 1 cut-over may want CI to either (a) run these against a dev Supabase URL with a live, migrated schema, or (b) keep them off the default suite and gate them behind an explicit `bun x vitest --project integration` (or equivalent). The current KD-9-shape config has neither — it routes them at the live URL by default with no opt-out. If the chosen CI approach is (b), the current default behaviour is wrong; if it is (a), the dev Supabase must be reachable from CI runners and migrated to the post-P4 schema before P4 Concern 1 lands its rename migration. Either way, this needs a decision before P4 Concern 1 turns red on these 18.
- **Stale dual-mode contract.** The `service.test.ts` file header comment is now factually wrong about its own runtime behaviour. Tests that document "we're in mock mode" but actually execute against live infra are a maintainability trap — the next person to add a test against this file will copy the wrong mental model. Header needs to be reconciled with whichever decision comes out of the prior bullet.

This is not "pre-existing latent" — pre-KD-9 the suite was green on these two files for the wrong reason (env-hydration bug masking the routing decision). KD-9 surfaces the routing decision; the routing decision itself was always pending. Treat as a KD-9-revealed concern, not a KD-9 regression.

**Action.** P4 Concern 2 directive author selects one of the five paths below and bakes it into the directive's acceptance criteria. None of the paths require code changes outside `vitest.config.ts`, `.env.local.test`, the two test files, and possibly the `getMode()` selector — i.e. none of them block P4 Concern 1 dispatch.

1. **Don't hydrate Supabase env into worker `process.env`.** Modify `vitest.config.ts` `test.env` forwarding to filter out `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Restores pre-KD-9 behaviour (mock-mode for `service.test.ts`, self-skip for `rls.test.ts`). Cheapest path. Cost: integration tests now require an explicit env-injection wrapper to run live; loses the dual-mode coverage `service.test.ts` was designed to give.
2. **Use a dummy Supabase URL in `.env.local.test`.** Add a `.env.local.test` file with the three Supabase keys set to obviously-bogus-but-syntactically-valid values (e.g. `NEXT_PUBLIC_SUPABASE_URL=http://supabase.invalid`). Vitest's `loadEnvConfig` reads `.env.local.test` ahead of `.env.local` when `NODE_ENV=development` — this short-circuits live calls without filtering. Cost: per-suite real-mode opt-in needs a test-env override mechanism; currently we don't have one.
3. **Gate `getMode()` more strictly.** Add a `process.env.FFF_TEST_MODE` (or similar) check to `src/lib/providers/store.ts:34` and `src/lib/db/__tests__/rls.test.ts:35` — when set, force mock and self-skip respectively. `vitest.config.ts` sets the var on every test run. Cost: production code now carries a test-mode escape hatch; light architectural smell but well-precedented.
4. **Preflight connection check + skip.** Add a `beforeAll` to both files that pings the Supabase URL with a 2s timeout; if it fails, `describe.skip` the suite and log "Supabase unreachable, skipping integration tests." Cost: per-suite startup latency; skip-when-unreachable hides real CI breakage.
5. **Run against `supabase start` local dev.** Standardise on `bun supabase start` as the test prerequisite. Document in `AGENTS.md` and CI. Tests run live against the local Supabase Docker instance. Cost: every contributor needs Docker + `supabase start` running; CI needs a Supabase service container; first-run friction.

Recommended default for the directive author to overturn: **Path 3** for the `service.test.ts` file (preserves the dual-mode coverage the file was designed for, lets us flip to real-mode in CI by setting/unsetting the env var) plus **Path 4** for `rls.test.ts` (RLS tests fundamentally need a real Postgres — preflight-skip is the honest behaviour when there isn't one). This recommendation is provisional; final decision belongs to the P4 Concern 2 directive author.

**Owner.** P4 Concern 2 directive author. (P4 Concern 2 covers the **Tests** workstream of the P4 implementation plan; this entry feeds that directive's pre-draft scoping.)

**Cross-references.**

- KD-9 main fix commit `4336844` on branch `fix/kd-9-followup` — landed config-time env hydration via `loadEnvConfig` + `test.env` forwarding.
- KD-9 cleanup commit `bc5343c` — removed inert `vitest.setup.ts`, `src/__probe__/probe.test.ts`, `test-root-file`.
- `KD_9_FIX_DIRECTIVE.md` §A — task that surfaced this concern.
- `P4_CONCERN_1_DIRECTIVE.md` — P4 Concern 1 (Migrations); this entry does **not** block P4 Concern 1 dispatch.
- `P4_IMPLEMENTATION_PLAN.md` — parent plan; P4 Concern 2 (Tests) directive is the consumer of this entry.
- `vitest.config.ts` (commit `4336844`) — the env-hydration shape that flipped the gate.
- `src/lib/env.ts:245` `isSupabaseEnvPresent()`, `src/lib/db/client.ts:68` `isSupabaseConfigured()`, `src/lib/providers/store.ts:34` `getMode()`, `src/lib/db/__tests__/rls.test.ts:40-41` `envPresent / d` gate, `src/lib/providers/__tests__/service.test.ts:4-7` (stale header), `src/lib/providers/__tests__/service.test.ts:51-60` (dual-mode `afterEach`).

---

_End of P4 Concern 2 pre-draft inputs._
