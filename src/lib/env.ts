/**
 * FRONTFILES — Environment schema (Zod)
 *
 * Single source of truth for all `process.env` access. Every module that
 * needs an env var imports `env` from this file instead of reading
 * `process.env` directly.
 *
 * Two guarantees this file provides:
 *   1. Fail-fast on import — if any REQUIRED var is missing or malformed,
 *      the app crashes at startup with a clear error listing exactly which
 *      keys are wrong. This catches misconfigured deploys immediately.
 *   2. Typed access — TypeScript knows the shape of `env`, so `env.X`
 *      completes correctly and has the right type.
 *
 * USAGE:
 *   ```ts
 *   import { env } from '@/lib/env'
 *   const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
 *   ```
 *
 * DO NOT bypass this by reading `process.env.X` elsewhere in the codebase.
 * A lint rule enforcing this is a future addition.
 *
 * Public vs private:
 *   - `NEXT_PUBLIC_*` vars are exposed to the browser bundle. Never put
 *     secrets in them.
 *   - All other vars are server-only. `SUPABASE_SERVICE_ROLE_KEY` and
 *     `STRIPE_SECRET_KEY` MUST never appear in client code.
 */

// Namespace import (not `import { z }`) — bundler- and runtime-safe across
// Next.js/Turbopack, Vitest 4/rolldown, and Bun. Zod 3.25.x ships as a
// dual-package (v3 default + v4 subpath) with an `exports` map that makes
// the named `z` re-export resolve unreliably under some runtimes' CJS↔ESM
// interop. The namespace form has identical runtime semantics and types.
import * as z from 'zod'

// ─── Schema definition ──────────────────────────────────────────

const envSchema = z.object({
  // ─── Required: Supabase foundation ────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://xxxxx.supabase.co)',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required (sb_publishable_... or legacy JWT)',
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    message: 'SUPABASE_SERVICE_ROLE_KEY is required (sb_secret_... or legacy JWT). Server-only.',
  }),

  // ─── Required: App URL ────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .describe('Public-facing URL for this deployment — used in email links, OAuth callbacks, etc.'),

  // ─── Feature flags ────────────────────────────────────────────
  NEXT_PUBLIC_FFF_SHARING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .describe('FFF broadcast surface visibility (D-F1 lock: v1 broadcast-only)'),

  FFF_REAL_UPLOAD: z
    .enum(['true', 'false'])
    .default('false')
    .describe('Gates the real /api/upload commit path. `false` → 503 response.'),

  FFF_STORAGE_DRIVER: z
    .enum(['fs', 'supabase'])
    .default('fs')
    .describe('Storage adapter selection. `fs` = local filesystem. `supabase` = Supabase Storage.'),

  FFF_STORAGE_FS_ROOT: z
    .string()
    .optional()
    .describe('Local filesystem root when FFF_STORAGE_DRIVER=fs. Defaults to ./public/dev/uploads.'),

  FFF_STORAGE_SUPABASE_BUCKET: z
    .string()
    .optional()
    .describe('Supabase Storage bucket name when FFF_STORAGE_DRIVER=supabase.'),

  // ─── Optional: Stripe (wired in Phase 5) ──────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // ─── Optional: Google / Vertex AI (wired in Phase 4) ──────────
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  VERTEX_AI_LOCATION: z
    .string()
    .optional()
    .describe('Default Vertex AI region when creator ai_region is not set. Per D8 EU default.'),
  NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: z.string().optional(),

  // ─── Optional: Apple Sign In (wired in Phase 4.A) ─────────────
  APPLE_SIGN_IN_TEAM_ID: z.string().optional(),
  APPLE_SIGN_IN_CLIENT_ID: z.string().optional(),
  APPLE_SIGN_IN_KEY_ID: z.string().optional(),
  APPLE_SIGN_IN_PRIVATE_KEY: z.string().optional(),

  // ─── Optional: Resend (wired in Phase 3) ──────────────────────
  RESEND_API_KEY_TRANSACTIONAL: z.string().optional(),
  RESEND_API_KEY_MARKETING: z.string().optional(),
  RESEND_FROM_TRANSACTIONAL: z
    .string()
    .optional()
    .describe('e.g. "Frontfiles <hello@mail.frontfiles.news>"'),
  RESEND_FROM_MARKETING: z
    .string()
    .optional()
    .describe('e.g. "Frontfiles <news@news.frontfiles.news>"'),

  // ─── Optional: Observability (wired in Phase 2) ───────────────
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // ─── Node runtime ─────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

// ─── Parse + fail-fast ──────────────────────────────────────────
//
// Two structural rules Next.js (Turbopack + Webpack) enforces on client
// bundles that the prior `envSchema.safeParse(process.env)` call violated:
//
//   1. `NEXT_PUBLIC_*` vars are only inlined into the client bundle when
//      read via an *explicit static path* like `process.env.NEXT_PUBLIC_X`.
//      Passing `process.env` as a whole object defeats the static-replacement
//      pass — the client sees `{}` and every required field fails Zod.
//   2. Server-only vars (e.g. `SUPABASE_SERVICE_ROLE_KEY`) are never shipped
//      to the client bundle by design. A schema that marks them required and
//      runs in the client bundle will always fail.
//
// Fix: build `rawEnv` from explicit per-key reads (satisfies rule 1), and
// branch the schema by runtime — full schema on the server, public-only
// subset on the client (satisfies rule 2). See KD-15 for the incident.

