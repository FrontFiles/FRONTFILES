/**
 * Frontfiles — V4 client-side wrapper for the AI proposal API routes (E6)
 *
 * Per E6-DIRECTIVE.md §5.
 *
 * Used by V4 components to call the 8 API routes. All routes require
 * x-creator-id; this wrapper expects callers to pass creatorId.
 */

import type { HydrationResult } from '@/lib/ai-suggestions/hydration'

type Surface = 'upload' | 'vault_edit' | 'bulk_action' | 'system'
type ProposalField = 'caption' | 'keywords' | 'tags'

const headers = (creatorId: string): HeadersInit => ({
  'content-type': 'application/json',
  'x-creator-id': creatorId,
})

export async function fetchAiProposalsForBatch(
  batchId: string,
  creatorId: string,
): Promise<HydrationResult> {
  const res = await fetch(`/api/v2/batch/${batchId}/ai-proposals`, {
    method: 'GET',
    headers: headers(creatorId),
  })
  if (!res.ok) {
    if (res.status === 503) return { proposals: [], clusters: [], optedOut: false }
    throw new Error(`fetchAiProposalsForBatch failed: ${res.status}`)
  }
  return res.json() as Promise<HydrationResult>
}

export async function acceptProposalFields(
  assetId: string,
  creatorId: string,
  fields: ProposalField[],
  surface: Surface,
): Promise<void> {
  const res = await fetch(`/api/v2/asset/${assetId}/proposal/accept`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ fields, surface }),
  })
  if (!res.ok) throw new Error(`acceptProposalFields failed: ${res.status}`)
}

export async function dismissProposalField(
  assetId: string,
  creatorId: string,
  surface: Surface,
  field?: ProposalField,
): Promise<void> {
  const res = await fetch(`/api/v2/asset/${assetId}/proposal/dismiss`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ field, surface }),
  })
  if (!res.ok) throw new Error(`dismissProposalField failed: ${res.status}`)
}

export async function overrideProposalField(
  assetId: string,
  creatorId: string,
  field: ProposalField,
  value: unknown,
  surface: Surface,
  overrideReason?: string,
): Promise<void> {
  const res = await fetch(`/api/v2/asset/${assetId}/proposal/override`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ field, value, surface, override_reason: overrideReason }),
  })
  if (!res.ok) throw new Error(`overrideProposalField failed: ${res.status}`)
}

export async function regenerateProposalForAsset(
  assetId: string,
  creatorId: string,
  surface: Surface,
): Promise<void> {
  const res = await fetch(`/api/v2/asset/${assetId}/proposal/regenerate`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ surface }),
  })
  if (!res.ok && res.status !== 202) throw new Error(`regenerateProposalForAsset failed: ${res.status}`)
}

export async function acceptClusterProposal(
  clusterId: string,
  creatorId: string,
  acceptedAsStoryGroupId?: string,
): Promise<void> {
  const res = await fetch(`/api/v2/cluster/${clusterId}/accept`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ surface: 'upload', accepted_as_story_group_id: acceptedAsStoryGroupId }),
  })
  if (!res.ok) throw new Error(`acceptClusterProposal failed: ${res.status}`)
}

export async function dismissClusterProposal(
  clusterId: string,
  creatorId: string,
): Promise<void> {
  const res = await fetch(`/api/v2/cluster/${clusterId}/dismiss`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({ surface: 'upload' }),
  })
  if (!res.ok) throw new Error(`dismissClusterProposal failed: ${res.status}`)
}

export async function reanalyzeBatch(batchId: string, creatorId: string): Promise<void> {
  const res = await fetch(`/api/v2/batch/${batchId}/reanalyze`, {
    method: 'POST',
    headers: headers(creatorId),
  })
  if (!res.ok && res.status !== 202) throw new Error(`reanalyzeBatch failed: ${res.status}`)
}
