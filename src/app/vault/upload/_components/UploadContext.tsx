/**
 * Frontfiles Upload V3 — Context
 *
 * Provides V3 reducer state + dispatch to the new vault-upload shell and
 * its descendant components. Dedicated context per IPI-4 (don't touch the
 * dormant v2 UploadV2Context).
 */

'use client'

import { createContext, useContext, type Dispatch, type ReactNode } from 'react'
import type { V3Action, V3State } from '@/lib/upload/v3-types'

interface UploadContextValue {
  state: V3State
  dispatch: Dispatch<V3Action>
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function UploadContextProvider({
  state,
  dispatch,
  children,
}: {
  state: V3State
  dispatch: Dispatch<V3Action>
  children: ReactNode
}) {
  return (
    <UploadContext.Provider value={{ state, dispatch }}>
      {children}
    </UploadContext.Provider>
  )
}

export function useUploadContext(): UploadContextValue {
  const ctx = useContext(UploadContext)
  if (!ctx) {
    throw new Error(
      'useUploadContext must be used inside <UploadContextProvider>. ' +
        'The V3 upload shell mounts this provider at app/vault/upload/_components/UploadShell.tsx.',
    )
  }
  return ctx
}
