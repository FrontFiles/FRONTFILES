/**
 * Frontfiles Upload V3 — Domain Types
 *
 * Spec: docs/upload/UX-SPEC-V3.md (C1, ratified)
 * Plan: docs/upload/C2-PLAN.md (ratified)
 * Directive: docs/upload/C2.1-DIRECTIVE.md (ratified with Option B amendment)
 *
 * V3 is the canonical interaction model after Phase C C2.
 *
 * Type-import discipline (per C2-PLAN §3.1, §3.3):
 * - V2Asset and supporting fixture types are RE-EXPORTED here (data-model
 *   contract preserved per UX-BRIEF v3 §4.7).
 * - V2State, V2UIState, V2Stage, MobileTab, TableColumn are NOT re-exported
 *   (superseded; stages removed; mobile flow is C5+; no table view).
 * - DensityMode (the V2 'comfortable' | 'compact' toggle type) is NOT
 *   re-exported (V3 density is computed via densityForCount, not toggled).
 */

import type {
  V2Asset,
  V2StoryGroup,
  V2Defaults,
  V2Filter,
  V2FilterPreset,
  V2Exception,
  V2CompletionSummary,
  AssetEditableFields,
  AssetProposal,
  ExceptionType,
  ExtractedMetadata,
  MetadataConflict,
  MetadataSource,
  StoryGroupKind,
  AnalysisStatus,
  CommitOutcome,
  DuplicateStatus,
  V2PriceFactor,
  V2PriceSuggestion,
  StoryCandidate,
} from './v2-types'
import { EXCEPTION_LABELS } from './v2-types'

// ── Re-exports (V2Asset shape preserved per UX-BRIEF v3 §4.7) ───────

export type {
  V2Asset,
  V2StoryGroup,
  V2Defaults,
  V2Filter,
  V2FilterPreset,
  V2Exception,
  V2CompletionSummary,
  AssetEditableFields,
  AssetProposal,
  ExceptionType,
  ExtractedMetadata,
  MetadataConflict,
  MetadataSource,
  StoryGroupKind,
  AnalysisStatus,
  CommitOutcome,
  DuplicateStatus,
  V2PriceFactor,
  V2PriceSuggestion,
  StoryCandidate,
}

export { EXCEPTION_LABELS }

// ── V3 Density Mode (computed, not toggled) ─────────────────────────

export type V3DensityMode = 'linear' | 'compact' | 'batch' | 'archive'

/**
 * Density is a pure derivation of asset count per UX-SPEC-V3 §6.3
 * "Thresholds are guidelines, not gates. The mode auto-selects on
 * file count change."
 */
export function densityForCount(count: number): V3DensityMode {
  if (count <= 5) return 'linear'
  if (count <= 19) return 'compact'
  if (count <= 99) return 'batch'
  return 'archive'
}

// ── V3 UI State ─────────────────────────────────────────────────────

export interface V3UIState {
  selectedAssetIds: string[]
  /** Single source of truth for side-panel-open. null = panel closed. */
  sidePanelOpenAssetId: string | null
  /** Opt-in overlay per UX-SPEC-V3 §8.1. Default per density mode. */
  storyGroupOverlayOn: boolean
  /** Compact mode toggle; auto-true in Batch/Archive. */
  bulkOpsBarOpen: boolean
  /** Archive mode accordion state. */
  expandedClusterIds: string[]
  /** Archive mode override per UX-SPEC-V3 §6.3. DEPRECATED at D2.1; removed at D2.8 cutover. */
  flatListOverride: boolean
  filter: V2Filter
  searchQuery: string
  sortField: 'filename' | 'format' | 'story' | 'privacy' | 'price' | 'status' | 'declaration' | 'issues' | 'title' | 'size' | 'captureDate' | 'confidence' | 'location'
  sortDirection: 'asc' | 'desc'
  sessionDefaultsBarCollapsed: boolean
  // ── D2.1 additions (per UX-SPEC-V4 §15.2) ──────────────────────
  /** Contact-sheet card-size step (5 discrete values). Replaces density auto-detection. */
  contactSheetZoom: 1 | 2 | 3 | 4 | 5
  /** Left rail collapsed-to-icon-strip state. Persists per session. */
  leftRailCollapsed: boolean
  /** Compare mode asset ids. Length-2 enters Comparing layout state per IPV4-3. */
  compareAssetIds: string[]
  /** "Why this price?" expand state. Single asset at a time. */
  priceBasisOpenAssetId: string | null
}

// ── V3 Commit State Machine (per UX-SPEC-V3 §11) ────────────────────

export type V3CommitPhase =
  | 'idle'
  | 'summary'
  | 'committing'
  | 'success'
  | 'partial-failure'

