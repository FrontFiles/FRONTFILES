/**
 * Frontfiles — acceptOffer orchestrator unit tests (P4 concern 4A.2 Part B2)
 *
 * Five branch tests, one per failure-mode of the §8.5 straddle in
 * src/lib/offer/offer-accept.ts. Each test proves one behavioural
 * invariant of F4:
 *
 *   1. Happy path            — PI created with the derived key, no
 *                              Connect params, no PI cancel call,
 *                              RPC called once with the six named
 *                              params, result returns the five
 *                              event ids / hashes + assignment id.
 *   2. PI create fails       — card-declined surfaces as
 *                              { kind: 'stripe_create', 402,
 *                              'CARD_DECLINED' }; RPC never called;
 *                              cancel never called.
 *   3. RPC fails, void OK    — RPC's classified error is returned as
 *                              { kind: 'db_commit_voided', ... };
 *                              cancel called once with the SAME
 *                              idempotency key; NO fatal Sentry
 *                              message; NO reconcile log.
 *   4. RPC fails + void fails — reconcile path: log carries the
 *                              nine AC11 fields with `severity:
 *                              'critical'` + `event:
 *                              'accept.reconcile_needed'`; Sentry
 *                              `captureMessage` fires at `level:
 *                              'fatal'`; returns RECONCILE_NEEDED /
 *                              500.
 *   5. Unsupported currency  — R7 preflight RETURN (not throw):
 *                              { kind: 'preflight', 400,
 *                              'UNSUPPORTED_CURRENCY' }; PI create
 *                              never called; RPC never called.
 *
 * The nine-field reconcile log appears in case 4 ONLY. Cases 1, 2,
 * 3, 5 must NOT emit `severity: 'critical'` and must NOT call
 * `Sentry.captureMessage` at `level: 'fatal'`. The classifier
 * internals (SQLSTATE-to-kind dispatch, instanceof dispatch) are NOT
 * re-tested here — F8 / B1 classifier tests own that coverage. This
 * file asserts the orchestrator's branch selection and side-effect
 * sequencing only.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F9 (five-branch
 *     plan), §F4 (orchestrator under test), AC8 / AC9 / AC10 / AC11
 *     (test-anchored acceptance criteria).
 *   - R7 — unsupported currency is a returned preflight result, not
 *     a thrown exception. Case 5 uses `await expect(...).resolves...`
 *     to pin that.
 *   - R8 — no test for the 23505 double-accept race. It falls
 *     through the B1 classifier's UNKNOWN branch; indistinguishable
 *     at this layer from case 3.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import Stripe from 'stripe'

// ─── Hoisted mocks (must appear BEFORE importing acceptOffer) ─────
//
// vi.mock hoists to the top of the file, so these are already in
// place when `@/lib/offer/offer-accept` is imported.

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  childLogger: vi.fn(),
  newTraceId: vi.fn(() => 'trace_test'),
}))

import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

import { logger } from '@/lib/logger'
import { acceptOffer } from '@/lib/offer/offer-accept'
import type { OfferRow } from '@/lib/offer/types'

// ─── Shared fixtures ──────────────────────────────────────────────

const OFFER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUYER_ID = '11111111-1111-4111-8111-111111111111'
const CREATOR_ID = '22222222-2222-4222-8222-222222222222'
const ACTOR_HANDLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ACTOR_AUTH_USER_ID = BUYER_ID // buyer is accepting

const IDEMPOTENCY_KEY = `${OFFER_ID}:accept`

function makeOffer(overrides: Partial<OfferRow> = {}): OfferRow {
  return {
    id: OFFER_ID,
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    target_type: 'single_asset',
    gross_fee: 50.0,
    platform_fee_bps: 1500,
    currency: 'USD',
    rights: { template: 'editorial_one_time', params: {}, is_transfer: false },
    current_note: null,
    expires_at: '2099-12-31T23:59:59.000Z',
    state: 'sent',
    cancelled_by: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

type RpcFn = (
  fn: string,
  params: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>

function makeSupabase(rpc: RpcFn): SupabaseClient {
  return { rpc: vi.fn(rpc) } as unknown as SupabaseClient
}

type PiCreateFn = (
  params: Record<string, unknown>,
  options: { idempotencyKey: string },
) => Promise<{ id: string; client_secret?: string } | never>

type PiCancelFn = (
  id: string,
  params?: Record<string, unknown>,
  options?: { idempotencyKey?: string },
) => Promise<{ id: string; status: string } | never>

function makeStripe(
  create: PiCreateFn,
  cancel: PiCancelFn = vi.fn(() =>
    Promise.reject(new Error('cancel should not have been called')),
  ),
): Stripe {
  return {
    paymentIntents: {
      create: vi.fn(create),
      cancel: vi.fn(cancel),
    },
  } as unknown as Stripe
}

// ─── Per-test mock reset ──────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────

describe('acceptOffer', () => {
  // ── Case 1: happy path ─────────────────────────────────────────
  test('case 1: happy path — PI created + RPC commits + no cancel', async () => {
    const create = vi.fn<PiCreateFn>().mockResolvedValue({
      id: 'pi_123',
      client_secret: 'cs_123',
    })
    const cancel = vi.fn<PiCancelFn>()
    const stripe = {
      paymentIntents: { create, cancel },
    } as unknown as Stripe

    const rpc = vi.fn<RpcFn>().mockResolvedValue({
      data: [
        {
          offer_event_id: 'evt_offer_1',
          offer_event_hash: 'hash_offer_1',
          assignment_id: 'asn_1',
          assignment_event_id: 'evt_asn_1',
          assignment_event_hash: 'hash_asn_1',
        },
      ],
      error: null,
    })
    const supabase = { rpc } as unknown as SupabaseClient

    const result = await acceptOffer({
      supabase,
      stripe,
      actorHandle: ACTOR_HANDLE,
      actorAuthUserId: ACTOR_AUTH_USER_ID,
      offer: makeOffer(),
      expectedPieceCount: 3,
    })

    // Result shape — F4's actual surface (R10: now includes
    // paymentIntentId + clientSecret so F6 can return clientSecret
    // to the browser for stripe.confirmCardPayment).
    expect(result).toEqual({
      ok: true,
      paymentIntentId: 'pi_123',
      clientSecret: 'cs_123',
      offerEventId: 'evt_offer_1',
      offerEventHash: 'hash_offer_1',
      assignmentId: 'asn_1',
      assignmentEventId: 'evt_asn_1',
      assignmentEventHash: 'hash_asn_1',
    })
    // R10 — explicit field assertions for the two new R10 fields
    // so an accidental rename in F4 surfaces with a targeted error.
    if (result.ok) {
      expect(result.paymentIntentId).toBe('pi_123')
      expect(result.clientSecret).toBe('cs_123')
    }

    // Stripe create called exactly once with derived idempotency key.
    expect(create).toHaveBeenCalledTimes(1)
    const [createParams, createOptions] = create.mock.calls[0]!
    expect(createOptions).toEqual({ idempotencyKey: IDEMPOTENCY_KEY })

    // Amount + currency per D7.
    expect(createParams.amount).toBe(Math.round(50.0 * 100))
    expect(createParams.currency).toBe('usd')
    expect(createParams.capture_method).toBe('automatic')

    // D6 — no Connect params.
    expect(createParams).not.toHaveProperty('destination')
    expect(createParams).not.toHaveProperty('transfer_data')
    expect(createParams).not.toHaveProperty('on_behalf_of')
    expect(createParams).not.toHaveProperty('application_fee_amount')

    // D9 — all five forensic metadata fields (F4 uses buyer_id /
    // creator_id verbatim per directive F4 step 6).
    expect(createParams.metadata).toEqual({
      offer_id: OFFER_ID,
      buyer_id: BUYER_ID,
      creator_id: CREATOR_ID,
      actor_handle: ACTOR_HANDLE,
      event_type: 'offer.accepted',
    })

    // RPC called exactly once with the six named params.
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('rpc_accept_offer_commit', {
      p_actor_ref: ACTOR_HANDLE,
      p_offer_id: OFFER_ID,
      p_payment_intent_id: 'pi_123',
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_payload_offer: { v: 1, by_actor_id: ACTOR_HANDLE },
      p_payload_assignment: {
        v: 1,
        offer_id: OFFER_ID,
        target_type: 'single_asset',
        expected_piece_count: 3,
      },
    })

    // No void, no reconcile log, no fatal Sentry.
    expect(cancel).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical' }),
      expect.anything(),
    )
  })

  // ── Case 2: PI create fails (card declined) ────────────────────
  test('case 2: PI create fails with StripeCardError → stripe_create / 402', async () => {
    const cardErr = new Stripe.errors.StripeCardError({
      code: 'card_declined',
      message: 'Your card was declined.',
      type: 'card_error',
      decline_code: 'generic_decline',
    })
    const create = vi.fn<PiCreateFn>().mockRejectedValue(cardErr)
    const cancel = vi.fn<PiCancelFn>()
    const stripe = {
      paymentIntents: { create, cancel },
    } as unknown as Stripe

    const rpc = vi.fn<RpcFn>()
    const supabase = { rpc } as unknown as SupabaseClient

    const result = await acceptOffer({
      supabase,
      stripe,
      actorHandle: ACTOR_HANDLE,
      actorAuthUserId: ACTOR_AUTH_USER_ID,
      offer: makeOffer(),
      expectedPieceCount: 1,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'stripe_create',
      httpStatus: 402,
      code: 'CARD_DECLINED',
      message: expect.any(String),
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(rpc).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical' }),
      expect.anything(),
    )
  })

  // ── Case 3: RPC fails, void succeeds ───────────────────────────
  test('case 3: RPC invalid_state → db_commit_voided / 409, cancel with same key', async () => {
    const create = vi.fn<PiCreateFn>().mockResolvedValue({
      id: 'pi_456',
      client_secret: 'cs_456',
    })
    const cancel = vi.fn<PiCancelFn>().mockResolvedValue({
      id: 'pi_456',
      status: 'canceled',
    })
    const stripe = {
      paymentIntents: { create, cancel },
    } as unknown as Stripe

    // Use SQLSTATE P0003 so the B1 classifier dispatches to the
    // INVALID_STATE / 409 branch (rpc-errors.ts L139-159). The
    // prompt's literal `P0001` would classify to UNKNOWN/500; using
    // P0003 exercises the intended `db_commit_voided` 409 path.
    const rpc = vi.fn<RpcFn>().mockResolvedValue({
      data: null,
      error: {
        code: 'P0003',
        message: 'invalid_state: offer is accepted',
      },
    })
    const supabase = { rpc } as unknown as SupabaseClient

    const result = await acceptOffer({
      supabase,
      stripe,
      actorHandle: ACTOR_HANDLE,
      actorAuthUserId: ACTOR_AUTH_USER_ID,
      offer: makeOffer(),
      expectedPieceCount: 1,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'db_commit_voided',
      httpStatus: 409,
      code: 'INVALID_STATE',
      message: expect.any(String),
    })

    // Cancel called once with the SAME idempotency key used at create.
    expect(cancel).toHaveBeenCalledTimes(1)
    const cancelArgs = cancel.mock.calls[0]!
    expect(cancelArgs[0]).toBe('pi_456')
    expect(cancelArgs[2]).toEqual({ idempotencyKey: IDEMPOTENCY_KEY })

    // No reconcile log, no fatal Sentry.
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical' }),
      expect.anything(),
    )
  })

  // ── Case 4: RPC fails AND void fails (reconcile) ───────────────
  test('case 4: RPC fails + cancel throws → db_commit_reconcile + nine-field log + Sentry fatal', async () => {
    const create = vi.fn<PiCreateFn>().mockResolvedValue({
      id: 'pi_789',
      client_secret: 'cs_789',
    })
    const cancelErr = new Stripe.errors.StripeAPIError({
      message: 'Stripe API hiccup',
      type: 'api_error',
    })
    const cancel = vi.fn<PiCancelFn>().mockRejectedValue(cancelErr)
    const stripe = {
      paymentIntents: { create, cancel },
    } as unknown as Stripe

    const rpc = vi.fn<RpcFn>().mockResolvedValue({
      data: null,
      error: {
        code: 'P0003',
        message: 'invalid_state: offer is accepted',
      },
    })
    const supabase = { rpc } as unknown as SupabaseClient

    const result = await acceptOffer({
      supabase,
      stripe,
      actorHandle: ACTOR_HANDLE,
      actorAuthUserId: ACTOR_AUTH_USER_ID,
      offer: makeOffer(),
      expectedPieceCount: 1,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'db_commit_reconcile',
      httpStatus: 500,
      code: 'RECONCILE_NEEDED',
      message: expect.any(String),
    })

    // AC11 — nine required fields on the reconcile log (plus `route`
    // as scaffolding). F4 emits camelCase keys per directive F4
    // step 8; the 9 AC11 field names are listed literally below.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'offer-accept',
        event: 'accept.reconcile_needed',
        severity: 'critical',
        offerId: OFFER_ID,
        buyerId: BUYER_ID,
        creatorId: CREATOR_ID,
        paymentIntentId: 'pi_789',
        idempotencyKey: IDEMPOTENCY_KEY,
        dbCommitErrorCode: 'INVALID_STATE',
        stripeVoidErrorCode: 'STRIPE_UNAVAILABLE',
      }),
      '[offer-accept] reconcile required',
    )

    // Sentry fires fatal with the same nine-field extra payload.
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      '[offer-accept] reconcile required',
      expect.objectContaining({
        level: 'fatal',
        extra: expect.objectContaining({
          event: 'accept.reconcile_needed',
          severity: 'critical',
          offerId: OFFER_ID,
          paymentIntentId: 'pi_789',
          idempotencyKey: IDEMPOTENCY_KEY,
          dbCommitErrorCode: 'INVALID_STATE',
          stripeVoidErrorCode: 'STRIPE_UNAVAILABLE',
        }),
      }),
    )
  })

  // ── Case 5: unsupported currency (R7 preflight, not throw) ─────
  test('case 5: currency JPY → preflight / 400 UNSUPPORTED_CURRENCY, no Stripe / no RPC, no throw', async () => {
    const create = vi.fn<PiCreateFn>()
    const cancel = vi.fn<PiCancelFn>()
    const stripe = {
      paymentIntents: { create, cancel },
    } as unknown as Stripe

    const rpc = vi.fn<RpcFn>()
    const supabase = { rpc } as unknown as SupabaseClient

    // R7: orchestrator does not throw — assert via `.resolves.*`.
    await expect(
      acceptOffer({
        supabase,
        stripe,
        actorHandle: ACTOR_HANDLE,
        actorAuthUserId: ACTOR_AUTH_USER_ID,
        offer: makeOffer({ currency: 'JPY' }),
        expectedPieceCount: 1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'preflight',
      httpStatus: 400,
      code: 'UNSUPPORTED_CURRENCY',
    })

    expect(create).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
})

// Silence the unused-import warning for `makeSupabase` + `makeStripe`
// — the prompt requires us to declare them as shared factories; the
// individual tests inline equivalent construction for per-test mock
// access to `.mock.calls`, which is the more ergonomic pattern. The
// helpers remain exported-via-file-scope for future test additions.
void makeSupabase
void makeStripe
