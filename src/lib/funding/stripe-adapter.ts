/**
 * Funding Engine — Mock Stripe Adapter
 *
 * Simulates Stripe payment flow without requiring @stripe/stripe-js.
 * In production, this would wrap the real Stripe SDK.
 *
 * System boundary: Stripe is authoritative for payment state.
 * This adapter mirrors intent creation and confirmation.
 */

export interface CreatePaymentIntentParams {
  amountCents: number
  currency: string
  fundingCaseId: string
  metadata?: Record<string, string>
}

export interface PaymentIntentResult {
  clientSecret: string
  paymentIntentId: string
}

export interface ConfirmPaymentParams {
  clientSecret: string
}

export interface ConfirmPaymentResult {
  success: boolean
  paymentIntentId: string
  error?: string
}

let intentCounter = 0

/**
 * Simulate creating a Stripe PaymentIntent.
 * In production: POST /api/funding/create-payment-intent
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  await simulateLatency(400, 800)

  intentCounter++
  const id = `pi_mock_${Date.now()}_${intentCounter}`
  const secret = `${id}_secret_${Math.random().toString(36).slice(2, 10)}`

  return {
    clientSecret: secret,
    paymentIntentId: id,
  }
}

/**
 * Simulate confirming a Stripe PaymentIntent.
 * In production: stripe.confirmCardPayment(clientSecret)
 *
 * Randomly fails ~10% of the time to test error handling.
 */
export async function confirmPayment(
  params: ConfirmPaymentParams,
): Promise<ConfirmPaymentResult> {
  await simulateLatency(1200, 2500)

  // Simulate occasional failures
  if (Math.random() < 0.1) {
    return {
      success: false,
      paymentIntentId: params.clientSecret.split('_secret_')[0],
      error: 'Your card was declined. Please try a different payment method.',
    }
  }

  return {
    success: true,
    paymentIntentId: params.clientSecret.split('_secret_')[0],
  }
}

function simulateLatency(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}
