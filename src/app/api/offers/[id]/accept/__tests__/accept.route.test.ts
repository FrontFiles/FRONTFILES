// ═══════════════════════════════════════════════════════════════
// POST /api/offers/[id]/accept — route integration tests
// (P4 4A.2 Part B2 F10)
//
// Eleven HTTP-surface cases around a mocked orchestrator. Coverage:
// auth, offer lookup, buyer-only preflight (R2), state preflight,
// Stripe gate (AC14 / AC6), piece-count query, five orchestrator-
// outcome branches (happy path + four OfferAcceptResult.ok:false
// kinds). The orchestrator's own branch selection is F9's scope;
// F10 treats it as a black box returning classified results.
//
// Mock boundaries (directly per Prompt 9 spec):
//   - `@/lib/auth/require-actor`     → requireActor: vi.fn()
//   - `@/lib/stripe/client`          → isStripeConfigured + getStripeClient
//   - `@/lib/offer/offer-accept`     → acceptOffer: vi.fn()
//   - `@/lib/db/client`              → chain-mock per B1's counter
//     route test convention (getSupabaseClientForUser returns a
//     minimal chain that supports `.from('offers').select().eq().
//     maybeSingle()` and `.from(pieceTable).select('*', { count,
//     head }).eq()`). canAccept is NOT mocked — it runs against
//     the rigged OfferRow.
//
// Response envelope mirrors B1: `{ data: {...} }` on success,
// `{ error: { code, message } }` on failure.
//
// References:
//   - docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md §F10 (test
//     catalogue), §F6 error-surface table (R11-revised — `not_party`
//     → 403), AC5 / AC6 / AC14.
//   - src/app/api/offers/[id]/counter/__tests__/counter.route.test.ts
//     — the B1 convention this file mirrors (mockState + vi.hoisted,
//     beforeEach reset, `ctxFor`, `Request` with bearer header).
// ═══════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted mock state ────────────────────────────────────────
//
// vi.hoisted runs before any vi.mock factory so the mocked modules
// can close over this object. Each test rigs fields on `state`;
// beforeEach resets to the neutral baseline.

const HOISTED = vi.hoisted(() => ({
  state: {
    offerRow: null as Record<string, unknown> | null,
    offerErr: null as { code?: string; message: string } | null,
    pieceCount: 1 as number | null,
    pieceErr: null as { code?: string; message: string } | null,
  },
}))

// ─── Module mocks ──────────────────────────────────────────────

vi.mock('@/lib/auth/require-actor', () => ({
  requireActor: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  isStripeConfigured: vi.fn(() => true),
  getStripeClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/offer/offer-accept', () => ({
  acceptOffer: vi.fn(),
}))

vi.mock('@/lib/db/client', () => {
  // Chain-mock that supports both:
  //   .from('offers').select('*').eq('id', x).maybeSingle()
  //   .from('offer_assets').select('*', {count:'exact', head:true}).eq('offer_id', x)
  // The distinguishing signal is the second arg to `.select()`: the
  // count path passes `{ count: 'exact', head: true }`, the plain
  // path passes nothing.
  const client = {
    from: () => ({
      select: (
        _cols: unknown,
        opts?: { count?: string; head?: boolean },
      ) => {
        const countMode = opts?.count === 'exact' && opts?.head === true
        return {
          eq: () => {
            if (countMode) {
              // Thenable: awaited directly for { count, error }.
              return Promise.resolve({
                count: HOISTED.state.pieceCount,
                error: HOISTED.state.pieceErr,
              })
            }
            return {
              maybeSingle: () =>
                Promise.resolve({
                  data: HOISTED.state.offerRow,
                  error: HOISTED.state.offerErr,
                }),
            }
          },
        }
      },
    }),
  }
  return {
    getSupabaseClient: () => client,
    getSupabaseClientForUser: () => client,
    _resetSupabaseClient: () => {},
    isSupabaseConfigured: () => true,
  }
})

