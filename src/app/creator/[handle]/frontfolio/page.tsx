'use client'

import Link from 'next/link'
import { use, useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { GridToolbar, type OverlayMode } from '@/components/discovery/GridToolbar'
import { gridLayoutClass } from '@/lib/grid-layout'
import { useUser } from '@/lib/user-context'
import {
  getConnectionState,
  getCreatorAssets,
  getCreatorStories,
  getCreatorCollections,
  socialCounts,
} from '@/data'
import { buildCreatorProfileFromShell } from '@/data/profiles'
import { getCreatorPortfolioShellByHandle } from '@/lib/identity/store'
import type { UserWithFacets } from '@/lib/identity/types'
import { LikeButton } from '@/components/social/LikeButton'
import { CommentCount } from '@/components/social/CommentSection'
import { Avatar } from '@/components/discovery/Avatar'
import { useOnboardingCompletion } from '@/hooks/useOnboardingCompletion'
import { OnboardingChecklistSlot } from '@/components/onboarding/OnboardingChecklistSlot'
import type { VaultAsset, Story, Collection, CreatorProfile } from '@/lib/types'
import { resolveProtectedUrl, resolveProtectedMediaUrl } from '@/lib/media/delivery-policy'
import {
  isPublishedPublicAsset,
  isPublishedPublicStory,
  isPublicCollection,
} from '@/lib/asset/visibility'

// ═══════════════════════════════════════════════
// FRONTFOLIO PAGE
// Creator profile + portfolio archive
// ═══════════════════════════════════════════════

const FRONTFOLIO_FORMATS = ['All', 'Article', 'Story', 'Collection', 'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const
const FRONTFOLIO_ENTITY_FILTERS = ['All', 'Article', 'Story', 'Collection'] as const
const FRONTFOLIO_FORMAT_FILTERS = ['Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

export default function FrontfolioPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const { sessionUser } = useUser()
  // Progressive-onboarding activation flags. Read at the top
  // of the component (before any early return) so this hook
  // always runs in the same order per render, per React's
  // rules of hooks. The flags come from user-context state
  // (grants + facets), never from the onboarding wizard.
  const onboardingCompletion = useOnboardingCompletion()

  // ── Live portfolio-shell fetch (Option C) ──
  //
  // The old sync reads through `getCreatorProfile(handle)` +
  // `resolveCreatorId(handle)` were module-load snapshots that
  // could not see newly-onboarded creators. The live reader
  // `getCreatorPortfolioShellByHandle` goes through the
  // canonical identity store and returns either the full shell
  // (user + creator_profiles row + grants) or `null` when the
  // handle is unknown / not a visible creator.
  //
  // All state hooks (shell, loaded, filters, toggles, …) are
  // declared BEFORE any early return so the hooks array is
  // stable across the loading → loaded transition. React's
  // rules of hooks require this; an early return on `!loaded`
  // that skips later `useState` calls would crash on mount.
  const [shell, setShell] = useState<UserWithFacets | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [viewMode, setViewMode] = useState<'grid4' | 'grid2' | 'grid1' | 'list'>('grid4')
  const [overlay, setOverlay] = useState<OverlayMode>('data')
  const [formatFilters, setFormatFilters] = useState<Set<string>>(new Set(['All']))
  const [railOpen, setRailOpen] = useState(true)
  const [frontfolioOpen, setFrontfolioOpen] = useState(true)

  const toggleFormat = useCallback((f: string) => {
    setFormatFilters(prev => {
      if (f === 'All') return new Set(['All'])
      const next = new Set(prev)
      next.delete('All')
      if (next.has(f)) next.delete(f); else next.add(f)
      return next.size === 0 ? new Set(['All']) : next
    })
  }, [])

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

  // Render an empty shell while the live fetch resolves so the
  // page never flashes a bogus 404 during the async round-trip
  // to the identity store.
  //
  // When `handle` changes between renders (e.g. navigating from
  // /creator/a/frontfolio to /creator/b/frontfolio without a
  // remount), `shell` still holds the previous creator's data
  // until the effect re-runs. We can't reset `shell`/`loaded`
  // inside the effect body (`react-hooks/set-state-in-effect`
  // flags that as a cascading render). Instead, derive staleness
  // during render: if the loaded shell's username no longer
  // matches the current handle, treat it as loading until the
  // new fetch lands.
  const isStale = shell !== null && shell.user.username !== handle
  if (!loaded || isStale) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Loading frontfolio…</p>
        </div>
      </div>
    )
  }

  const profile: CreatorProfile | null = shell
    ? buildCreatorProfileFromShell(shell)
    : null
  // `creatorId` is the canonical `users.id` on the shell — no
  // more module-load `creatorBySlug` lookup. Content adapters
  // (`getCreatorAssets` etc.) still key off this id exactly as
  // before.
  const creatorId: string | null = shell?.user.id ?? null

  if (!profile || !creatorId) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-sm font-bold uppercase tracking-widest text-black">Creator not found</h1>
          <p className="text-xs text-slate-400 mt-2">No frontfolio matches the handle &ldquo;{handle}&rdquo;</p>
        </div>
      </div>
    )
  }

  const connectionState = getConnectionState(sessionUser.username, handle)
  const allCreatorAssets = getCreatorAssets(creatorId)
  const allCreatorStories = getCreatorStories(creatorId)
  const allCreatorCollections = getCreatorCollections(creatorId)

  // Phase C — self-view detection.
  // Render the inline `EditPencil` affordances on the identity
  // rail only when the visiting user is the owner of this
  // frontfolio. Uses canonical handle/username comparison —
  // safe even if `sessionUser.username` is case-mismatched.
  //
  // The creator's onboarding checklist slot (rendered inside
  // `<main>` below) is gated on this flag so a creator's
  // activation prompts never leak into someone else's public
  // frontfolio view.
  const isSelfView =
    sessionUser.username.toLowerCase() === handle.toLowerCase()

  // Centralized visibility predicates — see `lib/asset/visibility`.
  const publicAssets = allCreatorAssets.filter(isPublishedPublicAsset)
  const heroAsset = publicAssets.find(a => a.id) || null
  const publicStories = allCreatorStories.filter(isPublishedPublicStory)
  const publicCollections = allCreatorCollections.filter(isPublicCollection)

  const showAll = formatFilters.has('All')

  // Filter assets by format
  const filteredAssets = showAll
    ? publicAssets
    : publicAssets.filter(a => formatFilters.has(a.format.charAt(0).toUpperCase() + a.format.slice(1)))

  // Show stories/collections based on filter
  const showStories = showAll || formatFilters.has('Story')
  const showCollections = showAll || formatFilters.has('Collection')
  // Article filter shows text-format assets (articles are long-form text)
  const showArticles = showAll || formatFilters.has('Article')

  // Counts per format for the filter bar
  const formatCountMap: Record<string, number> = {
    All: publicAssets.length + publicStories.length + publicCollections.length,
    Article: publicAssets.filter(a => a.format === 'text').length,
    Story: publicStories.length,
    Collection: publicCollections.length,
  }
  publicAssets.forEach(a => {
    const key = a.format.charAt(0).toUpperCase() + a.format.slice(1)
    formatCountMap[key] = (formatCountMap[key] || 0) + 1
  })

  // Build format inventory from assets
  const formatCounts = publicAssets.reduce<Record<string, number>>((acc, a) => {
    acc[a.format] = (acc[a.format] || 0) + 1
    return acc
  }, {})
  const activeFormats = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])

  // Detect "new" assets (last 7 days)
  const now = Date.now()
  const recentIds = new Set(
    publicAssets.filter(a => a.uploadedAt && (now - new Date(a.uploadedAt).getTime()) < 7 * 86400000).map(a => a.id)
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {/* Always-visible breadcrumb + collapse toggle */}
      <div className="bg-white shrink-0">
        <div className="px-6 flex items-center gap-1.5 h-8">
          <Link href="/search" className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#00008b]">Frontfiles</Link>
          <span className="text-[10px] text-black/20">/</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">{profile.displayName}</span>
          <button
            onClick={() => setRailOpen(r => !r)}
            className="ml-1 w-5 h-5 flex items-center justify-center text-black/30 hover:text-black transition-colors"
            title={railOpen ? 'Collapse profile' : 'Expand profile'}
          >
            <svg className={cn('w-3 h-3 transition-transform', railOpen ? 'rotate-0' : 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left column: CreatorDetailRail with identity at top — collapsible */}
        {railOpen && (
          <CreatorDetailRail profile={profile} connectionCount={connectionState.connections} isSelfView={isSelfView} />
        )}

        {/* Main content — hero + frontfolio */}
        <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Onboarding checklist plug point — self-view only.
            Renders null today; the future checklist will hang
            off `onboardingCompletion` without any further shell
            edits. Guarded by `isSelfView` so a creator's
            activation prompts never appear on another creator's
            public frontfolio. */}
        {isSelfView && (
          <OnboardingChecklistSlot
            flags={onboardingCompletion}
            surface="creator"
          />
        )}
        {/* Hero cover strip */}
        {heroAsset?.id && (
          <div className="w-full h-64 md:h-80 overflow-hidden bg-slate-100 relative">
              <img
                src={resolveProtectedUrl(heroAsset.id, 'preview')}
                alt={heroAsset.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          </div>
        )}
        {/* Sticky header: name + format bar */}
        <div className="sticky top-0 z-30 bg-white">
        <div className="px-8 pt-5 pb-0">
          <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setFrontfolioOpen(o => !o)}
                className="w-5 h-5 flex items-center justify-center text-black/30 hover:text-black transition-colors shrink-0"
                title={frontfolioOpen ? 'Collapse frontfolio' : 'Expand frontfolio'}
              >
                <svg className={cn('w-3 h-3 transition-transform', frontfolioOpen ? 'rotate-90' : '-rotate-90')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <h2 className="text-[26px] font-serif italic text-black tracking-tight leading-none">{profile.displayName.split(' ')[0]}&apos;s Frontfolio</h2>
          </div>

          {frontfolioOpen && (
              <GridToolbar
                filters={FRONTFOLIO_FORMATS.map(f => ({ label: f, value: f, count: formatCountMap[f] || 0 }))}
                filterGroups={{
                  primary: FRONTFOLIO_ENTITY_FILTERS.map(f => ({ label: f, value: f, count: formatCountMap[f] || 0 })),
                  secondary: FRONTFOLIO_FORMAT_FILTERS.map(f => ({ label: f, value: f, count: formatCountMap[f] || 0 })),
                }}
                activeFilters={formatFilters}
                onToggleFilter={toggleFormat}
                overlay={overlay}
                onOverlayChange={setOverlay}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
          )}
        </div>
        </div>
        {/* End sticky header */}
        {frontfolioOpen && (
        <div className="px-8 pb-7 pt-5">
              {filteredAssets.length > 0 && <PhotosGrid assets={filteredAssets} recentIds={recentIds} viewMode={viewMode} overlay={overlay} />}
              {showStories && publicStories.length > 0 && (
                <div className={filteredAssets.length > 0 ? 'mt-8' : ''}>
                  <StoriesGrid stories={publicStories} viewMode={viewMode} profile={profile} />
                </div>
              )}
              {showCollections && publicCollections.length > 0 && (
                <div className={(filteredAssets.length > 0 || showStories) ? 'mt-8' : ''}>
                  <CollectionsGrid collections={publicCollections} viewMode={viewMode} />
                </div>
              )}
        </div>
        )}

        <FrontfolioFooter />
        </main>
      </div>
    </div>
  )
}

