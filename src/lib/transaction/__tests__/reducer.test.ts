import { describe, it, expect } from 'vitest'
import {
  transactionReducer,
  createInitialState,
  isReviewComplete,
  canProceedToPayment,
  isPaymentTerminal,
  isFinalizationTerminal,
  centsToEur,
} from '../reducer'
import type { TransactionAction } from '../reducer'
import type {
  TransactionFlowState,
  CatalogueTransaction,
  WhitePackReadiness,
  CreatorPackReadiness,
} from '../types'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

const BUYER_ID = 'buyer-test-001'

function makeState(): TransactionFlowState {
  return createInitialState(BUYER_ID)
}

function addItem(state: TransactionFlowState): TransactionFlowState {
  return transactionReducer(state, {
    type: 'ADD_TO_CART',
    payload: {
      assetId: 'asset-001',
      assetTitle: 'Test Asset',
      creatorId: 'creator-001',
      creatorName: 'Test Creator',
      thumbnailRef: null,
      format: 'photo',
      selectedMedium: 'newspaper',
      priceSnapshotCents: 28000,
      certificationHashAtCart: null,
      declarationStateAtCart: 'fully_validated',
    },
  })
}

function proceedToReview(state: TransactionFlowState): TransactionFlowState {
  return transactionReducer(state, { type: 'PROCEED_TO_REVIEW' })
}

function confirmAll(state: TransactionFlowState): TransactionFlowState {
  let s = state
  s = transactionReducer(s, { type: 'CONFIRM_TERMS' })
  s = transactionReducer(s, { type: 'CONFIRM_PRICING' })
  s = transactionReducer(s, { type: 'CONFIRM_DECLARATIONS' })
  s = transactionReducer(s, { type: 'CONFIRM_BILLING_IDENTITY' })
  return s
}

function readyForPayment(state: TransactionFlowState): TransactionFlowState {
  return transactionReducer(state, { type: 'READY_FOR_PAYMENT' })
}

function initiatePayment(state: TransactionFlowState): TransactionFlowState {
  return transactionReducer(state, { type: 'INITIATE_PAYMENT', payload: { paymentId: 'pay-test-001' } })
}

function paymentSucceeded(state: TransactionFlowState): TransactionFlowState {
  return transactionReducer(state, { type: 'PAYMENT_SUCCEEDED' })
}

function makeMockTransaction(txId: string): CatalogueTransaction {
  return {
    id: txId,
    buyerId: BUYER_ID,
    buyerName: 'Test Buyer',
    paymentId: 'pay-test-001',
    cartId: 'cart-test',
    status: 'finalizing',
    lineItems: [],
    totalBuyerPaysCents: 33600,
    totalCreatorReceivesCents: 22400,
    totalPlatformEarnsCents: 11200,
    buyerPackageId: null,
    creatorPackageId: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    failureReason: null,
  }
}

function makeMockReadiness(txId: string): { whitePackReadiness: WhitePackReadiness; creatorPackReadiness: CreatorPackReadiness } {
  return {
    whitePackReadiness: {
      transactionId: txId,
      packageId: `pkg-buyer-${txId}`,
      packageStatus: 'ready',
      overallStatus: 'ready',
      artifacts: [],
      documentReadiness: { transactionId: txId, overallStatus: 'ready', documents: [] },
      signatureReadiness: { transactionId: txId, overallStatus: 'ready', totalRequired: 6, totalSigned: 6, totalPending: 0 },
      originalAssetReady: true,
      provenanceRecordReady: true,
    },
    creatorPackReadiness: {
      transactionId: txId,
      packageId: `pkg-creator-${txId}`,
      packageStatus: 'ready',
      overallStatus: 'ready',
      artifacts: [],
    },
  }
}

/** Advance state from initial to payment-succeeded */
function toPaymentSucceeded(): TransactionFlowState {
  let s = makeState()
  s = addItem(s)
  s = proceedToReview(s)
  s = confirmAll(s)
  s = readyForPayment(s)
  s = initiatePayment(s)
  s = transactionReducer(s, { type: 'PAYMENT_PROCESSING' })
  s = paymentSucceeded(s)
  return s
}

// ══════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════