export interface V3CommitState {
  phase: V3CommitPhase
  perAssetProgress: Record<string, number> // 0-100 during 'committing'
  failed: Array<{ assetId: string; error: string }>
}

// ── V3 AI Cluster Proposal Banner State (per UX-SPEC-V3 §5.2) ───────

export type V3ClusterProposalStatus = 'pending' | 'accepted' | 'dismissed'

export interface V3ClusterProposalState {
  proposalId: string
  clusterName: string
  proposedAssetIds: string[]
  rationale: string
  confidence: number
  status: V3ClusterProposalStatus
}

// ── V3 Root State ───────────────────────────────────────────────────

export interface V3State {
  batch: {
    id: string
    createdAt: string
    committedAt: string | null
    // No `currentStage` — single-screen model per UX-SPEC-V3 §2.
    // No `newsroomMode` — newsroom-side only per IP-2.
  }
  assetsById: Record<string, V2Asset>
  assetOrder: string[]
  storyGroupsById: Record<string, V2StoryGroup>
  storyGroupOrder: string[]
  defaults: V2Defaults
  ui: V3UIState
  commit: V3CommitState
  aiClusterProposals: V3ClusterProposalState[]
}

// ── V3 Action Union ─────────────────────────────────────────────────

export type V3Action =
  // ── File ingestion ──
  | {
      type: 'ADD_FILES'
      files: Array<{
        id?: string
        filename: string
        fileSize: number
        format: V2Asset['format']
        file: File | null
        thumbnailRef?: string | null
      }>
    }
  | { type: 'REMOVE_FILE'; assetId: string }

  // ── Per-asset analysis lifecycle (no batch transition) ──
  | { type: 'UPDATE_ANALYSIS_PROGRESS'; assetId: string; progress: number }
  | {
      type: 'UPDATE_ANALYSIS_RESULT'
      assetId: string
      proposal: AssetProposal
      declarationState: V2Asset['declarationState']
      duplicateStatus?: 'none' | 'likely_duplicate'
      duplicateOfId?: string | null
      extractedMetadata?: ExtractedMetadata | null
      conflicts?: MetadataConflict[]
    }
  | { type: 'ANALYSIS_FAILED'; assetId: string }

  // ── Selection ──
  | { type: 'SELECT_ASSET'; assetId: string }
  | { type: 'TOGGLE_ASSET_SELECTION'; assetId: string }
  | { type: 'SELECT_ASSETS'; assetIds: string[] }
  | { type: 'DESELECT_ALL_ASSETS' }
  | { type: 'SELECT_RANGE'; fromAssetId: string; toAssetId: string }

  // ── Side panel ──
  | { type: 'OPEN_SIDE_PANEL'; assetId: string }
  | { type: 'CLOSE_SIDE_PANEL' }
  | { type: 'NAVIGATE_SIDE_PANEL'; direction: 'next' | 'prev' }

  // ── Session defaults bar ──
  | { type: 'TOGGLE_SESSION_DEFAULTS_BAR' }

  // ── Density override (Archive mode only, per spec §6.3) ──
  | { type: 'TOGGLE_FLAT_LIST_OVERRIDE' }

  // ── Bulk ops bar ──
  | { type: 'TOGGLE_BULK_OPS_BAR' }

  // ── Story group overlay (opt-in per spec §8.1) ──
  | { type: 'TOGGLE_STORY_GROUP_OVERLAY' }

  // ── Story group manual operations (per spec §8.4) ──
  | { type: 'CREATE_STORY_GROUP'; name: string }
  // D2.5 IPD5-1 = (d): composite action for "Assign Story → + New story" flow.
  // Atomic create-then-move so the UI doesn't have to read state between
  // dispatches to learn the freshly-generated story id.
  | { type: 'CREATE_STORY_GROUP_AND_MOVE'; name: string; assetIds: string[] }
  | { type: 'RENAME_STORY_GROUP'; storyGroupId: string; name: string }
  | { type: 'DELETE_STORY_GROUP'; storyGroupId: string }
  | { type: 'MOVE_ASSET_TO_CLUSTER'; assetId: string; clusterId: string }
  | { type: 'MOVE_ASSET_TO_UNGROUPED'; assetId: string }
  | { type: 'SPLIT_CLUSTER'; clusterId: string; assetIds: string[]; newClusterName: string }
  | { type: 'MERGE_CLUSTERS'; sourceClusterId: string; targetClusterId: string }
  | { type: 'TOGGLE_CLUSTER_EXPANDED'; clusterId: string }

  // ── Asset field editing ──
  | {
      type: 'UPDATE_ASSET_FIELD'
      assetId: string
      field: keyof AssetEditableFields
      value: AssetEditableFields[keyof AssetEditableFields]
    }
  | {
      type: 'BULK_UPDATE_FIELD'
      assetIds: string[]
      field: keyof AssetEditableFields
      value: AssetEditableFields[keyof AssetEditableFields]
    }
  | { type: 'TOGGLE_ASSET_EXCLUDED'; assetId: string }

  // ── Conflict resolution ──
  | { type: 'RESOLVE_CONFLICT'; assetId: string; field: keyof AssetEditableFields; value: string }

  // ── AI proposal acceptance (per spec §9.2) ──
  // Note (per IPI-1): ACCEPT_PROPOSAL is a no-op state-wise (acceptance is
  // selector-derived per IP-5). Kept as a type-safe action for future
  // telemetry hooks.
  | { type: 'ACCEPT_PROPOSAL'; assetId: string; field: 'caption' | 'tags' | 'keywords' | 'price' }
  | {
      type: 'BULK_ACCEPT_PROPOSALS_FOR_GROUP'
      clusterId: string
      // 'price' is FORBIDDEN here per spec §9.2 — type-level enforcement.
      fields: Array<'caption' | 'tags' | 'keywords'>
    }
  | {
      type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION'
      assetIds: string[]
      // 'price' is FORBIDDEN here per spec §9.2 — type-level enforcement.
      fields: Array<'caption' | 'tags' | 'keywords'>
    }
  | { type: 'REGENERATE_PROPOSAL'; assetId: string; field: 'caption' | 'tags' | 'keywords' | 'price' }

  // ── AI cluster proposal banners (per spec §5.2) ──
  | { type: 'RECEIVE_AI_CLUSTER_PROPOSAL'; proposal: V3ClusterProposalState }
  | { type: 'ACCEPT_AI_CLUSTER_PROPOSAL'; proposalId: string }
  | { type: 'DISMISS_AI_CLUSTER_PROPOSAL'; proposalId: string }

  // ── Cluster bulk operations (Archive mode) ──
  | { type: 'BULK_EDIT_CAPTION_TEMPLATE'; clusterId: string; template: string }
  | { type: 'BULK_SET_PRICE_FOR_CLUSTER'; clusterId: string; priceCents: number }

  // ── Duplicate resolution (per spec §7.2) ──
  | {
      type: 'RESOLVE_DUPLICATE'
      assetId: string
      kind: 'keep_both' | 'mark_as_duplicate'
      otherAssetId: string
    }

  // ── Price basis panel ("Why this price?" per spec §9.3) ──
  | { type: 'TOGGLE_PRICE_BASIS_PANEL'; assetId: string }

  // ── Filtering / sorting / search ──
  | { type: 'SET_FILTER'; filter: Partial<V2Filter> }
  | { type: 'SET_FILTER_PRESET'; preset: V2FilterPreset }
  | { type: 'SET_SORT'; field: V3UIState['sortField']; direction: V3UIState['sortDirection'] }
  | { type: 'SET_SEARCH_QUERY'; query: string }

  // ── Session defaults ──
  | { type: 'SET_DEFAULTS'; defaults: Partial<V2Defaults> }

  // ── Commit flow state machine (per spec §11) ──
  | { type: 'BEGIN_COMMIT' }
  | { type: 'CANCEL_COMMIT' }
  | { type: 'CONFIRM_COMMIT' }
  | { type: 'COMMIT_PROGRESS_UPDATE'; assetId: string; progress: number }
  | { type: 'COMMIT_SUCCEEDED' }
  | { type: 'COMMIT_PARTIALLY_FAILED'; failed: Array<{ assetId: string; error: string }> }
  | { type: 'RETRY_FAILED_COMMITS' }

  // ── Reset (per spec §11.3 "Upload more") ──
  | { type: 'RESET_FLOW' }

  // ── D2.1 additions (per UX-SPEC-V4 §15.4) ──────────────────────
  // Story cover + sequencing (per spec §7)
  | { type: 'SET_STORY_COVER'; storyGroupId: string; assetId: string | null }
  | { type: 'REORDER_ASSETS_IN_STORY'; storyGroupId: string; sequence: string[] }

  // Contact sheet zoom (per spec §3.5)
  | { type: 'SET_CONTACT_SHEET_ZOOM'; zoom: 1 | 2 | 3 | 4 | 5 }

  // Left rail collapse (per spec §2.1)
  | { type: 'TOGGLE_LEFT_RAIL_COLLAPSED' }

  // Compare mode (per spec §10)
  | { type: 'ENTER_COMPARE_MODE'; assetIds: string[] }
  | { type: 'EXIT_COMPARE_MODE' }
