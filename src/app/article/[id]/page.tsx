'use client'

import { use, useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { getAvatarCrop } from '@/lib/avatar-crop'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import {
  articleMap,
  assetMap,
  storyMap,
  creatorMap,
  articles,
  assets as allPlatformAssets,
  type AssetData,
  type ArticleData,
} from '@/data'
import {
  PREVIEW_ARTICLE_ID,
  readPreviewArticle,
} from '@/lib/composer/preview'

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // Composer preview: magic id reads the draft from sessionStorage so the
  // full rendered surface can be reused without a second preview subsystem.
  if (id === PREVIEW_ARTICLE_ID) {
    return <ComposerPreviewLoader />
  }

  const article = articleMap[id]

  if (!article) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Article not found.</p>
      </div>
    )
  }

  return <ArticleDetailView article={article} />
}

function ComposerPreviewLoader() {
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    setArticle(readPreviewArticle())
    setResolved(true)
  }, [])

  if (!resolved) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading preview…</p>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm font-bold text-black">Preview not available.</p>
          <p className="text-xs text-slate-500 mt-2">
            Open Composer, start a draft, and click <strong>Preview article</strong> to see
            it rendered here.
          </p>
        </div>
      </div>
    )
  }

  return <ArticleDetailView article={article} />
}

// ── Editable draft type ───────────────────────────────
interface ArticleDraft {
  title: string
  dek: string
  summary: string
  topicTags: string[]
  heroAssetId: string
}

