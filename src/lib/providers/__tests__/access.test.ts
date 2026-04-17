// ═══════════════════════════════════════════════════════════════
// Provider access predicates — pure-function tests
//
// These cover the rules every UI surface and route handler will
// rely on:
//
//   - canConnectProvider:  registry validation + owner mode +
//                          owner-admin gate
//   - canUseProviderConnection / canManageProviderConnection:
//                          owner-actor vs owner-admin distinction
//   - capability fan-out predicates (canUseBillingProvider, …)
//                          read through the registry so that
//                          changing a provider's capability list
//                          flows through automatically.
//
// All tests use plain object viewers + connections — no
// Supabase, no React. The same predicates will be called from
// React components and route handlers in production.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  canConnectProvider,
  canManageProviderConnection,
  canUseBillingProvider,
  canUseProviderConnection,
  canUseStorageProvider,
  isActiveCompanyMember,
  isCompanyAdmin,
  isOwnerActor,
  isOwnerAdmin,
} from '../access'
import type { ProviderViewer } from '../access'
import type {
  ExternalConnection,
  ProviderOwner,
} from '../types'
import type {
  CompanyMembershipFullRow,
  UserRow,
} from '@/lib/db/schema'

// ─── Helpers ─────────────────────────────────────────────────

function makeUser(id: string): UserRow {
  return {
    id,
    username: id,
    display_name: id,
    email: `${id}@frontfiles.test`,
    avatar_url: null,
    account_state: 'active',
    founding_member: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeMembership(
  userId: string,
  companyId: string,
  role: CompanyMembershipFullRow['role'],
  status: CompanyMembershipFullRow['status'] = 'active',
): CompanyMembershipFullRow {
  return {
    id: `mem-${userId}-${companyId}`,
    company_id: companyId,
    user_id: userId,
    role,
    status,
    invited_by: null,
    invited_at: '2026-01-01T00:00:00Z',
    activated_at: '2026-01-02T00:00:00Z',
    left_at: null,
    revoked_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeViewer(
  userId: string,
  memberships: CompanyMembershipFullRow[] = [],
  isStaff = false,
): ProviderViewer {
  return {
    user: makeUser(userId),
    companyMemberships: memberships,
    isStaff,
  }
}

const ANONYMOUS: ProviderViewer = {
  user: null,
  companyMemberships: [],
}

function makeConnection(overrides: Partial<ExternalConnection> = {}): ExternalConnection {
  return {
    id: 'conn-1',
    provider: 'stripe',
    category: 'payments',
    owner: { type: 'user', id: 'user-A' },
    external_account_id: 'acct_test',
    account_label: 'Test',
    status: 'active',
    granted_scopes: [],
    created_by_user_id: 'user-A',
    created_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    last_synced_at: null,
    metadata: {},
    ...overrides,
  }
}

// ─── Membership predicates ───────────────────────────────────

describe('isActiveCompanyMember', () => {
  it('false for anonymous viewers', () => {
    expect(isActiveCompanyMember(ANONYMOUS, 'co-1')).toBe(false)
  })
  it('true for an active editor', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor')])
    expect(isActiveCompanyMember(v, 'co-1')).toBe(true)
  })
  it('false when the membership is revoked', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor', 'revoked')])
    expect(isActiveCompanyMember(v, 'co-1')).toBe(false)
  })
  it('false for a different company', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor')])
    expect(isActiveCompanyMember(v, 'co-2')).toBe(false)
  })
})

describe('isCompanyAdmin', () => {
  it('true only for active admins', () => {
    const admin = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'admin')])
    const editor = makeViewer('u-2', [makeMembership('u-2', 'co-1', 'editor')])
    const inactiveAdmin = makeViewer('u-3', [
      makeMembership('u-3', 'co-1', 'admin', 'invited'),
    ])
    expect(isCompanyAdmin(admin, 'co-1')).toBe(true)
    expect(isCompanyAdmin(editor, 'co-1')).toBe(false)
    expect(isCompanyAdmin(inactiveAdmin, 'co-1')).toBe(false)
  })
})

// ─── Owner actor / admin ─────────────────────────────────────

describe('isOwnerActor / isOwnerAdmin', () => {
  it('user-owned: self only', () => {
    const v = makeViewer('u-1')
    const ownSelf: ProviderOwner = { type: 'user', id: 'u-1' }
    const otherUser: ProviderOwner = { type: 'user', id: 'u-2' }
    expect(isOwnerActor(v, ownSelf)).toBe(true)
    expect(isOwnerActor(v, otherUser)).toBe(false)
    expect(isOwnerAdmin(v, ownSelf)).toBe(true)
    expect(isOwnerAdmin(v, otherUser)).toBe(false)
  })

  it('company-owned: members can act, admins can manage', () => {
    const editor = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor')])
    const admin = makeViewer('u-2', [makeMembership('u-2', 'co-1', 'admin')])
    const owner: ProviderOwner = { type: 'company', id: 'co-1' }
    expect(isOwnerActor(editor, owner)).toBe(true)
    expect(isOwnerActor(admin, owner)).toBe(true)
    expect(isOwnerAdmin(editor, owner)).toBe(false)
    expect(isOwnerAdmin(admin, owner)).toBe(true)
  })

  it('platform-owned: staff only', () => {
    const regular = makeViewer('u-1')
    const staff = makeViewer('u-2', [], true)
    expect(isOwnerActor(regular, { type: 'platform' })).toBe(false)
    expect(isOwnerActor(staff, { type: 'platform' })).toBe(true)
    expect(isOwnerAdmin(regular, { type: 'platform' })).toBe(false)
    expect(isOwnerAdmin(staff, { type: 'platform' })).toBe(true)
  })

  it('anonymous viewers can do nothing', () => {
    expect(isOwnerActor(ANONYMOUS, { type: 'user', id: 'u-1' })).toBe(false)
    expect(isOwnerAdmin(ANONYMOUS, { type: 'platform' })).toBe(false)
  })
})

