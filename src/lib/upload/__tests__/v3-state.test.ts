/**
 * Frontfiles Upload V3 — Reducer Action Coverage Tests
 *
 * Spec: C2.1-DIRECTIVE §3.1 + §6.
 *
 * Covers every new V3 action in §5.3 of C2-PLAN with at least one
 * happy-path transition test, plus invariant tests for the strict
 * reducer guards (per IPI-2 + founder nuance: error messages must
 * be action-contract-specific so failures point at the broken contract).
 *
 * The most safety-critical assertion: BULK_ACCEPT_PROPOSALS_*.fields
 * containing 'price' MUST throw bulk_accept_price_forbidden per
 * UX-SPEC-V3 §9.2 + UX-BRIEF v3 §4.4 + PRICE-ENGINE-BRIEF v3 §11.16.
 */

import { describe, it, expect } from 'vitest'
import { v3InitialState, v3Reducer } from '../v3-state'
import { densityForCount } from '../v3-types'
import type { V3State, V3Action, V3ClusterProposalState } from '../v3-types'

const BATCH_ID = 'batch_test_001'

function freshState(): V3State {
  return v3InitialState(BATCH_ID)
}

// ── Initial state ────────────────────────────────────────────────

describe('v3InitialState', () => {
  it('produces an empty batch state', () => {
    const s = freshState()
    expect(s.batch.id).toBe(BATCH_ID)
    expect(s.assetOrder).toEqual([])
    expect(Object.keys(s.assetsById)).toEqual([])
    expect(s.storyGroupOrder).toEqual([])
    expect(s.commit.phase).toBe('idle')
    expect(s.aiClusterProposals).toEqual([])
  })

  it('does NOT carry currentStage or other stage-era fields', () => {
    const s = freshState()
    expect((s.batch as Record<string, unknown>).currentStage).toBeUndefined()
    expect((s.ui as Record<string, unknown>).expressEligible).toBeUndefined()
    expect((s.ui as Record<string, unknown>).reviewEnteredEarly).toBeUndefined()
  })
})

// ── Density derivation ───────────────────────────────────────────

describe('densityForCount', () => {
  it('Linear at 1-5', () => {
    for (const n of [1, 2, 5]) expect(densityForCount(n)).toBe('linear')
  })
  it('Compact at 6-19', () => {
    for (const n of [6, 10, 19]) expect(densityForCount(n)).toBe('compact')
  })
  it('Batch at 20-99', () => {
    for (const n of [20, 50, 99]) expect(densityForCount(n)).toBe('batch')
  })
  it('Archive at 100+', () => {
    for (const n of [100, 500, 2000]) expect(densityForCount(n)).toBe('archive')
  })
  it('density auto-transitions across thresholds (Linear → Compact at 6)', () => {
    expect(densityForCount(5)).toBe('linear')
    expect(densityForCount(6)).toBe('compact')
  })
})

// ── File ingestion ───────────────────────────────────────────────

describe('ADD_FILES / REMOVE_FILE', () => {
  it('ADD_FILES creates assets in order', () => {
    const s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [
        { id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null },
        { id: 'b', filename: 'b.jpg', fileSize: 200, format: 'photo', file: null },
      ],
    })
    expect(s.assetOrder).toEqual(['a', 'b'])
    expect(s.assetsById.a.filename).toBe('a.jpg')
    expect(s.assetsById.b.filename).toBe('b.jpg')
    expect(s.assetsById.a.editable.privacy).toBeNull()
    expect(s.assetsById.a.excluded).toBe(false)
  })

  it('REMOVE_FILE removes from assetsById and assetOrder', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [
        { id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null },
        { id: 'b', filename: 'b.jpg', fileSize: 200, format: 'photo', file: null },
      ],
    })
    s = v3Reducer(s, { type: 'REMOVE_FILE', assetId: 'a' })
    expect(s.assetOrder).toEqual(['b'])
    expect(s.assetsById.a).toBeUndefined()
  })

  it('REMOVE_FILE clears side-panel selection if it was that asset', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'a' })
    s = v3Reducer(s, { type: 'REMOVE_FILE', assetId: 'a' })
    expect(s.ui.sidePanelOpenAssetId).toBeNull()
  })
})

