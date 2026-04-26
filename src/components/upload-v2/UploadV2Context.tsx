// ═══════════════════════════════════════════════════════════════
// DORMANT — replaced by C2 (new shell at app/vault/upload/).
// Scheduled for deletion at the explicit cutover PR (PR 5+).
// DO NOT extend. DO NOT import from production code paths.
// See docs/upload/C2-PLAN.md §3.3 for the coexistence rule.
// ═══════════════════════════════════════════════════════════════
'use client'

import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react'
import { v2Reducer, createV2InitialState, type V2Action } from '@/lib/upload/v2-state'
import type { V2State } from '@/lib/upload/v2-types'
import { SimulationEngine } from '@/lib/upload/v2-simulation-engine'
import type { MockScenario } from '@/lib/upload/v2-mock-scenarios'

interface UploadV2ContextValue {
  state: V2State
  dispatch: (action: V2Action) => void
  startAnalysis: (scenario: MockScenario, assetIds: string[]) => void
}

const UploadV2Context = createContext<UploadV2ContextValue | null>(null)

export function UploadV2Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(v2Reducer, null, createV2InitialState)
  const engineRef = useRef<SimulationEngine | null>(null)

  const startAnalysis = useCallback((scenario: MockScenario, assetIds: string[]) => {
    // Destroy any previous simulation engine
    engineRef.current?.destroy()

    const engine = new SimulationEngine(scenario, assetIds, dispatch)
    engineRef.current = engine
    engine.start()
  }, [])

  return (
    <UploadV2Context.Provider value={{ state, dispatch, startAnalysis }}>
      {children}
    </UploadV2Context.Provider>
  )
}

export function useUploadV2() {
  const ctx = useContext(UploadV2Context)
  if (!ctx) throw new Error('useUploadV2 must be used within UploadV2Provider')
  return ctx
}