// ─── canConnectProvider ──────────────────────────────────────

describe('canConnectProvider', () => {
  it('user can connect a user-mode provider for themselves', () => {
    const v = makeViewer('u-1')
    expect(
      canConnectProvider(v, 'google_drive', { type: 'user', id: 'u-1' }),
    ).toBe(true)
  })

  it('user CANNOT connect a user-mode provider for someone else', () => {
    const v = makeViewer('u-1')
    expect(
      canConnectProvider(v, 'google_drive', { type: 'user', id: 'u-2' }),
    ).toBe(false)
  })

  it('user CANNOT connect a user-only provider as a company', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'admin')])
    // google_identity has owner_modes: ['user'] — companies are
    // explicitly not supported.
    expect(
      canConnectProvider(v, 'google_identity', { type: 'company', id: 'co-1' }),
    ).toBe(false)
  })

  it('company admin can connect a company provider', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'admin')])
    expect(
      canConnectProvider(v, 'google_drive', { type: 'company', id: 'co-1' }),
    ).toBe(true)
  })

  it('company editor (non-admin) CANNOT connect a company provider', () => {
    const v = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor')])
    expect(
      canConnectProvider(v, 'google_drive', { type: 'company', id: 'co-1' }),
    ).toBe(false)
  })

  it('rejects unknown providers', () => {
    const v = makeViewer('u-1')
    expect(
      // @ts-expect-error -- intentionally invalid key
      canConnectProvider(v, 'not_a_provider', { type: 'user', id: 'u-1' }),
    ).toBe(false)
  })
})

// ─── canUse / canManage on existing connections ──────────────

describe('canUseProviderConnection / canManageProviderConnection', () => {
  it('owner can use and manage their own user-owned connection', () => {
    const v = makeViewer('user-A')
    const conn = makeConnection({ owner: { type: 'user', id: 'user-A' } })
    expect(canUseProviderConnection(v, conn)).toBe(true)
    expect(canManageProviderConnection(v, conn)).toBe(true)
  })

  it('non-owner cannot touch a personal connection', () => {
    const v = makeViewer('user-B')
    const conn = makeConnection({ owner: { type: 'user', id: 'user-A' } })
    expect(canUseProviderConnection(v, conn)).toBe(false)
    expect(canManageProviderConnection(v, conn)).toBe(false)
  })

  it('company member can USE a company connection but only an admin can MANAGE', () => {
    const editor = makeViewer('u-1', [makeMembership('u-1', 'co-1', 'editor')])
    const admin = makeViewer('u-2', [makeMembership('u-2', 'co-1', 'admin')])
    const conn = makeConnection({ owner: { type: 'company', id: 'co-1' } })
    expect(canUseProviderConnection(editor, conn)).toBe(true)
    expect(canManageProviderConnection(editor, conn)).toBe(false)
    expect(canUseProviderConnection(admin, conn)).toBe(true)
    expect(canManageProviderConnection(admin, conn)).toBe(true)
  })
})

// ─── Capability fan-out ──────────────────────────────────────

describe('capability fan-out predicates', () => {
  it('canUseBillingProvider true when an active Stripe connection exists for the owner', () => {
    const v = makeViewer('u-1')
    const conn = makeConnection({
      provider: 'stripe',
      owner: { type: 'user', id: 'u-1' },
    })
    expect(canUseBillingProvider(v, { type: 'user', id: 'u-1' }, [conn])).toBe(true)
  })

  it('canUseBillingProvider false when the only Stripe connection is revoked', () => {
    const v = makeViewer('u-1')
    const conn = makeConnection({
      provider: 'stripe',
      status: 'revoked',
      owner: { type: 'user', id: 'u-1' },
    })
    expect(canUseBillingProvider(v, { type: 'user', id: 'u-1' }, [conn])).toBe(false)
  })

  it('canUseStorageProvider picks Google Drive but NOT Gmail', () => {
    const v = makeViewer('u-1')
    const drive = makeConnection({
      provider: 'google_drive',
      category: 'storage',
      owner: { type: 'user', id: 'u-1' },
    })
    const gmail = makeConnection({
      id: 'conn-2',
      provider: 'google_gmail',
      category: 'mail',
      owner: { type: 'user', id: 'u-1' },
    })
    expect(canUseStorageProvider(v, { type: 'user', id: 'u-1' }, [gmail])).toBe(false)
    expect(canUseStorageProvider(v, { type: 'user', id: 'u-1' }, [drive])).toBe(true)
  })

  it('non-owner viewer cannot use a capability via an unrelated owner', () => {
    const v = makeViewer('u-2')
    const conn = makeConnection({
      provider: 'stripe',
      owner: { type: 'user', id: 'u-1' },
    })
    expect(canUseBillingProvider(v, { type: 'user', id: 'u-1' }, [conn])).toBe(false)
  })
})
