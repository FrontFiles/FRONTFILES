// ═══════════════════════════════════════════════════════════════
// party-profiles — buildPartyProfileMap unit tests (§F10 extension
// for Prompt 6). Pure-function coverage matching the §R6-pure
// pattern used by state-copy.test.ts / rights-display.test.ts.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import { buildPartyProfileMap } from '@/lib/offer/party-profiles'
import type { PartyProfile } from '@/lib/offer'

const USER_A: PartyProfile = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  username: 'alice',
  display_name: 'Alice A.',
  account_state: 'active',
}

const USER_B: PartyProfile = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  username: 'bob',
  display_name: 'Bob B.',
  account_state: 'active',
}

// Scrub sentinels per ECONOMIC_FLOW_v1 §8.7.1.
const USER_TOMBSTONED: PartyProfile = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  username: 'deleted-user-cccccccc',
  display_name: 'Deleted user',
  account_state: 'tombstoned',
}

describe('buildPartyProfileMap — empty input', () => {
  it('returns an empty map for an empty row list', () => {
    expect(buildPartyProfileMap([])).toEqual({})
  })
})

describe('buildPartyProfileMap — keyed by id', () => {
  it('keys every row by its `id` field', () => {
    const map = buildPartyProfileMap([USER_A, USER_B])
    expect(map[USER_A.id]).toEqual(USER_A)
    expect(map[USER_B.id]).toEqual(USER_B)
    expect(Object.keys(map).length).toBe(2)
  })
})

describe('buildPartyProfileMap — tombstoned passthrough (§8.7.1)', () => {
  it('preserves scrub sentinels verbatim without filtering', () => {
    const map = buildPartyProfileMap([USER_TOMBSTONED])
    const entry = map[USER_TOMBSTONED.id]
    expect(entry).toBeDefined()
    expect(entry?.account_state).toBe('tombstoned')
    expect(entry?.display_name).toBe('Deleted user')
    expect(entry?.username).toBe('deleted-user-cccccccc')
  })
})
