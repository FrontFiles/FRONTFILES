'use client'

// ═══════════════════════════════════════════════════════════════
// COMPOSER — Context Provider
// Wraps useReducer and exposes state + dispatch via React Context
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { ComposerState, ComposerAction } from './types'
import { createInitialComposerState } from './types'
import { composerReducer } from './reducer'
import { detectSelfSource } from './split-engine'

/** Mock creator ID — in production this comes from auth */
const LOGGED_IN_CREATOR_ID = 'creator-001'

interface ComposerContextValue {
  state: ComposerState
  dispatch: React.Dispatch<ComposerAction>
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(composerReducer, undefined, createInitialComposerState)

  // Auto-detect self-source exception when source assets change
  useEffect(() => {
    const isSelfSource = detectSelfSource(state, LOGGED_IN_CREATOR_ID)
    if (isSelfSource !== state.split.selfSourceException) {
      dispatch({ type: 'SET_SELF_SOURCE_EXCEPTION', payload: isSelfSource })
    }
  }, [state.sourceAssetIds, state.split.selfSourceException])

  return (
    <ComposerContext.Provider value={{ state, dispatch }}>
      {children}
    </ComposerContext.Provider>
  )
}

export function useComposer(): ComposerContextValue {
  const ctx = useContext(ComposerContext)
  if (!ctx) throw new Error('useComposer must be used within ComposerProvider')
  return ctx
}
