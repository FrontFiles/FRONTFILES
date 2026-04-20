/**
 * FRONTFILES — Vitest setup (retired, no-op)
 *
 * Env loading moved to `vitest.config.ts` top-level in the KD-9 follow-up
 * fix. Under Vitest 4 / rolldown, `setupFiles` is not guaranteed to run
 * before a test file's hoisted top-level ESM imports, so `.env.local`
 * values must be populated during config module evaluation (strictly
 * pre-worker) — not per-worker via this file. See the rationale block at
 * the top of `vitest.config.ts`.
 *
 * This file is no longer wired in `vitest.config.ts` under
 * `test.setupFiles` and is safe to delete in any follow-up commit.
 */

export {}