const rawEnv = {
  // Public — safe to read in the client bundle.
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_FFF_SHARING_ENABLED: process.env.NEXT_PUBLIC_FFF_SHARING_ENABLED,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,

  // Server-only — undefined in the client bundle by design.
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FFF_REAL_UPLOAD: process.env.FFF_REAL_UPLOAD,
  FFF_STORAGE_DRIVER: process.env.FFF_STORAGE_DRIVER,
  FFF_STORAGE_FS_ROOT: process.env.FFF_STORAGE_FS_ROOT,
  FFF_STORAGE_SUPABASE_BUCKET: process.env.FFF_STORAGE_SUPABASE_BUCKET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION,
  APPLE_SIGN_IN_TEAM_ID: process.env.APPLE_SIGN_IN_TEAM_ID,
  APPLE_SIGN_IN_CLIENT_ID: process.env.APPLE_SIGN_IN_CLIENT_ID,
  APPLE_SIGN_IN_KEY_ID: process.env.APPLE_SIGN_IN_KEY_ID,
  APPLE_SIGN_IN_PRIVATE_KEY: process.env.APPLE_SIGN_IN_PRIVATE_KEY,
  RESEND_API_KEY_TRANSACTIONAL: process.env.RESEND_API_KEY_TRANSACTIONAL,
  RESEND_API_KEY_MARKETING: process.env.RESEND_API_KEY_MARKETING,
  RESEND_FROM_TRANSACTIONAL: process.env.RESEND_FROM_TRANSACTIONAL,
  RESEND_FROM_MARKETING: process.env.RESEND_FROM_MARKETING,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,

  NODE_ENV: process.env.NODE_ENV,
}

const clientSchema = envSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true,
  NEXT_PUBLIC_FFF_SHARING_ENABLED: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true,
  NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: true,
  NEXT_PUBLIC_SENTRY_DSN: true,
  NEXT_PUBLIC_POSTHOG_KEY: true,
  NEXT_PUBLIC_POSTHOG_HOST: true,
  NODE_ENV: true,
})

const isServer = typeof window === 'undefined'
const parsed = isServer
  ? envSchema.safeParse(rawEnv)
  : clientSchema.safeParse(rawEnv)

if (!parsed.success) {
  /* eslint-disable no-console */
  console.error('\n❌ Invalid or missing environment variables:\n')
  const fieldErrors = parsed.error.flatten().fieldErrors
  for (const [key, errs] of Object.entries(fieldErrors)) {
    if (errs && errs.length > 0) {
      console.error(`   ${key}: ${errs.join(', ')}`)
    }
  }
  console.error(
    '\nSet the above in your .env.local (dev) or in Vercel environment settings (preview / prod).\n',
  )
  /* eslint-enable no-console */
  throw new Error(
    'Environment validation failed — see errors above. This is a fail-fast by design.',
  )
}

// ─── Typed export ───────────────────────────────────────────────
//
// Type the export as the full server schema. On the server this matches
// runtime exactly. On the client, server-only fields are `undefined` at
// runtime, but client code must never read them — that access would
// indicate a server-only module was imported into a client component,
// which Next.js normally blocks via the server/client module graph.

export const env = parsed.data as z.infer<typeof envSchema>

export type Env = typeof env

// ─── Derived helpers ────────────────────────────────────────────

/**
 * True when Supabase env vars are set — used by isSupabaseConfigured() shims.
 * Reads live process.env on every call (CCP Pattern-a Option 2b — no
 * module-load cache). The Zod parse at module load still gates boot on these
 * vars; this function exists so tests that scope env per-suite see the live
 * value and dual-mode stores re-derive MODE on demand.
 */
export function isSupabaseEnvPresent(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

/**
 * Convenience booleans for env-gated features.
 *
 * Each field is a getter that reads live process.env on every access — no
 * module-load cache (CCP Pattern-a Option 2b). Destructuring footgun: the
 * idiom `const { realUpload } = flags` captures the value at destructure
 * time, defeating liveness. Read fields by path (`flags.realUpload`) at
 * each call site.
 */
export const flags = {
  get fffSharing(): boolean {
    return process.env.NEXT_PUBLIC_FFF_SHARING_ENABLED === 'true'
  },
  get realUpload(): boolean {
    return process.env.FFF_REAL_UPLOAD === 'true'
  },
  get storageSupabase(): boolean {
    return process.env.FFF_STORAGE_DRIVER === 'supabase'
  },
}

/** True when running in a production build. */
export const isProd = env.NODE_ENV === 'production'
