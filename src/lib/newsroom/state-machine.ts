/**
 * Frontfiles — Newsroom Pack state machine (NR-D4, F4)
 *
 * Pure validator for Pack status transitions (PRD §3.3) plus
 * visibility derivation (PRD §3.3 matrix). No DB. Consumed by:
 *
 *   - NR-D9 RPC (server-side transition validation)
 *   - P9/P10 distributor UI (disabled-state computation)
 *
 * States:
 *   draft → scheduled → published → archived
 *                             ↖──────┘
 *   (any non-terminal) → takedown   (admin only; terminal)
 *
 * Visibility is derived from (status, embargo.state):
 *   draft                         → private
 *   scheduled + active embargo    → restricted
 *   scheduled + no embargo        → private
 *   published                     → public
 *   archived                      → public (canonical URL resolves, index-excluded)
 *   takedown                      → tombstone
 */

import type {
  NewsroomPackStatus,
  NewsroomPackVisibility,
} from '@/lib/db/schema'

export type PackTransitionTrigger =
  | 'uploader'
  | 'scheduler'
  | 'admin'
  | 'creation'

export interface PackTransition {
  from: NewsroomPackStatus | null
  to: NewsroomPackStatus
  trigger: PackTransitionTrigger
}

export const VALID_PACK_TRANSITIONS: ReadonlyArray<PackTransition> = [
  // Creation
  { from: null, to: 'draft', trigger: 'creation' },

  // Uploader path — draft to scheduled / published
  { from: 'draft', to: 'scheduled', trigger: 'uploader' },
  { from: 'draft', to: 'published', trigger: 'uploader' },

  // Uploader pull-back
  { from: 'scheduled', to: 'draft', trigger: 'uploader' },

  // Scheduler auto-lift
  { from: 'scheduled', to: 'published', trigger: 'scheduler' },

  // Uploader manual early lift
  { from: 'scheduled', to: 'published', trigger: 'uploader' },

  // Published lifecycle
  { from: 'published', to: 'archived', trigger: 'uploader' },
  { from: 'archived', to: 'published', trigger: 'uploader' },

  // Takedown (admin only, from any non-terminal state)
  { from: 'draft', to: 'takedown', trigger: 'admin' },
  { from: 'scheduled', to: 'takedown', trigger: 'admin' },
  { from: 'published', to: 'takedown', trigger: 'admin' },
  { from: 'archived', to: 'takedown', trigger: 'admin' },
] as const

export function canTransition(
  from: NewsroomPackStatus | null,
  to: NewsroomPackStatus,
  trigger: PackTransitionTrigger,
): boolean {
  return VALID_PACK_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.trigger === trigger,
  )
}

export function deriveVisibility(
  status: NewsroomPackStatus,
  hasActiveEmbargo: boolean,
): NewsroomPackVisibility {
  switch (status) {
    case 'draft':
      return 'private'
    case 'scheduled':
      return hasActiveEmbargo ? 'restricted' : 'private'
    case 'published':
      return 'public'
    case 'archived':
      return 'public'
    case 'takedown':
      return 'tombstone'
  }
}

// Only `takedown` is terminal per PRD §3.3. `archived` is
// reversible to `published` and therefore non-terminal.
export function isTerminalStatus(status: NewsroomPackStatus): boolean {
  return status === 'takedown'
}
