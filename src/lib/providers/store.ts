// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: store
//
// Dual-mode persistence for `external_connections` and
// `external_webhook_events`. Mirrors the pattern used by
// `lib/identity/store.ts` and `lib/post/store.ts`.
//
// Mock mode: in-memory Maps, cleared between tests.
// Supabase mode: real DB queries through the service-role client.
//
// This module is the ONLY place provider rows should be read
// from or written to. The service layer (`./service.ts`) calls
// these functions and adds business rules on top — adapters
// don't talk to the store directly.
//
// SERVER-ONLY. Never import from a client component.
// ═══════════════════════════════════════════════════════════════

import { env, isSupabaseEnvPresent } from '@/lib/env'
import type {
  ExternalConnectionRow,
  ExternalWebhookEventRow,
  ProviderConnectionStatus,
  ProviderOwnerType,
  ProviderWebhookProcessingStatus,
  ProviderWebhookSignatureStatus,
} from '@/lib/db/schema'

// ─── Mode selector (CCP 4) ──────────────────────────────────
//
// Decided per-call from `isSupabaseEnvPresent`, with one
// test-harness escape: under Vitest (`NODE_ENV === 'test'`) we
// default to mock unless `FF_INTEGRATION_TESTS=1` is set. This
// decouples the providers mode decision from whether the
// Supabase env keys are present — they must be present for
// `src/lib/env.ts`'s module-load Zod parse, but presence alone
// should not opt every Vitest run into live-Supabase routing.
// See docs/audits/P4_CONCERN_2_DECISION_MEMO.md for why.
//
// Outside Vitest, the flag has no effect: production and dev
// servers set `NODE_ENV` to `production` / `development`, never
// `test`, so the branch is unreachable and the mode derivation
// is identical to pre-concern-2 behaviour.

function getMode(): 'real' | 'mock' {
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.FF_INTEGRATION_TESTS !== '1'
  ) {
    return 'mock'
  }
  return isSupabaseEnvPresent() ? 'real' : 'mock'
}

let _modeLogged = false
function logModeOnce(): void {
  if (_modeLogged) return
  _modeLogged = true
  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(`[ff:mode] providers=${getMode()}`)
  }
}

// ─── In-memory store (dev/test mode) ────────────────────────

const connectionStore = new Map<string, ExternalConnectionRow>()
const webhookEventStore = new Map<string, ExternalWebhookEventRow>()

// Dedupe key for webhook events. Mirrors the SQL UNIQUE INDEX
// `uq_external_webhook_events_dedupe`. Used by `recordWebhookEvent`
// to short-circuit duplicate inserts in mock mode.
const webhookDedupeIndex = new Map<string, string>() // `${provider}::${external_event_id}` → event id

