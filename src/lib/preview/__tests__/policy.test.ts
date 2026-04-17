import { describe, it, expect } from 'vitest'
import { resolvePreviewConfig, isFieldVisible, getInlineActions, getHoverActions } from '../policy'
import type { PreviewFamily, PreviewView, PreviewSize } from '../types'

describe('resolvePreviewConfig', () => {
  it('returns a valid config for every family/view/size combination', () => {
    const families: PreviewFamily[] = ['asset', 'frontfiler', 'story', 'article', 'collection']
    const views: PreviewView[] = ['grid', 'list', 'compact', 'search', 'related', 'inline', 'sidebar', 'share']
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

    for (const family of families) {
      for (const view of views) {
        for (const size of sizes) {
          const config = resolvePreviewConfig(family, view, size)
          expect(config.family).toBe(family)
          expect(config.view).toBe(view)
          expect(config.size).toBe(size)
          expect(config.fields.thumbnail).toBe('always')
          expect(config.media.aspectClass).toBeTruthy()
          expect(config.media.aspectRatio).toBeGreaterThan(0)
          expect(config.titleMaxChars).toBeGreaterThan(0)
          expect(config.titleMaxLines).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('thumbnail is always visible — never hidden', () => {
    const families: PreviewFamily[] = ['asset', 'frontfiler', 'story', 'article', 'collection']
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

    for (const family of families) {
      for (const size of sizes) {
        const config = resolvePreviewConfig(family, 'grid', size)
        expect(config.fields.thumbnail).toBe('always')
      }
    }
  })

  it('frontfiler title is always visible', () => {
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      const config = resolvePreviewConfig('frontfiler', 'grid', size)
      expect(config.fields.title).toBe('always')
    }
  })

  it('asset at xs hides actions', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'xs')
    expect(config.fields.actions).toBe('hidden')
  })

  it('compact view hides description', () => {
    const config = resolvePreviewConfig('asset', 'compact', 'md')
    expect(config.fields.description).toBe('hidden')
  })

  it('share view hides actions and price', () => {
    const config = resolvePreviewConfig('asset', 'share', 'md')
    expect(config.fields.actions).toBe('hidden')
    expect(config.fields.price).toBe('hidden')
  })

  it('sidebar view hides actions', () => {
    const config = resolvePreviewConfig('asset', 'sidebar', 'md')
    expect(config.fields.actions).toBe('hidden')
  })
})

describe('isFieldVisible', () => {
  it('always is visible at every size', () => {
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      expect(isFieldVisible('always', size)).toBe(true)
    }
  })

  it('primary is visible at every size', () => {
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      expect(isFieldVisible('primary', size)).toBe(true)
    }
  })

  it('secondary is hidden at xs', () => {
    expect(isFieldVisible('secondary', 'xs')).toBe(false)
    expect(isFieldVisible('secondary', 'sm')).toBe(true)
    expect(isFieldVisible('secondary', 'md')).toBe(true)
  })

  it('tertiary is only visible at lg and xl', () => {
    expect(isFieldVisible('tertiary', 'xs')).toBe(false)
    expect(isFieldVisible('tertiary', 'sm')).toBe(false)
    expect(isFieldVisible('tertiary', 'md')).toBe(false)
    expect(isFieldVisible('tertiary', 'lg')).toBe(true)
    expect(isFieldVisible('tertiary', 'xl')).toBe(true)
  })

  it('hidden is never visible', () => {
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      expect(isFieldVisible('hidden', size)).toBe(false)
    }
  })

  it('overflow is never visible (requires expand)', () => {
    const sizes: PreviewSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      expect(isFieldVisible('overflow', size)).toBe(false)
    }
  })
})

describe('resolveMediaConfig via resolvePreviewConfig', () => {
  it('asset md uses aspect-video', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'md')
    expect(config.media.aspectClass).toBe('aspect-video')
  })

  it('asset lg uses 4/3', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'lg')
    expect(config.media.aspectClass).toBe('aspect-[4/3]')
  })

  it('frontfiler uses 3/4 portrait ratio at md', () => {
    const config = resolvePreviewConfig('frontfiler', 'grid', 'md')
    expect(config.media.aspectClass).toBe('aspect-[3/4]')
    expect(config.media.cropStrategy).toBe('face')
  })

  it('asset xs disables format rendering', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'xs')
    expect(config.media.formatRendering).toBe(false)
  })

  it('asset md enables format rendering', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'md')
    expect(config.media.formatRendering).toBe(true)
  })
})

describe('action visibility', () => {
  it('asset grid md has 4 inline actions', () => {
    const config = resolvePreviewConfig('asset', 'grid', 'md')
    const inline = getInlineActions(config.actions)
    expect(inline).toEqual(['lightbox', 'like', 'comment', 'share'])
  })

  it('frontfiler grid md has follow/message/share', () => {
    const config = resolvePreviewConfig('frontfiler', 'grid', 'md')
    const inline = getInlineActions(config.actions)
    expect(inline).toEqual(['follow', 'message', 'share'])
  })

  it('asset compact moves actions to overflow', () => {
    const config = resolvePreviewConfig('asset', 'compact', 'md')
    const inline = getInlineActions(config.actions)
    expect(inline).toEqual([])
  })

  it('asset sidebar hides all actions', () => {
    const config = resolvePreviewConfig('asset', 'sidebar', 'md')
    const inline = getInlineActions(config.actions)
    const hover = getHoverActions(config.actions)
    expect(inline).toEqual([])
    expect(hover).toEqual([])
  })

  it('share view hides all actions', () => {
    const config = resolvePreviewConfig('asset', 'share', 'md')
    const inline = getInlineActions(config.actions)
    expect(inline).toEqual([])
  })
})
