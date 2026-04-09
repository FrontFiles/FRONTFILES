'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { mockAssignments } from '@/lib/assignment/mock-data'
import {
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_CLASS_LABELS,
} from '@/lib/types'
import { centsToEur, getAssignmentProgress, getWaitingParty } from '@/lib/assignment/selectors'

export default function AssignmentListPage() {
  const disputed = mockAssignments.filter(a => a.state === 'disputed')

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block">Assignment engine</span>
            <h1 className="text-xl font-bold text-black mt-1">Assignments</h1>
          </div>
          <div className="flex items-center gap-2">
            {disputed.length > 0 && (
              <Link
                href="/assignment/disputes"
                className="text-[9px] font-bold uppercase tracking-wider border-2 border-black px-3 py-1.5 text-black hover:bg-black/5 transition-colors"
              >
                Dispute queue ({disputed.length})
              </Link>
            )}
            <Link
              href="/assignment/new"
              className="text-[9px] font-bold uppercase tracking-wider bg-black text-white px-3 py-1.5 hover:bg-black/90 transition-colors"
            >
              New assignment
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-0">
          {mockAssignments.map((a, i) => {
            const progress = getAssignmentProgress(a)
            const waiting = getWaitingParty(a)
            return (
              <Link
                key={a.id}
                href={`/assignment/${a.id}`}
                className={cn(
                  'border-2 border-black p-4 hover:bg-black/[0.02] transition-colors flex items-center gap-4',
                  i > 0 && '-mt-[2px]'
                )}
              >
                {/* Class badge */}
                <span className={cn(
                  'text-[8px] font-bold uppercase tracking-[0.12em] px-2 py-1 border shrink-0 w-16 text-center',
                  a.assignmentClass === 'service' ? 'border-blue-600 text-blue-600' :
                  a.assignmentClass === 'hybrid' ? 'border-black text-black bg-black/5' :
                  'border-black text-black'
                )}>
                  {ASSIGNMENT_CLASS_LABELS[a.assignmentClass]}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-black truncate">{a.plan.scope.slice(0, 100)}…</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-black/40 border border-black/15 px-1.5 py-0.5">
                      {ASSIGNMENT_STATE_LABELS[a.state]}
                    </span>
                    <span className="text-[8px] text-black/25">Waiting: {waiting}</span>
                    <span className="text-[8px] font-mono text-black/25">{progress.completed}/{progress.total} milestones</span>
                  </div>
                </div>

                {/* Budget */}
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-bold text-black">{centsToEur(a.escrow.totalCapturedCents)}</span>
                  <span className="text-[8px] text-black/25 block">escrow</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
