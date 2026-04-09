/**
 * Frontfiles Upload — Batch State Machine
 *
 * Replaces the serial reducer. Operates on BatchSession.
 * All state transitions are batch-aware.
 */

'use client'

import type {
  BatchSession,
  BatchAsset,
  BatchAssetState,
  AttentionReason,
  BatchDefaults,
  BatchScreen,
  BatchFilterState,
  BatchCounters,
  CommitSummary,
} from './batch-types'
import type {
  AssetFormat,
  PrivacyState,
  LicenceType,
  StoryRef,
  AnalysisResult,
  MetadataProposal,
  ValidationDeclarationState,
} from './types'
import { generatePriceRecommendation } from './price-engine'

// ── ID Generator ──

let counter = 0
function genId(prefix: string): string {
  counter++
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

// ── Actions ──

export type BatchAction =
  | { type: 'ADD_FILES'; files: File[]; formats: Map<string, AssetFormat> }
  | { type: 'SET_DEFAULTS'; defaults: Partial<BatchDefaults> }
  | { type: 'START_BATCH' }
  | { type: 'SET_SCREEN'; screen: BatchScreen }
  | { type: 'UPDATE_UPLOAD_PROGRESS'; assetId: string; progress: number }
  | { type: 'UPLOAD_COMPLETE'; assetId: string }
  | { type: 'UPLOAD_FAILED'; assetId: string; reason: string }
  | { type: 'PROCESSING_COMPLETE'; assetId: string; analysis: AnalysisResult; proposal: MetadataProposal; declarationState: ValidationDeclarationState }
  | { type: 'PROCESSING_FAILED'; assetId: string }
  | { type: 'UPDATE_ASSET'; assetId: string; updates: Partial<Pick<BatchAsset, 'title' | 'description' | 'tags' | 'geographicTags' | 'storyAssignment' | 'privacy' | 'priceAmount' | 'enabledLicences' | 'heldFromCommit'>> }
  | { type: 'BULK_UPDATE'; assetIds: string[]; updates: Partial<Pick<BatchAsset, 'storyAssignment' | 'privacy' | 'priceAmount' | 'enabledLicences' | 'tags' | 'heldFromCommit'>>; mode: 'selected' | 'fill_blanks' | 'overwrite' }
  | { type: 'APPLY_RECOMMENDED_PRICES'; assetIds: string[] }
  | { type: 'REMOVE_ASSETS'; assetIds: string[] }
  | { type: 'RETRY_ASSETS'; assetIds: string[] }
  | { type: 'SELECT_ASSETS'; assetIds: string[] }
  | { type: 'DESELECT_ASSETS'; assetIds: string[] }
  | { type: 'TOGGLE_SELECT_ASSET'; assetId: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_VIEW_MODE'; mode: 'grid' | 'table' }
  | { type: 'SET_FILTER'; filter: Partial<BatchFilterState> }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'COMMIT_READY' }

// ── Derive asset state + attention reason ──

function deriveAssetState(asset: BatchAsset): { state: BatchAssetState; attentionReason: AttentionReason | null } {
  // Terminal states
  if (asset.state === 'committed') return { state: 'committed', attentionReason: null }
  if (asset.state === 'failed') return { state: 'failed', attentionReason: asset.attentionReason }
  if (asset.state === 'uploading') return { state: 'uploading', attentionReason: null }
  if (asset.state === 'processing') return { state: 'processing', attentionReason: null }

  // Check for blocking issues
  if (asset.declarationState === 'manifest_invalid') {
    return { state: 'blocked', attentionReason: 'manifest_invalid' }
  }
  if (!asset.format) {
    return { state: 'blocked', attentionReason: 'unsupported_file' }
  }
  if (!asset.title || !asset.description) {
    return { state: 'blocked', attentionReason: 'needs_metadata' }
  }
  if (!asset.storyAssignment) {
    return { state: 'blocked', attentionReason: 'needs_story' }
  }
  if (!asset.privacy) {
    return { state: 'blocked', attentionReason: 'needs_privacy' }
  }
  if (asset.privacy !== 'PRIVATE' && !asset.priceAmount) {
    return { state: 'blocked', attentionReason: 'needs_price' }
  }
  if (asset.privacy !== 'PRIVATE' && asset.enabledLicences.length === 0) {
    return { state: 'blocked', attentionReason: 'needs_licences' }
  }

  // Check for warnings
  if (asset.declarationState === 'provenance_pending') {
    return { state: 'warning', attentionReason: 'provenance_pending' }
  }
  if (asset.priceRecommendation && asset.priceRecommendation.confidence < 0.6) {
    return { state: 'warning', attentionReason: 'low_confidence' }
  }

  return { state: 'ready', attentionReason: null }
}

function recomputeAsset(asset: BatchAsset): BatchAsset {
  // Recompute price recommendation
  const priceRecommendation = generatePriceRecommendation({
    format: asset.format,
    declarationState: asset.declarationState,
    privacy: asset.privacy,
    enabledLicences: asset.enabledLicences,
    hasStory: !!asset.storyAssignment,
  })

  const updated = { ...asset, priceRecommendation }

  // Only derive state for non-terminal, non-in-progress assets
  if (asset.state !== 'uploading' && asset.state !== 'processing' && asset.state !== 'committed' && asset.state !== 'failed') {
    const derived = deriveAssetState(updated)
    updated.state = derived.state
    updated.attentionReason = derived.attentionReason
  }

  return updated
}

// ── Reducer ──

export function batchReducer(state: BatchSession, action: BatchAction): BatchSession {
  switch (action.type) {
    case 'ADD_FILES': {
      const newAssets: BatchAsset[] = action.files.map(file => {
        const format = action.formats.get(file.name) ?? null
        const asset: BatchAsset = {
          id: genId('ba'),
          file,
          fileName: file.name,
          fileSize: file.size,
          format,
          thumbnailUrl: null,
          state: 'uploading',
          attentionReason: null,
          failureReason: null,
          uploadProgress: 0,
          heldFromCommit: false,
          analysisResult: null,
          metadataProposal: null,
          declarationState: null,
          title: '',
          description: '',
          tags: [...state.defaults.tags],
          geographicTags: [],
          storyAssignment: state.defaults.storyAssignment,
          privacy: state.defaults.privacy,
          priceAmount: null,
          enabledLicences: [...state.defaults.enabledLicences],
          priceRecommendation: null,
          createdAt: new Date().toISOString(),
          committedAt: null,
        }
        return asset
      })
      return { ...state, assets: [...state.assets, ...newAssets] }
    }

    case 'SET_DEFAULTS':
      return { ...state, defaults: { ...state.defaults, ...action.defaults } }

    case 'START_BATCH':
      return { ...state, screen: 'processing' }

    case 'SET_SCREEN':
      return { ...state, screen: action.screen }

    case 'UPDATE_UPLOAD_PROGRESS':
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === action.assetId ? { ...a, uploadProgress: action.progress } : a
        ),
      }

    case 'UPLOAD_COMPLETE':
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === action.assetId ? { ...a, state: 'processing' as const, uploadProgress: 100 } : a
        ),
      }

    case 'UPLOAD_FAILED':
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === action.assetId
            ? { ...a, state: 'failed' as const, failureReason: 'transfer_failed' as const, attentionReason: null }
            : a
        ),
      }

    case 'PROCESSING_COMPLETE': {
      return {
        ...state,
        assets: state.assets.map(a => {
          if (a.id !== action.assetId) return a
          const updated: BatchAsset = {
            ...a,
            state: 'ready',
            analysisResult: action.analysis,
            metadataProposal: action.proposal,
            declarationState: action.declarationState,
            // Auto-fill from proposal if empty
            title: a.title || action.proposal.title.value,
            description: a.description || action.proposal.description.value,
            tags: a.tags.length > 0 ? a.tags : action.proposal.tags.value,
            geographicTags: a.geographicTags.length > 0 ? a.geographicTags : action.proposal.geographicTags.value,
            storyAssignment: a.storyAssignment ?? (action.proposal.suggestedStoryId ? {
              id: action.proposal.suggestedStoryId,
              title: action.proposal.suggestedStoryTitle ?? 'Untitled Story',
              assetCount: 0,
              isNew: false,
            } : null),
          }
          return recomputeAsset(updated)
        }),
      }
    }

    case 'PROCESSING_FAILED':
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === action.assetId
            ? { ...a, state: 'failed' as const, failureReason: 'analysis_failed' as const }
            : a
        ),
      }

    case 'UPDATE_ASSET': {
      return {
        ...state,
        assets: state.assets.map(a => {
          if (a.id !== action.assetId) return a
          const updated = { ...a, ...action.updates }
          return recomputeAsset(updated)
        }),
      }
    }

    case 'BULK_UPDATE': {
      return {
        ...state,
        assets: state.assets.map(a => {
          if (!action.assetIds.includes(a.id)) return a
          const updates = { ...action.updates }

          if (action.mode === 'fill_blanks') {
            // Only apply to fields that are empty/null
            if (updates.storyAssignment !== undefined && a.storyAssignment !== null) delete updates.storyAssignment
            if (updates.privacy !== undefined && a.privacy !== null) delete updates.privacy
            if (updates.priceAmount !== undefined && a.priceAmount !== null) delete updates.priceAmount
            if (updates.enabledLicences !== undefined && a.enabledLicences.length > 0) delete updates.enabledLicences
            if (updates.tags !== undefined && a.tags.length > 0) delete updates.tags
          }

          const updated = { ...a, ...updates }
          return recomputeAsset(updated)
        }),
      }
    }

    case 'APPLY_RECOMMENDED_PRICES':
      return {
        ...state,
        assets: state.assets.map(a => {
          if (!action.assetIds.includes(a.id)) return a
          if (!a.priceRecommendation) return a
          const updated = { ...a, priceAmount: a.priceRecommendation.amount }
          return recomputeAsset(updated)
        }),
      }

    case 'REMOVE_ASSETS':
      return {
        ...state,
        assets: state.assets.filter(a => !action.assetIds.includes(a.id)),
        selectedAssetIds: state.selectedAssetIds.filter(id => !action.assetIds.includes(id)),
      }

    case 'RETRY_ASSETS':
      return {
        ...state,
        assets: state.assets.map(a =>
          action.assetIds.includes(a.id)
            ? { ...a, state: 'uploading' as const, failureReason: null, uploadProgress: 0 }
            : a
        ),
      }

    case 'SELECT_ASSETS':
      return {
        ...state,
        selectedAssetIds: [...new Set([...state.selectedAssetIds, ...action.assetIds])],
      }

    case 'DESELECT_ASSETS':
      return {
        ...state,
        selectedAssetIds: state.selectedAssetIds.filter(id => !action.assetIds.includes(id)),
      }

    case 'TOGGLE_SELECT_ASSET': {
      const isSelected = state.selectedAssetIds.includes(action.assetId)
      return {
        ...state,
        selectedAssetIds: isSelected
          ? state.selectedAssetIds.filter(id => id !== action.assetId)
          : [...state.selectedAssetIds, action.assetId],
      }
    }

    case 'SELECT_ALL':
      return { ...state, selectedAssetIds: state.assets.map(a => a.id) }

    case 'DESELECT_ALL':
      return { ...state, selectedAssetIds: [] }

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode }

    case 'SET_FILTER':
      return { ...state, filterState: { ...state.filterState, ...action.filter } }

    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: !state.drawerOpen }

    case 'COMMIT_READY': {
      const now = new Date().toISOString()
      return {
        ...state,
        screen: 'review',
        assets: state.assets.map(a => {
          if (a.state === 'ready' && !a.heldFromCommit) {
            return { ...a, state: 'committed' as const, committedAt: now }
          }
          return a
        }),
      }
    }

    default:
      return state
  }
}

