/**
 * Frontfiles Upload — upload-selectors test
 *
 * Focused coverage for the NEW selector added in C2.2:
 * `getFilteredSortedSearchedAssets`.
 *
 * The other selectors in upload-selectors.ts are mechanical extractions
 * from v2-state.ts (covered by v3-state-parity.test.ts and the existing
 * v2-state.ts test surface).
 */

import { describe, it, expect } from 'vitest'
import {
  getFilteredSortedSearchedAssets,
  getCommitBarSummaryText,
  getLayoutState,
  getStoryCover,
  type FilterableView,
  type PublishReadinessResult,
} from '../upload-selectors'
import type { V2Asset, V2StoryGroup } from '../v2-types'

function makeAsset(overrides: Partial<V2Asset> & { id: string; filename: string }): V2Asset {
  return {
    id: overrides.id,
    filename: overrides.filename,
    fileSize: overrides.fileSize ?? 1000,
    format: overrides.format ?? 'photo',
    file: null,
    thumbnailRef: null,
    excluded: overrides.excluded ?? false,
    storyGroupId: overrides.storyGroupId ?? null,
    proposal: overrides.proposal ?? null,
    editable: {
      title: overrides.editable?.title ?? '',
      description: overrides.editable?.description ?? '',
      tags: overrides.editable?.tags ?? [],
      geography: overrides.editable?.geography ?? [],
      captureDate: overrides.editable?.captureDate ?? null,
      privacy: overrides.editable?.privacy ?? null,
      licences: overrides.editable?.licences ?? [],
      price: overrides.editable?.price ?? null,
      socialLicensable: overrides.editable?.socialLicensable ?? false,
      metadataSource: overrides.editable?.metadataSource ?? {},
    },
    conflicts: overrides.conflicts ?? [],
    extractedMetadata: null,
    declarationState: overrides.declarationState ?? null,
    duplicateStatus: overrides.duplicateStatus ?? 'none',
    duplicateOfId: null,
    analysisStatus: overrides.analysisStatus ?? 'complete',
    uploadProgress: 100,
    existingStoryMatch: null,
    createdAt: '2026-01-01T00:00:00Z',
    committedAt: null,
  }
}

function buildView(assets: V2Asset[], overrides?: Partial<FilterableView>): FilterableView {
  const assetsById: Record<string, V2Asset> = {}
  for (const a of assets) assetsById[a.id] = a
  return {
    assetsById,
    assetOrder: assets.map(a => a.id),
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
    ...overrides,
  }
}

