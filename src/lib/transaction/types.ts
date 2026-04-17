/**
 * Frontfiles — Transaction Flow Types
 *
 * Canonical types for the full commercial cycle:
 *   cart → review → payment → finalization → white-pack delivery
 *
 * BOUNDARIES:
 *   - Cart owns buyer intent, not entitlement
 *   - Review owns confirmation, not fulfilment
 *   - Payment owns payment state, not document truth
 *   - Transaction finalization owns creation of canonical records
 *   - Licence grants own delivery entitlement
 *   - Certified package owns delivery container truth
 *   - White pack owns buyer-facing fulfilment outputs
 *   - Audit/evidence layer owns full signer/identity proof
 */

import type { LicenceType } from '@/lib/types'
import type { LicenceMedium, TransactionDocumentTypeId, DocumentStatus } from '@/lib/documents/types'
import type { SignatureStatus } from '@/lib/documents/signature'
import type { PackageStatus, ArtifactType, ArtifactStatus } from '@/lib/fulfilment/types'

// ══════════════════════════════════════════════
// CART
// ══════════════════════════════════════════════

export type CartStatus = 'empty' | 'active' | 'ready_for_review'

export interface CartItem {
  id: string
  assetId: string
  assetTitle: string
  creatorId: string
  creatorName: string
  thumbnailRef: string | null
  format: string
  /** Selected publication medium for the Frontfiles Standard Editorial Licence */
  selectedMedium: LicenceMedium
  /** Always 'editorial' for Standard Editorial Licence */
  licenceType: LicenceType
  /** Licence reference name */
  licenceName: string
  /** Price snapshot at time of cart addition — EUR cents */
  priceSnapshotCents: number
  /** Line subtotal (= priceSnapshotCents for non-exclusive) — EUR cents */
  lineSubtotalCents: number
  /** Certification hash at cart time — provenance snapshot */
  certificationHashAtCart: string | null
  /** Validation declaration state at cart time */
  declarationStateAtCart: string | null
  addedAt: string
}

export interface Cart {
  id: string
  buyerId: string
  status: CartStatus
  items: CartItem[]
  subtotalCents: number
  platformFeeCents: number
  totalCents: number
  createdAt: string
  updatedAt: string
}

// ══════════════════════════════════════════════
// CHECKOUT REVIEW
// ══════════════════════════════════════════════

export type CheckoutReviewStatus = 'draft_review' | 'ready_for_payment'

export interface CheckoutReview {
  cartId: string
  status: CheckoutReviewStatus
  /** Buyer has confirmed assets and licence terms */
  termsConfirmed: boolean
  /** Buyer has confirmed pricing */
  pricingConfirmed: boolean
  /** Buyer has reviewed declaration states */
  declarationsReviewed: boolean
  /** Buyer identity confirmed for billing */
  billingIdentityConfirmed: boolean
}

// ══════════════════════════════════════════════
// PAYMENT
// ══════════════════════════════════════════════

export type PaymentStatus =
  | 'awaiting_payment'
  | 'payment_processing'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'requires_action'

export interface PaymentRecord {
  id: string
  cartId: string
  status: PaymentStatus
  amountCents: number
  currency: string
  /** Stripe or processor reference — null in mock */
  processorRef: string | null
  /** Error detail if payment_failed */
  failureReason: string | null
  initiatedAt: string
  completedAt: string | null
}

// ══════════════════════════════════════════════
// TRANSACTION FINALIZATION
// ══════════════════════════════════════════════

export type FinalizationStatus =
  | 'finalizing'
  | 'documents_generating'
  | 'awaiting_signatures'
  | 'package_assembling'
  | 'white_pack_ready'
  | 'completed'
  | 'finalization_failed'

export interface TransactionLineItem {
  id: string
  transactionId: string
  assetId: string
  assetTitle: string
  creatorId: string
  creatorName: string
  licenceType: LicenceType
  selectedMedium: LicenceMedium
  /** Price the buyer pays for this line — EUR cents */
  buyerPaysCents: number
  /** Amount the creator receives — EUR cents */
  creatorReceivesCents: number
  /** Platform fee for this line — EUR cents */
  platformEarnsCents: number
  /** Licence grant ID created during finalization */
  licenceGrantId: string | null
  /** Certification hash at time of grant */
  certificationHashAtGrant: string | null
}

