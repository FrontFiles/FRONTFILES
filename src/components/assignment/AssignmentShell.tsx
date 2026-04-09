'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import type { Assignment, BuyerCompanyRole } from '@/lib/types'
import type { AssignmentTab } from '@/lib/assignment/types'
import {
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_SUB_STATE_LABELS,
  ASSIGNMENT_CLASS_LABELS,
} from '@/lib/types'
import {
  getWaitingParty,
  getAssignmentProgress,
  getNextActions,
  centsToEur,
  getTotalBudgetCents,
  getTotalReleasedCents,
  getTotalFrozenCents,
  hasPendingCCR,
  canAuthoriseRelease,
} from '@/lib/assignment/selectors'

import { AssignmentOverview } from './AssignmentOverview'
import { MilestoneList } from './MilestoneList'
import { RightsPanel } from './RightsPanel'
import { CCRComposer } from './CCRComposer'
import { FulfilmentComposer } from './FulfilmentComposer'
import { ReviewConsole } from './ReviewConsole'
import { DisputePanel } from './DisputePanel'
import { TimelinePanel } from './TimelinePanel'
import { ProvisionalReleasePanel } from './ProvisionalReleasePanel'
import { ActionBar } from './shared'
import type { ActionBarItem } from './shared'

export type ViewerRole = 'buyer' | 'creator' | 'staff'

const TABS: { id: AssignmentTab; label: string; roles?: ViewerRole[] }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'fulfilment', label: 'Fulfilment' },
  { id: 'rights', label: 'Rights' },
  { id: 'history', label: 'History & CCR' },
]