function ArticleDetailView({ article }: { article: ArticleData }) {
  const STORAGE_KEY = `article-edit-${article.id}`
  const ORDER_KEY = `article-source-order-${article.id}`

  // ── Editing state ─────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<ArticleDraft>({
    title: article.title,
    dek: article.dek,
    summary: article.summary,
    topicTags: [...article.topicTags],
    heroAssetId: article.heroAssetId,
  })
  const [savedEdits, setSavedEdits] = useState<ArticleDraft | null>(null)
  const [newTag, setNewTag] = useState('')

  // ── Source asset ordering (drag to reorder, first = hero) ──
  const [sourceOrder, setSourceOrder] = useState<string[]>(article.sourceAssetIds)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY)
      if (saved) {
        const ids: string[] = JSON.parse(saved)
        // Merge: keep saved order, append any new IDs not in saved
        const known = new Set(ids)
        const merged = [...ids.filter(id => article.sourceAssetIds.includes(id))]
        for (const id of article.sourceAssetIds) {
          if (!known.has(id)) merged.push(id)
        }
        setSourceOrder(merged)
      }
    } catch {}
  }, [ORDER_KEY, article.sourceAssetIds])

  function handleSourceDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const next = [...sourceOrder]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setSourceOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
  }

  // Load persisted edits from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedEdits(JSON.parse(raw))
    } catch {}
  }, [STORAGE_KEY])

  // Merged display data (saved edits override base article)
  const display = savedEdits ? { ...article, ...savedEdits } : article

  function startEdit() {
    setDraft({
      title: display.title,
      dek: display.dek,
      summary: display.summary,
      topicTags: [...display.topicTags],
      heroAssetId: display.heroAssetId,
    })
    setIsEditing(true)
  }

  function saveEdit() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)) } catch {}
    setSavedEdits({ ...draft })
    setIsEditing(false)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  function removeTag(tag: string) {
    setDraft(d => ({ ...d, topicTags: d.topicTags.filter(t => t !== tag) }))
  }

  function addTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !draft.topicTags.includes(t)) {
      setDraft(d => ({ ...d, topicTags: [...d.topicTags, t] }))
    }
    setNewTag('')
  }

  // Derived display values — hero comes from source order (first = cover)
  const effectiveHeroId = isEditing ? draft.heroAssetId : (sourceOrder[0] || display.heroAssetId)
  const heroAsset = assetMap[effectiveHeroId]
  const sourceAssets = sourceOrder.map(aid => assetMap[aid]).filter(Boolean)
  const sourceStories = display.sourceStoryIds.map(sid => storyMap[sid]).filter(Boolean)
  const sourceCreators = display.sourceCreatorIds.map(cid => creatorMap[cid]).filter(Boolean)
  const relatedArticles = display.relatedArticleIds.map(aid => articleMap[aid]).filter(Boolean)
  const relatedStories = display.relatedStoryIds
    .filter(sid => !display.sourceStoryIds.includes(sid))
    .map(sid => storyMap[sid])
    .filter(Boolean)
  const relatedAssets = display.relatedAssetIds.map(aid => assetMap[aid]).filter(Boolean)

  const primaryCreator = sourceCreators[0]
  const authorName = article.articleType === 'creator_article'
    ? (article.creatorName || primaryCreator?.name || 'Creator')
    : (article.editorName || 'Frontfiles Editorial')

  const hasEdits = savedEdits !== null

  return (
    <div className="flex-1 overflow-y-auto bg-white">

      {/* ── Edit mode sticky toolbar ─────────────────── */}
      {isEditing && (
        <div className="sticky top-0 z-50 bg-[#0000ff] border-b-2 border-black flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-3">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">
              Editing as {authorName}
            </span>
            <span className="text-[9px] text-white/50 font-mono">· changes saved locally</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEdit}
              className="text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white px-3 py-1.5 border border-white/30 hover:border-white transition-colors"
            >
              Discard
            </button>
            <button
              onClick={saveEdit}
              className="text-[10px] font-bold uppercase tracking-wider bg-white text-[#0000ff] hover:bg-white/90 px-4 py-1.5 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <main>
        <div className="w-[min(calc(100%-2rem),1080px)] mx-auto py-10">

          {/* ── Format badge + canonical action ───── */}
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-block text-xs font-black uppercase tracking-[0.18em] bg-[#0000ff] text-white px-3 py-1">
              Article
            </span>
            {hasEdits && !isEditing && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff] border border-[#0000ff] px-2 py-0.5">
                Edited
              </span>
            )}
            {article.id !== PREVIEW_ARTICLE_ID && (
              <a
                href={`/article/${article.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white text-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
                title="Open the canonical rendered article in a new tab"
              >
                View finished article
              </a>
            )}
          </div>

          {/* ── Article header with right rail ────── */}
          <div className="flex gap-8 mb-8">
            {/* Left: hero + title + dek + summary */}
            <div className="flex-1 min-w-0">
              {/* Hero image */}
              {heroAsset && (
                <div className="aspect-video overflow-hidden bg-slate-100 mb-6">
                  <img src={resolveProtectedUrl(heroAsset.id, 'thumbnail')} alt={display.title} className="w-full h-full object-cover" />
                </div>
              )}

              <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold text-black tracking-tight leading-[1.1] mb-3">
                {display.title}
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">{display.dek}</p>
              <p className="text-sm text-slate-400 leading-relaxed mt-3">{display.summary}</p>
            </div>

            {/* Right rail: author + metadata */}
            <div className="hidden lg:block w-[280px] shrink-0 border-l-2 border-[#0b1220] pl-6">
              <div className="flex flex-col gap-4">
                {/* Author */}
                {primaryCreator ? (
                  <div className="pb-4 border-b border-slate-200">
                    <Link href={`/creator/${primaryCreator.slug}/frontfolio`} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 bg-slate-200 border-2 border-black overflow-hidden shrink-0">
                        {primaryCreator.avatarRef ? (
                          <img src={primaryCreator.avatarRef} alt={primaryCreator.name} className="w-full h-full object-cover" style={{ objectPosition: getAvatarCrop(primaryCreator.slug) }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-400">{primaryCreator.name.charAt(0)}</div>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-black group-hover:text-[#0000ff] transition-colors">{primaryCreator.name}</span>
                        <span className="block text-[11px] text-slate-400">{primaryCreator.locationBase}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 mt-3 ml-[52px]">
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="Website">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="Instagram">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><path d="M17.5 6.5h.01" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="X / Twitter">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      </a>
                      <a href="#" className="text-slate-400 hover:text-[#0000ff] transition-colors" title="LinkedIn">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
                      </a>
                    </div>
                  </div>
                ) : article.editorName ? (
                  <div className="pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black border-2 border-black overflow-hidden shrink-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-white">FF</span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-black">{article.editorName}</span>
                        <span className="block text-[11px] text-slate-400">Frontfiles Editorial</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {article.price && (
                  <div className="pb-4 border-b border-slate-200">
                    <span className="text-2xl font-bold font-mono text-black">&euro;{article.price}</span>
                    {article.licenseType && (
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-[#0000ff] mt-1">{article.licenseType} license</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0000ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <span className="text-lg font-bold text-black">{sourceAssets.length}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Published</span>
                  <span className="text-xs font-mono text-black">{new Date(article.publishedAt).toISOString().split('T')[0]}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Geography</span>
                  <span className="text-xs font-bold text-black">{article.primaryGeography.replace('geo-', '').replace(/-/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Words</span>
                  <span className="text-xs font-bold text-black">{(article.wordCount / 1000).toFixed(1)}k</span>
                </div>
                {display.topicTags.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-1">
                      {display.topicTags.map(tag => (
                        <span key={tag} className="inline-flex items-center h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider border-2 border-black bg-white text-black">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {sourceStories.length > 0 && (
                  <div className="pt-3 border-t border-slate-200">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Appears in</span>
                    {sourceStories.map(s => (
                      <Link
                        key={s.id}
                        href={`/story/${s.id}`}
                        className="block border-2 border-slate-200 p-3 hover:border-black transition-colors mb-2"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0000ff]">Story</span>
                        <p className="text-sm font-bold text-black mt-1 leading-tight">{s.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Source assets — canonical grid ────── */}
          {sourceAssets.length > 0 && (
            <>
              <div className="mt-8 border-t-2 border-black" />
              <SectionLabel label="Source assets" sublabel={`${sourceAssets.length} certified sources`} />
              <div className="grid grid-cols-4 gap-4 mb-10">
                {sourceAssets.map(a => (
                  <AssetCard key={a.id} asset={a} showCreator />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Section label ─────────────────────────────────────

function SectionLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4 border-b border-slate-200 pb-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">{label}</h2>
      {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
    </div>
  )
}

// ── Infinite scroll recommendations ───────────────────

const BATCH_SIZE = 6

function InfiniteRecommendations({
  articleId,
  tags,
  geography,
  sourceCreatorIds,
  sourceAssetIds,
}: {
  articleId: string
  tags: string[]
  geography: string
  sourceCreatorIds: string[]
  sourceAssetIds: string[]
}) {
  const pool = useMemo(() => {
    const excluded = new Set(sourceAssetIds)
    const tagSet = new Set(tags.map(t => t.toLowerCase()))
    const creatorSet = new Set(sourceCreatorIds)

    return allPlatformAssets
      .filter(a => !excluded.has(a.id))
      .map(a => {
        let score = 0
        const matchingTags = a.tags.filter(t => tagSet.has(t.toLowerCase()))
        score += matchingTags.length * 3
        if (a.geography === geography) score += 2
        if (creatorSet.has(a.creatorId)) score += 2
        if (a.relatedArticleIds?.includes(articleId) || a.sourceArticleIds?.includes(articleId)) score += 4
        score += Math.random() * 0.5
        return { asset: a, score, reason: buildReason(matchingTags, a.geography === geography, creatorSet.has(a.creatorId)) }
      })
      .sort((a, b) => b.score - a.score)
  }, [articleId, tags, geography, sourceCreatorIds, sourceAssetIds])

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < pool.length && !loading) {
          setLoading(true)
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + BATCH_SIZE, pool.length))
            setLoading(false)
          }, 400)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, pool.length, loading])

  const visible = pool.slice(0, visibleCount)

  if (pool.length === 0) return null

  return (
    <section className="mb-10">
      <div className="border-t-2 border-black pt-6 mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">Suggested for you</h2>
        <p className="text-xs text-slate-400 mt-1">Based on this article's subject, sources, and your browsing</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {visible.map(({ asset, reason }) => (
          <div key={asset.id} className="relative">
            <AssetCard asset={asset} showCreator />
            {reason && (
              <div className="mt-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{reason}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finding more</span>
        </div>
      )}

      {visibleCount < pool.length && (
        <div ref={sentinelRef} className="h-1" />
      )}

      {visibleCount >= pool.length && pool.length > 0 && (
        <div className="text-center py-8 border-t border-slate-200 mt-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {pool.length} suggestions · End of results
          </span>
        </div>
      )}
    </section>
  )
}

function buildReason(matchingTags: string[], sameGeo: boolean, sameCreator: boolean): string {
  if (matchingTags.length > 0) return `Similar: ${matchingTags[0]}`
  if (sameGeo) return 'Same region'
  if (sameCreator) return 'Same creator'
  return ''
}
