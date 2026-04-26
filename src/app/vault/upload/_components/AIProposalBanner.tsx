/**
 * Frontfiles Upload V3 — AI Cluster Proposal Banner (C2.2 §3.8)
 *
 * Spec: UX-SPEC-V3.md §5.2.
 *
 * Renders banners for pending AI cluster proposals. Visible only in
 * Batch + Archive density modes (parent component decides whether to
 * mount). Each banner has a 4px Frontfiles-blue left-edge accent.
 *
 * Multiple banners stack independently. Each accept/dismiss is its
 * own dispatch.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from './UploadContext'

export default function AIProposalBanner() {
  const { state, dispatch } = useUploadContext()
  const pendingProposals = state.aiClusterProposals.filter(p => p.status === 'pending')

  if (pendingProposals.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {pendingProposals.map(proposal => (
        <BannerItem
          key={proposal.proposalId}
          proposal={proposal}
          onAccept={() =>
            dispatch({ type: 'ACCEPT_AI_CLUSTER_PROPOSAL', proposalId: proposal.proposalId })
          }
          onDismiss={() =>
            dispatch({ type: 'DISMISS_AI_CLUSTER_PROPOSAL', proposalId: proposal.proposalId })
          }
        />
      ))}
    </div>
  )
}

function BannerItem({
  proposal,
  onAccept,
  onDismiss,
}: {
  proposal: { proposalId: string; clusterName: string; proposedAssetIds: string[]; rationale: string; confidence: number }
  onAccept: () => void
  onDismiss: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <div className="border border-black bg-white flex border-l-4 border-l-blue-600">
      <div className="flex-1 p-3 min-w-0">
        <div className="text-sm text-black">
          <span className="font-bold">◇</span>{' '}
          {proposal.proposedAssetIds.length} assets appear to be from{' '}
          <span className="font-bold">{proposal.clusterName}</span> — accept as a group?
        </div>
        {detailsOpen && (
          <div className="text-[10px] text-slate-600 mt-2 font-mono">
            <div>Confidence: {(proposal.confidence * 100).toFixed(0)}%</div>
            <div>Rationale: {proposal.rationale}</div>
            <div>Asset IDs: {proposal.proposedAssetIds.join(', ')}</div>
          </div>
        )}
      </div>
      <div className="flex items-stretch border-l border-black">
        <button
          type="button"
          onClick={onAccept}
          className="px-4 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors border-r border-black"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors border-r border-black"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen(d => !d)}
          className="px-4 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors"
        >
          {detailsOpen ? 'Hide' : 'Details'}
        </button>
      </div>
    </div>
  )
}
