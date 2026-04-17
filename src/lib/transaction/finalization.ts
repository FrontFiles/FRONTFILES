/**
 * Frontfiles — Mock Transaction Finalization Engine
 *
 * Simulates the post-payment finalization pipeline:
 *   1. Create canonical transaction + line items
 *   2. Create licence grants
 *   3. Generate canonical documents (6 per transaction)
 *   4. Create signer requirements
 *   5. Assemble certified packages (buyer + creator)
 *   6. Compute white-pack and creator-pack readiness
 *
 * In production this would be a server-side pipeline.
 * Here it runs client-side with simulated delays.
 */

import { PLATFORM_FEES } from '@/lib/types'
import { DOCUMENT_REGISTRY } from '@/lib/documents/types'
import type { TransactionDocumentTypeId, DocumentStatus } from '@/lib/documents/types'
import type { SignatureStatus } from '@/lib/documents/signature'
import type { ArtifactType, ArtifactStatus } from '@/lib/fulfilment/types'
import type {
  Cart,
  CatalogueTransaction,
  TransactionLineItem,
  WhitePackReadiness,
  CreatorPackReadiness,
  WhitePackArtifact,
  DocumentReadiness,
  DocumentReadinessItem,
  SignatureReadiness,
  WhitePackReadinessStatus,
  DocumentReadinessStatus,
  SignatureReadinessStatus,
} from './types'
import type { TransactionAction } from './reducer'

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Run the full finalization pipeline after payment succeeds.
 * Dispatches state transitions as each phase completes.
 *
 * PRECONDITION: Caller must have dispatched PAYMENT_SUCCEEDED before calling.
 * The reducer independently guards START_FINALIZATION against non-succeeded payment.
 */
export async function runFinalization(
  cart: Cart,
  paymentId: string,
  dispatch: (action: TransactionAction) => void,
  buyerName: string = 'Current Buyer',
): Promise<void> {
  const txId = `tx-${Date.now()}`
  const now = new Date().toISOString()

  // Phase 1: Create transaction + line items
  const lineItems = buildLineItems(txId, cart)
  const transaction = buildTransaction(txId, cart, paymentId, lineItems, now, buyerName)

  dispatch({ type: 'START_FINALIZATION', payload: { transaction } })
  await delay(400)

  // Phase 2: Generate documents
  dispatch({ type: 'FINALIZATION_DOCUMENTS_GENERATING' })
  await delay(600)

  // Phase 3: Awaiting signatures
  dispatch({ type: 'FINALIZATION_AWAITING_SIGNATURES' })
  await delay(500)

  // Phase 4: Assemble packages
  dispatch({ type: 'FINALIZATION_PACKAGE_ASSEMBLING' })
  await delay(400)

  // Phase 5: Compute readiness
  const buyerPackageId = `pkg-buyer-${txId}`
  const creatorPackageId = `pkg-creator-${txId}`

  const documentReadiness = buildDocumentReadiness(txId)
  const signatureReadiness = buildSignatureReadiness(txId)
  const whitePackReadiness = buildWhitePackReadiness(txId, buyerPackageId, documentReadiness, signatureReadiness, lineItems)
  const creatorPackReadiness = buildCreatorPackReadiness(txId, creatorPackageId)

  dispatch({
    type: 'FINALIZATION_WHITE_PACK_READY',
    payload: { whitePackReadiness, creatorPackReadiness },
  })
  await delay(300)

  // Phase 6: Completed
  dispatch({ type: 'FINALIZATION_COMPLETED' })
}

// ══════════════════════════════════════════════
// LINE ITEMS
// ══════════════════════════════════════════════

function buildLineItems(txId: string, cart: Cart): TransactionLineItem[] {
  return cart.items.map((item, idx) => {
    const buyerPays = item.lineSubtotalCents + Math.round(item.lineSubtotalCents * PLATFORM_FEES.direct.buyerMarkup)
    const creatorReceives = item.lineSubtotalCents - Math.round(item.lineSubtotalCents * PLATFORM_FEES.direct.creatorFee)
    const platformEarns = buyerPays - creatorReceives

    return {
      id: `li-${txId}-${idx}`,
      transactionId: txId,
      assetId: item.assetId,
      assetTitle: item.assetTitle,
      creatorId: item.creatorId,
      creatorName: item.creatorName,
      licenceType: item.licenceType,
      selectedMedium: item.selectedMedium,
      buyerPaysCents: buyerPays,
      creatorReceivesCents: creatorReceives,
      platformEarnsCents: platformEarns,
      licenceGrantId: `grant-${txId}-${idx}`,
      certificationHashAtGrant: item.certificationHashAtCart,
    }
  })
}

// ══════════════════════════════════════════════
// TRANSACTION
// ══════════════════════════════════════════════

function buildTransaction(
  txId: string,
  cart: Cart,
  paymentId: string,
  lineItems: TransactionLineItem[],
  now: string,
  buyerName: string,
): CatalogueTransaction {
  return {
    id: txId,
    buyerId: cart.buyerId,
    buyerName,
    paymentId,
    cartId: cart.id,
    status: 'finalizing',
    lineItems,
    totalBuyerPaysCents: lineItems.reduce((s, li) => s + li.buyerPaysCents, 0),
    totalCreatorReceivesCents: lineItems.reduce((s, li) => s + li.creatorReceivesCents, 0),
    totalPlatformEarnsCents: lineItems.reduce((s, li) => s + li.platformEarnsCents, 0),
    buyerPackageId: null,
    creatorPackageId: null,
    createdAt: now,
    completedAt: null,
    failureReason: null,
  }
}