// Import AFTER vi.mock so the hoisted mocks are in place.
import { requireActor } from '@/lib/auth/require-actor'
import { acceptOffer } from '@/lib/offer/offer-accept'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { POST } from '../route'

// ─── Constants ─────────────────────────────────────────────────

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const ACTOR_HANDLE = '22222222-2222-4222-8222-222222222222'
const BUYER_ID = AUTH_USER_ID
const CREATOR_ID = '33333333-3333-4333-8333-333333333333'
const OFFER_ID = '55555555-5555-4555-8555-555555555555'

// ─── Fixtures ──────────────────────────────────────────────────

type MockOfferOverrides = Partial<{
  id: string
  buyer_id: string
  creator_id: string
  target_type: string
  gross_fee: number
  platform_fee_bps: number
  currency: string
  rights: unknown
  current_note: string | null
  expires_at: string
  state: string
  cancelled_by: string | null
  created_at: string
  updated_at: string
}>

function makeOffer(overrides: MockOfferOverrides = {}): Record<string, unknown> {
  return {
    id: OFFER_ID,
    buyer_id: BUYER_ID,
    creator_id: CREATOR_ID,
    target_type: 'asset_pack',
    gross_fee: 1000,
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

function makeRequest(authorization: string | null = 'Bearer test-jwt'): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (authorization) headers.set('authorization', authorization)
  return new Request(`http://localhost/api/offers/${OFFER_ID}/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
}

function ctxFor(id: string = OFFER_ID): {
  params: Promise<{ id: string }>
} {
  return { params: Promise.resolve({ id }) }
}

function setAuthedActor(
  authUserId: string = BUYER_ID,
  handle: string = ACTOR_HANDLE,
): void {
  vi.mocked(requireActor).mockResolvedValue({
    ok: true,
    actor: { handle, authUserId },
  })
}

async function callRoute(
  request: Request = makeRequest(),
  id: string = OFFER_ID,
): Promise<Response> {
  return POST(
    request as unknown as Parameters<typeof POST>[0],
    ctxFor(id),
  )
}

// ─── Per-test reset ────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  HOISTED.state.offerRow = null
  HOISTED.state.offerErr = null
  HOISTED.state.pieceCount = 1
  HOISTED.state.pieceErr = null
  vi.mocked(isStripeConfigured).mockReturnValue(true)
  vi.mocked(getStripeClient).mockReturnValue(
    {} as unknown as ReturnType<typeof getStripeClient>,
  )
  // Default requireActor: unauthenticated. Tests that need a valid
  // actor call setAuthedActor() to override.
  vi.mocked(requireActor).mockResolvedValue({
    ok: false,
    reason: 'UNAUTHENTICATED',
  })
})

// ─── Tests ─────────────────────────────────────────────────────

describe('POST /api/offers/[id]/accept', () => {
  it('case 1: returns 401 UNAUTHENTICATED when requireActor denies', async () => {
    vi.mocked(requireActor).mockResolvedValue({
      ok: false,
      reason: 'UNAUTHENTICATED',
    })

    const res = await callRoute()

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHENTICATED')
    expect(typeof body.error.message).toBe('string')
    expect(body.error.message.length).toBeGreaterThan(0)
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it('case 2: returns 404 OFFER_NOT_FOUND when offer lookup returns null', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = null
    HOISTED.state.offerErr = null

    const res = await callRoute()

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('OFFER_NOT_FOUND')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it('case 3: returns 403 NOT_PARTY when caller is not the buyer (R11)', async () => {
    // Actor is the creator. canAccept runs unmocked and emits
    // `not_party: accept is buyer-only` because
    // offer.buyer_id !== actor.authUserId.
    setAuthedActor(CREATOR_ID, ACTOR_HANDLE)
    HOISTED.state.offerRow = makeOffer()

    const res = await callRoute()

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_PARTY')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it("case 4: returns 409 INVALID_STATE when offer.state is 'accepted'", async () => {
    // Buyer is the caller; canAccept runs through the party check
    // and denies on the state guard.
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer({ state: 'accepted' })

    const res = await callRoute()

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_STATE')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it('case 5: returns 503 FEATURE_DISABLED when Stripe is unconfigured', async () => {
    // All earlier gates pass; Stripe gate (after canAccept per F6)
    // is the one that fires.
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(isStripeConfigured).mockReturnValue(false)

    const res = await callRoute()

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('FEATURE_DISABLED')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it('case 6: returns 500 INTERNAL when piece-count query errors', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    HOISTED.state.pieceCount = null
    HOISTED.state.pieceErr = { message: 'db timeout' }

    const res = await callRoute()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).not.toHaveBeenCalled()
  })

  it('case 7: returns 200 with 7-field data on orchestrator ok', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(acceptOffer).mockResolvedValue({
      ok: true,
      paymentIntentId: 'pi_123',
      clientSecret: 'cs_123',
      offerEventId: 'oe_1',
      offerEventHash: 'oeh_1',
      assignmentId: 'a_1',
      assignmentEventId: 'ae_1',
      assignmentEventHash: 'aeh_1',
    })

    const res = await callRoute()

    expect(res.status).toBe(200)
    const body = await res.json()
    // All seven R10 fields echoed verbatim under the B1 `{data:{...}}`
    // envelope.
    expect(body.data).toEqual({
      paymentIntentId: 'pi_123',
      clientSecret: 'cs_123',
      offerEventId: 'oe_1',
      offerEventHash: 'oeh_1',
      assignmentId: 'a_1',
      assignmentEventId: 'ae_1',
      assignmentEventHash: 'aeh_1',
    })
    expect(Object.keys(body.data)).toHaveLength(7)

    // Orchestrator invoked once with the expected arg shape.
    expect(vi.mocked(acceptOffer)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(acceptOffer).mock.calls[0]![0]
    expect(args.offer.id).toBe(OFFER_ID)
    expect(args.actorAuthUserId).toBe(BUYER_ID)
    expect(args.actorHandle).toBe(ACTOR_HANDLE)
    expect(args.expectedPieceCount).toBe(1)
    expect(args.supabase).toBeDefined()
    expect(args.stripe).toBeDefined()
  })

  it('case 8: returns 402 CARD_DECLINED on orchestrator stripe_create', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(acceptOffer).mockResolvedValue({
      ok: false,
      kind: 'stripe_create',
      httpStatus: 402,
      code: 'CARD_DECLINED',
      message: 'Your card was declined.',
    })

    const res = await callRoute()

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error.code).toBe('CARD_DECLINED')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).toHaveBeenCalledTimes(1)
  })

  it('case 9: returns 409 INVALID_STATE on orchestrator db_commit_voided', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(acceptOffer).mockResolvedValue({
      ok: false,
      kind: 'db_commit_voided',
      httpStatus: 409,
      code: 'INVALID_STATE',
      message: 'Offer is not in a transitionable state.',
    })

    const res = await callRoute()

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_STATE')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).toHaveBeenCalledTimes(1)
  })

  it('case 10: returns 500 RECONCILE_NEEDED on orchestrator db_commit_reconcile', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(acceptOffer).mockResolvedValue({
      ok: false,
      kind: 'db_commit_reconcile',
      httpStatus: 500,
      code: 'RECONCILE_NEEDED',
      message: 'Payment-to-state reconciliation required.',
    })

    const res = await callRoute()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('RECONCILE_NEEDED')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).toHaveBeenCalledTimes(1)
  })

  it('case 11: returns 400 UNSUPPORTED_CURRENCY on orchestrator preflight', async () => {
    setAuthedActor()
    HOISTED.state.offerRow = makeOffer()
    vi.mocked(acceptOffer).mockResolvedValue({
      ok: false,
      kind: 'preflight',
      httpStatus: 400,
      code: 'UNSUPPORTED_CURRENCY',
      message: 'Currency not supported at this stage. Contact support.',
    })

    const res = await callRoute()

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('UNSUPPORTED_CURRENCY')
    expect(typeof body.error.message).toBe('string')
    expect(vi.mocked(acceptOffer)).toHaveBeenCalledTimes(1)
  })
})