describe('createInitialState', () => {
  it('creates empty cart for buyer', () => {
    const s = makeState()
    expect(s.phase).toBe('cart')
    expect(s.cart.buyerId).toBe(BUYER_ID)
    expect(s.cart.items).toHaveLength(0)
    expect(s.cart.status).toBe('empty')
    expect(s.payment).toBeNull()
    expect(s.transaction).toBeNull()
  })
})

describe('cart actions', () => {
  it('ADD_TO_CART adds item and recalculates totals', () => {
    const s = addItem(makeState())
    expect(s.cart.items).toHaveLength(1)
    expect(s.cart.items[0].assetId).toBe('asset-001')
    expect(s.cart.items[0].licenceName).toBe('Frontfiles Standard Editorial Licence')
    expect(s.cart.items[0].licenceType).toBe('editorial')
    expect(s.cart.items[0].lineSubtotalCents).toBe(28000)
    expect(s.cart.subtotalCents).toBe(28000)
    expect(s.cart.platformFeeCents).toBe(5600) // 20%
    expect(s.cart.totalCents).toBe(33600)
    expect(s.cart.status).toBe('active')
  })

  it('REMOVE_FROM_CART removes item and recalculates', () => {
    let s = addItem(makeState())
    const itemId = s.cart.items[0].id
    s = transactionReducer(s, { type: 'REMOVE_FROM_CART', payload: { itemId } })
    expect(s.cart.items).toHaveLength(0)
    expect(s.cart.totalCents).toBe(0)
    expect(s.cart.status).toBe('empty')
  })

  it('UPDATE_MEDIUM changes medium for specific item', () => {
    let s = addItem(makeState())
    const itemId = s.cart.items[0].id
    s = transactionReducer(s, { type: 'UPDATE_MEDIUM', payload: { itemId, medium: 'magazine' } })
    expect(s.cart.items[0].selectedMedium).toBe('magazine')
  })

  it('CLEAR_CART resets to initial state', () => {
    let s = addItem(makeState())
    s = transactionReducer(s, { type: 'CLEAR_CART' })
    expect(s.cart.items).toHaveLength(0)
    expect(s.phase).toBe('cart')
  })
})

describe('review actions', () => {
  it('PROCEED_TO_REVIEW is rejected on empty cart', () => {
    const s = makeState()
    const after = proceedToReview(s)
    expect(after.phase).toBe('cart') // unchanged
  })

  it('PROCEED_TO_REVIEW transitions to review phase', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    expect(s.phase).toBe('review')
    expect(s.cart.status).toBe('ready_for_review')
    expect(s.review.status).toBe('draft_review')
  })

  it('PROCEED_TO_REVIEW resets all confirmations', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    // Go back and re-enter review
    s = transactionReducer(s, { type: 'BACK_TO_CART' })
    s = proceedToReview(s)
    expect(s.review.termsConfirmed).toBe(false)
    expect(s.review.pricingConfirmed).toBe(false)
    expect(s.review.declarationsReviewed).toBe(false)
    expect(s.review.billingIdentityConfirmed).toBe(false)
  })

  it('READY_FOR_PAYMENT is rejected without all confirmations', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    // Only confirm terms
    s = transactionReducer(s, { type: 'CONFIRM_TERMS' })
    s = readyForPayment(s)
    expect(s.phase).toBe('review') // unchanged — not all confirmed
  })

  it('READY_FOR_PAYMENT transitions to payment after all confirmations', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    expect(s.phase).toBe('payment')
    expect(s.review.status).toBe('ready_for_payment')
  })
})

