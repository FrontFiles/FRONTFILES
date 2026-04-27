// ═══════════════════════════════════════════════════════════════
// DORMANT — replaced by C2 (new shell at app/vault/upload/).
// Scheduled for deletion at the explicit cutover PR (PR 5+).
// DO NOT extend. DO NOT import from production code paths.
// See docs/upload/C2-PLAN.md §3.3 for the coexistence rule.
// ═══════════════════════════════════════════════════════════════
/**
 * Frontfiles Bulk Upload v2 — State Machine
 *
 * Single authoritative reducer for the entire upload flow.
 * All Story assignment, metadata editing, pricing, and privacy changes
 * flow through this reducer. No disconnected local state.
 *
 * Key invariants:
 * - storyGroupId is NEVER set by analysis or processing
 * - Exceptions are computed by selectors, not stored
 * - PRIVATE assets may commit without price or licences
 */

'use client'

import type {
  V2State,
  V2Asset,
  V2StoryGroup,
  V2Stage,
  V2Filter,
  V2FilterPreset,
  V2Exception,
  V2Defaults,
  V2CompletionSummary,
  AssetProposal,
  AssetEditableFields,
  StoryGroupKind,
  CommitOutcome,
  DensityMode,
  MobileTab,
  MetadataConflict,
  ExtractedMetadata,
  TableColumn,
} from './v2-types'
import { DEFAULT_COLUMNS } from './v2-types'
import type { AssetFormat, LicenceType, ValidationDeclarationState } from './types'
import { TRANSACTABLE_STATES } from './types'
import { isListablePrivacy } from '@/lib/asset/visibility'

// ── ID Generator ──

let idCounter = 0
function genId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

// ── Actions ──

export type V2Action =
  // File management
  | { type: 'ADD_FILES'; files: Array<{ id?: string; filename: string; fileSize: number; format: AssetFormat | null; file: File | null; thumbnailRef?: string | null }> }
  | { type: 'REMOVE_FILE'; assetId: string }

  // Analysis pipeline
  | { type: 'START_ANALYSIS' }
  | { type: 'UPDATE_ANALYSIS_PROGRESS'; assetId: string; progress: number }
  | { type: 'UPDATE_ANALYSIS_RESULT'; assetId: string; proposal: AssetProposal; declarationState: ValidationDeclarationState; duplicateStatus?: 'none' | 'likely_duplicate'; duplicateOfId?: string | null; extractedMetadata?: ExtractedMetadata | null; conflicts?: MetadataConflict[] }
  | { type: 'ANALYSIS_FAILED'; assetId: string }
  | { type: 'COMPLETE_ANALYSIS' }

  // Story group proposals (system-generated during analysis)
  | { type: 'ADD_STORY_GROUP_PROPOSAL'; group: Omit<V2StoryGroup, 'createdAt'> }

  // Navigation
  | { type: 'ENTER_REVIEW_EARLY' }
  | { type: 'SET_STAGE'; stage: V2Stage }

  // Selection
  | { type: 'SELECT_ASSET'; assetId: string }
  | { type: 'TOGGLE_ASSET_SELECTION'; assetId: string }
  | { type: 'SELECT_ASSETS'; assetIds: string[] }
  | { type: 'DESELECT_ALL_ASSETS' }
  | { type: 'SELECT_STORY_GROUP'; storyGroupId: string | null }
  | { type: 'FOCUS_ASSET'; assetId: string | null }

  // Story operations — all explicit creator actions
  | { type: 'CREATE_STORY_GROUP'; name: string }
  | { type: 'RENAME_STORY_GROUP'; storyGroupId: string; name: string }
  | { type: 'ASSIGN_ASSET_TO_STORY'; assetId: string; storyGroupId: string }
  | { type: 'UNASSIGN_ASSET_FROM_STORY'; assetId: string }
  | { type: 'BULK_ASSIGN_ASSETS'; assetIds: string[]; storyGroupId: string }
  | { type: 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS' }

  // Asset editing — all explicit creator actions
  | { type: 'UPDATE_ASSET_FIELD'; assetId: string; field: keyof AssetEditableFields; value: AssetEditableFields[keyof AssetEditableFields] }
  | { type: 'BULK_UPDATE_FIELD'; assetIds: string[]; field: keyof AssetEditableFields; value: AssetEditableFields[keyof AssetEditableFields] }
  | { type: 'TOGGLE_ASSET_EXCLUDED'; assetId: string }

  // Metadata conflict resolution — explicit creator actions
  | { type: 'RESOLVE_CONFLICT'; assetId: string; field: keyof AssetEditableFields; value: string }
  | { type: 'CONFIRM_PROPOSAL'; assetId: string; field: keyof AssetEditableFields }
  | { type: 'DISMISS_PROPOSAL'; assetId: string; field: keyof AssetEditableFields }

  // Duplicate resolution — explicit creator action
  | { type: 'CLEAR_DUPLICATE_STATUS'; assetId: string }

  // UI state
  | { type: 'SET_COLUMN_VISIBILITY'; columns: TableColumn[] }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'TOGGLE_STORY_PROPOSALS_BANNER' }
  | { type: 'ACTIVATE_NEWSROOM_MODE'; active: boolean }

  // Express flow
  | { type: 'APPLY_EXPRESS_FLOW' }
  | { type: 'DISMISS_EXPRESS' }

  // Commit
  | { type: 'COMMIT_BATCH' }
  | { type: 'COMPLETE_COMMIT' }

  // Defaults
  | { type: 'SET_DEFAULTS'; defaults: Partial<V2Defaults> }

  // Story group management
  | { type: 'DELETE_STORY_GROUP'; storyGroupId: string }

  // Filter/sort
  | { type: 'SET_FILTER'; filter: Partial<V2Filter> }
  | { type: 'SET_FILTER_PRESET'; preset: V2FilterPreset }
  | { type: 'SET_SORT'; field: V2State['ui']['sortField']; direction: V2State['ui']['sortDirection'] }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_DENSITY'; density: DensityMode }
  | { type: 'SET_MOBILE_TAB'; tab: MobileTab }

  // Shift-select range
  | { type: 'SELECT_RANGE'; fromAssetId: string; toAssetId: string }

  // Reset
  | { type: 'RESET_FLOW' }

