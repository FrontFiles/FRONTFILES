/**
 * Frontfiles Upload V3 — useCommitSimulation hook (C2.4 §1.1, IPIV-1)
 *
 * Watches state.commit.phase. When it transitions to 'committing',
 * schedules a series of COMMIT_PROGRESS_UPDATE dispatches followed by
 * COMMIT_SUCCEEDED (or COMMIT_PARTIALLY_FAILED if simulateFailure > 0).
 *
 * Per C2-PLAN §9.3 + C2.4-DIRECTIVE §1.2: this is a FAKE driver. The real
 * `POST /api/v2/batch/[id]/commit` integration ships in PR 5; the driver
 * exists only so the committing → success/partial-failure transitions
 * can be exercised in C2.4's UI surfaces without a backend.
 *
 * Per IPIV-4 default: 100ms per asset; total time = includedCount × 100ms,
 * capped at 5s by spreading ticks if N > 50.
 *
 * Per IPIV-5 default: simulateFailure is a dev-only number sourced from
 * the URL `?simulateFailure=N` query param (gated upstream in page.tsx
 * by NODE_ENV === 'development'). When > 0, the first N included assets
 * are reported as failed at the end of the progress sweep.
 *
 * Cleanup: clears all pending timeouts on unmount OR when phase leaves
 * 'committing' (e.g., user cancels via not-yet-built UX or a re-render
 * causes the hook to teardown).
 */

'use client'

import { useEffect, useRef } from 'react'
import { useUploadContext } from './UploadContext'

const MAX_TOTAL_MS = 5_000 // Cap full progress sweep at 5s for large batches.
const PER_ASSET_MS = 100 // Default per-asset tick duration.

interface Options {
  /** Dev-only failure injection. null = no simulated failure. */
  simulateFailure: number | null
}

export function useCommitSimulation({ simulateFailure }: Options): void {
  const { state, dispatch } = useUploadContext()
  const phase = state.commit.phase
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (phase !== 'committing') {
      // Cleanup if anything was queued from a prior committing phase.
      for (const t of timeoutsRef.current) clearTimeout(t)
      timeoutsRef.current = []
      return
    }

    // Snapshot the included asset ids for this commit run. Subsequent
    // state changes (e.g., user toggles excluded) shouldn't shift the
    // simulation mid-flight.
    const includedIds = state.assetOrder.filter(
      id => state.assetsById[id] && !state.assetsById[id].excluded,
    )
    const n = includedIds.length

    if (n === 0) {
      // Nothing to commit — terminate immediately as success.
      const t = setTimeout(() => dispatch({ type: 'COMMIT_SUCCEEDED' }), 0)
      timeoutsRef.current.push(t)
      return () => {
        clearTimeout(t)
        timeoutsRef.current = []
      }
    }

    const tickMs = Math.min(PER_ASSET_MS, Math.floor(MAX_TOTAL_MS / n))

    for (let i = 0; i < n; i++) {
      const id = includedIds[i]
      const t = setTimeout(() => {
        dispatch({ type: 'COMMIT_PROGRESS_UPDATE', assetId: id, progress: 100 })
      }, tickMs * (i + 1))
      timeoutsRef.current.push(t)
    }

    // Terminal dispatch — fires after all per-asset ticks. Either success
    // or, if dev failure injection is on, partial-failure with the first
    // simulateFailure asset ids reported as failed.
    const finalT = setTimeout(
      () => {
        if (simulateFailure && simulateFailure > 0) {
          const failedIds = includedIds.slice(0, Math.min(simulateFailure, n))
          dispatch({
            type: 'COMMIT_PARTIALLY_FAILED',
            failed: failedIds.map(id => ({
              assetId: id,
              error: 'Simulated failure (dev)',
            })),
          })
        } else {
          dispatch({ type: 'COMMIT_SUCCEEDED' })
        }
      },
      tickMs * (n + 1),
    )
    timeoutsRef.current.push(finalT)

    return () => {
      for (const t of timeoutsRef.current) clearTimeout(t)
      timeoutsRef.current = []
    }
    // We intentionally only re-run when phase transitions. Re-running on
    // assetOrder/assetsById changes mid-commit would cancel the in-flight
    // simulation and restart it with a moving target. The snapshot at
    // commit-start is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dispatch, simulateFailure])
}
