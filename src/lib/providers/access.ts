// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: access predicates
//
// Capability-based authorization for the provider foundation.
// Mirrors the Spine A pattern: pure predicates that take a
// `Viewer`-like input and never throw.
//
// Every UI component / API handler that gates on "can this user
// connect / use / manage a provider connection" should call
// these helpers — never inline `if (memberships.role === 'admin')`
// checks.
//
// SERVER-SAFE. The `Viewer` shape is intentionally identical to
// what `lib/identity/permissions.ts -> useViewer()` produces so
// the same value flows through both layers.
//
// All helpers are pure functions of their arguments. Async
// variants live in `./service.ts` (`canUseBillingProviderAsync`
// etc.) for the cases that need to query the connection store.
// ═══════════════════════════════════════════════════════════════

import type {
  CompanyMembershipFullRow,
  UserRow,
} from '@/lib/db/schema'
import type {
  ExternalConnection,
  ProviderCapability,
  ProviderKey,
  ProviderOwner,
  ProviderOwnerType,
} from './types'
import {
  getProviderDescriptor,
  providerSupportsOwnerMode,
} from './registry'

// ─── Viewer shape ────────────────────────────────────────────

/**
 * Minimum viewer shape this module needs. Compatible with the
 * `Viewer` produced by `lib/identity/permissions.ts -> useViewer()`
 * — the React layer can pass that object straight in. The
 * server layer can build the same shape from
 * `getUserWithFacets()`.
 *
 * `null` represents an anonymous viewer. Every predicate
 * defaults to `false` for anonymous viewers.
 */
export interface ProviderViewer {
  user: UserRow | null
  companyMemberships: ReadonlyArray<CompanyMembershipFullRow>
  /**
   * Optional flag. When true the viewer is treated as Frontfiles
   * staff and gains rights over `platform`-owned connections.
   * Falls back to `false` until the staff role lands.
   */
  isStaff?: boolean
}

// ─── Owner-membership helpers ────────────────────────────────

/**
 * True when the viewer is an active member of the given company
 * (any role).
 */
export function isActiveCompanyMember(
  viewer: ProviderViewer,
  companyId: string,
): boolean {
  if (!viewer.user) return false
  return viewer.companyMemberships.some(
    (m) => m.company_id === companyId && m.status === 'active',
  )
}

/**
 * True when the viewer holds the company `admin` role with
 * status `active`. Used as the company-admin gate on
 * connect/manage operations.
 */
export function isCompanyAdmin(
  viewer: ProviderViewer,
  companyId: string,
): boolean {
  if (!viewer.user) return false
  return viewer.companyMemberships.some(
    (m) =>
      m.company_id === companyId &&
      m.status === 'active' &&
      m.role === 'admin',
  )
}

/**
 * True when the viewer can act on behalf of the given owner —
 * "act on" means READ. Personal owner = self. Company owner =
 * any active member. Platform = staff only. Workspace = always
 * false until a real workspaces store + memberships ship — see
 * the long comment at the workspace branch below.
 */
export function isOwnerActor(
  viewer: ProviderViewer,
  owner: ProviderOwner,
): boolean {
  if (!viewer.user) return false
  switch (owner.type) {
    case 'user':
      return viewer.user.id === owner.id
    case 'company':
      return isActiveCompanyMember(viewer, owner.id)
    case 'workspace':
      // Fail closed. Workspaces are a future concept; there is
      // no `workspaces` table or `workspace_memberships` store
      // today. Falling through to `isActiveCompanyMember` would
      // grant access whenever a workspace UUID happens to match a
      // company UUID, which is a privilege-confusion path we do
      // not want as a "default" the moment a provider declares
      // owner_modes: ['workspace']. When workspaces become real,
      // wire this branch through a workspace-membership store.
      return false
    case 'platform':
      return viewer.isStaff === true
  }
}

/**
 * True when the viewer can MANAGE the given owner — "manage"
 * means write/connect/revoke. Personal owner = self. Company
 * owner = admin role. Platform = staff only. Workspace = always
 * false until workspaces ship (see `isOwnerActor`).
 */
