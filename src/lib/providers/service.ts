// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: service layer
//
// Application-facing service API. Wraps the store with:
//   - registry validation (only known providers can be inserted)
//   - row → application shape mapping (`ExternalConnectionRow` →
//     `ExternalConnection` with the typed `ProviderOwner` union)
//   - capability-based predicates that need a fetch
//   - the canonical webhook ingestion pipeline
//
// SERVER-ONLY. UI and route handlers call these functions; they
// never touch the store directly.
//
// The service layer is also where the existing Spine-A
// authorization layer composes with the provider layer.
// `canUseCapabilityProvider(viewer, owner, capability)` is the
// async sibling of the pure predicates in `./access.ts` — it
// fetches the connection list once and runs the predicate.
// ═══════════════════════════════════════════════════════════════

import {
  findActiveConnection as storeFindActive,
  findConnectionByExternalAccount as storeFindByExternalAccount,
  getConnection as storeGetConnection,
  insertConnection as storeInsertConnection,
  insertWebhookEvent as storeInsertWebhookEvent,
  listConnections as storeListConnections,
  listWebhookEvents as storeListWebhookEvents,
  updateConnectionStatus as storeUpdateConnectionStatus,
  updateWebhookEventStatus as storeUpdateWebhookEventStatus,
  type InsertConnectionInput,
} from './store'
import {
  getProviderDescriptor,
  isKnownProvider,
  providerSupportsOwnerMode,
} from './registry'
import {
  canUseCapabilityProviderFor,
  canManageProviderConnection,
  canUseProviderConnection,
} from './access'
import type { ProviderViewer } from './access'
import type {
  CreateConnectionInput,
  ExternalConnection,
  ExternalConnectionRow,
  ExternalWebhookEventRow,
  MarkWebhookProcessedInput,
  ProviderCapability,
  ProviderKey,
  ProviderOwner,
  RecordWebhookEventInput,
} from './types'

// ─── Row → application shape mapper ─────────────────────────

function rowToConnection(row: ExternalConnectionRow): ExternalConnection {
  let owner: ProviderOwner
  switch (row.owner_type) {
    case 'platform':
      owner = { type: 'platform' }
      break
    case 'user':
    case 'company':
    case 'workspace':
      // The SQL CHECK guarantees owner_id is non-null when the
      // owner_type is not 'platform', so the assertion is safe.
      owner = { type: row.owner_type, id: row.owner_id! }
      break
  }

  return {
    id: row.id,
    provider: row.provider as ProviderKey,
    category: row.category,
    owner,
    external_account_id: row.external_account_id,
    account_label: row.account_label,
    status: row.status,
    granted_scopes: row.granted_scopes,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    last_synced_at: row.last_synced_at,
    metadata: row.metadata,
  }
}

function ownerToFilter(owner: ProviderOwner): {
  ownerType: ProviderOwner['type']
  ownerId: string | null
} {
  if (owner.type === 'platform') return { ownerType: 'platform', ownerId: null }
  return { ownerType: owner.type, ownerId: owner.id }
}

// ─── Read paths ──────────────────────────────────────────────

/**
 * List every connection for an owner. Returns the application
 * shape, not the raw row. Status filter is optional — pass
 * `'active'` for the common "what can this owner currently
 * use" query.
 */
export async function listConnectionsForOwner(
  owner: ProviderOwner,
  options: { status?: ExternalConnectionRow['status']; provider?: ProviderKey } = {},
): Promise<ExternalConnection[]> {
  const filter = ownerToFilter(owner)
  const rows = await storeListConnections({
    ownerType: filter.ownerType,
    ownerId: filter.ownerId,
    status: options.status,
    provider: options.provider,
  })
  return rows.map(rowToConnection)
}

/**
 * Convenience: every connection visible to the viewer. For
 * personal-owner connections this is the viewer's own user-owned
 * rows plus any company connections their memberships grant
 * access to. Aggregates a small fan-out of `listConnections`
 * calls; safe for typical viewers (1 user + a handful of
 * companies).
 */
