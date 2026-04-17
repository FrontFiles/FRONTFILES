/**
 * Frontfiles — Transaction Document Registry
 *
 * Canonical document types for the commercial document set.
 * The 6 documents produced per completed transaction are:
 *
 * CONTRACTS (Frontfiles-authored):
 *   1. Frontfiles Standard Editorial Licence (creator → buyer)
 *   2. Contract between creator and Frontfiles
 *   3. Contract between buyer and Frontfiles
 *
 * FINANCE (payment-processor sourced, normalized into Frontfiles):
 *   4. Frontfiles fee invoice to buyer
 *   5. Frontfiles fee invoice to creator
 *   6. Receipt to buyer in name of creator
 *
 * Each document is:
 *   - identity-bound (party snapshots frozen at issuance)
 *   - signable (signer requirements + signature records)
 *   - provable (content hashing + evidence bundles)
 *   - transaction-clear (structured sections, not vague prose)
 *   - provenance-linked (asset schedule with certification refs)
 *   - renderable in multiple visibility modes (canonical / pack / evidence)
 */

import type { DocumentPartySnapshot } from './identity'
import type { DocumentSignerRequirement, DocumentEvidenceBundle } from './signature'

// ══════════════════════════════════════════════
// DOCUMENT CATEGORY & ISSUER
// ══════════════════════════════════════════════

export type DocumentCategory = 'licence' | 'contract' | 'invoice' | 'receipt'

export type DocumentIssuer = 'frontfiles' | 'payment_processor'

// ══════════════════════════════════════════════
// CANONICAL DOCUMENT TYPE IDS
// ══════════════════════════════════════════════

export type TransactionDocumentTypeId =
  | 'standard_editorial_licence'
  | 'contract_creator_frontfiles'
  | 'contract_buyer_frontfiles'
  | 'invoice_buyer'
  | 'invoice_creator'
  | 'receipt_buyer'

// ══════════════════════════════════════════════
// DOCUMENT STATUS
// ══════════════════════════════════════════════

export type DocumentStatus =
  | 'pending'       // not yet generated
  | 'preview_ready' // preview available, final artifact not yet issued
  | 'finalized'     // final artifact available
  | 'failed'        // generation failed

// ══════════════════════════════════════════════
// LICENCE MEDIUM (Standard Editorial Licence)
// ══════════════════════════════════════════════

export type LicenceMedium = 'newspaper' | 'magazine' | 'site'

export const LICENCE_MEDIUM_LABELS: Record<LicenceMedium, string> = {
  newspaper: 'Newspaper',
  magazine: 'Magazine',
  site: 'Site',
}

// ══════════════════════════════════════════════
// DOCUMENT REGISTRY CONFIG ENTRY
// ══════════════════════════════════════════════

export interface DocumentRegistryEntry {
  id: TransactionDocumentTypeId
  label: string
  shortLabel: string
  category: DocumentCategory
  issuer: DocumentIssuer
  displayOrder: number
  previewAvailable: boolean
  inBuyerPack: boolean
  inCreatorPack: boolean
  requiredForFinalization: boolean
}

// ══════════════════════════════════════════════
// CANONICAL REGISTRY
// ══════════════════════════════════════════════

export const DOCUMENT_REGISTRY: DocumentRegistryEntry[] = [
  {
    id: 'standard_editorial_licence',
    label: 'Frontfiles Standard Editorial Licence',
    shortLabel: 'Editorial Licence',
    category: 'licence',
    issuer: 'frontfiles',
    displayOrder: 1,
    previewAvailable: true,
    inBuyerPack: true,
    inCreatorPack: true,
    requiredForFinalization: true,
  },
  {
    id: 'contract_creator_frontfiles',
    label: 'Contract between creator and Frontfiles',
    shortLabel: 'Creator contract',
    category: 'contract',
    issuer: 'frontfiles',
    displayOrder: 2,
    previewAvailable: true,
    inBuyerPack: false,
    inCreatorPack: true,
    requiredForFinalization: true,
  },
  {
    id: 'contract_buyer_frontfiles',
    label: 'Contract between buyer and Frontfiles',
    shortLabel: 'Buyer contract',
    category: 'contract',
    issuer: 'frontfiles',
    displayOrder: 3,
    previewAvailable: true,
    inBuyerPack: true,
    inCreatorPack: false,
    requiredForFinalization: true,
  },
  {
    id: 'invoice_buyer',
    label: 'Frontfiles fee invoice to buyer',
    shortLabel: 'Buyer invoice',
    category: 'invoice',
    issuer: 'payment_processor',
    displayOrder: 4,
    previewAvailable: true,
    inBuyerPack: true,
    inCreatorPack: false,
    requiredForFinalization: true,
  },
  {
    id: 'invoice_creator',
    label: 'Frontfiles fee invoice to creator',
    shortLabel: 'Creator invoice',
    category: 'invoice',
    issuer: 'payment_processor',
    displayOrder: 5,
    previewAvailable: true,
    inBuyerPack: false,
    inCreatorPack: true,
    requiredForFinalization: true,
  },
  {
    id: 'receipt_buyer',
    label: 'Receipt to buyer in name of creator',
    shortLabel: 'Buyer receipt',
    category: 'receipt',
    issuer: 'payment_processor',
    displayOrder: 6,
    previewAvailable: true,
    inBuyerPack: true,
    inCreatorPack: false,
    requiredForFinalization: true,
  },
]

