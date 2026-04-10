// ═══════════════════════════════════════════════════════════════
// COMPOSER — Type Definitions
// State shape for the article assembly environment
// ═══════════════════════════════════════════════════════════════

import type {
  ArticleType,
  ArticlePublishState,
  AssetFormat,
  ValidationDeclarationState,
} from '@/lib/types'

// ── Block types ──────────────────────────────────────────────

export type ComposerBlockType = 'text' | 'asset'

export interface TextBlock {
  id: string
  type: 'text'
  content: string
}

export interface AssetBlock {
  id: string
  type: 'asset'
  assetId: string
  caption: string        // auto-imported from asset description
  editorCaption: string  // additional caption by the article editor
}

export type ComposerBlock = TextBlock | AssetBlock

// ── Inline text assets ──────────────────────────────────────
// Text written in the editor is saved as a Text-format vault asset
// and participates in the article income split like any other asset.

/** EUR per word for creator-written text content */
export const TEXT_WORD_RATE = 0.10

export interface InlineTextAsset {
  blockId: string
  title: string // auto-derived from first line
  wordCount: number
  price: number // EUR, computed from wordCount * TEXT_WORD_RATE
  creatorId: string // the logged-in creator
}

// ── Split configuration ─────────────────────────────────────

export interface SplitConfig {
  /** Editor share as decimal 0.05–0.50 (frontfiles_article only) */
  editorShare: number
  /** True when all source creators match the logged-in creator */
  selfSourceException: boolean
}

export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  editorShare: 0.20,
  selfSourceException: false,
}

/** Per-asset cost breakdown line item */
export interface SplitLineItem {
  assetId: string
  assetTitle: string
  format: AssetFormat | string
  price: number // EUR
  creatorId: string
  creatorName: string
  creatorReceives: number // EUR
  editorReceives: number // EUR
  platformReceives: number // EUR
  buyerPays: number // EUR
}

/** Full article split breakdown */
export interface ArticleSplitBreakdown {
  lineItems: SplitLineItem[]
  totalCreatorReceives: number
  totalEditorReceives: number
  totalPlatformReceives: number
  totalBuyerPays: number
  sourceAssetCount: number
  uniqueCreatorCount: number
}

// ── Search state ────────────────────────────────────────────

export interface ComposerSearchState {
  query: string
  formatFilter: AssetFormat | 'all'
  geographyFilter: string | null
  storyFilter: string | null
  creatorFilter: string | null
  declarationFilter: ValidationDeclarationState | 'all'
}

export const INITIAL_SEARCH_STATE: ComposerSearchState = {
  query: '',
  formatFilter: 'all',
  geographyFilter: null,
  storyFilter: null,
  creatorFilter: null,
  declarationFilter: 'all',
}

// ── UI state ────────────────────────────────────────────────

export interface ComposerUIState {
  focusedBlockId: string | null
  focusedAssetId: string | null
  inspectorCollapsed: boolean
  searchRailCollapsed: boolean
  confirmingPublish: boolean
}

export const INITIAL_UI_STATE: ComposerUIState = {
  focusedBlockId: null,
  focusedAssetId: null,
  inspectorCollapsed: false,
  searchRailCollapsed: false,
  confirmingPublish: false,
}

// ── Readiness ───────────────────────────────────────────────

export type BlockerType =
  | 'no_title'
  | 'too_few_assets'
  | 'no_text_blocks'
  | 'non_transactable_asset'
  | 'split_not_configured'
  | 'publishing_hold'

export type AdvisoryType =
  | 'provenance_pending_asset'
  | 'under_review_asset'
  | 'short_word_count'
  | 'single_creator_source'
  | 'no_caption_on_asset'

export interface ArticleBlocker {
  type: BlockerType
  label: string
  assetId?: string
}

export interface ArticleAdvisory {
  type: AdvisoryType
  label: string
  assetId?: string
}

export interface ArticleReadiness {
  ready: boolean
  blockers: ArticleBlocker[]
  advisories: ArticleAdvisory[]
  wordCount: number
  sourceAssetCount: number
  uniqueStoryCount: number
  uniqueCreatorCount: number
}

// ── Saved searches ─────────────────────────────────────────

export interface SavedSearch {
  id: string
  label: string
  query: string
  formatFilter: AssetFormat | 'all'
  alertEnabled: boolean
  createdAt: string
}

// ── Editor eligibility ─────────────────────────────────────

export interface EditorEligibility {
  isTrusted: boolean
  publishedAssetCount: number
  activeDisputes: number
  upheldIn24Months: number
  upheldIn6Months: number
}

export function checkEditorEligibility(elig: EditorEligibility): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!elig.isTrusted) reasons.push('Trusted badge required')
  if (elig.publishedAssetCount < 50) reasons.push(`Need 50 published assets (${elig.publishedAssetCount} current)`)
  if (elig.activeDisputes > 0) reasons.push(`No active disputes allowed (${elig.activeDisputes} current)`)
  if (elig.upheldIn24Months > 2) reasons.push(`Max 2 upheld disputes in 24 months (${elig.upheldIn24Months} current)`)
  if (elig.upheldIn6Months > 0) reasons.push(`No upheld disputes in 6 months (${elig.upheldIn6Months} current)`)
  return { eligible: reasons.length === 0, reasons }
}

