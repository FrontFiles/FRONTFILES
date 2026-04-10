'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ContinueSearchCard } from '@/components/discovery/ContinueSearchCard'
import {
  lightboxes,
  assetMap,
  storyMap,
  articleMap,
  publicAssets,
  getRecommendationsFor,
} from '@/data'

export default function LightboxPage() {
  const [activeLightbox, setActiveLightbox] = useState(lightboxes[0]?.id || '')
  const lightbox = lightboxes.find(l => l.id === activeLightbox) || lightboxes[0]

  if (!lightbox) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">No Lightboxes yet.</p>
        </div>
      </div>
    )
  }

  const assets = lightbox.assetIds.map(aid => assetMap[aid]).filter(Boolean)
  const sourceStories = lightbox.sourceStoryIds.map(sid => storyMap[sid]).filter(Boolean)
  const connectedArticles = lightbox.connectedArticleIds.map(aid => articleMap[aid]).filter(Boolean)

  // Expansion suggestions: get recommendations for the lightbox
  const recs = getRecommendationsFor('lightbox', lightbox.id)
  const expansionAssetIds = recs
    .flatMap(r => r.targetAssetIds)
    .filter(aid => !lightbox.assetIds.includes(aid))
  const expansionAssets = [...new Set(expansionAssetIds)].map(aid => assetMap[aid]).filter(Boolean).slice(0, 6)

  const expansionStoryIds = recs.flatMap(r => r.targetStoryIds)
  const expansionStories = [...new Set(expansionStoryIds)].map(sid => storyMap[sid]).filter(Boolean)

  // Total price
  const totalPrice = assets.reduce((sum, a) => sum + (a.price || 0), 0)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Lightbox selector */}
          <div className="flex items-center gap-3 mb-8">
            {lightboxes.map(l => (
              <button
                key={l.id}
                onClick={() => setActiveLightbox(l.id)}
                className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                  l.id === activeLightbox
                    ? 'bg-black text-white border-black'
                    : 'border-slate-200 text-slate-500 hover:border-black hover:text-black'
                }`}
              >
                {l.name} ({l.assetIds.length})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Shortlisted assets */}
              <SectionHeader label={lightbox.name} sublabel={`${assets.length} shortlisted assets`} />
              <div className="grid grid-cols-3 gap-4 mb-10">
                {assets.map(a => (
                  <AssetCard key={a.id} asset={a} />
                ))}
              </div>

              {/* Full Story surfacing */}
              {sourceStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Full Stories from shortlisted assets" sublabel="View the complete coverage" />
                  <div className="grid grid-cols-2 gap-4">
                    {sourceStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Same Story" />
                    ))}
                  </div>
                </section>
              )}

              {/* Connected Articles */}
              {connectedArticles.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Connected Articles" sublabel="Articles using shortlisted assets" />
                  <div className="flex flex-col gap-4">
                    {connectedArticles.map(a => (
                      <ArticleCard key={a.id} article={a} reason="Connected article" />
                    ))}
                  </div>
                </section>
              )}

              {/* Expansion suggestions */}
              {expansionAssets.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Expand your shortlist" sublabel="Related to your shortlist" />
                  <div className="grid grid-cols-3 gap-4">
                    {expansionAssets.map(a => (
                      <AssetCard key={a.id} asset={a} size="compact" reason="Related to your shortlist" />
                    ))}
                  </div>
                </section>
              )}

              {/* Expansion stories */}
              {expansionStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Nearby Stories" sublabel="Based on shortlist cluster" />
                  <div className="grid grid-cols-2 gap-4">
                    {expansionStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Related coverage" />
                    ))}
                  </div>
                </section>
              )}

              {/* Continue */}
              <ContinueSearchCard label="Continue building this Lightbox" />
            </div>

            {/* Right rail: summary */}
            <div className="col-span-4">
              {/* Summary */}
              <div className="border-2 border-black p-4 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-4">Lightbox summary</h3>
                <MetaRow label="Assets" value={String(assets.length)} />
                <MetaRow label="Stories" value={String(sourceStories.length)} />
                <MetaRow label="Geographies" value={String(lightbox.geographyClusters.length)} />
                <MetaRow label="Estimated total" value={`\u20AC${totalPrice}`} />
                <button className="w-full mt-4 bg-[#0000ff] text-white text-sm font-bold uppercase tracking-wider py-3 hover:bg-[#0000cc] transition-colors">
                  Proceed to license
                </button>
              </div>

              {/* Geography cluster */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Coverage geographies</h3>
                <div className="flex flex-col gap-1">
                  {lightbox.geographyClusters.map(gid => (
                    <span key={gid} className="text-[11px] text-slate-500">{gid.replace('geo-', '').replace(/-/g, ' ')}</span>
                  ))}
                </div>
              </div>

              {/* Source creators */}
              <div className="border border-slate-200 p-4 mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Source creators</h3>
                {lightbox.sourceCreatorIds.map(cid => {
                  const c = assetMap[lightbox.assetIds[0]]
                  return (
                    <span key={cid} className="text-[11px] text-slate-500 block">{cid.replace('creator-', 'Creator ')}</span>
                  )
                })}
              </div>

              {/* Discovery signals */}
              {recs.length > 0 && (
                <div className="border border-slate-200 p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Discovery signals</h3>
                  <div className="flex flex-col gap-1">
                    {recs.map(r => (
                      <span key={r.id} className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] border border-[#0000ff] px-2 py-0.5 inline-block w-fit">
                        {r.reasonLabel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-bold text-black">{value}</span>
    </div>
  )
}