export async function listConnectionsForViewer(
  viewer: ProviderViewer,
): Promise<ExternalConnection[]> {
  if (!viewer.user) return []
  const out: ExternalConnection[] = []
  out.push(
    ...(await listConnectionsForOwner({ type: 'user', id: viewer.user.id })),
  )
  for (const m of viewer.companyMemberships) {
    if (m.status !== 'active') continue
    out.push(
      ...(await listConnectionsForOwner({ type: 'company', id: m.company_id })),
    )
  }
  return out
}

export async function getConnectionById(
  id: string,
): Promise<ExternalConnection | null> {
  const row = await storeGetConnection(id)
  return row ? rowToConnection(row) : null
}

export async function findActiveConnection(
  owner: ProviderOwner,
  provider: ProviderKey,
): Promise<ExternalConnection | null> {
  const filter = ownerToFilter(owner)
  const row = await storeFindActive({
    ownerType: filter.ownerType,
    ownerId: filter.ownerId,
    provider,
  })
  return row ? rowToConnection(row) : null
}

/**
 * Reverse lookup: find the connection that owns a given provider
 * account id (e.g. Stripe `acct_*`, Google `sub`). Used by the
 * canonical webhook ingestion pipeline to resolve `connection_id`
 * from an adapter's `external_account_id_hint`. Backed by the
 * `idx_external_connections_external_account` index in Supabase
 * mode.
 */
export async function findConnectionByExternalAccount(
  provider: ProviderKey,
  externalAccountId: string,
): Promise<ExternalConnection | null> {
  const row = await storeFindByExternalAccount(provider, externalAccountId)
  return row ? rowToConnection(row) : null
}

// ─── Write paths ─────────────────────────────────────────────

export type CreateConnectionResult =
  | { ok: true; connection: ExternalConnection }
  | { ok: false; error: { code: string; message: string } }

/**
 * Create a new connection. Validates that:
 *
 *   - the provider key exists in the registry
 *   - the provider supports the owner type
 *   - (if status='active' or unset) no active connection exists
 *     for the same (owner, provider) — this is the partial
 *     unique index in SQL, mirrored in the in-memory store
 *
 * Authorization is the CALLER's job — this function takes a
 * raw input. Route handlers wrap it with `canConnectProvider`
 * checks before they call.
 */
export async function createConnection(
  input: CreateConnectionInput,
): Promise<CreateConnectionResult> {
  if (!isKnownProvider(input.provider)) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_PROVIDER',
        message: `Provider '${input.provider}' is not registered.`,
      },
    }
  }
  if (!providerSupportsOwnerMode(input.provider, input.owner.type)) {
    return {
      ok: false,
      error: {
        code: 'OWNER_TYPE_NOT_SUPPORTED',
        message: `Provider '${input.provider}' does not support owner type '${input.owner.type}'.`,
      },
    }
  }
  const descriptor = getProviderDescriptor(input.provider)!

  const insertInput: InsertConnectionInput = {
    provider: input.provider,
    category: descriptor.category,
    owner_type: input.owner.type,
    owner_id: input.owner.type === 'platform' ? null : input.owner.id,
    external_account_id: input.external_account_id,
    account_label: input.account_label ?? null,
    status: input.status ?? 'pending',
    granted_scopes: input.granted_scopes ?? [],
    created_by_user_id: input.created_by_user_id ?? null,
    metadata: input.metadata ?? {},
  }

  try {
    const row = await storeInsertConnection(insertInput)
    return { ok: true, connection: rowToConnection(row) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: { code: 'INSERT_FAILED', message },
    }
  }
}

/**
 * Soft-revoke a connection. Authorization is the caller's job;
 * the route handler runs `canManageProviderConnection` first.
 */
