/**
 * Frontfiles — Pack state-machine RPC integration tests (NR-D9a, F4)
 *
 * Drives the real local Supabase stack via the service-role
 * client. Mirrors the rls.test.ts integration-test pattern:
 *
 *   - opt-in via FF_INTEGRATION_TESTS=1 (default `describe.skip`
 *     so `bunx vitest run` on a fresh checkout doesn't fail)
 *   - per-run UUID-scoped fixtures
 *   - afterAll cleanup ordered for FK dependencies
 *
 * Test scope (~20 cases):
 *
 *   Happy paths (5)
 *     1. draft → scheduled (with embargo)
 *     2. draft → scheduled (with publish_at, no embargo)
 *     3. draft → published (immediate)
 *     4. published → archived
 *     5. archived → published
 *
 *   Precondition failures (8)
 *     6.  missing title
 *     7.  no assets
 *     8.  image asset missing alt_text
 *     9.  asset scan_result pending
 *     10. warranty missing
 *     11. no active signing key
 *     12. scheduled w/o embargo or publish_at
 *     13. immediate publish with embargo set
 *
 *   scheduled → draft branch (3)
 *     14. clean pullback (no recipient access)
 *     15. blocked by recipient access (no override)
 *     16. forced via override flag
 *
 *   scheduled → published auto-lift (1)
 *     17. embargo state → 'lifted'
 *
 *   Illegal transitions (3)
 *     18. published → draft
 *     19. draft → archived
 *     20. takedown → published (any → from takedown is illegal here)
 *
 * Total: 20 cases.
 *
 * Spec cross-references:
 *   - directives/NR-D9a-state-machine-rpc.md §F4
 *   - PRD §3.3 transition matrix
 *   - migration 20260425000007_newsroom_pack_transition_rpc.sql
 *   - src/lib/db/__tests__/rls.test.ts (integration-test pattern precedent)
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

import type {
  NewsroomLicenceClass,
  NewsroomPackStatus,
  NewsroomScanResult,
} from '@/lib/db/schema'
import {
  transitionPack,
  type TransitionResult,
} from '../pack-transition'

// ── Integration-mode gate ──────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const integrationMode = process.env.FF_INTEGRATION_TESTS === '1'
const envPresent = Boolean(url && serviceKey) && integrationMode
const d = envPresent ? describe : describe.skip

// Test-run-scoped prefix for fixture identifiers. afterAll
// cleans up only rows whose IDs were registered during this run.
const RUN_ID = randomUUID()
const KID_PREFIX = `nr-d9a-test-${RUN_ID.slice(0, 8)}`

// ── Test-scoped fixture state ──────────────────────────────────

interface PackFixtureOptions {
  /** Pack starting status. Default 'draft'. */
  status?: NewsroomPackStatus
  /** If true, omit title (publish-checklist failure). */
  noTitle?: boolean
  /** If true, skip creating assets (no_assets failure). */
  noAssets?: boolean
  /** If true, leave the image asset's alt_text NULL. */
  imageAssetMissingAltText?: boolean
  /** Override the image asset's scan result (default 'clean'). */
  scanResult?: NewsroomScanResult
  /** If true, omit the rights_warranty row. */
  noWarranty?: boolean
  /** If true, set embargo_id on the pack (creates a fresh embargo). */
  withEmbargo?: boolean
  /** If true, set publish_at on the pack. */
  withPublishAt?: boolean
  /**
   * If true and withEmbargo is also true, simulates a recipient
   * having accessed the embargo (access_count > 0). Used by
   * scheduled → draft pullback tests.
   */
  recipientAccessed?: boolean
}

interface PackFixture {
  packId: string
  companyId: string
  userId: string
  embargoId: string | null
}

