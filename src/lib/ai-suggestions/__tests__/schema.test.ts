import { describe, it, expect } from 'vitest'
import {
  VisionResponseSchema,
  ProposalRecordSchema,
  ClusterRecordSchema,
  AuditEventSchema,
} from '../schema'

describe('VisionResponseSchema', () => {
  const valid = {
    caption: 'A short caption',
    caption_confidence: 0.85,
    keywords: ['one', 'two', 'three'],
    keywords_confidence: 0.8,
    tags: ['tag-a', 'tag-b'],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  }

  it('accepts a valid response', () => {
    expect(() => VisionResponseSchema.parse(valid)).not.toThrow()
  })

  it('rejects caption longer than 200 chars', () => {
    const long = 'x'.repeat(201)
    expect(() =>
      VisionResponseSchema.parse({ ...valid, caption: long }),
    ).toThrow()
  })

  it('rejects keywords array with fewer than 3 items', () => {
    expect(() =>
      VisionResponseSchema.parse({ ...valid, keywords: ['one', 'two'] }),
    ).toThrow()
  })

  it('rejects keywords array with more than 8 items', () => {
    expect(() =>
      VisionResponseSchema.parse({
        ...valid,
        keywords: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      }),
    ).toThrow()
  })

  it.each([
    ['caption_confidence', -0.1],
    ['caption_confidence', 1.5],
    ['keywords_confidence', -1],
    ['tags_confidence', 2],
  ])('rejects %s outside [0, 1]: %s', (field, value) => {
    expect(() =>
      VisionResponseSchema.parse({ ...valid, [field]: value }),
    ).toThrow()
  })

  it('defaults new_tags_with_confidence to empty array when omitted', () => {
    const { new_tags_with_confidence, ...without } = valid
    void new_tags_with_confidence
    const parsed = VisionResponseSchema.parse(without)
    expect(parsed.new_tags_with_confidence).toEqual([])
  })

  it('accepts new_tags_with_confidence entries with valid shape', () => {
    const parsed = VisionResponseSchema.parse({
      ...valid,
      new_tags_with_confidence: [
        { tag: 'editorial', confidence: 0.85 },
        { tag: 'archive', confidence: 0.9 },
      ],
    })
    expect(parsed.new_tags_with_confidence).toHaveLength(2)
  })
})

describe('ProposalRecordSchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000001',
    asset_id: '00000000-0000-0000-0000-000000000002',
    generated_at: '2026-04-27T12:00:00Z',
    generation_status: 'ready' as const,
    processing_started_at: null,
    retry_count: 0,
    error: null,
    caption: 'A caption',
    caption_confidence: 0.85,
    keywords: ['a', 'b', 'c'],
    keywords_confidence: 0.8,
    tags: ['tag-a'],
    tags_confidence: 0.75,
    cluster_id: null,
    cluster_confidence: null,
    model_version: 'gemini-2.5-flash',
    generation_cost_cents: 1,
    generation_latency_ms: 250,
    region: 'europe-west4' as const,
  }

  it('accepts a fully populated row', () => {
    expect(() => ProposalRecordSchema.parse(valid)).not.toThrow()
  })

  it('accepts a pending row with NULL fields', () => {
    expect(() =>
      ProposalRecordSchema.parse({
        ...valid,
        generation_status: 'pending',
        caption: null,
        caption_confidence: null,
        keywords: null,
        keywords_confidence: null,
        tags: null,
        tags_confidence: null,
        model_version: null,
        generation_cost_cents: null,
        generation_latency_ms: null,
        region: null,
      }),
    ).not.toThrow()
  })

  it('rejects unknown generation_status', () => {
    expect(() =>
      ProposalRecordSchema.parse({
        ...valid,
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        generation_status: 'queued' as 'pending',
      }),
    ).toThrow()
  })

  it('rejects negative retry_count', () => {
    expect(() =>
      ProposalRecordSchema.parse({ ...valid, retry_count: -1 }),
    ).toThrow()
  })

  it('rejects unknown region', () => {
    expect(() =>
      ProposalRecordSchema.parse({
        ...valid,
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        region: 'asia-southeast1' as 'europe-west4',
      }),
    ).toThrow()
  })
})

describe('ClusterRecordSchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000010',
    creator_id: '00000000-0000-0000-0000-000000000020',
    batch_id: null,
    generated_at: '2026-04-27T12:00:00Z',
    proposed_name: 'Mountain shoot',
    asset_count: 12,
    silhouette_score: 0.65,
    model_version: 'gemini-2.5-pro',
    region: 'europe-west4' as const,
    accepted_as_story_group_id: null,
    accepted_at: null,
    dismissed_at: null,
  }

  it('accepts a valid cluster row', () => {
    expect(() => ClusterRecordSchema.parse(valid)).not.toThrow()
  })

  it('rejects asset_count of 0 or negative', () => {
    expect(() =>
      ClusterRecordSchema.parse({ ...valid, asset_count: 0 }),
    ).toThrow()
    expect(() =>
      ClusterRecordSchema.parse({ ...valid, asset_count: -1 }),
    ).toThrow()
  })

  it('rejects missing region (region is NOT NULL on the cluster)', () => {
    expect(() =>
      ClusterRecordSchema.parse({
        ...valid,
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        region: null as unknown as 'europe-west4',
      }),
    ).toThrow()
  })
})

describe('AuditEventSchema', () => {
  const baseEvent = {
    asset_id: '00000000-0000-0000-0000-000000000001',
    creator_id: '00000000-0000-0000-0000-000000000002',
    surface: 'upload' as const,
  }

  it('accepts each valid event_type', () => {
    const types = [
      'proposal_generated',
      'proposal_accepted',
      'proposal_overridden',
      'proposal_dismissed',
      'cluster_proposed',
      'cluster_accepted',
      'cluster_dismissed',
    ] as const
    for (const t of types) {
      expect(() =>
        AuditEventSchema.parse({ ...baseEvent, event_type: t }),
      ).not.toThrow()
    }
  })

  it('rejects unknown event_type', () => {
    expect(() =>
      AuditEventSchema.parse({
        ...baseEvent,
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        event_type: 'proposal_shown' as 'proposal_generated',
      }),
    ).toThrow()
  })

  it('rejects unknown field_name', () => {
    expect(() =>
      AuditEventSchema.parse({
        ...baseEvent,
        event_type: 'proposal_accepted',
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        field_name: 'price' as 'caption',
      }),
    ).toThrow()
  })

  it('rejects unknown surface', () => {
    expect(() =>
      AuditEventSchema.parse({
        ...baseEvent,
        event_type: 'proposal_accepted',
        // Zod parse accepts unknown at the type level; runtime is the assertion target.
        surface: 'admin_console' as 'upload',
      }),
    ).toThrow()
  })
})
