/**
 * Assignment Engine — Background Job Definitions
 *
 * Typed job specifications for recurring assignment lifecycle tasks.
 * In the mock phase, jobs are invocable functions.
 * In production, these become Inngest functions or cron-triggered endpoints.
 *
 * Each job:
 *  1. Scans the assignment store for candidates
 *  2. Calls the relevant domain service
 *  3. Persists the updated assignment
 *  4. Returns a summary of actions taken
 *
 * Jobs are idempotent: running the same job twice produces the same result.
 */

import { listAssignments, putAssignment } from './store'
import {
  autoDenyExpiredCCR,
  evaluateProvisionalReleaseEligibility,
  queueCreatorSettlement,
} from './services'
import { emitAssignmentEvent } from './events'

// ══════════════════════════════════════════════
// JOB RESULT TYPE
// ══════════════════════════════════════════════

export interface JobResult {
  jobName: string
  ranAt: string
  processed: number
  acted: number
  details: string[]
}

function jobResult(jobName: string, acted: number, details: string[]): JobResult {
  return {
    jobName,
    ranAt: new Date().toISOString(),
    processed: details.length,
    acted,
    details,
  }
}

// ══════════════════════════════════════════════
// 1. CCR_AUTO_DENY
// Scans all assignments with pending CCRs past their response deadline.
// Calls autoDenyExpiredCCR for each.
// Schedule: every 1 hour.
// ══════════════════════════════════════════════

export function runCCRAutoDeny(): JobResult {
  const assignments = listAssignments()
  const details: string[] = []
  let acted = 0

  for (const assignment of assignments) {
    const hasPending = assignment.ccrHistory.some(c => c.state === 'pending')
    if (!hasPending) continue

    const before = assignment.subState
    const updated = autoDenyExpiredCCR(assignment)

    if (updated !== assignment) {
      putAssignment(updated)
      acted++
      details.push(`${assignment.id}: CCR auto-denied (was ${before})`)
    } else {
      details.push(`${assignment.id}: pending CCR not yet expired`)
    }
  }

  return jobResult('CCR_AUTO_DENY', acted, details)
}

// ══════════════════════════════════════════════
// 2. PROVISIONAL_RELEASE_CHECK
// Scans delivered assignments for 14-day no-response eligibility.
// Calls evaluateProvisionalReleaseEligibility for each.
// Schedule: every 6 hours.
// ══════════════════════════════════════════════

export function runProvisionalReleaseCheck(): JobResult {
  const assignments = listAssignments()
  const details: string[] = []
  let acted = 0

  for (const assignment of assignments) {
    if (assignment.state !== 'delivered') continue

    const updated = evaluateProvisionalReleaseEligibility(assignment)

    if (updated.subState === 'provisional_release_eligible' && assignment.subState !== 'provisional_release_eligible') {
      putAssignment(updated)
      acted++
      details.push(`${assignment.id}: now eligible for provisional release`)
    } else {
      details.push(`${assignment.id}: not yet eligible`)
    }
  }

  return jobResult('PROVISIONAL_RELEASE_CHECK', acted, details)
}

// ══════════════════════════════════════════════
// 3. SETTLEMENT_SLA_MONITOR
// Scans confirmed assignments with settlement_queued sub-state.
// Alerts if settlement has been queued for > 7 days without Stripe confirmation.
// Schedule: every 12 hours.
// ══════════════════════════════════════════════

const SETTLEMENT_SLA_DAYS = 7

export function runSettlementSLAMonitor(): JobResult {
  const assignments = listAssignments()
  const details: string[] = []
  let acted = 0

  for (const assignment of assignments) {
    if (assignment.state !== 'confirmed' || assignment.subState !== 'settlement_queued') continue

    // Check if completedAt is > 7 days ago
    if (!assignment.completedAt) continue
    const completedDate = new Date(assignment.completedAt)
    const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceCompletion > SETTLEMENT_SLA_DAYS) {
      acted++
      details.push(`${assignment.id}: settlement SLA breached (${Math.floor(daysSinceCompletion)} days since completion)`)

      emitAssignmentEvent('settlement_queued', `Settlement SLA alert: ${Math.floor(daysSinceCompletion)} days without Stripe confirmation`, {
        assignmentId: assignment.id,
        actorId: 'system',
        actorRole: 'system',
        metadata: { daysSinceCompletion: Math.floor(daysSinceCompletion), slaDays: SETTLEMENT_SLA_DAYS },
      })
    } else {
      details.push(`${assignment.id}: settlement within SLA (${Math.floor(daysSinceCompletion)} days)`)
    }
  }

  return jobResult('SETTLEMENT_SLA_MONITOR', acted, details)
}

// ══════════════════════════════════════════════
// 4. MILESTONE_DUE_ALERT
// Scans active milestones approaching or past their due date.
// Emits alert events for milestones due within 48 hours or overdue.
// Schedule: every 6 hours.
// ══════════════════════════════════════════════

const DUE_ALERT_HOURS = 48

export function runMilestoneDueAlert(): JobResult {
  const assignments = listAssignments()
  const details: string[] = []
  let acted = 0

  for (const assignment of assignments) {
    if (assignment.state !== 'in_progress' && assignment.state !== 'delivered') continue

    for (const milestone of assignment.milestones) {
      if (milestone.state !== 'active' && milestone.state !== 'fulfilment_submitted') continue

      const dueDate = new Date(milestone.dueDate)
      const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60)

      if (hoursUntilDue < 0) {
        acted++
        const overdueDays = Math.floor(Math.abs(hoursUntilDue) / 24)
        details.push(`${assignment.id}/${milestone.id}: OVERDUE by ${overdueDays} days`)

        emitAssignmentEvent('milestone_activated', `Milestone overdue alert: '${milestone.title}' overdue by ${overdueDays} days`, {
          assignmentId: assignment.id,
          milestoneId: milestone.id,
          actorId: 'system',
          actorRole: 'system',
          metadata: { overdueDays, dueDate: milestone.dueDate },
        })
      } else if (hoursUntilDue <= DUE_ALERT_HOURS) {
        acted++
        details.push(`${assignment.id}/${milestone.id}: due in ${Math.floor(hoursUntilDue)} hours`)

        emitAssignmentEvent('milestone_activated', `Milestone due soon: '${milestone.title}' due in ${Math.floor(hoursUntilDue)} hours`, {
          assignmentId: assignment.id,
          milestoneId: milestone.id,
          actorId: 'system',
          actorRole: 'system',
          metadata: { hoursUntilDue: Math.floor(hoursUntilDue), dueDate: milestone.dueDate },
        })
      }
    }
  }

  return jobResult('MILESTONE_DUE_ALERT', acted, details)
}

// ══════════════════════════════════════════════
// JOB REGISTRY
// Maps job names to runner functions for dispatch.
// ══════════════════════════════════════════════

export const JOB_REGISTRY: Record<string, () => JobResult> = {
  CCR_AUTO_DENY: runCCRAutoDeny,
  PROVISIONAL_RELEASE_CHECK: runProvisionalReleaseCheck,
  SETTLEMENT_SLA_MONITOR: runSettlementSLAMonitor,
  MILESTONE_DUE_ALERT: runMilestoneDueAlert,
}

export type JobName = keyof typeof JOB_REGISTRY

/** Run a named job. Returns null if job name is unknown. */
export function runJob(name: string): JobResult | null {
  const runner = JOB_REGISTRY[name]
  if (!runner) return null
  return runner()
}
