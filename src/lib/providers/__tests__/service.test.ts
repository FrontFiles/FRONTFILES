// ═══════════════════════════════════════════════════════════════
// Provider service — create/list/revoke + webhook dedupe
//
// These exercise the service layer end-to-end against the
// mock store. They don't touch Supabase — `isSupabaseConfigured()`
// returns false in the test env, so every service call routes
// through the in-memory implementation.
//
// What we cover:
//
//   - create + list round-trip
//   - active-connection partial uniqueness (owner, provider)
//   - revoke transitions status + sets revoked_at
//   - capability fan-out predicates compose with the live store
//   - webhook dedupe by (provider, external_event_id)
//   - the canonical webhook ingestion boundary verifies via the
//     Stripe adapter's mock-signature path
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createConnection,
  findActiveConnection,
  getConnectionById,
  listConnectionsForOwner,
  recordWebhookEvent,
  revokeConnection,
  setConnectionStatus,
} from '../service'
import { __testing as storeTesting } from '../store'
import { verifyAndIngestWebhook } from '../webhooks'

beforeEach(() => {
  storeTesting.reset()
})

// ─── createConnection ────────────────────────────────────────

describe('createConnection', () => {
  it('inserts a user-owned Stripe connection and lists it back', async () => {
    const result = await createConnection({
      provider: 'stripe',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'acct_test_1',
      account_label: 'Test creator',
      status: 'active',
    })
    if (!result.ok) throw new Error(`create failed: ${result.error.code}`)

    const list = await listConnectionsForOwner({ type: 'user', id: 'user-A' })
    expect(list).toHaveLength(1)
    expect(list[0].provider).toBe('stripe')
    expect(list[0].owner).toEqual({ type: 'user', id: 'user-A' })
    expect(list[0].status).toBe('active')
    expect(list[0].account_label).toBe('Test creator')
  })

  it('rejects unknown providers', async () => {
    const result = await createConnection({
      provider: 'not_a_provider' as never,
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'x',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('UNKNOWN_PROVIDER')
  })

  it('rejects an owner type the provider does not support', async () => {
    // google_identity is user-only.
    const result = await createConnection({
      provider: 'google_identity',
      owner: { type: 'company', id: 'co-1' },
      external_account_id: 'sub-1',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('OWNER_TYPE_NOT_SUPPORTED')
  })

  it('enforces the active-connection partial unique constraint', async () => {
    const first = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-1',
      status: 'active',
    })
    expect(first.ok).toBe(true)

    const second = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-2',
      status: 'active',
    })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error.code).toBe('INSERT_FAILED')
    expect(second.error.message).toMatch(/already exists/)
  })

  it('a revoked connection does not block a new active one', async () => {
    const first = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-1',
      status: 'active',
    })
    if (!first.ok) throw new Error('first create failed')
    await revokeConnection(first.connection.id)

    const second = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-2',
      status: 'active',
    })
    expect(second.ok).toBe(true)
  })

  it('platform connections must omit owner_id', async () => {
    const result = await createConnection({
      provider: 'stripe',
      owner: { type: 'platform' },
      external_account_id: 'acct_platform',
      status: 'active',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.connection.owner).toEqual({ type: 'platform' })
  })
})

// ─── revokeConnection ────────────────────────────────────────

describe('revokeConnection', () => {
  it('flips status to revoked and stamps revoked_at', async () => {
    const created = await createConnection({
      provider: 'stripe',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'acct_x',
      status: 'active',
    })
    if (!created.ok) throw new Error('create failed')

    const revoked = await revokeConnection(created.connection.id)
    expect(revoked).not.toBeNull()
    expect(revoked!.status).toBe('revoked')
    expect(revoked!.revoked_at).toBeTruthy()

    const fetched = await getConnectionById(created.connection.id)
    expect(fetched!.status).toBe('revoked')
  })
})

// ─── findActiveConnection ────────────────────────────────────

