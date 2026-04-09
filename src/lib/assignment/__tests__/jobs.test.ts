import { describe, it, expect, beforeEach } from 'vitest'
import {
  runCCRAutoDeny,
  runProvisionalReleaseCheck,
  runSettlementSLAMonitor,
  runMilestoneDueAlert,
  runJob,
  JOB_REGISTRY,
} from '../jobs'
import { _resetStore, putAssignment, listAssignments } from '../store'
import { _clearEventBuffer, getEventCount, getAssignmentEvents } from '../events'
import { materialAssignment, serviceAssignment, hybridAssignment } from '../mock-data'
import type { Assignment } from '@/lib/types'

beforeEach(() => {
  _resetStore()
  _clearEventBuffer()
})

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursFromNow(n: number): string {
  const d = new Date()
  d.setTime(d.getTime() + n * 60 * 60 * 1000)
  return d.toISOString()
}

// ──────────────────────────────────────────────
// runCCRAutoDeny
// ──────────────────────────────────────────────

describe('runCCRAutoDeny', () => {
  it('returns acted = 0 when no pending CCRs exist', () => {
    // Clear hybrid (the only one with a CCR) and replace with no-CCR assignments
    const noCCR: Assignment = {
      ...serviceAssignment,
      ccrHistory: [],
    }
    putAssignment(noCCR)

    // Also remove hybrid which has a pending CCR
    const hybridNoCCR: Assignment = {
      ...hybridAssignment,
      ccrHistory: [],
    }
    putAssignment(hybridNoCCR)

    const result = runCCRAutoDeny()
    expect(result.acted).toBe(0)
    expect(result.jobName).toBe('CCR_AUTO_DENY')
  })

  it('auto-denies a pending CCR with an expired deadline', () => {
    const expiredCCRAssignment: Assignment = {
      ...hybridAssignment,
      ccrHistory: [
        {
          ...hybridAssignment.ccrHistory[0],
          state: 'pending',
          responseDeadline: daysAgo(3), // expired 3 days ago
        },
      ],
    }
    putAssignment(expiredCCRAssignment)

    const result = runCCRAutoDeny()
    expect(result.acted).toBeGreaterThanOrEqual(1)
    expect(result.details.some(d => d.includes('CCR auto-denied'))).toBe(true)
  })

  it('does not auto-deny a pending CCR whose deadline is in the future', () => {
    const futureCCRAssignment: Assignment = {
      ...hybridAssignment,
      ccrHistory: [
        {
          ...hybridAssignment.ccrHistory[0],
          state: 'pending',
          responseDeadline: hoursFromNow(72), // 3 days from now
        },
      ],
    }
    putAssignment(futureCCRAssignment)

    // The other mock assignments have no CCRs, so only hybrid is relevant
    const result = runCCRAutoDeny()
    // Hybrid has a pending CCR but it's not expired, so it should appear in details but not acted
    const hybridDetail = result.details.find(d => d.includes(hybridAssignment.id))
    expect(hybridDetail).toContain('not yet expired')
  })
})

// ──────────────────────────────────────────────
// runProvisionalReleaseCheck
// ──────────────────────────────────────────────

