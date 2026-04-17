import { describe, it, expect } from 'vitest'
import {
  PRESET_SUBTLE,
  PRESET_STANDARD,
  PRESET_STRONG,
  PRESETS,
  PRESET_LIST,
  CONTEXT_DEFAULTS,
  resolvePreset,
  modeToIntensity,
} from '../presets'
import type { WatermarkMode, WatermarkContext } from '../types'

describe('presets', () => {
  describe('PRESET definitions', () => {
    it('subtle preset maps to standard intensity', () => {
      expect(PRESET_SUBTLE.mode).toBe('subtle')
      expect(PRESET_SUBTLE.intensity).toBe('standard')
    })

    it('standard preset maps to elevated intensity', () => {
      expect(PRESET_STANDARD.mode).toBe('standard')
      expect(PRESET_STANDARD.intensity).toBe('elevated')
    })

    it('strong preset maps to invasive intensity', () => {
      expect(PRESET_STRONG.mode).toBe('strong')
      expect(PRESET_STRONG.intensity).toBe('invasive')
    })

    it('each preset has distinct intensity (no accidental duplicates)', () => {
      const intensities = [PRESET_SUBTLE.intensity, PRESET_STANDARD.intensity, PRESET_STRONG.intensity]
      expect(new Set(intensities).size).toBe(3)
    })

    it('PRESETS index covers all non-none modes', () => {
      expect(Object.keys(PRESETS)).toEqual(['subtle', 'standard', 'strong'])
    })

    it('PRESET_LIST matches PRESETS values in order', () => {
      expect(PRESET_LIST).toEqual([PRESET_SUBTLE, PRESET_STANDARD, PRESET_STRONG])
    })
  })

  describe('CONTEXT_DEFAULTS', () => {
    it('upload-default is standard', () => {
      expect(CONTEXT_DEFAULTS['upload-default']).toBe('standard')
    })

    it('asset-preview is subtle', () => {
      expect(CONTEXT_DEFAULTS['asset-preview']).toBe('subtle')
    })

    it('detail-preview is standard', () => {
      expect(CONTEXT_DEFAULTS['detail-preview']).toBe('standard')
    })

    it('share-preview is standard', () => {
      expect(CONTEXT_DEFAULTS['share-preview']).toBe('standard')
    })

    it('promotional-preview is subtle', () => {
      expect(CONTEXT_DEFAULTS['promotional-preview']).toBe('subtle')
    })

    it('internal is none', () => {
      expect(CONTEXT_DEFAULTS['internal']).toBe('none')
    })

    it('every WatermarkContext has a default', () => {
      const contexts: WatermarkContext[] = [
        'upload-default', 'asset-preview', 'detail-preview',
        'share-preview', 'promotional-preview', 'internal',
      ]
      for (const ctx of contexts) {
        expect(CONTEXT_DEFAULTS[ctx]).toBeDefined()
      }
    })
  })

  describe('resolvePreset', () => {
    it('none mode returns disabled config', () => {
      const config = resolvePreset('none')
      expect(config.enabled).toBe(false)
      expect(config.mode).toBe('none')
    })

    it('subtle mode returns enabled config with standard intensity', () => {
      const config = resolvePreset('subtle')
      expect(config.enabled).toBe(true)
      expect(config.intensity).toBe('standard')
    })

    it('standard mode returns enabled config with elevated intensity', () => {
      const config = resolvePreset('standard')
      expect(config.enabled).toBe(true)
      expect(config.intensity).toBe('elevated')
    })

    it('strong mode returns enabled config with invasive intensity', () => {
      const config = resolvePreset('strong')
      expect(config.enabled).toBe(true)
      expect(config.intensity).toBe('invasive')
    })

    it('all modes produce deterministic output', () => {
      const modes: WatermarkMode[] = ['none', 'subtle', 'standard', 'strong']
      for (const mode of modes) {
        const a = resolvePreset(mode)
        const b = resolvePreset(mode)
        expect(a).toEqual(b)
      }
    })
  })

  describe('modeToIntensity', () => {
    it('maps each mode to its preset intensity', () => {
      expect(modeToIntensity('subtle')).toBe('standard')
      expect(modeToIntensity('standard')).toBe('elevated')
      expect(modeToIntensity('strong')).toBe('invasive')
    })

    it('none returns standard (inert fallback)', () => {
      expect(modeToIntensity('none')).toBe('standard')
    })
  })
})
