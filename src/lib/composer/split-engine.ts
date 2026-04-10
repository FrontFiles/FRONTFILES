// ═══════════════════════════════════════════════════════════════
// COMPOSER — Split Engine
// Computes per-asset cost breakdown for article transactions
// ═══════════════════════════════════════════════════════════════

import { PLATFORM_FEES } from '@/lib/types'
import { assetMap, creatorMap } from '@/data'
import type { ComposerState, SplitConfig, SplitLineItem, ArticleSplitBreakdown } from './types'

// ── Constants ───────────────────────────────────────────────

/** Creator articles: 5% editor-creator share, standard platform fees */
const CREATOR_ARTICLE_PLATFORM_FEE = PLATFORM_FEES.direct.creatorFee // 0.20
const CREATOR_ARTICLE_EDITOR_SHARE = 0.05 // 5% editor-creator share → 75/5/20 split

/** Frontfiles articles: editor share configurable 5-50%, same platform fee */
const FRONTFILES_ARTICLE_PLATFORM_FEE = PLATFORM_FEES.direct.creatorFee // 0.20

/** Buyer markup applied to article transactions */
const BUYER_MARKUP = PLATFORM_FEES.direct.buyerMarkup // 0.20

// ── Split computation ───────────────────────────────────────

/**
 * Compute the full article split breakdown.
 *
 * For creator_article:
 *   - Creator gets 75% of asset price
 *   - Editor-creator gets 5% of asset price
 *   - Platform gets 20%
 *   - Buyer pays price * (1 + buyerMarkup)
 *
 * For frontfiles_article:
 *   - Creator gets (1 - platformFee - editorShare) of asset price
 *   - Editor gets editorShare of asset price (configurable 5-50%)
 *   - Platform gets platformFee (20%)
 *   - Buyer pays price * (1 + buyerMarkup)
 *
 * Self-source exception (all assets from logged-in creator):
 *   - No editor share; creator gets 80%, platform 20%
 */
export function computeArticleSplit(state: ComposerState): ArticleSplitBreakdown {
  const isCreatorArticle = state.articleType === 'creator_article'
  const isSelfSource = state.split.selfSourceException

  // Self-source exception: no editor share (creator gets 80%)
  // Creator article: fixed 5% editor-creator share (75/5/20)
  // Frontfiles article: configurable editor share (5-50%)
  const effectiveEditorShare = isSelfSource
    ? 0
    : isCreatorArticle
      ? CREATOR_ARTICLE_EDITOR_SHARE
      : state.split.editorShare

  const platformFee = isCreatorArticle
    ? CREATOR_ARTICLE_PLATFORM_FEE
    : FRONTFILES_ARTICLE_PLATFORM_FEE

  const lineItems: SplitLineItem[] = []
  let totalCreatorReceives = 0
  let totalEditorReceives = 0
  let totalPlatformReceives = 0
  let totalBuyerPays = 0
  const creatorIds = new Set<string>()

  // Helper to compute split for a single asset
  function addLineItem(
    id: string, title: string, format: string,
    price: number, crId: string, crName: string,
  ) {
    creatorIds.add(crId)
    const creatorShare = 1 - platformFee - effectiveEditorShare
    const creatorReceives = Math.round(price * creatorShare * 100) / 100
    const editorReceives = Math.round(price * effectiveEditorShare * 100) / 100
    const platformReceives = Math.round((price - creatorReceives - editorReceives) * 100) / 100
    const buyerPays = Math.round(price * (1 + BUYER_MARKUP) * 100) / 100

    lineItems.push({
      assetId: id,
      assetTitle: title,
      format,
      price,
      creatorId: crId,
      creatorName: crName,
      creatorReceives,
      editorReceives,
      platformReceives,
      buyerPays,
    })

    totalCreatorReceives += creatorReceives
    totalEditorReceives += editorReceives
    totalPlatformReceives += platformReceives
    totalBuyerPays += buyerPays
  }

  // Vault source assets
  for (const assetId of state.sourceAssetIds) {
    const asset = assetMap[assetId]
    if (!asset) continue
    const price = asset.price ?? 0
    const creator = creatorMap[asset.creatorId]
    addLineItem(assetId, asset.title, asset.format, price, asset.creatorId, creator?.name ?? 'Unknown')
  }

  // Inline text assets — creator-written text treated as Text-format vault assets
  for (const inlineAsset of Object.values(state.inlineTextAssets)) {
    const creator = creatorMap[inlineAsset.creatorId]
    addLineItem(
      `inline-${inlineAsset.blockId}`,
      inlineAsset.title,
      'Text',
      inlineAsset.price,
      inlineAsset.creatorId,
      creator?.name ?? 'Unknown',
    )
  }

  return {
    lineItems,
    totalCreatorReceives,
    totalEditorReceives,
    totalPlatformReceives,
    totalBuyerPays,
    sourceAssetCount: lineItems.length,
    uniqueCreatorCount: creatorIds.size,
  }
}

// ── Self-source detection ───────────────────────────────────

/**
 * Check if all source assets belong to the given creator.
 * When true, the self-source exception applies: no editor share.
 */
export function detectSelfSource(state: ComposerState, loggedInCreatorId: string): boolean {
  if (state.sourceAssetIds.length === 0) return false
  return state.sourceAssetIds.every(id => {
    const asset = assetMap[id]
    return asset?.creatorId === loggedInCreatorId
  })
}

// ── Formatting ──────────────────────────────────────────────

export function formatEur(amount: number): string {
  return `\u20AC${amount.toFixed(2)}`
}
