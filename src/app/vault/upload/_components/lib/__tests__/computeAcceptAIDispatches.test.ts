/**
 * Frontfiles Upload V4 — computeAcceptAIDispatches tests (D2.5 §6.4.2)
 *
 * Pure-helper tests. Validates the ✓ AI dispatch sequence:
 *   1. ONE BULK_ACCEPT telemetry no-op for the subset of selected assets
 *      that actually have a proposal.
 *   2. PER asset, sequenced UPDATE_ASSET_FIELD writes for caption / tags /
 *      geography — only when the proposal value is non-null AND differs
 *      from the current editable value.
 *
 * NEVER price (founder lock L6). The helper has no code path that emits a
 * 'price' field write; this is enforced at the type level by the
 * AutoAcceptDispatch union.
 */

import { describe, it, expect } from 'vitest'
import { computeAcceptAIDispatches } from '../computeAcceptAIDispatches'
import type {
  V3State,
  V2Asset,
  AssetProposal,
  AssetEditableFields,
} from '@/lib/upload/v3-types'
import { v3InitialState } from '@/lib/upload/v3-state'

// ── Test fixture helpers ─────────────────────────────────────────────

function emptyEditable(): AssetEditableFields {
  return {
    title: '',
    description: '',
    tags: [],
    geography: [],
    captureDate: null,
    privacy: null,
    licences: [],
    price: null,
    socialLicensable: false,
    metadataSource: {},
  }
}

function emptyProposal(): AssetProposal {
  return {
    title: '',
    description: '',
    tags: [],
    geography: [],
    priceSuggestion: null,
    privacySuggestion: null,
    licenceSuggestions: [],
    confidence: 0.9,
    rationale: '',
    storyCandidates: [],
  }
}

function makeAsset(
  id: string,
  overrides: {
    proposal?: AssetProposal | null
    editable?: Partial<AssetEditableFields>
  } = {},
): V2Asset {
  return {
    id,
    filename: `${id}.jpg`,
    fileSize: 100,
    format: 'photo',
    file: null,
    thumbnailRef: null,
    excluded: false,
    storyGroupId: null,
    proposal: overrides.proposal ?? null,
    editable: { ...emptyEditable(), ...overrides.editable },
    conflicts: [],
    extractedMetadata: null,
    declarationState: null,
    duplicateStatus: 'none',
    duplicateOfId: null,
    analysisStatus: 'complete',
    uploadProgress: 100,
    existingStoryMatch: null,
    createdAt: new Date().toISOString(),
    committedAt: null,
  }
}

function stateWith(assets: V2Asset[]): V3State {
  const base = v3InitialState('batch_test')
  const assetsById: Record<string, V2Asset> = {}
  const assetOrder: string[] = []
  for (const a of assets) {
    assetsById[a.id] = a
    assetOrder.push(a.id)
  }
  return { ...base, assetsById, assetOrder }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('computeAcceptAIDispatches', () => {
  it('returns empty array when no selected asset has a proposal', () => {
    const state = stateWith([makeAsset('a1', { proposal: null })])
    expect(computeAcceptAIDispatches(state, ['a1'])).toEqual([])
  })

  it('emits BULK_ACCEPT + 3 UPDATEs for one asset with full proposal', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'Protesters march in central Lisbon',
      tags: ['protest', 'climate', 'lisbon'],
      geography: ['Lisbon, Portugal'],
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({
      type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      assetIds: ['a1'],
      fields: ['caption', 'tags'],
    })
    expect(result[1]).toEqual({
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a1',
      field: 'description',
      value: 'Protesters march in central Lisbon',
    })
    expect(result[2]).toEqual({
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a1',
      field: 'tags',
      value: ['protest', 'climate', 'lisbon'],
    })
    expect(result[3]).toEqual({
      type: 'UPDATE_ASSET_FIELD',
      assetId: 'a1',
      field: 'geography',
      value: ['Lisbon, Portugal'],
    })
  })

  it('only includes assets with proposals in the BULK telemetry payload', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption A',
      tags: ['t'],
      geography: ['g'],
    }
    const state = stateWith([
      makeAsset('a1', { proposal }),
      makeAsset('a2', { proposal: null }), // no proposal — must be skipped
    ])
    const result = computeAcceptAIDispatches(state, ['a1', 'a2'])

    // BULK has only a1; a2 produces no UPDATEs.
    expect(result[0]).toEqual({
      type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      assetIds: ['a1'],
      fields: ['caption', 'tags'],
    })
    // 1 BULK + 3 UPDATEs for a1, none for a2.
    expect(result).toHaveLength(4)
    // No UPDATE references a2.
    for (const d of result) {
      if (d.type === 'UPDATE_ASSET_FIELD') expect(d.assetId).toBe('a1')
    }
  })

  it('skips caption when proposal value matches current editable value', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'same caption',
      tags: ['new-tag'],
      geography: ['Lisbon'],
    }
    const state = stateWith([
      makeAsset('a1', {
        proposal,
        editable: { description: 'same caption' }, // already matches proposal
      }),
    ])
    const result = computeAcceptAIDispatches(state, ['a1'])

    // BULK + UPDATE(tags) + UPDATE(geography) — caption skipped.
    expect(result).toHaveLength(3)
    expect(result.map(d => d.type === 'UPDATE_ASSET_FIELD' ? d.field : d.type)).toEqual([
      'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      'tags',
      'geography',
    ])
  })

  it('skips a field when proposal value is null', () => {
    // proposal.geography is [] (empty array, treated as no-change vs editable [])
    // proposal.description is '' (empty string, !== current '' → SKIPPED via shallow equality)
    // Test more meaningful gap: geography is null in fixture? Spec says geography
    // is string[] not nullable. So instead, test the empty-array-equals-empty-array
    // skip path explicitly.
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'a new caption',
      tags: [], // empty → matches current empty → skip
      geography: [], // empty → matches current empty → skip
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    // BULK + UPDATE(description) only — tags and geography are no-ops.
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('BULK_ACCEPT_PROPOSALS_FOR_SELECTION')
    if (result[1].type === 'UPDATE_ASSET_FIELD') {
      expect(result[1].field).toBe('description')
    }
  })

  it('does not emit any field write of type "price"', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption',
      tags: ['t'],
      geography: ['g'],
      priceSuggestion: { rangeLowCents: 5000, rangeHighCents: 15000, suggestionCents: 10000 } as never,
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    for (const d of result) {
      if (d.type === 'UPDATE_ASSET_FIELD') {
        expect(d.field).not.toBe('price')
      }
    }
  })
})