describe('runProvisionalReleaseCheck', () => {
  it('returns acted = 0 when no delivered assignments exist', () => {
    // Replace all assignments with in_progress ones
    const inProgressOnly: Assignment = {
      ...materialAssignment,
      state: 'in_progress',
      subState: 'active',
    }
    putAssignment(inProgressOnly)

    // service is already in_progress, hybrid is in_progress
    const result = runProvisionalReleaseCheck()
    expect(result.acted).toBe(0)
    expect(result.jobName).toBe('PROVISIONAL_RELEASE_CHECK')
  })

  it('marks a delivered assignment as provisional_release_eligible when submission is > 14 days old', () => {
    const oldSubmission: Assignment = {
      ...materialAssignment,
      state: 'delivered',
      subState: 'review_open',
      milestones: [
        materialAssignment.milestones[0], // accepted — ignored by the check
        {
          ...materialAssignment.milestones[1],
          state: 'fulfilment_submitted',
          fulfilmentSubmissions: [
            {
              ...materialAssignment.milestones[1].fulfilmentSubmissions[0],
              submittedAt: daysAgo(20), // 20 days ago, well past 14-day threshold
            },
          ],
        },
      ],
      escrow: {
        ...materialAssignment.escrow,
        totalFrozenCents: 0,
      },
    }
    putAssignment(oldSubmission)

    const result = runProvisionalReleaseCheck()
    expect(result.acted).toBeGreaterThanOrEqual(1)
    expect(result.details.some(d => d.includes('eligible for provisional release'))).toBe(true)
  })

  it('does not mark a delivered assignment when submission is < 14 days old', () => {
    const recentSubmission: Assignment = {
      ...materialAssignment,
      state: 'delivered',
      subState: 'review_open',
      milestones: [
        materialAssignment.milestones[0],
        {
          ...materialAssignment.milestones[1],
          state: 'fulfilment_submitted',
          fulfilmentSubmissions: [
            {
              ...materialAssignment.milestones[1].fulfilmentSubmissions[0],
              submittedAt: daysAgo(5), // only 5 days ago
            },
          ],
        },
      ],
    }
    putAssignment(recentSubmission)

    const result = runProvisionalReleaseCheck()
    const matDetail = result.details.find(d => d.includes(materialAssignment.id))
    expect(matDetail).toContain('not yet eligible')
  })
})

// ──────────────────────────────────────────────
// runSettlementSLAMonitor
// ──────────────────────────────────────────────

describe('runSettlementSLAMonitor', () => {
  it('returns acted = 0 when no confirmed/settlement_queued assignments exist', () => {
    // Default mock data has no confirmed/settlement_queued assignments
    const result = runSettlementSLAMonitor()
    expect(result.acted).toBe(0)
    expect(result.jobName).toBe('SETTLEMENT_SLA_MONITOR')
  })

  it('detects SLA breach for a confirmed assignment with completedAt > 7 days ago', () => {
    const breachedAssignment: Assignment = {
      ...materialAssignment,
      state: 'confirmed',
      subState: 'settlement_queued',
      completedAt: daysAgo(10), // 10 days ago, past 7-day SLA
    }
    putAssignment(breachedAssignment)

    const result = runSettlementSLAMonitor()
    expect(result.acted).toBeGreaterThanOrEqual(1)
    expect(result.details.some(d => d.includes('settlement SLA breached'))).toBe(true)

    // Verify that an event was emitted
    const events = getAssignmentEvents(materialAssignment.id)
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events.some(e => e.type === 'settlement_queued')).toBe(true)
  })

  it('does not flag a confirmed assignment within the SLA window', () => {
    const withinSLA: Assignment = {
      ...materialAssignment,
      state: 'confirmed',
      subState: 'settlement_queued',
      completedAt: daysAgo(3), // only 3 days ago
    }
    putAssignment(withinSLA)

    const result = runSettlementSLAMonitor()
    expect(result.acted).toBe(0)
    const matDetail = result.details.find(d => d.includes(materialAssignment.id))
    expect(matDetail).toContain('within SLA')
  })

  it('skips confirmed assignments without completedAt', () => {
    const noCompletedAt: Assignment = {
      ...materialAssignment,
      state: 'confirmed',
      subState: 'settlement_queued',
      completedAt: null,
    }
    putAssignment(noCompletedAt)

    const result = runSettlementSLAMonitor()
    expect(result.acted).toBe(0)
  })
})

// ──────────────────────────────────────────────
// runMilestoneDueAlert
// ──────────────────────────────────────────────

