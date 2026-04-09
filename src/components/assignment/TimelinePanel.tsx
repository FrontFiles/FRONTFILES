'use client'

/**
 * Timeline Panel — CEL Event Log for an assignment
 *
 * Shows all domain events in reverse chronological order.
 * Staff, buyer, and creator all see the same timeline.
 */

import { cn } from '@/lib/utils'
import { getAssignmentEvents } from '@/lib/assignment/events'
import type { CertificationEvent } from '@/lib/types'
import { SectionLabel, ShortDate } from './shared'

const EVENT_TYPE_STYLES: Record<string, string> = {
  assignment_created: 'border-black text-black',
  assignment_accepted: 'border-black text-black',
  escrow_captured: 'border-black text-black bg-black/5',
  escrow_released: 'border-black text-black bg-black/5',
  milestone_activated: 'border-blue-600 text-blue-600',
  milestone_accepted: 'border-black bg-black text-white',
  fulfilment_submitted: 'border-blue-600 text-blue-600',
  review_recorded: 'border-black text-black',
  ccr_submitted: 'border-blue-600/50 text-blue-600',
  ccr_resolved: 'border-black/30 text-black/60',
  assignment_disputed: 'border-black text-black',
  dispute_determination: 'border-black text-black',
  provisional_release: 'border-black text-black bg-black/5',
  assignment_cancelled: 'border-black text-black',
  settlement_queued: 'border-black/30 text-black/60',
}

export function TimelinePanel({ assignmentId }: { assignmentId: string }) {
  const events = getAssignmentEvents(assignmentId)
  const sorted = [...events].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div>
      <SectionLabel label={`Timeline (${events.length} events)`} />
      {sorted.length === 0 ? (
        <div className="border-2 border-dashed border-black/15 py-6 text-center">
          <p className="text-[10px] text-black/25 uppercase tracking-widest">No events recorded</p>
        </div>
      ) : (
        <div className="border-2 border-black">
          {sorted.map((event, i) => (
            <div
              key={event.id}
              className={cn(
                'px-4 py-3 flex items-start gap-3',
                i > 0 && 'border-t border-black/10',
              )}
            >
              {/* Timeline dot */}
              <div className="w-1.5 h-1.5 bg-black mt-1.5 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn(
                    'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
                    EVENT_TYPE_STYLES[event.type] ?? 'border-black/20 text-black/40',
                  )}>
                    {event.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[8px] font-mono text-black/20">
                    {new Date(event.timestamp).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-[9px] text-black/60 leading-relaxed">{event.description}</p>
                {event.metadata && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {(event.metadata as Record<string, unknown>).actorId != null && (
                      <span className="text-[7px] font-mono text-black/15">
                        actor: {String((event.metadata as Record<string, unknown>).actorId)}
                      </span>
                    )}
                    {(event.metadata as Record<string, unknown>).milestoneId != null && (
                      <span className="text-[7px] font-mono text-black/15">
                        ms: {String((event.metadata as Record<string, unknown>).milestoneId).slice(-8)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
