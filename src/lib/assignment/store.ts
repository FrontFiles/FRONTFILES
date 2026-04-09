/**
 * Assignment Engine — In-Memory Store (Mock Phase)
 *
 * Provides CRUD operations over an in-memory assignment map.
 * In production, this layer becomes Supabase queries.
 *
 * System boundary: Store is the persistence abstraction.
 * Domain services remain pure — they receive and return Assignment objects.
 * Store is the only module that mutates the canonical map.
 */

import type { Assignment } from '@/lib/types'
import { mockAssignments } from './mock-data'

// ══════════════════════════════════════════════
// IN-MEMORY STORE (mock phase)
// Seeded from mock-data on module load.
// ══════════════════════════════════════════════

const assignmentStore: Map<string, Assignment> = new Map(
  mockAssignments.map(a => [a.id, a]),
)

/** Get a single assignment by ID. Returns null if not found. */
export function getAssignment(id: string): Assignment | null {
  return assignmentStore.get(id) ?? null
}

/** Get all assignments. Optional filter by buyerId or creatorId. */
export function listAssignments(filter?: {
  buyerId?: string
  creatorId?: string
}): Assignment[] {
  const all = Array.from(assignmentStore.values())
  if (!filter) return all
  return all.filter(a => {
    if (filter.buyerId && a.buyerId !== filter.buyerId) return false
    if (filter.creatorId && a.creatorId !== filter.creatorId) return false
    return true
  })
}

/** Persist an assignment (insert or update). */
export function putAssignment(assignment: Assignment): void {
  assignmentStore.set(assignment.id, assignment)
}

/** Delete an assignment (test only). */
export function _deleteAssignment(id: string): boolean {
  return assignmentStore.delete(id)
}

/** Reset store to initial mock data (test only). */
export function _resetStore(): void {
  assignmentStore.clear()
  for (const a of mockAssignments) {
    assignmentStore.set(a.id, a)
  }
}

/** Current store size (test/debug). */
export function getStoreSize(): number {
  return assignmentStore.size
}