/** Mock eligibility — in production comes from API */
export const MOCK_EDITOR_ELIGIBILITY: EditorEligibility = {
  isTrusted: true,
  publishedAssetCount: 127,
  activeDisputes: 0,
  upheldIn24Months: 1,
  upheldIn6Months: 0,
}

// ── Publishing hold ────────────────────────────────────────

export interface PublishingHoldCheck {
  isHeld: boolean
  recentDisputeCount: number
  uniqueBuyerAccounts: number
  windowDays: number
}

/** Mock hold state — in production comes from API */
export const MOCK_PUBLISHING_HOLD: PublishingHoldCheck = {
  isHeld: false,
  recentDisputeCount: 0,
  uniqueBuyerAccounts: 0,
  windowDays: 90,
}

// ── Root state ──────────────────────────────────────────────

export interface ComposerState {
  // Article metadata
  articleType: ArticleType
  title: string
  dek: string
  publishState: ArticlePublishState

  // Content blocks (ordered)
  blocks: ComposerBlock[]
  blockOrder: string[] // block IDs in order

  // Source assets (by ID) — vault assets dragged from search rail
  sourceAssetIds: string[]

  // Inline text assets — text blocks saved as Text-format vault assets
  inlineTextAssets: Record<string, InlineTextAsset>

  // Split configuration
  split: SplitConfig

  // Saved searches
  savedSearches: SavedSearch[]

  // Editor eligibility (mock — in production from API)
  eligibility: EditorEligibility

  // Publishing hold (mock — in production from API)
  publishingHold: PublishingHoldCheck

  // Sub-states
  search: ComposerSearchState
  ui: ComposerUIState

  // Timestamps
  createdAt: string
  savedAt: string | null
}

export function createInitialComposerState(): ComposerState {
  const firstBlockId = `block-${Date.now()}`
  return {
    articleType: 'creator_article',
    title: '',
    dek: '',
    publishState: 'draft',
    blocks: [{ id: firstBlockId, type: 'text', content: '' }],
    blockOrder: [firstBlockId],
    sourceAssetIds: [],
    inlineTextAssets: {},
    split: { ...DEFAULT_SPLIT_CONFIG },
    savedSearches: [],
    eligibility: { ...MOCK_EDITOR_ELIGIBILITY },
    publishingHold: { ...MOCK_PUBLISHING_HOLD },
    search: { ...INITIAL_SEARCH_STATE },
    ui: { ...INITIAL_UI_STATE },
    createdAt: new Date().toISOString(),
    savedAt: null,
  }
}

// ── Actions ─────────────────────────────────────────────────

export type ComposerAction =
  // Article metadata
  | { type: 'SET_ARTICLE_TYPE'; payload: ArticleType }
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_DEK'; payload: string }

  // Block operations
  | { type: 'ADD_TEXT_BLOCK'; payload: { afterBlockId: string | null } }
  | { type: 'ADD_ASSET_BLOCK'; payload: { assetId: string; afterBlockId: string | null } }
  | { type: 'REMOVE_BLOCK'; payload: { blockId: string } }
  | { type: 'REORDER_BLOCKS'; payload: { blockOrder: string[] } }
  | { type: 'UPDATE_TEXT_BLOCK'; payload: { blockId: string; content: string } }
  | { type: 'UPDATE_ASSET_CAPTION'; payload: { blockId: string; caption: string } }
  | { type: 'UPDATE_ASSET_EDITOR_CAPTION'; payload: { blockId: string; editorCaption: string } }

  // Source assets
  | { type: 'ADD_SOURCE_ASSET'; payload: { assetId: string } }
  | { type: 'REMOVE_SOURCE_ASSET'; payload: { assetId: string } }

  // Split
  | { type: 'SET_EDITOR_SHARE'; payload: number }
  | { type: 'SET_SELF_SOURCE_EXCEPTION'; payload: boolean }

  // Search rail
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_FORMAT_FILTER'; payload: AssetFormat | 'all' }
  | { type: 'SET_SEARCH_GEOGRAPHY_FILTER'; payload: string | null }
  | { type: 'SET_SEARCH_STORY_FILTER'; payload: string | null }
  | { type: 'SET_SEARCH_CREATOR_FILTER'; payload: string | null }
  | { type: 'SET_SEARCH_DECLARATION_FILTER'; payload: ValidationDeclarationState | 'all' }

  // Saved searches
  | { type: 'SAVE_CURRENT_SEARCH'; payload: { label: string } }
  | { type: 'REMOVE_SAVED_SEARCH'; payload: { id: string } }
  | { type: 'TOGGLE_SEARCH_ALERT'; payload: { id: string } }
  | { type: 'APPLY_SAVED_SEARCH'; payload: { id: string } }

  // Block reorder
  | { type: 'MOVE_BLOCK_UP'; payload: { blockId: string } }
  | { type: 'MOVE_BLOCK_DOWN'; payload: { blockId: string } }

  // UI
  | { type: 'FOCUS_BLOCK'; payload: string | null }
  | { type: 'FOCUS_ASSET'; payload: string | null }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'TOGGLE_SEARCH_RAIL' }
  | { type: 'SET_CONFIRMING_PUBLISH'; payload: boolean }

  // Lifecycle
  | { type: 'SAVE_DRAFT' }
  | { type: 'PUBLISH' }
