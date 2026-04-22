// ═══════════════════════════════════════════════════════════════
// Frontfiles — POST /api/auth/signout
// (P4 concern 4A.2.AUTH §F6)
//
// ─── Why this route exists as a no-op ─────────────────────────
//
// Supabase sign-out is entirely browser-side: `supabase.auth
// .signOut()` on the browser client clears the persisted session
// (localStorage) and the in-memory refresh-token machinery, and
// emits an `SIGNED_OUT` auth event that any `useSession()` consumer
// already observes through the shared subscription graph.
//
// The browser is therefore the authoritative endpoint for sign-out
// today. This route intentionally does NOT call `auth.signOut()`
// on the server — doing so under a service-role client would be a
// no-op (there is no server-bound session to invalidate) and under
// a user-JWT client would revoke the refresh token globally, which
// is correct semantics for a "sign out of all devices" action but
// overshoots the current per-tab sign-out UX.
//
// ─── Why it still exists as a real endpoint ────────────────────
//
// Three forward-looking reasons:
//   1. Stable ping surface. The scaffold concern's header adds a
//      visible sign-out affordance; shipping the endpoint now
//      means that UI work is a client-only change (just wire
//      `supabase.auth.signOut()` + `fetch('/api/auth/signout')`).
//   2. Audit/analytics seam. When we wire observability (sign-out
//      counts, per-device attribution) this is the collection
//      point. Absent that seam today the method body stays a
//      no-op, but the URL is documented and testable.
//   3. Future global-signout escalation. If/when a "sign out of
//      all sessions" action is needed (security-incident flow,
//      admin force-logout), it lands HERE, not on the browser
//      client — because `auth.admin.signOut(userId)` requires the
//      service-role key, which only a server route may hold.
//
// ─── Contract ──────────────────────────────────────────────────
//
//   Flag on,  ANY body  → 204 No Content (noop marker)
//   Flag off,  ANY body  → 404 FEATURE_DISABLED  (same posture as
//                          every other auth-wired route; keeps the
//                          surface invisible until P5 flip)
//
// Body is intentionally ignored. No authentication is required:
// the request is a pure analytics/audit ping; the real sign-out
// happened on the browser before this fetch fired, and requiring
// a Bearer here would just mean "send a token that's about to
// be discarded", which adds no safety.
//
// ─── LoC budget (directive) ────────────────────────────────────
//
// ~30 LoC including this header's intent section.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

import { isAuthWired } from '@/lib/flags'
import { logger } from '@/lib/logger'

const ROUTE = 'POST /api/auth/signout'

// No `request` parameter: this handler ignores headers and body
// by contract (see header §Contract). Omitting the param is the
// cleanest signal of that — and keeps the linter quiet.
export async function POST(): Promise<NextResponse> {
  if (!isAuthWired()) {
    // Feature-gated surface parity with every other auth-wired
    // route — returning 404 rather than 200 keeps probes unable
    // to fingerprint the endpoint before the flag flips.
    return NextResponse.json(
      { error: { code: 'FEATURE_DISABLED', message: 'Feature not enabled.' } },
      { status: 404 },
    )
  }

  // No-op marker. Logged so any ops dashboard watching for auth
  // anomalies gets a signal; the payload is deliberately minimal
  // to keep this off the critical path.
  logger.info(
    { route: ROUTE },
    '[auth.signout] noop acknowledged',
  )

  return new NextResponse(null, { status: 204 })
}