// ── Selection ────────────────────────────────────────────────────

describe('selection actions', () => {
  function withTwoAssets(): V3State {
    return v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [
        { id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null },
        { id: 'b', filename: 'b.jpg', fileSize: 200, format: 'photo', file: null },
      ],
    })
  }

  it('SELECT_ASSET replaces selection with single id', () => {
    let s = withTwoAssets()
    s = v3Reducer(s, { type: 'SELECT_ASSET', assetId: 'a' })
    expect(s.ui.selectedAssetIds).toEqual(['a'])
  })

  it('TOGGLE_ASSET_SELECTION adds and removes', () => {
    let s = withTwoAssets()
    s = v3Reducer(s, { type: 'TOGGLE_ASSET_SELECTION', assetId: 'a' })
    expect(s.ui.selectedAssetIds).toEqual(['a'])
    s = v3Reducer(s, { type: 'TOGGLE_ASSET_SELECTION', assetId: 'a' })
    expect(s.ui.selectedAssetIds).toEqual([])
  })

  it('SELECT_RANGE selects inclusive range from order', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['a', 'b', 'c', 'd'].map(id => ({
        id,
        filename: `${id}.jpg`,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    s = v3Reducer(s, { type: 'SELECT_RANGE', fromAssetId: 'b', toAssetId: 'c' })
    expect(s.ui.selectedAssetIds).toEqual(['b', 'c'])
  })
})

// ── Side panel ───────────────────────────────────────────────────

describe('side panel actions', () => {
  it('OPEN/CLOSE_SIDE_PANEL toggles sidePanelOpenAssetId', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'a' })
    expect(s.ui.sidePanelOpenAssetId).toBe('a')
    s = v3Reducer(s, { type: 'CLOSE_SIDE_PANEL' })
    expect(s.ui.sidePanelOpenAssetId).toBeNull()
  })

  it('NAVIGATE_SIDE_PANEL moves to next/prev within order', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['a', 'b', 'c'].map(id => ({
        id,
        filename: `${id}.jpg`,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'a' })
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
    expect(s.ui.sidePanelOpenAssetId).toBe('b')
    expect(s.ui.selectedAssetIds).toEqual(['b'])
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'prev' })
    expect(s.ui.sidePanelOpenAssetId).toBe('a')
  })
})

// ── UI toggles ───────────────────────────────────────────────────

describe('UI toggle actions', () => {
  it('TOGGLE_SESSION_DEFAULTS_BAR flips state', () => {
    let s = freshState()
    expect(s.ui.sessionDefaultsBarCollapsed).toBe(false)
    s = v3Reducer(s, { type: 'TOGGLE_SESSION_DEFAULTS_BAR' })
    expect(s.ui.sessionDefaultsBarCollapsed).toBe(true)
  })

  it('TOGGLE_FLAT_LIST_OVERRIDE flips state', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'TOGGLE_FLAT_LIST_OVERRIDE' })
    expect(s.ui.flatListOverride).toBe(true)
  })

  it('TOGGLE_BULK_OPS_BAR flips state', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'TOGGLE_BULK_OPS_BAR' })
    expect(s.ui.bulkOpsBarOpen).toBe(true)
  })

  it('TOGGLE_STORY_GROUP_OVERLAY flips state', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'TOGGLE_STORY_GROUP_OVERLAY' })
    expect(s.ui.storyGroupOverlayOn).toBe(true)
  })
})

// ── Story group manual operations ────────────────────────────────

