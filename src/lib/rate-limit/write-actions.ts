/**
 * FRONTFILES — Write-action rate limiter
 *
 * Companion policy to `original-downloads.ts`. Where that module
 * protects high-value read endpoints from scraping, this one
 * protects write endpoints from abuse — offer spam, post flooding,
 * repeated upload commits, duplicated assignment actions.
 *
 * POLICY:
 *   Per-user sliding windows across three time horizons:
 *     - burst : 10 writes / 60 sec
 *     - hourly: 60 writes / hour
 *     - daily : 300 writes / day
 *   All thresholds env-configurable (see below).
 *
 *   "Write action" is any mutating API call (POST / PATCH / DELETE
 *   / PUT). Reads are not counted. Authenticated staff/admin are
 *   exempt (opt-in via `isStaffOrAdmin: true`).
 *
 *   Both allowed and denied attempts count — a rate-limited user
 *   can't retry past the limit just by spamming.
 *
 * PLACEMENT IN REQUEST FLOW:
 *   After authentication / identity resolution.
 *   Before Zod body validation is required to run fully (a malformed
 *   request still consumes a slot — this prevents "type-probe" spam).
 *
 * SAFETY:
 *   NEVER throws. Defaults to ALLOW on unexpected internal error —
 *   rate limiting must not break legitimate writes.
 *
 * PRODUCTION NOTE:
 *   In-process via `sliding-window.ts`. Swap to Redis ZRANGEBYSCORE
 *   when horizontal scaling is required — the interface is stable.
 */

import { NextResponse } from 'next/server'
import { checkSlidingWindow, type WindowConfig } from './sliding-window'
import { logger } from '@/lib/logger'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface WriteRateContext {
  /** Identifier for the actor (user ID or session ID). */
  actorId: string
  /** Optional action-type tag ("offer.create", "post.create" etc.) — for logging and future per-action policies. */
  actionType?: string
  /** Staff / admin exemption. Platform operators shouldn't be rate-limited. */
  isStaffOrAdmin?: boolean
}

export interface WriteRateResult {
  allowed: boolean
  retryAfterSeconds?: number
  exceededLimit?: string
}

// ══════════════════════════════════════════════
// THRESHOLD CONFIGURATION
// ══════════════════════════════════════════════

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed) || parsed <= 0) {
    logger.warn({ env: name, raw, fallback }, '[rate-limit] invalid env; using default')
    return fallback
  }
  return parsed
}

const WRITE_BURST_LIMIT = envInt('RATE_LIMIT_WRITE_BURST', 10)
const WRITE_BURST_WINDOW_MS = envInt('RATE_LIMIT_WRITE_BURST_WINDOW_MS', 60_000)
const WRITE_HOURLY_LIMIT = envInt('RATE_LIMIT_WRITE_HOURLY', 60)
const WRITE_HOURLY_WINDOW_MS = envInt('RATE_LIMIT_WRITE_HOURLY_WINDOW_MS', 3_600_000)
const WRITE_DAILY_LIMIT = envInt('RATE_LIMIT_WRITE_DAILY', 300)
const WRITE_DAILY_WINDOW_MS = envInt('RATE_LIMIT_WRITE_DAILY_WINDOW_MS', 86_400_000)

const WRITE_WINDOWS: WindowConfig[] = [
  { label: 'write-burst', windowMs: WRITE_BURST_WINDOW_MS, limit: WRITE_BURST_LIMIT },
  { label: 'write-hourly', windowMs: WRITE_HOURLY_WINDOW_MS, limit: WRITE_HOURLY_LIMIT },
  { label: 'write-daily', windowMs: WRITE_DAILY_WINDOW_MS, limit: WRITE_DAILY_LIMIT },
]

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Check whether a write action should be allowed under the
 * per-user sliding-window policy.
 *
 * Returns immediately — no async I/O.
 */
export function checkWriteActionRate(ctx: WriteRateContext): WriteRateResult {
  try {
    if (ctx.isStaffOrAdmin) {
      return { allowed: true }
    }

    const key = `write:${ctx.actorId}`
    const result = checkSlidingWindow(key, WRITE_WINDOWS)

    if (!result.allowed) {
      logger.warn(
        {
          actor_id: ctx.actorId,
          action_type: ctx.actionType ?? 'unknown',
          exceeded_window: result.exceededWindow,
          retry_after_s: result.retryAfterSeconds,
        },
        '[rate-limit] write-action denied',
      )
      return {
        allowed: false,
        retryAfterSeconds: result.retryAfterSeconds ?? 30,
        exceededLimit: result.exceededWindow,
      }
    }
    return { allowed: true }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[rate-limit] checkWriteActionRate error; defaulting to allow',
    )
    return { allowed: true }
  }
}

/**
 * Build the 429 response for a write-action rate-limit rejection.
 * Returns NextResponse so routes can return it directly.
 */
export function buildWriteRateLimitResponse(
  retryAfterSeconds: number,
  exceededLimit?: string,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many write requests. Please wait before trying again.',
        retry_after_seconds: retryAfterSeconds,
        exceeded_limit: exceededLimit,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
