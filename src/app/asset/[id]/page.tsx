'use client'

import { use } from 'react'
import {
  assetMap,
  storyMap,
  creatorMap,
  socialCounts,
  comments,
} from '@/data'
import {
  AssetViewer,
  AssetActionBar,
  AssetRightsModule,
  AssetProvenanceModule,
  AssetDiscoveryModule,
  AssetCreatorBanner,
} from '@/components/asset'
import { CommentSection } from '@/components/social/CommentSection'

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const asset = assetMap[id]

  if (!asset) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Asset not found.</p>
      </div>
    )
  }

  const creator = creatorMap[asset.creatorId]
  const story = asset.storyId ? storyMap[asset.storyId] : undefined

  // Social data
  const counts = socialCounts[asset.id] ?? { likes: 0, comments: 0, userLiked: false }
  const assetComments = comments.filter(c => c.targetType === 'asset' && c.targetId === asset.id)

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <main>
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* ═══ A. HERO / IDENTITY ═══ */}
          <div className="mb-6">
            <span className="inline-block text-xs font-black uppercase tracking-[0.18em] bg-[#0000ff] text-white px-3 py-1">
              {asset.format}
            </span>
          </div>

          {/* ═══ DESKTOP: two-column layout ═══ */}
          <div className="flex gap-10">

            {/* ── Primary column ── */}
            <div className="flex-1 min-w-0">

              {/* Media viewer */}
              <div className="mb-0">
                <AssetViewer asset={asset} creatorName={creator?.name} />
              </div>

              {/* Actions under image */}
              <AssetActionBar
                assetId={asset.id}
                assetTitle={asset.title}
                socialCounts={counts}
              />

              {/* Creator under image */}
              {creator && (
                <div className="mt-4 mb-4">
                  <AssetCreatorBanner creator={creator} />
                </div>
              )}

              {/* Metadata strip */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 mt-2">
                <span>{asset.mediaTypeDisplay}</span>
                <span>{asset.locationLabel}</span>
                <span>{asset.captureDate}</span>
              </div>

              {/* Title + Description */}
              <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
                {asset.title}
              </h1>
              <p className="text-base text-slate-500 leading-relaxed max-w-3xl mb-4">{asset.description}</p>

              {/* Tags */}
              {asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6 pb-4 border-b border-slate-200">
                  {asset.tags.map(t => (
                    <a
                      key={t}
                      href={`/search?q=${encodeURIComponent(t)}`}
                      className="text-[10px] font-bold uppercase tracking-wider border border-slate-200 px-2.5 py-1 text-slate-500 hover:border-black hover:text-black transition-colors"
                    >
                      {t}
                    </a>
                  ))}
                </div>
              )}

              {/* ═══ G. ENGAGEMENT — Comments ═══ */}
              <div className="mb-4">
                <CommentSection
                  comments={assetComments}
                  targetType="asset"
                  targetId={asset.id}
                />
              </div>

              {/* ═══ H. DISCOVERY ═══ */}
              <AssetDiscoveryModule
                assetId={asset.id}
                tags={asset.tags}
                geography={asset.geography}
                creatorId={asset.creatorId}
                storyId={asset.storyId}
                relatedAssetIds={asset.relatedAssetIds}
              />
            </div>

            {/* ── Sidebar (sticky on desktop, inline on mobile) ── */}
            <aside className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-6 space-y-6">

                {/* Rights */}
                <AssetRightsModule asset={asset} />

                {/* Provenance: appears-in + metadata + tags */}
                <AssetProvenanceModule asset={asset} story={story} />
              </div>
            </aside>
          </div>

          {/* ── Mobile-only action rail (below content on small screens) ── */}
          <div className="lg:hidden mt-8 space-y-6">
            {creator && <AssetCreatorBanner creator={creator} />}
            <AssetRightsModule asset={asset} />
            <AssetProvenanceModule asset={asset} story={story} />
          </div>

        </div>
      </main>
    </div>
  )
}
