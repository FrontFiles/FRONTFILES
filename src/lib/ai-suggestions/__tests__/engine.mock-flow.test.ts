import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase so settings.ts can read PROD_DEFAULTS without a live DB.
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle, eq: mockEq, maybeSingle: vi.fn() }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  // Force dual-mode → false in this test suite. The engine skips the
  // production-only paths (cache / quota / cost / embedding), exercising
  // only the adapter + caption-guard + Zod validation.
  isSupabaseConfigured: () => false,
}))

import { generateAssetProposal } from '../engine'
import { invalidateSettingsCache } from '../settings'

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

const STUB_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]) // JPEG header bytes only

beforeEach(() => {
  invalidateSettingsCache()
  mockSingle.mockReset()
  mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
  // Force mock-mode adapter: ensure FFF_AI_REAL_PIPELINE is NOT 'true'.
  delete process.env.FFF_AI_REAL_PIPELINE
})

afterEach(() => {
  invalidateSettingsCache()
})

describe('generateAssetProposal (mock-mode end-to-end)', () => {
  it('returns the photo fixture for a photo asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000001',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'photo',
      originalBytes: STUB_BYTES,
      region: 'europe-west4',
      taxonomyTopN: [],
    })
    expect(result.visionResponse.caption).toMatch(/photo/i)
    expect(result.visionResponse.keywords).toContain('photo')
    expect(result.visionResponse.caption_confidence).toBeGreaterThan(0)
    expect(result.visionResponse.keywords.length).toBeGreaterThanOrEqual(3)
    expect(result.visionResponse.keywords.length).toBeLessThanOrEqual(8)
    expect(result.cacheHit).toBe(false)
    expect(result.region).toBe('europe-west4')
  })

  it('returns the illustration fixture for an illustration asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000003',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'illustration',
      originalBytes: STUB_BYTES,
      region: 'europe-west4',
      taxonomyTopN: [],
    })
    expect(result.visionResponse.caption).toMatch(/illustration/i)
    expect(result.visionResponse.keywords).toContain('illustration')
  })

  it('returns the infographic fixture for an infographic asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000004',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'infographic',
      originalBytes: STUB_BYTES,
      region: 'us-central1',
      taxonomyTopN: [],
    })
    expect(result.visionResponse.caption).toMatch(/infographic/i)
    expect(result.region).toBe('us-central1')
  })

  it('returns the vector fixture for a vector asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000005',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'vector',
      originalBytes: STUB_BYTES,
      region: 'europe-west4',
      taxonomyTopN: [],
    })
    expect(result.visionResponse.caption).toMatch(/vector/i)
  })

  it('result.visionResponse passes Zod VisionResponseSchema', async () => {
    const { VisionResponseSchema } = await import('../schema')
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000001',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'photo',
      originalBytes: STUB_BYTES,
      region: 'europe-west4',
      taxonomyTopN: [],
    })
    expect(() => VisionResponseSchema.parse(result.visionResponse)).not.toThrow()
  })

  it('mock-mode skips real pipeline (cost stays 0; cacheHit false)', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000001',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'photo',
      originalBytes: STUB_BYTES,
      region: 'europe-west4',
      taxonomyTopN: [],
    })
    // Dual-mode is off (mocked isSupabaseConfigured=false) → engine skips
    // cache/quota/cost/embedding. costCents stays 0.
    expect(result.costCents).toBe(0)
    expect(result.cacheHit).toBe(false)
  })
})
