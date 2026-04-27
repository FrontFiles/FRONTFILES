/**
 * Frontfiles — AI Suggestions: Shared types
 *
 * Single import surface for downstream code (E4-E6, UI components):
 *   import type { ProposalRecord, ClusterRecord, ... } from '@/lib/ai-suggestions/types'
 *
 * SERVER-SIDE consumers only import the DB-row types here. Client
 * components that surface proposal data should import via API-route
 * response shapes, not directly from this module.
 */

export type {
  VisionResponse,
  ProposalRecord,
  ClusterRecord,
  AuditEvent,
} from './schema'

// Two distinct region types — keep them distinct, do not unify.
//
//   UserAiRegion = high-level enum stored on users.ai_region
//                  (added by E3; default 'eu' for new users outside US).
//   VertexRegion = infrastructure-grain region used in API calls and
//                  stored on asset_proposals.region /
//                  asset_proposal_clusters.region.
//
// The mapping UserAiRegion → VertexRegion happens in the Vertex client
// wrapper added by E3 (src/lib/ai/google.ts). Storage rows record the
// resolved Vertex region, not the user's enum.
export type UserAiRegion = 'eu' | 'us'
export type VertexRegion = 'europe-west4' | 'us-central1'

export type ProposalEventType =
  | 'proposal_generated'
  | 'proposal_accepted'
  | 'proposal_overridden'
  | 'proposal_dismissed'
  | 'cluster_proposed'
  | 'cluster_accepted'
  | 'cluster_dismissed'

export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'not_applicable'

export type AuditSurface = 'upload' | 'vault_edit' | 'bulk_action' | 'system'
