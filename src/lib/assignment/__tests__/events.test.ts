import { describe, it, expect, beforeEach } from 'vitest'
import {
  emitAssignmentEvent,
  getAssignmentEvents,
  getMilestoneEvents,
  getEventCount,
  _clearEventBuffer,
} from '../events'

beforeEach(() => {
  _clearEventBuffer()
})

describe('emitAssignmentEvent', () => {
  it('appends an event and returns a CertificationEvent with correct fields', () => {
    const event = emitAssignmentEvent(
      'assignment_created',
      'Assignment created for test',
      {
        assignmentId: 'asgn-test-001',
        actorId: 'buyer-01',
        actorRole: 'buyer',
      },
    )

    expect(event.id).toBeDefined()
    expect(event.type).toBe('assignment_created')
    expect(event.description).toBe('Assignment created for test')
    expect(event.timestamp).toBeDefined()
    expect((event.metadata as Record<string, unknown>).assignmentId).toBe('asgn-test-001')
    expect((event.metadata as Record<string, unknown>).actorId).toBe('buyer-01')
    expect((event.metadata as Record<string, unknown>).actorRole).toBe('buyer')
    expect(getEventCount()).toBe(1)
  })

  it('includes milestoneId in metadata when provided', () => {
    const event = emitAssignmentEvent(
      'milestone_activated',
      'Milestone activated',
      {
        assignmentId: 'asgn-test-001',
        milestoneId: 'ms-test-001',
        actorId: 'system',
        actorRole: 'system',
      },
    )

    expect((event.metadata as Record<string, unknown>).milestoneId).toBe('ms-test-001')
  })

  it('sets milestoneId to null when not provided', () => {
    const event = emitAssignmentEvent(
      'assignment_created',
      'No milestone',
      {
        assignmentId: 'asgn-test-001',
        actorId: 'buyer-01',
        actorRole: 'buyer',
      },
    )

    expect((event.metadata as Record<string, unknown>).milestoneId).toBeNull()
  })

  it('includes extra metadata when provided', () => {
    const event = emitAssignmentEvent(
      'settlement_queued',
      'Settlement queued',
      {
        assignmentId: 'asgn-test-001',
        actorId: 'system',
        actorRole: 'system',
        metadata: { daysSinceCompletion: 10, slaDays: 7 },
      },
    )

    expect((event.metadata as Record<string, unknown>).daysSinceCompletion).toBe(10)
    expect((event.metadata as Record<string, unknown>).slaDays).toBe(7)
  })
})

describe('idempotency', () => {
  it('returns the same event when emitting with the same idempotencyKey', () => {
    const first = emitAssignmentEvent(
      'assignment_created',
      'First emit',
      { assignmentId: 'asgn-test-001', actorId: 'buyer-01', actorRole: 'buyer' },
      'idem-key-001',
    )

    const second = emitAssignmentEvent(
      'assignment_created',
      'Second emit — should be ignored',
      { assignmentId: 'asgn-test-001', actorId: 'buyer-01', actorRole: 'buyer' },
      'idem-key-001',
    )

    expect(second).toBe(first)
    expect(getEventCount()).toBe(1)
  })

  it('does not deduplicate events with different idempotency keys', () => {
    emitAssignmentEvent(
      'assignment_created',
      'First',
      { assignmentId: 'asgn-test-001', actorId: 'buyer-01', actorRole: 'buyer' },
      'idem-key-001',
    )

    emitAssignmentEvent(
      'assignment_created',
      'Second',
      { assignmentId: 'asgn-test-001', actorId: 'buyer-01', actorRole: 'buyer' },
      'idem-key-002',
    )

    expect(getEventCount()).toBe(2)
  })

  it('uses the idempotencyKey as the event id', () => {
    const event = emitAssignmentEvent(
      'assignment_created',
      'Test',
      { assignmentId: 'asgn-test-001', actorId: 'buyer-01', actorRole: 'buyer' },
      'custom-id-123',
    )

    expect(event.id).toBe('custom-id-123')
  })
})

describe('getAssignmentEvents', () => {
  it('filters events by assignmentId', () => {
    emitAssignmentEvent('assignment_created', 'A', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })
    emitAssignmentEvent('assignment_created', 'B', {
      assignmentId: 'asgn-002',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })
    emitAssignmentEvent('milestone_activated', 'C', {
      assignmentId: 'asgn-001',
      actorId: 'system',
      actorRole: 'system',
    })

    const events = getAssignmentEvents('asgn-001')
    expect(events).toHaveLength(2)
    expect(events.every(e => (e.metadata as Record<string, unknown>).assignmentId === 'asgn-001')).toBe(true)
  })

  it('returns empty array when no events match', () => {
    emitAssignmentEvent('assignment_created', 'A', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })

    expect(getAssignmentEvents('asgn-nonexistent')).toHaveLength(0)
  })
})

describe('getMilestoneEvents', () => {
  it('filters events by milestoneId', () => {
    emitAssignmentEvent('milestone_activated', 'M1 event', {
      assignmentId: 'asgn-001',
      milestoneId: 'ms-001',
      actorId: 'system',
      actorRole: 'system',
    })
    emitAssignmentEvent('milestone_activated', 'M2 event', {
      assignmentId: 'asgn-001',
      milestoneId: 'ms-002',
      actorId: 'system',
      actorRole: 'system',
    })
    emitAssignmentEvent('assignment_created', 'No milestone', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })

    const events = getMilestoneEvents('ms-001')
    expect(events).toHaveLength(1)
    expect((events[0].metadata as Record<string, unknown>).milestoneId).toBe('ms-001')
  })

  it('returns empty array when no events match', () => {
    emitAssignmentEvent('milestone_activated', 'M1', {
      assignmentId: 'asgn-001',
      milestoneId: 'ms-001',
      actorId: 'system',
      actorRole: 'system',
    })

    expect(getMilestoneEvents('ms-nonexistent')).toHaveLength(0)
  })
})

describe('getEventCount', () => {
  it('returns total count of all events', () => {
    expect(getEventCount()).toBe(0)

    emitAssignmentEvent('assignment_created', 'A', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })
    expect(getEventCount()).toBe(1)

    emitAssignmentEvent('milestone_activated', 'B', {
      assignmentId: 'asgn-002',
      actorId: 'system',
      actorRole: 'system',
    })
    expect(getEventCount()).toBe(2)
  })
})

describe('_clearEventBuffer', () => {
  it('resets the buffer to empty', () => {
    emitAssignmentEvent('assignment_created', 'A', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })
    emitAssignmentEvent('milestone_activated', 'B', {
      assignmentId: 'asgn-001',
      milestoneId: 'ms-001',
      actorId: 'system',
      actorRole: 'system',
    })
    expect(getEventCount()).toBe(2)

    _clearEventBuffer()
    expect(getEventCount()).toBe(0)
    expect(getAssignmentEvents('asgn-001')).toHaveLength(0)
  })

  it('resets sequence numbering so new events get fresh ids', () => {
    const first = emitAssignmentEvent('assignment_created', 'A', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })

    _clearEventBuffer()

    const second = emitAssignmentEvent('assignment_created', 'B', {
      assignmentId: 'asgn-001',
      actorId: 'buyer-01',
      actorRole: 'buyer',
    })

    // After clear, ids are regenerated (not duplicates of pre-clear ids in a deterministic way)
    expect(second.id).toBeDefined()
    expect(getEventCount()).toBe(1)
  })
})