// ── Reducer ──

export function v2Reducer(state: V2State, action: V2Action): V2State {
  switch (action.type) {

    // ── File Management ──

    case 'ADD_FILES': {
      const newAssets: Record<string, V2Asset> = {}
      const newIds: string[] = []
      for (const f of action.files) {
        const id = f.id || genId('asset')
        newAssets[id] = {
          id,
          filename: f.filename,
          fileSize: f.fileSize,
          format: f.format,
          file: f.file,
          thumbnailRef: f.thumbnailRef ?? null,
          excluded: false,
          storyGroupId: null, // NEVER auto-assigned
          proposal: null,
          editable: {
            title: '',
            description: '',
            tags: [...state.defaults.tags],
            geography: [],
            captureDate: null,
            privacy: state.defaults.privacy,
            licences: [...state.defaults.licences],
            price: null,
            socialLicensable: false,
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
        newIds.push(id)
      }
      return {
        ...state,
        assetsById: { ...state.assetsById, ...newAssets },
        assetOrder: [...state.assetOrder, ...newIds],
      }
    }

    case 'REMOVE_FILE': {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.assetId]: _removed, ...rest } = state.assetsById
      return {
        ...state,
        assetsById: rest,
        assetOrder: state.assetOrder.filter(id => id !== action.assetId),
        ui: {
          ...state.ui,
          selectedAssetIds: state.ui.selectedAssetIds.filter(id => id !== action.assetId),
          focusedAssetId: state.ui.focusedAssetId === action.assetId ? null : state.ui.focusedAssetId,
        },
      }
    }

    // ── Analysis Pipeline ──

    case 'START_ANALYSIS': {
      const updated = { ...state.assetsById }
      for (const id of state.assetOrder) {
        updated[id] = { ...updated[id], analysisStatus: 'uploading', uploadProgress: 0 }
      }
      return {
        ...state,
        assetsById: updated,
        batch: { ...state.batch, currentStage: 'analysis' },
      }
    }

    case 'UPDATE_ANALYSIS_PROGRESS': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      const status = action.progress >= 100 ? 'analysing' as const : 'uploading' as const
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, uploadProgress: action.progress, analysisStatus: status },
        },
      }
    }

    case 'UPDATE_ANALYSIS_RESULT': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state

      // Build metadata source tracking for auto-filled fields
      const newSource = { ...asset.editable.metadataSource }
      const em = action.extractedMetadata
      const hasEmbeddedTitle = em?.iptcHeadline
      const hasEmbeddedDesc = em?.iptcCaption
      const hasEmbeddedTags = em?.iptcKeywords && em.iptcKeywords.length > 0
      const hasEmbeddedGeo = em?.iptcCity || em?.iptcCountry

      // Auto-fill: embedded metadata wins over AI proposals
      const fillTitle = asset.editable.title || (hasEmbeddedTitle ? em!.iptcHeadline! : action.proposal.title)
      const fillDesc = asset.editable.description || (hasEmbeddedDesc ? em!.iptcCaption! : action.proposal.description)
      const fillTags = asset.editable.tags.length > 0
        ? asset.editable.tags
        : (hasEmbeddedTags ? em!.iptcKeywords : action.proposal.tags)
      const fillGeo = asset.editable.geography.length > 0
        ? asset.editable.geography
        : (hasEmbeddedGeo ? [em!.iptcCity, em!.iptcCountry].filter(Boolean) as string[] : action.proposal.geography)
      const fillDate = asset.editable.captureDate ?? em?.iptcDateCreated ?? null

      // Track sources
      if (!asset.editable.title) newSource.title = hasEmbeddedTitle ? 'embedded' : 'ai'
      if (!asset.editable.description) newSource.description = hasEmbeddedDesc ? 'embedded' : 'ai'
      if (asset.editable.tags.length === 0) newSource.tags = hasEmbeddedTags ? 'embedded' : 'ai'
      if (asset.editable.geography.length === 0) newSource.geography = hasEmbeddedGeo ? 'embedded' : 'ai'
      if (!asset.editable.captureDate && fillDate) newSource.captureDate = em?.iptcDateCreated ? 'embedded' : 'extracted'

      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            analysisStatus: 'complete',
            uploadProgress: 100,
            proposal: action.proposal,
            declarationState: action.declarationState,
            duplicateStatus: action.duplicateStatus ?? 'none',
            duplicateOfId: action.duplicateOfId ?? null,
            extractedMetadata: action.extractedMetadata ?? null,
            conflicts: action.conflicts ?? [],
            editable: {
              ...asset.editable,
              title: fillTitle,
              description: fillDesc,
              tags: fillTags,
              geography: fillGeo,
              captureDate: fillDate,
              // NEVER auto-fill privacy, licences, or price — creator sovereignty
              // These remain as suggestions in the proposal object, rendered in the inspector
              privacy: asset.editable.privacy,
              licences: asset.editable.licences,
              price: asset.editable.price,
              metadataSource: newSource,
            },
            // NEVER set storyGroupId here — analysis proposes, creator decides
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

    case 'COMPLETE_ANALYSIS':
      return state // no-op, analysis completion is per-asset

    // ── Story Group Proposals ──

    case 'ADD_STORY_GROUP_PROPOSAL': {
      const group: V2StoryGroup = {
        ...action.group,
        createdAt: new Date().toISOString(),
      }
      return {
        ...state,
        storyGroupsById: { ...state.storyGroupsById, [group.id]: group },
        storyGroupOrder: [...state.storyGroupOrder, group.id],
      }
    }

    // ── Navigation ──

    case 'ENTER_REVIEW_EARLY':
      return {
        ...state,
        batch: { ...state.batch, currentStage: 'review' },
        ui: { ...state.ui, reviewEnteredEarly: true },
      }

    case 'SET_STAGE':
      return { ...state, batch: { ...state.batch, currentStage: action.stage } }

    // ── Selection ──

    case 'SELECT_ASSET':
      return {
        ...state,
        ui: { ...state.ui, selectedAssetIds: [action.assetId], focusedAssetId: action.assetId },
      }

    case 'TOGGLE_ASSET_SELECTION': {
      const selected = state.ui.selectedAssetIds.includes(action.assetId)
        ? state.ui.selectedAssetIds.filter(id => id !== action.assetId)
        : [...state.ui.selectedAssetIds, action.assetId]
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAssetIds: selected,
          focusedAssetId: selected.length > 0 ? selected[selected.length - 1] : null,
        },
      }
    }

    case 'SELECT_ASSETS':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAssetIds: action.assetIds,
          focusedAssetId: action.assetIds.length > 0 ? action.assetIds[action.assetIds.length - 1] : null,
        },
      }

    case 'DESELECT_ALL_ASSETS':
      return { ...state, ui: { ...state.ui, selectedAssetIds: [], focusedAssetId: null } }

    case 'SELECT_STORY_GROUP':
      return { ...state, ui: { ...state.ui, selectedStoryGroupId: action.storyGroupId } }

    case 'FOCUS_ASSET':
      return { ...state, ui: { ...state.ui, focusedAssetId: action.assetId } }

    // ── Story Operations (EXPLICIT CREATOR ACTIONS ONLY) ──

    case 'CREATE_STORY_GROUP': {
      const id = genId('sg')
      const group: V2StoryGroup = {
        id,
        name: action.name,
        kind: 'creator',
        proposedAssetIds: [],
        existingStoryId: null,
        existingStoryTitle: null,
        existingStoryAssetCount: null,
        rationale: 'Created by creator',
        confidence: 1.0,
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

    case 'ASSIGN_ASSET_TO_STORY': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: { ...asset, storyGroupId: action.storyGroupId },
        },
      }
    }

    case 'UNASSIGN_ASSET_FROM_STORY': {
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

    case 'BULK_ASSIGN_ASSETS': {
      const updated = { ...state.assetsById }
      for (const assetId of action.assetIds) {
        if (updated[assetId]) {
          updated[assetId] = { ...updated[assetId], storyGroupId: action.storyGroupId }
        }
      }
      return { ...state, assetsById: updated }
    }

    case 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS': {
      // Sets storyGroupId on every asset that is currently unassigned,
      // using each StoryGroup's proposedAssetIds.
      // Does NOT override assets the creator has already assigned.
      const updated = { ...state.assetsById }
      for (const groupId of state.storyGroupOrder) {
        const group = state.storyGroupsById[groupId]
        for (const assetId of group.proposedAssetIds) {
          const asset = updated[assetId]
          if (asset && asset.storyGroupId === null && !asset.excluded) {
            updated[assetId] = { ...asset, storyGroupId: groupId }
          }
        }
      }
      return { ...state, assetsById: updated }
    }

    // ── Asset Editing ──

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
      const updated = { ...state.assetsById }
      for (const assetId of action.assetIds) {
        const asset = updated[assetId]
        if (asset) {
          updated[assetId] = {
            ...asset,
            editable: { ...asset.editable, [action.field]: action.value },
          }
        }
      }
      return { ...state, assetsById: updated }
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

    // ── Metadata Conflict Resolution ──

    case 'RESOLVE_CONFLICT': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      const updatedConflicts = asset.conflicts.map(c =>
        c.field === action.field
          ? { ...c, resolvedBy: 'creator' as const, resolvedValue: action.value }
          : c
      )
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            conflicts: updatedConflicts,
            editable: {
              ...asset.editable,
              [action.field]: action.value,
              metadataSource: { ...asset.editable.metadataSource, [action.field]: 'creator' as const },
            },
          },
        },
      }
    }

    case 'CONFIRM_PROPOSAL': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      // Mark the field source as creator-confirmed
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            editable: {
              ...asset.editable,
              metadataSource: { ...asset.editable.metadataSource, [action.field]: 'creator' as const },
            },
          },
        },
      }
    }

    case 'DISMISS_PROPOSAL': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      // Revert to embedded value or blank
      const em = asset.extractedMetadata
      let fallbackValue: AssetEditableFields[keyof AssetEditableFields] = ''
      if (action.field === 'title') fallbackValue = em?.iptcHeadline ?? ''
      else if (action.field === 'description') fallbackValue = em?.iptcCaption ?? ''
      else if (action.field === 'tags') fallbackValue = em?.iptcKeywords ?? []
      else if (action.field === 'geography') {
        fallbackValue = em ? [em.iptcCity, em.iptcCountry].filter(Boolean) as string[] : []
      }
      const newSource = em ? 'embedded' as const : undefined
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            editable: {
              ...asset.editable,
              [action.field]: fallbackValue,
              metadataSource: {
                ...asset.editable.metadataSource,
                [action.field]: newSource,
              },
            },
          },
        },
      }
    }

    // ── Duplicate Resolution ──

    case 'CLEAR_DUPLICATE_STATUS': {
      const asset = state.assetsById[action.assetId]
      if (!asset) return state
      return {
        ...state,
        assetsById: {
          ...state.assetsById,
          [action.assetId]: {
            ...asset,
            duplicateStatus: 'none',
            duplicateOfId: null,
          },
        },
      }
    }

    // ── UI State ──

    case 'SET_COLUMN_VISIBILITY':
      return { ...state, ui: { ...state.ui, visibleColumns: action.columns } }

    case 'TOGGLE_INSPECTOR':
      return { ...state, ui: { ...state.ui, inspectorCollapsed: !state.ui.inspectorCollapsed } }

    case 'TOGGLE_STORY_PROPOSALS_BANNER':
      return { ...state, ui: { ...state.ui, storyProposalsBannerOpen: !state.ui.storyProposalsBannerOpen } }

    case 'ACTIVATE_NEWSROOM_MODE':
      return {
        ...state,
        batch: { ...state.batch, newsroomMode: action.active },
        ui: { ...state.ui, density: action.active ? 'compact' : 'comfortable', newsroomMode: action.active },
      }

    // ── Express Flow ──

    case 'APPLY_EXPRESS_FLOW': {
      // Single explicit creator action that:
      // 1. Accepts all proposed Story assignments
      // 2. Applies suggested prices
      // 3. Ensures privacy + licences are set from defaults/proposals
      const updated = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = updated[id]
        if (!asset || asset.excluded) continue

        // Accept proposed story assignment
        let storyGroupId = asset.storyGroupId
        if (!storyGroupId) {
          for (const gId of state.storyGroupOrder) {
            const g = state.storyGroupsById[gId]
            if (g.proposedAssetIds.includes(id)) {
              storyGroupId = gId
              break
            }
          }
        }

        // Apply suggested price if none set
        const price = asset.editable.price ?? asset.proposal?.priceSuggestion?.amount ?? null

        // Ensure privacy
        const privacy = asset.editable.privacy ?? asset.proposal?.privacySuggestion ?? 'PUBLIC'

        // Ensure licences
        const licences = asset.editable.licences.length > 0
          ? asset.editable.licences
          : (asset.proposal?.licenceSuggestions.length ? asset.proposal.licenceSuggestions : ['editorial'] as const)

        updated[id] = {
          ...asset,
          storyGroupId,
          editable: {
            ...asset.editable,
            price,
            privacy,
            licences: [...licences] as LicenceType[],
          },
        }
      }
      return {
        ...state,
        assetsById: updated,
        ui: { ...state.ui, expressAccepted: true },
      }
    }

    // Dismiss express card without applying any proposals
    case 'DISMISS_EXPRESS':
      return {
        ...state,
        ui: { ...state.ui, expressAccepted: true },
      }

    // ── Commit ──

    case 'COMMIT_BATCH': {
      return {
        ...state,
        batch: { ...state.batch, currentStage: 'commit' },
      }
    }

    case 'COMPLETE_COMMIT': {
      const now = new Date().toISOString()
      const updated = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = updated[id]
        if (!asset || asset.excluded) continue
        const exceptions = getAssetExceptions(asset)
        const hasBlocking = exceptions.some(e => e.severity === 'blocking')
        if (!hasBlocking) {
          updated[id] = { ...asset, committedAt: now }
        }
      }
      return {
        ...state,
        assetsById: updated,
        batch: { ...state.batch, currentStage: 'complete', committedAt: now },
      }
    }

    // ── Story Group Deletion ──

    case 'DELETE_STORY_GROUP': {
      const group = state.storyGroupsById[action.storyGroupId]
      if (!group) return state
      // Unassign all assets from this group
      const updated = { ...state.assetsById }
      for (const id of state.assetOrder) {
        const asset = updated[id]
        if (asset && asset.storyGroupId === action.storyGroupId) {
          updated[id] = { ...asset, storyGroupId: null }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.storyGroupId]: _removedGroup, ...restGroups } = state.storyGroupsById
      return {
        ...state,
        assetsById: updated,
        storyGroupsById: restGroups,
        storyGroupOrder: state.storyGroupOrder.filter(id => id !== action.storyGroupId),
        ui: {
          ...state.ui,
          selectedStoryGroupId: state.ui.selectedStoryGroupId === action.storyGroupId ? null : state.ui.selectedStoryGroupId,
        },
      }
    }

    // ── Defaults ──

    case 'SET_DEFAULTS':
      return { ...state, defaults: { ...state.defaults, ...action.defaults } }

    // ── Filter / Sort ──

    case 'SET_FILTER':
      return { ...state, ui: { ...state.ui, filter: { ...state.ui.filter, ...action.filter } } }

    case 'SET_FILTER_PRESET':
      return {
        ...state,
        ui: {
          ...state.ui,
          filter: { preset: action.preset, storyGroupId: null, format: null, privacy: null, declaration: null, hasConflicts: null },
        },
      }

    case 'SET_SORT':
      return { ...state, ui: { ...state.ui, sortField: action.field, sortDirection: action.direction } }

    case 'SET_SEARCH_QUERY':
      return { ...state, ui: { ...state.ui, searchQuery: action.query } }

    case 'SET_DENSITY':
      return { ...state, ui: { ...state.ui, density: action.density } }

    case 'SET_MOBILE_TAB':
      return { ...state, ui: { ...state.ui, mobileTab: action.tab } }

    case 'SELECT_RANGE': {
      const filtered = getFilteredAssets(state)
      const ids = filtered.map(a => a.id)
      const fromIdx = ids.indexOf(action.fromAssetId)
      const toIdx = ids.indexOf(action.toAssetId)
      if (fromIdx === -1 || toIdx === -1) return state
      const start = Math.min(fromIdx, toIdx)
      const end = Math.max(fromIdx, toIdx)
      const rangeIds = ids.slice(start, end + 1)
      // Merge with existing selection
      const merged = Array.from(new Set([...state.ui.selectedAssetIds, ...rangeIds]))
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAssetIds: merged,
          focusedAssetId: action.toAssetId,
        },
      }
    }

    // ── Reset ──

    case 'RESET_FLOW':
      return createV2InitialState()

    default:
      return state
  }
}

