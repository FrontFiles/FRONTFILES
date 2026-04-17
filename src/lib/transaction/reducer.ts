/**
 * Frontfiles — Transaction Flow Reducer
 *
 * Deterministic state machine for the commercial cycle:
 *   cart → review → payment → finalization → delivery
 *
 * Every phase transition is explicit. Payment success alone
 * does not unlock delivery — finalization must complete.
 */

import { PLATFORM_FEES } from '@/lib/types'
import type { LicenceType } from '@/lib/types'
import type { LicenceMedium } from '@/lib/documents/types'
import type {
  TransactionFlowState,
  TransactionFlowPhase,
  CartItem,
  Cart,
  CartStatus,
  CheckoutReview,
  PaymentRecord,
  PaymentStatus,
  CatalogueTransaction,
  TransactionLineItem,
  FinalizationStatus,
  WhitePackReadiness,
  CreatorPackReadiness,
  WhitePackReadinessStatus,
  DocumentReadiness,
  SignatureReadiness,
  WhitePackArtifact,
} from './types'

// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════

export type TransactionAction =
  // Cart actions
  | { type: 'ADD_TO_CART'; payload: Omit<CartItem, 'id' | 'lineSubtotalCents' | 'addedAt' | 'licenceName' | 'licenceType'> & { licenceType?: LicenceType } }
  | { type: 'REMOVE_FROM_CART'; payload: { itemId: string } }
  | { type: 'UPDATE_MEDIUM'; payload: { itemId: string; medium: LicenceMedium } }
  | { type: 'CLEAR_CART' }

  // Review actions
  | { type: 'PROCEED_TO_REVIEW' }
  | { type: 'CONFIRM_TERMS' }
  | { type: 'CONFIRM_PRICING' }
  | { type: 'CONFIRM_DECLARATIONS' }
  | { type: 'CONFIRM_BILLING_IDENTITY' }
  | { type: 'READY_FOR_PAYMENT' }
  | { type: 'BACK_TO_CART' }

  // Payment actions
  | { type: 'INITIATE_PAYMENT'; payload: { paymentId: string } }
  | { type: 'PAYMENT_PROCESSING' }
  | { type: 'PAYMENT_SUCCEEDED' }
  | { type: 'PAYMENT_FAILED'; payload: { reason: string } }
  | { type: 'PAYMENT_REQUIRES_ACTION' }
  | { type: 'RETRY_PAYMENT' }

  // Finalization actions
  | { type: 'START_FINALIZATION'; payload: { transaction: CatalogueTransaction } }
  | { type: 'FINALIZATION_DOCUMENTS_GENERATING' }
  | { type: 'FINALIZATION_AWAITING_SIGNATURES' }
  | { type: 'FINALIZATION_PACKAGE_ASSEMBLING' }
  | { type: 'FINALIZATION_WHITE_PACK_READY'; payload: { whitePackReadiness: WhitePackReadiness; creatorPackReadiness: CreatorPackReadiness } }
  | { type: 'FINALIZATION_COMPLETED' }
  | { type: 'FINALIZATION_FAILED'; payload: { reason: string } }

  // Delivery
  | { type: 'VIEW_DELIVERY' }

// ══════════════════════════════════════════════
// INITIAL STATE FACTORY
// ══════════════════════════════════════════════

let cartCounter = 0