describe('payment actions', () => {
  it('INITIATE_PAYMENT creates payment with provided ID', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = transactionReducer(s, { type: 'INITIATE_PAYMENT', payload: { paymentId: 'pay-xyz' } })
    expect(s.payment).not.toBeNull()
    expect(s.payment!.id).toBe('pay-xyz')
    expect(s.payment!.status).toBe('awaiting_payment')
    expect(s.payment!.amountCents).toBe(s.cart.totalCents)
  })

  it('PAYMENT_PROCESSING is rejected without payment', () => {
    const s = makeState()
    const after = transactionReducer(s, { type: 'PAYMENT_PROCESSING' })
    expect(after).toBe(s) // same reference — no change
  })

  it('payment status transitions work correctly', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)

    s = transactionReducer(s, { type: 'PAYMENT_PROCESSING' })
    expect(s.payment!.status).toBe('payment_processing')

    s = paymentSucceeded(s)
    expect(s.payment!.status).toBe('payment_succeeded')
    expect(s.payment!.completedAt).not.toBeNull()
  })

  it('PAYMENT_FAILED records failure reason', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)
    s = transactionReducer(s, { type: 'PAYMENT_PROCESSING' })
    s = transactionReducer(s, { type: 'PAYMENT_FAILED', payload: { reason: 'Card declined' } })
    expect(s.payment!.status).toBe('payment_failed')
    expect(s.payment!.failureReason).toBe('Card declined')
  })

  it('RETRY_PAYMENT resets to awaiting_payment', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)
    s = transactionReducer(s, { type: 'PAYMENT_PROCESSING' })
    s = transactionReducer(s, { type: 'PAYMENT_FAILED', payload: { reason: 'declined' } })
    s = transactionReducer(s, { type: 'RETRY_PAYMENT' })
    expect(s.payment!.status).toBe('awaiting_payment')
    expect(s.payment!.failureReason).toBeNull()
  })

  it('PAYMENT_REQUIRES_ACTION sets requires_action status', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)
    s = transactionReducer(s, { type: 'PAYMENT_REQUIRES_ACTION' })
    expect(s.payment!.status).toBe('requires_action')
  })
})

describe('finalization guards', () => {
  it('START_FINALIZATION is rejected without payment', () => {
    const s = makeState()
    const tx = makeMockTransaction('tx-1')
    const after = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    expect(after.transaction).toBeNull() // unchanged
  })

  it('START_FINALIZATION is rejected when payment is not succeeded', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)
    // Payment is awaiting_payment, not succeeded
    const tx = makeMockTransaction('tx-1')
    const after = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    expect(after.transaction).toBeNull()
    expect(after.phase).toBe('payment') // unchanged
  })

  it('START_FINALIZATION is rejected when payment failed', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = initiatePayment(s)
    s = transactionReducer(s, { type: 'PAYMENT_FAILED', payload: { reason: 'declined' } })
    const tx = makeMockTransaction('tx-1')
    const after = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    expect(after.transaction).toBeNull()
  })

  it('START_FINALIZATION succeeds after payment_succeeded', () => {
    let s = toPaymentSucceeded()
    const tx = makeMockTransaction('tx-1')
    s = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    expect(s.phase).toBe('finalization')
    expect(s.transaction).not.toBeNull()
    expect(s.transaction!.id).toBe('tx-1')
    expect(s.transaction!.status).toBe('finalizing')
  })
})

describe('finalization transitions', () => {
  it('finalization status progresses through pipeline', () => {
    let s = toPaymentSucceeded()
    const tx = makeMockTransaction('tx-1')
    s = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    expect(s.transaction!.status).toBe('finalizing')

    s = transactionReducer(s, { type: 'FINALIZATION_DOCUMENTS_GENERATING' })
    expect(s.transaction!.status).toBe('documents_generating')

    s = transactionReducer(s, { type: 'FINALIZATION_AWAITING_SIGNATURES' })
    expect(s.transaction!.status).toBe('awaiting_signatures')

    s = transactionReducer(s, { type: 'FINALIZATION_PACKAGE_ASSEMBLING' })
    expect(s.transaction!.status).toBe('package_assembling')

    const readiness = makeMockReadiness('tx-1')
    s = transactionReducer(s, { type: 'FINALIZATION_WHITE_PACK_READY', payload: readiness })
    expect(s.transaction!.status).toBe('white_pack_ready')
    expect(s.whitePackReadiness).not.toBeNull()
    expect(s.creatorPackReadiness).not.toBeNull()

    s = transactionReducer(s, { type: 'FINALIZATION_COMPLETED' })
    expect(s.transaction!.status).toBe('completed')
    expect(s.transaction!.completedAt).not.toBeNull()
    expect(s.phase).toBe('delivery')
  })

  it('FINALIZATION_COMPLETED clears the cart', () => {
    let s = toPaymentSucceeded()
    const tx = makeMockTransaction('tx-1')
    s = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    // Cart still has items before completion
    expect(s.cart.items.length).toBeGreaterThan(0)

    s = transactionReducer(s, { type: 'FINALIZATION_COMPLETED' })
    expect(s.cart.items).toHaveLength(0)
    expect(s.cart.status).toBe('empty')
    expect(s.cart.totalCents).toBe(0)
  })

  it('FINALIZATION_FAILED records failure reason', () => {
    let s = toPaymentSucceeded()
    const tx = makeMockTransaction('tx-1')
    s = transactionReducer(s, { type: 'START_FINALIZATION', payload: { transaction: tx } })
    s = transactionReducer(s, { type: 'FINALIZATION_FAILED', payload: { reason: 'Document generation timeout' } })
    expect(s.transaction!.status).toBe('finalization_failed')
    expect(s.transaction!.failureReason).toBe('Document generation timeout')
  })

  it('finalization actions are no-ops without transaction', () => {
    const s = makeState()
    expect(transactionReducer(s, { type: 'FINALIZATION_DOCUMENTS_GENERATING' })).toBe(s)
    expect(transactionReducer(s, { type: 'FINALIZATION_AWAITING_SIGNATURES' })).toBe(s)
    expect(transactionReducer(s, { type: 'FINALIZATION_PACKAGE_ASSEMBLING' })).toBe(s)
    expect(transactionReducer(s, { type: 'FINALIZATION_COMPLETED' })).toBe(s)
    expect(transactionReducer(s, { type: 'FINALIZATION_FAILED', payload: { reason: 'x' } })).toBe(s)
  })
})

