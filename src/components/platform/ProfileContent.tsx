'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { StateBadge } from './StateBadge'
import { LikeButton } from '@/components/social/LikeButton'
import { CommentCount } from '@/components/social/CommentSection'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { mockSocialCounts } from '@/lib/mock-data'
import type { CreatorProfile, CertificationEvent, VaultAsset, Story, Article, Collection } from '@/lib/types'
import { cn } from '@/lib/utils'
import { hydratePosts } from '@/lib/post/hydrate'
import { useDraftStore } from '@/lib/post/draft-store'
import { isFffSharingEnabled } from '@/lib/flags'
import {
  isPublishedPublicAsset,
  isPublishedPublicStory,
  isPublicCollection,
} from '@/lib/asset/visibility'
import { PostCard, PostCardUnavailable } from '@/components/post/PostCard'

interface ProfileContentProps {
  profile: CreatorProfile
  events: CertificationEvent[]
  assets?: VaultAsset[]
  stories?: Story[]
  articles?: Article[]
  collections?: Collection[]
  /** Canonical users.id for the profile being displayed. */
  creatorId?: string
}

export function ProfileContent({ profile, events, assets = [], stories = [], articles = [], collections = [], creatorId }: ProfileContentProps) {
  const { unifiedRows, openComposer } = useDraftStore()
  // Visibility predicates centralized in `lib/asset/visibility`.
  // Every profile / frontfolio surface reads the same rule from
  // that module so the "public + published" gate cannot drift.
  const publicAssets = assets.filter(isPublishedPublicAsset)
  const publicStories = stories.filter(isPublishedPublicStory)
  const publishedArticles = articles.filter(a => a.publishState === 'published')
  const publicCollections = collections.filter(isPublicCollection)

  // FFF Sharing — show up to 3 recent posts as a preview block.
  // Reads from the unified pool so newly composed drafts appear
  // here too (was previously seed-only via `getPostsByAuthor`).
  const postResults = useMemo(() => {
    if (!creatorId) return []
    const rows = unifiedRows
      .filter(
        (r) => r.author_user_id === creatorId && r.status === 'published',
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, 3)
    return hydratePosts(rows)
  }, [unifiedRows, creatorId])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl px-8 py-8 flex flex-col gap-8">

        {/* Posts preview — up to 3 most recent. Suppressed
            entirely when the FFF Sharing feature flag is off. */}
        {isFffSharingEnabled() && creatorId && postResults.length > 0 && (
          <ContentSection
            label="Posts"
            count={postResults.length}
            rightSlot={
              <Link
                href={`/creator/${profile.username}/posts`}
                className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#0000cc] transition-colors"
              >
                View all posts →
              </Link>
            }
          >
            <div className="flex flex-col gap-4">
              {postResults.map((result) =>
                result.ok ? (
                  <PostCard
                    key={result.card.id}
                    card={result.card}
                    onRepost={() => {
                      const row = unifiedRows.find((r) => r.id === result.card.id)
                      if (row) openComposer({ repostOf: row })
                    }}
                  />
                ) : (
                  <PostCardUnavailable
                    key={result.placeholder.id}
                    placeholder={result.placeholder}
                    reason={result.reason}
                  />
                ),
              )}
            </div>
          </ContentSection>
        )}

        {/* Assets */}
        {publicAssets.length > 0 && (
          <ContentSection label="Assets" count={publicAssets.length}>
            <div className="grid grid-cols-3 gap-3">
              {publicAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          </ContentSection>
        )}

        {/* Stories */}
        {publicStories.length > 0 && (
          <ContentSection label="Stories" count={publicStories.length}>
            <div className="flex flex-col gap-3">
              {publicStories.map(story => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </ContentSection>
        )}

        {/* Articles */}
        {publishedArticles.length > 0 && (
          <ContentSection label="Articles" count={publishedArticles.length}>
            <div className="flex flex-col gap-3">
              {publishedArticles.map(article => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </ContentSection>
        )}

        {/* Collections */}
        {publicCollections.length > 0 && (
          <ContentSection label="Collections" count={publicCollections.length}>
            <div className="grid grid-cols-2 gap-3">
              {publicCollections.map(collection => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          </ContentSection>
        )}

        {/* Recent activity */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent activity</span>
          <div className="border border-slate-200 divide-y divide-slate-200">
            {events.slice(0, 5).map(evt => (
              <div key={evt.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <span className="text-xs text-black">{evt.description}</span>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {new Date(evt.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function ContentSection({ label, count, children, rightSlot }: { label: string; count: number; children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="font-mono text-[10px] text-slate-300">{count}</span>
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
      {children}
    </div>
  )
}

const FORMAT_ICON: Record<string, string> = {
  photo: 'IMG',
  video: 'VID',
  audio: 'AUD',
  text: 'TXT',
  illustration: 'ILL',
  infographic: 'INF',
  vector: 'VEC',
}

function AssetCard({ asset }: { asset: VaultAsset }) {
  const social = mockSocialCounts[asset.id]
  return (
    <Link
      href={`/asset/${asset.id}`}
      className="block border border-slate-200 hover:border-slate-400 transition-colors"
    >
      <div className="aspect-video bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {asset.id ? (
          <img src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold font-mono text-slate-300">{FORMAT_ICON[asset.format]}</span>
        )}
        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-white/80 px-1">
          {asset.format}
        </span>
        {asset.declarationState === 'fully_validated' && (
          <div className="absolute top-2 right-2 bg-white/90 p-0.5">
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-[#0000ff]">
              <path d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
              <path d="M5.5 8l2 2L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      <div className="bg-white px-3 pt-2 pb-1">
        <div className="text-xs font-bold text-black truncate">{asset.title}</div>
        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
          {asset.certifiedAt ? new Date(asset.certifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '·'}
        </div>
      </div>
      <div
        className="bg-white px-3 pb-2.5 flex items-center gap-2"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        {social && (
          <>
            <LikeButton initialCount={social.likes} initialLiked={social.userLiked} size="sm" />
            <CommentCount count={social.comments} />
          </>
        )}
        {asset.creatorPrice && (
          <span className={cn('font-mono text-[10px] font-bold text-slate-400', social && 'ml-auto')}>
            €{(asset.creatorPrice / 100).toFixed(0)}
          </span>
        )}
      </div>
    </Link>
  )
}

function StoryCard({ story }: { story: Story }) {
  const social = mockSocialCounts[story.id]
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
    <Link
      href={`/story/${story.id}`}
      className="block border-2 border-black hover:opacity-95 transition-opacity overflow-hidden"
    >
      {/* Cover image 16:9 */}
      <div className="aspect-video relative overflow-hidden bg-slate-100">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center">
            <span className="text-slate-400 font-mono text-xs">NO IMAGE</span>
          </div>
        )}
        {/* Story label overlay */}
        <div className="absolute top-3 left-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-black px-2 py-0.5">
            Story · {story.assetCount} assets
          </span>
        </div>
        {/* Content mix chips */}
        {mixParts.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
            {mixParts.map((part, i) => (
              <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-white bg-black/60 px-1.5 py-0.5">
                {part}
              </span>
            ))}
          </div>
        )}
        <StateBadge variant={story.publication.toLowerCase() as 'published' | 'draft'} className="absolute top-3 right-3" />
      </div>

      {/* Text content */}
      <div className="px-5 py-4 bg-white">
        <h3 className="text-base font-bold text-black leading-snug">{story.title}</h3>
        {story.subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{story.subtitle}</p>
        )}
        <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">{story.excerpt}</p>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <span className="font-mono text-[10px] text-slate-400">
            {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unpublished'}
          </span>
          {social && (
            <div className="flex items-center gap-2 ml-auto" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
              <LikeButton initialCount={social.likes} initialLiked={social.userLiked} size="sm" />
              <CommentCount count={social.comments} />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function ArticleCard({ article }: { article: Article }) {
  const social = mockSocialCounts[article.id]
  return (
    <Link
      href={`/article/${article.id}`}
      className="block border border-slate-200 hover:border-slate-400 transition-colors overflow-hidden flex"
    >
      {/* Cover image 16:9, fixed width column */}
      <div className="w-48 shrink-0 aspect-video relative overflow-hidden bg-slate-100 self-stretch">
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center">
            <span className="text-slate-400 font-mono text-[10px]">NO IMAGE</span>
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Article</span>
            {article.assemblyVerified && <StateBadge variant="assembly-verified" />}
          </div>
          <h3 className="text-sm font-bold text-black leading-snug">{article.title}</h3>
          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">{article.excerpt}</p>
        </div>
        <div className="flex items-center gap-3 mt-3" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
          <span className="font-mono text-[10px] text-slate-400">
            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unpublished'}
          </span>
          <span className="font-mono text-[10px] text-slate-400">{article.wordCount.toLocaleString('en-US')} words</span>
          {social && (
            <div className="flex items-center gap-2 ml-auto">
              <LikeButton initialCount={social.likes} initialLiked={social.userLiked} size="sm" />
              <CommentCount count={social.comments} />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link href={`/collection/${collection.id}`} className="block border-2 border-black hover:bg-slate-50 transition-colors">
      <div className="grid grid-cols-2 gap-px bg-slate-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-video bg-slate-100 overflow-hidden flex items-center justify-center">
            {collection.thumbnails[i] ? (
              <img src={collection.thumbnails[i]} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-mono text-slate-300">{i < collection.itemCount ? i + 1 : ''}</span>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-white">
        <div className="text-sm font-bold uppercase tracking-wide text-black">{collection.title}</div>
        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{collection.itemCount} items</div>
      </div>
    </Link>
  )
}
