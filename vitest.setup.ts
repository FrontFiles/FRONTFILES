/**
 * FRONTFILES — Vitest setup
 *
 * Loads `.env.local` (and the rest of Next.js's env file chain) into
 * `process.env` BEFORE any test module imports `src/lib/env.ts`.
 *
 * Why:
 *   `src/lib/env.ts` validates `process.env` at module-load time and
 *   throws if required Supabase vars are missing. Vitest runs in Node
 *   without Next.js's framework wrapper, so `.env.local` is not loaded
 *   automatically — every test that imports a module which reads
 *   `env.ts` would otherwise fail at import time with `Required` errors.
 *
 * Why `@next/env`, not `dotenv`:
 *   `@next/env` is already installed (ships with `next`) and honours the
 *   exact priority chain Next.js uses at runtime: `.env.local`,
 *   `.env.<NODE_ENV>.local`, `.env.<NODE_ENV>`, `.env`. This keeps
 *   test-time env resolution identical to dev/preview/prod behaviour.
 *
 * This file is wired in `vitest.config.ts` under `test.setupFiles`.
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