// ══════════════════════════════════════════════
// DOCUMENT READINESS
// ══════════════════════════════════════════════

function buildDocumentReadiness(txId: string): DocumentReadiness {
  const documents: DocumentReadinessItem[] = DOCUMENT_REGISTRY.map(entry => {
    const signable = entry.category === 'licence' || entry.category === 'contract'

    // Simulate: contracts/licence finalized, finance docs finalized
    const status: DocumentStatus = 'finalized'

    // Simulate: all signable docs have signatures completed
    const signatureStatus: SignatureReadinessStatus | null = signable ? 'ready' : null

    return {
      documentTypeId: entry.id,
      label: entry.label,
      shortLabel: entry.shortLabel,
      status,
      signable,
      signatureStatus,
    }
  })

  const allFinalized = documents.every(d => d.status === 'finalized')
  const overallStatus: DocumentReadinessStatus = allFinalized ? 'ready' : 'pending'

  return { transactionId: txId, overallStatus, documents }
}

// ══════════════════════════════════════════════
// SIGNATURE READINESS
// ══════════════════════════════════════════════

function buildSignatureReadiness(txId: string): SignatureReadiness {
  // 3 signable docs (licence + 2 contracts), each needs 2 signatures (parties)
  const totalRequired = 6
  const totalSigned = 6
  const totalPending = 0

  return {
    transactionId: txId,
    overallStatus: 'ready',
    totalRequired,
    totalSigned,
    totalPending,
  }
}

// ══════════════════════════════════════════════
// WHITE PACK READINESS
// ══════════════════════════════════════════════

/** Map registry document category to artifact type */
const CATEGORY_TO_ARTIFACT: Record<string, ArtifactType> = {
  licence: 'licence_agreement',
  contract: 'contract_with_frontfiles',
  invoice: 'invoice',
  receipt: 'payment_receipt',
}

function buildWhitePackReadiness(
  txId: string,
  packageId: string,
  documentReadiness: DocumentReadiness,
  signatureReadiness: SignatureReadiness,
  lineItems: TransactionLineItem[],
): WhitePackReadiness {
  // Registry-driven: include documents flagged for buyer pack
  const docArtifacts: WhitePackArtifact[] = DOCUMENT_REGISTRY
    .filter(entry => entry.inBuyerPack)
    .map(entry => {
      const artifactType = CATEGORY_TO_ARTIFACT[entry.category] ?? 'certificate'
      const status: ArtifactStatus = 'available'
      return {
        id: `art-${txId}-buyer-${entry.id}`,
        artifactType,
        label: entry.label,
        status,
        downloadable: status === 'available',
      }
    })

  // One original file per line item
  const originalArtifacts: WhitePackArtifact[] = lineItems.map((li, idx) => ({
    id: `art-${txId}-original-${idx}`,
    artifactType: 'original_file' as ArtifactType,
    label: `Original file: ${li.assetTitle}`,
    status: 'available' as ArtifactStatus,
    downloadable: true,
  }))

  // Provenance record
  const provenanceArtifact: WhitePackArtifact = {
    id: `art-${txId}-provenance`,
    artifactType: 'certificate',
    label: 'Provenance record',
    status: 'available',
    downloadable: true,
  }

  const artifacts = [...docArtifacts, ...originalArtifacts, provenanceArtifact]

  return {
    transactionId: txId,
    packageId,
    packageStatus: 'ready',
    overallStatus: 'ready',
    artifacts,
    documentReadiness,
    signatureReadiness,
    originalAssetReady: true,
    provenanceRecordReady: true,
  }
}

// ══════════════════════════════════════════════
// CREATOR PACK READINESS
// ══════════════════════════════════════════════

function buildCreatorPackReadiness(
  txId: string,
  packageId: string,
): CreatorPackReadiness {
  // Registry-driven: include documents flagged for creator pack
  const docArtifacts: WhitePackArtifact[] = DOCUMENT_REGISTRY
    .filter(entry => entry.inCreatorPack)
    .map(entry => {
      const artifactType = CATEGORY_TO_ARTIFACT[entry.category] ?? 'certificate'
      const status: ArtifactStatus = 'available'
      return {
        id: `art-${txId}-creator-${entry.id}`,
        artifactType,
        label: entry.label,
        status,
        downloadable: status === 'available',
      }
    })

  // Payout summary — creator-only artifact not in document registry
  const payoutArtifact: WhitePackArtifact = {
    id: `art-${txId}-creator-payout`,
    artifactType: 'payout_summary',
    label: 'Payout summary',
    status: 'available',
    downloadable: true,
  }

  return {
    transactionId: txId,
    packageId,
    packageStatus: 'ready',
    overallStatus: 'ready',
    artifacts: [...docArtifacts, payoutArtifact],
  }
}

// ══════════════════════════════════════════════
// UTIL
// ══════════════════════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
