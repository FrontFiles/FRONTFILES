'use client'

import { USER_TYPE_LABELS } from '@/lib/types'
import { useViewer, isInCreatorMode } from '@/lib/identity/permissions'
import type { ReactNode } from 'react'

/**
 * Route-level guard for creator-only pages (upload, composer, pricing, settlements).
 * Renders children when the viewer is currently operating in creator mode this
 * session. Shows a denial message otherwise.
 *
 * Implementation note: the viewer-mode check is delegated to the centralized
 * `isInCreatorMode` predicate in `lib/identity/permissions.ts` so every UI
 * surface that gates on "operating as creator" reads from the same helper.
 * The denial copy still uses `activeUserType` directly because it needs the
 * specific role label to display; the predicate's job is the gate, not the copy.
 */
export function CreatorGate({ children, tool }: { children: ReactNode; tool: string }) {
  const viewer = useViewer()

  if (!isInCreatorMode(viewer)) {
    const activeLabel = viewer.activeUserType
      ? USER_TYPE_LABELS[viewer.activeUserType]
      : 'a non-creator'
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <span className="text-lg font-black text-black">!</span>
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-black mb-3">Creator access required</h2>
          <p className="text-xs text-slate-500">
            {tool} is only available when operating as a Creator. You are currently viewing as {activeLabel}.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