describe('story group operations', () => {
  it('CREATE_STORY_GROUP adds a creator-kind group', () => {
    const s = v3Reducer(freshState(), { type: 'CREATE_STORY_GROUP', name: 'Carnival 2026' })
    expect(s.storyGroupOrder.length).toBe(1)
    const groupId = s.storyGroupOrder[0]
    expect(s.storyGroupsById[groupId].name).toBe('Carnival 2026')
    expect(s.storyGroupsById[groupId].kind).toBe('creator')
  })

  it('MOVE_ASSET_TO_CLUSTER throws on invalid clusterId', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    expect(() =>
      v3Reducer(s, { type: 'MOVE_ASSET_TO_CLUSTER', assetId: 'a', clusterId: 'no-such-cluster' }),
    ).toThrowError(/move_asset_to_cluster_invalid/)
  })

  it('MOVE_ASSET_TO_CLUSTER + MOVE_ASSET_TO_UNGROUPED round-trips', () => {
    let s = v3Reducer(freshState(), { type: 'CREATE_STORY_GROUP', name: 'g1' })
    const groupId = s.storyGroupOrder[0]
    s = v3Reducer(s, {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'MOVE_ASSET_TO_CLUSTER', assetId: 'a', clusterId: groupId })
    expect(s.assetsById.a.storyGroupId).toBe(groupId)
    s = v3Reducer(s, { type: 'MOVE_ASSET_TO_UNGROUPED', assetId: 'a' })
    expect(s.assetsById.a.storyGroupId).toBeNull()
  })

  it('DELETE_STORY_GROUP moves contained assets to ungrouped', () => {
    let s = v3Reducer(freshState(), { type: 'CREATE_STORY_GROUP', name: 'g1' })
    const groupId = s.storyGroupOrder[0]
    s = v3Reducer(s, {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'MOVE_ASSET_TO_CLUSTER', assetId: 'a', clusterId: groupId })
    s = v3Reducer(s, { type: 'DELETE_STORY_GROUP', storyGroupId: groupId })
    expect(s.storyGroupOrder).toEqual([])
    expect(s.assetsById.a.storyGroupId).toBeNull()
  })

  it('TOGGLE_CLUSTER_EXPANDED toggles membership', () => {
    let s = v3Reducer(freshState(), { type: 'TOGGLE_CLUSTER_EXPANDED', clusterId: 'c1' })
    expect(s.ui.expandedClusterIds).toEqual(['c1'])
    s = v3Reducer(s, { type: 'TOGGLE_CLUSTER_EXPANDED', clusterId: 'c1' })
    expect(s.ui.expandedClusterIds).toEqual([])
  })
})

// ── Asset field editing ──────────────────────────────────────────

describe('asset field editing', () => {
  it('UPDATE_ASSET_FIELD writes to editable map', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'UPDATE_ASSET_FIELD', assetId: 'a', field: 'title', value: 'Hello' })
    expect(s.assetsById.a.editable.title).toBe('Hello')
  })

  it('TOGGLE_ASSET_EXCLUDED flips excluded', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    expect(s.assetsById.a.excluded).toBe(false)
    s = v3Reducer(s, { type: 'TOGGLE_ASSET_EXCLUDED', assetId: 'a' })
    expect(s.assetsById.a.excluded).toBe(true)
  })
})

// ── AI proposal acceptance — THE SAFETY-CRITICAL TEST ────────────

describe('AI proposal acceptance — bulk-accept-price forbidden', () => {
  it('BULK_ACCEPT_PROPOSALS_FOR_GROUP with "price" in fields THROWS', () => {
    const s = freshState()
    expect(() =>
      v3Reducer(s, {
        type: 'BULK_ACCEPT_PROPOSALS_FOR_GROUP',
        clusterId: 'g1',
        fields: ['caption', 'price' as never], // type-erased call
      } as V3Action),
    ).toThrowError(/bulk_accept_price_forbidden/)
  })

  it('BULK_ACCEPT_PROPOSALS_FOR_SELECTION with "price" in fields THROWS', () => {
    const s = freshState()
    expect(() =>
      v3Reducer(s, {
        type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
        assetIds: ['a'],
        fields: ['price' as never],
      } as V3Action),
    ).toThrowError(/bulk_accept_price_forbidden/)
  })

  it('BULK_ACCEPT_PROPOSALS_FOR_GROUP with valid fields is a no-op (per IP-5)', () => {
    const s = freshState()
    const next = v3Reducer(s, {
      type: 'BULK_ACCEPT_PROPOSALS_FOR_GROUP',
      clusterId: 'g1',
      fields: ['caption', 'tags'],
    })
    expect(next).toEqual(s)
  })

  it('ACCEPT_PROPOSAL is a no-op (per IPI-1 telemetry-hook posture)', () => {
    const s = freshState()
    const next = v3Reducer(s, { type: 'ACCEPT_PROPOSAL', assetId: 'a', field: 'caption' })
    expect(next).toEqual(s)
  })
})

