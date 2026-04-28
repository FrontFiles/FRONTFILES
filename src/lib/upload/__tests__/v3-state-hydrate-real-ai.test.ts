/**
 * Frontfiles — V3 reducer test for HYDRATE_REAL_AI_PROPOSALS (E6.C)
 *
 * Lives in its own test file so the 76 V3 reducer parity tests in
 * v3-state.test.ts stay isolated. The new action is additive; existing
 * parity fixtures don't reference it.
 */

import { describe, it, expect } from 'vitest'
import { v3Reducer, v3InitialState } from '../v3-state'
import type {
  V2Asset,
  V3State,
  V3HydrationProposal,
  AssetEditableFields,
  AssetProposal,
} from '../v3-types'

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

function makeAsset(id: string, proposal: AssetProposal | null = null): V2Asset {
  return {
    id,
    filename: `${id}.jpg`,
    fileSize: 100,
    format: 'photo',
    file: null,
    thumbnailRef: null,
    excluded: false,
    storyGroupId: null,
    proposal,
    editable: emptyEditable(),
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

const HYDRATED_PROPOSAL: V3HydrationProposal = {
  asset_id: 'a1',
  generation_status: 'ready',
  caption: 'A bicycle leaning against a stone wall',
  caption_confidence: 0.85,
  keywords: ['bicycle', 'urban', 'stone'],
  keywords_confidence: 0.8,
  tags: ['bike', 'urban'],
  tags_confidence: 0.9,
  cluster_id: null,
  cluster_confidence: null,
  rationale: null,
}

describe('HYDRATE_REAL_AI_PROPOSALS', () => {
  it('merges hydrated AI fields into existing proposal; preserves other-pillar fields', () => {
    const existingProposal: AssetProposal = {
      title: 'Original title',
      description: 'old description',
      tags: ['old'],
      geography: ['Lisbon'],
      priceSuggestion: null,
      privacySuggestion: 'PUBLIC',
      licenceSuggestions: ['editorial'],
      confidence: 0.5,
      rationale: 'old rationale',
      storyCandidates: [],
    }
    const state = stateWith([makeAsset('a1', existingProposal)])
    const next = v3Reducer(state, {
      type: 'HYDRATE_REAL_AI_PROPOSALS',
      payload: { proposals: [HYDRATED_PROPOSAL], clusters: [] },
    })

    const merged = next.assetsById.a1.proposal!
    // AI fields replaced
    expect(merged.description).toBe('A bicycle leaning against a stone wall')
    expect(merged.tags).toEqual(['bike', 'urban'])
    expect(merged.description_confidence).toBe(0.85)
    expect(merged.keywords).toEqual(['bicycle', 'urban', 'stone'])
    expect(merged.tags_confidence).toBe(0.9)
    // Other-pillar fields preserved
    expect(merged.geography).toEqual(['Lisbon'])
    expect(merged.privacySuggestion).toBe('PUBLIC')
    expect(merged.licenceSuggestions).toEqual(['editorial'])
    // Backward-compat overall = MAX-of-per-field
    expect(merged.confidence).toBe(0.9)
  })

  it('constructs minimal proposal when asset had none', () => {
    const state = stateWith([makeAsset('a1', null)])
    const next = v3Reducer(state, {
      type: 'HYDRATE_REAL_AI_PROPOSALS',
      payload: { proposals: [HYDRATED_PROPOSAL], clusters: [] },
    })

    const created = next.assetsById.a1.proposal!
    expect(created.description).toBe('A bicycle leaning against a stone wall')
    expect(created.geography).toEqual([])
    expect(created.priceSuggestion).toBeNull()
    expect(created.confidence).toBe(0.9)
  })

  it('skips assets not in current state', () => {
    const state = stateWith([makeAsset('a1')])
    const next = v3Reducer(state, {
      type: 'HYDRATE_REAL_AI_PROPOSALS',
      payload: {
        proposals: [{ ...HYDRATED_PROPOSAL, asset_id: 'never-existed' }],
        clusters: [],
      },
    })
    expect(next.assetsById.a1.proposal).toBeNull() // unchanged
  })

  it('replaces aiClusterProposals wholesale (does NOT merge)', () => {
    const state: V3State = {
      ...stateWith([makeAsset('a1')]),
      aiClusterProposals: [
        {
          proposalId: 'old',
          clusterName: 'Old',
          proposedAssetIds: ['a1'],
          rationale: 'old',
          confidence: 0.5,
          status: 'pending',
        },
      ],
    }
    const next = v3Reducer(state, {
      type: 'HYDRATE_REAL_AI_PROPOSALS',
      payload: {
        proposals: [],
        clusters: [
          {
            proposalId: 'new',
            clusterName: 'New',
            proposedAssetIds: ['a1'],
            rationale: 'new',
            confidence: 0.9,
            status: 'pending',
          },
        ],
      },
    })
    expect(next.aiClusterProposals).toHaveLength(1)
    expect(next.aiClusterProposals[0].proposalId).toBe('new')
  })

  it('synthesized rationale (when present) is used', () => {
    const state = stateWith([makeAsset('a1', null)])
    const next = v3Reducer(state, {
      type: 'HYDRATE_REAL_AI_PROPOSALS',
      payload: {
        proposals: [
          { ...HYDRATED_PROPOSAL, rationale: 'Lower confidence on: caption.' },
        ],
        clusters: [],
      },
    })
    expect(next.assetsById.a1.proposal!.rationale).toBe('Lower confidence on: caption.')
  })
})
