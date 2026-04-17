// ═══════════════════════════════════════════════════════════════
// Hydration tests — covers the three cases the spec calls out:
//   1. Valid post → ok card.
//   2. Repost with a chain → ok card with nested repostOf.
//   3. Post whose attachment is no longer public → failure
//      result carrying the placeholder.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { hydratePost } from '../hydrate'
import { postMap } from '@/data/posts'

describe('hydratePost — valid original', () => {
  it('returns ok:true with a card for a valid seeded post', () => {
    const row = postMap['post-001']
    expect(row).toBeDefined()
    const result = hydratePost(row)
    if (!result.ok) throw new Error('expected hydration to succeed')
    expect(result.card.id).toBe('post-001')
    expect(result.card.author.username).toBe('marcooliveira')
    expect(result.card.attachment.kind).toBe('asset')
    expect(result.card.attachment.originalCreator.username).toBe(
      'marcooliveira',
    )
    expect(result.card.repostOf).toBeNull()
    expect(result.card.repostOfRemoved).toBe(false)
  })

  it('hydrates a post whose attachment creator differs from the author', () => {
    const row = postMap['post-003'] // author: creator-010, attachment creator: creator-001
    const result = hydratePost(row)
    if (!result.ok) throw new Error('expected hydration to succeed')
    expect(result.card.author.userId).toBe('creator-010')
    expect(result.card.attachment.originalCreator.userId).toBe('creator-001')
  })

  it('hydrates each attachment kind', () => {
    const kinds = (['post-001', 'post-002', 'post-003', 'post-004'] as const)
      .map((id) => hydratePost(postMap[id]))
      .map((r) => (r.ok ? r.card.attachment.kind : null))
    expect(kinds).toEqual(['asset', 'story', 'article', 'collection'])
  })

  it('allows an empty body when the attachment is valid', () => {
    const row = postMap['post-005']
    const result = hydratePost(row)
    if (!result.ok) throw new Error('expected hydration to succeed')
    expect(result.card.body).toBe('')
  })
})

describe('hydratePost — repost chain', () => {
  it('hydrates a repost with its parent as repostOf', () => {
    const row = postMap['post-006'] // repost of post-001
    const result = hydratePost(row)
    if (!result.ok) throw new Error('expected hydration to succeed')
    expect(result.card.repostOf).not.toBeNull()
    expect(result.card.repostOf?.id).toBe('post-001')
    expect(result.card.repostOfRemoved).toBe(false)
  })

  it('caps repost nesting at 1 level (repost-of-repost drops the grandparent)', () => {
    const row = postMap['post-007'] // repost of post-006, which itself reposts post-001
    const result = hydratePost(row)
    if (!result.ok) throw new Error('expected hydration to succeed')
    expect(result.card.repostOf?.id).toBe('post-006')
    // Grandparent must NOT be nested — the feed renders permalinks
    // for deeper ancestry to keep the UI editorial.
    expect(result.card.repostOf?.repostOf).toBeNull()
  })
})

describe('hydratePost — failure paths', () => {
  it('returns ok:false with placeholder when the attachment is no longer public', async () => {
    const { assetMap } = await import('@/data/assets')
    const original = assetMap['asset-001']
    assetMap['asset-001'] = { ...original, privacyLevel: 'PRIVATE' }
    try {
      const result = hydratePost(postMap['post-001'])
      if (result.ok) {
        throw new Error(
          'expected hydration to fail because asset-001 is now private',
        )
      }
      expect(result.reason).toBe('attachment_not_public')
      expect(result.placeholder.id).toBe('post-001')
      expect(result.placeholder.authorUserId).toBe('creator-001')
    } finally {
      assetMap['asset-001'] = original
    }
  })

  it('returns ok:false with placeholder when the attachment is missing entirely', async () => {
    const { assetMap } = await import('@/data/assets')
    const original = assetMap['asset-001']
    delete (assetMap as Record<string, unknown>)['asset-001']
    try {
      const result = hydratePost(postMap['post-001'])
      if (result.ok) {
        throw new Error('expected hydration to fail on missing attachment')
      }
      expect(result.reason).toBe('attachment_missing')
    } finally {
      assetMap['asset-001'] = original
    }
  })

  it('sets repostOfRemoved when the parent post is removed', async () => {
    // post-006 is a repost of post-001. Flip post-001's status
    // to 'removed' and check that post-006 still hydrates but
    // reports repostOfRemoved=true.
    const row006 = postMap['post-006']
    const row001 = postMap['post-001']
    const originalStatus = row001.status
    postMap['post-001'] = { ...row001, status: 'removed' }
    try {
      const result = hydratePost(row006)
      if (!result.ok) {
        throw new Error(
          'outer repost should still hydrate even when parent is removed',
        )
      }
      expect(result.card.repostOf).toBeNull()
      expect(result.card.repostOfRemoved).toBe(true)
      // The denormalised attachment still renders on the repost row.
      expect(result.card.attachment.kind).toBe('asset')
    } finally {
      postMap['post-001'] = { ...row001, status: originalStatus }
    }
  })
})
