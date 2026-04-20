// Env-visibility diagnostic artifact from the KD-9 follow-up fix session.
// Used during the fix to verify that `.env.local` values populated by
// `loadEnvConfig` in `vitest.config.ts` reached the worker `process.env`.
// Two obstacles surfaced (see the comment block at the top of
// `vitest.config.ts`): `@next/env` skips `.env.local` when `NODE_ENV=test`,
// and Vitest 4 / rolldown workers do not inherit the parent `process.env`.
//
// The probe file could not be unlinked from the local filesystem in the
// fix session; this no-op placeholder makes it inert. Safe to delete in
// any follow-up commit.

import { it } from 'vitest'

it('probe artifact — no-op placeholder', () => {
  /* pass */
})