describe('findActiveConnection', () => {
  it('returns the active row, ignoring revoked rows', async () => {
    const a = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-1',
      status: 'active',
    })
    if (!a.ok) throw new Error('create failed')
    await revokeConnection(a.connection.id)

    const b = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-2',
      status: 'active',
    })
    if (!b.ok) throw new Error('second create failed')

    const found = await findActiveConnection(
      { type: 'user', id: 'user-A' },
      'google_drive',
    )
    expect(found).not.toBeNull()
    expect(found!.id).toBe(b.connection.id)
  })
})

// ─── setConnectionStatus ─────────────────────────────────────

describe('setConnectionStatus', () => {
  it('moves a connection to reauth_required and writes metadata', async () => {
    const created = await createConnection({
      provider: 'google_drive',
      owner: { type: 'user', id: 'user-A' },
      external_account_id: 'sub-1',
      status: 'active',
    })
    if (!created.ok) throw new Error('create failed')

    const updated = await setConnectionStatus(created.connection.id, 'reauth_required', {
      metadata: { reason: 'token expired' },
    })
    expect(updated!.status).toBe('reauth_required')
    expect(updated!.metadata).toEqual({ reason: 'token expired' })
  })
})

// ─── Webhook dedupe via the service ──────────────────────────

describe('recordWebhookEvent', () => {
  it('inserts a new event and reports was_duplicate=false', async () => {
    const result = await recordWebhookEvent({
      provider: 'stripe',
      external_event_id: 'evt_001',
      event_type: 'payment_intent.succeeded',
      payload: { amount: 100 },
      signature_status: 'verified',
    })
    expect(result.was_duplicate).toBe(false)
    expect(result.row.processing_status).toBe('pending')
  })

  it('returns the existing row on a duplicate (provider, external_event_id)', async () => {
    const first = await recordWebhookEvent({
      provider: 'stripe',
      external_event_id: 'evt_002',
      event_type: 'payment_intent.succeeded',
      payload: { amount: 100 },
      signature_status: 'verified',
    })
    const second = await recordWebhookEvent({
      provider: 'stripe',
      external_event_id: 'evt_002',
      event_type: 'payment_intent.succeeded',
      payload: { amount: 999 }, // intentionally different — proves we keep the original row
      signature_status: 'verified',
    })
    expect(second.was_duplicate).toBe(true)
    expect(second.row.id).toBe(first.row.id)
    expect(second.row.payload).toEqual({ amount: 100 })
  })

  it('different providers can share the same external_event_id', async () => {
    const a = await recordWebhookEvent({
      provider: 'stripe',
      external_event_id: 'evt_shared',
      event_type: 'a',
      payload: {},
      signature_status: 'verified',
    })
    const b = await recordWebhookEvent({
      provider: 'google_drive',
      external_event_id: 'evt_shared',
      event_type: 'b',
      payload: {},
      signature_status: 'verified',
    })
    expect(a.was_duplicate).toBe(false)
    expect(b.was_duplicate).toBe(false)
    expect(a.row.id).not.toBe(b.row.id)
  })

  it('rejects unknown providers loudly', async () => {
    await expect(
      recordWebhookEvent({
        provider: 'not_a_provider' as never,
        external_event_id: 'evt_x',
        event_type: 'x',
        payload: {},
        signature_status: 'verified',
      }),
    ).rejects.toThrow(/unknown provider/)
  })
})

// ─── verifyAndIngestWebhook (canonical boundary) ─────────────

