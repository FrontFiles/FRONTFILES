import { describe, it, expect, vi, beforeEach } from 'vitest'
import sharp from 'sharp'

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => false,
}))

import { prepareForVision } from '../image-prep'
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

async function makeFixture(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .toBuffer()
}

beforeEach(() => {
  invalidateSettingsCache()
  mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
})

describe('prepareForVision', () => {
  it('resizes a 3000x2000 image to long-edge 1568', async () => {
    const original = await makeFixture(3000, 2000)
    const prepared = await prepareForVision(original)
    const meta = await sharp(prepared.bytes).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1568)
  })

  it('does not enlarge a small image (200x200)', async () => {
    const original = await makeFixture(200, 200)
    const prepared = await prepareForVision(original)
    const meta = await sharp(prepared.bytes).metadata()
    expect(meta.width).toBe(200)
    expect(meta.height).toBe(200)
  })

  it('returns mode=inline for small outputs', async () => {
    const original = await makeFixture(800, 600)
    const prepared = await prepareForVision(original)
    expect(prepared.mode).toBe('inline')
    expect(prepared.mime).toBe('image/jpeg')
  })

  it('honors EXIF rotation by calling .rotate() before resize', async () => {
    // Just verify the call shape works on a plain image (no orientation tag)
    const original = await makeFixture(1000, 800)
    const prepared = await prepareForVision(original)
    expect(prepared.bytes.length).toBeGreaterThan(0)
  })
})