// ── Initial State Factory ──

export function createV2InitialState(): V2State {
  return {
    batch: {
      id: genId('batch'),
      currentStage: 'add-files',
      createdAt: new Date().toISOString(),
      committedAt: null,
      newsroomMode: false,
    },
    assetsById: {},
    assetOrder: [],
    storyGroupsById: {},
    storyGroupOrder: [],
    ui: {
      selectedAssetIds: [],
      selectedStoryGroupId: null,
      focusedAssetId: null,
      filter: { preset: 'all', storyGroupId: null, format: null, privacy: null, declaration: null, hasConflicts: null },
      searchQuery: '',
      sortField: 'filename',
      sortDirection: 'asc',
      density: 'comfortable',
      mobileTab: 'assets',
      visibleColumns: [...DEFAULT_COLUMNS],
      inspectorCollapsed: false,
      newsroomMode: false,
      storyProposalsBannerOpen: true,
      expressEligible: false,
      expressAccepted: false,
      reviewEnteredEarly: false,
    },
    defaults: {
      privacy: null,
      licences: [],
      tags: [],
      watermarkMode: null,
    },
  }
}


// ════════════════════════════════════════════
// SELECTORS — Pure functions, computed every render
// ════════════════════════════════════════════

// ── Basic Getters ──

export function getAssets(state: V2State): V2Asset[] {
  return state.assetOrder.map(id => state.assetsById[id]).filter(Boolean)
}

