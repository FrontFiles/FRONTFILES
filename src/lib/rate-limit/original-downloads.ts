/**
 * Frontfiles — Original Download Rate Limiter
 *
 * Rate-limiting policy for original-file delivery.
 * Protects against scripted scraping and excessive automated
 * retrieval of high-value original files.
 *
 * POLICY:
 *   - Creator self-access is EXEMPT (always allowed).
 *   - Per-user limits: burst (1min), hourly, daily.
 *   - Per-IP backstop: hourly (generous, catches multi-account abuse).
 *   - Both successful and denied attempts count.
 *   - Rate limiting is POLICY, not entitlement truth.
 *     A rate-limited user is still entitled — just temporarily blocked.
 *
 * PLACEMENT IN REQUEST FLOW:
 *   After authentication + creator detection.
 *   Before entitlement resolution.
 *   Before file I/O.
 *
 * SAFETY:
 *   This function NEVER throws. If configuration is invalid or
 *   an internal error occurs, it defaults to ALLOW and logs a
 *   server-side warning. Rate limiting must not break delivery.
 *
 * THRESHOLDS:
 *   Configurable via environment variables with sane defaults.
 *   See THRESHOLD CONFIGURATION section below.
 */

import {
  checkSlidingWindow,
  type WindowConfig,
} from './sliding-window'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface RateLimitContext {
  userId: string
  ipAddress: string | null
  isCreatorSelfAccess: boolean
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
  /** Which limit was exceeded, for diagnostics. */
  exceededLimit?: string
}

// ══════════════════════════════════════════════
// THRESHOLD CONFIGURATION
//
// Env vars override defaults. Parse once at module load.
// If an env var is set but not a valid number, the default
// is used and a warning is logged.
// ══════════════════════════════════════════════

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(`[rate-limit] Invalid ${name}="${raw}", using default ${fallback}`)
    return fallback
  }
  return parsed
}

// Per-user thresholds
const USER_BURST_LIMIT = envInt('RATE_LIMIT_USER_BURST', 10)
const USER_BURST_WINDOW_MS = envInt('RATE_LIMIT_USER_BURST_WINDOW_MS', 60_000) // 1 min
const USER_HOURLY_LIMIT = envInt('RATE_LIMIT_USER_HOURLY', 60)
const USER_HOURLY_WINDOW_MS = envInt('RATE_LIMIT_USER_HOURLY_WINDOW_MS', 3_600_000) // 60 min
const USER_DAILY_LIMIT = envInt('RATE_LIMIT_USER_DAILY', 200)
const USER_DAILY_WINDOW_MS = envInt('RATE_LIMIT_USER_DAILY_WINDOW_MS', 86_400_000) // 24 hr

// Per-IP backstop thresholds
const IP_HOURLY_LIMIT = envInt('RATE_LIMIT_IP_HOURLY', 300)
const IP_HOURLY_WINDOW_MS = envInt('RATE_LIMIT_IP_HOURLY_WINDOW_MS', 3_600_000)

const USER_WINDOWS: WindowConfig[] = [
  { label: 'user-burst', windowMs: USER_BURST_WINDOW_MS, limit: USER_BURST_LIMIT },
  { label: 'user-hourly', windowMs: USER_HOURLY_WINDOW_MS, limit: USER_HOURLY_LIMIT },
  { label: 'user-daily', windowMs: USER_DAILY_WINDOW_MS, limit: USER_DAILY_LIMIT },
]

const IP_WINDOWS: WindowConfig[] = [
  { label: 'ip-hourly', windowMs: IP_HOURLY_WINDOW_MS, limit: IP_HOURLY_LIMIT },
]

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Check whether an original download attempt should be allowed
 * under the rate-limiting policy.
 *
 * NEVER throws. Defaults to allow on internal errors.
 */
export function checkOriginalDownloadRate(
  ctx: RateLimitContext,
): RateLimitResult {
  try {
    // Creator self-access is fully exempt.
    if (ctx.isCreatorSelfAccess) {
      return { allowed: true }
    }

    // Per-user check (primary enforcement).
    const userKey = `user:${ctx.userId}`
    const userResult = checkSlidingWindow(userKey, USER_WINDOWS)
    if (!userResult.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: userResult.retryAfterSeconds ?? 30,
        exceededLimit: userResult.exceededWindow,
      }
    }

    // Per-IP backstop (only if IP is available).
    if (ctx.ipAddress) {
      const ipKey = `ip:${ctx.ipAddress}`
      const ipResult = checkSlidingWindow(ipKey, IP_WINDOWS)
      if (!ipResult.allowed) {
        return {
          allowed: false,
          retryAfterSeconds: ipResult.retryAfterSeconds ?? 60,
          exceededLimit: ipResult.exceededWindow,
        }
      }
    }

    return { allowed: true }
  } catch (err) {
    // Rate limiting must never break delivery.
    console.warn(
      '[rate-limit] Error in checkOriginalDownloadRate, defaulting to allow:',
      err instanceof Error ? err.message : err,
    )
    return { allowed: true }
  }
}

// ══════════════════════════════════════════════
// RESPONSE HELPERS
// ══════════════════════════════════════════════

/**
 * Build the 429 response for a rate-limited original download.
 * Used by both the media route and the artifact route's
 * original_file delegation path.
 *
 * Returns a standard Response (not NextResponse) to avoid
 * importing next/server in a library module. Route handlers
 * can return this directly — NextResponse extends Response.
 */
export function buildRateLimitResponse(
  retryAfterSeconds: number,
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many download requests. Please wait before trying again.',
      code: 'RATE_LIMITED',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
