/**
 * RLS policy enforcement — integration tests.
 *
 * Drives the real dev Supabase via two clients:
 *
 *   - `service` — SUPABASE_SERVICE_ROLE_KEY, bypasses RLS.  Used to
 *     seed and tear down test fixtures.
 *   - `anon`    — NEXT_PUBLIC_SUPABASE_ANON_KEY, subject to RLS.
 *     This is what an unauthenticated browser would carry; what it
 *     CAN read is what leaks.
 *
 * We don't currently exercise the `authenticated` role here — that
 * requires a real auth.users row and signed JWT, which pulls in the
 * whole Supabase Auth provider (CCP 8).  A follow-up test will cover
 * self vs. other-user reads once that lands.
 *
 * Fixture strategy:
 *   Core fixtures (users + vault_assets) MUST insert cleanly; if they
 *   fail, the whole suite fails loudly — that signals the dev
 *   Supabase is not migrated to the current schema, which is the
 *   actual bug.  Extended fixtures (upload_batches, transactions,
 *   licence_grants) are tolerant of schema drift: if they fail, the
 *   tests that depend on them are skipped with a clear log line.
 *
 *   Every row is UUID-scoped per test run, so parallel runs don't
 *   stomp on each other and afterAll cleanup is precise.
 *
 * Skipped when env vars are absent so `bun x vitest` on a fresh
 * checkout without Supabase credentials doesn't fail.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const envPresent = Boolean(url && anonKey && serviceKey)
const d = envPresent ? describe : describe.skip

d('RLS — anon vs service_role', () => {
  let service: SupabaseClient
  let anon: SupabaseClient

  // Fixture IDs — scoped per test run.
  const creatorId = randomUUID()
  const buyerId = randomUUID()
  const batchCreatorId = randomUUID()

  const publicAssetId = randomUUID()
  const privateAssetId = randomUUID()
  const draftAssetId = randomUUID()

  const uploadBatchId = randomUUID()
  const transactionId = randomUUID()
  const licenceGrantId = randomUUID()

  // Extended-fixture success flags.  Tests that depend on these
  // skip when the fixture couldn't be seeded (schema drift on dev).
  let hasUploadBatch = false
  let hasTransaction = false
  let hasLicenceGrant = false

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Core fixture: users ───────────────────────────────────────
    const users = [
      {
        id: creatorId,
        username: `rls-creator-${creatorId.slice(0, 8)}`,
        display_name: 'RLS Creator',
        email: `rls-creator-${creatorId.slice(0, 8)}@test.local`,
      },
      {
        id: buyerId,
        username: `rls-buyer-${buyerId.slice(0, 8)}`,
        display_name: 'RLS Buyer',
        email: `rls-buyer-${buyerId.slice(0, 8)}@test.local`,
      },
      {
        id: batchCreatorId,
        username: `rls-batch-${batchCreatorId.slice(0, 8)}`,
        display_name: 'RLS Batch Creator',
        email: `rls-batch-${batchCreatorId.slice(0, 8)}@test.local`,
      },
    ]
    const { error: userErr } = await service.from('users').insert(users)
    if (userErr) {
      throw new Error(
        `[rls.test] Core users fixture failed (${userErr.message}). ` +
          `Run \`bunx supabase db push\` against the dev project to apply pending migrations.`,
      )
    }

    // ── Core fixture: vault_assets ────────────────────────────────
    const assets = [
      {
        id: publicAssetId,
        creator_id: creatorId,
        slug: `rls-pub-${publicAssetId.slice(0, 8)}`,
        title: 'RLS Public Asset',
        format: 'photo',
        privacy_state: 'PUBLIC',
        publication_state: 'PUBLISHED',
      },
      {
        id: privateAssetId,
        creator_id: creatorId,
        slug: `rls-pri-${privateAssetId.slice(0, 8)}`,
        title: 'RLS Private Asset',
        format: 'photo',
        privacy_state: 'PRIVATE',
        publication_state: 'PUBLISHED',
      },
      {
        id: draftAssetId,
        creator_id: creatorId,
        slug: `rls-drf-${draftAssetId.slice(0, 8)}`,
        title: 'RLS Draft Asset',
        format: 'photo',
        privacy_state: 'PUBLIC',
        publication_state: 'DRAFT',
      },
    ]
    const { error: assetErr } = await service.from('vault_assets').insert(assets)
    if (assetErr) {
      throw new Error(
        `[rls.test] Core vault_assets fixture failed (${assetErr.message}). ` +
          `Dev Supabase schema is behind migrations.`,
      )
    }

    // ── Extended fixture: upload_batches ──────────────────────────
    const { error: batchErr } = await service.from('upload_batches').insert({
      id: uploadBatchId,
      creator_id: batchCreatorId,
      state: 'open',
      newsroom_mode: false,
    })
    if (!batchErr) {
      hasUploadBatch = true
    } else {
      console.warn(
        `[rls.test] upload_batches fixture skipped: ${batchErr.message}`,
      )
    }

    // ── Extended fixture: transactions ────────────────────────────
    const { error: txnErr } = await service.from('transactions').insert({
      id: transactionId,
      kind: 'catalog_purchase',
      status: 'paid',
      source_type: 'catalogue_checkout',
      source_id: transactionId,
      buyer_user_id: buyerId,
      currency_code: 'EUR',
      gross_amount_cents: 10000,
      platform_fee_cents: 2000,
      creator_payout_cents: 8000,
      submitted_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    })
    if (!txnErr) {
      hasTransaction = true
    } else {
      console.warn(
        `[rls.test] transactions fixture skipped: ${txnErr.message}`,
      )
    }

    // ── Extended fixture: licence_grants ──────────────────────────
    if (hasTransaction) {
      const { error: grantErr } = await service.from('licence_grants').insert({
        id: licenceGrantId,
        asset_id: publicAssetId,
        buyer_id: buyerId,
        creator_id: creatorId,
        licence_type: 'editorial',
        state: 'active',
        term_start: new Date().toISOString(),
        source_type: 'catalogue_checkout',
        source_id: transactionId,
        negotiated_amount_cents: 10000,
        listed_price_at_grant_cents: 10000,
      })
      if (!grantErr) {
        hasLicenceGrant = true
      } else {
        console.warn(
          `[rls.test] licence_grants fixture skipped: ${grantErr.message}`,
        )
      }
    }
  }, 30_000)

  afterAll(async () => {
    if (!service) return
    // Teardown in reverse dependency order; tolerate missing rows.
    if (hasLicenceGrant) {
      await service.from('licence_grants').delete().eq('id', licenceGrantId)
    }
    if (hasTransaction) {
      await service.from('transactions').delete().eq('id', transactionId)
    }
    if (hasUploadBatch) {
      await service.from('upload_batches').delete().eq('id', uploadBatchId)
    }
    await service
      .from('vault_assets')
      .delete()
      .in('id', [publicAssetId, privateAssetId, draftAssetId])
    await service
      .from('users')
      .delete()
      .in('id', [creatorId, buyerId, batchCreatorId])
  }, 30_000)

  // ══════════════════════════════════════════════════════════════════
  // Core cases — rely only on users + vault_assets
  // ══════════════════════════════════════════════════════════════════

  // ── Case 1: anon CAN read PUBLIC + PUBLISHED vault_assets ──
  it('anon reads a PUBLIC + PUBLISHED vault_asset', async () => {
    const { data, error } = await anon
      .from('vault_assets')
      .select('id, title, privacy_state, publication_state')
      .eq('id', publicAssetId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.id).toBe(publicAssetId)
  })

  // ── Case 2: anon CANNOT read a PRIVATE vault_asset ──
  it('anon cannot read a PRIVATE vault_asset', async () => {
    const { data } = await anon
      .from('vault_assets')
      .select('id')
      .eq('id', privateAssetId)
      .maybeSingle()

    // RLS returns zero rows (not an error) when a policy doesn't match.
    expect(data).toBeNull()
  })

  // ── Case 3: anon CANNOT read a DRAFT vault_asset (even if public) ──
  it('anon cannot read a DRAFT vault_asset (publication gating)', async () => {
    const { data } = await anon
      .from('vault_assets')
      .select('id')
      .eq('id', draftAssetId)
      .maybeSingle()

    expect(data).toBeNull()
  })

  // ── Case 4: anon cannot SELECT users.email (column privilege) ──
  //
  //  Column-level privilege gate (see migration §B). SELECTing
  //  `email` as anon should produce a permission_denied error from
  //  PostgREST — distinct from an empty-row response, which is what
  //  RLS returns on row filtering.
  it('anon cannot SELECT users.email (column privilege)', async () => {
    const { data, error } = await anon
      .from('users')
      .select('email')
      .eq('id', creatorId)

    expect(data ?? []).toEqual([])
    expect(error).not.toBeNull()
    expect(error?.code ?? error?.message).toBeTruthy()
  })

  // ── Case 5: anon CAN read users_public (projection view) ──
  it('anon can read users_public with public fields only', async () => {
    const { data, error } = await anon
      .from('users_public')
      .select('id, username, display_name, avatar_url, founding_member')
      .eq('id', creatorId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(creatorId)
    expect(data?.username).toMatch(/^rls-creator-/)
  })

  // ── Case 6: service_role sees all vault_assets (sanity) ──
  //
  //  Not strictly an RLS test — but if this starts returning zero
  //  rows, the service-role key is misconfigured and every "anon
  //  cannot see" case above would become a false positive.
  it('service_role reads all three vault_assets (sanity)', async () => {
    const { data, error } = await service
      .from('vault_assets')
      .select('id')
      .in('id', [publicAssetId, privateAssetId, draftAssetId])

    expect(error).toBeNull()
    expect(data?.map((r) => r.id).sort()).toEqual(
      [publicAssetId, privateAssetId, draftAssetId].sort(),
    )
  })

  // ══════════════════════════════════════════════════════════════════
  // Extended cases — skipped when their fixture didn't seed
  // ══════════════════════════════════════════════════════════════════

  // ── Case 7: anon cannot read upload_batches ──
  it('anon cannot read upload_batches', async (ctx) => {
    if (!hasUploadBatch) ctx.skip()
    const { data } = await anon
      .from('upload_batches')
      .select('id')
      .eq('id', uploadBatchId)
      .maybeSingle()

    expect(data).toBeNull()
  })

  // ── Case 8: anon cannot read licence_grants ──
  it('anon cannot read licence_grants', async (ctx) => {
    if (!hasLicenceGrant) ctx.skip()
    const { data } = await anon
      .from('licence_grants')
      .select('id')
      .eq('id', licenceGrantId)
      .maybeSingle()

    expect(data).toBeNull()
  })

  // ── Case 9: anon cannot read transactions ──
  it('anon cannot read transactions', async (ctx) => {
    if (!hasTransaction) ctx.skip()
    const { data } = await anon
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .maybeSingle()

    expect(data).toBeNull()
  })
})
