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

  // ── C2.3 — filter-aware navigation (per IPIII-11) ────────────────
  //
  // The C2.1 placeholder used assetOrder; C2.3 wires
  // getFilteredSortedSearchedAssets so J/K respect the active filter.
  // Setup: three assets [a,b,c], add a search query that matches only
  // 'a.jpg' and 'c.jpg'. Visible scope becomes [a, c]; J from a should
  // skip b and land on c.

  it('NAVIGATE_SIDE_PANEL respects searchQuery filter (skips hidden)', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['alpha.jpg', 'beta.jpg', 'aleph.jpg'].map((filename, i) => ({
        id: `id_${i}`,
        filename,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    // Search 'al' — matches 'alpha.jpg' and 'aleph.jpg', not 'beta.jpg'.
    s = v3Reducer(s, { type: 'SET_SEARCH_QUERY', query: 'al' })
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'id_0' })
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
    // Visible after filter+sort (filename A→Z asc): aleph, alpha → ids id_2, id_0.
    // From id_0 'next' → clamped at last visible = id_0 (still). Test prev instead.
    // Easier: filter setup + test prev/next around a known index.
    // Pick the asserted-on hop based on actual sort. The filename-ascending
    // sort puts 'aleph' before 'alpha', so visible = [id_2, id_0].
    // From id_0 (last), 'next' clamps → id_0; 'prev' → id_2.
    expect(s.ui.sidePanelOpenAssetId).toBe('id_0') // clamped
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'prev' })
    expect(s.ui.sidePanelOpenAssetId).toBe('id_2') // skipped 'beta'
  })

  it('NAVIGATE_SIDE_PANEL with hidden open id starts from first visible', () => {
    // Trap to avoid: getFilteredSortedSearchedAssets matches search query
    // against filename OR title OR tags OR FORMAT. The format string for
    // every asset here is 'photo'. So a search query like 'p' (or 'h', 'o',
    // 't') matches via format and hides nothing — defeating the test.
    // Pick a query letter that is NOT in 'photo'. Letters in 'photo':
    // p, h, o, t. Anything else is safe. Use 'e'.
    //
    // Filename design: 'apple', 'kiwi', 'cherry'. 'kiwi' has no 'e';
    // 'apple' and 'cherry' do. Filename-asc sort: apple, cherry → so
    // visible[0] = id_0 (apple) once 'kiwi' (id_1) is hidden.
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['apple.jpg', 'kiwi.jpg', 'cherry.jpg'].map((filename, i) => ({
        id: `id_${i}`,
        filename,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    // Open kiwi first (no filter, freely accessible).
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'id_1' })
    // Apply filter that hides kiwi (kiwi has no 'e'; 'photo' has no 'e').
    s = v3Reducer(s, { type: 'SET_SEARCH_QUERY', query: 'e' })
    // Visible (filename-asc): apple (id_0), cherry (id_2). kiwi (id_1) hidden.
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
    // Since open id_1 is not in visible, start at visible[0] = id_0 (apple).
    expect(s.ui.sidePanelOpenAssetId).toBe('id_0')
  })

  it('NAVIGATE_SIDE_PANEL is a no-op when no assets match the filter', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['a.jpg'].map(filename => ({
        id: 'a',
        filename,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    s = v3Reducer(s, { type: 'OPEN_SIDE_PANEL', assetId: 'a' })
    s = v3Reducer(s, { type: 'SET_SEARCH_QUERY', query: 'zzzzzz_no_match' })
    const before = s.ui.sidePanelOpenAssetId
    s = v3Reducer(s, { type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
    expect(s.ui.sidePanelOpenAssetId).toBe(before)
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

  // ── C2.3 — UPDATE_ASSET_FIELD shape coverage for SideDetailPanel ──
  //
  // Per C2.3-DIRECTIVE.md option-C extension. SideDetailPanel dispatches
  // UPDATE_ASSET_FIELD for each of: title, description, tags, geography,
  // price, privacy, licences. The reducer is generic on field key, so a
  // type-level guarantee already exists — but verifying that each shape
  // round-trips through the reducer to the expected editable slot
  // catches any future refactor of v3-state.ts that breaks per-field
  // semantics. Belt-and-suspenders for the panel dispatch contract.

  it('UPDATE_ASSET_FIELD: description', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a',
      field: 'description',
      value: 'Caption text',
    })
    expect(s.assetsById.a.editable.description).toBe('Caption text')
  })

  it('UPDATE_ASSET_FIELD: tags (array)', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a',
      field: 'tags',
      value: ['protest', 'climate', 'lisbon'],
    })
    expect(s.assetsById.a.editable.tags).toEqual(['protest', 'climate', 'lisbon'])
  })

  it('UPDATE_ASSET_FIELD: geography (array)', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a',
      field: 'geography',
      value: ['Lisbon', 'Portugal'],
    })
    expect(s.assetsById.a.editable.geography).toEqual(['Lisbon', 'Portugal'])
  })

  it('UPDATE_ASSET_FIELD: price (cents)', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'UPDATE_ASSET_FIELD', assetId: 'a', field: 'price', value: 24000 })
    expect(s.assetsById.a.editable.price).toBe(24000)
    s = v3Reducer(s, { type: 'UPDATE_ASSET_FIELD', assetId: 'a', field: 'price', value: null })
    expect(s.assetsById.a.editable.price).toBeNull()
  })

  it('UPDATE_ASSET_FIELD: privacy', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, { type: 'UPDATE_ASSET_FIELD', assetId: 'a', field: 'privacy', value: 'PUBLIC' })
    expect(s.assetsById.a.editable.privacy).toBe('PUBLIC')
    s = v3Reducer(s, { type: 'UPDATE_ASSET_FIELD', assetId: 'a', field: 'privacy', value: null })
    expect(s.assetsById.a.editable.privacy).toBeNull()
  })

  it('UPDATE_ASSET_FIELD: licences (array)', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    s = v3Reducer(s, {
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a',
      field: 'licences',
      value: ['editorial', 'web'],
    })
    expect(s.assetsById.a.editable.licences).toEqual(['editorial', 'web'])
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

  // ── C2.3 — RESOLVE_CONFLICT shape coverage for SideDetailPanel ──
  //
  // The ConflictResolver inside SideDetailPanel dispatches RESOLVE_CONFLICT
  // with the chosen value (embedded or AI). Verify the handler marks the
  // conflict as resolved-by-creator AND writes the value into the editable
  // field, both in one transition (per v3-state.ts case at line 546).

  it('RESOLVE_CONFLICT marks conflict resolved AND writes editable field', () => {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: [{ id: 'a', filename: 'a.jpg', fileSize: 100, format: 'photo', file: null }],
    })
    // Inject a conflict directly so we can exercise the resolver.
    s = {
      ...s,
      assetsById: {
        ...s.assetsById,
        a: {
          ...s.assetsById.a,
          conflicts: [
            {
              field: 'title',
              embeddedValue: 'IPTC headline',
              aiValue: 'AI suggested title',
              aiConfidence: 0.85,
              resolvedBy: null,
              resolvedValue: null,
            },
          ],
        },
      },
    }
    s = v3Reducer(s, {
      type: 'RESOLVE_CONFLICT',
      assetId: 'a',
      field: 'title',
      value: 'IPTC headline',
    })
    expect(s.assetsById.a.conflicts[0].resolvedBy).toBe('creator')
    expect(s.assetsById.a.conflicts[0].resolvedValue).toBe('IPTC headline')
    expect(s.assetsById.a.editable.title).toBe('IPTC headline')
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

// ── D2.1 — Story cover + sequence + zoom + left rail + compare ───
//
// Per UX-SPEC-V4 §15.4 + D2.1-DIRECTIVE §4. Six new actions; happy-path
// + invariant throws per IPD1-7 default = (a).

describe('D2.1: SET_STORY_COVER', () => {
  function withGroupAndAssets() {
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
    s = v3Reducer(s, { type: 'CREATE_STORY_GROUP', name: 'My story' })
    return s
  }

  it('writes coverAssetId on the named story', () => {
    let s = withGroupAndAssets()
    const groupId = s.storyGroupOrder[0]
    s = v3Reducer(s, { type: 'SET_STORY_COVER', storyGroupId: groupId, assetId: 'a' })
    expect(s.storyGroupsById[groupId].coverAssetId).toBe('a')
  })

  it('clears cover when assetId is null', () => {
    let s = withGroupAndAssets()
    const groupId = s.storyGroupOrder[0]
    s = v3Reducer(s, { type: 'SET_STORY_COVER', storyGroupId: groupId, assetId: 'a' })
    s = v3Reducer(s, { type: 'SET_STORY_COVER', storyGroupId: groupId, assetId: null })
    expect(s.storyGroupsById[groupId].coverAssetId).toBeNull()
  })

  it('THROWS set_story_cover_invalid_group on unknown storyGroupId', () => {
    const s = withGroupAndAssets()
    expect(() =>
      v3Reducer(s, { type: 'SET_STORY_COVER', storyGroupId: 'ghost', assetId: 'a' }),
    ).toThrowError(/set_story_cover_invalid_group/)
  })

  it('THROWS set_story_cover_invalid_asset on unknown assetId', () => {
    const s = withGroupAndAssets()
    const groupId = s.storyGroupOrder[0]
    expect(() =>
      v3Reducer(s, { type: 'SET_STORY_COVER', storyGroupId: groupId, assetId: 'ghost' }),
    ).toThrowError(/set_story_cover_invalid_asset/)
  })
})

describe('D2.1: REORDER_ASSETS_IN_STORY', () => {
  function withGroupContaining(ids: string[]) {
    let s = v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ids.map(id => ({
        id,
        filename: `${id}.jpg`,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
    s = v3Reducer(s, { type: 'CREATE_STORY_GROUP', name: 'My story' })
    const groupId = s.storyGroupOrder[0]
    for (const id of ids) {
      s = v3Reducer(s, { type: 'MOVE_ASSET_TO_CLUSTER', assetId: id, clusterId: groupId })
    }
    // Seed the sequence so REORDER_ASSETS_IN_STORY has membership to compare.
    const group = s.storyGroupsById[groupId]
    s = {
      ...s,
      storyGroupsById: {
        ...s.storyGroupsById,
        [groupId]: { ...group, sequence: [...ids] },
      },
    }
    return { state: s, groupId }
  }

  it('replaces sequence with new order', () => {
    const { state, groupId } = withGroupContaining(['a', 'b', 'c'])
    const s = v3Reducer(state, {
      type: 'REORDER_ASSETS_IN_STORY',
      storyGroupId: groupId,
      sequence: ['c', 'a', 'b'],
    })
    expect(s.storyGroupsById[groupId].sequence).toEqual(['c', 'a', 'b'])
  })

  it('THROWS reorder_assets_invalid_group on unknown storyGroupId', () => {
    const { state } = withGroupContaining(['a', 'b'])
    expect(() =>
      v3Reducer(state, {
        type: 'REORDER_ASSETS_IN_STORY',
        storyGroupId: 'ghost',
        sequence: ['a', 'b'],
      }),
    ).toThrowError(/reorder_assets_invalid_group/)
  })

  it('THROWS reorder_assets_set_mismatch when membership differs', () => {
    const { state, groupId } = withGroupContaining(['a', 'b', 'c'])
    expect(() =>
      v3Reducer(state, {
        type: 'REORDER_ASSETS_IN_STORY',
        storyGroupId: groupId,
        sequence: ['a', 'b'], // missing 'c'
      }),
    ).toThrowError(/reorder_assets_set_mismatch/)
  })
})

describe('D2.1: SET_CONTACT_SHEET_ZOOM', () => {
  it('writes zoom 1-5', () => {
    let s = freshState()
    s = v3Reducer(s, { type: 'SET_CONTACT_SHEET_ZOOM', zoom: 5 })
    expect(s.ui.contactSheetZoom).toBe(5)
    s = v3Reducer(s, { type: 'SET_CONTACT_SHEET_ZOOM', zoom: 1 })
    expect(s.ui.contactSheetZoom).toBe(1)
  })

  it('THROWS set_contact_sheet_zoom_invalid on out-of-range', () => {
    const s = freshState()
    expect(() =>
      v3Reducer(s, { type: 'SET_CONTACT_SHEET_ZOOM', zoom: 0 as never }),
    ).toThrowError(/set_contact_sheet_zoom_invalid/)
    expect(() =>
      v3Reducer(s, { type: 'SET_CONTACT_SHEET_ZOOM', zoom: 6 as never }),
    ).toThrowError(/set_contact_sheet_zoom_invalid/)
  })
})

describe('D2.1: TOGGLE_LEFT_RAIL_COLLAPSED', () => {
  it('flips the collapsed state', () => {
    let s = freshState()
    expect(s.ui.leftRailCollapsed).toBe(false)
    s = v3Reducer(s, { type: 'TOGGLE_LEFT_RAIL_COLLAPSED' })
    expect(s.ui.leftRailCollapsed).toBe(true)
    s = v3Reducer(s, { type: 'TOGGLE_LEFT_RAIL_COLLAPSED' })
    expect(s.ui.leftRailCollapsed).toBe(false)
  })
})

describe('D2.1: ENTER_COMPARE_MODE / EXIT_COMPARE_MODE', () => {
  function withTwoAssets() {
    return v3Reducer(freshState(), {
      type: 'ADD_FILES',
      files: ['a', 'b'].map(id => ({
        id,
        filename: `${id}.jpg`,
        fileSize: 100,
        format: 'photo' as const,
        file: null,
      })),
    })
  }

  it('writes compareAssetIds for length-2', () => {
    const s = v3Reducer(withTwoAssets(), {
      type: 'ENTER_COMPARE_MODE',
      assetIds: ['a', 'b'],
    })
    expect(s.ui.compareAssetIds).toEqual(['a', 'b'])
  })

  it('THROWS compare_invalid_count when length !== 2 (per IPV4-3 = a strict 2-only)', () => {
    const s = withTwoAssets()
    expect(() => v3Reducer(s, { type: 'ENTER_COMPARE_MODE', assetIds: ['a'] })).toThrowError(
      /compare_invalid_count/,
    )
    expect(() =>
      v3Reducer(s, { type: 'ENTER_COMPARE_MODE', assetIds: ['a', 'b', 'c' as never] }),
    ).toThrowError(/compare_invalid_count/)
  })

  it('THROWS compare_invalid_asset on unknown id', () => {
    const s = withTwoAssets()
    expect(() =>
      v3Reducer(s, { type: 'ENTER_COMPARE_MODE', assetIds: ['a', 'ghost'] }),
    ).toThrowError(/compare_invalid_asset/)
  })

  it('EXIT_COMPARE_MODE clears compareAssetIds', () => {
    let s = v3Reducer(withTwoAssets(), {
      type: 'ENTER_COMPARE_MODE',
      assetIds: ['a', 'b'],
    })
    s = v3Reducer(s, { type: 'EXIT_COMPARE_MODE' })
    expect(s.ui.compareAssetIds).toEqual([])
  })

  it('EXIT_COMPARE_MODE is idempotent (no throw on already-empty)', () => {
    const s = freshState()
    expect(() => v3Reducer(s, { type: 'EXIT_COMPARE_MODE' })).not.toThrow()
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

  // D2.2 IPD2-14: SET_FILTER_PRESET also clears storyGroupId.
  // Intent: clicking a category chip means "filter by category, not by
  // story". User re-applies story filter by clicking a story header in
  // the left rail (which dispatches SET_FILTER { storyGroupId }).
  it('SET_FILTER_PRESET clears storyGroupId (D2.2 IPD2-14)', () => {
    let s = freshState()
    // Seed: pretend user previously selected a story bucket.
    s = {
      ...s,
      ui: { ...s.ui, filter: { ...s.ui.filter, storyGroupId: 'g-prev' } },
    }
    expect(s.ui.filter.storyGroupId).toBe('g-prev')

    s = v3Reducer(s, { type: 'SET_FILTER_PRESET', preset: 'all' })
    expect(s.ui.filter.preset).toBe('all')
    expect(s.ui.filter.storyGroupId).toBeNull()
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