export function getIncludedAssets(state: V2State): V2Asset[] {
  return getAssets(state).filter(a => !a.excluded)
}

export function getAssignedAssets(state: V2State): V2Asset[] {
  return getIncludedAssets(state).filter(a => a.storyGroupId !== null)
}

export function getUnassignedAssets(state: V2State): V2Asset[] {
  return getIncludedAssets(state).filter(a => a.storyGroupId === null)
}

export function getAssetsForStoryGroup(state: V2State, storyGroupId: string): V2Asset[] {
  return getIncludedAssets(state).filter(a => a.storyGroupId === storyGroupId)
}

export function getStoryGroups(state: V2State): V2StoryGroup[] {
  return state.storyGroupOrder.map(id => state.storyGroupsById[id]).filter(Boolean)
}

// ── Exception Computation ──

export function getAssetExceptions(asset: V2Asset): V2Exception[] {
  if (asset.excluded) return []

  const exceptions: V2Exception[] = []

  // Blocking: Story required for publish-ready completion
  if (!asset.storyGroupId) {
    exceptions.push({ type: 'needs_story', severity: 'blocking', label: 'Needs Story assignment' })
  }

  // Blocking: privacy required
  if (!asset.editable.privacy) {
    exceptions.push({ type: 'needs_privacy', severity: 'blocking', label: 'Needs privacy setting' })
  }

  // Blocking: manifest invalid
  if (asset.declarationState === 'manifest_invalid') {
    exceptions.push({ type: 'manifest_invalid', severity: 'blocking', label: 'Declaration invalid — cannot publish' })
  }

  // Blocking: unresolved metadata conflict
  if (asset.conflicts?.some(c => c.resolvedBy === null)) {
    exceptions.push({ type: 'unresolved_conflict', severity: 'blocking', label: 'Unresolved metadata conflict' })
  }

  // Blocking: price required for listable (PUBLIC or RESTRICTED)
  // privacy. Both states are transactable; PRIVATE is not.
  if (isListablePrivacy(asset.editable.privacy) && asset.editable.price === null) {
    exceptions.push({ type: 'needs_price', severity: 'blocking', label: 'Needs price' })
  }

  // Blocking: licences required for listable privacy.
  if (isListablePrivacy(asset.editable.privacy) && asset.editable.licences.length === 0) {
    exceptions.push({ type: 'needs_licences', severity: 'blocking', label: 'Needs licence selection' })
  }

  // Advisory: PRIVATE without price (non-blocking)
  if (asset.editable.privacy === 'PRIVATE' && asset.editable.price === null) {
    exceptions.push({ type: 'no_price_private', severity: 'advisory', label: 'No price set (private — can set later in Vault)' })
  }

  // Advisory: PRIVATE without licences (non-blocking)
  if (asset.editable.privacy === 'PRIVATE' && asset.editable.licences.length === 0) {
    exceptions.push({ type: 'no_licences_private', severity: 'advisory', label: 'No licences set (private — can set later in Vault)' })
  }

  // Advisory: duplicate
  if (asset.duplicateStatus === 'likely_duplicate') {
    exceptions.push({ type: 'duplicate_unresolved', severity: 'advisory', label: 'Possible duplicate' })
  }

  // Advisory: low confidence
  if (asset.proposal && asset.proposal.confidence < 0.5) {
    exceptions.push({ type: 'low_confidence', severity: 'advisory', label: 'Low metadata confidence — review recommended' })
  }

  // Advisory: provenance pending
  if (asset.declarationState === 'provenance_pending') {
    exceptions.push({ type: 'provenance_pending', severity: 'advisory', label: 'Provenance pending' })
  }

  return exceptions
}

