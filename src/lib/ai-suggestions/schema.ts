/**
 * Frontfiles — AI Suggestions: Zod schemas
 *
 * Centralises every Vertex/Gemini response shape and DB row shape.
 * E3 imports these for response parsing; E5 imports for cluster shape;
 * E6 imports for type inference on UI props.
 */

import * as z from 'zod'

// ─── Per AI-PIPELINE-ARCHITECTURE.md (E1.5) §4.3 ──────────────────
// Gemini structured output schema (Zod-mirror for parsing safety)

export const VisionResponseSchema = z.object({
  caption: z.string().max(200),
  caption_confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).min(3).max(8),
  keywords_confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  tags_confidence: z.number().min(0).max(1),
  new_tags_with_confidence: z
    .array(
      z.object({
        tag: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional()
    .default([]),
})

// ─── DB row shape for asset_proposals ─────────────────────────────

export const ProposalRecordSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  generated_at: z.string(), // ISO timestamp
  generation_status: z.enum([
    'pending',
    'processing',
    'ready',
    'failed',
    'not_applicable',
  ]),
  processing_started_at: z.string().nullable(),
  retry_count: z.number().int().min(0),
  error: z.string().nullable(),
  caption: z.string().nullable(),
  caption_confidence: z.number().nullable(),
  keywords: z.array(z.string()).nullable(),
  keywords_confidence: z.number().nullable(),
  tags: z.array(z.string()).nullable(),
  tags_confidence: z.number().nullable(),
  cluster_id: z.string().uuid().nullable(),
  cluster_confidence: z.number().nullable(),
  model_version: z.string().nullable(),
  generation_cost_cents: z.number().int().nullable(),
  generation_latency_ms: z.number().int().nullable(),
  region: z.enum(['europe-west4', 'us-central1']).nullable(),
})

// ─── DB row shape for asset_proposal_clusters ─────────────────────

export const ClusterRecordSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable(),
  generated_at: z.string(),
  proposed_name: z.string().nullable(),
  asset_count: z.number().int().min(1),
  silhouette_score: z.number().nullable(),
  model_version: z.string(),
  region: z.enum(['europe-west4', 'us-central1']),
  accepted_as_story_group_id: z.string().uuid().nullable(),
  accepted_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
})

// ─── Audit event shape (writes to asset_proposal_audit_log) ───────

export const AuditEventSchema = z.object({
  asset_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  event_type: z.enum([
    'proposal_generated',
    'proposal_accepted',
    'proposal_overridden',
    'proposal_dismissed',
    'cluster_proposed',
    'cluster_accepted',
    'cluster_dismissed',
  ]),
  proposal_id: z.string().uuid().nullable().optional(),
  cluster_id: z.string().uuid().nullable().optional(),
  field_name: z.enum(['caption', 'keywords', 'tags']).nullable().optional(),
  before_value: z.unknown().nullable().optional(),
  after_value: z.unknown().nullable().optional(),
  surface: z.enum(['upload', 'vault_edit', 'bulk_action', 'system']),
  override_reason: z.string().nullable().optional(),
})

export type VisionResponse = z.infer<typeof VisionResponseSchema>
export type ProposalRecord = z.infer<typeof ProposalRecordSchema>
export type ClusterRecord = z.infer<typeof ClusterRecordSchema>
export type AuditEvent = z.infer<typeof AuditEventSchema>
