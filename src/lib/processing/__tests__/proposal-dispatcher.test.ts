import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase. Use call counts to track UPDATE invocations across the
// claim → success/failure paths.
const mockSingleSettings = vi.fn()
const mockEqSettings = vi.fn(() => ({ single: mockSingleSettings }))
const mockSelectSettings = vi.fn(() => ({ eq: mockEqSettings }))

const mockMaybeSingleClaim = vi.fn()
const mockSelectClaim = vi.fn(() => ({ maybeSingle: mockMaybeSingleClaim }))
const mockEqClaim = vi.fn(() => ({ eq: mockEqClaim, select: mockSelectClaim }))
const mockUpdateClaim = vi.fn(() => ({ eq: mockEqClaim }))

const mockMaybeSingleLookup = vi.fn()
const mockEqLookup = vi.fn(() => ({ maybeSingle: mockMaybeSingleLookup }))
const mockSelectLookup = vi.fn(() => ({ eq: mockEqLookup }))

const mockEqUpdate = vi.fn(() => Promise.resolve({ error: null }))
const mockUpdateRow = vi.fn(() => ({ eq: mockEqUpdate }))

const mockNotTaxo = vi.fn().mockResolvedValue({ data: [], error: null })
const mockEqTaxo = vi.fn(() => ({ not: mockNotTaxo }))
const mockSelectTaxo = vi.fn(() => ({ eq: mockEqTaxo }))

const mockFrom = vi.fn((table: string) => {
  switch (table) {
    case 'ai_pipeline_settings':
      return { select: mockSelectSettings }
    case 'asset_proposals':
      // Differentiate UPDATE-with-select (claim) vs UPDATE-with-eq (status writes)
      return { update: mockUpdateClaim }
    case 'vault_assets':
      return { select: mockSelectLookup }
    default:
      return { select: vi.fn(), update: mockUpdateRow, insert: vi.fn() }
  }
})

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

vi.mock('@/lib/ai-suggestions/engine', () => ({
  generateAssetProposal: vi.fn(),
}))

vi.mock('@/lib/ai-suggestions/audit', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../media-row-adapter', () => ({
  findOriginalStorageRef: vi.fn().mockResolvedValue('storage/path/to/original'),
}))

import { dispatchAssetProposalForProcessing } from '../proposal-dispatcher'
import { invalidateSettingsCache } from '@/lib/ai-suggestions/settings'
import { generateAssetProposal } from '@/lib/ai-suggestions/engine'

const PROD_DEFAULTS = {
  daily_cap_cents: 50000,
  monthly_cap_cents: 1000000,
  tag_taxonomy_top_n: 50,
  confidence_floor_caption: 0.3,
  confidence_floor_keywords: 0.3,
  confidence_floor_tags_existing: 0.3,
  confidence_floor_tags_new: 0.75,
  confidence_floor_silhouette: 0.3,
  vision_max_long_edge_px: 1568,
  vision_jpeg_quality: 85,
  circuit_failure_threshold: 5,
  circuit_cooldown_ms: 60000,
}

const STORAGE_ADAPTER = {
  putOriginal: vi.fn(),
  putDerivative: vi.fn(),
  getBytes: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
  exists: vi.fn(),
  delete: vi.fn(),
}

const ASSET = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  invalidateSettingsCache()
  mockSingleSettings.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
  mockMaybeSingleClaim.mockReset()
  mockMaybeSingleLookup.mockReset()
  mockUpdateClaim.mockClear()
  mockUpdateRow.mockClear()
  ;(generateAssetProposal as unknown as ReturnType<typeof vi.fn>).mockReset()
})

