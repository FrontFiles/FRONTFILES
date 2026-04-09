/**
 * POST /api/assignment/webhook/stripe — Stripe Connect webhook handler
 *
 * Handles two idempotent sync points:
 *  1. payment_intent.captured → syncEscrowCaptureFromStripe
 *  2. transfer.paid → syncStripeReleaseState
 *
 * In production, verify Stripe signature via stripe.webhooks.constructEvent().
 * In mock phase, accepts JSON directly.
 *
 * Body (escrow capture):
 * {
 *   type: 'payment_intent.captured',
 *   assignmentId: string,
 *   stripePaymentIntentId: string,
 *   capturedAmountCents: number,
 *   capturedAt: string
 * }
 *
 * Body (settlement):
 * {
 *   type: 'transfer.paid',
 *   assignmentId: string,
 *   stripeTransferId: string,
 *   settledAmountCents: number
 * }
 */

import {
  syncEscrowCaptureFromStripe,
  syncStripeReleaseState,
} from '@/lib/assignment/services'
import { putAssignment } from '@/lib/assignment/store'
import { resolveAssignment, success, errorResponse, withDomainError } from '@/lib/assignment/api-helpers'

export async function POST(request: Request) {
  return withDomainError(async () => {
    const body = await request.json()

    // TODO: In production, verify Stripe webhook signature here.
    // const sig = request.headers.get('stripe-signature')
    // const event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)

    if (!body.type || !body.assignmentId) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: type, assignmentId')
    }

    const [assignment, err] = resolveAssignment(body.assignmentId)
    if (err) return err

    switch (body.type) {
      case 'payment_intent.captured': {
        if (!body.stripePaymentIntentId || !body.capturedAmountCents || !body.capturedAt) {
          return errorResponse('VALIDATION_ERROR', 'Missing fields for payment_intent.captured: stripePaymentIntentId, capturedAmountCents, capturedAt')
        }
        const updated = syncEscrowCaptureFromStripe(
          assignment,
          body.stripePaymentIntentId,
          body.capturedAmountCents,
          body.capturedAt,
        )
        putAssignment(updated)
        return success(updated)
      }

      case 'transfer.paid': {
        if (!body.stripeTransferId || !body.settledAmountCents) {
          return errorResponse('VALIDATION_ERROR', 'Missing fields for transfer.paid: stripeTransferId, settledAmountCents')
        }
        const updated = syncStripeReleaseState(
          assignment,
          body.stripeTransferId,
          body.settledAmountCents,
        )
        putAssignment(updated)
        return success(updated)
      }

      default:
        return success({ received: true, ignored: body.type })
    }
  })
}