export function getBlockingExceptions(state: V2State): Array<{ assetId: string; exceptions: V2Exception[] }> {
  return getIncludedAssets(state)
    .map(a => ({ assetId: a.id, exceptions: getAssetExceptions(a).filter(e => e.severity === 'blocking') }))
    .filter(r => r.exceptions.length > 0)
}

export function getAdvisoryExceptions(state: V2State): Array<{ assetId: string; exceptions: V2Exception[] }> {
  return getIncludedAssets(state)
    .map(a => ({ assetId: a.id, exceptions: getAssetExceptions(a).filter(e => e.severity === 'advisory') }))
    .filter(r => r.exceptions.length > 0)
}

// ── Publish Readiness ──

export function getPublishReadiness(state: V2State): {
  ready: boolean
  blockerSummary: string[]
  readyCount: number
  blockedCount: number
  advisoryCount: number
  excludedCount: number
} {
  const included = getIncludedAssets(state)
  let readyCount = 0
  let blockedCount = 0
  const blockerCounts: Record<string, number> = {}

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset)
    const blocking = exceptions.filter(e => e.severity === 'blocking')
    if (blocking.length > 0) {
      blockedCount++
      for (const b of blocking) {
        blockerCounts[b.type] = (blockerCounts[b.type] || 0) + 1
      }
    } else {
      readyCount++
    }
  }

  const advisoryCount = getAdvisoryExceptions(state).length
  const excludedCount = getAssets(state).filter(a => a.excluded).length

  // Generate human-readable blocker summary
  const blockerSummary: string[] = []
  if (blockerCounts['needs_story']) blockerSummary.push(`${blockerCounts['needs_story']} asset${blockerCounts['needs_story'] > 1 ? 's' : ''} need Story assignment`)
  if (blockerCounts['needs_privacy']) blockerSummary.push(`${blockerCounts['needs_privacy']} asset${blockerCounts['needs_privacy'] > 1 ? 's' : ''} need privacy setting`)
  if (blockerCounts['needs_price']) blockerSummary.push(`${blockerCounts['needs_price']} asset${blockerCounts['needs_price'] > 1 ? 's' : ''} need pricing`)
  if (blockerCounts['needs_licences']) blockerSummary.push(`${blockerCounts['needs_licences']} asset${blockerCounts['needs_licences'] > 1 ? 's' : ''} need licence selection`)
  if (blockerCounts['manifest_invalid']) blockerSummary.push(`${blockerCounts['manifest_invalid']} asset${blockerCounts['manifest_invalid'] > 1 ? 's have' : ' has'} invalid declaration`)
  if (blockerCounts['unresolved_conflict']) blockerSummary.push(`${blockerCounts['unresolved_conflict']} asset${blockerCounts['unresolved_conflict'] > 1 ? 's have' : ' has'} unresolved metadata conflicts`)

  return {
    ready: readyCount > 0,
    blockerSummary,
    readyCount,
    blockedCount,
    advisoryCount,
    excludedCount,
  }
}

