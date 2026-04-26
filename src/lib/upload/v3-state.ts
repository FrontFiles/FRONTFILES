/**
 * Frontfiles Upload V3 — State Machine
 *
 * Spec: docs/upload/UX-SPEC-V3.md (C1, ratified)
 * Plan: docs/upload/C2-PLAN.md (ratified) — see §3.1 (reducer authority lock)
 * Directive: docs/upload/C2.1-DIRECTIVE.md
 *
 * The canonical interaction model after Phase C C2. Single-screen UI;
 * no stages. Density is computed via densityForCount, not toggled.
 * AI proposal acceptance is selector-derived (no acceptance flags in state).
 *
 * Strict reducer (per IPI-2 + founder nuance): invalid action shapes throw
 * with action-contract-specific messages so parity-test failures point
 * exactly at the broken contract.
 */

'use client'

import type {
  V3State,
  V3Action,
  V3UIState,
  V3CommitState,
  V3ClusterProposalState,
  V2Asset,
  V2StoryGroup,
  V2Defaults,
  AssetEditableFields,
} from './v3-types'
import { getFilteredSortedSearchedAssets } from './upload-selectors'

// ── ID Generator ──────────────────────────────────────────────────

let idCounter = 0
function genId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

// ── Default sub-states ────────────────────────────────────────────

function defaultUIState(): V3UIState {
  return {
    selectedAssetIds: [],
    sidePanelOpenAssetId: null,
    storyGroupOverlayOn: false,
    bulkOpsBarOpen: false,
    expandedClusterIds: [],
    flatListOverride: false,
    filter: {
      preset: 'all',
      storyGroupId: null,
      format: null,
      privacy: null,
      declaration: null,
      hasConflicts: null,
    },
    searchQuery: '',
    sortField: 'filename',
    sortDirection: 'asc',
    sessionDefaultsBarCollapsed: false,
    priceBasisOpenAssetId: null,
    // ── D2.1 additions (per UX-SPEC-V4 §15.2) ────────────────────
    contactSheetZoom: 3, // default middle step (per spec §3.5)
    leftRailCollapsed: false,
    compareAssetIds: [],
  }
}

function defaultCommitState(): V3CommitState {
  return {
    phase: 'idle',
    perAssetProgress: {},
    failed: [],
  }
}

function defaultDefaults(): V2Defaults {
  return {
    privacy: null,
    licences: [],
    tags: [],
    watermarkMode: null,
  }
}

// ── Initial State ─────────────────────────────────────────────────

export function v3InitialState(batchId: string): V3State {
  return {
    batch: {
      id: batchId,
      createdAt: new Date().toISOString(),
      committedAt: null,
    },
    assetsById: {},
    assetOrder: [],
    storyGroupsById: {},
    storyGroupOrder: [],
    defaults: defaultDefaults(),
    ui: defaultUIState(),
    commit: defaultCommitState(),
    aiClusterProposals: [],
  }
}

// ── New asset factory ─────────────────────────────────────────────

function makeAsset(input: {
  id?: string
  filename: string
  fileSize: number
  format: V2Asset['format']
  file: File | null
  thumbnailRef?: string | null
}): V2Asset {
  return {
    id: input.id ?? genId('asset'),
    filename: input.filename,
    fileSize: input.fileSize,
    format: input.format,
    file: input.file,
    thumbnailRef: input.thumbnailRef ?? null,
    excluded: false,
    storyGroupId: null,
    proposal: null,
    editable: {
      title: '',
      description: '',
      tags: [],
      geography: [],
      captureDate: null,
      privacy: null,
      licences: [],
      price: null,
      metadataSource: {},
    },
    conflicts: [],
    extractedMetadata: null,
    declarationState: null,
    duplicateStatus: 'none',
    duplicateOfId: null,
    analysisStatus: 'pending',
    uploadProgress: 0,
    existingStoryMatch: null,
    createdAt: new Date().toISOString(),
    committedAt: null,
  }
}

// ── Reducer ───────────────────────────────────────────────────────

/**
 * Pure reducer. All state transitions flow through here.
 *
 * Strict mode (per IPI-2): malformed actions throw with detailed messages.
 * Specifically, BULK_ACCEPT_PROPOSALS_FOR_GROUP and
 * BULK_ACCEPT_PROPOSALS_FOR_SELECTION reject 'price' in their fields array
 * with `bulk_accept_price_forbidden` per spec §9.2.
 */
