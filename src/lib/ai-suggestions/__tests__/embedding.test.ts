import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildEmbeddingInput } from '../embedding'

const mockUpsert = vi.fn()
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  isSupabaseConfigured: () => true,
}))

vi.mock('@/lib/ai/google', () => ({
  generateEmbedding: vi.fn().mockResolvedValue({
    embedding: new Array(768).fill(0.1),
    modelVersion: 'text-embedding-004',
    inputTokens: 50,
    latencyMs: 10,
  }),
}))

beforeEach(() => {
  mockUpsert.mockReset()
})

describe('buildEmbeddingInput', () => {
  it('formats per spec: "caption | tags | format"', () => {
    expect(buildEmbeddingInput('A bicycle.', ['bike', 'urban'], 'photo')).toBe(
      'A bicycle. | bike, urban | photo',
    )
  })

  it('replaces empty tags with "(no tags)"', () => {
    expect(buildEmbeddingInput('A scene.', [], 'photo')).toBe('A scene. | (no tags) | photo')
  })

  it('handles all 4 image formats', () => {
    expect(buildEmbeddingInput('x', ['t'], 'illustration')).toContain('| illustration')
    expect(buildEmbeddingInput('x', ['t'], 'infographic')).toContain('| infographic')
    expect(buildEmbeddingInput('x', ['t'], 'vector')).toContain('| vector')
  })
})

describe('generateAndUpsertEmbedding', () => {
  it('upserts with correct shape', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    const { generateAndUpsertEmbedding } = await import('../embedding')
    const result = await generateAndUpsertEmbedding({
      assetId: '00000000-0000-0000-0000-000000000001',
      visionResponse: {
        caption: 'A bicycle.',
        caption_confidence: 0.85,
        keywords: ['bike', 'urban', 'evening'],
        keywords_confidence: 0.8,
        tags: ['bike', 'urban'],
        tags_confidence: 0.75,
        new_tags_with_confidence: [],
      },
      format: 'photo',
      region: 'europe-west4',
    })
    expect(result.inputTokens).toBe(50)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: '00000000-0000-0000-0000-000000000001',
        model: 'text-embedding-004',
        region: 'europe-west4',
      }),
    )
    const upsertArg = (mockUpsert.mock.calls[0] as [Record<string, unknown>])[0]
    const embedding = upsertArg.embedding as number[]
    expect(embedding.length).toBe(768)
  })

  it('throws on upsert error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'fk violation' } })
    const { generateAndUpsertEmbedding } = await import('../embedding')
    await expect(
      generateAndUpsertEmbedding({
        assetId: '00000000-0000-0000-0000-000000000001',
        visionResponse: {
          caption: 'x',
          caption_confidence: 0.8,
          keywords: ['a', 'b', 'c'],
          keywords_confidence: 0.8,
          tags: [],
          tags_confidence: 0.8,
          new_tags_with_confidence: [],
        },
        format: 'photo',
        region: 'europe-west4',
      }),
    ).rejects.toThrow(/Failed to upsert asset_embeddings/)
  })
})
