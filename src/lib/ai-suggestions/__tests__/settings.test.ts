import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock surface for the supabase client.
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

import { getEffectiveSettings, invalidateSettingsCache } from '../settings'

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

beforeEach(() => {
  invalidateSettingsCache()
  mockSingle.mockReset()
  mockEq.mockClear()
  mockSelect.mockClear()
  mockFrom.mockClear()
})

afterEach(() => {
  invalidateSettingsCache()
  vi.unstubAllEnvs()
})

describe('getEffectiveSettings', () => {
  describe('production env', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('returns row values verbatim (no multiplier)', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      const settings = await getEffectiveSettings()
      expect(settings.daily_cap_cents).toBe(50000)
      expect(settings.monthly_cap_cents).toBe(1000000)
    })

    it('queries the singleton row', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      await getEffectiveSettings()
      expect(mockFrom).toHaveBeenCalledWith('ai_pipeline_settings')
      expect(mockEq).toHaveBeenCalledWith('singleton_key', 'global')
    })
  })

  describe('non-production env (dev/preview)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('applies 10% multiplier to daily_cap_cents', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      const settings = await getEffectiveSettings()
      expect(settings.daily_cap_cents).toBe(5000) // 50000 * 0.1
    })

    it('applies 10% multiplier to monthly_cap_cents', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      const settings = await getEffectiveSettings()
      expect(settings.monthly_cap_cents).toBe(100000) // 1000000 * 0.1
    })

    it('does NOT apply multiplier to non-cost values', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      const settings = await getEffectiveSettings()
      expect(settings.tag_taxonomy_top_n).toBe(50)
      expect(settings.vision_max_long_edge_px).toBe(1568)
      expect(settings.circuit_failure_threshold).toBe(5)
    })
  })

  describe('caching', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('caches the result and does NOT re-query within TTL', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      await getEffectiveSettings()
      await getEffectiveSettings()
      await getEffectiveSettings()
      // Three reads, but only one DB hit due to cache
      expect(mockFrom).toHaveBeenCalledTimes(1)
    })

    it('invalidateSettingsCache forces a re-query', async () => {
      mockSingle.mockResolvedValue({ data: PROD_DEFAULTS, error: null })
      await getEffectiveSettings()
      invalidateSettingsCache()
      await getEffectiveSettings()
      expect(mockFrom).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('throws when supabase returns an error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'no row found' },
      })
      await expect(getEffectiveSettings()).rejects.toThrow(/no row found/)
    })

    it('throws when supabase returns no row', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null })
      await expect(getEffectiveSettings()).rejects.toThrow(/no row/)
    })
  })

  describe('numeric coercion', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('coerces NUMERIC string values to JS numbers', async () => {
      // Postgres NUMERIC columns sometimes round-trip as strings via JSON
      mockSingle.mockResolvedValue({
        data: {
          ...PROD_DEFAULTS,
          confidence_floor_caption: '0.30',
          confidence_floor_tags_new: '0.75',
        },
        error: null,
      })
      const settings = await getEffectiveSettings()
      expect(typeof settings.confidence_floor_caption).toBe('number')
      expect(settings.confidence_floor_caption).toBe(0.3)
      expect(settings.confidence_floor_tags_new).toBe(0.75)
    })
  })
})
