/**
 * Frontfiles — AI cluster mutation helpers (E6)
 *
 * Per E6-DIRECTIVE.md §7.6 + §7.7 + §10.
 *
 * Cluster accept = creates / writes a Story group (depending on whether
 * Story groups are server-persisted at E6 ship time; current impl
 * sets accepted_at + writes per-member audit; the actual Story-group
 * server table is a separate pillar).
 *
 * Cluster dismiss = soft-deletes (sets dismissed_at + writes audit).
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { writeAuditEvent } from './audit'
import type { AuditSurface } from './types'

export interface ClusterAcceptOpts {
  clusterId: string
  creatorId: string
  surface: AuditSurface
  /** Optional — set if Story-group server model exists at this point. */
  acceptedAsStoryGroupId?: string
}

export async function acceptCluster(opts: ClusterAcceptOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  // Mark cluster accepted
  const { data: cluster } = await supabase
    .from('asset_proposal_clusters')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_as_story_group_id: opts.acceptedAsStoryGroupId ?? null,
    })
    .eq('id', opts.clusterId)
    .eq('creator_id', opts.creatorId)
    .select('id')
    .maybeSingle()

  if (!cluster) {
    throw new Error('cluster_not_found_or_not_owned')
  }

  // Look up member asset ids for per-member audit
  const { data: members } = await supabase
    .from('asset_proposals')
    .select('asset_id')
    .eq('cluster_id', opts.clusterId)

  for (const m of (members ?? []) as Array<{ asset_id: string }>) {
    await writeAuditEvent({
      asset_id: m.asset_id,
      creator_id: opts.creatorId,
      event_type: 'cluster_accepted',
      cluster_id: opts.clusterId,
      surface: opts.surface,
    })
  }
}

export interface ClusterDismissOpts {
  clusterId: string
  creatorId: string
  surface: AuditSurface
}

export async function dismissCluster(opts: ClusterDismissOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  const { data: cluster } = await supabase
    .from('asset_proposal_clusters')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', opts.clusterId)
    .eq('creator_id', opts.creatorId)
    .select('id')
    .maybeSingle()

  if (!cluster) {
    throw new Error('cluster_not_found_or_not_owned')
  }

  // Look up + null cluster_id on each member
  const { data: members } = await supabase
    .from('asset_proposals')
    .select('asset_id')
    .eq('cluster_id', opts.clusterId)

  const memberIds = ((members ?? []) as Array<{ asset_id: string }>).map((m) => m.asset_id)

  // Clear cluster_id on members so they're eligible for re-clustering
  if (memberIds.length > 0) {
    await supabase
      .from('asset_proposals')
      .update({ cluster_id: null, cluster_confidence: null })
      .in('asset_id', memberIds)
  }

  for (const memberId of memberIds) {
    await writeAuditEvent({
      asset_id: memberId,
      creator_id: opts.creatorId,
      event_type: 'cluster_dismissed',
      cluster_id: opts.clusterId,
      surface: opts.surface,
    })
  }
}