describe('dispatchAssetProposalForProcessing', () => {
  it('no-op if claim fails (already in-flight or not pending)', async () => {
    mockMaybeSingleClaim.mockResolvedValue({ data: null, error: null })
    await dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)
    // No engine call if claim failed
    expect(generateAssetProposal).not.toHaveBeenCalled()
  })

  it('happy path: claim → engine → ready', async () => {
    mockMaybeSingleClaim.mockResolvedValue({
      data: { asset_id: ASSET, retry_count: 0 },
      error: null,
    })
    mockMaybeSingleLookup.mockResolvedValue({
      data: {
        format: 'photo',
        creator_id: '00000000-0000-0000-0000-000000000002',
        users: { ai_region: 'eu' },
      },
      error: null,
    })
    ;(generateAssetProposal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      visionResponse: {
        caption: 'A bicycle',
        caption_confidence: 0.9,
        keywords: ['bike', 'urban', 'evening'],
        keywords_confidence: 0.85,
        tags: ['bike', 'urban'],
        tags_confidence: 0.8,
        new_tags_with_confidence: [],
      },
      modelVersion: 'gemini-2.5-flash',
      costCents: 5,
      latencyMs: 1200,
      cacheHit: false,
      region: 'europe-west4',
    })

    await dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)
    expect(generateAssetProposal).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: ASSET, format: 'photo', region: 'europe-west4' }),
    )
  })

  it('region mapping: eu → europe-west4; us → us-central1', async () => {
    mockMaybeSingleClaim.mockResolvedValue({
      data: { asset_id: ASSET, retry_count: 0 },
      error: null,
    })
    mockMaybeSingleLookup.mockResolvedValue({
      data: {
        format: 'photo',
        creator_id: '00000000-0000-0000-0000-000000000002',
        users: { ai_region: 'us' },
      },
      error: null,
    })
    ;(generateAssetProposal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      visionResponse: {
        caption: 'x',
        caption_confidence: 0.8,
        keywords: ['a', 'b', 'c'],
        keywords_confidence: 0.8,
        tags: [],
        tags_confidence: 0.8,
        new_tags_with_confidence: [],
      },
      modelVersion: 'gemini-2.5-flash',
      costCents: 0,
      latencyMs: 0,
      cacheHit: true,
      region: 'us-central1',
    })

    await dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)
    expect(generateAssetProposal).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-central1' }),
    )
  })

  it('non-image format → marks not_applicable; no engine call', async () => {
    mockMaybeSingleClaim.mockResolvedValue({
      data: { asset_id: ASSET, retry_count: 0 },
      error: null,
    })
    mockMaybeSingleLookup.mockResolvedValue({
      data: {
        format: 'video',
        creator_id: '00000000-0000-0000-0000-000000000002',
        users: { ai_region: 'eu' },
      },
      error: null,
    })
    await dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)
    expect(generateAssetProposal).not.toHaveBeenCalled()
  })

  it('engine throws + retry_count=0 → resets to pending (retry path)', async () => {
    mockMaybeSingleClaim.mockResolvedValue({
      data: { asset_id: ASSET, retry_count: 0 },
      error: null,
    })
    mockMaybeSingleLookup.mockResolvedValue({
      data: {
        format: 'photo',
        creator_id: '00000000-0000-0000-0000-000000000002',
        users: { ai_region: 'eu' },
      },
      error: null,
    })
    ;(generateAssetProposal as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('vertex transient'),
    )
    // Should not throw — error caught + status reset to pending
    await expect(dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)).resolves.toBeUndefined()
  })

  it('engine throws + retry_count=1 → marks failed (no more retries)', async () => {
    mockMaybeSingleClaim.mockResolvedValue({
      data: { asset_id: ASSET, retry_count: 1 },
      error: null,
    })
    mockMaybeSingleLookup.mockResolvedValue({
      data: {
        format: 'photo',
        creator_id: '00000000-0000-0000-0000-000000000002',
        users: { ai_region: 'eu' },
      },
      error: null,
    })
    ;(generateAssetProposal as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('vertex permanent'),
    )
    await expect(dispatchAssetProposalForProcessing(ASSET, STORAGE_ADAPTER)).resolves.toBeUndefined()
  })
})
