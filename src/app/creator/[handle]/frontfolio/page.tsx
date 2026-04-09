'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  mockCreatorProfile,
  mockVaultAssets,
  mockStories,
  mockCollections,
  mockFollowState,
  mockSocialCounts,
} from '@/lib/mock-data'
import { LikeButton } from '@/components/social/LikeButton'
import { CommentCount } from '@/components/social/CommentSection'
import type { VaultAsset, Story, Collection } from '@/lib/types'

// ═══════════════════════════════════════════════
// FRONTFOLIO PAGE
// Creator profile + portfolio archive
// ═══════════════════════════════════════════════

type FrontfolioTab = 'photos' | 'stories' | 'collections'

export default function FrontfolioPage() {
  const profile = mockCreatorProfile
  const [activeTab, setActiveTab] = useState<FrontfolioTab>('photos')

  const publicAssets = mockVaultAssets.filter(a => a.privacy === 'PUBLIC' && a.publication === 'PUBLISHED')
  const publicStories = mockStories.filter(s => s.privacy === 'PUBLIC' && s.publication === 'PUBLISHED')
  const publicCollections = mockCollections.filter(c => c.privacy === 'PUBLIC')

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
    <div className="min-h-screen flex flex-col bg-white">
      <FrontfolioTopNav />
      <Breadcrumb name={profile.displayName} />

      {/* ── CREATOR HEADER — identity, practice, format scope ── */}
      <CreatorHeader profile={profile} activeFormats={activeFormats} totalAssets={publicAssets.length} totalStories={publicStories.length} />

      <div className="flex-1 flex">
        <div className="max-w-[1400px] mx-auto w-full flex">
          {/* Archive content — full width */}
          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="px-8 pt-5 pb-7">
              <div className="flex items-end justify-between mb-3">
                <h2 className="text-[26px] font-serif italic text-black tracking-tight leading-none">Frontfolio</h2>
                <ViewToggles />
              </div>

              <div className="flex items-center border-b-2 border-black mb-5">
                <TabBtn label="Photographs" count={publicAssets.length} active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} />
                <TabBtn label="Stories" count={publicStories.length} active={activeTab === 'stories'} onClick={() => setActiveTab('stories')} />
                <TabBtn label="Collections" count={publicCollections.length} active={activeTab === 'collections'} onClick={() => setActiveTab('collections')} />
              </div>

              {activeTab === 'photos' && <PhotosGrid assets={publicAssets} recentIds={recentIds} />}
              {activeTab === 'stories' && <StoriesGrid stories={publicStories} />}
              {activeTab === 'collections' && <CollectionsGrid collections={publicCollections} />}
            </div>

            <FrontfolioFooter />
          </main>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TOP NAV
// ══════════════════════════════════════════════════════

function FrontfolioTopNav() {
  return (
    <header className="h-14 bg-white border-b-2 border-black flex items-center justify-between px-6 shrink-0">
      <Link href="/" className="text-lg font-black tracking-tight leading-none">
        <span className="text-black">FRONT</span><span className="text-blue-600">FILES</span>
      </Link>

      <div className="flex-1 max-w-md mx-8">
        <div className="flex items-center h-9 border-2 border-black bg-white">
          <select className="h-full border-r-2 border-black bg-white text-[10px] font-bold uppercase tracking-wider text-black px-3 appearance-none cursor-pointer">
            <option>All Content</option>
            <option>Photos</option>
            <option>Stories</option>
          </select>
          <div className="flex items-center flex-1 px-3 gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-black/40 shrink-0">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="FrontSearch"
              className="flex-1 text-[12px] text-black placeholder:text-black/30 outline-none bg-transparent"
            />
          </div>
          <button className="h-full px-2.5 text-black/40 hover:text-black border-l-2 border-black">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M2 4h12M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/creator/sarahchen/frontfolio" className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black">
          Frontfolio
        </Link>
        <Link
          href="/vault/upload"
          className="h-9 px-5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest inline-flex items-center hover:bg-blue-700 transition-colors"
        >
          Upload
        </Link>
      </div>
    </header>
  )
}

