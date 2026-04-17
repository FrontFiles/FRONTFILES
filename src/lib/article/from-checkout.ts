/**
 * Article preview mapping — checkout → ArticlePreview
 *
 * Transforms cart items and transaction line items into the
 * props consumed by `<ArticlePreview />`. The goal is to surface
 * the EDITORIAL OBJECT that frames the asset being licensed —
 * i.e., the article that uses this asset as its hero or source.
 *
 * Rules:
 * - Look up the asset in the articles dataset. Prefer hero
 *   association, then source association.
 * - If no article is found, fall back to asset-level fields
 *   (title → headline, creatorName → byline, assetId → image).
 *   Kind becomes 'source_asset' so the badge reads truthfully.
 * - NEVER invent article fields when data is missing.
 */
import { articles } from '@/data'
import type { ArticleData } from '@/data'
import type { CartItem, TransactionLineItem } from '@/lib/transaction/types'
import type { ArticlePreviewProps } from '@/components/article/ArticlePreview'

// ── Lookup ────────────────────────────────────────────────

/** Find an article that uses this asset as hero or source. */
export function findArticleForAsset(assetId: string): ArticleData | null {
  // Prefer hero association — the asset is the editorial centrepiece
  for (const a of articles) {
    if (a.heroAssetId === assetId) return a
  }
  // Otherwise source association — the asset appears inside an article
  for (const a of articles) {
    if (a.sourceAssetIds.includes(assetId)) return a
  }
  return null
}

// ── Byline resolution ─────────────────────────────────────

function resolveByline(
  article: ArticleData | null,
  fallbackCreatorName: string | null,
): string | null {
  if (article) {
    if (article.articleType === 'creator_article') {
      return article.creatorName ?? article.editorName ?? fallbackCreatorName
    }
    return article.editorName ?? article.creatorName ?? fallbackCreatorName
  }
  return fallbackCreatorName
}

// ── Mappers ───────────────────────────────────────────────

export function articlePreviewFromCartItem(item: CartItem): ArticlePreviewProps {
  const article = findArticleForAsset(item.assetId)
  return {
    headline: article?.title ?? item.assetTitle,
    standfirst: article?.dek ?? null,
    byline: resolveByline(article, item.creatorName ?? null),
    heroAssetId: article?.heroAssetId ?? item.assetId,
    kind: article?.articleType ?? 'source_asset',
    alt: article?.title ?? item.assetTitle,
  }
}

export function articlePreviewFromTransactionLineItem(
  li: TransactionLineItem,
): ArticlePreviewProps {
  const article = findArticleForAsset(li.assetId)
  return {
    headline: article?.title ?? li.assetTitle,
    standfirst: article?.dek ?? null,
    byline: resolveByline(article, li.creatorName ?? null),
    heroAssetId: article?.heroAssetId ?? li.assetId,
    kind: article?.articleType ?? 'source_asset',
    alt: article?.title ?? li.assetTitle,
  }
}
