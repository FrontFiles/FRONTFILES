'use client'

import { useState } from 'react'
import Link from 'next/link'
import { VaultLeftRail } from '@/components/platform/VaultLeftRail'
import { VaultAssetList } from '@/components/platform/VaultAssetList'
import { VaultDetailDrawer } from '@/components/platform/VaultDetailDrawer'
import { VaultStatusPanel } from '@/components/platform/VaultStatusPanel'
import { EmptyPanel } from '@/components/platform/Panel'
import { StateBadge } from '@/components/platform/StateBadge'
import {
  mockVaultAssets,
  mockStories,
  mockArticles,
  mockCollections,
} from '@/lib/mock-data'
import type { PrivacyState } from '@/lib/types'

type VaultSection = 'all' | 'stories' | 'articles' | 'collections' | 'uploads' | 'analytics'

export default function VaultPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)

  const filteredAssets = privacyFilter === 'ALL'
    ? mockVaultAssets
    : mockVaultAssets.filter(a => a.privacy === privacyFilter)

  const selectedAsset = selectedAssetId
    ? mockVaultAssets.find(a => a.id === selectedAssetId) ?? null
    : null

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <VaultLeftRail
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          privacyFilter={privacyFilter}
          onPrivacyFilterChange={setPrivacyFilter}
          onUploadClick={() => {}}
        />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {activeSection === 'all' && (
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Vault status at top */}
                <div className="px-6 py-4 border-b border-slate-200 shrink-0">
                  <VaultStatusPanel
                    assets={mockVaultAssets}
                    stories={mockStories}
                    articles={mockArticles}
                  />
                </div>

                {/* Asset list */}
                <VaultAssetList
                  assets={filteredAssets}
                  selectedId={selectedAssetId}
                  onSelect={setSelectedAssetId}
                />
              </div>

              {/* Detail drawer */}
              {selectedAsset && (
                <VaultDetailDrawer
                  asset={selectedAsset}
                  onClose={() => setSelectedAssetId(null)}
                />
              )}
            </>
          )}

          {activeSection === 'stories' && (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Stories</h2>
              <div className="flex flex-col gap-4 max-w-2xl">
                {mockStories.map(story => {
                  const mix = story.contentMix
                  const mixParts: string[] = []
                  if (mix.photo > 0) mixParts.push(`${mix.photo} photo`)
                  if (mix.video > 0) mixParts.push(`${mix.video} video`)
                  if (mix.audio > 0) mixParts.push(`${mix.audio} audio`)
                  if (mix.text > 0) mixParts.push(`${mix.text} text`)
                  if (mix.illustration > 0) mixParts.push(`${mix.illustration} illus.`)
                  if (mix.infographic > 0) mixParts.push(`${mix.infographic} infographic`)
                  if (mix.vector > 0) mixParts.push(`${mix.vector} vector`)
                  return (
                    <Link key={story.id} href={`/story/${story.id}`} className="border-2 border-black overflow-hidden hover:opacity-95 transition-opacity">
                      <div className="aspect-video relative overflow-hidden bg-slate-100">
                        {story.coverImageUrl ? (
                          <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                            <span className="text-slate-400 font-mono text-xs">NO IMAGE</span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-black px-2 py-0.5">
                            Story · {story.assetCount} assets
                          </span>
                        </div>
                        {mixParts.length > 0 && (
                          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                            {mixParts.map((part, i) => (
                              <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-white bg-black/60 px-1.5 py-0.5">
                                {part}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="absolute top-3 right-3 flex gap-1">
                          <StateBadge variant={story.privacy.toLowerCase() as 'public' | 'private' | 'restricted'} />
                          <StateBadge variant={story.publication.toLowerCase() as 'published' | 'draft'} />
                        </div>
                      </div>
                      <div className="px-5 py-4 bg-white">
                        <h3 className="text-base font-bold text-black leading-snug">{story.title}</h3>
                        {story.subtitle && <p className="text-sm text-slate-500 mt-0.5">{story.subtitle}</p>}
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">{story.excerpt}</p>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="font-mono text-[10px] text-slate-400">
                            {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unpublished'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {activeSection === 'articles' && (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Articles</h2>
              <div className="flex flex-col gap-3 max-w-2xl">
                {mockArticles.map(article => (
                  <Link key={article.id} href={`/article/${article.id}`} className="border border-slate-200 hover:border-slate-400 transition-colors overflow-hidden flex">
                    <div className="w-48 shrink-0 self-stretch overflow-hidden bg-slate-100 relative">
                      {article.coverImageUrl ? (
                        <img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                          <span className="text-slate-400 font-mono text-[10px]">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Article</span>
                          {article.assemblyVerified && <StateBadge variant="assembly-verified" />}
                          <StateBadge variant={article.publishState === 'published' ? 'published' : 'draft'} />
                        </div>
                        <h3 className="text-sm font-bold text-black leading-snug">{article.title}</h3>
                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">{article.excerpt}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="font-mono text-[10px] text-slate-400">
                          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unpublished'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{article.wordCount.toLocaleString()} words</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'collections' && (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Collections</h2>
              {mockCollections.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-w-2xl">
                  {mockCollections.map(coll => (
                    <Link key={coll.id} href={`/collection/${coll.id}`} className="border-2 border-black px-4 py-3 hover:opacity-90 transition-opacity">
                      <div className="text-sm font-bold uppercase tracking-wide text-black">{coll.title}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{coll.itemCount} items</div>
                      <div className="flex items-center gap-2 mt-2">
                        <StateBadge variant={coll.privacy.toLowerCase() as 'public' | 'private' | 'restricted'} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyPanel message="No collections yet" detail="Create a collection to group related assets" />
              )}
            </div>
          )}

          {activeSection === 'uploads' && (
            <div className="flex-1 overflow-y-auto px-6 py-6 flex items-center justify-center">
              <EmptyPanel message="No uploads in progress" detail="Click Upload to add files to your Vault" />
            </div>
          )}

          {activeSection === 'analytics' && (
            <div className="flex-1 overflow-y-auto px-6 py-6 flex items-center justify-center">
              <EmptyPanel message="Analytics coming soon" detail="Performance metrics for your Vault content" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
