'use client'

import { use, useEffect, useState } from 'react'
import { ProfileLeftRail } from '@/components/platform/ProfileLeftRail'
import { ProfileContent } from '@/components/platform/ProfileContent'
import { useUser } from '@/lib/user-context'
import {
  getConnectionState,
  getCreatorAssets,
  getCreatorStories,
  getCreatorArticles,
  getCreatorCollections,
  getCreatorEvents,
} from '@/data'
import { buildCreatorProfileFromShell } from '@/data/profiles'
import { getCreatorPortfolioShellByHandle } from '@/lib/identity/store'
import type { UserWithFacets } from '@/lib/identity/types'
import type { CreatorProfile } from '@/lib/types'

export default function CreatorProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const { sessionUser } = useUser()

  // Live portfolio-shell fetch — see the block comment in the
  // frontfolio page for the Option C rationale. All hooks are
  // declared up front so the hooks array is stable across the
  // loading → loaded transition.
  const [shell, setShell] = useState<UserWithFacets | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCreatorPortfolioShellByHandle(handle).then((s) => {
      if (cancelled) return
      setShell(s)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [handle])

  // When `handle` changes, `shell` still holds the previous
  // creator's data until the effect re-runs and resolves the new
  // shell. We can't reset `shell`/`loaded` inside the effect body
  // (`react-hooks/set-state-in-effect` flags that as a cascading
  // render). Instead we derive staleness during render: if the
  // loaded shell's username no longer matches the current handle,
  // treat it as loading until the new fetch lands.
  const isStale = shell !== null && shell.user.username !== handle
  if (!loaded || isStale) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Loading profile…</p>
        </div>
      </div>
    )
  }

  const profile: CreatorProfile | null = shell
    ? buildCreatorProfileFromShell(shell)
    : null
  const creatorId: string | null = shell?.user.id ?? null

  if (!profile || !creatorId) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-sm font-bold uppercase tracking-widest text-black">Creator not found</h1>
          <p className="text-xs text-slate-400 mt-2">No profile matches the handle &ldquo;{handle}&rdquo;</p>
        </div>
      </div>
    )
  }

  const connectionState = getConnectionState(sessionUser.username, handle)
  const assets = getCreatorAssets(creatorId)
  const stories = getCreatorStories(creatorId)
  const articles = getCreatorArticles(creatorId)
  const collections = getCreatorCollections(creatorId)
  const events = getCreatorEvents(creatorId)

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <ProfileLeftRail profile={profile} connectionState={connectionState} />
        <ProfileContent
          profile={profile}
          events={events}
          assets={assets}
          stories={stories}
          articles={articles}
          collections={collections}
          creatorId={creatorId}
        />
      </div>
    </div>
  )
}
