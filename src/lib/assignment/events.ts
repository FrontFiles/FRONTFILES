/**
 * Assignment Engine — CEL Event Emission
 *
 * Append-only event hooks for assignment lifecycle mutations.
 * In the mock phase, events are collected in memory.
 * In production, these will write to the persistent CEL store.
 *
 * System boundary: CEL is append-only. No event may be modified or deleted.
 */

import type { CertificationEventType, CertificationEvent } from '@/lib/types'

export interface AssignmentEventPayload {
  assignmentId: string
  milestoneId?: string
  actorId: string
  actorRole: string
  metadata?: Record<string, unknown>
}

// ══════════════════════════════════════════════
// IN-MEMORY CEL BUFFER (mock phase)
// Replace with persistent store in production.
// ══════════════════════════════════════════════

const eventBuffer: CertificationEvent[] = []
let nextSeq = 1

function generateEventId(): string {
  return `cel-asgn-${Date.now()}-${nextSeq++}`
}

/** Append a CEL event. Idempotent by eventId if provided. */
export function emitAssignmentEvent(
  type: CertificationEventType,
  description: string,
  payload: AssignmentEventPayload,
  idempotencyKey?: string,
): CertificationEvent {
  // Idempotency check: skip if key already exists
  if (idempotencyKey) {
    const existing = eventBuffer.find(e => e.id === idempotencyKey)
    if (existing) return existing
  }

  const event: CertificationEvent = {
    id: idempotencyKey ?? generateEventId(),
    type,
    description,
    timestamp: new Date().toISOString(),
    metadata: {
      assignmentId: payload.assignmentId,
      milestoneId: payload.milestoneId ?? null,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      ...payload.metadata,
    },
  }

  eventBuffer.push(event)
  return event
}

/** Read all events for an assignment (mock query). */
export function getAssignmentEvents(assignmentId: string): CertificationEvent[] {
  return eventBuffer.filter(
    e => (e.metadata as Record<string, unknown>)?.assignmentId === assignmentId,
  )
}

/** Read all events for a milestone (mock query). */
export function getMilestoneEvents(milestoneId: string): CertificationEvent[] {
  return eventBuffer.filter(
    e => (e.metadata as Record<string, unknown>)?.milestoneId === milestoneId,
  )
}

/** Total event count (test/debug). */
export function getEventCount(): number {
  return eventBuffer.length
}

/** Clear buffer (test only). */
export function _clearEventBuffer(): void {
  eventBuffer.length = 0
  nextSeq = 1
}
