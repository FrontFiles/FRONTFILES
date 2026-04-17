// ═══════════════════════════════════════════════════════════════
// Validation tests — covers every PostValidationErrorCode.
// These lock the rules before Module 7 (composer) and Module 8
// (API) wire real write paths.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { validatePostInput, POST_BODY_MAX } from '../validation'
import { postMap } from '@/data/posts'
import type { PostInput } from '../types'

// ─── Helpers ──────────────────────────────────────────────────

function makeInput(overrides: Partial<PostInput> = {}): PostInput {
  return {
    authorId: 'creator-005',
    body: 'A plain, valid message attached to a real public asset.',
    attachment: {
      kind: 'asset',
      id: 'asset-001', // real, public, published (Marco, Guaíba)
      creatorUserId: 'creator-001',
    },
    repostOf: null,
    ...overrides,
  }
}

function codes(result: ReturnType<typeof validatePostInput>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code)
}

// ═══════════════════════════════════════════════════════════════
// ok path
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — happy paths', () => {
  it('accepts a plain original post with body + valid attachment', () => {
    expect(validatePostInput(makeInput()).ok).toBe(true)
  })

  it('accepts an original with empty body as long as the attachment resolves', () => {
    const res = validatePostInput(makeInput({ body: '' }))
    expect(res.ok).toBe(true)
  })

  it('accepts a valid repost by a different author', () => {
    const parent = postMap['post-001'] // author: creator-001
    expect(parent).toBeDefined()
    const res = validatePostInput(
      makeInput({
        authorId: 'creator-005', // not post-001's author, no prior repost
        repostOf: parent,
      }),
    )
    expect(res.ok).toBe(true)
  })

  it('accepts story / article / collection attachments', () => {
    const story = validatePostInput(
      makeInput({
        attachment: {
          kind: 'story',
          id: 'story-002',
          creatorUserId: 'creator-002',
        },
      }),
    )
    const article = validatePostInput(
      makeInput({
        attachment: {
          kind: 'article',
          id: 'article-001',
          creatorUserId: 'creator-001',
        },
      }),
    )
    const collection = validatePostInput(
      makeInput({
        attachment: {
          kind: 'collection',
          id: 'collection-001',
          creatorUserId: 'creator-002',
        },
      }),
    )
    expect(story.ok).toBe(true)
    expect(article.ok).toBe(true)
    expect(collection.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// attachment_not_found
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — attachment existence', () => {
  it('rejects a post whose asset attachment does not exist', () => {
    const res = validatePostInput(
      makeInput({
        attachment: {
          kind: 'asset',
          id: 'asset-does-not-exist',
          creatorUserId: 'creator-001',
        },
      }),
    )
    expect(codes(res)).toContain('attachment_not_found')
  })

  it('rejects a post whose story attachment does not exist', () => {
    const res = validatePostInput(
      makeInput({
        attachment: {
          kind: 'story',
          id: 'story-does-not-exist',
          creatorUserId: 'creator-002',
        },
      }),
    )
    expect(codes(res)).toContain('attachment_not_found')
  })

  it('rejects a post whose article attachment does not exist', () => {
    const res = validatePostInput(
      makeInput({
        attachment: {
          kind: 'article',
          id: 'article-does-not-exist',
          creatorUserId: 'creator-001',
        },
      }),
    )
    expect(codes(res)).toContain('attachment_not_found')
  })

  it('rejects a post whose collection attachment does not exist', () => {
    const res = validatePostInput(
      makeInput({
        attachment: {
          kind: 'collection',
          id: 'collection-does-not-exist',
          creatorUserId: 'creator-002',
        },
      }),
    )
    expect(codes(res)).toContain('attachment_not_found')
  })
})

// ═══════════════════════════════════════════════════════════════
// attachment_not_public
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — attachment privacy', () => {
  it('rejects a private/restricted asset attachment', async () => {
    // We use vi.mock-style override: monkey-patch an asset into
    // assetMap with privacyLevel !== PUBLIC so the checker fires
    // the privacy branch. Mutating the map is safe because
    // each test file gets its own module graph.
    const { assetMap } = await import('@/data/assets')
    const original = assetMap['asset-001']
    assetMap['asset-001'] = { ...original, privacyLevel: 'PRIVATE' }
    try {
      const res = validatePostInput(makeInput())
      expect(codes(res)).toContain('attachment_not_public')
    } finally {
      assetMap['asset-001'] = original
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// body_too_long
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — body length', () => {
  it('accepts a body at exactly the max', () => {
    const body = 'a'.repeat(POST_BODY_MAX)
    expect(validatePostInput(makeInput({ body })).ok).toBe(true)
  })

  it('rejects a body one character over the max', () => {
    const body = 'a'.repeat(POST_BODY_MAX + 1)
    const res = validatePostInput(makeInput({ body }))
    expect(codes(res)).toContain('body_too_long')
  })
})

// ═══════════════════════════════════════════════════════════════
// empty_original
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — empty original with invalid attachment', () => {
  it('rejects an empty-body original when the attachment also fails', () => {
    const res = validatePostInput(
      makeInput({
        body: '   ',
        attachment: {
          kind: 'asset',
          id: 'asset-does-not-exist',
          creatorUserId: 'creator-001',
        },
      }),
    )
    expect(codes(res)).toContain('empty_original')
    // Must also include attachment_not_found — one pass, both errors.
    expect(codes(res)).toContain('attachment_not_found')
  })

  it('does NOT fire empty_original when the attachment is valid and body is empty', () => {
    const res = validatePostInput(makeInput({ body: '' }))
    expect(codes(res)).not.toContain('empty_original')
  })
})

// ═══════════════════════════════════════════════════════════════
// self_repost_forbidden
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — self-repost', () => {
  it('rejects reposting your own post', () => {
    const parent = postMap['post-001'] // author: creator-001
    const res = validatePostInput(
      makeInput({ authorId: 'creator-001', repostOf: parent }),
    )
    expect(codes(res)).toContain('self_repost_forbidden')
  })
})

// ═══════════════════════════════════════════════════════════════
// duplicate_repost
// ═══════════════════════════════════════════════════════════════

describe('validatePostInput — duplicate repost', () => {
  it('rejects a second repost of the same parent from the same author', () => {
    // post-006 is already a seeded repost of post-001 by creator-002.
    // So creator-002 reposting post-001 again must fail.
    const parent = postMap['post-001']
    const res = validatePostInput(
      makeInput({ authorId: 'creator-002', repostOf: parent }),
    )
    expect(codes(res)).toContain('duplicate_repost')
  })
})