export function AssignmentShell({ assignment, initialRole }: { assignment: Assignment; initialRole?: ViewerRole }) {
  const { state, dispatch } = useAssignment()
  const [viewerRole, setViewerRole] = useState<ViewerRole>(initialRole ?? 'buyer')
  const [buyerCompanyRole, setBuyerCompanyRole] = useState<BuyerCompanyRole | null>('content_commit_holder')

  useEffect(() => {
    dispatch({ type: 'LOAD_ASSIGNMENT', assignment })
  }, [assignment, dispatch])

  const a = state.assignment
  if (!a) return null

  const waiting = getWaitingParty(a)
  const progress = getAssignmentProgress(a)
  const pendingCCR = hasPendingCCR(a)
  const tab = state.ui.activeTab
  const nextActions = getNextActions(a, viewerRole, viewerRole === 'buyer' ? buyerCompanyRole ?? undefined : undefined)

  // Role-aware action bar
  const actions: ActionBarItem[] = []
  if (viewerRole === 'creator') {
    if (nextActions.includes('accept_brief')) {
      actions.push({
        label: 'Accept brief',
        variant: 'primary',
        onClick: async () => {
          const res = await fetch(`/api/assignment/${a.id}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorId: a.creatorId }),
          })
          if (res.ok) {
            const { data } = await res.json()
            dispatch({ type: 'LOAD_ASSIGNMENT', assignment: data })
          }
        },
      })
    }
    if (nextActions.includes('submit_fulfilment')) {
      const activeMilestone = a.milestones.find(m => m.state === 'active' || m.state === 'changes_requested')
      actions.push({
        label: 'Submit fulfilment',
        variant: 'primary',
        onClick: () => dispatch({ type: 'SHOW_FULFILMENT_FORM', milestoneId: activeMilestone?.id ?? null }),
        disabled: !activeMilestone,
        disabledReason: 'No active milestone to submit fulfilment for',
      })
    }
    if (nextActions.includes('submit_ccr')) {
      actions.push({
        label: 'Request change',
        variant: 'secondary',
        onClick: () => {
          dispatch({ type: 'SET_TAB', tab: 'history' })
          dispatch({ type: 'SHOW_CCR_FORM', show: true })
        },
      })
    }
  }
  if (viewerRole === 'buyer') {
    if (nextActions.includes('review_fulfilment')) {
      const reviewable = a.milestones.find(m => m.state === 'fulfilment_submitted' || m.state === 'review_open')
      actions.push({
        label: 'Review fulfilment',
        variant: 'primary',
        onClick: () => dispatch({ type: 'SET_REVIEWING_MILESTONE', milestoneId: reviewable?.id ?? null }),
        disabled: !reviewable,
      })
    }
    if (nextActions.includes('respond_ccr')) {
      actions.push({
        label: 'Respond to CCR',
        variant: 'primary',
        onClick: () => dispatch({ type: 'SET_TAB', tab: 'history' }),
      })
    }
  }
  if (nextActions.includes('open_dispute')) {
    actions.push({
      label: 'Open dispute',
      variant: 'danger',
      onClick: () => dispatch({ type: 'SET_TAB', tab: 'fulfilment' }),
    })
  }
  if (nextActions.includes('cancel')) {
    actions.push({
      label: 'Cancel',
      variant: 'danger',
      onClick: async () => {
        const res = await fetch(`/api/assignment/${a.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: viewerRole === 'buyer' ? a.buyerId : a.creatorId,
            reason: 'Cancelled via UI',
          }),
        })
        if (res.ok) {
          const { data } = await res.json()
          dispatch({ type: 'LOAD_ASSIGNMENT', assignment: data })
        }
      },
    })
  }

  // Show fulfilment composer overlay
  if (state.ui.showFulfilmentForm && state.ui.fulfilmentDraftMilestoneId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-[900px] mx-auto px-6 py-6">
          <FulfilmentComposer />
        </div>
      </div>
    )
  }

  // Show review console overlay
  if (state.ui.reviewingMilestoneId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-6">
          <ReviewConsole />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Role switcher (demo) */}
      <div className="border-b border-black/10 bg-black/[0.02]">
        <div className="max-w-[1200px] mx-auto px-6 py-2 flex items-center gap-4">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Viewing as</span>
          {(['buyer', 'creator', 'staff'] as ViewerRole[]).map(role => (
            <button
              key={role}
              onClick={() => setViewerRole(role)}
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider px-2 py-1 border transition-colors',
                viewerRole === role ? 'bg-black text-white border-black' : 'border-black/15 text-black/30 hover:border-black/40',
              )}
            >
              {role}
            </button>
          ))}
          {viewerRole === 'buyer' && (
            <>
              <span className="text-[8px] text-black/15">|</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Org role</span>
              {(['content_commit_holder', 'editor', null] as (BuyerCompanyRole | null)[]).map(role => (
                <button
                  key={role ?? 'individual'}
                  onClick={() => setBuyerCompanyRole(role)}
                  className={cn(
                    'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border transition-colors',
                    buyerCompanyRole === role ? 'bg-black text-white border-black' : 'border-black/15 text-black/30 hover:border-black/40',
                  )}
                >
                  {role === 'content_commit_holder' ? 'CCH' : role === 'editor' ? 'Editor' : 'Individual'}
                </button>
              ))}
              {!canAuthoriseRelease(buyerCompanyRole) && (
                <span className="text-[7px] text-black/30 italic">Cannot authorise release</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Header bar */}
      <div className="border-b-2 border-black">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25">Assignment</span>
                <span className={cn(
                  'text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 border',
                  a.assignmentClass === 'material' ? 'border-black text-black' :
                  a.assignmentClass === 'service' ? 'border-blue-600 text-blue-600' :
                  'border-black text-black bg-black/5'
                )}>
                  {ASSIGNMENT_CLASS_LABELS[a.assignmentClass]}
                </span>
              </div>
              <h1 className="text-lg font-bold text-black leading-tight">{a.plan.scope.slice(0, 80)}…</h1>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge state={a.state} subState={a.subState} />
                <span className="text-[9px] text-black/30">
                  Waiting: <span className="font-bold text-black/50">{waiting}</span>
                </span>
                {pendingCCR && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-blue-600 border border-blue-600 px-1.5 py-0.5">
                    CCR pending
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] text-black/30 font-mono">Budget</div>
              <div className="text-sm font-bold font-mono text-black">{centsToEur(getTotalBudgetCents(a))}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] font-mono text-black/40">Released: {centsToEur(getTotalReleasedCents(a))}</span>
                {getTotalFrozenCents(a) > 0 && (
                  <span className="text-[8px] font-mono text-black/40">Frozen: {centsToEur(getTotalFrozenCents(a))}</span>
                )}
              </div>
            </div>
          </div>

          {/* Action bar */}
          {actions.length > 0 && (
            <ActionBar actions={actions} className="mt-4" />
          )}

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-black/5 relative">
              <div
                className="absolute inset-y-0 left-0 bg-black transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-black/30 shrink-0">
              {progress.completed}/{progress.total} milestones
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b-2 border-black">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
              className={cn(
                'px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] border-b-2 transition-colors -mb-[2px]',
                tab === t.id
                  ? 'border-black text-black'
                  : 'border-transparent text-black/25 hover:text-black/50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          {tab === 'overview' && <AssignmentOverview />}
          {tab === 'milestones' && <MilestoneList />}
          {tab === 'fulfilment' && (
            <div className="flex flex-col gap-8">
              <FulfilmentTab viewerRole={viewerRole} />
              <DisputePanel />
              <ProvisionalReleasePanel />
            </div>
          )}
          {tab === 'rights' && <RightsPanel />}
          {tab === 'history' && (
            <div className="flex flex-col gap-8">
              <CCRComposer />
              <TimelinePanel assignmentId={a.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FulfilmentTab({ viewerRole }: { viewerRole: ViewerRole }) {
  const { state, dispatch } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const reviewable = a.milestones.filter(m => m.state === 'fulfilment_submitted' || m.state === 'review_open')
  const submitted = a.milestones.filter(m => m.fulfilmentSubmissions.length > 0)

  return (
    <div>
      {/* Buyer: review prompts */}
      {viewerRole === 'buyer' && reviewable.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Awaiting your review</span>
            <div className="flex-1 border-b border-black/5" />
          </div>
          <div className="flex flex-col gap-2">
            {reviewable.map(m => (
              <div key={m.id} className="border-2 border-blue-600 p-3 flex items-center gap-3">
                <span className="text-[9px] font-mono text-black/25 w-4">{m.ordinal}</span>
                <span className="text-xs font-bold text-black flex-1">{m.title}</span>
                <span className="text-[9px] font-mono text-black/40">{m.fulfilmentSubmissions.length} submission(s)</span>
                <span className="text-[9px] font-mono text-black/40">{centsToEur(m.releasableAmountCents)}</span>
                <button
                  onClick={() => dispatch({ type: 'SET_REVIEWING_MILESTONE', milestoneId: m.id })}
                  className="text-[9px] font-bold uppercase tracking-wider bg-black text-white px-3 py-1.5 hover:bg-black/90 transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Creator: submit prompts */}
      {viewerRole === 'creator' && (
        <section className="mb-6">
          {a.milestones.filter(m => m.state === 'active' || m.state === 'changes_requested').map(m => (
            <div key={m.id} className="border-2 border-black p-3 flex items-center gap-3 mb-2">
              <span className="text-[9px] font-mono text-black/25 w-4">{m.ordinal}</span>
              <span className="text-xs font-bold text-black flex-1">{m.title}</span>
              {m.state === 'changes_requested' && (
                <span className="text-[8px] font-bold uppercase tracking-wider text-black border border-black px-1.5 py-0.5">Changes requested</span>
              )}
              <button
                onClick={() => dispatch({ type: 'SHOW_FULFILMENT_FORM', milestoneId: m.id })}
                className="text-[9px] font-bold uppercase tracking-wider bg-black text-white px-3 py-1.5 hover:bg-black/90 transition-colors"
              >
                Submit fulfilment
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Fulfilment history */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Fulfilment history</span>
          <div className="flex-1 border-b border-black/5" />
        </div>
        {submitted.length === 0 ? (
          <div className="border-2 border-dashed border-black/15 py-6 text-center">
            <p className="text-[10px] text-black/25 uppercase tracking-widest">No fulfilment submitted yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {submitted.map(m => (
              <div key={m.id} className="border-2 border-black">
                <div className="px-4 py-2 border-b border-black/10 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-black/25 w-4">{m.ordinal}</span>
                  <span className="text-xs font-bold text-black">{m.title}</span>
                  <span className={cn(
                    'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border ml-auto',
                    m.milestoneType === 'service' ? 'border-blue-600 text-blue-600' : 'border-black/20 text-black/40',
                  )}>
                    {m.milestoneType}
                  </span>
                </div>
                <div className="p-4">
                  {m.fulfilmentSubmissions.map(sub => (
                    <div key={sub.id} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-black/40">{sub.fulfilmentType} submission</span>
                        <span className="text-[8px] font-mono text-black/20">
                          {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {sub.evidenceItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2 py-0.5">
                            <span className={cn(
                              'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                              item.kind === 'vault_asset' ? 'border-black/20 text-black/40' : 'border-blue-600/30 text-blue-600/60',
                            )}>
                              {item.kind.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[9px] text-black">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      {sub.creatorNotes && (
                        <p className="text-[9px] text-black/40 mt-2 italic">{sub.creatorNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusBadge({ state, subState }: { state: string; subState: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-black border-2 border-black px-1.5 py-0.5">
        {ASSIGNMENT_STATE_LABELS[state as keyof typeof ASSIGNMENT_STATE_LABELS] ?? state}
      </span>
      <span className="text-[8px] text-black/30">
        {ASSIGNMENT_SUB_STATE_LABELS[subState as keyof typeof ASSIGNMENT_SUB_STATE_LABELS] ?? subState}
      </span>
    </div>
  )
}