// ── Express Eligibility ──

export function getExpressEligibility(state: V2State): {
  eligible: boolean
  reasons: string[]
} {
  const assets = getIncludedAssets(state)
  const groups = getStoryGroups(state)
  const reasons: string[] = []

  // Must have assets
  if (assets.length === 0) {
    return { eligible: false, reasons: ['No assets'] }
  }

  // All analysis must be complete
  const incomplete = assets.filter(a => a.analysisStatus !== 'complete')
  if (incomplete.length > 0) {
    reasons.push(`${incomplete.length} asset${incomplete.length > 1 ? 's' : ''} still analysing`)
  }

  // Exactly one story group proposed
  if (groups.length !== 1) {
    reasons.push(`${groups.length} Story groups proposed (express requires exactly 1)`)
  }

  // All assets must have high-confidence metadata
  const lowConfidence = assets.filter(a => a.proposal && a.proposal.confidence < 0.7)
  if (lowConfidence.length > 0) {
    reasons.push(`${lowConfidence.length} asset${lowConfidence.length > 1 ? 's have' : ' has'} low confidence metadata`)
  }

  // No manifest invalid
  const invalid = assets.filter(a => a.declarationState === 'manifest_invalid')
  if (invalid.length > 0) {
    reasons.push(`${invalid.length} asset${invalid.length > 1 ? 's have' : ' has'} invalid declaration`)
  }

  return { eligible: reasons.length === 0, reasons }
}

// ── Story Coverage Summary ──

export function getStoryCoverageSummary(state: V2State): {
  totalIncluded: number
  assigned: number
  unassigned: number
  groups: Array<{ id: string; name: string; kind: StoryGroupKind; assignedCount: number; proposedCount: number }>
} {
  const included = getIncludedAssets(state)
  const assigned = included.filter(a => a.storyGroupId !== null)
  const groups = getStoryGroups(state).map(g => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    assignedCount: included.filter(a => a.storyGroupId === g.id).length,
    proposedCount: g.proposedAssetIds.length,
  }))

  return {
    totalIncluded: included.length,
    assigned: assigned.length,
    unassigned: included.length - assigned.length,
    groups,
  }
}

// ── Total Listed Value ──

export function getTotalListedValue(state: V2State): number {
  return getIncludedAssets(state)
    .filter(a => isListablePrivacy(a.editable.privacy))
    .reduce((sum, a) => sum + (a.editable.price ?? 0), 0)
}

// ── Commit Outcome per Asset ──

export function getAssetCommitOutcome(asset: V2Asset): CommitOutcome {
  if (asset.excluded) return 'excluded'

  const exceptions = getAssetExceptions(asset)
  if (exceptions.some(e => e.severity === 'blocking')) return 'blocked'

  if (asset.editable.privacy === 'PRIVATE') return 'stored_not_transactable'

  const isTransactable = asset.declarationState && TRANSACTABLE_STATES.includes(asset.declarationState)

  if (asset.editable.privacy === 'RESTRICTED' && isTransactable) return 'transactable_via_link'
  if (asset.editable.privacy === 'PUBLIC' && isTransactable) return 'ready_for_discovery_and_transaction'

  return 'stored_not_transactable'
}

// ── Completion Summary ──

