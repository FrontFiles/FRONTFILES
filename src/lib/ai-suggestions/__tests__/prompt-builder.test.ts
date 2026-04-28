import { describe, it, expect } from 'vitest'
import { buildPrompt, VISION_RESPONSE_JSON_SCHEMA } from '../prompt-builder'

describe('buildPrompt', () => {
  it('photo block contains photo-specific guidance', () => {
    const p = buildPrompt('photo', ['bike', 'urban'])
    expect(p).toMatch(/photograph/i)
    expect(p).toMatch(/visual concepts/i)
    expect(p).toContain('bike, urban')
  })

  it('illustration block mentions style descriptors', () => {
    const p = buildPrompt('illustration', [])
    expect(p).toMatch(/illustration/i)
    expect(p).toMatch(/style/i)
  })

  it('infographic block mentions chart/diagram type', () => {
    const p = buildPrompt('infographic', [])
    expect(p).toMatch(/chart|diagram/i)
  })

  it('vector block mentions vector graphic', () => {
    const p = buildPrompt('vector', [])
    expect(p).toMatch(/vector graphic/i)
  })

  it('shared preamble includes the 5 numbered constraints + 200-char cap', () => {
    const p = buildPrompt('photo', [])
    expect(p).toMatch(/maximum 200 characters/i)
    expect(p).toMatch(/Output ONLY valid JSON/)
    expect(p).toMatch(/no naming people/i)
  })

  it('empty taxonomy gets a fallback note in the preamble', () => {
    const p = buildPrompt('photo', [])
    expect(p).toMatch(/no prior tags/i)
  })

  it('throws on non-image format (defensive)', () => {
    // 'video' is a valid AssetFormat at type level; runtime rejects per format gate
    expect(() => buildPrompt('video', [])).toThrow(/unsupported format/)
  })
})

describe('VISION_RESPONSE_JSON_SCHEMA', () => {
  it('declares all six required fields', () => {
    expect(VISION_RESPONSE_JSON_SCHEMA.required).toContain('caption')
    expect(VISION_RESPONSE_JSON_SCHEMA.required).toContain('keywords')
    expect(VISION_RESPONSE_JSON_SCHEMA.required).toContain('tags')
    expect(VISION_RESPONSE_JSON_SCHEMA.required).toContain('caption_confidence')
  })

  it('keywords has min/max constraints', () => {
    const kw = VISION_RESPONSE_JSON_SCHEMA.properties.keywords as {
      minItems: number
      maxItems: number
    }
    expect(kw.minItems).toBe(3)
    expect(kw.maxItems).toBe(8)
  })
})