// ── Selectors ──

export function getCounters(assets: BatchAsset[]): BatchCounters {
  return {
    total: assets.length,
    uploading: assets.filter(a => a.state === 'uploading').length,
    processing: assets.filter(a => a.state === 'processing').length,
    ready: assets.filter(a => a.state === 'ready').length,
    warning: assets.filter(a => a.state === 'warning').length,
    blocked: assets.filter(a => a.state === 'blocked').length,
    committed: assets.filter(a => a.state === 'committed').length,
    failed: assets.filter(a => a.state === 'failed').length,
  }
}

export function getFilteredAssets(assets: BatchAsset[], filter: BatchFilterState): BatchAsset[] {
  return assets.filter(a => {
    if (filter.state !== 'all' && a.state !== filter.state) return false
    if (filter.format !== 'all' && a.format !== filter.format) return false
    if (filter.story === 'unassigned' && a.storyAssignment !== null) return false
    if (filter.story !== 'all' && filter.story !== 'unassigned' && a.storyAssignment?.id !== filter.story) return false
    if (filter.privacy === 'unset' && a.privacy !== null) return false
    if (filter.privacy !== 'all' && filter.privacy !== 'unset' && a.privacy !== filter.privacy) return false
    if (filter.attention !== 'all' && a.attentionReason !== filter.attention) return false
    return true
  })
}