export function createInitialState(buyerId: string): TransactionFlowState {
  const cartId = `cart-${buyerId}-${++cartCounter}`
  return {
    phase: 'cart',
    cart: {
      id: cartId,
      buyerId,
      status: 'empty',
      items: [],
      subtotalCents: 0,
      platformFeeCents: 0,
      totalCents: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    review: {
      cartId,
      status: 'draft_review',
      termsConfirmed: false,
      pricingConfirmed: false,
      declarationsReviewed: false,
      billingIdentityConfirmed: false,
    },
    payment: null,
    transaction: null,
    whitePackReadiness: null,
    creatorPackReadiness: null,
  }
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function transactionReducer(
  state: TransactionFlowState,
  action: TransactionAction,
): TransactionFlowState {
  switch (action.type) {

    // ── Cart ──────────────────────────────────

    case 'ADD_TO_CART': {
      const p = action.payload
      const newItem: CartItem = {
        id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        assetId: p.assetId,
        assetTitle: p.assetTitle,
        creatorId: p.creatorId,
        creatorName: p.creatorName,
        thumbnailRef: p.thumbnailRef,
        format: p.format,
        selectedMedium: p.selectedMedium,
        licenceType: p.licenceType ?? 'editorial',
        licenceName: 'Frontfiles Standard Editorial Licence',
        priceSnapshotCents: p.priceSnapshotCents,
        lineSubtotalCents: p.priceSnapshotCents,
        certificationHashAtCart: p.certificationHashAtCart,
        declarationStateAtCart: p.declarationStateAtCart,
        addedAt: new Date().toISOString(),
      }
      const items = [...state.cart.items, newItem]
      return {
        ...state,
        phase: 'cart',
        cart: recalcCart({ ...state.cart, items }),
      }
    }

    case 'REMOVE_FROM_CART': {
      const items = state.cart.items.filter(i => i.id !== action.payload.itemId)
      return {
        ...state,
        cart: recalcCart({ ...state.cart, items }),
      }
    }

    case 'UPDATE_MEDIUM': {
      const items = state.cart.items.map(i =>
        i.id === action.payload.itemId
          ? { ...i, selectedMedium: action.payload.medium }
          : i,
      )
      return { ...state, cart: recalcCart({ ...state.cart, items }) }
    }

    case 'CLEAR_CART':
      return createInitialState(state.cart.buyerId)

    // ── Review ───────────────────────────────

    case 'PROCEED_TO_REVIEW': {
      if (state.cart.items.length === 0) return state
      return {
        ...state,
        phase: 'review',
        cart: { ...state.cart, status: 'ready_for_review' },
        review: {
          ...state.review,
          status: 'draft_review',
          termsConfirmed: false,
          pricingConfirmed: false,
          declarationsReviewed: false,
          billingIdentityConfirmed: false,
        },
      }
    }

    case 'CONFIRM_TERMS':
      return { ...state, review: { ...state.review, termsConfirmed: true } }

    case 'CONFIRM_PRICING':
      return { ...state, review: { ...state.review, pricingConfirmed: true } }

    case 'CONFIRM_DECLARATIONS':
      return { ...state, review: { ...state.review, declarationsReviewed: true } }

    case 'CONFIRM_BILLING_IDENTITY':
      return { ...state, review: { ...state.review, billingIdentityConfirmed: true } }

    case 'READY_FOR_PAYMENT': {
      const r = state.review
      if (!r.termsConfirmed || !r.pricingConfirmed || !r.declarationsReviewed || !r.billingIdentityConfirmed) {
        return state
      }
      return {
        ...state,
        phase: 'payment',
        review: { ...state.review, status: 'ready_for_payment' },
      }
    }

    case 'BACK_TO_CART':
      return {
        ...state,
        phase: 'cart',
        cart: { ...state.cart, status: state.cart.items.length > 0 ? 'active' : 'empty' },
      }

    // ── Payment ──────────────────────────────

    case 'INITIATE_PAYMENT': {
      const payment: PaymentRecord = {
        id: action.payload.paymentId,
        cartId: state.cart.id,
        status: 'awaiting_payment',
        amountCents: state.cart.totalCents,
        currency: 'EUR',
        processorRef: null,
        failureReason: null,
        initiatedAt: new Date().toISOString(),
        completedAt: null,
      }
      return { ...state, payment }
    }

    case 'PAYMENT_PROCESSING':
      if (!state.payment) return state
      return { ...state, payment: { ...state.payment, status: 'payment_processing' } }

    case 'PAYMENT_SUCCEEDED':
      if (!state.payment) return state
      return {
        ...state,
        payment: {
          ...state.payment,
          status: 'payment_succeeded',
          completedAt: new Date().toISOString(),
        },
      }

    case 'PAYMENT_FAILED':
      if (!state.payment) return state
      return {
        ...state,
        payment: {
          ...state.payment,
          status: 'payment_failed',
          failureReason: action.payload.reason,
        },
      }

    case 'PAYMENT_REQUIRES_ACTION':
      if (!state.payment) return state
      return { ...state, payment: { ...state.payment, status: 'requires_action' } }

    case 'RETRY_PAYMENT':
      if (!state.payment) return state
      return {
        ...state,
        payment: {
          ...state.payment,
          status: 'awaiting_payment',
          failureReason: null,
        },
      }

    // ── Finalization ─────────────────────────

    case 'START_FINALIZATION':
      // Guard: finalization requires confirmed payment
      if (!state.payment || state.payment.status !== 'payment_succeeded') return state
      return {
        ...state,
        phase: 'finalization',
        transaction: action.payload.transaction,
      }

    case 'FINALIZATION_DOCUMENTS_GENERATING':
      if (!state.transaction) return state
      return {
        ...state,
        transaction: { ...state.transaction, status: 'documents_generating' },
      }

    case 'FINALIZATION_AWAITING_SIGNATURES':
      if (!state.transaction) return state
      return {
        ...state,
        transaction: { ...state.transaction, status: 'awaiting_signatures' },
      }

    case 'FINALIZATION_PACKAGE_ASSEMBLING':
      if (!state.transaction) return state
      return {
        ...state,
        transaction: { ...state.transaction, status: 'package_assembling' },
      }

    case 'FINALIZATION_WHITE_PACK_READY':
      if (!state.transaction) return state
      return {
        ...state,
        transaction: { ...state.transaction, status: 'white_pack_ready' },
        whitePackReadiness: action.payload.whitePackReadiness,
        creatorPackReadiness: action.payload.creatorPackReadiness,
      }

    case 'FINALIZATION_COMPLETED':
      if (!state.transaction) return state
      return {
        ...state,
        phase: 'delivery',
        cart: recalcCart({ ...state.cart, items: [] }),
        transaction: {
          ...state.transaction,
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      }

    case 'FINALIZATION_FAILED':
      if (!state.transaction) return state
      return {
        ...state,
        transaction: {
          ...state.transaction,
          status: 'finalization_failed',
          failureReason: action.payload.reason,
        },
      }

    // ── Delivery ─────────────────────────────

    case 'VIEW_DELIVERY':
      if (!state.transaction) return state
      return { ...state, phase: 'delivery' }

    default:
      return state
  }
}

// ══════════════════════════════════════════════
// CART RECALCULATION
// ══════════════════════════════════════════════

function recalcCart(cart: Cart): Cart {
  const subtotalCents = cart.items.reduce((sum, i) => sum + i.lineSubtotalCents, 0)
  const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEES.direct.buyerMarkup)
  const totalCents = subtotalCents + platformFeeCents
  const status: CartStatus = cart.items.length === 0 ? 'empty' : 'active'
  return {
    ...cart,
    subtotalCents,
    platformFeeCents,
    totalCents,
    status,
    updatedAt: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════
// SELECTORS
// ══════════════════════════════════════════════

export function isReviewComplete(state: TransactionFlowState): boolean {
  const r = state.review
  return r.termsConfirmed && r.pricingConfirmed && r.declarationsReviewed && r.billingIdentityConfirmed
}

export function canProceedToPayment(state: TransactionFlowState): boolean {
  return state.phase === 'review' && isReviewComplete(state)
}

export function isPaymentTerminal(status: PaymentStatus): boolean {
  return status === 'payment_succeeded' || status === 'payment_failed'
}

export function isFinalizationTerminal(status: FinalizationStatus): boolean {
  return status === 'completed' || status === 'finalization_failed'
}

export function centsToEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}