const ALL_FORMATS = ['photo', 'video', 'audio', 'text', 'infographic', 'illustration', 'vector'] as const

function getSocialPlatform(url: string): { icon: React.ReactNode; bg: string } {
  if (url.includes('linkedin')) return {
    bg: 'bg-[#0077b5] text-white hover:bg-[#005582]',
    icon: <span className="text-[7px] font-black">in</span>,
  }
  if (url.includes('twitter') || url.includes('x.com')) return {
    bg: 'bg-black text-white hover:bg-black/80',
    icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  }
  if (url.includes('instagram')) return {
    bg: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white hover:opacity-80',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>,
  }
  if (url.includes('facebook')) return {
    bg: 'bg-[#1877f2] text-white hover:bg-[#0d65d9]',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  }
  if (url.includes('flickr')) return {
    bg: 'bg-[#0063dc] text-white hover:bg-[#004fb3]',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="12" r="4.5" /><circle cx="17" cy="12" r="4.5" fill="#ff0084" /></svg>,
  }
  if (url.includes('youtube')) return {
    bg: 'bg-[#ff0000] text-white hover:bg-[#cc0000]',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>,
  }
  if (url.includes('tiktok')) return {
    bg: 'bg-black text-white hover:bg-black/80',
    icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.16 8.16 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z" /></svg>,
  }
  if (url.includes('vimeo')) return {
    bg: 'bg-[#1ab7ea] text-white hover:bg-[#0fa2d1]',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.48 4.807z" /></svg>,
  }
  // Default
  return {
    bg: 'bg-black text-white hover:bg-black/80',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  }
}

