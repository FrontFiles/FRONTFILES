/**
 * Frontfiles — System actor sentinel handle (P4 concern 4A.1)
 *
 * Canonical platform-side actor UUID. Every ledger event emitted
 * without a party actor (cron-driven expiration, 14-day auto-accept,
 * asset-unavailable force-termination, dispute admin rulings,
 * appeal independent-review rulings) references this handle via
 * `actor_ref`. The handle is locked for the life of the platform
 * per spec §8.4 and MUST NOT be exposed to clients.
 *
 * References:
 *   - docs/specs/ECONOMIC_FLOW_v1.md §8.4 — "System actor" row:
 *     fixed sentinel UUID, `auth_user_id = NULL`, never
 *     tombstoned, never exposed to clients.
 *   - supabase/migrations/20260421000005_seed_system_actor.sql
 *     — the concern-1 M5 seed that inserts this UUID into
 *     `public.actor_handles` at DB init.
 *   - docs/audits/P4_CONCERN_1_DIRECTIVE.md §M5 — deferred the
 *     TS-side constant to "concern 3"; that deferral went
 *     uncompleted, and 4A.1 closes it.
 *   - docs/audits/P4_CONCERN_4_DESIGN_LOCK.md §2.3 — library
 *     path choice: flat `src/lib/ledger/` over the earlier-
 *     planned `src/lib/economic-flow/system-actor.ts`. The M5
 *     migration header still references the old path as a
 *     historical note; this file lands at the new path and the
 *     historical note stays as-is.
 *
 * Locked for the life of the platform per spec §8.4. Matches the
 * UUID seeded by
 * `supabase/migrations/20260421000005_seed_system_actor.sql`. MUST
 * NOT be exposed in any client bundle — this module is server-only.
 *
 * The §8.4 "never exposed to clients" invariant is preserved
 * structurally in `requireActor()` (see
 * `src/lib/auth/require-actor.ts`) because the seeded row has
 * `auth_user_id = NULL` and cannot match any real `auth.uid()`
 * lookup.
 *
 * Server-only note: this file does NOT carry a `'use server'`
 * directive. A plain string constant should not be a Server
 * Function; server-only-ness is enforced by the module graph —
 * this constant is imported only by server-only callers (the
 * ledger writer below, plus future cron handlers and dispute
 * admin RPC callers).
 */

export const SYSTEM_ACTOR_HANDLE =
  '00000000-0000-0000-0000-000000000001' as const