// ── AI cluster proposal banners ──────────────────────────────────

describe('AI cluster proposal banner actions', () => {
  function makeProposal(): V3ClusterProposalState {
    return {
      proposalId: 'p1',
      clusterName: 'Carnival 2026',
      proposedAssetIds: ['a', 'b'],
      rationale: 'Visual + temporal cluster',
      confidence: 0.85,
      status: 'pending',
    }
  }

  it('RECEIVE_AI_CLUSTER_PROPOSAL appends to list', () => {
    const s = v3Reducer(freshState(), {
      type: 'RECEIVE_AI_CLUSTER_PROPOSAL',
      proposal: makeProposal(),
    })
    expect(s.aiClusterProposals.length).toBe(1)
    expect(s.aiClusterProposals[0].proposalId).toBe('p1')
  })

  it('ACCEPT_AI_CLUSTER_PROPOSAL creates a story group + assigns assets', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['a', 'b'].map(id => ({
        id,
        filename: `${id}.jpg`,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    s = v3Reducer(s, { type: 'RECEIVE_AI_CLUSTER_PROPOSAL', proposal: makeProposal() })
    s = v3Reducer(s, { type: 'ACCEPT_AI_CLUSTER_PROPOSAL', proposalId: 'p1' })
    expect(s.storyGroupOrder.length).toBe(1)
    const groupId = s.storyGroupOrder[0]
    expect(s.storyGroupsById[groupId].kind).toBe('proposed')
    expect(s.assetsById.a.storyGroupId).toBe(groupId)
    expect(s.assetsById.b.storyGroupId).toBe(groupId)
    expect(s.aiClusterProposals[0].status).toBe('accepted')
  })

  it('DISMISS_AI_CLUSTER_PROPOSAL marks status dismissed', () => {
    let s = v3Reducer(freshState(), {
      type: 'RECEIVE_AI_CLUSTER_PROPOSAL',
      proposal: makeProposal(),
    })
    s = v3Reducer(s, { type: 'DISMISS_AI_CLUSTER_PROPOSAL', proposalId: 'p1' })
    expect(s.aiClusterProposals[0].status).toBe('dismissed')
  })

  it('ACCEPT_AI_CLUSTER_PROPOSAL with unknown id THROWS', () => {
    expect(() =>
      v3Reducer(freshState(), { type: 'ACCEPT_AI_CLUSTER_PROPOSAL', proposalId: 'nonexistent' }),
    ).toThrowError(/accept_ai_cluster_proposal_invalid/)
  })
})

// ── Duplicate resolution ─────────────────────────────────────────

describe('RESOLVE_DUPLICATE', () => {
  it('keep_both clears duplicate status', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'UPDATE_ANALYSIS_RESULT',
      assetId: 'a',
      proposal: {
        title: '', description: '', tags: [], geography: [],
        priceSuggestion: null, privacySuggestion: null, licenceSuggestions: [],
        confidence: 0.9, rationale: '', storyCandidates: [],
      },
      declarationState: 'provenance_pending',
      duplicateStatus: 'likely_duplicate',
      duplicateOfId: 'b',
    })
    expect(s.assetsById.a.duplicateStatus).toBe('likely_duplicate')
    s = v3Reducer(s, {
      type: 'RESOLVE_DUPLICATE',
      assetId: 'a',
      kind: 'keep_both',
      otherAssetId: 'b',
    })
    expect(s.assetsById.a.duplicateStatus).toBe('none')
    expect(s.assetsById.a.duplicateOfId).toBeNull()
  })

  it('mark_as_duplicate sets confirmed_duplicate + excludes', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'RESOLVE_DUPLICATE',
      assetId: 'a',
      kind: 'mark_as_duplicate',
      otherAssetId: 'b',
    })
    expect(s.assetsById.a.duplicateStatus).toBe('confirmed_duplicate')
    expect(s.assetsById.a.duplicateOfId).toBe('b')
    expect(s.assetsById.a.excluded).toBe(true)
  })
})

// ── Commit flow state machine ────────────────────────────────────

