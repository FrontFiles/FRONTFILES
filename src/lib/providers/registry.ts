// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: registry
//
// SINGLE SOURCE OF TRUTH for which providers exist and what they
// declare. Read by:
//   - the service layer (validates `provider` strings on insert)
//   - the access layer (cross-references owner_modes + capabilities)
//   - the API surface (`GET /api/providers`)
//   - the registry-integrity test
//
// Adding a new provider:
//
//   1. Extend `ProviderKey` in `./types.ts`
//   2. Add a descriptor here
//   3. (Optional) Add an adapter under `./adapters/`
//   4. The integrity test will fail loudly if any of (1) or (2)
//      are inconsistent.
//
// Why providers are seeded in code (not a SQL table):
//
//   The provider list is part of the application contract — it
//   ships with the build, the type system depends on it, and
//   the access layer narrows on the typed `ProviderKey` union.
//   A SQL `providers` table would be redundant data that has to
//   be kept in lockstep with the union. We pay a migration cost
//   only for things that VARY at runtime (`external_connections`,
//   `external_webhook_events`); the registry itself is static.
// ═══════════════════════════════════════════════════════════════

import type {
  ProviderDescriptor,
  ProviderKey,
} from './types'

const REGISTRY: Readonly<Record<ProviderKey, ProviderDescriptor>> = {
  // ── Stripe ────────────────────────────────────────────────
  //
  // ONE provider key, TWO capabilities. Stripe is responsible
  // for both billing (PaymentIntents on the platform account)
  // and payouts (Connect accounts owned by individual creators
  // and companies). The split is enforced by the SERVICE layer
  // and the access layer — a creator who connects Stripe Connect
  // gets a `user`-owned connection with the `payouts` capability,
  // while the platform-owned billing connection is `platform`-
  // owned.
  stripe: {
    key: 'stripe',
    display_name: 'Stripe',
    category: 'payments',
    auth_type: 'connect_oauth',
    owner_modes: ['user', 'company', 'platform'],
    capabilities: ['billing', 'payouts', 'identity_verification'],
    secret_storage_kind: 'secret_manager',
    emits_webhooks: true,
  },

  // ── Google Identity (sign-in only) ────────────────────────
  //
  // Pure SSO. No Drive, no Gmail, no Calendar — just the OIDC
  // identity assertion. Users get this when they sign in with
  // Google. The Drive/Gmail/Calendar providers below are
  // SEPARATE keys with separate connections so a user can grant
  // sign-in without unlocking Drive (and vice-versa).
  google_identity: {
    key: 'google_identity',
    display_name: 'Google (Sign-in)',
    category: 'enterprise_sso',
    auth_type: 'oauth2',
    owner_modes: ['user'],
    capabilities: ['sso'],
    secret_storage_kind: 'secret_manager',
    emits_webhooks: false,
  },

  // ── Google Drive ──────────────────────────────────────────
  google_drive: {
    key: 'google_drive',
    display_name: 'Google Drive',
    category: 'storage',
    auth_type: 'oauth2',
    owner_modes: ['user', 'company'],
    capabilities: ['storage'],
    secret_storage_kind: 'secret_manager',
    emits_webhooks: true,
  },

  // ── Google Gmail ──────────────────────────────────────────
  google_gmail: {
    key: 'google_gmail',
    display_name: 'Google Gmail',
    category: 'mail',
    auth_type: 'oauth2',
    owner_modes: ['user', 'company'],
    capabilities: ['mail_send', 'mail_read'],
    secret_storage_kind: 'secret_manager',
    emits_webhooks: true,
  },

  // ── Google Calendar ───────────────────────────────────────
  google_calendar: {
    key: 'google_calendar',
    display_name: 'Google Calendar',
    category: 'calendar',
    auth_type: 'oauth2',
    owner_modes: ['user', 'company'],
    capabilities: ['calendar_read', 'calendar_write'],
    secret_storage_kind: 'secret_manager',
    emits_webhooks: true,
  },
}

// ─── Public accessors ────────────────────────────────────────

/** Return the descriptor for a known provider key, or null. */
export function getProviderDescriptor(
  key: string,
): ProviderDescriptor | null {
  return (REGISTRY as Record<string, ProviderDescriptor>)[key] ?? null
}

/** Type-narrowing form for callers that already know the key. */
export function getProviderDescriptorTyped(
  key: ProviderKey,
): ProviderDescriptor {
  return REGISTRY[key]
}

/** True iff the given string is a registered provider key. */
export function isKnownProvider(key: string): key is ProviderKey {
  return Object.prototype.hasOwnProperty.call(REGISTRY, key)
}

/** Snapshot of every registered provider, in declaration order. */
export function listProviders(): ReadonlyArray<ProviderDescriptor> {
  return Object.values(REGISTRY)
}

/**
 * Find the providers that declare a given capability.
 * Used by the access layer for capability-flavour helpers like
 * `canUseStorageProvider` so the code never has to know which
 * provider is fronting a capability today.
 */
export function listProvidersWithCapability(
  capability: ProviderDescriptor['capabilities'][number],
): ReadonlyArray<ProviderDescriptor> {
  return Object.values(REGISTRY).filter((p) =>
    p.capabilities.includes(capability),
  )
}

/**
 * True if the provider supports a given owner mode. Used by
 * `canConnectProvider` so the access layer doesn't duplicate the
 * descriptor's `owner_modes` list.
 */
export function providerSupportsOwnerMode(
  key: ProviderKey,
  ownerType: ProviderDescriptor['owner_modes'][number],
): boolean {
  return REGISTRY[key].owner_modes.includes(ownerType)
}