d('newsroom_pack_transition RPC', () => {
  let service: SupabaseClient
  let weCreatedSigningKey = false
  let signingKid: string | null = null

  // Tracking arrays for cleanup ordering. FKs cascade where
  // possible; the order below mirrors child → parent.
  const createdPackIds: string[] = []
  const createdEmbargoIds: string[] = []
  const createdRecipientIds: string[] = []
  const createdCompanyIds: string[] = []
  const createdUserIds: string[] = []

  // ── Setup + teardown ────────────────────────────────────────

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Ensure an active signing key exists. The
    // idx_newsroom_signing_keys_single_active partial UNIQUE
    // index permits at most one row with status='active'. If
    // one exists from prior runs (or a real key), reuse it;
    // otherwise create a test-only one and track for cleanup.
    const { data: existing } = await service
      .from('newsroom_signing_keys')
      .select('kid')
      .eq('status', 'active')
      .maybeSingle()
    if (existing) {
      signingKid = existing.kid as string
      weCreatedSigningKey = false
    } else {
      const fakeKid = `${KID_PREFIX}-key-${randomUUID().slice(0, 8)}`
      const { error: insertError } = await service
        .from('newsroom_signing_keys')
        .insert({
          kid: fakeKid,
          // public_key_pem: any non-empty string passes the
          // length>0 CHECK; tests don't actually verify with this.
          public_key_pem: '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----',
          private_key_ref: `kms://test/${fakeKid}`,
          status: 'active',
        })
      if (insertError) {
        throw new Error(
          `Test setup: signing key insert failed: ${insertError.message}`,
        )
      }
      signingKid = fakeKid
      weCreatedSigningKey = true
    }
  })

  afterAll(async () => {
    if (!service) return

    // Cleanup ordering: most FK-dependent first, parents last.
    // Pack DELETE cascades to assets, scan_results, embargoes,
    // embargo_recipients, rights_warranties (per migration FKs).
    // Recipient cleanup is separate because newsroom_recipients
    // is independent of packs.

    if (createdPackIds.length > 0) {
      await service
        .from('newsroom_packs')
        .delete()
        .in('id', createdPackIds)
    }
    if (createdEmbargoIds.length > 0) {
      // Orphan-cancelled embargoes from scheduled → draft tests
      // may persist after pack DELETE if pack.embargo_id was
      // already cleared. Sweep them.
      await service
        .from('newsroom_embargoes')
        .delete()
        .in('id', createdEmbargoIds)
    }
    if (createdRecipientIds.length > 0) {
      await service
        .from('newsroom_recipients')
        .delete()
        .in('id', createdRecipientIds)
    }
    if (createdCompanyIds.length > 0) {
      await service
        .from('companies')
        .delete()
        .in('id', createdCompanyIds)
    }
    if (createdUserIds.length > 0) {
      await service
        .from('users')
        .delete()
        .in('id', createdUserIds)
    }
    if (weCreatedSigningKey && signingKid) {
      await service
        .from('newsroom_signing_keys')
        .delete()
        .eq('kid', signingKid)
    }
  })

  // ── Fixture helper ──────────────────────────────────────────

  async function makePackFixture(
    opts: PackFixtureOptions = {},
  ): Promise<PackFixture> {
    const userId = randomUUID()
    const companyId = randomUUID()
    const packId = randomUUID()
    const slug = `nr-d9a-${RUN_ID.slice(0, 8)}-${packId.slice(0, 8)}`

    // ── User ──
    const { error: userError } = await service.from('users').insert({
      id: userId,
      username: `nrd9a-${userId.slice(0, 8)}`,
      display_name: `NR-D9a Test ${userId.slice(0, 4)}`,
      email: `nrd9a-${userId.slice(0, 8)}@test.local`,
    })
    if (userError) {
      throw new Error(`Fixture user insert failed: ${userError.message}`)
    }
    createdUserIds.push(userId)

    // ── Company + newsroom_profile + admin membership ──
    const { error: companyError } = await service
      .from('companies')
      .insert({
        id: companyId,
        name: `NR-D9a Co ${companyId.slice(0, 4)}`,
        slug: `nrd9a-co-${companyId.slice(0, 8)}`,
        created_by_user_id: userId,
      })
    if (companyError) {
      throw new Error(
        `Fixture company insert failed: ${companyError.message}`,
      )
    }
    createdCompanyIds.push(companyId)

    await service.from('newsroom_profiles').insert({
      company_id: companyId,
      verification_tier: 'verified_source',
      primary_domain: `nrd9a-${companyId.slice(0, 8)}.test`,
    })

    await service.from('company_memberships').insert({
      company_id: companyId,
      user_id: userId,
      role: 'admin',
      status: 'active',
    })

    // ── Embargo (optional) ──
    let embargoId: string | null = null
    if (opts.withEmbargo) {
      embargoId = randomUUID()
      await service.from('newsroom_embargoes').insert({
        id: embargoId,
        pack_id: packId, // forward reference; OK because deferred FK + insert below
        lift_at: new Date(Date.now() + 86_400_000).toISOString(),
        policy_text: 'Test embargo policy.',
        state: 'active',
        notify_on_lift: true,
      })
      createdEmbargoIds.push(embargoId)
    }

    // ── Pack ──
    const status = opts.status ?? 'draft'
    const visibility =
      status === 'draft'
        ? 'private'
        : status === 'published'
          ? 'public'
          : status === 'archived'
            ? 'public'
            : status === 'takedown'
              ? 'tombstone'
              : 'private'
    const insertPayload: Record<string, unknown> = {
      id: packId,
      company_id: companyId,
      slug,
      title: opts.noTitle ? '' : `Test Pack ${packId.slice(0, 4)}`,
      credit_line: 'Photo: NR-D9a Test',
      licence_class: 'cc_attribution' satisfies NewsroomLicenceClass,
      status,
      visibility,
      created_by_user_id: userId,
    }
    // Pack-state-coherence CHECKs require timestamps on terminal
    // states. Set them appropriately for fixture states.
    if (status === 'published') {
      insertPayload.published_at = new Date().toISOString()
    }
    if (status === 'archived') {
      insertPayload.published_at = new Date(Date.now() - 86_400_000).toISOString()
      insertPayload.archived_at = new Date().toISOString()
    }
    if (status === 'takedown') {
      insertPayload.takedown_at = new Date().toISOString()
      insertPayload.takedown_reason = 'test'
    }
    if (opts.withEmbargo && embargoId) {
      insertPayload.embargo_id = embargoId
      // For draft/scheduled with embargo, visibility may be
      // 'restricted' (scheduled) or stays 'private' (draft).
      if (status === 'scheduled') insertPayload.visibility = 'restricted'
    }
    if (opts.withPublishAt) {
      insertPayload.publish_at = new Date(
        Date.now() + 86_400_000,
      ).toISOString()
    }

    const { error: packError } = await service
      .from('newsroom_packs')
      .insert(insertPayload)
    if (packError) {
      throw new Error(`Fixture pack insert failed: ${packError.message}`)
    }
    createdPackIds.push(packId)

    // ── Assets + scan_results ──
    if (!opts.noAssets) {
      const assetId = randomUUID()
      await service.from('newsroom_assets').insert({
        id: assetId,
        pack_id: packId,
        kind: 'image',
        mime_type: 'image/jpeg',
        original_filename: 'test.jpg',
        storage_url: `newsroom/packs/${packId}/assets/${assetId}/original.jpg`,
        file_size_bytes: 1024,
        width: 800,
        height: 600,
        checksum_sha256: 'a'.repeat(64),
        alt_text: opts.imageAssetMissingAltText ? null : 'Test alt text',
      })
      const scanResult = opts.scanResult ?? 'clean'
      await service.from('newsroom_asset_scan_results').insert({
        asset_id: assetId,
        scanner_suite: 'test_suite',
        scanner_version: '0.0.0',
        result: scanResult,
        // Pending state requires scanned_at NULL per CHECK; clean/etc require NOT NULL.
        scanned_at:
          scanResult === 'pending' ? null : new Date().toISOString(),
        // flagged requires ≥ 1 category
        flagged_categories: scanResult === 'flagged' ? ['adult'] : [],
        // error requires last_error
        last_error: scanResult === 'error' ? 'test error' : null,
      })
    }

    // ── Rights warranty ──
    if (!opts.noWarranty) {
      await service.from('newsroom_rights_warranties').insert({
        pack_id: packId,
        subject_releases_confirmed: true,
        third_party_content_cleared: true,
        music_cleared: true,
        confirmed_by_user_id: userId,
      })
    }

    // ── Recipient with access (optional) ──
    if (opts.withEmbargo && opts.recipientAccessed && embargoId) {
      const recipientId = randomUUID()
      await service.from('newsroom_recipients').insert({
        id: recipientId,
        email: `recipient-${recipientId.slice(0, 8)}@test.local`,
      })
      createdRecipientIds.push(recipientId)
      await service.from('newsroom_embargo_recipients').insert({
        embargo_id: embargoId,
        recipient_id: recipientId,
        access_token: 'test-token-' + 'x'.repeat(24),
        access_count: 1,
        first_accessed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      })
    }

    return { packId, companyId, userId, embargoId }
  }

  // ── Helper: assert success and return narrowed result ───────

  function expectSuccess(r: TransitionResult): asserts r is Extract<
    TransitionResult,
    { ok: true }
  > {
    if (!r.ok) {
      throw new Error(
        `Expected ok=true but got error_code=${r.errorCode}` +
          (r.missingPreconditions
            ? ` missing=${r.missingPreconditions.join(',')}`
            : ''),
      )
    }
  }

  // ── Tests ────────────────────────────────────────────────────

  it('1. draft → scheduled (success with embargo)', async () => {
    const f = await makePackFixture({ withEmbargo: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('scheduled')
    expect(r.newVisibility).toBe('restricted')
  })

  it('2. draft → scheduled (success with publish_at, no embargo)', async () => {
    const f = await makePackFixture({ withPublishAt: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('scheduled')
    expect(r.newVisibility).toBe('private')
  })

  it('3. draft → published (immediate)', async () => {
    const f = await makePackFixture({})
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'published',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('published')
    expect(r.newVisibility).toBe('public')
    expect(r.newPublishedAt).not.toBeNull()
  })

  it('4. published → archived', async () => {
    const f = await makePackFixture({ status: 'published' })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'archived',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('archived')
    expect(r.newArchivedAt).not.toBeNull()
  })

  it('5. archived → published (restore)', async () => {
    const f = await makePackFixture({ status: 'archived' })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'published',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('published')
    expect(r.newArchivedAt).toBeNull()
    expect(r.newPublishedAt).not.toBeNull()
  })

  it('6. precondition: missing title', async () => {
    const f = await makePackFixture({ noTitle: true, withEmbargo: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain('title')
    }
  })

  it('7. precondition: no assets', async () => {
    const f = await makePackFixture({ noAssets: true, withEmbargo: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain('no_assets')
    }
  })

  it('8. precondition: image asset missing alt_text', async () => {
    const f = await makePackFixture({
      imageAssetMissingAltText: true,
      withEmbargo: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain('asset_alt_text_missing')
    }
  })

  it('9. precondition: asset scan_result pending', async () => {
    const f = await makePackFixture({
      scanResult: 'pending',
      withEmbargo: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain(
        'asset_scan_pending_or_flagged',
      )
    }
  })

  it('10. precondition: warranty missing', async () => {
    const f = await makePackFixture({ noWarranty: true, withEmbargo: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain(
        'rights_warranty_missing_or_incomplete',
      )
    }
  })

  it('11. precondition: no active signing key', async () => {
    // Temporarily flip signing key to 'rotated' to simulate
    // missing-active state. Restore in finally.
    if (!signingKid) {
      // Should not happen given beforeAll — guard anyway.
      throw new Error('signingKid not initialized')
    }
    await service
      .from('newsroom_signing_keys')
      .update({
        status: 'rotated',
        rotated_at: new Date().toISOString(),
      })
      .eq('kid', signingKid)
    try {
      const f = await makePackFixture({ withEmbargo: true })
      const r = await transitionPack(service, {
        packId: f.packId,
        targetStatus: 'scheduled',
        callerUserId: f.userId,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errorCode).toBe('preconditions-not-met')
        expect(r.missingPreconditions).toContain('no_active_signing_key')
      }
    } finally {
      await service
        .from('newsroom_signing_keys')
        .update({ status: 'active', rotated_at: null })
        .eq('kid', signingKid)
    }
  })

  it('12. precondition: scheduled w/o embargo or publish_at', async () => {
    const f = await makePackFixture({})
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'scheduled',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain(
        'scheduled_requires_embargo_or_publish_at',
      )
    }
  })

  it('13. precondition: immediate publish with embargo set', async () => {
    const f = await makePackFixture({ withEmbargo: true })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'published',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('preconditions-not-met')
      expect(r.missingPreconditions).toContain(
        'immediate_publish_disallows_embargo_or_publish_at',
      )
    }
  })

  it('14. scheduled → draft (clean pullback, no recipient access)', async () => {
    const f = await makePackFixture({
      status: 'scheduled',
      withEmbargo: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'draft',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('draft')
    // Verify embargo state cancelled + pack.embargo_id NULL
    const { data: emb } = await service
      .from('newsroom_embargoes')
      .select('state')
      .eq('id', f.embargoId!)
      .single()
    expect(emb?.state).toBe('cancelled')
    const { data: pack } = await service
      .from('newsroom_packs')
      .select('embargo_id')
      .eq('id', f.packId)
      .single()
    expect(pack?.embargo_id).toBeNull()
  })

  it('15. scheduled → draft (blocked by recipient access, no override)', async () => {
    const f = await makePackFixture({
      status: 'scheduled',
      withEmbargo: true,
      recipientAccessed: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'draft',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('embargo-already-accessed')
    }
  })

  it('16. scheduled → draft (forced via override flag)', async () => {
    const f = await makePackFixture({
      status: 'scheduled',
      withEmbargo: true,
      recipientAccessed: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'draft',
      callerUserId: f.userId,
      overrideEmbargoCancel: true,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('draft')
  })

  it('17. scheduled → published (auto-lift; embargo state → lifted)', async () => {
    const f = await makePackFixture({
      status: 'scheduled',
      withEmbargo: true,
    })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'published',
      callerUserId: f.userId,
    })
    expectSuccess(r)
    expect(r.newStatus).toBe('published')
    const { data: emb } = await service
      .from('newsroom_embargoes')
      .select('state, lifted_at')
      .eq('id', f.embargoId!)
      .single()
    expect(emb?.state).toBe('lifted')
    expect(emb?.lifted_at).not.toBeNull()
  })

  it('18. illegal: published → draft', async () => {
    const f = await makePackFixture({ status: 'published' })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'draft',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('illegal-transition')
    }
  })

  it('19. illegal: draft → archived', async () => {
    const f = await makePackFixture({})
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'archived',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('illegal-transition')
    }
  })

  it('20. illegal: takedown → published (any-from-takedown)', async () => {
    const f = await makePackFixture({ status: 'takedown' })
    const r = await transitionPack(service, {
      packId: f.packId,
      targetStatus: 'published',
      callerUserId: f.userId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('illegal-transition')
    }
  })
})
