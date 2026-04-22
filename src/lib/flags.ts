// ═══════════════════════════════════════════════════════════════
// Frontfiles — Feature flags
//
// Thin function layer over the `flags` object exported from
// `@/lib/env`. Keep this file as the public API surface callers
// already depend on (isFffSharingEnabled / isRealUploadEnabled),
// with env.ts providing the single parsing point.
//
// Flag conventions:
//
//   - All flags are NEXT_PUBLIC_FFF_* prefixed for FFF Sharing,
//     and NEXT_PUBLIC_FF_* for any other future feature.
//   - The DEFAULT for a flag is "off" until the env var is
//     explicitly set. This keeps a fresh deploy in a known-safe
//     state.
//   - Accepted values are exactly `"true"` and `"false"` — the
//     Zod schema in src/lib/env.ts enforces the enum. Anything
//     else fails fast at module load with a clear error.
//
// Adding a new flag:
//
//   1. Add a NEXT_PUBLIC_FFF_* or FFF_* entry to src/lib/env.ts.
//   2. Extend `flags` in env.ts with a boolean coercion.
//   3. Add a getter here that returns `flags.yourFlag`.
// ═══════════════════════════════════════════════════════════════

import { flags } from '@/lib/env'

/**
 * FFF Sharing — global on/off switch.
 *
 * When false (the default), the FFF nav button, the global
 * /feed route, the post detail route, the user feed page, the
 * share composer overlay, and the profile / frontfolio Posts
 * preview blocks all collapse to a closed state.
 *
 * Set `NEXT_PUBLIC_FFF_SHARING_ENABLED=true` to turn the
 * feature on. Intended for staged rollout: dev → staging →
 * limited beta → general availability.
 */
export function isFffSharingEnabled(): boolean {
  return flags.fffSharing
}

/**
 * Real upload pipeline — cutover switch for PR 2 → PR 5.
 *
 * When false (the default), the upload API route at
 * /api/upload returns 503. The simulation path in v2-state.ts
 * remains authoritative for the UI. When true, the route
 * accepts real file bytes, persists the original through the
 * StorageAdapter, and inserts the draft vault_assets +
 * asset_media rows.
 *
 * Server-only flag — read by the route handler, not by any
 * client component. Flip happens in PR 5.
 */
export function isRealUploadEnabled(): boolean {
  return flags.realUpload
}

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

/**
 * ECONOMIC_V1_UI — spec-canonical replacement-page gate.
 *
 * When false (the default in deploy 1 and throughout 4A.*
 * development), the replacement pages at /vault/offers,
 * /vault/offers/[id], /vault/assignments,
 * /vault/assignments/[id], /vault/disputes, and
 * /vault/disputes/[id] call `notFound()` from their page.tsx
 * server component. When true (flipped at 4B alongside
 * FFF_AUTH_WIRED), the replacement pages render.
 *
 * Server-only flag. Read at the top of each replacement
 * page.tsx via the pattern:
 *
 *   import { isEconomicV1UiEnabled } from '@/lib/flags'
 *   import { notFound } from 'next/navigation'
 *
 *   export default function Page(…) {
 *     if (!isEconomicV1UiEnabled()) notFound()
 *     …
 *   }
 *
 * Orthogonal to FFF_AUTH_WIRED, which gates request-surface
 * route handlers. Deploy 2 flips both flags in the same env
 * change; rollback flips both back. See
 * docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §7.3.
 *
 * 4A.1 ships the accessor. 4A.2 / 4A.3 / 4A.4 wire it into each
 * replacement page.tsx.
 */
export function isEconomicV1UiEnabled(): boolean {
  return flags.economicV1Ui
}