export const DOCUMENT_REGISTRY_MAP: Record<TransactionDocumentTypeId, DocumentRegistryEntry> =
  Object.fromEntries(DOCUMENT_REGISTRY.map(d => [d.id, d])) as Record<TransactionDocumentTypeId, DocumentRegistryEntry>

// ══════════════════════════════════════════════
// CATEGORY & ISSUER LABELS
// ══════════════════════════════════════════════

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  licence: 'Licence',
  contract: 'Contract',
  invoice: 'Invoice',
  receipt: 'Receipt',
}

export const DOCUMENT_ISSUER_LABELS: Record<DocumentIssuer, string> = {
  frontfiles: 'Frontfiles',
  payment_processor: 'Payment processor',
}

// ══════════════════════════════════════════════
// ASSET SCHEDULE / PROVENANCE BLOCK
// ══════════════════════════════════════════════
//
// Structured linkage from a contract to the exact asset(s) involved.
// Each entry connects to a specific asset with provenance proof.

export interface AssetScheduleEntry {
  /** Vault asset ID */
  assetId: string
  /** Asset title at time of document issuance */
  assetTitle: string
  /** Creator attribution — display name or legal name */
  creatorAttribution: string
  /** Creator user ID */
  creatorId: string
  /** Provenance / certification record ID, if available */
  certificationRecordId: string | null
  /** Certification hash at time of issuance */
  certificationHashAtIssue: string | null
  /** Transaction line item reference */
  lineItemId: string | null
  /** Selected medium for this asset's licence */
  selectedMedium: LicenceMedium | null
  /** Licence term — always "1 year" for Standard Editorial Licence */
  licenceTerm: string
  /** Whether this is an exclusive licence */
  exclusive: boolean
}

// ══════════════════════════════════════════════
// LICENCE DETAILS BLOCK
// ══════════════════════════════════════════════

export interface LicenceDetailsBlock {
  /** Licence type name */
  licenceName: string
  /** Usage class — "Editorial" for Standard Editorial Licence */
  usageClass: string
  /** Medium scope — "Single medium" */
  mediumScope: string
  /** Selected medium */
  selectedMedium: LicenceMedium | null
  /** Term duration */
  term: string
  /** Exclusivity */
  exclusivity: string
  /** Territory */
  territory: string
}

// ══════════════════════════════════════════════
// TRANSACTION DOCUMENT INSTANCE
// ══════════════════════════════════════════════

export interface TransactionDocument {
  id: string
  transactionId: string
  typeId: TransactionDocumentTypeId
  status: DocumentStatus
  documentRef: string | null
  issuedAt: string | null

  /** Counterparties visible in the document (display names for list views) */
  counterparties: {
    party1: string
    party2: string
  }

  /**
   * Immutable party snapshots — full legal identity frozen at issuance.
   * null before document generation; populated at preview_ready or finalized.
   */
  partySnapshots: DocumentPartySnapshot[] | null

  /**
   * Signer requirements for this document.
   * Contracts and licences require signatures; invoices/receipts do not.
   */
  signerRequirements: DocumentSignerRequirement[] | null

  /**
   * Evidence bundle — assembled after all signatures are captured.
   * Contains integrity proof + full audit trail.
   */
  evidenceBundle: DocumentEvidenceBundle | null

  /**
   * SHA-256 hash of the finalized document content.
   * Set when status transitions to 'finalized'.
   */
  contentHash: string | null

  /** For licence docs — the specific medium selected */
  licenceMedium: LicenceMedium | null

  /** Structured licence details — for licence documents */
  licenceDetails: LicenceDetailsBlock | null

  /** Structured asset schedule — provenance linkage */
  assetSchedule: AssetScheduleEntry[] | null

  /** For finance docs — amounts and identifiers */
  finance: {
    invoiceId: string | null
    receiptId: string | null
    amountCents: number
    currency: string
    issueDate: string | null
    paymentDate: string | null
    lineItems: { description: string; amountCents: number }[]
  } | null
}

// ══════════════════════════════════════════════
// TRANSACTION DOCUMENT SET
// ══════════════════════════════════════════════

export interface TransactionDocumentSet {
  transactionId: string
  assignmentId: string
  /** Human-readable asset description (for list views) */
  assetRef: string
  /** Structured asset schedule — canonical provenance linkage */
  assetSchedule: AssetScheduleEntry[]
  documents: TransactionDocument[]
  buyerPackDocumentIds: string[]
  creatorPackDocumentIds: string[]
  allFinalized: boolean
  /** Whether all signable documents have all required signatures */
  allSigned: boolean
  createdAt: string
}
