/**
 * GET /api/health
 *
 * Liveness probe. Always returns 200 JSON when the Next.js server is
 * responsive. Used by uptime monitors (BetterStack / Checkly / Vercel)
 * and smoke tests. No auth required.
 *
 * Response shape:
 *   {
 *     status: 'ok',
 *     commit: '<sha or "unknown">',
 *     env: 'development' | 'production' | 'test',
 *     uptime_seconds: <number>,
 *     timestamp: <ISO8601>
 *   }
 *
 * NOTE: This does NOT verify downstream dependencies (Supabase, Stripe,
 * Vertex AI, etc.). It's strictly a "is Next.js serving requests?" check.
 * A separate `/api/readiness` endpoint could probe dependencies if needed.
 */

import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

// Force dynamic — this endpoint must reflect live process state, not a
// pre-rendered stale value.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? 'unknown',
      env: env.NODE_ENV,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // Never cache health probes
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