export function getExceptionAssets(assets: BatchAsset[]): BatchAsset[] {
  return assets.filter(a => a.state === 'blocked' || a.state === 'warning' || a.state === 'failed')
}

export function getCommitSummary(assets: BatchAsset[]): CommitSummary {
  const readyAssets = assets.filter(a => a.state === 'ready' && !a.heldFromCommit)
  const heldAssets = assets.filter(a => (a.state === 'ready' || a.state === 'warning') && a.heldFromCommit)
  const blockedAssets = assets.filter(a => a.state === 'blocked' || a.state === 'failed')

  const totalPrice = readyAssets.reduce((sum, a) => sum + (a.priceAmount ?? 0), 0)

  const licenceSummary = {} as Record<LicenceType, number>
  readyAssets.forEach(a => {
    a.enabledLicences.forEach(l => {
      licenceSummary[l] = (licenceSummary[l] || 0) + 1
    })
  })

  const privacySummary = {} as Record<PrivacyState, number>
  readyAssets.forEach(a => {
    if (a.privacy) {
      privacySummary[a.privacy] = (privacySummary[a.privacy] || 0) + 1
    }
  })

  const formatSummary: Record<string, number> = {}
  readyAssets.forEach(a => {
    const f = a.format ?? 'unknown'
    formatSummary[f] = (formatSummary[f] || 0) + 1
  })

  const storyMap = new Map<string, { title: string; count: number }>()
  readyAssets.forEach(a => {
    if (a.storyAssignment) {
      const existing = storyMap.get(a.storyAssignment.id)
      if (existing) {
        existing.count++
      } else {
        storyMap.set(a.storyAssignment.id, { title: a.storyAssignment.title, count: 1 })
      }
    }
  })

  return {
    readyAssets,
    heldAssets,
    blockedAssets,
    totalPrice,
    licenceSummary,
    privacySummary,
    formatSummary,
    storySummary: Array.from(storyMap.values()),
  }
}

// ── Initial State Factory ──

export function createBatchSession(): BatchSession {
  return {
    id: genId('batch'),
    assets: [],
    defaults: {
      storyAssignment: null,
      privacy: null,
      enabledLicences: [],
      tags: [],
      applyRecommendedPrice: false,
    },
    screen: 'intake',
    selectedAssetIds: [],
    filterState: {
      state: 'all',
      format: 'all',
      story: 'all',
      privacy: 'all',
      attention: 'all',
    },
    viewMode: 'table',
    drawerOpen: false,
    createdAt: new Date().toISOString(),
  }
}