describe('getFilteredSortedSearchedAssets', () => {
  it('returns all assets when filter=all and no search', () => {
    const assets = [
      makeAsset({ id: 'a', filename: 'b.jpg' }),
      makeAsset({ id: 'b', filename: 'a.jpg' }),
    ]
    const view = buildView(assets)
    const result = getFilteredSortedSearchedAssets(view)
    // Sorted by filename asc by default
    expect(result.map(a => a.id)).toEqual(['b', 'a'])
  })

  it('search filters by filename, title, tags, format', () => {
    const assets = [
      makeAsset({ id: 'a', filename: 'lisbon.jpg' }),
      makeAsset({ id: 'b', filename: 'porto.jpg', editable: { title: 'lisbon party' } as never }),
      makeAsset({ id: 'c', filename: 'unrelated.jpg', editable: { tags: ['lisbon'] } as never }),
      makeAsset({ id: 'd', filename: 'no-match.jpg' }),
    ]
    const view = buildView(assets, { searchQuery: 'lisbon' })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('filter preset "ready" returns only complete + non-blocking + non-excluded', () => {
    // Note: the extracted selector preserves V2 behavior — `needs_story`
    // is still emitted as a blocking exception when storyGroupId is null.
    // The V3 UI drops it from chip rendering per UX-BRIEF v3 §4.5, but
    // the selector returns it unchanged. So a "ready" asset in this test
    // must have a non-null storyGroupId.
    const assets = [
      makeAsset({
        id: 'ready',
        filename: 'r.jpg',
        storyGroupId: 'g-1',
        editable: {
          title: 't', privacy: 'PRIVATE', licences: [], price: null, description: '', tags: [],
          geography: [], captureDate: null, socialLicensable: false, metadataSource: {},
        },
      }),
      makeAsset({
        id: 'blocked',
        filename: 'b.jpg',
        editable: {
          title: '', privacy: null, licences: [], price: null, description: '', tags: [],
          geography: [], captureDate: null, socialLicensable: false, metadataSource: {},
        },
      }),
      makeAsset({ id: 'excluded', filename: 'x.jpg', excluded: true }),
    ]
    const view = buildView(assets, { filter: { ...buildView(assets).filter, preset: 'ready' } })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id)).toEqual(['ready'])
  })

  it('filter preset "duplicates" includes all duplicateStatus !== none', () => {
    const assets = [
      makeAsset({ id: 'no', filename: 'no.jpg' }),
      makeAsset({ id: 'lk', filename: 'lk.jpg', duplicateStatus: 'likely_duplicate' }),
      makeAsset({ id: 'co', filename: 'co.jpg', duplicateStatus: 'confirmed_duplicate' }),
    ]
    const view = buildView(assets, { filter: { ...buildView(assets).filter, preset: 'duplicates' } })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id).sort()).toEqual(['co', 'lk'])
  })

  it('sorts by filename desc when direction=desc', () => {
    const assets = [
      makeAsset({ id: 'a', filename: 'a.jpg' }),
      makeAsset({ id: 'c', filename: 'c.jpg' }),
      makeAsset({ id: 'b', filename: 'b.jpg' }),
    ]
    const view = buildView(assets, { sortField: 'filename', sortDirection: 'desc' })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by file size descending', () => {
    const assets = [
      makeAsset({ id: 'small', filename: 's.jpg', fileSize: 100 }),
      makeAsset({ id: 'big', filename: 'b.jpg', fileSize: 10000 }),
      makeAsset({ id: 'med', filename: 'm.jpg', fileSize: 1000 }),
    ]
    const view = buildView(assets, { sortField: 'size', sortDirection: 'desc' })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id)).toEqual(['big', 'med', 'small'])
  })

  it('combines filter + sort + search', () => {
    const assets = [
      makeAsset({ id: 'a', filename: 'lisbon-1.jpg', excluded: true }),
      makeAsset({ id: 'b', filename: 'lisbon-2.jpg', fileSize: 5000 }),
      makeAsset({ id: 'c', filename: 'lisbon-3.jpg', fileSize: 1000 }),
      makeAsset({ id: 'd', filename: 'unrelated.jpg' }),
    ]
    const view = buildView(assets, {
      searchQuery: 'lisbon',
      filter: { ...buildView(assets).filter, preset: 'all' },
      sortField: 'size',
      sortDirection: 'desc',
    })
    const result = getFilteredSortedSearchedAssets(view)
    // Excluded NOT filtered out by preset='all' (only 'excluded' preset filters); search by 'lisbon'
    // Result: a, b, c — sorted by size desc → b (5000), c (1000), a (default 1000)
    expect(result.map(a => a.id).slice(0, 1)).toEqual(['b'])
    expect(result.length).toBe(3)
  })

  it('format filter narrows by AssetFormat', () => {
    const assets = [
      makeAsset({ id: 'p1', filename: 'p1.jpg', format: 'photo' }),
      makeAsset({ id: 'v1', filename: 'v1.mp4', format: 'video' }),
      makeAsset({ id: 'p2', filename: 'p2.jpg', format: 'photo' }),
    ]
    const view = buildView(assets, { filter: { ...buildView(assets).filter, format: 'video' } })
    const result = getFilteredSortedSearchedAssets(view)
    expect(result.map(a => a.id)).toEqual(['v1'])
  })
})

// ── C2.4 — getCommitBarSummaryText ───────────────────────────────────
//
// Per UX-SPEC-V3 §10.2 mapping table. Five cases, one per row of the
// table. The selector takes a PublishReadinessResult; we construct one
// inline (pure function — no need to walk assets to test the mapping).
//
// Precedence order (highest first):
//   1. blockedCount === 0          → ''
//   2. >50% of included blocked    → 'Most assets need attention'
//   3. single blocker type         → '{N} {needs|need} {label}'
//   4. multiple blocker types      → '{blockedCount} issues to resolve'

function buildReadiness(overrides: Partial<PublishReadinessResult>): PublishReadinessResult {
  return {
    ready: true,
    blockerSummary: [],
    readyCount: 0,
    blockedCount: 0,
    advisoryCount: 0,
    excludedCount: 0,
    blockerCounts: {},
    includedCount: 0,
    ...overrides,
  }
}

