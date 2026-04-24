/**
 * Frontfiles — state-machine.ts unit tests (NR-D4, T4)
 *
 * Covers every row in VALID_PACK_TRANSITIONS, sample invalid
 * transitions, visibility derivation across the six (status,
 * embargo?) combinations (PRD §3.3 matrix), and isTerminalStatus.
 */

import { describe, expect, it } from 'vitest'

import type {
  NewsroomPackStatus,
  NewsroomPackVisibility,
} from '@/lib/db/schema'
import {
  canTransition,
  deriveVisibility,
  isTerminalStatus,
  VALID_PACK_TRANSITIONS,
} from '@/lib/newsroom/state-machine'

describe('VALID_PACK_TRANSITIONS', () => {
  it('includes all 12 canonical rows', () => {
    expect(VALID_PACK_TRANSITIONS).toHaveLength(12)
  })

  it('every row returns true via canTransition', () => {
    for (const t of VALID_PACK_TRANSITIONS) {
      expect(
        canTransition(t.from, t.to, t.trigger),
        `${String(t.from)} → ${t.to} (${t.trigger}) should be valid`,
      ).toBe(true)
    }
  })
})

describe('canTransition — invalid transitions', () => {
  it('takedown → anything is invalid (terminal)', () => {
    const targets: NewsroomPackStatus[] = [
      'draft',
      'scheduled',
      'published',
      'archived',
    ]
    for (const to of targets) {
      expect(canTransition('takedown', to, 'uploader')).toBe(false)
      expect(canTransition('takedown', to, 'admin')).toBe(false)
      expect(canTransition('takedown', to, 'scheduler')).toBe(false)
    }
  })

  it('published → draft is invalid', () => {
    expect(canTransition('published', 'draft', 'uploader')).toBe(false)
  })

  it('archived → draft is invalid', () => {
    expect(canTransition('archived', 'draft', 'uploader')).toBe(false)
  })

  it('draft → scheduled with scheduler trigger is invalid (uploader-only)', () => {
    expect(canTransition('draft', 'scheduled', 'scheduler')).toBe(false)
  })

  it('uploader cannot invoke takedown', () => {
    expect(canTransition('published', 'takedown', 'uploader')).toBe(
      false,
    )
  })

  it('creation is only valid from null', () => {
    expect(canTransition(null, 'draft', 'creation')).toBe(true)
    expect(canTransition('draft', 'draft', 'creation')).toBe(false)
  })
})

describe('deriveVisibility (PRD §3.3 matrix)', () => {
  const cases: Array<{
    status: NewsroomPackStatus
    embargo: boolean
    expected: NewsroomPackVisibility
  }> = [
    { status: 'draft', embargo: false, expected: 'private' },
    { status: 'draft', embargo: true, expected: 'private' },
    { status: 'scheduled', embargo: false, expected: 'private' },
    { status: 'scheduled', embargo: true, expected: 'restricted' },
    { status: 'published', embargo: false, expected: 'public' },
    { status: 'archived', embargo: false, expected: 'public' },
    { status: 'takedown', embargo: false, expected: 'tombstone' },
  ]

  it.each(cases)(
    '$status (embargo=$embargo) → $expected',
    ({ status, embargo, expected }) => {
      expect(deriveVisibility(status, embargo)).toBe(expected)
    },
  )
})

describe('isTerminalStatus', () => {
  it('returns true only for takedown', () => {
    expect(isTerminalStatus('takedown')).toBe(true)
  })

  it('returns false for archived (reversible)', () => {
    expect(isTerminalStatus('archived')).toBe(false)
  })

  it('returns false for draft, scheduled, published', () => {
    expect(isTerminalStatus('draft')).toBe(false)
    expect(isTerminalStatus('scheduled')).toBe(false)
    expect(isTerminalStatus('published')).toBe(false)
  })
})