export function getCompletionSummary(state: V2State): V2CompletionSummary {
  const assets = getAssets(state)
  const committed = assets.filter(a => a.committedAt !== null)
  const excluded = assets.filter(a => a.excluded)
  const blocked = assets.filter(a => !a.excluded && !a.committedAt)

  const storyMap = new Map<string, { name: string; assetCount: number; listedValue: number; isNew: boolean }>()
  for (const asset of committed) {
    if (!asset.storyGroupId) continue
    const group = state.storyGroupsById[asset.storyGroupId]
    if (!group) continue
    const existing = storyMap.get(group.id)
    const price = (asset.editable.privacy === 'PUBLIC' || asset.editable.privacy === 'RESTRICTED')
      ? (asset.editable.price ?? 0) : 0
    if (existing) {
      existing.assetCount++
      existing.listedValue += price
    } else {
      storyMap.set(group.id, {
        name: group.name,
        assetCount: 1,
        listedValue: price,
        isNew: group.kind !== 'matched-existing',
      })
    }
  }

  let stored = 0
  let transactableViaLink = 0
  let readyForDiscovery = 0
  for (const asset of committed) {
    const outcome = getAssetCommitOutcome(asset)
    if (outcome === 'stored_not_transactable') stored++
    if (outcome === 'transactable_via_link') transactableViaLink++
    if (outcome === 'ready_for_discovery_and_transaction') readyForDiscovery++
  }

  return {
    totalCommitted: committed.length,
    totalExcluded: excluded.length,
    totalBlocked: blocked.length,
    totalListedValue: committed
      .filter(a => a.editable.privacy === 'PUBLIC' || a.editable.privacy === 'RESTRICTED')
      .reduce((sum, a) => sum + (a.editable.price ?? 0), 0),
    stories: Array.from(storyMap.entries()).map(([id, data]) => ({
      id,
      ...data,
      vaultUrl: `/vault/stories/${id}`,
    })),
    outcomeBreakdown: { stored, transactableViaLink, readyForDiscovery },
  }
}

// ── Analysis Progress ──

export function getAnalysisProgress(state: V2State): {
  total: number
  complete: number
  failed: number
  inProgress: number
  percent: number
} {
  const assets = getAssets(state)
  const complete = assets.filter(a => a.analysisStatus === 'complete').length
  const failed = assets.filter(a => a.analysisStatus === 'failed').length
  const total = assets.length
  return {
    total,
    complete,
    failed,
    inProgress: total - complete - failed,
    percent: total > 0 ? Math.round(((complete + failed) / total) * 100) : 0,
  }
}

// ── Filtered Assets ──

export function getFilteredAssets(state: V2State): V2Asset[] {
  let assets = getAssets(state)
  const { filter, searchQuery, sortField, sortDirection } = state.ui

  // Search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    assets = assets.filter(a =>
      a.filename.toLowerCase().includes(q) ||
      a.editable.title.toLowerCase().includes(q) ||
      a.editable.tags.some(t => t.toLowerCase().includes(q)) ||
      (a.format && a.format.toLowerCase().includes(q))
    )
  }

  switch (filter.preset) {
    case 'blocking':
      assets = assets.filter(a => !a.excluded && getAssetExceptions(a).some(e => e.severity === 'blocking'))
      break
    case 'advisory':
      assets = assets.filter(a => !a.excluded && getAssetExceptions(a).some(e => e.severity === 'advisory'))
      break
    case 'unassigned':
      assets = assets.filter(a => !a.excluded && a.storyGroupId === null)
      break
    case 'assigned':
      assets = assets.filter(a => !a.excluded && a.storyGroupId !== null)
      break
    case 'duplicates':
      assets = assets.filter(a => a.duplicateStatus !== 'none')
      break
    case 'excluded':
      assets = assets.filter(a => a.excluded)
      break
    case 'ready':
      assets = assets.filter(a => !a.excluded && a.analysisStatus === 'complete' && getAssetExceptions(a).filter(e => e.severity === 'blocking').length === 0)
      break
    case 'processing':
      assets = assets.filter(a => a.analysisStatus === 'uploading' || a.analysisStatus === 'analysing' || a.analysisStatus === 'pending')
      break
    case 'failed':
      assets = assets.filter(a => a.analysisStatus === 'failed')
      break
    case 'conflicts':
      assets = assets.filter(a => a.conflicts?.some(c => c.resolvedBy === null))
      break
    case 'missing-required':
      assets = assets.filter(a => !a.excluded && getAssetExceptions(a).some(e =>
        e.type === 'needs_story' || e.type === 'needs_privacy' || e.type === 'needs_price' || e.type === 'needs_licences'
      ))
      break
    case 'private-ready':
      assets = assets.filter(a => !a.excluded && a.editable.privacy === 'PRIVATE' && getAssetExceptions(a).filter(e => e.severity === 'blocking').length === 0)
      break
    case 'all':
    default:
      break
  }

  if (filter.storyGroupId) {
    assets = assets.filter(a => a.storyGroupId === filter.storyGroupId)
  }
  if (filter.format) {
    assets = assets.filter(a => a.format === filter.format)
  }
  if (filter.privacy) {
    assets = assets.filter(a => a.editable.privacy === filter.privacy)
  }
  if (filter.declaration) {
    assets = assets.filter(a => a.declarationState === filter.declaration)
  }
  if (filter.hasConflicts === true) {
    assets = assets.filter(a => a.conflicts?.some(c => c.resolvedBy === null))
  }

  // Sorting
  const dir = sortDirection === 'asc' ? 1 : -1
  assets = [...assets].sort((a, b) => {
    switch (sortField) {
      case 'filename':
        return dir * a.filename.localeCompare(b.filename)
      case 'title':
        return dir * a.editable.title.localeCompare(b.editable.title)
      case 'format':
        return dir * (a.format ?? '').localeCompare(b.format ?? '')
      case 'story': {
        const sA = a.storyGroupId ? (state.storyGroupsById[a.storyGroupId]?.name ?? '') : ''
        const sB = b.storyGroupId ? (state.storyGroupsById[b.storyGroupId]?.name ?? '') : ''
        return dir * sA.localeCompare(sB)
      }
      case 'privacy':
        return dir * (a.editable.privacy ?? '').localeCompare(b.editable.privacy ?? '')
      case 'price':
        return dir * ((a.editable.price ?? -1) - (b.editable.price ?? -1))
      case 'declaration':
        return dir * (a.declarationState ?? '').localeCompare(b.declarationState ?? '')
      case 'size':
        return dir * (a.fileSize - b.fileSize)
      case 'captureDate':
        return dir * (a.editable.captureDate ?? '').localeCompare(b.editable.captureDate ?? '')
      case 'confidence':
        return dir * ((a.proposal?.confidence ?? 0) - (b.proposal?.confidence ?? 0))
      case 'location':
        return dir * (a.editable.geography.join(', ')).localeCompare(b.editable.geography.join(', '))
      case 'issues': {
        const eA = getAssetExceptions(a).length
        const eB = getAssetExceptions(b).length
        return dir * (eA - eB)
      }
      case 'status':
      default:
        return 0
    }
  })

  return assets
}

