'use client'

/**
 * Frontfiles — Scan-state poller (NR-D7b, F10)
 *
 * Render-less client component that drives `router.refresh()` on
 * a 5-second interval while at least one asset has a pending
 * scan_result. F11 mounts this when the server-rendered page's
 * scan_results contain any `pending` row.
 *
 * Auto-stop posture: the component does NOT decide internally
 * when to stop polling — it polls on a fixed cadence while
 * `hasPending` is true at mount, with a `maxAttempts` safety cap.
 * The "really stop" signal comes from F11 deciding NOT to mount
 * the poller on a re-render where no pending rows remain. So:
 *
 *   tick 0: page renders with pending rows → F11 mounts <ScanPoller hasPending=true>
 *   tick 5s: poller calls router.refresh() → server re-renders
 *   tick 5s+ε: F11 sees no pending → does not mount <ScanPoller>
 *   poller's previous instance unmounts → polling stops
 *
 * Safety cap (`maxAttempts`, default 60 = 5 min) prevents the
 * loop from spinning indefinitely if the cron worker is offline
 * or the scan_results never resolve. After the cap, polling
 * stops; user can hard-refresh to re-engage.
 *
 * Spec cross-references:
 *   - directives/NR-D7b-scan-pipeline.md §F10
 *   - src/app/.../assets/page.tsx (F11 — mount control)
 */

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const DEFAULT_INTERVAL_MS = 5_000
const DEFAULT_MAX_ATTEMPTS = 60

export interface ScanPollerProps {
  /**
   * Initial pending state from the server render. Captured at
   * mount; subsequent re-renders unmount + remount the component
   * (key change on the parent) to reset the poller.
   */
  hasPending: boolean
  /** Polling interval in ms. Default 5000 (5 seconds). */
  pollIntervalMs?: number
  /** Safety cap on attempts before auto-stop. Default 60 (≈5 min at 5s). */
  maxAttempts?: number
}

export function ScanPoller({
  hasPending,
  pollIntervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: ScanPollerProps) {
  const router = useRouter()
  const [active, setActive] = useState(hasPending)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!active) return
    if (attempts >= maxAttempts) {
      // Hit the cap — stop polling. User can hard-refresh to
      // engage another window of polling.
      setActive(false)
      return
    }
    const timer = setTimeout(() => {
      router.refresh()
      setAttempts((a) => a + 1)
    }, pollIntervalMs)
    return () => clearTimeout(timer)
  }, [active, attempts, maxAttempts, pollIntervalMs, router])

  // Render-less: the component owns the polling lifecycle. The
  // visual state lives in F1's AssetRow scan-state badge, which
  // re-renders when router.refresh() re-fetches the page.
  return null
}