function CreatorDetailRail({ profile, connectionCount, isSelfView }: {
  profile: CreatorProfile
  connectionCount: number
  isSelfView: boolean
}) {
  return (
    <aside className="w-80 border-r-2 border-black bg-white shrink-0 overflow-y-auto">
      {/* ── IDENTITY HEADER (was CreatorBar) ── */}
      <div className="border-b-2 border-black">
        {/* Avatar — full-width */}
        {profile.avatarUrl && (
          <div className="w-full aspect-square overflow-hidden bg-slate-100 relative">
            <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover object-[center_20%]" />
            <div className="absolute top-0 right-0 w-0 h-0" style={{ borderLeft: '48px solid transparent', borderTop: '48px solid rgb(0, 0, 255)' }} />
          </div>
        )}

        {/* Name + badges + title + location */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="relative group/verified shrink-0">
              <div className="w-4 h-4 bg-[#0000ff] flex items-center justify-center">
                <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-white"><path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/verified:opacity-100 transition-opacity pointer-events-none z-10">Frontfiles Creator</div>
            </div>
            {profile.foundingMember && (
              <div className="relative group/fm shrink-0">
                <div className="w-4 h-4 bg-black flex items-center justify-center"><span className="text-white text-[7px] font-bold">FM</span></div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/fm:opacity-100 transition-opacity pointer-events-none z-10">Founding Member</div>
              </div>
            )}
            <h1 className="text-lg font-black text-black tracking-tight leading-none">{profile.displayName}</h1>
            {isSelfView && (
              <span className="ml-auto">
                <EditPencil section="overview" label="name, title, biography" />
              </span>
            )}
          </div>
          <p className="text-[10px] text-black/40 uppercase tracking-widest font-bold leading-none">{profile.professionalTitle}</p>

          <div className="flex items-center gap-2 mt-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-black/30 shrink-0"><path d="M8 1C5 1 2.5 3.5 2.5 6.5 2.5 10.5 8 15 8 15s5.5-4.5 5.5-8.5C13.5 3.5 11 1 8 1z" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>
            <span className="text-[10px] text-black/40 leading-none">{profile.locationBase}</span>
          </div>

          <div className="flex items-center gap-3 mt-2 text-[9px] text-black/30">
            <span><strong className="text-black font-bold">{connectionCount}</strong> connections</span>
          </div>

          <ExpandableBio text={profile.biography} maxLines={2} />
        </div>

        {/* Action buttons — stacked */}
        <div className="px-5 pb-4 flex flex-col gap-2">
          <HeaderAssignButton />
          <a href={`/messages?to=${profile.username}`} className="h-11 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-colors w-full">Message</a>
          <ConnectButton />

          {/* Social icons */}
          <div className="flex items-center gap-1.5 mt-1">
            {profile.alsoMeLinks.map((link, i) => {
              const platform = getSocialPlatform(link)
              return (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer" className={cn('w-7 h-7 flex items-center justify-center transition-colors cursor-pointer', platform.bg)}>
                  {platform.icon}
                </a>
              )
            })}
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center border border-black/10 text-black/40 hover:border-black hover:text-black transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── DETAIL SECTIONS ── */}
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Skill pool */}
        {(isSelfView || [...(profile.specialisations ?? []), ...(profile.skills ?? [])].length > 0) && (
          <div className="border-t border-black/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">Skill pool</span>
              {isSelfView && <EditPencil section="practice" label="skills" />}
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {[...(profile.specialisations ?? []), ...(profile.skills ?? [])].map((s, i) => (
                <span key={i} className="border-2 border-black text-[7px] font-bold uppercase tracking-[0.08em] text-black px-1.5 py-[2px] leading-tight truncate">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Coverage & specializations */}
        {(isSelfView || [...new Set([...(profile.coverageAreas ?? []), ...(profile.specialisations ?? [])])].length > 0) && (
          <div className="border-t border-black/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">Coverage & specializations</span>
              {isSelfView && <EditPencil section="coverage" label="coverage areas" />}
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {[...new Set([...(profile.coverageAreas ?? []), ...(profile.specialisations ?? [])])].map((item, i) => (
                <span key={i} className="border-2 border-black text-[7px] font-bold uppercase tracking-[0.08em] text-black px-1.5 py-[2px] leading-tight truncate">{item}</span>
              ))}
            </div>
          </div>
        )}

        {/* Affiliations & accreditations */}
        {(isSelfView || (profile.mediaAffiliations?.length ?? 0) + (profile.pressAccreditations?.length ?? 0) > 0) && (
          <div className="border-t border-black/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">Affiliations & accreditations</span>
              {isSelfView && <EditPencil section="press" label="press record" />}
            </div>
            <div className="flex flex-col gap-1">
              {(profile.mediaAffiliations ?? []).map((a, i) => (
                <span key={`a-${i}`} className="text-[9px] font-bold text-black leading-tight">{a}</span>
              ))}
              {(profile.pressAccreditations ?? []).map((a, i) => (
                <span key={`p-${i}`} className="text-[9px] text-black/50 leading-tight">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Published works */}
        {(isSelfView || (profile.publishedIn?.length ?? 0) > 0) && (
          <div className="border-t border-black/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">Published works</span>
              {isSelfView && <EditPencil section="press" label="published in" />}
            </div>
            <div className="flex flex-col gap-2.5">
              {(profile.publishedIn ?? []).map((pub, i) => {
                const pubMeta = PUBLICATION_META[pub] || { type: 'Magazine', color: 'bg-black/5', desc: 'Editorial contributions' }
                return (
                  <div key={i} className="flex items-start gap-2.5 group cursor-pointer">
                    <div className={`w-8 h-10 ${pubMeta.color} border border-black/10 flex items-center justify-center shrink-0`}>
                      <span className="text-[5px] font-black text-black/40 uppercase leading-none tracking-tight">{pub.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-black leading-none group-hover:text-[#0000ff] transition-colors">{pub}</p>
                      <p className="text-[7px] text-black/25 uppercase tracking-wider mt-0.5">{pubMeta.type}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Last verified + disclaimer */}
        {profile.lastVerifiedAt && (
          <div className="border-t border-black/10 pt-3">
            <span className="font-mono text-[9px] text-black/30">
              Last verified: {new Date(profile.lastVerifiedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <p className="text-[8px] text-black/20 leading-relaxed mt-2">
              Frontfiles certifies provenance and file history. It does not verify factual accuracy or act as an editorial truth authority.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

// ══════════════════════════════════════════════════════
// PUBLICATION META — mock publication types
// ══════════════════════════════════════════════════════

const PUBLICATION_META: Record<string, { type: string; color: string; desc: string }> = {
  'Reuters': { type: 'Wire service', color: 'bg-slate-100', desc: 'International wire coverage and breaking news dispatches' },
  'South China Morning Post': { type: 'Newspaper', color: 'bg-slate-50', desc: 'Asia-Pacific reporting and regional analysis' },
  'Foreign Policy': { type: 'Magazine', color: 'bg-[#0000ff]/5', desc: 'Long-form geopolitical analysis and policy reporting' },
  'The Guardian': { type: 'Newspaper', color: 'bg-slate-100', desc: 'International correspondent reporting and features' },
  'Al Jazeera': { type: 'Broadcast', color: 'bg-slate-50', desc: 'Broadcast journalism and documentary work' },
  'BBC': { type: 'Broadcast', color: 'bg-slate-100', desc: 'Broadcast journalism and world service reporting' },
  'The New York Times': { type: 'Newspaper', color: 'bg-slate-100', desc: 'Investigative reporting and editorial features' },
  'Associated Press': { type: 'Wire service', color: 'bg-slate-50', desc: 'International wire coverage and field dispatches' },
}

// ══════════════════════════════════════════════════════
// EDIT PENCIL — self-view section edit affordance
//
// Phase C: the pencil is now a real deep link into the
// `/account/profile` editor, driven by an `?section=` query
// param so the editor can scroll the matching section into
// view. It is only rendered when the page computes
// `isSelfView` — see `FrontfolioPage` for the comparison.
// ══════════════════════════════════════════════════════

type ProfileEditorSection = 'overview' | 'coverage' | 'press' | 'practice'

function EditPencil({ section, label }: {
  section: ProfileEditorSection
  label: string
}) {
  return (
    <Link
      href={`/account/profile?section=${section}`}
      title={`Edit ${label}`}
      aria-label={`Edit ${label}`}
      className="w-5 h-5 flex items-center justify-center text-black/30 hover:text-[#0000ff] transition-colors shrink-0 border border-transparent hover:border-[#0000ff]"
    >
      <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3">
        <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

// ══════════════════════════════════════════════════════
// ASSIGN BUTTON (header variant)
// ══════════════════════════════════════════════════════

function HeaderAssignButton() {
  return (
    <Link
      href="/assignment/new"
      className={cn(
        'h-11 w-full text-[10px] font-bold uppercase tracking-[0.12em] transition-colors border-2 flex items-center justify-center',
        'bg-white text-black border-black hover:bg-black hover:text-white'
      )}
    >
      Assign me to
    </Link>
  )
}

// ══════════════════════════════════════════════════════
// CONNECT BUTTON (inline — frontfolio header variant)
// ══════════════════════════════════════════════════════

function ConnectButton() {
  const [state, setState] = useState<'disconnected' | 'connected' | 'blocked'>('disconnected')
  const [showMenu, setShowMenu] = useState(false)

  function handleClick() {
    if (state === 'disconnected') setState('connected')
    else if (state === 'connected') setShowMenu(m => !m)
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={cn(
          'h-11 w-full text-[10px] font-bold uppercase tracking-[0.12em] transition-colors border-2 flex items-center justify-center gap-2',
          state === 'connected'
            ? 'bg-[#0000ff] text-white border-[#0000ff] hover:bg-[#0000cc]'
            : state === 'blocked'
            ? 'bg-white text-black/30 border-black/20'
            : 'bg-white text-[#0000ff] border-[#0000ff] hover:bg-[#0000ff] hover:text-white'
        )}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L4.09 12.64a1 1 0 0 0 .78 1.63H11l-1 7.73L19.91 11.36a1 1 0 0 0-.78-1.63H13l1-7.73z" />
        </svg>
        {state === 'connected' ? 'Connected' : state === 'blocked' ? 'Blocked' : 'Connect'}
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border-2 border-black bg-white shadow-lg">
            <button
              onClick={() => { setState('disconnected'); setShowMenu(false) }}
              className="w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black hover:bg-black/5 transition-colors text-left"
            >
              Disconnect
            </button>
            <button
              onClick={() => { setState('blocked'); setShowMenu(false) }}
              className="w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-600 hover:bg-red-50 transition-colors text-left border-t border-black/10"
            >
              Block connections
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// EXPANDABLE BIO
// ══════════════════════════════════════════════════════

function ExpandableBio({ text, maxLines = 2 }: { text: string; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 160

  return (
    <div className="mt-2.5 max-w-[640px]">
      <p className={cn(
        'text-[11px] leading-[1.5] text-black/45',
        !expanded && isLong && `line-clamp-${maxLines}`
      )} style={!expanded && isLong ? { WebkitLineClamp: maxLines, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#0000ff] hover:text-[#00008b] mt-1 transition-colors"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// PHOTOS GRID — 4 columns, archive-wall density
// ══════════════════════════════════════════════════════

function PhotoAssetCard({ asset, isNew, overlay = 'data' }: { asset: VaultAsset; isNew: boolean; overlay?: OverlayMode }) {
  const [showPreview, setShowPreview] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasVideo = !!asset.videoUrl
  const hasAudio = !!asset.audioUrl
  const hasText = asset.format === 'text' && !!asset.textExcerpt
  // Text preview uses asset.textExcerpt — full text is original-only.

  const handleMouseEnter = useCallback(() => {
    if (overlay === 'off') return
    setHovering(true)
    if (!hasVideo && !hasAudio && !hasText) {
      timerRef.current = setTimeout(() => setShowPreview(true), 400)
    }
    if (hasText) {
      timerRef.current = setTimeout(() => setShowPreview(true), 400)
    }
    if (hasAudio && audioRef.current) {
      audioRef.current.play().catch(() => {})
      setAudioPlaying(true)
    }
  }, [overlay, hasVideo, hasAudio, hasText, asset.id])
  const handleMouseLeave = useCallback(() => {
    setHovering(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setAudioPlaying(false)
    }
  }, [])

  // Auto-play video when hovering
  const handleVideoReady = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && hovering) {
      el.play().catch(() => {})
    }
  }, [hovering])

  return (
    <>
      <Link
        href={`/asset/${asset.id}`}
        className="group block relative overflow-hidden bg-black/5"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="aspect-video overflow-hidden bg-slate-100">
          {hasVideo ? (
            <>
              {/* Video frame as base thumbnail — always present */}
              <video
                src={resolveProtectedMediaUrl(asset.id, 'video', 'preview')}
                muted
                preload="metadata"
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5 }}
                className="w-full h-full object-cover"
              />
              {/* Playback overlay on hover */}
              {hovering && (
                <video
                  ref={handleVideoReady}
                  src={resolveProtectedMediaUrl(asset.id, 'video', 'preview')}
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover z-10"
                />
              )}
            </>
          ) : hasAudio ? (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-3 relative">
              <audio ref={audioRef} src={resolveProtectedMediaUrl(asset.id, 'audio', 'preview')} preload="metadata" />
              {/* Play/pause indicator */}
              {!audioPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-10 h-10 border-2 border-white/60 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/60 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              )}
              {/* Waveform bars */}
              <div className="flex items-end gap-[3px] h-10">
                {[0.3, 0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.35, 0.7, 0.5, 0.85, 0.4, 0.6, 0.9, 0.3, 0.7, 0.5, 0.8, 0.45, 0.65].map((h, i) => (
                  <div
                    key={i}
                    className={`w-[3px] ${audioPlaying ? 'bg-[#0000ff]/60' : 'bg-white/40'} transition-colors`}
                    style={{
                      height: `${h * 100}%`,
                      animation: audioPlaying ? `audioBar 0.8s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
                    }}
                  />
                ))}
              </div>
              <style>{`@keyframes audioBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
            </div>
          ) : hasText ? (
            <div className="w-full h-full bg-stone-50 overflow-hidden relative flex items-center justify-center px-6 py-6">
              <div className="w-full max-w-[90%] text-center">
                <p className="text-[12px] leading-[1.7] text-black/50 font-serif italic line-clamp-5">{asset.textExcerpt}</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-50 to-transparent" />
            </div>
          ) : (asset.format === 'illustration' || asset.format === 'infographic' || asset.format === 'vector') && asset.illustrationUrl ? (
            <div className="w-full h-full bg-white flex items-center justify-center p-2">
              <img src={resolveProtectedMediaUrl(asset.id, 'illustration', 'lightbox-preview')} alt={asset.title} className="max-w-full max-h-full object-contain" />
            </div>
          ) : asset.id ? (
            <img src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><span className="text-xs font-bold font-mono text-black/20">{asset.format.toUpperCase()}</span></div>
          )}
        </div>
        {/* Format label — always shown, top left */}
        <span className="absolute top-1.5 left-1.5 text-[7px] font-bold uppercase tracking-widest text-white bg-black px-1.5 py-0.5 leading-tight z-20">{asset.format}</span>
        {isNew && (
          <span className="absolute top-1.5 right-1.5 text-[7px] font-bold uppercase tracking-wider text-white bg-[#0000ff] px-1.5 py-0.5 leading-tight z-20">New</span>
        )}
        {asset.declarationState === 'fully_validated' && (
          <div className={cn('absolute right-1.5 z-20', isNew ? 'top-7' : 'top-1.5')}>
            <div className="w-3.5 h-3.5 bg-[#0000ff] flex items-center justify-center">
              <svg viewBox="0 0 12 12" fill="none" className="w-2 h-2 text-white"><path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        )}
      </Link>
      {showPreview && !hasVideo && !hasAudio && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          {hasText ? (
            <div
              className="bg-white max-w-[700px] w-[90vw] max-h-[85vh] overflow-y-auto p-10 relative select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              onCopy={(e) => e.preventDefault()}
            >
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-[80px] font-black uppercase tracking-[0.2em] text-black/[0.04] rotate-[-30deg] whitespace-nowrap select-none">LICENSABLE</span>
              </div>
              <p className="text-[13px] leading-[1.8] text-black/80 font-serif whitespace-pre-line relative z-10">
                {asset.textExcerpt}
              </p>
            </div>
          ) : (
            asset.id && <img src={resolveProtectedUrl(asset.id, 'lightbox-preview')} alt={asset.title} className="max-w-[85vw] max-h-[85vh] object-contain" />
          )}
        </div>,
        document.body
      )}
    </>
  )
}

function PhotosGrid({ assets, recentIds, viewMode, overlay }: { assets: VaultAsset[]; recentIds: Set<string>; viewMode: 'grid4' | 'grid2' | 'grid1' | 'list'; overlay: OverlayMode }) {
  return (
    <div className={cn(gridLayoutClass(viewMode), viewMode === 'grid4' && 'gap-[3px]')}>
      {assets.map(asset => {
        const isNew = recentIds.has(asset.id)

        if (viewMode === 'list') {
          return (
            <Link
              key={asset.id}
              href={`/asset/${asset.id}`}
              className="flex items-center gap-4 border-b border-black/10 py-2 group hover:bg-black/[0.02] transition-colors"
            >
              <div className="w-16 h-12 shrink-0 overflow-hidden bg-black/5">
                {asset.id ? (
                  <img src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} className="w-full h-full object-cover object-center" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="text-[8px] font-bold font-mono text-black/20">{asset.format.toUpperCase()}</span></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-black leading-tight truncate group-hover:text-[#0000ff] transition-colors">{asset.title}</p>
                <p className="text-[10px] text-black/35 leading-snug line-clamp-1 mt-0.5">{asset.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">{asset.format}</span>
                {asset.creatorPrice && <span className="text-[10px] font-mono text-black/40">EUR {(asset.creatorPrice / 100).toFixed(0)}</span>}
                {isNew && <span className="text-[7px] font-bold uppercase tracking-wider text-white bg-[#0000ff] px-1.5 py-px">New</span>}
              </div>
            </Link>
          )
        }

        return <PhotoAssetCard key={asset.id} asset={asset} isNew={isNew} overlay={overlay} />
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// STORIES GRID — 3 columns, coverage-unit cards
// ══════════════════════════════════════════════════════

function StoriesGrid({ stories: storyList, viewMode, profile }: { stories: Story[]; viewMode: 'grid4' | 'grid2' | 'grid1' | 'list'; profile: CreatorProfile }) {
  return (
    <div className={gridLayoutClass(viewMode)}>
      {storyList.map(story => {
        const social = socialCounts[story.id]

        if (viewMode === 'list') {
          return (
            <Link key={story.id} href={`/story/${story.id}`} className="flex items-center gap-4 border-b border-black/10 py-2 group hover:bg-black/[0.02] transition-colors">
              <div className="w-16 h-12 shrink-0 overflow-hidden bg-black/5">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover object-center" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="text-[8px] font-mono text-black/20">No image</span></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-black leading-tight truncate group-hover:text-[#0000ff] transition-colors">{story.title}</p>
                {story.subtitle && <p className="text-[10px] text-black/35 leading-snug line-clamp-1 mt-0.5">{story.subtitle}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[9px] font-mono text-black/30">{story.assetCount} assets</span>
                <div className="flex items-center gap-2">
                  <Avatar src={profile.avatarUrl} name={profile.displayName} size="xs" />
                  <span className="text-[9px] font-bold text-black/40">{profile.displayName}</span>
                </div>
              </div>
            </Link>
          )
        }

        return <StoryCardWithPreview key={story.id} story={story} social={social} profile={profile} />
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// COLLECTIONS GRID — mosaic thumbnail cards
// ══════════════════════════════════════════════════════

function CollectionsGrid({ collections, viewMode }: { collections: Collection[]; viewMode: 'grid4' | 'grid2' | 'grid1' | 'list' }) {
  return (
    <div className={gridLayoutClass(viewMode)}>
      {collections.map(coll => {
        if (viewMode === 'list') {
          return (
            <Link key={coll.id} href={`/collection/${coll.id}`} className="flex items-center gap-4 border-b border-black/10 py-2 group hover:bg-black/[0.02] transition-colors">
              <div className="w-16 h-12 shrink-0 overflow-hidden bg-black/5">
                {coll.thumbnails[0] && <img src={coll.thumbnails[0]} alt="" className="w-full h-full object-cover object-center" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-black leading-tight truncate group-hover:text-[#0000ff] transition-colors">{coll.title}</p>
              </div>
              <span className="text-[9px] font-mono text-black/30 shrink-0">{coll.itemCount} items</span>
            </Link>
          )
        }

        return <CollectionCardWithPreview key={coll.id} collection={coll} />
      })}
      {collections.length === 0 && (
        <p className="text-sm text-black/30 py-8">No public collections yet.</p>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// STORY CARD WITH PREVIEW — hover popup
// ══════════════════════════════════════════════════════

function StoryCardWithPreview({ story, social, profile }: { story: Story; social: any; profile: CreatorProfile }) {
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMouseEnter = useCallback(() => { timerRef.current = setTimeout(() => setShowPreview(true), 400) }, [])
  const handleMouseLeave = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); setShowPreview(false) }, [])

  return (
    <>
      <Link
        href={`/story/${story.id}`}
        className="group block border-2 border-black hover:border-[#0000ff] transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="aspect-[4/3] overflow-hidden bg-black/5 relative">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-200" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><span className="text-black/20 font-mono text-xs">No image</span></div>
          )}
          <span className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider bg-[#0000ff] text-white px-2 py-0.5">Asia Pacific</span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] text-black/35 font-bold">
            {story.publishedAt && <span className="font-mono text-black/30">{new Date(story.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>}
            <span className="text-black/15">|</span>
            <span className="font-mono text-black/30">{story.assetCount} assets</span>
          </div>
          <h3 className="mt-1.5 text-[13px] font-bold text-black leading-snug group-hover:text-[#0000ff] transition-colors">{story.title}</h3>
          {story.subtitle && <p className="mt-1 text-[10px] text-black/35 leading-relaxed line-clamp-2">{story.subtitle}</p>}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/10">
            <div className="flex items-center gap-2">
              <Avatar src={profile.avatarUrl} name={profile.displayName} size="xs" />
              <span className="text-[9px] font-bold text-black/40">{profile.displayName}</span>
            </div>
            {social && (
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <LikeButton initialCount={social.likes} initialLiked={social.userLiked} size="sm" />
                <CommentCount count={social.comments} />
              </div>
            )}
          </div>
        </div>
      </Link>
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
            {story.coverImageUrl && (
              <img src={story.coverImageUrl} alt={story.title} className="max-w-full max-h-[50vh] object-contain" />
            )}
            <div className="text-center max-w-[600px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">Story &middot; {story.assetCount} assets</span>
              <h2 className="text-xl font-black text-white mt-1">{story.title}</h2>
              {story.subtitle && <p className="text-sm text-white/60 mt-1 line-clamp-2">{story.subtitle}</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════
// COLLECTION CARD WITH PREVIEW — hover popup
// ══════════════════════════════════════════════════════

function CollectionCardWithPreview({ collection: coll }: { collection: Collection }) {
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMouseEnter = useCallback(() => { timerRef.current = setTimeout(() => setShowPreview(true), 400) }, [])
  const handleMouseLeave = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); setShowPreview(false) }, [])

  return (
    <>
      <Link
        href={`/collection/${coll.id}`}
        className="group block border-2 border-black hover:border-[#0000ff] transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="grid grid-cols-2 gap-px bg-black">
          {coll.thumbnails.slice(0, 4).map((thumb, i) => (
            <div key={i} className="aspect-square overflow-hidden bg-black/5">
              <img src={thumb} alt="" className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-200" />
            </div>
          ))}
        </div>
        <div className="p-3">
          <h3 className="text-[13px] font-bold text-black leading-snug group-hover:text-[#0000ff] transition-colors">{coll.title}</h3>
          <span className="text-[9px] font-mono text-black/30 mt-1 block">{coll.itemCount} items</span>
        </div>
      </Link>
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-4">
            <div className="grid grid-cols-2 gap-1 max-w-[70vh]">
              {coll.thumbnails.slice(0, 4).map((thumb, i) => (
                <div key={i} className="overflow-hidden">
                  <img src={thumb} alt="" className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]/60">Collection &middot; {coll.itemCount} items</span>
              <h2 className="text-xl font-black text-white mt-1">{coll.title}</h2>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════
// FOOTER
// ══════════════════════════════════════════════════════

function FrontfolioFooter() {
  return (
    <footer className="bg-black text-white/40 border-t-2 border-black mt-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[14px] font-black tracking-tight">
              <span className="text-white/50">FRONT</span><span className="text-[#0000ff]/50">FILES</span>
            </span>
            <div className="flex items-center gap-3 mt-2 text-[7px] uppercase tracking-[0.12em] text-white/20">
              {['About', 'Privacy Policies', 'Rights and Licences', 'FAQs', 'Become a Frontfiler', 'Terms of Service', 'Contact'].map(l => (
                <span key={l} className="hover:text-white/40 transition-colors cursor-pointer">{l}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {['Tw', 'In', 'Fb', 'Li', 'Yt', 'Pi'].map(icon => (
              <div key={icon} className="w-5 h-5 border border-white/10 flex items-center justify-center hover:border-white/25 transition-colors cursor-pointer">
                <span className="text-[6px] font-bold text-white/25">{icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Certification logos row */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/8">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 border border-white/10 flex items-center justify-center">
              <span className="text-[5px] font-black text-white/25 uppercase leading-none">Centro</span>
            </div>
            <div className="w-8 h-8 border border-white/10 flex items-center justify-center">
              <span className="text-[6px] font-black text-white/25">2020</span>
            </div>
            <div className="w-8 h-8 border border-white/10 flex items-center justify-center">
              <span className="text-[4px] font-bold text-white/25 uppercase leading-tight text-center">EU<br />Fund</span>
            </div>
          </div>
          <p className="text-[7px] text-white/12 leading-relaxed max-w-[500px]">
            &copy; {new Date().getFullYear()} Frontfiles. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