// ── Cents to EUR string ──

export function centsToEur(cents: number): string {
  return `\u20AC${(cents / 100).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Source Hierarchy Helpers ──

export type FieldSource = 'embedded' | 'ai' | 'creator' | 'none'

/** Get the effective source for a field on an asset */
export function getFieldSource(asset: V2Asset, field: keyof AssetEditableFields): FieldSource {
  const tracked = (asset.editable.metadataSource as Record<string, string | undefined>)[field]
  if (tracked) return tracked as FieldSource
  // Infer from state
  const val = asset.editable[field]
  if (val === null || val === '' || (Array.isArray(val) && val.length === 0)) return 'none'
  return 'ai' // default if populated but no source tracked
}

/** Check if a field has an unresolved conflict */
export function hasUnresolvedConflict(asset: V2Asset, field: keyof AssetEditableFields): boolean {
  return asset.conflicts?.some(c => c.field === field && c.resolvedBy === null) ?? false
}

/** Get the conflict for a specific field, if any */
export function getFieldConflict(asset: V2Asset, field: keyof AssetEditableFields): MetadataConflict | undefined {
  return asset.conflicts?.find(c => c.field === field)
}

/** Get proposed value for a field from the AI proposal */
export function getProposedValue(asset: V2Asset, field: keyof AssetEditableFields): string | string[] | null {
  if (!asset.proposal) return null
  switch (field) {
    case 'title': return asset.proposal.title
    case 'description': return asset.proposal.description
    case 'tags': return asset.proposal.tags
    case 'geography': return asset.proposal.geography
    default: return null
  }
}

/** Get embedded value for a field from extracted metadata */
export function getEmbeddedValue(asset: V2Asset, field: keyof AssetEditableFields): string | string[] | null {
  const em = asset.extractedMetadata
  if (!em) return null
  switch (field) {
    case 'title': return em.iptcHeadline
    case 'description': return em.iptcCaption
    case 'tags': return em.iptcKeywords.length > 0 ? em.iptcKeywords : null
    case 'geography': {
      const parts = [em.iptcCity, em.iptcCountry].filter(Boolean) as string[]
      return parts.length > 0 ? parts : null
    }
    case 'captureDate': return em.iptcDateCreated
    default: return null
  }
}

// ── Batch Exception Counts ──

export interface BatchExceptionCounts {
  total: number
  blocking: number
  advisory: number
  conflicts: number
  missingStory: number
  missingPrivacy: number
  missingPrice: number
  missingLicences: number
  manifestInvalid: number
  duplicates: number
  lowConfidence: number
  provenancePending: number
}

export function getBatchExceptionCounts(state: V2State): BatchExceptionCounts {
  const included = getIncludedAssets(state)
  const counts: BatchExceptionCounts = {
    total: 0, blocking: 0, advisory: 0, conflicts: 0,
    missingStory: 0, missingPrivacy: 0, missingPrice: 0, missingLicences: 0,
    manifestInvalid: 0, duplicates: 0, lowConfidence: 0, provenancePending: 0,
  }

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset)
    if (exceptions.length === 0) continue
    counts.total++
    const hasBlocking = exceptions.some(e => e.severity === 'blocking')
    const hasAdvisory = exceptions.some(e => e.severity === 'advisory')
    if (hasBlocking) counts.blocking++
    if (hasAdvisory) counts.advisory++
    for (const e of exceptions) {
      switch (e.type) {
        case 'needs_story': counts.missingStory++; break
        case 'needs_privacy': counts.missingPrivacy++; break
        case 'needs_price': counts.missingPrice++; break
        case 'needs_licences': counts.missingLicences++; break
        case 'manifest_invalid': counts.manifestInvalid++; break
        case 'unresolved_conflict': counts.conflicts++; break
        case 'duplicate_unresolved': counts.duplicates++; break
        case 'low_confidence': counts.lowConfidence++; break
        case 'provenance_pending': counts.provenancePending++; break
      }
    }
  }

  return counts
}

// ── Batch Empty-Field Audit ──

export interface BatchFieldAudit {
  field: string
  label: string
  emptyCount: number
  totalCount: number
  filledPercent: number
}

export function getBatchFieldAudit(state: V2State): BatchFieldAudit[] {
  const included = getIncludedAssets(state)
  const total = included.length
  if (total === 0) return []

  const fields: Array<{ field: string; label: string; check: (a: V2Asset) => boolean }> = [
    { field: 'title', label: 'Title', check: a => !a.editable.title },
    { field: 'description', label: 'Description', check: a => !a.editable.description },
    { field: 'tags', label: 'Tags', check: a => a.editable.tags.length === 0 },
    { field: 'geography', label: 'Location', check: a => a.editable.geography.length === 0 },
    { field: 'privacy', label: 'Privacy', check: a => !a.editable.privacy },
    { field: 'price', label: 'Price', check: a => a.editable.price === null },
    { field: 'licences', label: 'Licences', check: a => a.editable.licences.length === 0 },
    { field: 'storyGroupId', label: 'Story', check: a => !a.storyGroupId },
  ]

  return fields.map(f => {
    const emptyCount = included.filter(f.check).length
    return {
      field: f.field,
      label: f.label,
      emptyCount,
      totalCount: total,
      filledPercent: Math.round(((total - emptyCount) / total) * 100),
    }
  }).filter(f => f.emptyCount > 0) // Only show fields with gaps
}