describe('getCommitBarSummaryText', () => {
  it('returns empty string when blockedCount is zero (all ready)', () => {
    const r = buildReadiness({ readyCount: 5, blockedCount: 0, includedCount: 5 })
    expect(getCommitBarSummaryText(r)).toBe('')
  })

  it('returns singular "needs" for one asset blocked by one type', () => {
    const r = buildReadiness({
      readyCount: 4,
      blockedCount: 1,
      includedCount: 5,
      blockerCounts: { needs_price: 1 },
    })
    expect(getCommitBarSummaryText(r)).toBe('1 needs price set')
  })

  it('returns plural "need" for multiple assets blocked by one type', () => {
    const r = buildReadiness({
      readyCount: 7,
      blockedCount: 3,
      includedCount: 10,
      blockerCounts: { needs_price: 3 },
    })
    expect(getCommitBarSummaryText(r)).toBe('3 need price set')
  })

  it('returns "{N} issues to resolve" for multiple blocker types', () => {
    const r = buildReadiness({
      readyCount: 5,
      blockedCount: 5,
      includedCount: 10,
      blockerCounts: { needs_price: 2, needs_privacy: 3 },
    })
    expect(getCommitBarSummaryText(r)).toBe('5 issues to resolve')
  })

  it('returns "Most assets need attention" when >50% of included are blocked', () => {
    const r = buildReadiness({
      readyCount: 4,
      blockedCount: 6, // 60% of 10
      includedCount: 10,
      blockerCounts: { needs_price: 4, needs_privacy: 2 },
    })
    expect(getCommitBarSummaryText(r)).toBe('Most assets need attention')
  })

  it('critical override takes precedence over single-type pattern', () => {
    // 9 of 10 blocked by ONE type — would otherwise return "9 need price set",
    // but >50% kicks in first.
    const r = buildReadiness({
      readyCount: 1,
      blockedCount: 9,
      includedCount: 10,
      blockerCounts: { needs_price: 9 },
    })
    expect(getCommitBarSummaryText(r)).toBe('Most assets need attention')
  })
})

// ── D2.1 — getLayoutState ────────────────────────────────────────
//
// Per UX-SPEC-V4 §2 + IPD1-5 default = (a) string union return.
// Three states: 'empty' / 'workspace' / 'comparing'.

describe('getLayoutState', () => {
  it('returns "empty" when assetOrder.length === 0', () => {
    const view = { assetsById: {}, assetOrder: [] }
    expect(getLayoutState(view)).toBe('empty')
  })

  it('returns "workspace" when assetOrder has assets and not comparing', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const view = { assetsById: { a }, assetOrder: ['a'] }
    expect(getLayoutState(view)).toBe('workspace')
  })

  it('returns "comparing" when compareAssetIds.length === 2', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const b = makeAsset({ id: 'b', filename: 'b.jpg' })
    const view = {
      assetsById: { a, b },
      assetOrder: ['a', 'b'],
      compareAssetIds: ['a', 'b'],
    }
    expect(getLayoutState(view)).toBe('comparing')
  })

  it('returns "workspace" (not "comparing") when compareAssetIds is length 1', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const view = {
      assetsById: { a },
      assetOrder: ['a'],
      compareAssetIds: ['a'],
    }
    expect(getLayoutState(view)).toBe('workspace')
  })
})

// ── D2.1 — getStoryCover ─────────────────────────────────────────

describe('getStoryCover', () => {
  function makeStory(overrides: Partial<V2StoryGroup> = {}): V2StoryGroup {
    return {
      id: 'g1',
      name: 'Test',
      kind: 'creator',
      proposedAssetIds: ['a', 'b'],
      existingStoryId: null,
      existingStoryTitle: null,
      existingStoryAssetCount: null,
      rationale: '',
      confidence: 0,
      createdAt: '2026-01-01T00:00:00Z',
      coverAssetId: null,
      sequence: ['a', 'b'],
      ...overrides,
    }
  }

  it('returns the explicit coverAssetId asset when set and present', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const b = makeAsset({ id: 'b', filename: 'b.jpg' })
    const group = makeStory({ coverAssetId: 'b' })
    expect(getStoryCover(group, { a, b })?.id).toBe('b')
  })

  it('falls back to first in sequence when coverAssetId is null', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const b = makeAsset({ id: 'b', filename: 'b.jpg' })
    const group = makeStory({ coverAssetId: null, sequence: ['a', 'b'] })
    expect(getStoryCover(group, { a, b })?.id).toBe('a')
  })

  it('falls back when explicit cover asset has left the story (silent per IPV4-2)', () => {
    const a = makeAsset({ id: 'a', filename: 'a.jpg' })
    const group = makeStory({ coverAssetId: 'gone', sequence: ['a'] })
    expect(getStoryCover(group, { a })?.id).toBe('a')
  })

  it('returns null when story has no resolvable assets', () => {
    const group = makeStory({ coverAssetId: null, sequence: [], proposedAssetIds: [] })
    expect(getStoryCover(group, {})).toBeNull()
  })
})