describe('selectors', () => {
  it('isReviewComplete requires all 4 confirmations', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    expect(isReviewComplete(s)).toBe(false)

    s = transactionReducer(s, { type: 'CONFIRM_TERMS' })
    s = transactionReducer(s, { type: 'CONFIRM_PRICING' })
    s = transactionReducer(s, { type: 'CONFIRM_DECLARATIONS' })
    expect(isReviewComplete(s)).toBe(false) // 3 of 4

    s = transactionReducer(s, { type: 'CONFIRM_BILLING_IDENTITY' })
    expect(isReviewComplete(s)).toBe(true)
  })

  it('canProceedToPayment requires review phase + all confirmations', () => {
    let s = addItem(makeState())
    s = confirmAll(s) // confirmed but not in review phase
    expect(canProceedToPayment(s)).toBe(false)

    s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    expect(canProceedToPayment(s)).toBe(true)
  })

  it('isPaymentTerminal identifies terminal states', () => {
    expect(isPaymentTerminal('payment_succeeded')).toBe(true)
    expect(isPaymentTerminal('payment_failed')).toBe(true)
    expect(isPaymentTerminal('awaiting_payment')).toBe(false)
    expect(isPaymentTerminal('payment_processing')).toBe(false)
    expect(isPaymentTerminal('requires_action')).toBe(false)
  })

  it('isFinalizationTerminal identifies terminal states', () => {
    expect(isFinalizationTerminal('completed')).toBe(true)
    expect(isFinalizationTerminal('finalization_failed')).toBe(true)
    expect(isFinalizationTerminal('finalizing')).toBe(false)
    expect(isFinalizationTerminal('white_pack_ready')).toBe(false)
  })

  it('centsToEur formats correctly', () => {
    expect(centsToEur(28000)).toBe('€280.00')
    expect(centsToEur(5600)).toBe('€56.00')
    expect(centsToEur(0)).toBe('€0.00')
    expect(centsToEur(1)).toBe('€0.01')
  })
})

describe('canonical naming consistency', () => {
  it('ADD_TO_CART always sets canonical licence name', () => {
    const s = addItem(makeState())
    expect(s.cart.items[0].licenceName).toBe('Frontfiles Standard Editorial Licence')
  })

  it('ADD_TO_CART defaults to editorial licence type', () => {
    const s = addItem(makeState())
    expect(s.cart.items[0].licenceType).toBe('editorial')
  })
})

describe('payment ID consistency', () => {
  it('INITIATE_PAYMENT uses the provided paymentId', () => {
    let s = addItem(makeState())
    s = proceedToReview(s)
    s = confirmAll(s)
    s = readyForPayment(s)
    s = transactionReducer(s, { type: 'INITIATE_PAYMENT', payload: { paymentId: 'pay-deterministic-123' } })
    expect(s.payment!.id).toBe('pay-deterministic-123')
  })
})