describe('runMilestoneDueAlert', () => {
  it('returns acted = 0 when no active milestones are approaching due date', () => {
    // Default service assignment has active milestone with a future due date
    // Replace with far-future due dates
    const farFuture: Assignment = {
      ...serviceAssignment,
      milestones: serviceAssignment.milestones.map(m => ({
        ...m,
        dueDate: hoursFromNow(720), // 30 days from now
      })),
    }
    putAssignment(farFuture)

    // Material assignment is delivered, check its milestones too
    const matFarFuture: Assignment = {
      ...materialAssignment,
      milestones: materialAssignment.milestones.map(m => ({
        ...m,
        dueDate: hoursFromNow(720),
      })),
    }
    putAssignment(matFarFuture)

    const result = runMilestoneDueAlert()
    expect(result.acted).toBe(0)
    expect(result.jobName).toBe('MILESTONE_DUE_ALERT')
  })

  it('emits an alert for an overdue active milestone', () => {
    const overdueAssignment: Assignment = {
      ...serviceAssignment,
      state: 'in_progress',
      subState: 'active',
      milestones: [
        serviceAssignment.milestones[0], // accepted — skipped by the job
        {
          ...serviceAssignment.milestones[1],
          state: 'active',
          dueDate: daysAgo(5), // overdue by 5 days
        },
        serviceAssignment.milestones[2], // pending — skipped by the job
      ],
    }
    putAssignment(overdueAssignment)

    // Ensure material assignment milestones are far in the future so they don't interfere
    const matFarFuture: Assignment = {
      ...materialAssignment,
      milestones: materialAssignment.milestones.map(m => ({
        ...m,
        dueDate: hoursFromNow(720),
      })),
    }
    putAssignment(matFarFuture)

    const result = runMilestoneDueAlert()
    expect(result.acted).toBeGreaterThanOrEqual(1)
    expect(result.details.some(d => d.includes('OVERDUE'))).toBe(true)

    // Verify event was emitted
    const events = getAssignmentEvents(serviceAssignment.id)
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events.some(e => e.description.includes('overdue'))).toBe(true)
  })

  it('emits an alert for a milestone due within 48 hours', () => {
    const soonDueAssignment: Assignment = {
      ...serviceAssignment,
      state: 'in_progress',
      subState: 'active',
      milestones: [
        serviceAssignment.milestones[0], // accepted
        {
          ...serviceAssignment.milestones[1],
          state: 'active',
          dueDate: hoursFromNow(24), // due in 24 hours — within 48h window
        },
        serviceAssignment.milestones[2], // pending
      ],
    }
    putAssignment(soonDueAssignment)

    const matFarFuture: Assignment = {
      ...materialAssignment,
      milestones: materialAssignment.milestones.map(m => ({
        ...m,
        dueDate: hoursFromNow(720),
      })),
    }
    putAssignment(matFarFuture)

    const result = runMilestoneDueAlert()
    expect(result.acted).toBeGreaterThanOrEqual(1)
    expect(result.details.some(d => d.includes('due in'))).toBe(true)
  })
})

// ──────────────────────────────────────────────
// runJob
// ──────────────────────────────────────────────

describe('runJob', () => {
  it('returns a result for known job names', () => {
    const result = runJob('CCR_AUTO_DENY')
    expect(result).not.toBeNull()
    expect(result!.jobName).toBe('CCR_AUTO_DENY')
    expect(result!.ranAt).toBeDefined()
  })

  it('returns null for unknown job names', () => {
    const result = runJob('NONEXISTENT_JOB')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = runJob('')
    expect(result).toBeNull()
  })
})

// ──────────────────────────────────────────────
// JOB_REGISTRY
// ──────────────────────────────────────────────

describe('JOB_REGISTRY', () => {
  it('has all 4 job names registered', () => {
    const expectedJobs = [
      'CCR_AUTO_DENY',
      'PROVISIONAL_RELEASE_CHECK',
      'SETTLEMENT_SLA_MONITOR',
      'MILESTONE_DUE_ALERT',
    ]

    for (const name of expectedJobs) {
      expect(JOB_REGISTRY).toHaveProperty(name)
      expect(typeof JOB_REGISTRY[name]).toBe('function')
    }
  })

  it('has exactly 4 entries', () => {
    expect(Object.keys(JOB_REGISTRY)).toHaveLength(4)
  })
})
