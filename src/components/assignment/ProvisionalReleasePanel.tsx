'use client'

/**
 * Provisional Release Status Panel
 *
 * Shows creator-facing status of the 14-day no-response provisional release mechanism.
 * Architecture §14: after 14 days with no buyer review, platform staff may release escrow.
 */

import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import {
  isProvisionalReleaseEligible,
  getMilestonesAwaitingReview,
  centsToEur,
} from '@/lib/assignment/selectors'
import { SectionLabel, FieldLabel, MilestoneStateBadge, PermissionNotice, EmptyState } from './shared'

export function ProvisionalReleasePanel() {
  const { state } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const eligible = isProvisionalReleaseEligible(a)
  const awaitingReview = getMilestonesAwaitingReview(a)
  const isProvisionalState = a.subState === 'provisional_release_eligible' || a.subState === 'provisional_release_executed'

  if (a.state !== 'delivered' && !isProvisionalState) {
    return (
      <div>
        <SectionLabel label="Provisional release" />
        <EmptyState message="Not applicable" detail="Provisional release applies to delivered assignments awaiting buyer review" />
      </div>
    )
  }

  return (
    <div>
      <SectionLabel label="Provisional release" />

      {a.subState === 'provisional_release_executed' ? (
        <div className="border-2 border-black p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-wider bg-black text-white px-2 py-1">
              Released
            </span>
            <span className="text-[8px] text-black/30">Provisional release executed by platform staff</span>
          </div>
          <p className="text-[10px] text-black/60 leading-relaxed">
            Escrow funds for reviewed milestones have been provisionally released. A 30-day external escalation window is now open for the buyer.
          </p>
        </div>
      ) : a.subState === 'provisional_release_eligible' ? (
        <div className="border-2 border-black p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-wider border-2 border-black text-black px-2 py-1">
              Eligible
            </span>
          </div>
          <p className="text-[10px] text-black/60 leading-relaxed mb-3">
            14-day buyer review window has elapsed without response. This assignment is eligible for provisional release by platform staff.
          </p>
          <PermissionNotice>
            Provisional release is a staff-executed action. The creator cannot trigger it directly. Platform operations will review and execute the release.
          </PermissionNotice>
        </div>
      ) : (
        <div className="border-2 border-black/15 p-4">
          <FieldLabel label="Status" />
          <p className="text-[10px] text-black/60 leading-relaxed mb-3">
            {eligible
              ? 'One or more milestones have been awaiting buyer review for 14+ days. Provisional release will be evaluated.'
              : 'Milestones are awaiting buyer review. The 14-day provisional release window has not yet elapsed.'
            }
          </p>

          {awaitingReview.length > 0 && (
            <>
              <FieldLabel label={`Milestones awaiting review (${awaitingReview.length})`} />
              <div className="flex flex-col gap-2">
                {awaitingReview.map(m => {
                  const lastSub = m.fulfilmentSubmissions[m.fulfilmentSubmissions.length - 1]
                  const daysSince = lastSub
                    ? Math.floor((Date.now() - new Date(lastSub.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
                    : 0

                  return (
                    <div key={m.id} className="flex items-center gap-3 py-1 border-b border-black/5 last:border-0">
                      <span className="text-[9px] font-mono text-black/25 w-4">{m.ordinal}</span>
                      <span className="text-[10px] text-black flex-1">{m.title}</span>
                      <MilestoneStateBadge state={m.state} />
                      <span className="text-[9px] font-mono text-black/30">{centsToEur(m.releasableAmountCents)}</span>
                      <span className={cn(
                        'text-[8px] font-mono',
                        daysSince >= 14 ? 'text-black font-bold' : 'text-black/30',
                      )}>
                        {daysSince}d since submission
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <PermissionNotice>
            After 14 days without buyer review, platform staff may provisionally release escrowed funds. A 30-day external escalation window follows.
          </PermissionNotice>
        </div>
      )}
    </div>
  )
}
