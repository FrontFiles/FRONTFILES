// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Global Share Composer Mount
//
// One <ShareComposer> instance for the whole app, mounted in the
// root layout. Reads open state from the draft store so any
// "Share" button (header nav, /feed, /creator/[handle]/posts)
// just calls `openComposer()` to fire it.
//
// Feature flag: when FFF Sharing is disabled, the component
// renders nothing. The hooks still run so the React tree
// stays consistent across navigations.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useDraftStore } from '@/lib/post/draft-store'
import { useUser } from '@/lib/user-context'
import { isFffSharingEnabled } from '@/lib/flags'
import { ShareComposer } from './ShareComposer'

export function GlobalShareComposer() {
  const { sessionUser } = useUser()
  const { composerOpen, composerRepostOf, closeComposer } = useDraftStore()

  if (!isFffSharingEnabled()) return null

  return (
    <ShareComposer
      open={composerOpen}
      onClose={closeComposer}
      sessionUser={sessionUser}
      initialRepostOf={composerRepostOf}
    />
  )
}
