import { describe, it, expect } from 'vitest'
import {
  resolveWatermarkConfig,
  isWatermarkEnabled,
  getWatermarkModeLabel,
  ALL_MODES,
  isValidWatermarkMode,
  createDefaultAssetWatermarkSettings,
} from '../policy'
import type { WatermarkContext, AssetWatermarkSettings } from '../types'

describe('policy', () => {
  describe('resolveWatermarkConfig', () => {
    // ── Context defaults ──

    it('asset-preview resolves to subtle preset', () => {
      const config = resolveWatermarkConfig('asset-preview')
      expect(config.mode).toBe('subtle')
      expect(config.intensity).toBe('standard')
      expect(config.enabled).toBe(true)
    })

    it('detail-preview resolves to standard preset', () => {
      const config = resolveWatermarkConfig('detail-preview')
      expect(config.mode).toBe('standard')
      expect(config.intensity).toBe('elevated')
      expect(config.enabled).toBe(true)
    })

    it('share-preview resolves to standard preset', () => {
      const config = resolveWatermarkConfig('share-preview')
      expect(config.mode).toBe('standard')
      expect(config.intensity).toBe('elevated')
      expect(config.enabled).toBe(true)
    })

    it('internal resolves to disabled', () => {
      const config = resolveWatermarkConfig('internal')
      expect(config.enabled).toBe(false)
      expect(config.mode).toBe('none')
    })

    // ── Per-asset override ──

    it('per-asset mode overrides context default', () => {
      const settings: AssetWatermarkSettings = { mode: 'strong', overrideIntensity: null }
      const config = resolveWatermarkConfig('asset-preview', settings)
      expect(config.mode).toBe('strong')
      expect(config.intensity).toBe('invasive')
    })

    it('per-asset mode none disables watermark regardless of context', () => {
      const settings: AssetWatermarkSettings = { mode: 'none', overrideIntensity: null }
      const config = resolveWatermarkConfig('share-preview', settings)
      expect(config.enabled).toBe(false)
    })

    it('per-asset intensity override is applied', () => {
      const settings: AssetWatermarkSettings = { mode: 'subtle', overrideIntensity: 'invasive' }
      const config = resolveWatermarkConfig('asset-preview', settings)
      expect(config.mode).toBe('subtle')
      expect(config.intensity).toBe('invasive')
    })

    it('per-asset intensity override is ignored when mode is none', () => {
      const settings: AssetWatermarkSettings = { mode: 'none', overrideIntensity: 'invasive' }
      const config = resolveWatermarkConfig('detail-preview', settings)
      expect(config.enabled).toBe(false)
    })

    it('null asset settings fall through to context default', () => {
      const config = resolveWatermarkConfig('detail-preview', null)
      expect(config.mode).toBe('standard')
    })

    it('null mode in asset settings falls through to context default', () => {
      const settings: AssetWatermarkSettings = { mode: null, overrideIntensity: null }
      const config = resolveWatermarkConfig('detail-preview', settings)
      expect(config.mode).toBe('standard')
    })

    // ── Upload default ──

    it('upload default applies in upload-default context', () => {
      const config = resolveWatermarkConfig('upload-default', null, 'strong')
      expect(config.mode).toBe('strong')
      expect(config.intensity).toBe('invasive')
    })

    it('upload default is ignored in non-upload contexts', () => {
      const config = resolveWatermarkConfig('detail-preview', null, 'strong')
      // Should fall through to detail-preview context default (standard)
      expect(config.mode).toBe('standard')
    })

    it('per-asset override takes priority over upload default', () => {
      const settings: AssetWatermarkSettings = { mode: 'subtle', overrideIntensity: null }
      const config = resolveWatermarkConfig('upload-default', settings, 'strong')
      expect(config.mode).toBe('subtle')
    })

    // ── Determinism ──

    it('same inputs produce same output', () => {
      const settings: AssetWatermarkSettings = { mode: 'standard', overrideIntensity: 'invasive' }
      const a = resolveWatermarkConfig('share-preview', settings)
      const b = resolveWatermarkConfig('share-preview', settings)
      expect(a).toEqual(b)
    })
  })

  describe('isWatermarkEnabled', () => {
    it('returns true for enabled contexts', () => {
      expect(isWatermarkEnabled('detail-preview')).toBe(true)
      expect(isWatermarkEnabled('share-preview')).toBe(true)
      expect(isWatermarkEnabled('asset-preview')).toBe(true)
    })

    it('returns false for internal context', () => {
      expect(isWatermarkEnabled('internal')).toBe(false)
    })

    it('respects per-asset none override', () => {
      expect(isWatermarkEnabled('detail-preview', { mode: 'none', overrideIntensity: null })).toBe(false)
    })
  })

  describe('getWatermarkModeLabel', () => {
    it('returns readable labels', () => {
      expect(getWatermarkModeLabel('none')).toBe('None')
      expect(getWatermarkModeLabel('subtle')).toBe('Subtle')
      expect(getWatermarkModeLabel('standard')).toBe('Standard')
      expect(getWatermarkModeLabel('strong')).toBe('Strong')
    })
  })

  describe('ALL_MODES', () => {
    it('includes all four modes', () => {
      expect(ALL_MODES).toEqual(['none', 'subtle', 'standard', 'strong'])
    })
  })

  describe('isValidWatermarkMode', () => {
    it('validates known modes', () => {
      expect(isValidWatermarkMode('none')).toBe(true)
      expect(isValidWatermarkMode('subtle')).toBe(true)
      expect(isValidWatermarkMode('standard')).toBe(true)
      expect(isValidWatermarkMode('strong')).toBe(true)
    })

    it('rejects unknown strings', () => {
      expect(isValidWatermarkMode('extreme')).toBe(false)
      expect(isValidWatermarkMode('')).toBe(false)
      expect(isValidWatermarkMode('STANDARD')).toBe(false)
    })
  })

  describe('createDefaultAssetWatermarkSettings', () => {
    it('returns all-null settings', () => {
      const settings = createDefaultAssetWatermarkSettings()
      expect(settings.mode).toBeNull()
      expect(settings.overrideIntensity).toBeNull()
    })
  })
})
