/**
 * Frontfiles — Legal Identity & Party Snapshot
 *
 * Canonical legal identity structure for signable document parties.
 * Separate from profile data: this is contracting/signing identity.
 *
 * RULE: Once a document is finalized, the party snapshot is immutable.
 * The document must not depend on mutable live profile fields after issuance.
 */

// ══════════════════════════════════════════════
// GOVERNMENT ID TYPE
// ══════════════════════════════════════════════

export type GovernmentIdType =
  | 'national_id'
  | 'passport'
  | 'residence_permit'
  | 'driving_licence'
  | 'tax_id'

export const GOVERNMENT_ID_LABELS: Record<GovernmentIdType, string> = {
  national_id: 'National ID Card',
  passport: 'Passport',
  residence_permit: 'Residence Permit',
  driving_licence: 'Driving Licence',
  tax_id: 'Tax ID',
}

// ══════════════════════════════════════════════
// SIGNER ROLE
// ══════════════════════════════════════════════

export type SignerRole =
  | 'creator'
  | 'buyer'
  | 'buyer_representative'
  | 'platform'

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  creator: 'Creator',
  buyer: 'Buyer',
  buyer_representative: 'Buyer representative',
  platform: 'Frontfiles',
}

// ══════════════════════════════════════════════
// LEGAL PARTY IDENTITY
// ══════════════════════════════════════════════
//
// Full legal identity for a natural person or entity representative.
// Stored canonically, then snapshotted into each document at issuance.

export interface LegalPartyIdentity {
  /** Internal user ID — links back to live profile */
  userId: string

  /** Full legal name as it appears on government ID */
  fullLegalName: string

  /** Date of birth — ISO 8601 date (YYYY-MM-DD) */
  dateOfBirth: string

  /** Place of birth / naturality */
  placeOfBirth: string

  /** Nationality — ISO 3166-1 alpha-2 country code */
  nationality: string

  /** Full legal address — structured as single string for document rendering */
  legalAddress: string

  /** Government-issued ID type */
  governmentIdType: GovernmentIdType

  /** Government-issued ID number */
  governmentIdNumber: string

  /** Country that issued the government ID — ISO 3166-1 alpha-2 */
  issuingCountry: string

  /** Contact email for legal correspondence */
  email: string

  /** Signer role in the document context */
  signerRole: SignerRole

  /**
   * Company or entity the signer represents.
   * null for individual creators or individual buyers.
   */
  representedEntity: {
    name: string
    registrationNumber: string | null
    registeredAddress: string | null
    vatNumber: string | null
  } | null

  /**
   * Authority / capacity under which the signer acts.
   * e.g. "Director", "Content Acquisition Manager", "Sole Proprietor"
   * null when signing in personal capacity.
   */
  authorityCapacity: string | null
}

// ══════════════════════════════════════════════
// DOCUMENT PARTY SNAPSHOT
// ══════════════════════════════════════════════
//
// Immutable copy of a LegalPartyIdentity as captured
// at document issuance/finalization time.
//
// Once created, this snapshot must never be updated —
// it is the legal truth of who signed what, when.

export interface DocumentPartySnapshot {
  /** Unique snapshot ID */
  id: string

  /** Document ID this snapshot belongs to */
  documentId: string

  /** The full legal identity data, frozen at snapshot time */
  identity: LegalPartyIdentity

  /** ISO 8601 timestamp — when this snapshot was captured */
  snapshotAt: string

  /**
   * SHA-256 hash of the canonical JSON serialization of the identity.
   * Allows integrity verification without re-reading the full payload.
   */
  identityHash: string
}