export function v3Reducer(state: V3State, action: V3Action): V3State {
  switch (action.type) {
    // ── File ingestion ──────────────────────────────────────────

    case 'ADD_FILES': {
      const newAssets = action.files.map(makeAsset)
      const newAssetsById = { ...state.assetsById }
      const newOrder = [...state.assetOrder]
      for (const asset of newAssets) {
        newAssetsById[asset.id] = asset
        newOrder.push(asset.id)
      }
      return { ...state, assetsById: newAssetsById, assetOrder: newOrder }
    }

    case 'REMOVE_FILE': {
      const { [action.assetId]: _removed, ...rest } = state.assetsById
      return {
        ...state,
        assetsById: rest,
        assetOrder: state.assetOrder.filter(id => id !== action.assetId),
        ui: {
          ...state.ui,
          selectedAssetIds: state.ui.selectedAssetIds.filter(id => id !== action.assetId),
          sidePanelOpenAssetId:
            state.ui.sidePanelOpenAssetId === action.assetId ? null : state.ui.sidePanelOpenAssetId,
        },
      }
    }

    // ── Per-asset analysis lifecycle ────────────────────────────

    case 'UPDATE_ANALYSIS_PROGRESS': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, uploadProgress: action.progress, analysisStatus: 'analysing' },
        },
      }
    }

    case 'UPDATE_ANALYSIS_RESULT': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            proposal: action.proposal,
            declarationState: action.declarationState,
            duplicateStatus: action.duplicateStatus ?? asset.duplicateStatus,
            duplicateOfId: action.duplicateOfId ?? asset.duplicateOfId,
            extractedMetadata: action.extractedMetadata ?? asset.extractedMetadata,
            conflicts: action.conflicts ?? asset.conflicts,
            analysisStatus: 'complete',
          },
        },
      }
    }

    case 'ANALYSIS_FAILED': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, analysisStatus: 'failed' },
        },
      }
    }

    // ── Selection ────────────────────────────────────────────────

    case 'SELECT_ASSET':
      return { ...state, ui: { ...state.ui, selectedAssetIds: [action.assetId] } }

    case 'TOGGLE_ASSET_SELECTION': {
      const isSelected = state.ui.selectedAssetIds.includes(action.assetId)
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAssetIds: isSelected
            ? state.ui.selectedAssetIds.filter(id => id !== action.assetId)
            : [...state.ui.selectedAssetIds, action.assetId],
        },
      }
    }

    case 'SELECT_ASSETS':
      return { ...state, ui: { ...state.ui, selectedAssetIds: [...action.assetIds] } }

    case 'DESELECT_ALL_ASSETS':
      return { ...state, ui: { ...state.ui, selectedAssetIds: [] } }

    case 'SELECT_RANGE': {
      const fromIdx = state.assetOrder.indexOf(action.fromAssetId)
      const toIdx = state.assetOrder.indexOf(action.toAssetId)
      if (fromIdx === -1 || toIdx === -1) return state
      const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
      return {
        ...state,
        ui: { ...state.ui, selectedAssetIds: state.assetOrder.slice(start, end + 1) },
      }
    }

    // ── Side panel ──────────────────────────────────────────────

    case 'OPEN_SIDE_PANEL':
      return { ...state, ui: { ...state.ui, sidePanelOpenAssetId: action.assetId } }

    case 'CLOSE_SIDE_PANEL':
      return { ...state, ui: { ...state.ui, sidePanelOpenAssetId: null } }

    case 'NAVIGATE_SIDE_PANEL': {
      // Per IP-8 + IPIII-11: scope is filtered+sorted+searched visible assets,
      // not raw assetOrder. C2.1 stubbed this with assetOrder pending the
      // C2.2 selector landing; C2.3 finishes the wire to
      // getFilteredSortedSearchedAssets.
      //
      // Special case (IPIII-11): if the open asset id is NOT in the filtered
      // visible list (e.g., user changed the filter while panel was open and
      // the open asset got hidden), start from index 0 instead of bailing.
      const visible = getFilteredSortedSearchedAssets({
        assetsById: state.assetsById,
        assetOrder: state.assetOrder,
        filter: state.ui.filter,
        searchQuery: state.ui.searchQuery,
        sortField: state.ui.sortField,
        sortDirection: state.ui.sortDirection,
      }).map(a => a.id)

      if (visible.length === 0) return state

      const currentIdx = state.ui.sidePanelOpenAssetId
        ? visible.indexOf(state.ui.sidePanelOpenAssetId)
        : -1

      let nextIdx: number
      if (currentIdx === -1) {
        // Open id is filtered out (or unset). Start at the first visible.
        nextIdx = 0
      } else {
        nextIdx =
          action.direction === 'next'
            ? Math.min(currentIdx + 1, visible.length - 1)
            : Math.max(currentIdx - 1, 0)
      }
      const nextId = visible[nextIdx]
      if (!nextId) return state
      return {
        ...state,
        ui: {
          ...state.ui,
          sidePanelOpenAssetId: nextId,
          selectedAssetIds: [nextId],
        },
      }
    }

    // ── UI toggles ──────────────────────────────────────────────

    case 'TOGGLE_SESSION_DEFAULTS_BAR':
      return {
        ...state,
        ui: { ...state.ui, sessionDefaultsBarCollapsed: !state.ui.sessionDefaultsBarCollapsed },
      }

    case 'TOGGLE_FLAT_LIST_OVERRIDE':
      return {
        ...state,
        ui: { ...state.ui, flatListOverride: !state.ui.flatListOverride },
      }

    case 'TOGGLE_BULK_OPS_BAR':
      return { ...state, ui: { ...state.ui, bulkOpsBarOpen: !state.ui.bulkOpsBarOpen } }

    case 'TOGGLE_STORY_GROUP_OVERLAY':
      return {
        ...state,
        ui: { ...state.ui, storyGroupOverlayOn: !state.ui.storyGroupOverlayOn },
      }

    // ── Story group manual operations ──────────────────────────

    case 'CREATE_STORY_GROUP': {
      const id = genId('story')
      const group: V2StoryGroup = {
        id,
        name: action.name,
        kind: 'creator',
        proposedAssetIds: [],
        existingStoryId: null,
        existingStoryTitle: null,
        existingStoryAssetCount: null,
        rationale: '',
        confidence: 1,
        createdAt: new Date().toISOString(),
      }
      return {
        ...state,
        storyGroupsById: { ...state.storyGroupsById, [id]: group },
        storyGroupOrder: [...state.storyGroupOrder, id],
      }
    }

    case 'RENAME_STORY_GROUP': {
      const group = state.storyGroupsById[action.storyGroupId]
      if (!group) return state
      return {
        ...state,
        storyGroupsById: {
          ...state.storyGroupsById,
          [action.storyGroupId]: { ...group, name: action.name },
        },
      }
    }

    case 'DELETE_STORY_GROUP': {
      const { [action.storyGroupId]: _removed, ...rest } = state.storyGroupsById
      // Move all assets in this group to ungrouped (storyGroupId = null)
      const assetsById = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && asset.storyGroupId === action.storyGroupId) {
          assetsById[id] = { ...asset, storyGroupId: null }
        }
      }
      return {
        ...state,
        storyGroupsById: rest,
        storyGroupOrder: state.storyGroupOrder.filter(id => id !== action.storyGroupId),
        assetsById,
      }
    }

    case 'MOVE_ASSET_TO_CLUSTER': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      if (!state.storyGroupsById[action.clusterId]) {
        throw new Error(
          `move_asset_to_cluster_invalid: clusterId="${action.clusterId}" does not exist in storyGroupsById`,
        )
      }
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, storyGroupId: action.clusterId },
        },
      }
    }

    case 'MOVE_ASSET_TO_UNGROUPED': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, storyGroupId: null },
        },
      }
    }

    case 'SPLIT_CLUSTER': {
      const sourceCluster = state.storyGroupsById[action.clusterId]
      if (!sourceCluster) {
        throw new Error(
          `split_cluster_invalid: clusterId="${action.clusterId}" does not exist`,
        )
      }
      const newId = genId('story')
      const newGroup: V2StoryGroup = {
        id: newId,
        name: action.newClusterName,
        kind: 'creator',
        proposedAssetIds: [],
        existingStoryId: null,
        existingStoryTitle: null,
        existingStoryAssetCount: null,
        rationale: 'Split from ' + sourceCluster.name,
        confidence: 1,
        createdAt: new Date().toISOString(),
      }
      const assetsById = { ...state.assetsById }
      for (const id of action.assetIds) {
        const asset = assetsById[id]
        if (asset && asset.storyGroupId === action.clusterId) {
          assetsById[id] = { ...asset, storyGroupId: newId }
        }
      }
      return {
        ...state,
        storyGroupsById: { ...state.storyGroupsById, [newId]: newGroup },
        storyGroupOrder: [...state.storyGroupOrder, newId],
        assetsById,
      }
    }

    case 'MERGE_CLUSTERS': {
      const source = state.storyGroupsById[action.sourceClusterId]
      const target = state.storyGroupsById[action.targetClusterId]
      if (!source || !target) {
        throw new Error(
          `merge_clusters_invalid: source="${action.sourceClusterId}" or target="${action.targetClusterId}" does not exist`,
        )
      }
      // Move all source-cluster assets to target
      const assetsById = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && asset.storyGroupId === action.sourceClusterId) {
          assetsById[id] = { ...asset, storyGroupId: action.targetClusterId }
        }
      }
      // Remove source cluster
      const { [action.sourceClusterId]: _removed, ...rest } = state.storyGroupsById
      return {
        ...state,
        storyGroupsById: rest,
        storyGroupOrder: state.storyGroupOrder.filter(id => id !== action.sourceClusterId),
        assetsById,
      }
    }

    case 'TOGGLE_CLUSTER_EXPANDED': {
      const isExpanded = state.ui.expandedClusterIds.includes(action.clusterId)
      return {
        ...state,
        ui: {
          ...state.ui,
          expandedClusterIds: isExpanded
            ? state.ui.expandedClusterIds.filter(id => id !== action.clusterId)
            : [...state.ui.expandedClusterIds, action.clusterId],
        },
      }
    }

    // ── Asset field editing ────────────────────────────────────

    case 'UPDATE_ASSET_FIELD': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            editable: { ...asset.editable, [action.field]: action.value },
          },
        },
      }
    }

    case 'BULK_UPDATE_FIELD': {
      const assetsById = { ...state.assetsById }
      for (const id of action.assetIds) {
        const asset = assetsById[id]
        if (!asset) continue
        assetsById[id] = {
          ...asset,
          editable: { ...asset.editable, [action.field]: action.value },
        }
      }
      return { ...state, assetsById }
    }

    case 'TOGGLE_ASSET_EXCLUDED': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, excluded: !asset.excluded },
        },
      }
    }

    // ── Conflict resolution ────────────────────────────────────

    case 'RESOLVE_CONFLICT': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      const conflicts = asset.conflicts.map(c =>
        c.field === action.field ? { ...c, resolvedBy: 'creator' as const, resolvedValue: action.value } : c,
      )
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            conflicts,
            editable: { ...asset.editable, [action.field]: action.value },
          },
        },
      }
    }

    // ── AI proposal acceptance ─────────────────────────────────

    case 'ACCEPT_PROPOSAL':
      // Per IPI-1: type-safe no-op for telemetry hooks. State unchanged.
      // Per IP-5: acceptance is selector-derived from comparing editable
      // vs proposal fields. Auto-commit happens via UPDATE_ASSET_FIELD
      // when the user edits the field.
      return state

    case 'BULK_ACCEPT_PROPOSALS_FOR_GROUP': {
      // Type-level enforcement of spec §9.2 forbids 'price' in fields,
      // but runtime check guards against type-erased calls.
      if ((action.fields as string[]).includes('price')) {
        throw new Error(
          `bulk_accept_price_forbidden: BULK_ACCEPT_PROPOSALS_FOR_GROUP.fields contained "price". ` +
            `Bulk-accept of price is forbidden per UX-SPEC-V3 §9.2 + UX-BRIEF v3 §4.4 + ` +
            `PRICE-ENGINE-BRIEF v3 §11.16. Each price acceptance must be per-asset and explicit.`,
        )
      }
      // Per IP-5: acceptance is selector-derived. State unchanged.
      // The C2.5 implementation hooks BULK accepts via a sequence of
      // UPDATE_ASSET_FIELD dispatches that auto-commit ghost values.
      return state
    }

    case 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION': {
      if ((action.fields as string[]).includes('price')) {
        throw new Error(
          `bulk_accept_price_forbidden: BULK_ACCEPT_PROPOSALS_FOR_SELECTION.fields contained "price". ` +
            `Bulk-accept of price is forbidden per UX-SPEC-V3 §9.2 + UX-BRIEF v3 §4.4 + ` +
            `PRICE-ENGINE-BRIEF v3 §11.16. Each price acceptance must be per-asset and explicit.`,
        )
      }
      return state
    }

    case 'REGENERATE_PROPOSAL':
      // C2.1 stub — C2.5 wires this to the simulation engine.
      return state

    // ── AI cluster proposal banners ────────────────────────────

    case 'RECEIVE_AI_CLUSTER_PROPOSAL':
      return {
        ...state,
        aiClusterProposals: [...state.aiClusterProposals, action.proposal],
      }

    case 'ACCEPT_AI_CLUSTER_PROPOSAL': {
      const proposal = state.aiClusterProposals.find(p => p.proposalId === action.proposalId)
      if (!proposal) {
        throw new Error(
          `accept_ai_cluster_proposal_invalid: proposalId="${action.proposalId}" not in aiClusterProposals`,
        )
      }
      // Create a story group from the proposal
      const groupId = genId('story')
      const group: V2StoryGroup = {
        id: groupId,
        name: proposal.clusterName,
        kind: 'proposed',
        proposedAssetIds: [...proposal.proposedAssetIds],
        existingStoryId: null,
        existingStoryTitle: null,
        existingStoryAssetCount: null,
        rationale: proposal.rationale,
        confidence: proposal.confidence,
        createdAt: new Date().toISOString(),
      }
      // Assign all proposed assets to the new group
      const assetsById = { ...state.assetsById }
      for (const id of proposal.proposedAssetIds) {
        const asset = assetsById[id]
        if (asset) assetsById[id] = { ...asset, storyGroupId: groupId }
      }
      return {
        ...state,
        storyGroupsById: { ...state.storyGroupsById, [groupId]: group },
        storyGroupOrder: [...state.storyGroupOrder, groupId],
        assetsById,
        aiClusterProposals: state.aiClusterProposals.map(p =>
          p.proposalId === action.proposalId ? { ...p, status: 'accepted' as const } : p,
        ),
      }
    }

    case 'DISMISS_AI_CLUSTER_PROPOSAL': {
      const proposal = state.aiClusterProposals.find(p => p.proposalId === action.proposalId)
      if (!proposal) {
        throw new Error(
          `dismiss_ai_cluster_proposal_invalid: proposalId="${action.proposalId}" not in aiClusterProposals`,
        )
      }
      return {
        ...state,
        aiClusterProposals: state.aiClusterProposals.map(p =>
          p.proposalId === action.proposalId ? { ...p, status: 'dismissed' as const } : p,
        ),
      }
    }

    // ── Cluster bulk operations (Archive mode) ─────────────────

    case 'BULK_EDIT_CAPTION_TEMPLATE': {
      // Apply template caption to all assets in the cluster
      const assetsById = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && asset.storyGroupId === action.clusterId) {
          assetsById[id] = {
            ...asset,
            editable: { ...asset.editable, description: action.template },
          }
        }
      }
      return { ...state, assetsById }
    }

    case 'BULK_SET_PRICE_FOR_CLUSTER': {
      // Note: this is SET, not accept-AI-suggestion. Per spec §9.2 the
      // per-asset price-acceptance rule still holds — this is a creator-
      // authoritative bulk SET, distinct from bulk-accepting an AI
      // suggestion.
      if (action.priceCents < 0) {
        throw new Error(
          `bulk_set_price_invalid: priceCents=${action.priceCents} must be >= 0`,
        )
      }
      const assetsById = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && asset.storyGroupId === action.clusterId) {
          assetsById[id] = {
            ...asset,
            editable: { ...asset.editable, price: action.priceCents },
          }
        }
      }
      return { ...state, assetsById }
    }

    // ── Duplicate resolution (per spec §7.2) ───────────────────

    case 'RESOLVE_DUPLICATE': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      if (action.kind === 'keep_both') {
        return {
          ...state,
          assetsById: {
            ...state.assetsById,
            [action.assetId]: { ...asset, duplicateStatus: 'none', duplicateOfId: null },
          },
        }
      }
      if (action.kind === 'mark_as_duplicate') {
        return {
          ...state,
          assetsById: {
            ...state.assetsById,
            [action.assetId]: {
              ...asset,
              duplicateStatus: 'confirmed_duplicate',
              duplicateOfId: action.otherAssetId,
              excluded: true,
            },
          },
        }
      }
      throw new Error(
        `resolve_duplicate_invalid: kind must be 'keep_both' or 'mark_as_duplicate', got "${(action as { kind: string }).kind}"`,
      )
    }

    // ── Price basis panel ──────────────────────────────────────

    case 'TOGGLE_PRICE_BASIS_PANEL':
      return {
        ...state,
        ui: {
          ...state.ui,
          priceBasisOpenAssetId:
            state.ui.priceBasisOpenAssetId === action.assetId ? null : action.assetId,
        },
      }

    // ── Filtering / sorting / search ───────────────────────────

    case 'SET_FILTER':
      return {
        ...state,
        ui: { ...state.ui, filter: { ...state.ui.filter, ...action.filter } },
      }

    case 'SET_FILTER_PRESET':
      // Per D2.2 IPD2-14 = (a): switching the preset chip also clears
      // the storyGroupId filter. Intent: clicking a category filter
      // means "I want to filter by category, not by story". The user
      // re-applies storyGroupId by clicking a story header in the
      // left rail (which dispatches SET_FILTER { storyGroupId }).
      return {
        ...state,
        ui: {
          ...state.ui,
          filter: { ...state.ui.filter, preset: action.preset, storyGroupId: null },
        },
      }

    case 'SET_SORT':
      return {
        ...state,
        ui: { ...state.ui, sortField: action.field, sortDirection: action.direction },
      }

    case 'SET_SEARCH_QUERY':
      return { ...state, ui: { ...state.ui, searchQuery: action.query } }

    // ── Session defaults ───────────────────────────────────────

    case 'SET_DEFAULTS':
      return { ...state, defaults: { ...state.defaults, ...action.defaults } }

    // ── Commit flow state machine ──────────────────────────────

    case 'BEGIN_COMMIT': {
      if (state.commit.phase !== 'idle' && state.commit.phase !== 'partial-failure') {
        throw new Error(
          `begin_commit_invalid: commit.phase must be 'idle' or 'partial-failure', got "${state.commit.phase}"`,
        )
      }
      return { ...state, commit: { ...state.commit, phase: 'summary' } }
    }

    case 'CANCEL_COMMIT': {
      if (state.commit.phase !== 'summary') {
        throw new Error(
          `cancel_commit_invalid: commit.phase must be 'summary', got "${state.commit.phase}"`,
        )
      }
      return { ...state, commit: { ...state.commit, phase: 'idle' } }
    }

    case 'CONFIRM_COMMIT': {
      if (state.commit.phase !== 'summary') {
        throw new Error(
          `confirm_commit_invalid: commit.phase must be 'summary', got "${state.commit.phase}"`,
        )
      }
      return {
        ...state,
        commit: { phase: 'committing', perAssetProgress: {}, failed: [] },
      }
    }

    case 'COMMIT_PROGRESS_UPDATE': {
      if (state.commit.phase !== 'committing') return state
      return {
        ...state,
        commit: {
          ...state.commit,
          perAssetProgress: {
            ...state.commit.perAssetProgress,
            [action.assetId]: action.progress,
          },
        },
      }
    }

    case 'COMMIT_SUCCEEDED': {
      if (state.commit.phase !== 'committing') {
        throw new Error(
          `commit_succeeded_invalid: commit.phase must be 'committing', got "${state.commit.phase}"`,
        )
      }
      // Stamp committedAt on every included asset
      const assetsById = { ...state.assetsById }
      const now = new Date().toISOString()
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && !asset.excluded) {
          assetsById[id] = { ...asset, committedAt: now }
        }
      }
      return {
        ...state,
        batch: { ...state.batch, committedAt: now },
        assetsById,
        commit: { ...state.commit, phase: 'success' },
      }
    }

    case 'COMMIT_PARTIALLY_FAILED': {
      if (state.commit.phase !== 'committing') {
        throw new Error(
          `commit_partially_failed_invalid: commit.phase must be 'committing', got "${state.commit.phase}"`,
        )
      }
      const failedIds = new Set(action.failed.map(f => f.assetId))
      const assetsById = { ...state.assetsById }
      const now = new Date().toISOString()
      // Stamp committedAt only on succeeded assets (not in failed list)
      for (const id of state.assetOrder) {
        const asset = assetsById[id]
        if (asset && !asset.excluded && !failedIds.has(id)) {
          assetsById[id] = { ...asset, committedAt: now }
        }
      }
      return {
        ...state,
        assetsById,
        commit: { ...state.commit, phase: 'partial-failure', failed: action.failed },
      }
    }

    case 'RETRY_FAILED_COMMITS': {
      if (state.commit.phase !== 'partial-failure') {
        throw new Error(
          `retry_failed_commits_invalid: commit.phase must be 'partial-failure', got "${state.commit.phase}"`,
        )
      }
      return {
        ...state,
        commit: { phase: 'committing', perAssetProgress: {}, failed: [] },
      }
    }

    // ── Reset (per spec §11.3 "Upload more") ───────────────────

    case 'RESET_FLOW':
      return v3InitialState(state.batch.id)

    // ── D2.1 additions (per UX-SPEC-V4 + D2.1-DIRECTIVE §4.2) ──

    case 'SET_STORY_COVER': {
      const group = state.storyGroupsById[action.storyGroupId]
      if (!group) {
        throw new Error(
          `set_story_cover_invalid_group: storyGroupId="${action.storyGroupId}" not in storyGroupsById`,
        )
      }
      if (action.assetId !== null && !state.assetsById[action.assetId]) {
        throw new Error(
          `set_story_cover_invalid_asset: assetId="${action.assetId}" not in assetsById`,
        )
      }
      return {
        ...state,
        storyGroupsById: {
          ...state.storyGroupsById,
          [action.storyGroupId]: { ...group, coverAssetId: action.assetId },
        },
      }
    }

    case 'REORDER_ASSETS_IN_STORY': {
      const group = state.storyGroupsById[action.storyGroupId]
      if (!group) {
        throw new Error(
          `reorder_assets_invalid_group: storyGroupId="${action.storyGroupId}" not in storyGroupsById`,
        )
      }
      // Set-equality check: new sequence must contain exactly the same ids
      // currently in the story (membership unchanged; only order differs).
      const current = new Set(group.sequence ?? group.proposedAssetIds)
      const next = new Set(action.sequence)
      if (current.size !== next.size || [...current].some(id => !next.has(id))) {
        throw new Error(
          `reorder_assets_set_mismatch: new sequence membership differs from current. ` +
            `REORDER_ASSETS_IN_STORY changes order, not membership. Use MOVE_ASSET_TO_CLUSTER ` +
            `or MOVE_ASSET_TO_UNGROUPED to change membership.`,
        )
      }
      return {
        ...state,
        storyGroupsById: {
          ...state.storyGroupsById,
          [action.storyGroupId]: { ...group, sequence: [...action.sequence] },
        },
      }
    }

    case 'SET_CONTACT_SHEET_ZOOM': {
      if (action.zoom < 1 || action.zoom > 5 || !Number.isInteger(action.zoom)) {
        throw new Error(
          `set_contact_sheet_zoom_invalid: zoom must be an integer 1-5, got ${action.zoom}`,
        )
      }
      return { ...state, ui: { ...state.ui, contactSheetZoom: action.zoom } }
    }

    case 'TOGGLE_LEFT_RAIL_COLLAPSED':
      return { ...state, ui: { ...state.ui, leftRailCollapsed: !state.ui.leftRailCollapsed } }

    case 'ENTER_COMPARE_MODE': {
      // Per IPD1-4 default (a) + IPV4-3 default (a): strict 2-only.
      if (action.assetIds.length !== 2) {
        throw new Error(
          `compare_invalid_count: ENTER_COMPARE_MODE requires exactly 2 assetIds (per IPV4-3 = a strict 2-only), got ${action.assetIds.length}`,
        )
      }
      for (const id of action.assetIds) {
        if (!state.assetsById[id]) {
          throw new Error(`compare_invalid_asset: assetId="${id}" not in assetsById`)
        }
      }
      return { ...state, ui: { ...state.ui, compareAssetIds: [...action.assetIds] } }
    }

    case 'EXIT_COMPARE_MODE':
      return { ...state, ui: { ...state.ui, compareAssetIds: [] } }

    // ── Exhaustive check ────────────────────────────────────────
    default: {
      const _exhaustive: never = action
      throw new Error(
        `v3_reducer_unknown_action: ${JSON.stringify(_exhaustive)}. ` +
          `All V3Action variants must be handled exhaustively.`,
      )
    }
  }
}
