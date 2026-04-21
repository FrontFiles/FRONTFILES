import { defineConfig } from 'vitest/config'
import path from 'path'
import { loadEnvConfig } from '@next/env'

// ─── Env loading: main-process, pre-worker, explicitly forwarded ──────
//
// `src/lib/env.ts` validates `process.env` at module-load time and throws
// if required Supabase vars are missing. Vitest runs in Node without
// Next.js's framework wrapper, so `.env.local` is not loaded automatically.
//
// Two Vitest/rolldown-specific obstacles make the prior `setupFiles` approach
// insufficient and force the shape of this fix:
//
//   Obstacle A — `setupFiles` timing. Under Vitest 4 / rolldown, `setupFiles`
//     is not guaranteed to execute before a test file's hoisted top-level
//     ESM imports (see REMEDIATION_PLAN_20260418.md appendix F, fingerprint
//     1). Env must be populated during config module evaluation, which runs
//     strictly before the worker pool spawns.
//
//   Obstacle B — `@next/env` skips `.env.local` when `NODE_ENV === 'test'`.
//     Next.js intentionally excludes `.env.local` in test mode so CI runs
//     stay reproducible (see @next/env/dist/index.js, `loadEnvConfig`). But
//     Vitest sets `NODE_ENV=test` by default, so a naïve `loadEnvConfig`
//     call in this config finds zero env files. Empirically verified via a
//     probe: URL unset, loaded files = [].
//
//   Obstacle C — Vitest 4 / rolldown workers do NOT inherit the parent
//     process's `process.env` by default. Populating the main process alone
//     is insufficient; the envs must be pushed into the worker via Vitest's
//     `test.env` channel.
//
// Shape of the fix:
//   1. Temporarily override `NODE_ENV` to `development` so `@next/env` loads
//      `.env.local` (the local-dev secrets file that holds the required
//      Supabase URL and keys). Restore `NODE_ENV=test` immediately after
//      — the tests themselves must still see `NODE_ENV=test`, both because
//      Vitest assumes it and because `src/lib/env.ts`'s Zod schema accepts
//      `'development' | 'production' | 'test'`.
//   2. Build `forwardedEnv` from the now-populated `process.env` and pass
//      it via `test.env` so workers see the same vars as the main process.
//
// This side-effect runs ONLY under the Vitest harness — it is gated on
// `vitest.config.ts` evaluation, which does not occur under `next dev` or
// `next build` (those invoke Next.js's own framework env integration).
// Production fail-fast in `src/lib/env.ts` is therefore unaffected: under
// `NODE_ENV=production` without `.env.local`, the Zod parse still throws
// at module load exactly as before.
// `process.env.NODE_ENV` is typed as a readonly literal union by
// `@types/node`, which makes `next build`'s typecheck reject a direct
// assignment. The cast preserves the runtime mutation (which is what
// `@next/env` keys off of inside `loadEnvConfig`) without disabling
// the broader read-only contract elsewhere.
const _savedNodeEnv = process.env.NODE_ENV
;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'
try {
  loadEnvConfig(process.cwd(), /* dev */ true)
} finally {
  ;(process.env as { NODE_ENV: string }).NODE_ENV = _savedNodeEnv ?? 'test'
}

// Forward only string-valued env vars; `test.env` is typed as
// `Record<string, string>` and passing `undefined` values would be a
// type/serialisation hazard.
const forwardedEnv: Record<string, string> = {}
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string') {
    forwardedEnv[key] = value
  }
}

// P4 concern 3 — default the spec-canonical AUTH_WIRED flag to `true`
// in the test worker env so concern 4's replacement route handlers
// (each guarded by `if (!isAuthWired()) return errorResponse(...)`)
// exercise the live path by default. Tests that need the off path
// stub explicitly via `vi.stubEnv('FFF_AUTH_WIRED', 'false')`.
// Orthogonal to FF_INTEGRATION_TESTS (mock-vs-integration routing in
// src/lib/providers/store.ts); both gates coexist.
forwardedEnv.FFF_AUTH_WIRED = 'true'

export default defineConfig({
  test: {
    environment: 'node',
    env: forwardedEnv,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
