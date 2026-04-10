// ═══════════════════════════════════════════════════════════════
// COMPOSER — Selectors
// Pure functions deriving readiness, stats, and filtered views
// ═══════════════════════════════════════════════════════════════

import type { AssetData } from '@/data'
import { assetMap, storyMap, creatorMap } from '@/data'
import { TRANSACTABLE_DECLARATION_STATES } from '@/lib/types'
import type { ComposerState, ArticleBlocker, ArticleAdvisory, ArticleReadiness, ComposerBlock, InlineTextAsset } from './types'

// ── Ordered blocks ──────────────────────────────────────────

export function getOrderedBlocks(state: ComposerState): ComposerBlock[] {
  return state.blockOrder
    .map(id => state.blocks.find(b => b.id === id))
    .filter((b): b is ComposerBlock => b !== undefined)
}

// ── Word count ──────────────────────────────────────────────

export function getWordCount(state: ComposerState): number {
  return getOrderedBlocks(state)
    .filter((b): b is ComposerBlock & { type: 'text' } => b.type === 'text')
    .reduce((sum, b) => {
      const words = b.content.trim().split(/\s+/).filter(Boolean).length
      return sum + words
    }, 0)
}

// ── Source assets resolved ──────────────────────────────────

export function getSourceAssets(state: ComposerState): AssetData[] {
  return state.sourceAssetIds
    .map(id => assetMap[id])
    .filter((a): a is AssetData => a !== undefined)
}

// ── Inline text assets ──────────────────────────────────────

export function getInlineTextAssets(state: ComposerState): InlineTextAsset[] {
  return Object.values(state.inlineTextAssets)
}

/** Total asset count: vault assets + inline text assets */
export function getTotalAssetCount(state: ComposerState): number {
  return state.sourceAssetIds.length + getInlineTextAssets(state).length
}

// ── Cross-story map ─────────────────────────────────────────

export interface CrossStoryEntry {
  storyId: string
  storyTitle: string
  assetCount: number
  assetIds: string[]
}

export function getCrossStoryMap(state: ComposerState): CrossStoryEntry[] {
  const storyGroups: Record<string, string[]> = {}
  for (const id of state.sourceAssetIds) {
    const asset = assetMap[id]
    if (!asset) continue
    const sid = asset.storyId
    if (!storyGroups[sid]) storyGroups[sid] = []
    storyGroups[sid].push(id)
  }
  return Object.entries(storyGroups).map(([storyId, assetIds]) => {
    const story = storyMap[storyId]
    return {
      storyId,
      storyTitle: story?.title ?? 'Unknown Story',
      assetCount: assetIds.length,
      assetIds,
    }
  })
}

// ── Unique creators ─────────────────────────────────────────

export function getUniqueCreatorIds(state: ComposerState): string[] {
  const ids = new Set<string>()
  for (const id of state.sourceAssetIds) {
    const asset = assetMap[id]
    if (asset) ids.add(asset.creatorId)
  }
  return Array.from(ids)
}

// ── Blocks by type ──────────────────────────────────────────

export function getTextBlocks(state: ComposerState) {
  return getOrderedBlocks(state).filter(b => b.type === 'text')
}

export function getAssetBlocks(state: ComposerState) {
  return getOrderedBlocks(state).filter(b => b.type === 'asset')
}

// ── Readiness ───────────────────────────────────────────────