export function isOwnerAdmin(
  viewer: ProviderViewer,
  owner: ProviderOwner,
): boolean {
  if (!viewer.user) return false
  switch (owner.type) {
    case 'user':
      return viewer.user.id === owner.id
    case 'company':
      return isCompanyAdmin(viewer, owner.id)
    case 'workspace':
      return false
    case 'platform':
      return viewer.isStaff === true
  }
}

// ─── Capability predicates ───────────────────────────────────

/**
 * Can the viewer initiate a NEW connection of `provider` for
 * `owner`? Three checks compose:
 *
 *   1. The provider exists in the registry.
 *   2. The provider supports the owner type.
 *   3. The viewer is the owner-admin (manage rights).
 *
 * This is the gate for the "Connect Stripe" / "Connect Google
 * Drive" buttons.
 */
export function canConnectProvider(
  viewer: ProviderViewer,
  providerKey: ProviderKey,
  owner: ProviderOwner,
): boolean {
  const descriptor = getProviderDescriptor(providerKey)
  if (!descriptor) return false
  const ownerType: ProviderOwnerType = owner.type
  if (!providerSupportsOwnerMode(providerKey, ownerType)) return false
  return isOwnerAdmin(viewer, owner)
}

/**
 * Can the viewer USE an existing connection? READ rights on the
 * owner are enough — a non-admin company member can fire a
 * Drive download against the company connection, but not revoke it.
 */
export function canUseProviderConnection(
  viewer: ProviderViewer,
  connection: ExternalConnection,
): boolean {
  return isOwnerActor(viewer, connection.owner)
}

/**
 * Can the viewer MANAGE an existing connection (revoke, rotate
 * scopes, change label)? Owner-admin rights on the owner.
 */
export function canManageProviderConnection(
  viewer: ProviderViewer,
  connection: ExternalConnection,
): boolean {
  return isOwnerAdmin(viewer, connection.owner)
}

// ─── Capability-flavour wrappers ─────────────────────────────
//
// Product code asks "can the viewer use a billing provider for
// this owner?" — never "is Stripe connected?". The wrappers
// below scan the connection list for any active connection on
// a provider that declares the requested capability.
//
// These are the predicates UI surfaces should call.

/**
 * Pure form: does any of the supplied connections satisfy a
 * capability? The async form lives in `./service.ts` and
 * fetches the connection list itself.
 */
export function hasCapabilityInConnections(
  connections: ReadonlyArray<ExternalConnection>,
  capability: ProviderCapability,
  status: 'active' | 'any' = 'active',
): boolean {
  return connections.some((c) => {
    if (status === 'active' && c.status !== 'active') return false
    const descriptor = getProviderDescriptor(c.provider)
    if (!descriptor) return false
    return descriptor.capabilities.includes(capability)
  })
}

/**
 * Capability gate over a known owner with a precomputed
 * connection list. The async wrapper in `./service.ts`
 * (`canUseCapabilityProvider`) calls this after a fetch.
 */
export function canUseCapabilityProviderFor(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  capability: ProviderCapability,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  if (!isOwnerActor(viewer, owner)) return false
  return hasCapabilityInConnections(connections, capability, 'active')
}

/**
 * Convenience predicates the rest of the app calls. All three
 * delegate to `canUseCapabilityProviderFor` so changing the
 * underlying rule changes one function.
 */
export function canUseBillingProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  return canUseCapabilityProviderFor(viewer, owner, 'billing', connections)
}

export function canUseStorageProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  return canUseCapabilityProviderFor(viewer, owner, 'storage', connections)
}

export function canUsePublishingProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  // Publishing is the union of mail-send + storage today (drafts
  // → drive, sends → gmail). When a dedicated `publishing`
  // capability is added to the registry, swap the union below
  // for a single check.
  return (
    canUseCapabilityProviderFor(viewer, owner, 'mail_send', connections) ||
    canUseCapabilityProviderFor(viewer, owner, 'storage', connections)
  )
}

export function canUseIdentityVerificationProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  return canUseCapabilityProviderFor(
    viewer,
    owner,
    'identity_verification',
    connections,
  )
}

export function canUsePayoutsProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  connections: ReadonlyArray<ExternalConnection>,
): boolean {
  return canUseCapabilityProviderFor(viewer, owner, 'payouts', connections)
}
