// ═══════════════════════════════════════════════════════════════
// Frontfiles — Feature flags
//
// Tiny env-var-backed flag layer. One module, one read function,
// no runtime overhead. Flags are public (NEXT_PUBLIC_*) so they
// can be evaluated at build time on both the server and the
// client — no hydration mismatches because both sides see the
// same bundled value.
//
// Flag conventions:
//
//   - All flags are NEXT_PUBLIC_FFF_* prefixed for FFF Sharing,
//     and NEXT_PUBLIC_FF_* for any other future feature.
//   - The DEFAULT for a flag is "off" until the env var is
//     explicitly set to a truthy value. This keeps a fresh
//     deploy in a known-safe state.
//   - "Truthy" = "1" | "true" | "TRUE" | "on" | "yes". Case
//     and whitespace insensitive. Any other value (including
//     empty / unset) is false.
//
// Adding a new flag:
//
//   1. Pick the env var name. NEXT_PUBLIC_ prefix is required
//      so it's available to client-rendered components.
//   2. Add a getter here.
//   3. Use the getter wherever the flag matters. Do NOT read
//      `process.env` directly outside this module.
// ═══════════════════════════════════════════════════════════════

function readBoolean(envValue: string | undefined): boolean {
  if (!envValue) return false
  const v = envValue.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on' || v === 'yes'
}

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
  return readBoolean(process.env.NEXT_PUBLIC_FFF_SHARING_ENABLED)
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
  return readBoolean(process.env.FFF_REAL_UPLOAD)
}
