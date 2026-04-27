import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase so settings.ts can read PROD_DEFAULTS without a live DB.
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
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
      imageBytes: STUB_BYTES,
      imageMime: 'image/jpeg',
      region: 'europe-west4',
    })
    expect(result.caption).toMatch(/photo/i)
    expect(result.keywords).toContain('photo')
    expect(result.caption_confidence).toBeGreaterThan(0)
    expect(result.keywords.length).toBeGreaterThanOrEqual(3)
    expect(result.keywords.length).toBeLessThanOrEqual(8)
  })

  it('returns the illustration fixture for an illustration asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000003',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'illustration',
      imageBytes: STUB_BYTES,
      imageMime: 'image/jpeg',
      region: 'europe-west4',
    })
    expect(result.caption).toMatch(/illustration/i)
    expect(result.keywords).toContain('illustration')
  })

  it('returns the infographic fixture for an infographic asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000004',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'infographic',
      imageBytes: STUB_BYTES,
      imageMime: 'image/jpeg',
      region: 'us-central1',
    })
    expect(result.caption).toMatch(/infographic/i)
  })

  it('returns the vector fixture for a vector asset', async () => {
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000005',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'vector',
      imageBytes: STUB_BYTES,
      imageMime: 'image/jpeg',
      region: 'europe-west4',
    })
    expect(result.caption).toMatch(/vector/i)
  })

  it('throws when FFF_AI_REAL_PIPELINE=true (production stub not implemented in E2)', async () => {
    process.env.FFF_AI_REAL_PIPELINE = 'true'
    await expect(
      generateAssetProposal({
        assetId: '00000000-0000-0000-0000-000000000001',
        creatorId: '00000000-0000-0000-0000-000000000002',
        format: 'photo',
        imageBytes: STUB_BYTES,
        imageMime: 'image/jpeg',
        region: 'europe-west4',
      }),
    ).rejects.toThrow(/not yet implemented/i)
  })

  it('result shape passes Zod VisionResponseSchema', async () => {
    const { VisionResponseSchema } = await import('../schema')
    const result = await generateAssetProposal({
      assetId: '00000000-0000-0000-0000-000000000001',
      creatorId: '00000000-0000-0000-0000-000000000002',
      format: 'photo',
      imageBytes: STUB_BYTES,
      imageMime: 'image/jpeg',
      region: 'europe-west4',
    })
    expect(() => VisionResponseSchema.parse(result)).not.toThrow()
  })
})