describe('commit flow state machine', () => {
  it('idle → summary → idle (cancel)', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'BEGIN_COMMIT' })
    expect(s.commit.phase).toBe('summary')
    s = v3Reducer(s, { type: 'CANCEL_COMMIT' })
    expect(s.commit.phase).toBe('idle')
  })

  it('idle → summary → committing → success', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'BEGIN_COMMIT' })
    s = v3Reducer(s, { type: 'CONFIRM_COMMIT' })
    expect(s.commit.phase).toBe('committing')
    s = v3Reducer(s, { type: 'COMMIT_SUCCEEDED' })
    expect(s.commit.phase).toBe('success')
  })

  it('CANCEL_COMMIT outside summary phase THROWS with phase detail', () => {
    expect(() => v3Reducer(freshState(), { type: 'CANCEL_COMMIT' })).toThrowError(
      /cancel_commit_invalid.*idle/,
    )
  })

  it('CONFIRM_COMMIT outside summary phase THROWS', () => {
    expect(() => v3Reducer(freshState(), { type: 'CONFIRM_COMMIT' })).toThrowError(
      /confirm_commit_invalid/,
    )
  })

  it('partial-failure → committing (retry) → success', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'BEGIN_COMMIT' })
    s = v3Reducer(s, { type: 'CONFIRM_COMMIT' })
    s = v3Reducer(s, {
      type: 'COMMIT_PARTIALLY_FAILED',
      failed: [{ assetId: 'a', error: 'storage' }],
    })
    expect(s.commit.phase).toBe('partial-failure')
    expect(s.commit.failed).toHaveLength(1)
    s = v3Reducer(s, { type: 'RETRY_FAILED_COMMITS' })
    expect(s.commit.phase).toBe('committing')
    expect(s.commit.failed).toEqual([])
  })

  it('COMMIT_PROGRESS_UPDATE updates per-asset progress map', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'BEGIN_COMMIT' })
    s = v3Reducer(s, { type: 'CONFIRM_COMMIT' })
    s = v3Reducer(s, { type: 'COMMIT_PROGRESS_UPDATE', assetId: 'a', progress: 50 })
    expect(s.commit.perAssetProgress.a).toBe(50)
  })
})

// ── Reset ────────────────────────────────────────────────────────

describe('RESET_FLOW', () => {
  it('returns initial state preserving batch.id', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'BEGIN_COMMIT' })
    s = v3Reducer(s, { type: 'RESET_FLOW' })
    expect(s.batch.id).toBe(BATCH_ID)
    expect(s.assetOrder).toEqual([])
    expect(s.commit.phase).toBe('idle')
  })
})

// ── Filter / sort / search ───────────────────────────────────────

describe('filter / sort / search actions', () => {
  it('SET_FILTER_PRESET writes preset', () => {
    const s = v3Reducer(freshState(), { type: 'SET_FILTER_PRESET', preset: 'blocking' })
    expect(s.ui.filter.preset).toBe('blocking')
  })

  it('SET_SORT writes field+direction', () => {
    const s = v3Reducer(freshState(), { type: 'SET_SORT', field: 'price', direction: 'desc' })
    expect(s.ui.sortField).toBe('price')
    expect(s.ui.sortDirection).toBe('desc')
  })

  it('SET_SEARCH_QUERY writes query', () => {
    const s = v3Reducer(freshState(), { type: 'SET_SEARCH_QUERY', query: 'lisbon' })
    expect(s.ui.searchQuery).toBe('lisbon')
  })

  it('SET_DEFAULTS merges defaults', () => {
    const s = v3Reducer(freshState(), {
      type: 'SET_DEFAULTS',
      defaults: { privacy: 'PUBLIC' },
    })
    expect(s.defaults.privacy).toBe('PUBLIC')
  })
})

// ── Price basis panel ────────────────────────────────────────────

describe('TOGGLE_PRICE_BASIS_PANEL', () => {
  it('opens for new asset, closes when same asset re-toggled', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: 'a' })
    expect(s.ui.priceBasisOpenAssetId).toBe('a')
    s = v3Reducer(s, { type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: 'a' })
    expect(s.ui.priceBasisOpenAssetId).toBeNull()
  })

  it('switches to different asset on toggle', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: 'a' })
    s = v3Reducer(s, { type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: 'b' })
    expect(s.ui.priceBasisOpenAssetId).toBe('b')
  })
})