describe('verifyAndIngestWebhook', () => {
  it('verifies a Stripe payload signed with the mock signature', async () => {
    const payload = {
      id: 'evt_real_001',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test' } },
    }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('verified')
    expect(result.event.signature_status).toBe('verified')
    expect(result.event.external_event_id).toBe('evt_real_001')
    expect(result.event.event_type).toBe('payment_intent.succeeded')
    expect(result.was_duplicate).toBe(false)
  })

  it('records a duplicate as was_duplicate=true and keeps the original signature_status', async () => {
    const payload = {
      id: 'evt_dup_001',
      type: 'payment_intent.succeeded',
      data: {},
    }
    const headers = { 'stripe-signature': 'mock-signature' }
    const body = JSON.stringify(payload)

    const first = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers,
      rawBody: body,
    })
    const second = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers,
      rawBody: body,
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.was_duplicate).toBe(true)
    expect(second.event.id).toBe(first.event.id)
  })

  it('lands an unverified payload in the ledger but flags it', async () => {
    const payload = { id: 'evt_unv_001', type: 't', data: {} }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'not-the-mock' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('unverified')
    expect(result.event.signature_status).toBe('unverified')
  })

  it('rejects unknown providers without inserting anything', async () => {
    const result = await verifyAndIngestWebhook({
      provider: 'not_a_provider' as never,
      headers: {},
      rawBody: '{}',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('UNKNOWN_PROVIDER')
  })

  it('returns INVALID_PAYLOAD when the JSON is malformed', async () => {
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: '{not-json',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('INVALID_PAYLOAD')
  })

  it('Google adapter accepts the mock-bearer placeholder', async () => {
    const payload = {
      message: {
        messageId: 'msg-001',
        attributes: { eventType: 'change' },
      },
    }
    const result = await verifyAndIngestWebhook({
      provider: 'google_drive',
      headers: { authorization: 'Bearer mock-bearer' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('verified')
    expect(result.event.event_type).toBe('change')
  })

  // ─── connection_id resolution by external_account_id ─────────
  //
  // These tests pin the missing-center fix from review pass 2:
  // an adapter that surfaces an `external_account_id_hint` MUST
  // get its event linked to the matching connection row, and the
  // hint must be ignored when no matching connection exists.

  it('resolves connection_id from a Stripe Connect event `account` field', async () => {
    // Pre-create the connection that owns the acct id.
    const connectionResult = await createConnection({
      provider: 'stripe',
      owner: { type: 'user', id: 'creator-1' },
      external_account_id: 'acct_creator_1',
      account_label: 'Creator One',
      status: 'active',
    })
    if (!connectionResult.ok) throw new Error('seed create failed')

    // Fire a Connect event carrying the acct id at the top level.
    const payload = {
      id: 'evt_connect_001',
      type: 'account.updated',
      account: 'acct_creator_1',
      data: { object: { id: 'acct_creator_1', object: 'account' } },
    }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.connection_id).toBe(connectionResult.connection.id)
  })

  it('falls back to data.object.id for platform Account events', async () => {
    const connectionResult = await createConnection({
      provider: 'stripe',
      owner: { type: 'platform' },
      external_account_id: 'acct_platform_self',
      status: 'active',
    })
    if (!connectionResult.ok) throw new Error('seed create failed')

    // Top-level `account` is absent here; the resolver should
    // pull the id out of data.object.id when object='account'.
    const payload = {
      id: 'evt_platform_001',
      type: 'account.updated',
      data: { object: { id: 'acct_platform_self', object: 'account' } },
    }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.connection_id).toBe(connectionResult.connection.id)
  })

  it('leaves connection_id null when no matching connection exists', async () => {
    // Note: no connection created. The hint exists but the lookup
    // misses. The event still lands (the ledger is the audit
    // trail for stray events too) but with connection_id=null.
    const payload = {
      id: 'evt_orphan_001',
      type: 'account.updated',
      account: 'acct_unknown',
    }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.connection_id).toBeNull()
  })

  it('leaves connection_id null when the adapter surfaces no hint at all', async () => {
    // payment_intent.* events are platform-scoped and carry no
    // `account` field. The resolver must not fabricate a hint.
    const payload = {
      id: 'evt_platform_pi_001',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test', object: 'payment_intent' } },
    }
    const result = await verifyAndIngestWebhook({
      provider: 'stripe',
      headers: { 'stripe-signature': 'mock-signature' },
      rawBody: JSON.stringify(payload),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.connection_id).toBeNull()
  })
})