export function getArticleReadiness(state: ComposerState): ArticleReadiness {
  const blockers: ArticleBlocker[] = []
  const advisories: ArticleAdvisory[] = []
  const sourceAssets = getSourceAssets(state)
  const inlineTextAssets = getInlineTextAssets(state)
  const totalAssets = sourceAssets.length + inlineTextAssets.length
  const wordCount = getWordCount(state)
  const crossStory = getCrossStoryMap(state)
  const creatorIds = getUniqueCreatorIds(state)

  // BLOCKERS

  if (!state.title.trim()) {
    blockers.push({ type: 'no_title', label: 'Article needs a title' })
  }

  // Inline text assets count toward the minimum — text content IS an asset
  if (totalAssets < 2) {
    blockers.push({ type: 'too_few_assets', label: `Minimum 2 assets required (${totalAssets} current)` })
  }

  const hasText = state.blocks.some(b => b.type === 'text' && b.content.trim().length > 0)
  if (!hasText) {
    blockers.push({ type: 'no_text_blocks', label: 'Article needs at least one text block with content' })
  }

  // Non-transactable assets block commit
  for (const asset of sourceAssets) {
    const decl = asset.validationDeclaration
    if (decl && !TRANSACTABLE_DECLARATION_STATES.includes(decl as typeof TRANSACTABLE_DECLARATION_STATES[number])) {
      blockers.push({
        type: 'non_transactable_asset',
        label: `Asset "${asset.title}" is ${decl} — cannot be used`,
        assetId: asset.id,
      })
    }
  }

  // Frontfiles articles require split configured
  if (state.articleType === 'frontfiles_article' && state.split.editorShare <= 0) {
    blockers.push({ type: 'split_not_configured', label: 'Editor share must be set for Frontfiles articles' })
  }

  // Publishing hold: 2 disputes from different buyer accounts within 90 days
  if (state.publishingHold.isHeld) {
    blockers.push({
      type: 'publishing_hold',
      label: `Publishing hold: ${state.publishingHold.recentDisputeCount} disputes from ${state.publishingHold.uniqueBuyerAccounts} buyers in ${state.publishingHold.windowDays} days`,
    })
  }

  // ADVISORIES

  for (const asset of sourceAssets) {
    if (asset.validationDeclaration === 'provenance_pending') {
      advisories.push({
        type: 'provenance_pending_asset',
        label: `Asset "${asset.title}" has provenance pending`,
        assetId: asset.id,
      })
    }
    if (asset.validationDeclaration === 'under_review') {
      advisories.push({
        type: 'under_review_asset',
        label: `Asset "${asset.title}" is under review`,
        assetId: asset.id,
      })
    }
  }

  if (wordCount > 0 && wordCount < 200) {
    advisories.push({ type: 'short_word_count', label: `Word count is low (${wordCount} words)` })
  }

  if (creatorIds.length === 1 && sourceAssets.length > 0) {
    advisories.push({ type: 'single_creator_source', label: 'All source assets from a single creator' })
  }

  // Include the logged-in creator in unique count if they have inline text assets
  const allCreatorIds = [...creatorIds]
  if (inlineTextAssets.length > 0) {
    const inlineCreatorId = inlineTextAssets[0].creatorId
    if (!allCreatorIds.includes(inlineCreatorId)) {
      allCreatorIds.push(inlineCreatorId)
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    advisories,
    wordCount,
    sourceAssetCount: totalAssets,
    uniqueStoryCount: crossStory.length,
    uniqueCreatorCount: allCreatorIds.length,
  }
}

// ── Search filtering ────────────────────────────────────────

export function getFilteredSearchAssets(state: ComposerState, allAssets: AssetData[]): AssetData[] {
  const { query, formatFilter, geographyFilter, storyFilter, creatorFilter, declarationFilter } = state.search

  return allAssets.filter(asset => {
    // Exclude already-added source assets
    if (state.sourceAssetIds.includes(asset.id)) return false

    // Only show PUBLIC transactable assets
    if (asset.privacyLevel !== 'PUBLIC') return false

    // Format filter
    if (formatFilter !== 'all' && asset.format.toLowerCase() !== formatFilter) return false

    // Geography filter
    if (geographyFilter && asset.geography !== geographyFilter) return false

    // Story filter
    if (storyFilter && asset.storyId !== storyFilter) return false

    // Creator filter
    if (creatorFilter && asset.creatorId !== creatorFilter) return false

    // Declaration filter
    if (declarationFilter !== 'all' && asset.validationDeclaration !== declarationFilter) return false

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase()
      const searchable = [asset.title, asset.description, asset.locationLabel, ...asset.tags]
        .join(' ')
        .toLowerCase()
      if (!searchable.includes(q)) return false
    }

    return true
  })
}
