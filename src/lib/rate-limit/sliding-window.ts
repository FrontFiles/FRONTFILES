/**
 * Frontfiles — In-Process Sliding Window Rate Limiter
 *
 * A lightweight rate limiter using timestamp arrays per key.
 * Suitable for single-node deployment at launch.
 *
 * DESIGN:
 *   Each key (e.g. "user:buyer-001") maintains an array of
 *   timestamps representing recent attempts. On each check,
 *   expired timestamps are pruned and the count is compared
 *   against the limit for each configured window.
 *
 *   Memory is bounded: timestamps older than the longest
 *   window are pruned on every check. A periodic sweep
 *   (every 5 minutes) removes stale keys entirely.
 *
 * PRODUCTION NOTE:
 *   Replace with Redis ZRANGEBYSCORE when horizontal scaling
 *   is needed. The interface is the same — only the storage
 *   backend changes.
 */

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface WindowConfig {
  /** Human label for diagnostics. */
  label: string
  /** Window duration in milliseconds. */
  windowMs: number
  /** Maximum attempts allowed within the window. */
  limit: number
}

export interface SlidingWindowResult {
  allowed: boolean
  /** Which window was exceeded (null if allowed). */
  exceededWindow?: string
  /** Seconds until the earliest expiring timestamp in the
   *  exceeded window drops off. */
  retryAfterSeconds?: number
}

// ══════════════════════════════════════════════
// IMPLEMENTATION
// ══════════════════════════════════════════════

const store = new Map<string, number[]>()

// Periodic cleanup: remove keys with no recent timestamps.
// Runs every 5 minutes. The interval is unrefed so it doesn't
// prevent Node.js from exiting.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup(maxWindowMs: number): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - maxWindowMs
    for (const [key, timestamps] of store.entries()) {
      const filtered = timestamps.filter(t => t > cutoff)
      if (filtered.length === 0) {
        store.delete(key)
      } else {
        store.set(key, filtered)
      }
    }
  }, CLEANUP_INTERVAL_MS)
  // Don't prevent process exit.
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

/**
 * Record an attempt and check whether the key exceeds any window.
 *
 * Returns immediately — no async I/O.
 */
export function checkSlidingWindow(
  key: string,
  windows: WindowConfig[],
): SlidingWindowResult {
  const now = Date.now()

  // Find the longest window for pruning.
  const maxWindowMs = Math.max(...windows.map(w => w.windowMs))
  ensureCleanup(maxWindowMs)

  // Get or create timestamp array, prune expired entries.
  let timestamps = store.get(key) ?? []
  timestamps = timestamps.filter(t => t > now - maxWindowMs)

  // Record this attempt BEFORE checking — attempts count
  // whether allowed or denied.
  timestamps.push(now)
  store.set(key, timestamps)

  // Check each window.
  for (const window of windows) {
    const windowStart = now - window.windowMs
    const count = timestamps.filter(t => t > windowStart).length
    if (count > window.limit) {
      // Find the earliest timestamp in this window — when it
      // expires, one slot opens up.
      const earliest = timestamps.find(t => t > windowStart)
      const retryAfterMs = earliest
        ? (earliest + window.windowMs) - now
        : window.windowMs
      return {
        allowed: false,
        exceededWindow: window.label,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      }
    }
  }

  return { allowed: true }
}

// ══════════════════════════════════════════════
// TEST HELPERS
// ══════════════════════════════════════════════

/** Reset all counters. For tests only. */
export function _resetAllCounters(): void {
  store.clear()
}
