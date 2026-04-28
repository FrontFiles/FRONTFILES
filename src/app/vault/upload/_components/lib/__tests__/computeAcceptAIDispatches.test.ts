/**
 * Frontfiles Upload V4 — computeAcceptAIDispatches tests (D2.5 §6.4.2 + E6.B)
 *
 * Pure-helper tests. Validates the ✓ AI dispatch sequence after E6.B updates:
 *   - Per-field confidence threshold (default 0.85; falls back to overall
 *     `confidence` when per-field is undefined)
 *   - 'keywords' added to BULK_ACCEPT telemetry; no canonical write (no
 *     editable column for keywords in v1)
 *   - 'geography' REMOVED — it comes from EXIF, not AI (E6 §6.5)
 *
 * NEVER price (founder lock L6).
 */

import { describe, it, expect } from 'vitest'
import {
  computeAcceptAIDispatches,
  DEFAULT_AUTO_ACCEPT_THRESHOLD,
} from '../computeAcceptAIDispatches'
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
    confidence: 0.9, // above default 0.85 threshold
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

describe('computeAcceptAIDispatches (E6.B)', () => {
  it('exposes DEFAULT_AUTO_ACCEPT_THRESHOLD = 0.85', () => {
    expect(DEFAULT_AUTO_ACCEPT_THRESHOLD).toBe(0.85)
  })

  it('returns empty array when no selected asset has a proposal', () => {
    const state = stateWith([makeAsset('a1', { proposal: null })])
    expect(computeAcceptAIDispatches(state, ['a1'])).toEqual([])
  })

  it('BULK_ACCEPT telemetry fields = [caption, keywords, tags]; no geography', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'Protesters march in central Lisbon',
      tags: ['protest', 'climate', 'lisbon'],
      geography: ['Lisbon, Portugal'],
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    // BULK + caption + tags. NO geography update; keywords telemetry-only.
    expect(result[0]).toEqual({
      type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      assetIds: ['a1'],
      fields: ['caption', 'keywords', 'tags'],
    })
    expect(result.filter((d) => d.type === 'UPDATE_ASSET_FIELD').map((d) => d.field)).toEqual([
      'description',
      'tags',
    ])
  })

  it('does NOT dispatch UPDATE for geography even when proposal has values', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      geography: ['Paris', 'France'],
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])
    for (const d of result) {
      if (d.type === 'UPDATE_ASSET_FIELD') expect(d.field).not.toBe('geography')
    }
  })

  it('per-field threshold gates each field independently (using per-field confidence)', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption text',
      tags: ['t1', 't2'],
      description_confidence: 0.9, // above 0.85
      tags_confidence: 0.5, // below 0.85
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    const updates = result.filter((d) => d.type === 'UPDATE_ASSET_FIELD').map((d) => d.field)
    // caption passes; tags below threshold → not dispatched
    expect(updates).toContain('description')
    expect(updates).not.toContain('tags')
  })

  it('falls back to overall `confidence` when per-field is undefined', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption text',
      tags: ['t1'],
      confidence: 0.4, // below 0.85; per-field undefined → fallback
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])

    // BULK still emitted (it's telemetry; not threshold-gated). UPDATEs gated.
    expect(result[0].type).toBe('BULK_ACCEPT_PROPOSALS_FOR_SELECTION')
    const updates = result.filter((d) => d.type === 'UPDATE_ASSET_FIELD')
    expect(updates).toEqual([])
  })

  it('respects custom threshold parameter', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption',
      tags: ['t1'],
      confidence: 0.6,
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    // Lower threshold to 0.5 → 0.6 passes → caption + tags dispatched
    const result = computeAcceptAIDispatches(state, ['a1'], 0.5)
    const updates = result.filter((d) => d.type === 'UPDATE_ASSET_FIELD').map((d) => d.field)
    expect(updates).toEqual(['description', 'tags'])
  })

  it('skips caption when proposal value matches current editable value', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'same caption',
      tags: ['new-tag'],
    }
    const state = stateWith([
      makeAsset('a1', {
        proposal,
        editable: { description: 'same caption' },
      }),
    ])
    const result = computeAcceptAIDispatches(state, ['a1'])

    // BULK + UPDATE(tags) — caption skipped (no diff)
    expect(result.map((d) => (d.type === 'UPDATE_ASSET_FIELD' ? d.field : d.type))).toEqual([
      'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      'tags',
    ])
  })

  it('only includes assets with proposals in the BULK telemetry payload', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      description: 'caption A',
      tags: ['t'],
    }
    const state = stateWith([
      makeAsset('a1', { proposal }),
      makeAsset('a2', { proposal: null }), // no proposal — must be skipped
    ])
    const result = computeAcceptAIDispatches(state, ['a1', 'a2'])

    expect(result[0]).toEqual({
      type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
      assetIds: ['a1'],
      fields: ['caption', 'keywords', 'tags'],
    })
    for (const d of result) {
      if (d.type === 'UPDATE_ASSET_FIELD') expect(d.assetId).toBe('a1')
    }
  })

  it('keywords field — no UPDATE_ASSET_FIELD dispatch (audit-only via BULK)', () => {
    const proposal: AssetProposal = {
      ...emptyProposal(),
      keywords: ['kw1', 'kw2', 'kw3'],
      keywords_confidence: 0.95,
    }
    const state = stateWith([makeAsset('a1', { proposal })])
    const result = computeAcceptAIDispatches(state, ['a1'])
    // No 'keywords' field UPDATE — keywords is audit-only in v1.
    for (const d of result) {
      if (d.type === 'UPDATE_ASSET_FIELD') {
        expect(d.field).not.toBe('keywords' as never)
      }
    }
  })
})