// ══════════════════════════════════════════════════════
// BREADCRUMB
// ══════════════════════════════════════════════════════

function Breadcrumb({ name }: { name: string }) {
  return (
    <div className="border-b border-black/10 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-1.5 h-8">
        <Link href="/search" className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800">Frontfiles</Link>
        <span className="text-[10px] text-black/20">/</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-black">{name}</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CREATOR HEADER
// Identity + Practice + Format Scope + Track Record
// Multi-format editorial practice dossier
// ══════════════════════════════════════════════════════

const ALL_FORMATS = ['photo', 'video', 'audio', 'text', 'infographic', 'illustration', 'vector'] as const

function CreatorHeader({ profile, activeFormats, totalAssets, totalStories }: {
  profile: typeof mockCreatorProfile
  activeFormats: [string, number][]
  totalAssets: number
  totalStories: number
}) {
  const activeFormatNames = activeFormats.map(([f]) => f)

  return (
    <header className="border-b-2 border-black bg-white">
      <div className="max-w-[1400px] mx-auto px-8">
        {/* Row 1: Identity + Portrait + Practice */}
        <div className="flex gap-0 py-5">
          {/* Portrait — supporting element, not dominant */}
          <div className="w-[100px] h-[100px] shrink-0 border-2 border-black overflow-hidden mr-6">
            <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover scale-[1.08]" style={{ objectPosition: '80% 10%' }} />
          </div>

          {/* Identity block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/30 leading-none">{profile.professionalTitle}</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <h1 className="text-[24px] font-black text-black tracking-tight leading-none">{profile.displayName}</h1>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-blue-600 flex items-center justify-center">
                      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-white">
                        <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/30">Provenance verified</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-black/30">
                      <path d="M8 1C5 1 2.5 3.5 2.5 6.5 2.5 10.5 8 15 8 15s5.5-4.5 5.5-8.5C13.5 3.5 11 1 8 1z" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="8" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="text-[10px] text-black/40 leading-none">Hong Kong, CN</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['🇨🇳', '🇭🇰', '🇹🇼'].map((f, i) => <span key={i} className="text-[12px] leading-none">{f}</span>)}
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-black/30">
                    <span><strong className="text-black font-bold">{mockFollowState.followers}</strong> followers</span>
                    <span><strong className="text-black font-bold">{mockFollowState.following}</strong> following</span>
                  </div>
                </div>
              </div>

              {/* CTA + social + edit */}
              <div className="flex items-center gap-2 shrink-0">
                <EditPencil />
                {profile.alsoMeLinks.map((link, i) => {
                  const isLinkedin = link.includes('linkedin')
                  return (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" className={cn(
                      'w-7 h-7 flex items-center justify-center transition-colors cursor-pointer',
                      isLinkedin ? 'bg-[#0077b5] text-white hover:bg-[#005582]' : 'bg-black text-white hover:bg-black/80'
                    )}>
                      <span className="text-[7px] font-bold">{isLinkedin ? 'in' : 'X'}</span>
                    </a>
                  )
                })}
                <FollowButton />
                <button className="h-7 px-4 bg-blue-600 text-white text-[8px] font-bold uppercase tracking-[0.12em] hover:bg-blue-700 transition-colors ml-1">
                  Message me
                </button>
              </div>
            </div>

            {/* Bio — expandable for long bios */}
            <div className="flex items-start gap-2">
              <ExpandableBio text={profile.biography} maxLines={2} />
              <EditPencil />
            </div>
          </div>
        </div>

        {/* Row 2: Format inventory + Practice + Track record — hard rule above */}
        <div className="border-t-2 border-black flex gap-0">
          {/* Format inventory — first-class */}
          <div className="py-3 pr-6 border-r-2 border-black/10">
            <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-2">Format inventory</span>
            <div className="flex items-center gap-[3px]">
              {ALL_FORMATS.map(f => {
                const count = activeFormats.find(([name]) => name === f)?.[1] ?? 0
                const isActive = count > 0
                return (
                  <div
                    key={f}
                    className={cn(
                      'h-8 px-2.5 flex flex-col items-center justify-center border-2 transition-colors',
                      isActive
                        ? 'border-black bg-black text-white'
                        : 'border-black/10 bg-white text-black/15'
                    )}
                  >
                    <span className={cn('text-[7px] font-bold uppercase tracking-wider leading-none', isActive ? 'text-white' : 'text-black/15')}>{f}</span>
                    {isActive && <span className="text-[8px] font-mono leading-none mt-0.5 text-white/60">{count}</span>}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[8px] text-black/25">
              <span><strong className="text-black font-bold font-mono">{totalAssets}</strong> assets</span>
              <span><strong className="text-black font-bold font-mono">{totalStories}</strong> stories</span>
              <span><strong className="text-black font-bold font-mono">{activeFormats.length}</strong> formats</span>
            </div>
          </div>

          {/* Practice — 2-column skill grid */}
          <div className="py-3 px-6 border-r-2 border-black/10 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25">Skill pool</span>
              <EditPencil />
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-[3px]">
              {[...profile.specialisations, ...profile.skills].map((s, i) => (
                <span key={i} className="border-2 border-black text-[7px] font-bold uppercase tracking-[0.08em] text-black px-1.5 py-[2px] leading-tight text-center truncate">{s}</span>
              ))}
            </div>
          </div>

          {/* Published works — magazine-style previews */}
          <div className="py-3 pl-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-black/25">Published works</span>
              <EditPencil />
            </div>
            <div className="flex flex-col gap-2.5">
              {profile.publishedIn.map((pub, i) => {
                const pubMeta = PUBLICATION_META[pub] || { type: 'Magazine', color: 'bg-black/5', desc: 'Editorial contributions' }
                return (
                  <div key={i} className="flex items-start gap-2.5 group cursor-pointer">
                    <div className={`w-8 h-10 ${pubMeta.color} border border-black/10 flex items-center justify-center shrink-0`}>
                      <span className="text-[5px] font-black text-black/40 uppercase leading-none tracking-tight">{pub.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-black leading-none group-hover:text-blue-600 transition-colors">{pub}</p>
                      <p className="text-[7px] text-black/25 uppercase tracking-wider mt-0.5">{pubMeta.type}</p>
                      <p className="text-[7px] text-black/20 leading-snug mt-0.5 line-clamp-1">{pubMeta.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Provenance disclaimer */}
        <div className="border-t border-black/8 py-1.5">
          <p className="text-[7px] text-black/15 uppercase tracking-[0.1em]">
            Frontfiles certifies provenance and file history. It does not verify factual accuracy or act as an editorial truth authority.
          </p>
        </div>
      </div>
    </header>
  )
}

// ══════════════════════════════════════════════════════
// PUBLICATION META — mock publication types
// ══════════════════════════════════════════════════════

const PUBLICATION_META: Record<string, { type: string; color: string; desc: string }> = {
  'Reuters': { type: 'Wire service', color: 'bg-orange-50', desc: 'International wire coverage and breaking news dispatches' },
  'South China Morning Post': { type: 'Newspaper', color: 'bg-yellow-50', desc: 'Asia-Pacific reporting and regional analysis' },
  'Foreign Policy': { type: 'Magazine', color: 'bg-blue-50', desc: 'Long-form geopolitical analysis and policy reporting' },
  'The Guardian': { type: 'Newspaper', color: 'bg-indigo-50', desc: 'International correspondent reporting and features' },
  'Al Jazeera': { type: 'Broadcast', color: 'bg-amber-50', desc: 'Broadcast journalism and documentary work' },
  'BBC': { type: 'Broadcast', color: 'bg-red-50', desc: 'Broadcast journalism and world service reporting' },
  'The New York Times': { type: 'Newspaper', color: 'bg-slate-100', desc: 'Investigative reporting and editorial features' },
  'Associated Press': { type: 'Wire service', color: 'bg-red-50', desc: 'International wire coverage and field dispatches' },
}

// ══════════════════════════════════════════════════════
// EDIT PENCIL — 1st person view section edit icon
// ══════════════════════════════════════════════════════

function EditPencil() {
  return (
    <button className="w-5 h-5 flex items-center justify-center text-black/15 hover:text-blue-600 transition-colors shrink-0" title="Edit">
      <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3">
        <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ══════════════════════════════════════════════════════
// FOLLOW BUTTON
// ══════════════════════════════════════════════════════

function FollowButton() {
  const [following, setFollowing] = useState(false)
  return (
    <button
      onClick={() => setFollowing(f => !f)}
      className={cn(
        'h-7 px-4 text-[8px] font-bold uppercase tracking-[0.12em] transition-colors border-2',
        following
          ? 'bg-black text-white border-black hover:bg-black/80'
          : 'bg-white text-black border-black hover:bg-black hover:text-white'
      )}
    >
      {following ? 'Following' : 'Follow'}
    </button>
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
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-600 hover:text-blue-800 mt-1 transition-colors"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB BUTTON — decisive active state
// ══════════════════════════════════════════════════════

function TabBtn({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors relative -mb-[2px]',
        active
          ? 'text-blue-600 border-b-[3px] border-blue-600'
          : 'text-black/25 hover:text-black/50 border-b-[3px] border-transparent'
      )}
    >
      {label}
      {count !== undefined && <span className={cn('ml-1 text-[9px] font-mono', active ? 'text-blue-600/70' : 'text-black/15')}>{count}</span>}
    </button>
  )
}

// ══════════════════════════════════════════════════════
// VIEW TOGGLES
// ══════════════════════════════════════════════════════

function ViewToggles() {
  const [mode, setMode] = useState<'grid' | 'list' | 'compact'>('grid')
  return (
    <div className="flex items-center gap-0">
      <button onClick={() => setMode('grid')} className={cn('w-7 h-7 flex items-center justify-center border-2', mode === 'grid' ? 'bg-blue-600 border-blue-600 text-white' : 'border-black text-black hover:bg-black/5')}>
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><rect x="1" y="1" width="6" height="6" /><rect x="9" y="1" width="6" height="6" /><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /></svg>
      </button>
      <button onClick={() => setMode('list')} className={cn('w-7 h-7 flex items-center justify-center border-2 border-l-0', mode === 'list' ? 'bg-blue-600 border-blue-600 text-white' : 'border-black text-black hover:bg-black/5')}>
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><rect x="1" y="1" width="14" height="3" /><rect x="1" y="6.5" width="14" height="3" /><rect x="1" y="12" width="14" height="3" /></svg>
      </button>
      <button onClick={() => setMode('compact')} className={cn('w-7 h-7 flex items-center justify-center border-2 border-l-0', mode === 'compact' ? 'bg-blue-600 border-blue-600 text-white' : 'border-black text-black hover:bg-black/5')}>
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><rect x="1" y="1" width="4" height="4" /><rect x="6" y="1" width="4" height="4" /><rect x="11" y="1" width="4" height="4" /><rect x="1" y="6" width="4" height="4" /><rect x="6" y="6" width="4" height="4" /><rect x="11" y="6" width="4" height="4" /><rect x="1" y="11" width="4" height="4" /><rect x="6" y="11" width="4" height="4" /><rect x="11" y="11" width="4" height="4" /></svg>
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// PHOTOS GRID — 4 columns, archive-wall density
// ══════════════════════════════════════════════════════

function PhotosGrid({ assets, recentIds }: { assets: VaultAsset[]; recentIds: Set<string> }) {
  const router = useRouter()
  return (
    <div className="grid grid-cols-4 gap-[3px]">
      {assets.map(asset => {
        const isNew = recentIds.has(asset.id)
        return (
          <div
            key={asset.id}
            className="group cursor-pointer relative overflow-hidden bg-black/5"
            onClick={() => router.push(`/asset/${asset.id}`)}
          >
            <div className="aspect-square overflow-hidden">
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><span className="text-xs font-bold font-mono text-black/20">{asset.format.toUpperCase()}</span></div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-end">
              <div className="w-full px-2 pb-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-150">
                <p className="text-[9px] font-bold text-white leading-tight line-clamp-2">{asset.title}</p>
                {asset.creatorPrice && <p className="text-[8px] text-white/60 mt-0.5 font-mono">EUR {(asset.creatorPrice / 100).toFixed(0)}</p>}
              </div>
            </div>
            {/* NEW badge */}
            {isNew && (
              <span className="absolute top-1 right-1 text-[7px] font-bold uppercase tracking-wider text-white bg-blue-600 px-1.5 py-px leading-tight">New</span>
            )}
            {/* Format badge (non-photo) */}
            {asset.format !== 'photo' && (
              <span className="absolute top-1 left-1 text-[7px] font-bold uppercase tracking-widest text-white bg-black px-1 py-px leading-tight">{asset.format}</span>
            )}
            {/* Validation badge — bottom-right when no NEW badge, top-right shifts down when NEW present */}
            {asset.declarationState === 'fully_validated' && (
              <div className={cn('absolute right-1', isNew ? 'top-6' : 'top-1')}>
                <div className="w-3.5 h-3.5 bg-blue-600 flex items-center justify-center">
                  <svg viewBox="0 0 12 12" fill="none" className="w-2 h-2 text-white"><path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// STORIES GRID — 3 columns, coverage-unit cards
// ══════════════════════════════════════════════════════

function StoriesGrid({ stories: storyList }: { stories: Story[] }) {
  const router = useRouter()
  const profile = mockCreatorProfile
  return (
    <div className={cn(
      'grid gap-5',
      storyList.length >= 3 ? 'grid-cols-3' : storyList.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[380px]'
    )}>
      {storyList.map(story => {
        const social = mockSocialCounts[story.id]
        return (
          <div key={story.id} className="group cursor-pointer border-2 border-black hover:border-blue-600 transition-colors" onClick={() => router.push(`/story/${story.id}`)}>
            <div className="aspect-[4/3] overflow-hidden bg-black/5 relative">
              {story.coverImageUrl ? (
                <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><span className="text-black/20 font-mono text-xs">No image</span></div>
              )}
              {/* Location tag overlay */}
              <span className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5">Asia Pacific</span>
            </div>
            <div className="p-3">
              {/* Date + asset count */}
              <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] text-black/35 font-bold">
                {story.publishedAt && <span className="font-mono text-black/30">{new Date(story.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>}
                <span className="text-black/15">|</span>
                <span className="font-mono text-black/30">{story.assetCount} assets</span>
              </div>
              <h3 className="mt-1.5 text-[13px] font-bold text-black leading-snug group-hover:text-blue-600 transition-colors">{story.title}</h3>
              {story.subtitle && <p className="mt-1 text-[10px] text-black/35 leading-relaxed line-clamp-2">{story.subtitle}</p>}

              {/* Creator + social row */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/10">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border border-black/15 overflow-hidden shrink-0">
                    <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                  </div>
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
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// COLLECTIONS GRID — mosaic thumbnail cards
// ══════════════════════════════════════════════════════

function CollectionsGrid({ collections }: { collections: Collection[] }) {
  return (
    <div className={cn(
      'grid gap-5',
      collections.length >= 3 ? 'grid-cols-3' : collections.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[380px]'
    )}>
      {collections.map(coll => (
        <div key={coll.id} className="group cursor-pointer border-2 border-black hover:border-blue-600 transition-colors">
          {/* 2x2 thumbnail mosaic */}
          <div className="grid grid-cols-2 gap-px bg-black">
            {coll.thumbnails.slice(0, 4).map((thumb, i) => (
              <div key={i} className="aspect-square overflow-hidden bg-black/5">
                <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" />
              </div>
            ))}
          </div>
          <div className="p-3">
            <h3 className="text-[13px] font-bold text-black leading-snug group-hover:text-blue-600 transition-colors">{coll.title}</h3>
            <span className="text-[9px] font-mono text-black/30 mt-1 block">{coll.itemCount} items</span>
          </div>
        </div>
      ))}
      {collections.length === 0 && (
        <p className="text-sm text-black/30 py-8">No public collections yet.</p>
      )}
    </div>
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
              <span className="text-white/50">FRONT</span><span className="text-blue-500/50">FILES</span>
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
