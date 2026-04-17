/**
 * Frontfiles — Signature & Evidence Architecture
 *
 * Minimum viable architecture for proving signatures on documents.
 * For each signable contract, the system must prove:
 *   - who signed
 *   - in what role
 *   - which document version they signed
 *   - when they signed
 *   - how they authenticated
 *   - that signing intent existed
 *   - that the signed document was not altered afterward
 *
 * No fake cryptographic theater. Operational and provable.
 */

import type { SignerRole } from './identity'

// ══════════════════════════════════════════════
// SIGNATURE STATUS
// ══════════════════════════════════════════════

export type SignatureStatus =
  | 'required'       // signature is required but not yet provided
  | 'pending'        // signer has been notified / checkout in progress
  | 'signed'         // signature captured and recorded
  | 'declined'       // signer explicitly declined
  | 'expired'        // signing window expired without action

// ══════════════════════════════════════════════
// AUTHENTICATION METHOD
// ══════════════════════════════════════════════
//
// How the signer authenticated before signing.
// Must be recorded per signature event.

export type SignerAuthMethod =
  | 'platform_session'    // authenticated via Frontfiles account session
  | 'email_otp'           // authenticated via one-time code sent to email
  | 'sso'                 // authenticated via SSO / OAuth provider

// ══════════════════════════════════════════════
// SIGNER REQUIREMENT
// ══════════════════════════════════════════════
//
// Declares that a specific party must sign a document.
// Created at document generation time.

export interface DocumentSignerRequirement {
  /** Unique requirement ID */
  id: string

  /** Document this requirement belongs to */
  documentId: string

  /** Which party snapshot must sign */
  partySnapshotId: string

  /** Role of the required signer */
  signerRole: SignerRole

  /** Current status of this signing requirement */
  status: SignatureStatus

  /** Display label for UI — e.g. "Creator signature" */
  label: string

  /** Order in which signatures should be collected (1 = first) */
  signatureOrder: number
}

// ══════════════════════════════════════════════
// SIGNATURE RECORD
// ══════════════════════════════════════════════
//
// Immutable record of a signature event.
// Created when a signer completes the signing action.

export interface DocumentSignatureRecord {
  /** Unique signature record ID */
  id: string

  /** Which signer requirement this fulfils */
  signerRequirementId: string

  /** Document that was signed */
  documentId: string

  /** Party snapshot of the signer at the time of signing */
  partySnapshotId: string

  /** Role in which the signer signed */
  signerRole: SignerRole

  /**
   * SHA-256 hash of the document content at the moment of signing.
   * Proves the signer signed this exact version — not an altered one.
   */
  documentContentHash: string

  /** ISO 8601 timestamp — when the signature was captured */
  signedAt: string

  /** How the signer authenticated before signing */
  authMethod: SignerAuthMethod

  /** IP address from which the signing request originated */
  signerIpAddress: string

  /** User agent string of the signing client */
  signerUserAgent: string

  /**
   * Signing intent confirmation.
   * true = the signer explicitly confirmed intent to sign
   * (e.g. clicked "I agree and sign" after reviewing the document).
   */
  intentConfirmed: boolean

  /**
   * Platform request ID for the signing action.
   * Links to server access logs for full audit trail.
   */
  requestId: string
}

// ══════════════════════════════════════════════
// DOCUMENT EVIDENCE BUNDLE
// ══════════════════════════════════════════════
//
// Aggregates all proof artifacts for a signed document.
// This is the audit/evidence view payload.

export interface DocumentEvidenceBundle {
  /** Document ID this evidence belongs to */
  documentId: string

  /**
   * SHA-256 hash of the finalized document content.
   * If this differs from signature records' hashes, the document was altered.
   */
  finalDocumentHash: string

  /** All signer requirements for this document */
  signerRequirements: DocumentSignerRequirement[]

  /** All signature records — one per completed signature */
  signatureRecords: DocumentSignatureRecord[]

  /**
   * Whether all required signatures have been captured.
   * Derived: true iff every requirement has status 'signed'.
   */
  allSigned: boolean

  /**
   * Whether the document content hash is consistent across all signatures
   * and matches the final document hash.
   * Derived: true iff all signature documentContentHash values
   * match finalDocumentHash.
   */
  integrityVerified: boolean

  /** ISO 8601 timestamp — when the evidence bundle was assembled */
  assembledAt: string
}
