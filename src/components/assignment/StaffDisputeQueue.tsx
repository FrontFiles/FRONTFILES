'use client'

/**
 * Staff Dispute Queue — Lists all assignments in disputed state.
 *
 * Staff-side surface for triaging and navigating to individual dispute consoles.
 * Design canon: black + blue-600 + white. No radius. Hard borders. Dense typography.
 */

import { cn } from '@/lib/utils'
import { mockAssignments } from '@/lib/assignment/mock-data'
import { centsToEur } from '@/lib/assignment/selectors'
import { ClassBadge, ShortDate, EmptyState } from './shared'
import type { Assignment } from '@/lib/types'
import Link from 'next/link'

function getDisputedMilestones(assignment: Assignment) {
  return assignment.milestones.filter(m => m.state === 'disputed')
}

function getContestedAmountCents(assignment: Assignment): number {
  return getDisputedMilestones(assignment).reduce(
    (sum, m) => sum + m.releasableAmountCents,
    0,
  )
}

function getFilerRole(assignment: Assignment): 'buyer' | 'creator' | 'unknown' {
  // In a real system, the dispute case would carry filerRole.
  // For mock purposes, derive from assignment state context.
  // Disputed assignments filed by buyer when review leads to dispute_opened.
  // Default to buyer for now.
  return 'buyer'
}

function getFiledDate(assignment: Assignment): string {
  // Use the most recent milestone that entered disputed state,
  // approximated by the last review determination createdAt or assignment createdAt.
  const disputedMilestones = getDisputedMilestones(assignment)
  const reviewDates = disputedMilestones
    .map(m => m.reviewDetermination?.createdAt)
    .filter(Boolean) as string[]
  if (reviewDates.length > 0) {
    return reviewDates.sort().reverse()[0]
  }
  return assignment.createdAt
}

export function StaffDisputeQueue() {
  const disputedAssignments = mockAssignments.filter(a => a.state === 'disputed')

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-sm font-bold text-black uppercase tracking-[0.12em]">
            Assignment dispute queue
          </h1>
          <span className={cn(
            'text-[9px] font-bold font-mono px-2 py-0.5 border-2',
            disputedAssignments.length > 0
              ? 'border-black bg-black text-white'
              : 'border-black/15 text-black/30',
          )}>
            {disputedAssignments.length}
          </span>
        </div>

        {disputedAssignments.length === 0 ? (
          <EmptyState message="No open disputes" detail="All assignment disputes have been resolved or none have been filed." />
        ) : (
          <div className="border-2 border-black">
            {/* Table header */}
            <div className="grid grid-cols-[100px_80px_1fr_140px_100px_100px_80px] gap-3 px-4 py-2.5 bg-black text-white">
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Assignment</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Class</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Scope</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Disputed milestones</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Contested</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Filed</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Filer</span>
            </div>

            {/* Table rows */}
            {disputedAssignments.map((a, i) => {
              const disputed = getDisputedMilestones(a)
              const contested = getContestedAmountCents(a)
              const filer = getFilerRole(a)
              const filed = getFiledDate(a)

              return (
                <Link
                  key={a.id}
                  href={`/assignment/${a.id}?view=staff`}
                  className={cn(
                    'grid grid-cols-[100px_80px_1fr_140px_100px_100px_80px] gap-3 px-4 py-3 items-center hover:bg-black/[0.02] transition-colors',
                    i > 0 && 'border-t border-black/10',
                  )}
                >
                  <span className="text-[9px] font-mono text-black/50 truncate">{a.id}</span>
                  <ClassBadge cls={a.assignmentClass} size="sm" />
                  <span className="text-[9px] text-black truncate">{a.plan.scope.slice(0, 60)}...</span>
                  <div className="flex flex-col gap-0.5">
                    {disputed.map(m => (
                      <span key={m.id} className="text-[8px] font-mono text-black/50 truncate">
                        #{m.ordinal} {m.title.slice(0, 20)}
                      </span>
                    ))}
                    {disputed.length === 0 && (
                      <span className="text-[8px] text-black/20">Assignment-level</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono font-bold text-black">{centsToEur(contested)}</span>
                  <ShortDate iso={filed} />
                  <span className={cn(
                    'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border text-center',
                    filer === 'buyer' ? 'border-black text-black' : 'border-blue-600 text-blue-600',
                  )}>
                    {filer}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