export async function revokeConnection(
  id: string,
): Promise<ExternalConnection | null> {
  const updated = await storeUpdateConnectionStatus(id, 'revoked', {
    revoked_at: new Date().toISOString(),
  })
  return updated ? rowToConnection(updated) : null
}

/**
 * Mark a connection's status. Used by webhook adapters that
 * detect provider-side state changes (e.g. Stripe Connect
 * requirements pending → reauth_required, refresh-token failure
 * → error, provider-side disconnect → revoked).
 *
 * The SQL `external_connections_revoked_consistency` CHECK requires
 * that status='revoked' rows always carry a `revoked_at` timestamp.
 * Mock mode would silently accept a missing timestamp; Supabase
 * mode would fail the constraint. We auto-stamp here so the two
 * modes can never diverge and the CHECK is honored regardless of
 * how the function is called. `revokeConnection` remains the
 * preferred entry point for explicit user-initiated revokes
 * because it carries audit semantics; `setConnectionStatus` is
 * the catch-all for adapter-driven transitions.
 */
export async function setConnectionStatus(
  id: string,
  status: ExternalConnection['status'],
  patch?: { metadata?: Record<string, unknown> },
): Promise<ExternalConnection | null> {
  const updated = await storeUpdateConnectionStatus(id, status, {
    metadata: patch?.metadata,
    // Auto-stamp revoked_at when transitioning into the revoked
    // state so the SQL CHECK is satisfied. Other states leave
    // revoked_at alone (it may already be non-null from a prior
    // revoke; we don't want to clear it).
    ...(status === 'revoked' ? { revoked_at: new Date().toISOString() } : {}),
  })
  return updated ? rowToConnection(updated) : null
}

// ─── Webhook ingestion ───────────────────────────────────────

export interface RecordWebhookEventResult {
  row: ExternalWebhookEventRow
  was_duplicate: boolean
}

/**
 * Insert a webhook event into the canonical ledger. Dedupes by
 * `(provider, external_event_id)`. The caller (the canonical
 * webhook route handler) MUST have already verified the
 * signature via the provider adapter and set
 * `signature_status='verified'` for the event to be considered
 * trusted by downstream processors.
 */
export async function recordWebhookEvent(
  input: RecordWebhookEventInput,
): Promise<RecordWebhookEventResult> {
  if (!isKnownProvider(input.provider)) {
    throw new Error(
      `recordWebhookEvent: unknown provider '${input.provider}'`,
    )
  }
  return storeInsertWebhookEvent(input)
}

/**
 * Mark a previously-recorded event as processed (succeeded or
 * failed). Idempotent: re-marking a processed event is a no-op.
 */
export async function markWebhookProcessed(
  input: MarkWebhookProcessedInput,
): Promise<ExternalWebhookEventRow | null> {
  return storeUpdateWebhookEventStatus(input.id, input.outcome, {
    error_message: input.error_message ?? null,
  })
}

/** Operator surface — list events by provider and status. */
export async function listWebhookEvents(
  filter: Parameters<typeof storeListWebhookEvents>[0] = {},
): Promise<ExternalWebhookEventRow[]> {
  return storeListWebhookEvents(filter)
}

// ─── Async capability predicates ─────────────────────────────
//
// These wrap the pure predicates in `./access.ts` with a fetch
// so callers don't have to manually pass a connection list.

/**
 * Async form: fetch the owner's active connections then run the
 * pure capability predicate. The expensive part is a single
 * `listConnections` call (one indexed seek in Supabase mode).
 */
export async function canUseCapabilityProvider(
  viewer: ProviderViewer,
  owner: ProviderOwner,
  capability: ProviderCapability,
): Promise<boolean> {
  const connections = await listConnectionsForOwner(owner, { status: 'active' })
  return canUseCapabilityProviderFor(viewer, owner, capability, connections)
}

// ─── Re-exports for convenience ──────────────────────────────

export {
  canUseProviderConnection,
  canManageProviderConnection,
} from './access'