export interface CatalogueTransaction {
  id: string
  buyerId: string
  buyerName: string
  paymentId: string
  cartId: string
  status: FinalizationStatus
  lineItems: TransactionLineItem[]
  /** Total buyer pays — EUR cents */
  totalBuyerPaysCents: number
  /** Total creator receives — EUR cents */
  totalCreatorReceivesCents: number
  /** Total platform earns — EUR cents */
  totalPlatformEarnsCents: number
  /** Buyer pack package ID */
  buyerPackageId: string | null
  /** Creator pack package ID */
  creatorPackageId: string | null
  createdAt: string
  completedAt: string | null
  failureReason: string | null
}

// ══════════════════════════════════════════════
// DOCUMENT READINESS
// ══════════════════════════════════════════════

export type DocumentReadinessStatus = 'not_started' | 'pending' | 'partial' | 'ready' | 'blocked'

export interface DocumentReadiness {
  transactionId: string
  overallStatus: DocumentReadinessStatus
  documents: DocumentReadinessItem[]
}

export interface DocumentReadinessItem {
  documentTypeId: TransactionDocumentTypeId
  label: string
  shortLabel: string
  status: DocumentStatus
  /** Whether this document requires signatures */
  signable: boolean
  /** Signature readiness for this doc — null if not signable */
  signatureStatus: SignatureReadinessStatus | null
}

// ══════════════════════════════════════════════
// SIGNATURE READINESS
// ══════════════════════════════════════════════

export type SignatureReadinessStatus = 'not_started' | 'pending' | 'partial' | 'ready' | 'blocked'

export interface SignatureReadiness {
  transactionId: string
  overallStatus: SignatureReadinessStatus
  /** Count of signatures required across all documents */
  totalRequired: number
  /** Count of signatures completed */
  totalSigned: number
  /** Count of signatures pending */
  totalPending: number
}

// ══════════════════════════════════════════════
// WHITE PACK READINESS
// ══════════════════════════════════════════════

export type WhitePackReadinessStatus =
  | 'not_started'
  | 'documents_pending'
  | 'signatures_pending'
  | 'package_building'
  | 'partially_ready'
  | 'ready'
  | 'blocked'

export interface WhitePackArtifact {
  id: string
  artifactType: ArtifactType
  label: string
  status: ArtifactStatus
  /** Whether this artifact is downloadable right now */
  downloadable: boolean
}

export interface WhitePackReadiness {
  transactionId: string
  packageId: string | null
  packageStatus: PackageStatus | null
  overallStatus: WhitePackReadinessStatus
  artifacts: WhitePackArtifact[]
  documentReadiness: DocumentReadiness
  signatureReadiness: SignatureReadiness
  /** The original asset file availability */
  originalAssetReady: boolean
  /** Provenance record availability */
  provenanceRecordReady: boolean
}

// ══════════════════════════════════════════════
// CREATOR PACK READINESS (mirror for creator)
// ══════════════════════════════════════════════

export interface CreatorPackReadiness {
  transactionId: string
  packageId: string | null
  packageStatus: PackageStatus | null
  overallStatus: WhitePackReadinessStatus
  artifacts: WhitePackArtifact[]
}

// ══════════════════════════════════════════════
// FULL TRANSACTION FLOW STATE
// ══════════════════════════════════════════════

export type TransactionFlowPhase =
  | 'cart'
  | 'review'
  | 'payment'
  | 'finalization'
  | 'delivery'

export interface TransactionFlowState {
  phase: TransactionFlowPhase
  cart: Cart
  review: CheckoutReview
  payment: PaymentRecord | null
  transaction: CatalogueTransaction | null
  whitePackReadiness: WhitePackReadiness | null
  creatorPackReadiness: CreatorPackReadiness | null
}
