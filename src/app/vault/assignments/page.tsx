'use client'

import { useState } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { ASSIGNMENT_STATE_LABELS } from '@/lib/types'
import type { PrivacyState, Assignment, AssignmentState } from '@/lib/types'

const ASSIGNMENT_STATE_STYLES: Record<AssignmentState, string> = {
  brief_issued: 'border-blue-600 text-blue-600',
  escrow_captured: 'border-blue-600 text-blue-600',
  in_progress: 'bg-blue-600 text-white border-blue-600',
  delivered: 'border-black text-black',
  confirmed: 'bg-black text-white border-black',
  disputed: 'border-2 border-dashed border-black text-black',
  cancelled: 'border-slate-200 text-slate-300',
}

const mockAssignments: Assignment[] = [
  {
    id: 'asgn-001',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    state: 'in_progress',
    brief: 'Document the COP31 summit aftermath, focus on implementation gaps between pledges and action in Southeast Asian nations.',
    deliverables: '10 photos, 1 video package, 1 written report (2000+ words)',
    deadline: '2026-04-15T23:59:00Z',
    budget: 250000,
    escrowAmount: 275000,
    createdAt: '2026-03-25T09:00:00Z',
    deliveredAt: null,
    confirmedAt: null,
  },
  {
    id: 'asgn-002',
    buyerId: 'buyer-001',
    creatorId: 'sarahchen',
    state: 'confirmed',
    brief: 'Cover the Shenzhen semiconductor industry expansion, factory floor access required.',
    deliverables: '8 photos, 1 interview transcript',
    deadline: '2026-03-20T23:59:00Z',
    budget: 180000,
    escrowAmount: 198000,
    createdAt: '2026-03-10T09:00:00Z',
    deliveredAt: '2026-03-19T14:00:00Z',
    confirmedAt: '2026-03-20T10:00:00Z',
  },
]

export default function AssignmentsPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

  const activeAssignments = mockAssignments.filter(a => ['brief_issued', 'escrow_captured', 'in_progress', 'delivered'].includes(a.state))
  const completedAssignments = mockAssignments.filter(a => ['confirmed', 'cancelled'].includes(a.state))

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <VaultLeftRail
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          privacyFilter={privacyFilter}
          onPrivacyFilterChange={setPrivacyFilter}
          onUploadClick={() => {}}
        />
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl flex flex-col gap-8">
            <h1 className="text-2xl font-bold text-black tracking-tight">Assignments</h1>

            {/* Active */}
            {activeAssignments.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Active ({activeAssignments.length})
                </span>
                {activeAssignments.map(a => (
                  <AssignmentCard key={a.id} assignment={a} />
                ))}
              </div>
            )}

            {/* Completed */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Completed ({completedAssignments.length})
              </span>
              {completedAssignments.length > 0 ? (
                completedAssignments.map(a => (
                  <AssignmentCard key={a.id} assignment={a} />
                ))
              ) : (
                <EmptyPanel message="No completed assignments" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const daysRemaining = Math.max(0, Math.ceil((new Date(assignment.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="border-2 border-black px-5 py-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${ASSIGNMENT_STATE_STYLES[assignment.state]}`}>
          {ASSIGNMENT_STATE_LABELS[assignment.state]}
        </span>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-black">€{(assignment.budget / 100).toFixed(2)}</div>
          <div className="text-[10px] text-slate-400">Escrow: €{(assignment.escrowAmount / 100).toFixed(2)}</div>
        </div>
      </div>

      <p className="text-sm text-black leading-relaxed">{assignment.brief}</p>

      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deliverables</span>
            <span className="text-xs text-black">{assignment.deliverables}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deadline</span>
            <span className="text-xs text-black">
              {new Date(assignment.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              {assignment.state === 'in_progress' && (
                <span className="ml-1 text-slate-400">({daysRemaining}d remaining)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {assignment.state === 'in_progress' && (
        <div className="mt-3 flex gap-2">
          <button className="h-8 px-3 text-xs bg-blue-600 text-white font-bold uppercase tracking-wide hover:bg-blue-700 transition-colors">
            Submit delivery
          </button>
        </div>
      )}

      {assignment.state === 'delivered' && (
        <div className="mt-3 flex gap-2">
          <span className="text-[10px] text-slate-400">
            Delivered {assignment.deliveredAt ? new Date(assignment.deliveredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}, awaiting buyer review
          </span>
        </div>
      )}
    </div>
  )
}
