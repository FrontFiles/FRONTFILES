// ══════════════════════════════════════════════════════════════
// COMPOSER — Article preview bridge
// ══════════════════════════════════════════════════════════════
//
// Small, intentional module. Its only job is to let Composer preview
// the current draft through the canonical rendered article surface
// (`/article/[id]`) without introducing a second preview subsystem.
//
// Flow:
//   1. Composer's "Preview article" button calls `writePreviewArticle(state)`.
//   2. Composer opens `/article/_preview` in a new tab.
//   3. The article page detects the `_preview` magic id and calls
//      `readPreviewArticle()` to deserialize the draft back into an
//      ArticleData instance, then renders it with ArticleDetailView.
//
// Storage: sessionStorage only. Scoped to the tab, cleared on tab close.
// Never persisted server-side. Never leaves the browser.

import type { ComposerState } from './types'
import type { ArticleData } from '@/data/articles'
import { getWordCount } from './selectors'

export const PREVIEW_ARTICLE_ID = '_preview'
export const PREVIEW_STORAGE_KEY = 'frontfiles:composer:preview:article'

/** True when there is enough in the draft to render a meaningful preview. */
export function isPreviewReady(state: ComposerState): boolean {
  if (state.title.trim().length > 0) return true
  if (state.sourceAssetIds.length > 0) return true
  return state.blocks.some(
    b => b.type === 'text' && b.content.trim().length > 0
  )
}

/** Build an ArticleData-shaped object from the current Composer draft.
 *  Fields the renderer doesn't need for preview are left empty or filled
 *  with conservative defaults. The returned object is safe to pass into
 *  the existing ArticleDetailView without touching the article renderer. */
export function buildPreviewArticleFromState(state: ComposerState): ArticleData {
  const title = state.title.trim() || 'Untitled draft'
  const dek = state.dek.trim() || ''
  const heroAssetId = state.sourceAssetIds[0] ?? ''

  const summaryFromBlocks = state.blocks
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.content.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 400)

  return {
    id: PREVIEW_ARTICLE_ID,
    slug: PREVIEW_ARTICLE_ID,
    title,
    dek,
    summary: summaryFromBlocks,
    articleType: state.articleType,
    editorName:
      state.articleType === 'frontfiles_article' ? 'Composer draft' : null,
    creatorName:
      state.articleType === 'creator_article' ? 'Composer draft' : null,
    sourceAssetIds: [...state.sourceAssetIds],
    sourceStoryIds: [],
    sourceCreatorIds: [],
    primaryGeography: '',
    topicTags: [],
    publishedAt: new Date().toISOString(),
    heroAssetId,
    wordCount: getWordCount(state),
    relatedArticleIds: [],
    relatedStoryIds: [],
    relatedAssetIds: [],
    recommendationReasons: [],
    spotlightEligible: false,
    curatedEligible: false,
  }
}

/** Persist a preview article to sessionStorage. Safe to call from a
 *  client component (checks for `window`). */
export function writePreviewArticle(article: ArticleData): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      PREVIEW_STORAGE_KEY,
      JSON.stringify(article)
    )
  } catch {
    // Quota or disabled storage — swallow. The article page will show
    // the "preview not available" state.
  }
}

/** Read the last-persisted preview article. Returns null when there is
 *  none, when parsing fails, or when storage is unavailable. */
export function readPreviewArticle(): ArticleData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ArticleData
    // Minimal shape check so a malformed payload never reaches the renderer.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.title !== 'string' ||
      !Array.isArray(parsed.sourceAssetIds)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Clear the persisted preview. Optional; the renderer works either way. */
export function clearPreviewArticle(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY)
  } catch {
    /* noop */
  }
}