function dedupeKey(provider: string, externalEventId: string): string {
  return `${provider}::${externalEventId}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function mockId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

// ─── Lazy Supabase client accessor ──────────────────────────

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ═══════════════════════════════════════════════════════════════
// READ — connections
// ═══════════════════════════════════════════════════════════════

export interface ListConnectionsFilter {
  ownerType: ProviderOwnerType
  /** NULL only when ownerType === 'platform'. */
  ownerId: string | null
  /** Limit to a single provider key. */
  provider?: string
  /** Limit to a single status (e.g. 'active'). */
  status?: ProviderConnectionStatus
}

export async function listConnections(
  filter: ListConnectionsFilter,
): Promise<ExternalConnectionRow[]> {
  logModeOnce()
  if (getMode() === 'mock') {
    return Array.from(connectionStore.values())
      .filter((row) => row.owner_type === filter.ownerType)
      .filter((row) => {
        if (filter.ownerType === 'platform') return row.owner_id === null
        return row.owner_id === filter.ownerId
      })
      .filter((row) => !filter.provider || row.provider === filter.provider)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  const client = await db()
  let query = client
    .from('external_connections')
    .select('*')
    .eq('owner_type', filter.ownerType)
    .order('created_at', { ascending: false })

  if (filter.ownerType === 'platform') {
    query = query.is('owner_id', null)
  } else {
    query = query.eq('owner_id', filter.ownerId)
  }
  if (filter.provider) query = query.eq('provider', filter.provider)
  if (filter.status) query = query.eq('status', filter.status)

  const { data, error } = await query
  if (error) {
    throw new Error(`providers store: listConnections failed (${error.message})`)
  }
  return (data ?? []) as ExternalConnectionRow[]
}

export async function getConnection(
  id: string,
): Promise<ExternalConnectionRow | null> {
  logModeOnce()
  if (getMode() === 'mock') {
    return connectionStore.get(id) ?? null
  }
  const client = await db()
  const { data, error } = await client
    .from('external_connections')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throw new Error(`providers store: getConnection failed (${error.message})`)
  }
  return (data as ExternalConnectionRow | null) ?? null
}

export async function findActiveConnection(
  filter: ListConnectionsFilter,
): Promise<ExternalConnectionRow | null> {
  const rows = await listConnections({ ...filter, status: 'active' })
  return rows[0] ?? null
}

/**
 * Reverse lookup: find the connection that owns a given provider
 * account id. Backed by `idx_external_connections_external_account`
 * in Supabase mode. This is the resolver the canonical webhook
 * pipeline calls so a Stripe Connect event with
 * `account: 'acct_xxx'` lands on the correct Frontfiles
 * `external_connections` row.
 *
 * Returns the most recent matching row regardless of status. The
 * caller (the webhook ingestion layer) wants this even when the
 * connection has been revoked — the audit link should survive a
 * disconnect → reconnect cycle so an operator can reconstruct
 * what happened.
 */
export async function findConnectionByExternalAccount(
  provider: string,
  externalAccountId: string,
): Promise<ExternalConnectionRow | null> {
  logModeOnce()
  if (getMode() === 'mock') {
    return (
      Array.from(connectionStore.values())
        .filter(
          (row) =>
            row.provider === provider &&
            row.external_account_id === externalAccountId,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    )
  }

  const client = await db()
  const { data, error } = await client
    .from('external_connections')
    .select('*')
    .eq('provider', provider)
    .eq('external_account_id', externalAccountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(
      `providers store: findConnectionByExternalAccount failed (${error.message})`,
    )
  }
  return (data as ExternalConnectionRow | null) ?? null
}

// ═══════════════════════════════════════════════════════════════
// WRITE — connections
// ═══════════════════════════════════════════════════════════════

export interface InsertConnectionInput {
  provider: string
  category: ExternalConnectionRow['category']
  owner_type: ProviderOwnerType
  owner_id: string | null
  external_account_id: string
  account_label?: string | null
  status?: ProviderConnectionStatus
  granted_scopes?: string[]
  created_by_user_id?: string | null
  metadata?: Record<string, unknown>
}

export async function insertConnection(
  input: InsertConnectionInput,
): Promise<ExternalConnectionRow> {
  logModeOnce()
  // Enforce the platform-owner-id invariant in app land too —
  // the SQL CHECK is the ultimate guard but failing here gives
  // a clearer error than a constraint violation.
  if (input.owner_type === 'platform' && input.owner_id !== null) {
    throw new Error(
      'providers store: platform connections must have owner_id=null',
    )
  }
  if (input.owner_type !== 'platform' && !input.owner_id) {
    throw new Error(
      `providers store: owner_type=${input.owner_type} requires owner_id`,
    )
  }

  if (getMode() === 'mock') {
    const row: ExternalConnectionRow = {
      id: mockId('extconn'),
      provider: input.provider,
      category: input.category,
      owner_type: input.owner_type,
      owner_id: input.owner_id,
      external_account_id: input.external_account_id,
      account_label: input.account_label ?? null,
      status: input.status ?? 'pending',
      granted_scopes: input.granted_scopes ?? [],
      created_by_user_id: input.created_by_user_id ?? null,
      created_at: nowIso(),
      revoked_at: null,
      last_synced_at: null,
      metadata: input.metadata ?? {},
    }
    // Mirror the partial unique index. Mock mode rejects active
    // duplicates loudly so tests catch service-layer bugs that
    // would otherwise surface as a 23505 in production only.
    if (row.status === 'active') {
      const existing = Array.from(connectionStore.values()).find(
        (r) =>
          r.status === 'active' &&
          r.owner_type === row.owner_type &&
          r.owner_id === row.owner_id &&
          r.provider === row.provider,
      )
      if (existing) {
        throw new Error(
          'providers store: an active connection already exists for this owner+provider',
        )
      }
    }
    connectionStore.set(row.id, row)
    return row
  }

  const client = await db()
  const { data, error } = await client
    .from('external_connections')
    .insert({
      provider: input.provider,
      category: input.category,
      owner_type: input.owner_type,
      owner_id: input.owner_id,
      external_account_id: input.external_account_id,
      account_label: input.account_label ?? null,
      status: input.status ?? 'pending',
      granted_scopes: input.granted_scopes ?? [],
      created_by_user_id: input.created_by_user_id ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(
      `providers store: insertConnection failed (${error?.message ?? 'no row'})`,
    )
  }
  return data as ExternalConnectionRow
}

export async function updateConnectionStatus(
  id: string,
  status: ProviderConnectionStatus,
  patch?: Partial<{
    revoked_at: string | null
    last_synced_at: string | null
    metadata: Record<string, unknown>
  }>,
): Promise<ExternalConnectionRow | null> {
  logModeOnce()
  if (getMode() === 'mock') {
    const row = connectionStore.get(id)
    if (!row) return null
    const updated: ExternalConnectionRow = {
      ...row,
      status,
      revoked_at: patch?.revoked_at ?? row.revoked_at,
      last_synced_at: patch?.last_synced_at ?? row.last_synced_at,
      metadata: patch?.metadata ?? row.metadata,
    }
    connectionStore.set(id, updated)
    return updated
  }

  const client = await db()
  const { data, error } = await client
    .from('external_connections')
    .update({
      status,
      ...(patch?.revoked_at !== undefined && { revoked_at: patch.revoked_at }),
      ...(patch?.last_synced_at !== undefined && {
        last_synced_at: patch.last_synced_at,
      }),
      ...(patch?.metadata !== undefined && { metadata: patch.metadata }),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return null
  return data as ExternalConnectionRow
}

// ═══════════════════════════════════════════════════════════════
// WRITE — webhook events
// ═══════════════════════════════════════════════════════════════

export interface InsertWebhookEventInput {
  provider: string
  external_event_id: string
  event_type: string
  payload: Record<string, unknown>
  signature_status: ProviderWebhookSignatureStatus
  connection_id?: string | null
}

/**
 * Record a webhook event with built-in dedupe. If an event with
 * the same `(provider, external_event_id)` already exists, the
 * existing row is returned and `was_duplicate` is true.
 *
 * In mock mode this is enforced by the in-memory dedupe index;
 * in Supabase mode it relies on the SQL UNIQUE INDEX
 * `uq_external_webhook_events_dedupe` via INSERT … ON CONFLICT
 * DO NOTHING followed by a SELECT.
 */
export interface InsertWebhookEventResult {
  row: ExternalWebhookEventRow
  was_duplicate: boolean
}

export async function insertWebhookEvent(
  input: InsertWebhookEventInput,
): Promise<InsertWebhookEventResult> {
  logModeOnce()
  const key = dedupeKey(input.provider, input.external_event_id)

  if (getMode() === 'mock') {
    const existingId = webhookDedupeIndex.get(key)
    if (existingId) {
      const existing = webhookEventStore.get(existingId)!
      return { row: existing, was_duplicate: true }
    }
    const row: ExternalWebhookEventRow = {
      id: mockId('extevt'),
      provider: input.provider,
      external_event_id: input.external_event_id,
      event_type: input.event_type,
      payload: input.payload,
      signature_status: input.signature_status,
      processing_status: 'pending',
      connection_id: input.connection_id ?? null,
      received_at: nowIso(),
      processed_at: null,
      retry_count: 0,
      error_message: null,
    }
    webhookEventStore.set(row.id, row)
    webhookDedupeIndex.set(key, row.id)
    return { row, was_duplicate: false }
  }

  const client = await db()

  // Try a normal insert first; on conflict, fetch the existing
  // row. PostgreSQL doesn't return the existing row from an
  // ON CONFLICT DO NOTHING in one shot via supabase-js, so we
  // use the well-known two-step pattern.
  const { data: inserted, error: insertError } = await client
    .from('external_webhook_events')
    .insert({
      provider: input.provider,
      external_event_id: input.external_event_id,
      event_type: input.event_type,
      payload: input.payload,
      signature_status: input.signature_status,
      connection_id: input.connection_id ?? null,
    })
    .select('*')
    .maybeSingle()

  if (inserted) {
    return { row: inserted as ExternalWebhookEventRow, was_duplicate: false }
  }

  // 23505 = unique violation → duplicate. Anything else is fatal.
  if (insertError && insertError.code !== '23505') {
    throw new Error(
      `providers store: insertWebhookEvent failed (${insertError.message})`,
    )
  }

  const { data: existing, error: selectError } = await client
    .from('external_webhook_events')
    .select('*')
    .eq('provider', input.provider)
    .eq('external_event_id', input.external_event_id)
    .maybeSingle()
  if (selectError || !existing) {
    throw new Error(
      `providers store: dedupe SELECT failed (${selectError?.message ?? 'no row'})`,
    )
  }
  return { row: existing as ExternalWebhookEventRow, was_duplicate: true }
}

export async function updateWebhookEventStatus(
  id: string,
  status: ProviderWebhookProcessingStatus,
  patch?: Partial<{ error_message: string | null }>,
): Promise<ExternalWebhookEventRow | null> {
  logModeOnce()
  // Shared transition rules — must produce identical writes for
  // mock and Supabase modes so the test suite (mock-only) actually
  // reflects production behaviour.
  //
  //   processed_at: stamped on the FIRST move into succeeded / failed
  //                 / dead_letter and left alone on subsequent
  //                 transitions (e.g. failed → pending → failed
  //                 keeps the original processed_at). Treating it
  //                 as "first-completion" instead of "last-touched"
  //                 lets operators sort the dead-letter queue by
  //                 the original failure time.
  //
  //   retry_count:  incremented when entering failed / dead_letter.
  //                 Not touched on succeeded.
  const isTerminal =
    status === 'succeeded' || status === 'failed' || status === 'dead_letter'
  const incrementsRetry = status === 'failed' || status === 'dead_letter'

  if (getMode() === 'mock') {
    const row = webhookEventStore.get(id)
    if (!row) return null
    const updated: ExternalWebhookEventRow = {
      ...row,
      processing_status: status,
      processed_at:
        isTerminal && row.processed_at === null ? nowIso() : row.processed_at,
      retry_count: incrementsRetry ? row.retry_count + 1 : row.retry_count,
      error_message: patch?.error_message ?? row.error_message,
    }
    webhookEventStore.set(id, updated)
    return updated
  }

  const client = await db()

  // The Supabase path needs the current row to (a) know whether
  // processed_at is already set, and (b) compute retry_count + 1
  // since supabase-js has no native atomic-increment. A single
  // processor per event is the expected concurrency model — the
  // architecture comment in webhooks.ts calls it "forward-only"
  // and assumes single-writer per row — so the read-then-update
  // race window is acceptable for v1. If multi-writer retry ever
  // lands, swap this for a Postgres function called via .rpc().
  const existing = await getWebhookEvent(id)
  if (!existing) return null

  const update: Record<string, unknown> = {
    processing_status: status,
  }
  if (isTerminal && existing.processed_at === null) {
    update.processed_at = nowIso()
  }
  if (incrementsRetry) {
    update.retry_count = existing.retry_count + 1
  }
  if (patch?.error_message !== undefined) {
    update.error_message = patch.error_message
  }

  const { data, error } = await client
    .from('external_webhook_events')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return null
  return data as ExternalWebhookEventRow
}

/**
 * Fetch a single webhook event by id. Used internally by
 * `updateWebhookEventStatus` to compute increment-on-update
 * semantics; exposed because the operator surface and the
 * connection_id resolver path benefit from a direct lookup.
 */
export async function getWebhookEvent(
  id: string,
): Promise<ExternalWebhookEventRow | null> {
  logModeOnce()
  if (getMode() === 'mock') {
    return webhookEventStore.get(id) ?? null
  }
  const client = await db()
  const { data, error } = await client
    .from('external_webhook_events')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throw new Error(
      `providers store: getWebhookEvent failed (${error.message})`,
    )
  }
  return (data as ExternalWebhookEventRow | null) ?? null
}

export async function listWebhookEvents(
  filter: { provider?: string; status?: ProviderWebhookProcessingStatus; limit?: number } = {},
): Promise<ExternalWebhookEventRow[]> {
  logModeOnce()
  if (getMode() === 'mock') {
    return Array.from(webhookEventStore.values())
      .filter((row) => !filter.provider || row.provider === filter.provider)
      .filter((row) => !filter.status || row.processing_status === filter.status)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, filter.limit ?? 50)
  }

  const client = await db()
  let q = client
    .from('external_webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(filter.limit ?? 50)
  if (filter.provider) q = q.eq('provider', filter.provider)
  if (filter.status) q = q.eq('processing_status', filter.status)
  const { data, error } = await q
  if (error) {
    throw new Error(`providers store: listWebhookEvents failed (${error.message})`)
  }
  return (data ?? []) as ExternalWebhookEventRow[]
}

// ─── Test helpers ────────────────────────────────────────────

export const __testing = {
  reset(): void {
    connectionStore.clear()
    webhookEventStore.clear()
    webhookDedupeIndex.clear()
  },
  seedConnection(row: ExternalConnectionRow): void {
    connectionStore.set(row.id, row)
  },
  snapshotConnections(): ExternalConnectionRow[] {
    return Array.from(connectionStore.values())
  },
  snapshotWebhookEvents(): ExternalWebhookEventRow[] {
    return Array.from(webhookEventStore.values())
  },
}
