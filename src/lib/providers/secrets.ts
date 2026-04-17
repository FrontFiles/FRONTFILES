// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: secret resolver boundary
//
// The application stores ONLY a `secret_ref` for each credential
// — never the secret material. This module is the seam between
// that ref and the real secret store (Supabase Vault, AWS
// Secrets Manager, GCP Secret Manager, etc.).
//
// The dev fallback resolves `env:NAME` refs from `process.env`
// so prototypes work without a real secret store. Production
// deploys MUST point at a real backend.
//
// SECURITY RULES
//
//   1. Plaintext secrets must NEVER be passed back through the
//      app's normal data path. The resolver returns a one-shot
//      string the caller passes directly to the provider SDK
//      and discards.
//
//   2. The SQL CHECK on `external_credentials.secret_ref` rejects
//      the literal `plain:` prefix so accidental plaintext
//      stuffing is loud at the database layer too.
//
//   3. New ref formats register here. Adding a new secret store
//      is one switch arm in `resolveSecret`.
//
//   4. Server-only. This module must not be imported from a
//      client component — Next will refuse to bundle it because
//      `process.env.*` access without `NEXT_PUBLIC_` is a build
//      error in client code.
// ═══════════════════════════════════════════════════════════════

/**
 * Outcome of a secret-resolution attempt. Helpers branch on
 * `kind` rather than throwing for the common "not configured"
 * case — that lets the caller report an actionable error
 * (e.g. "this Stripe connection has no secret configured").
 */
export type SecretResolution =
  | { kind: 'resolved'; value: string }
  | { kind: 'not_configured'; ref: string }
  | { kind: 'invalid_ref'; ref: string; reason: string }

/**
 * Resolve a credential `secret_ref` to its plaintext value.
 *
 * Supported ref formats:
 *
 *   env:NAME             dev/test only — read from process.env[NAME]
 *   stripe:acct_xxx:KEY  Stripe-shaped — currently delegates to env
 *                        keyed by `STRIPE_SECRET_<KEY>` until a real
 *                        secret store is wired
 *   google:user_id:KEY   Google-shaped — same shape, env fallback
 *   vault:PATH           reserved for Supabase Vault — not yet wired
 *
 * Returns a `SecretResolution` discriminated union so callers
 * can distinguish "not configured" (operator action needed)
 * from "invalid ref" (programmer error).
 *
 * SECURITY: the returned value should be passed to the provider
 * SDK and discarded. Do not log it, do not return it through
 * any HTTP response, do not stash it in app state.
 */
export async function resolveSecret(ref: string): Promise<SecretResolution> {
  if (!ref) return { kind: 'invalid_ref', ref, reason: 'empty ref' }

  // The `plain:` prefix is forbidden by SQL but we double-guard
  // it here so a hand-crafted in-memory row can never leak.
  if (ref.startsWith('plain:')) {
    return {
      kind: 'invalid_ref',
      ref,
      reason: 'plaintext refs are forbidden',
    }
  }

  // ── env:NAME ────────────────────────────────────────────
  if (ref.startsWith('env:')) {
    const name = ref.slice('env:'.length)
    if (!name) {
      return { kind: 'invalid_ref', ref, reason: 'missing env name' }
    }
    const value = process.env[name]
    if (!value) return { kind: 'not_configured', ref }
    return { kind: 'resolved', value }
  }

  // ── stripe:acct:KEY ─────────────────────────────────────
  // Until the production secret store is wired, every Stripe
  // ref maps to a single env var per key. Intentionally simple
  // so the dev path is exercised end-to-end.
  if (ref.startsWith('stripe:')) {
    const parts = ref.split(':')
    if (parts.length < 3) {
      return { kind: 'invalid_ref', ref, reason: 'expected stripe:<acct>:<key>' }
    }
    const key = parts[parts.length - 1]
    const envName = `STRIPE_SECRET_${key.toUpperCase()}`
    const value = process.env[envName]
    if (!value) return { kind: 'not_configured', ref }
    return { kind: 'resolved', value }
  }

  // ── google:user:KEY ─────────────────────────────────────
  if (ref.startsWith('google:')) {
    const parts = ref.split(':')
    if (parts.length < 3) {
      return { kind: 'invalid_ref', ref, reason: 'expected google:<user>:<key>' }
    }
    const key = parts[parts.length - 1]
    const envName = `GOOGLE_SECRET_${key.toUpperCase()}`
    const value = process.env[envName]
    if (!value) return { kind: 'not_configured', ref }
    return { kind: 'resolved', value }
  }

  // ── vault:PATH ──────────────────────────────────────────
  // Reserved. Wire to Supabase Vault when the deploy needs it.
  if (ref.startsWith('vault:')) {
    return {
      kind: 'not_configured',
      ref,
    }
  }

  return {
    kind: 'invalid_ref',
    ref,
    reason: 'unknown ref scheme',
  }
}

/**
 * Convenience: throw if not resolved. Use only at the boundary
 * with a provider SDK call where any failure should bubble as
 * a 5xx — the structured form is preferred everywhere else.
 */
export async function requireSecret(ref: string): Promise<string> {
  const result = await resolveSecret(ref)
  if (result.kind === 'resolved') return result.value
  throw new Error(`secret ref ${ref} not resolved (${result.kind})`)
}
