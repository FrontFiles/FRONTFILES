'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BoltSessionRequest,
  BoltSessionResponse,
  DiscoveryScope,
} from '@/lib/bolt/types'
import { scopeHash, scopeIsEmpty, summarizeScope } from '@/lib/bolt/scope'

export type BoltPanelState =
  | { status: 'closed' }
  | { status: 'no_scope' }
  | { status: 'loading'; scopeSummary: string }
  | { status: 'ready'; briefing: BoltSessionResponse }
  | { status: 'partial'; briefing: BoltSessionResponse }
  | { status: 'error'; message: string; canRetry: boolean }

/**
 * Preview activation state.
 *
 * Three independent stored fields, one derived value. The derived
 * `activeResultId` is the single source of truth for the preview surface;
 * consumers never combine hover/focus/selected themselves.
 *
 * Precedence: hover > focus > selected > null.
 * - hover: transient pointer inspection
 * - focus: transient keyboard inspection
 * - selected: persistent anchor (set on click)
 *
 * All three reset on run(), close(), and on any scope change — the same
 * lifecycle as the rest of BOLT session state.
 */
export interface BoltPreviewActivation {
  selectedResultId: string | null
  hoveredResultId: string | null
  focusedResultId: string | null
  activeResultId: string | null
  setSelectedResult: (id: string | null) => void
  setHoveredResult: (id: string | null) => void
  setFocusedResult: (id: string | null) => void
}

export interface BoltSessionApi {
  state: BoltPanelState
  preview: BoltPreviewActivation
  run: (refinement?: string) => Promise<void>
  close: () => void
}

export function useBoltSession(scope: DiscoveryScope): BoltSessionApi {
  const [state, setState] = useState<BoltPanelState>({ status: 'closed' })
  const abortRef = useRef<AbortController | null>(null)

  // Preview activation — lives next to panel state so the whole BOLT
  // state graph is inspectable from a single hook instance.
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [hoveredResultId, setHoveredResultId] = useState<string | null>(null)
  const [focusedResultId, setFocusedResultId] = useState<string | null>(null)

  const resetPreview = useCallback(() => {
    setSelectedResultId(null)
    setHoveredResultId(null)
    setFocusedResultId(null)
  }, [])

  const close = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState({ status: 'closed' })
    resetPreview()
  }, [resetPreview])

  const run = useCallback(
    async (refinement?: string) => {
      // Every run() is a fresh inspection: clear any previous selection /
      // hover / focus so the next briefing starts with no stale anchors.
      resetPreview()

      if (scopeIsEmpty(scope)) {
        setState({ status: 'no_scope' })
        return
      }

      // Cancel any in-flight request before kicking a new one.
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const scopeSummary = summarizeScope(scope)
      setState({ status: 'loading', scopeSummary })

      try {
        const body: BoltSessionRequest = {
          scope,
          refinement,
          scopeHash: scopeHash(scope),
        }
        const res = await fetch('/api/bolt/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })

        if (!res.ok) {
          if (res.status === 422) {
            setState({ status: 'no_scope' })
            return
          }
          const errBody = (await res.json().catch(() => null)) as
            | { message?: string }
            | null
          setState({
            status: 'error',
            message:
              errBody?.message ??
              `Context Source could not complete this briefing. (HTTP ${res.status})`,
            canRetry: res.status >= 500,
          })
          return
        }

        const briefing = (await res.json()) as BoltSessionResponse
        const anyNonReady = briefing.sections.some(s => s.status !== 'ready')
        setState({
          status: anyNonReady ? 'partial' : 'ready',
          briefing,
        })
      } catch (err) {
        // Aborted by close() or by a fresh run() — not an error state.
        if ((err as Error)?.name === 'AbortError') return
        setState({
          status: 'error',
          message: 'Context Source could not complete this briefing.',
          canRetry: true,
        })
      }
    },
    [scope, resetPreview]
  )

  // Abort on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const preview: BoltPreviewActivation = useMemo(
    () => ({
      selectedResultId,
      hoveredResultId,
      focusedResultId,
      // Single derived source of truth. Precedence: hover > focus > selected.
      activeResultId:
        hoveredResultId ?? focusedResultId ?? selectedResultId ?? null,
      setSelectedResult: setSelectedResultId,
      setHoveredResult: setHoveredResultId,
      setFocusedResult: setFocusedResultId,
    }),
    [selectedResultId, hoveredResultId, focusedResultId]
  )

  return { state, preview, run, close }
}
