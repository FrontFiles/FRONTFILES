'use client'

import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { CCR_STATE_LABELS } from '@/lib/types'
import type { CommissionChangeRequest } from '@/lib/types'

export function CCRPanel() {
  const { state } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const ccrs = a.ccrHistory

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Commission change requests</span>
        <span className="text-[8px] font-mono text-black/20">{ccrs.length}</span>
      </div>

      {ccrs.length === 0 ? (
        <div className="border-2 border-dashed border-black/15 py-12 text-center">
          <p className="text-[10px] text-black/25 uppercase tracking-widest">No change requests</p>
          <p className="text-[9px] text-black/15 mt-1">CCR is required to amend scope, price, deadline, milestone structure, or rights terms.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {ccrs.map(ccr => (
            <CCRCard key={ccr.id} ccr={ccr} />
          ))}
        </div>
      )}

      {/* CCR rules reminder */}
      <div className="mt-8 border border-black/10 p-4">
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/20 block mb-2">CCR rules</span>
        <ul className="text-[9px] text-black/40 flex flex-col gap-1">
          <li>5 business days to respond. Auto-denied on expiry.</li>
          <li>Informal messaging does not amend the contract.</li>
          <li>Amendable: scope, price, deadline, milestone structure, releasable amounts, evidence requirements, rights terms, assignment class.</li>
        </ul>
      </div>
    </div>
  )
}

function CCRCard({ ccr }: { ccr: CommissionChangeRequest }) {
  const isPending = ccr.state === 'pending'
  const isApproved = ccr.state === 'approved'

  return (
    <div className={cn(
      'border-2 p-4',
      isPending ? 'border-[#0000ff]' :
      isApproved ? 'border-black' :
      'border-black/20'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
            isPending ? 'border-[#0000ff] text-[#0000ff]' :
            isApproved ? 'bg-black text-white border-black' :
            'border-black/20 text-black/40'
          )}>
            {CCR_STATE_LABELS[ccr.state]}
          </span>
          <span className="text-[8px] font-mono text-black/25">{ccr.id}</span>
        </div>
        <span className="text-[8px] font-mono text-black/25">
          {new Date(ccr.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Amended fields */}
      <div className="flex flex-col gap-2 mb-3">
        {ccr.amendedFields.map((f, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-[8px] font-bold uppercase tracking-wider text-black/30 w-16 shrink-0 pt-0.5">{f.field}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-black/40 line-through">{f.currentValue}</span>
                <span className="text-[9px] text-black/20">→</span>
                <span className="text-[9px] text-black font-bold">{f.proposedValue}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rationale */}
      <div className="border-t border-black/10 pt-2">
        <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block mb-1">Rationale</span>
        <p className="text-[9px] text-black/50 leading-relaxed">{ccr.rationale}</p>
      </div>

      {/* Response deadline */}
      {isPending && (
        <div className="border-t border-black/10 pt-2 mt-2 flex items-center justify-between">
          <span className="text-[8px] text-black/30">Response deadline</span>
          <span className="text-[8px] font-mono font-bold text-[#0000ff]">
            {new Date(ccr.responseDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Response */}
      {ccr.respondedAt && ccr.responseNote && (
        <div className="border-t border-black/10 pt-2 mt-2">
          <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block mb-1">Response</span>
          <p className="text-[9px] text-black/50">{ccr.responseNote}</p>
          <span className="text-[8px] font-mono text-black/20 mt-1 block">{new Date(ccr.respondedAt).toLocaleDateString('en-GB')}</span>
        </div>
      )}
    </div>
  )
}
