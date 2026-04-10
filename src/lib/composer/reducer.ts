// ═══════════════════════════════════════════════════════════════
// COMPOSER — Reducer
// Pure state transitions for the article assembly environment
// ═══════════════════════════════════════════════════════════════

import type { ComposerState, ComposerAction, ComposerBlock, InlineTextAsset, SavedSearch } from './types'
import { TEXT_WORD_RATE } from './types'
import { assetMap } from '@/data'

/** Mock creator ID — in production this comes from auth */
const LOGGED_IN_CREATOR_ID = 'creator-001'
const LOGGED_IN_CREATOR_NAME = 'Marco Oliveira'

function buildInlineTextAsset(blockId: string, content: string): InlineTextAsset | null {
  const trimmed = content.trim()
  if (!trimmed) return null
  const words = trimmed.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const firstLine = trimmed.split('\n')[0].substring(0, 60)
  const title = firstLine + (firstLine.length >= 60 ? '...' : '')
  return {
    blockId,
    title: `Text: ${title}`,
    wordCount,
    price: Math.round(wordCount * TEXT_WORD_RATE * 100) / 100, // EUR, rounded to cents
    creatorId: LOGGED_IN_CREATOR_ID,
  }
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    // ── Article metadata ──────────────────────────

    case 'SET_ARTICLE_TYPE': {
      const nextSplit = action.payload === 'creator_article'
        ? { ...state.split, editorShare: 0 }
        : state.split
      return { ...state, articleType: action.payload, split: nextSplit }
    }

    case 'SET_TITLE':
      return { ...state, title: action.payload }

    case 'SET_DEK':
      return { ...state, dek: action.payload }

    // ── Block operations ──────────────────────────

    case 'ADD_TEXT_BLOCK': {
      const newId = `block-${Date.now()}`
      const newBlock: ComposerBlock = { id: newId, type: 'text', content: '' }
      const insertIdx = action.payload.afterBlockId
        ? state.blockOrder.indexOf(action.payload.afterBlockId) + 1
        : state.blockOrder.length
      const nextOrder = [...state.blockOrder]
      nextOrder.splice(insertIdx, 0, newId)
      return {
        ...state,
        blocks: [...state.blocks, newBlock],
        blockOrder: nextOrder,
        ui: { ...state.ui, focusedBlockId: newId },
      }
    }

    case 'ADD_ASSET_BLOCK': {
      const { assetId, afterBlockId } = action.payload
      const newId = `block-${Date.now()}`
      const asset = assetMap[assetId]
      // Text-format assets: import textExcerpt as caption (the licensable content)
      const autoCaption = asset?.format === 'Text' && asset.textExcerpt
        ? asset.textExcerpt
        : asset?.description ?? ''
      const newBlock: ComposerBlock = { id: newId, type: 'asset', assetId, caption: autoCaption, editorCaption: '' }
      const insertIdx = afterBlockId
        ? state.blockOrder.indexOf(afterBlockId) + 1
        : state.blockOrder.length
      const nextOrder = [...state.blockOrder]
      nextOrder.splice(insertIdx, 0, newId)
      // Also add to source assets if not already there
      const nextSourceIds = state.sourceAssetIds.includes(assetId)
        ? state.sourceAssetIds
        : [...state.sourceAssetIds, assetId]
      return {
        ...state,
        blocks: [...state.blocks, newBlock],
        blockOrder: nextOrder,
        sourceAssetIds: nextSourceIds,
        ui: { ...state.ui, focusedBlockId: newId },
      }
    }

    case 'REMOVE_BLOCK': {
      const { blockId } = action.payload
      const removed = state.blocks.find(b => b.id === blockId)
      const nextBlocks = state.blocks.filter(b => b.id !== blockId)
      const nextOrder = state.blockOrder.filter(id => id !== blockId)
      // If removing an asset block, check if asset is still referenced elsewhere
      let nextSourceIds = state.sourceAssetIds
      if (removed?.type === 'asset') {
        const stillReferenced = nextBlocks.some(
          b => b.type === 'asset' && b.assetId === removed.assetId
        )
        if (!stillReferenced) {
          nextSourceIds = nextSourceIds.filter(id => id !== removed.assetId)
        }
      }
      // If removing a text block, remove its inline text asset
      const nextInlineAssets = { ...state.inlineTextAssets }
      if (removed?.type === 'text') {
        delete nextInlineAssets[blockId]
      }
      return {
        ...state,
        blocks: nextBlocks,
        blockOrder: nextOrder,
        sourceAssetIds: nextSourceIds,
        inlineTextAssets: nextInlineAssets,
        ui: {
          ...state.ui,
          focusedBlockId: state.ui.focusedBlockId === blockId ? null : state.ui.focusedBlockId,
        },
      }
    }

    case 'REORDER_BLOCKS':
      return { ...state, blockOrder: action.payload.blockOrder }

    case 'UPDATE_TEXT_BLOCK': {
      const { blockId, content } = action.payload
      const inlineAsset = buildInlineTextAsset(blockId, content)
      const nextInlineAssets = { ...state.inlineTextAssets }
      if (inlineAsset) {
        nextInlineAssets[blockId] = inlineAsset
      } else {
        delete nextInlineAssets[blockId]
      }
      return {
        ...state,
        blocks: state.blocks.map(b =>
          b.id === blockId && b.type === 'text'
            ? { ...b, content }
            : b
        ),
        inlineTextAssets: nextInlineAssets,
      }
    }

    case 'UPDATE_ASSET_CAPTION':
      return {
        ...state,
        blocks: state.blocks.map(b =>
          b.id === action.payload.blockId && b.type === 'asset'
            ? { ...b, caption: action.payload.caption }
            : b
        ),
      }

    case 'UPDATE_ASSET_EDITOR_CAPTION':
      return {
        ...state,
        blocks: state.blocks.map(b =>
          b.id === action.payload.blockId && b.type === 'asset'
            ? { ...b, editorCaption: action.payload.editorCaption }
            : b
        ),
      }

    // ── Source assets ─────────────────────────────

    case 'ADD_SOURCE_ASSET': {
      if (state.sourceAssetIds.includes(action.payload.assetId)) return state
      return {
        ...state,
        sourceAssetIds: [...state.sourceAssetIds, action.payload.assetId],
      }
    }

    case 'REMOVE_SOURCE_ASSET': {
      const removedId = action.payload.assetId
      // Also remove any asset blocks referencing this asset
      const nextBlocks = state.blocks.filter(
        b => !(b.type === 'asset' && b.assetId === removedId)
      )
      const removedBlockIds = state.blocks
        .filter(b => b.type === 'asset' && b.assetId === removedId)
        .map(b => b.id)
      const nextOrder = state.blockOrder.filter(id => !removedBlockIds.includes(id))
      return {
        ...state,
        sourceAssetIds: state.sourceAssetIds.filter(id => id !== removedId),
        blocks: nextBlocks,
        blockOrder: nextOrder,
        ui: {
          ...state.ui,
          focusedBlockId: removedBlockIds.includes(state.ui.focusedBlockId ?? '')
            ? null
            : state.ui.focusedBlockId,
          focusedAssetId: state.ui.focusedAssetId === removedId
            ? null
            : state.ui.focusedAssetId,
        },
      }
    }

    // ── Split ─────────────────────────────────────

    case 'SET_EDITOR_SHARE': {
      const clamped = Math.max(0.05, Math.min(0.50, action.payload))
      return { ...state, split: { ...state.split, editorShare: clamped } }
    }

    case 'SET_SELF_SOURCE_EXCEPTION':
      return { ...state, split: { ...state.split, selfSourceException: action.payload } }

    // ── Search rail ───────────────────────────────

    case 'SET_SEARCH_QUERY':
      return { ...state, search: { ...state.search, query: action.payload } }

    case 'SET_SEARCH_FORMAT_FILTER':
      return { ...state, search: { ...state.search, formatFilter: action.payload } }

    case 'SET_SEARCH_GEOGRAPHY_FILTER':
      return { ...state, search: { ...state.search, geographyFilter: action.payload } }

    case 'SET_SEARCH_STORY_FILTER':
      return { ...state, search: { ...state.search, storyFilter: action.payload } }

    case 'SET_SEARCH_CREATOR_FILTER':
      return { ...state, search: { ...state.search, creatorFilter: action.payload } }

    case 'SET_SEARCH_DECLARATION_FILTER':
      return { ...state, search: { ...state.search, declarationFilter: action.payload } }

    // ── UI ────────────────────────────────────────

    case 'FOCUS_BLOCK':
      return { ...state, ui: { ...state.ui, focusedBlockId: action.payload } }

    case 'FOCUS_ASSET':
      return { ...state, ui: { ...state.ui, focusedAssetId: action.payload } }

    case 'TOGGLE_INSPECTOR':
      return { ...state, ui: { ...state.ui, inspectorCollapsed: !state.ui.inspectorCollapsed } }

    case 'TOGGLE_SEARCH_RAIL':
      return { ...state, ui: { ...state.ui, searchRailCollapsed: !state.ui.searchRailCollapsed } }

    case 'SET_CONFIRMING_PUBLISH':
      return { ...state, ui: { ...state.ui, confirmingPublish: action.payload } }

    // ── Saved searches ─────────────────────────────

    case 'SAVE_CURRENT_SEARCH': {
      const newSearch: SavedSearch = {
        id: `search-${Date.now()}`,
        label: action.payload.label,
        query: state.search.query,
        formatFilter: state.search.formatFilter,
        alertEnabled: false,
        createdAt: new Date().toISOString(),
      }
      return { ...state, savedSearches: [...state.savedSearches, newSearch] }
    }

    case 'REMOVE_SAVED_SEARCH':
      return {
        ...state,
        savedSearches: state.savedSearches.filter(s => s.id !== action.payload.id),
      }

    case 'TOGGLE_SEARCH_ALERT':
      return {
        ...state,
        savedSearches: state.savedSearches.map(s =>
          s.id === action.payload.id ? { ...s, alertEnabled: !s.alertEnabled } : s
        ),
      }

    case 'APPLY_SAVED_SEARCH': {
      const saved = state.savedSearches.find(s => s.id === action.payload.id)
      if (!saved) return state
      return {
        ...state,
        search: {
          ...state.search,
          query: saved.query,
          formatFilter: saved.formatFilter,
        },
      }
    }

    // ── Block reorder ────────────────────────────────

    case 'MOVE_BLOCK_UP': {
      const idx = state.blockOrder.indexOf(action.payload.blockId)
      if (idx <= 0) return state
      const next = [...state.blockOrder]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return { ...state, blockOrder: next }
    }

    case 'MOVE_BLOCK_DOWN': {
      const idx = state.blockOrder.indexOf(action.payload.blockId)
      if (idx < 0 || idx >= state.blockOrder.length - 1) return state
      const next = [...state.blockOrder]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return { ...state, blockOrder: next }
    }

    // ── Lifecycle ─────────────────────────────────

    case 'SAVE_DRAFT':
      return { ...state, publishState: 'draft', savedAt: new Date().toISOString() }

    case 'PUBLISH':
      return { ...state, publishState: 'pending_review', savedAt: new Date().toISOString() }

    default:
      return state
  }
}
