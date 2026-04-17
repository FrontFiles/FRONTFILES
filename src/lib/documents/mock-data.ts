/**
 * Frontfiles — Transaction Document Mock Data
 *
 * Seeded document sets for the three canonical assignment scenarios.
 * Each transaction produces 6 documents: 3 contracts + 3 finance docs.
 *
 * Now includes:
 *   - full legal party identity snapshots
 *   - signer requirements and signature records
 *   - evidence bundles with integrity hashes
 *   - structured asset schedules with provenance linkage
 *   - licence details blocks
 */

import type {
  TransactionDocument,
  TransactionDocumentSet,
  AssetScheduleEntry,
} from './types'
import type { LegalPartyIdentity, DocumentPartySnapshot } from './identity'
import type {
  DocumentSignerRequirement,
  DocumentSignatureRecord,
  DocumentEvidenceBundle,
} from './signature'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function makeDocId(txId: string, suffix: string): string {
  return `doc-${txId}-${suffix}`
}

function makeSnapshotId(txId: string, party: string): string {
  return `snap-${txId}-${party}`
}

function makeSignReqId(txId: string, party: string): string {
  return `sigreq-${txId}-${party}`
}

function makeSignRecId(txId: string, party: string): string {
  return `sigrec-${txId}-${party}`
}

// ══════════════════════════════════════════════
// CANONICAL LEGAL IDENTITIES
// ══════════════════════════════════════════════
// These represent the full legal identity data for each party.
// In production, these live in the identity profile store.
// Here they are inline for mock purposes.

const IDENTITY_MARCO_RIBEIRO: LegalPartyIdentity = {
  userId: 'usr-marco-ribeiro',
  fullLegalName: 'Marco António Ribeiro da Silva',
  dateOfBirth: '1987-03-15',
  placeOfBirth: 'Porto Alegre, Rio Grande do Sul, Brasil',
  nationality: 'BR',
  legalAddress: 'Rua Augusta 245, 3º Esq, 1100-048 Lisboa, Portugal',
  governmentIdType: 'passport',
  governmentIdNumber: 'FX892341',
  issuingCountry: 'BR',
  email: 'marco.ribeiro@proton.me',
  signerRole: 'creator',
  representedEntity: null,
  authorityCapacity: null,
}

const IDENTITY_REUTERS: LegalPartyIdentity = {
  userId: 'usr-reuters-acq-01',
  fullLegalName: 'James Edward Whitfield',
  dateOfBirth: '1979-08-22',
  placeOfBirth: 'Manchester, United Kingdom',
  nationality: 'GB',
  legalAddress: '5 Canada Square, Canary Wharf, London E14 5AP, United Kingdom',
  governmentIdType: 'passport',
  governmentIdNumber: 'GBR7782341',
  issuingCountry: 'GB',
  email: 'j.whitfield@reuters.com',
  signerRole: 'buyer_representative',
  representedEntity: {
    name: 'Reuters News Agency (Thomson Reuters Corporation)',
    registrationNumber: 'UK-08302241',
    registeredAddress: '5 Canada Square, Canary Wharf, London E14 5AP, United Kingdom',
    vatNumber: 'GB 243 8598 77',
  },
  authorityCapacity: 'Senior Content Acquisition Manager',
}

const IDENTITY_DIMITRIS: LegalPartyIdentity = {
  userId: 'usr-dimitris-papa',
  fullLegalName: 'Dimitris Konstantinos Papadopoulos',
  dateOfBirth: '1991-11-04',
  placeOfBirth: 'Thessaloniki, Greece',
  nationality: 'GR',
  legalAddress: 'Odos Tsimiski 42, 546 23 Thessaloniki, Greece',
  governmentIdType: 'national_id',
  governmentIdNumber: 'AK-2847561',
  issuingCountry: 'GR',
  email: 'dimitris.papa@outlook.com',
  signerRole: 'creator',
  representedEntity: null,
  authorityCapacity: null,
}

const IDENTITY_GUARDIAN: LegalPartyIdentity = {
  userId: 'usr-guardian-acq-01',
  fullLegalName: 'Sarah Louise Chen',
  dateOfBirth: '1985-06-19',
  placeOfBirth: 'London, United Kingdom',
  nationality: 'GB',
  legalAddress: "Kings Place, 90 York Way, London N1 9GU, United Kingdom",
  governmentIdType: 'passport',
  governmentIdNumber: 'GBR5561892',
  issuingCountry: 'GB',
  email: 's.chen@guardian.co.uk',
  signerRole: 'buyer_representative',
  representedEntity: {
    name: 'Guardian News & Media Limited',
    registrationNumber: 'UK-00908396',
    registeredAddress: "Kings Place, 90 York Way, London N1 9GU, United Kingdom",
    vatNumber: 'GB 125 4339 67',
  },
  authorityCapacity: 'Head of Visual Journalism',
}

const IDENTITY_ANA_SOUSA: LegalPartyIdentity = {
  userId: 'usr-ana-sousa',
  fullLegalName: 'Ana Maria Ferreira de Sousa',
  dateOfBirth: '1993-01-28',
  placeOfBirth: 'Coimbra, Portugal',
  nationality: 'PT',
  legalAddress: 'Travessa do Carmo 12, 2º Dto, 1200-094 Lisboa, Portugal',
  governmentIdType: 'national_id',
  governmentIdNumber: '14829376',
  issuingCountry: 'PT',
  email: 'ana.sousa@frontfiles.com',
  signerRole: 'creator',
  representedEntity: null,
  authorityCapacity: null,
}

const IDENTITY_EXPRESSO: LegalPartyIdentity = {
  userId: 'usr-expresso-acq-01',
  fullLegalName: 'Ricardo José Mendes Almeida',
  dateOfBirth: '1978-09-07',
  placeOfBirth: 'Lisboa, Portugal',
  nationality: 'PT',
  legalAddress: 'Rua Calvet de Magalhães 242, 2770-022 Paço de Arcos, Portugal',
  governmentIdType: 'national_id',
  governmentIdNumber: '10437285',
  issuingCountry: 'PT',
  email: 'r.almeida@impresa.pt',
  signerRole: 'buyer_representative',
  representedEntity: {
    name: 'Impresa SGPS, S.A. (Expresso)',
    registrationNumber: 'PT-502437571',
    registeredAddress: 'Rua Calvet de Magalhães 242, 2770-022 Paço de Arcos, Portugal',
    vatNumber: 'PT 502 437 571',
  },
  authorityCapacity: 'Director of Photography',
}

const IDENTITY_FRONTFILES: LegalPartyIdentity = {
  userId: 'usr-frontfiles-platform',
  fullLegalName: 'Frontfiles Platform Operations',
  dateOfBirth: '2024-01-01',
  placeOfBirth: 'London, United Kingdom',
  nationality: 'GB',
  legalAddress: 'Frontfiles Ltd, 71-75 Shelton Street, London WC2H 9JQ, United Kingdom',
  governmentIdType: 'tax_id',
  governmentIdNumber: 'GB-15847293',
  issuingCountry: 'GB',
  email: 'legal@frontfiles.com',
  signerRole: 'platform',
  representedEntity: {
    name: 'Frontfiles Ltd',
    registrationNumber: 'UK-15847293',
    registeredAddress: '71-75 Shelton Street, London WC2H 9JQ, United Kingdom',
    vatNumber: 'GB 158 4729 300',
  },
  authorityCapacity: 'Platform Operations',
}

// ══════════════════════════════════════════════
// SNAPSHOT BUILDER
// ══════════════════════════════════════════════

function makeSnapshot(
  docId: string,
  snapshotId: string,
  identity: LegalPartyIdentity,
  snapshotAt: string,
): DocumentPartySnapshot {
  return {
    id: snapshotId,
    documentId: docId,
    identity,
    snapshotAt,
    // Deterministic mock hash — in production, SHA-256 of canonical JSON
    identityHash: `sha256:mock:${snapshotId}`,
  }
}

// ══════════════════════════════════════════════
// SIGNATURE BUILDER
// ══════════════════════════════════════════════

function makeSignerReq(
  id: string,
  documentId: string,
  partySnapshotId: string,
  signerRole: LegalPartyIdentity['signerRole'],
  label: string,
  order: number,
  status: 'required' | 'pending' | 'signed',
): DocumentSignerRequirement {
  return {
    id,
    documentId,
    partySnapshotId,
    signerRole,
    status,
    label,
    signatureOrder: order,
  }
}

function makeSignatureRecord(
  id: string,
  signerRequirementId: string,
  documentId: string,
  partySnapshotId: string,
  signerRole: LegalPartyIdentity['signerRole'],
  contentHash: string,
  signedAt: string,
): DocumentSignatureRecord {
  return {
    id,
    signerRequirementId,
    documentId,
    partySnapshotId,
    signerRole,
    documentContentHash: contentHash,
    signedAt,
    authMethod: 'platform_session',
    signerIpAddress: '203.0.113.1',
    signerUserAgent: 'Frontfiles/1.0 (Web)',
    intentConfirmed: true,
    requestId: `req-${id}`,
  }
}

function makeEvidenceBundle(
  documentId: string,
  finalHash: string,
  reqs: DocumentSignerRequirement[],
  recs: DocumentSignatureRecord[],
  assembledAt: string,
): DocumentEvidenceBundle {
  const allSigned = reqs.every(r => r.status === 'signed')
  const integrityVerified = allSigned && recs.every(r => r.documentContentHash === finalHash)
  return {
    documentId,
    finalDocumentHash: finalHash,
    signerRequirements: reqs,
    signatureRecords: recs,
    allSigned,
    integrityVerified,
    assembledAt,
  }
}

// ══════════════════════════════════════════════
// ASSET SCHEDULES
// ══════════════════════════════════════════════

const ASSET_SCHEDULE_MAT: AssetScheduleEntry[] = [
  {
    assetId: 'asset-porto-alegre-001',
    assetTitle: 'Porto Alegre flood coverage — 25 photographs',
    creatorAttribution: 'Marco António Ribeiro da Silva',
    creatorId: 'usr-marco-ribeiro',
    certificationRecordId: 'cert-porto-alegre-001',
    certificationHashAtIssue: 'sha256:a3f8c9d2e1b4...mock',
    lineItemId: 'li-mat-001-01',
    selectedMedium: 'newspaper',
    licenceTerm: '1 year',
    exclusive: false,
  },
]

const ASSET_SCHEDULE_SVC: AssetScheduleEntry[] = [
  {
    assetId: 'asset-evros-fixer-001',
    assetTitle: 'Fixer/logistics — Evros border coverage, 5 days',
    creatorAttribution: 'Dimitris Konstantinos Papadopoulos',
    creatorId: 'usr-dimitris-papa',
    certificationRecordId: null,
    certificationHashAtIssue: null,
    lineItemId: 'li-svc-001-01',
    selectedMedium: 'site',
    licenceTerm: '1 year',
    exclusive: false,
  },
]

const ASSET_SCHEDULE_HYB: AssetScheduleEntry[] = [
  {
    assetId: 'asset-lisbon-housing-001',
    assetTitle: 'Lisbon housing crisis — interviews, photo essay, 2 videos',
    creatorAttribution: 'Ana Maria Ferreira de Sousa',
    creatorId: 'usr-ana-sousa',
    certificationRecordId: 'cert-lisbon-housing-001',
    certificationHashAtIssue: 'sha256:b7e2d1c4f3a6...mock',
    lineItemId: 'li-hyb-001-01',
    selectedMedium: 'magazine',
    licenceTerm: '1 year',
    exclusive: false,
  },
]

// ══════════════════════════════════════════════
// CONTENT HASHES (mock)
// ══════════════════════════════════════════════

const HASH_MAT_LICENCE = 'sha256:doc:mat-001-licence:v1:final'
const HASH_MAT_CTR_C = 'sha256:doc:mat-001-ctr-c:v1:final'
const HASH_MAT_CTR_B = 'sha256:doc:mat-001-ctr-b:v1:final'

// ══════════════════════════════════════════════
// 1. MATERIAL ASSIGNMENT — asgn-mat-001
//    Buyer: Reuters | Creator: Marco Ribeiro
//    Fully finalized document set with all signatures
//    Medium: newspaper
// ══════════════════════════════════════════════

const matLicenceId = makeDocId('mat-001', 'licence')
const matCtrCreatorId = makeDocId('mat-001', 'contract-creator')
const matCtrBuyerId = makeDocId('mat-001', 'contract-buyer')

// Snapshots for material licence
const matSnapCreator = makeSnapshot(matLicenceId, makeSnapshotId('mat-001', 'creator'), IDENTITY_MARCO_RIBEIRO, '2026-04-14T09:55:00Z')
const matSnapBuyer = makeSnapshot(matLicenceId, makeSnapshotId('mat-001', 'buyer'), IDENTITY_REUTERS, '2026-04-14T09:55:00Z')
const matSnapPlatformLic = makeSnapshot(matLicenceId, makeSnapshotId('mat-001', 'platform-lic'), IDENTITY_FRONTFILES, '2026-04-14T09:55:00Z')

// Signer requirements + records for material licence (finalized = all signed)
const matLicReqCreator = makeSignerReq(makeSignReqId('mat-001', 'lic-creator'), matLicenceId, matSnapCreator.id, 'creator', 'Creator signature', 1, 'signed')
const matLicReqBuyer = makeSignerReq(makeSignReqId('mat-001', 'lic-buyer'), matLicenceId, matSnapBuyer.id, 'buyer_representative', 'Buyer signature', 2, 'signed')
const matLicRecCreator = makeSignatureRecord(makeSignRecId('mat-001', 'lic-creator'), matLicReqCreator.id, matLicenceId, matSnapCreator.id, 'creator', HASH_MAT_LICENCE, '2026-04-14T09:58:00Z')
const matLicRecBuyer = makeSignatureRecord(makeSignRecId('mat-001', 'lic-buyer'), matLicReqBuyer.id, matLicenceId, matSnapBuyer.id, 'buyer_representative', HASH_MAT_LICENCE, '2026-04-14T10:00:00Z')
const matLicEvidence = makeEvidenceBundle(matLicenceId, HASH_MAT_LICENCE, [matLicReqCreator, matLicReqBuyer], [matLicRecCreator, matLicRecBuyer], '2026-04-14T10:00:30Z')

// Contract creator-frontfiles snapshots + signatures
const matCtrCSnapCreator = makeSnapshot(matCtrCreatorId, makeSnapshotId('mat-001', 'ctr-c-creator'), IDENTITY_MARCO_RIBEIRO, '2026-04-02T08:25:00Z')
const matCtrCSnapPlatform = makeSnapshot(matCtrCreatorId, makeSnapshotId('mat-001', 'ctr-c-platform'), IDENTITY_FRONTFILES, '2026-04-02T08:25:00Z')
const matCtrCReqCreator = makeSignerReq(makeSignReqId('mat-001', 'ctr-c-creator'), matCtrCreatorId, matCtrCSnapCreator.id, 'creator', 'Creator signature', 1, 'signed')
const matCtrCReqPlatform = makeSignerReq(makeSignReqId('mat-001', 'ctr-c-platform'), matCtrCreatorId, matCtrCSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'signed')
const matCtrCRecCreator = makeSignatureRecord(makeSignRecId('mat-001', 'ctr-c-creator'), matCtrCReqCreator.id, matCtrCreatorId, matCtrCSnapCreator.id, 'creator', HASH_MAT_CTR_C, '2026-04-02T08:28:00Z')
const matCtrCRecPlatform = makeSignatureRecord(makeSignRecId('mat-001', 'ctr-c-platform'), matCtrCReqPlatform.id, matCtrCreatorId, matCtrCSnapPlatform.id, 'platform', HASH_MAT_CTR_C, '2026-04-02T08:30:00Z')
const matCtrCEvidence = makeEvidenceBundle(matCtrCreatorId, HASH_MAT_CTR_C, [matCtrCReqCreator, matCtrCReqPlatform], [matCtrCRecCreator, matCtrCRecPlatform], '2026-04-02T08:30:30Z')

// Contract buyer-frontfiles snapshots + signatures
const matCtrBSnapBuyer = makeSnapshot(matCtrBuyerId, makeSnapshotId('mat-001', 'ctr-b-buyer'), IDENTITY_REUTERS, '2026-04-02T08:25:00Z')
const matCtrBSnapPlatform = makeSnapshot(matCtrBuyerId, makeSnapshotId('mat-001', 'ctr-b-platform'), IDENTITY_FRONTFILES, '2026-04-02T08:25:00Z')
const matCtrBReqBuyer = makeSignerReq(makeSignReqId('mat-001', 'ctr-b-buyer'), matCtrBuyerId, matCtrBSnapBuyer.id, 'buyer_representative', 'Buyer signature', 1, 'signed')
const matCtrBReqPlatform = makeSignerReq(makeSignReqId('mat-001', 'ctr-b-platform'), matCtrBuyerId, matCtrBSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'signed')
const matCtrBRecBuyer = makeSignatureRecord(makeSignRecId('mat-001', 'ctr-b-buyer'), matCtrBReqBuyer.id, matCtrBuyerId, matCtrBSnapBuyer.id, 'buyer_representative', HASH_MAT_CTR_B, '2026-04-02T08:28:00Z')
const matCtrBRecPlatform = makeSignatureRecord(makeSignRecId('mat-001', 'ctr-b-platform'), matCtrBReqPlatform.id, matCtrBuyerId, matCtrBSnapPlatform.id, 'platform', HASH_MAT_CTR_B, '2026-04-02T08:30:00Z')
const matCtrBEvidence = makeEvidenceBundle(matCtrBuyerId, HASH_MAT_CTR_B, [matCtrBReqBuyer, matCtrBReqPlatform], [matCtrBRecBuyer, matCtrBRecPlatform], '2026-04-02T08:30:30Z')

const matDocs: TransactionDocument[] = [
  {
    id: matLicenceId,
    transactionId: 'txn-mat-001',
    typeId: 'standard_editorial_licence',
    status: 'finalized',
    documentRef: 'FF-LIC-2026-00847',
    issuedAt: '2026-04-14T10:00:00Z',
    counterparties: {
      party1: 'Marco Ribeiro (creator)',
      party2: 'Reuters News Agency (buyer)',
    },
    partySnapshots: [matSnapCreator, matSnapBuyer, matSnapPlatformLic],
    signerRequirements: [matLicReqCreator, matLicReqBuyer],
    evidenceBundle: matLicEvidence,
    contentHash: HASH_MAT_LICENCE,
    licenceMedium: 'newspaper',
    licenceDetails: {
      licenceName: 'Frontfiles Standard Editorial Licence',
      usageClass: 'Editorial',
      mediumScope: 'Single medium',
      selectedMedium: 'newspaper',
      term: '1 year',
      exclusivity: 'Non-exclusive',
      territory: 'Worldwide',
    },
    assetSchedule: ASSET_SCHEDULE_MAT,
    finance: null,
  },
  {
    id: matCtrCreatorId,
    transactionId: 'txn-mat-001',
    typeId: 'contract_creator_frontfiles',
    status: 'finalized',
    documentRef: 'FF-CTR-C-2026-00847',
    issuedAt: '2026-04-02T08:30:00Z',
    counterparties: {
      party1: 'Marco Ribeiro',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [matCtrCSnapCreator, matCtrCSnapPlatform],
    signerRequirements: [matCtrCReqCreator, matCtrCReqPlatform],
    evidenceBundle: matCtrCEvidence,
    contentHash: HASH_MAT_CTR_C,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_MAT,
    finance: null,
  },
  {
    id: matCtrBuyerId,
    transactionId: 'txn-mat-001',
    typeId: 'contract_buyer_frontfiles',
    status: 'finalized',
    documentRef: 'FF-CTR-B-2026-00847',
    issuedAt: '2026-04-02T08:30:00Z',
    counterparties: {
      party1: 'Reuters News Agency',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [matCtrBSnapBuyer, matCtrBSnapPlatform],
    signerRequirements: [matCtrBReqBuyer, matCtrBReqPlatform],
    evidenceBundle: matCtrBEvidence,
    contentHash: HASH_MAT_CTR_B,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_MAT,
    finance: null,
  },
  {
    id: makeDocId('mat-001', 'inv-buyer'),
    transactionId: 'txn-mat-001',
    typeId: 'invoice_buyer',
    status: 'finalized',
    documentRef: 'INV-B-2026-04-00847',
    issuedAt: '2026-04-14T10:05:00Z',
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'Reuters News Agency',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: 'INV-B-2026-04-00847',
      receiptId: null,
      amountCents: 55000,
      currency: 'EUR',
      issueDate: '2026-04-14',
      paymentDate: '2026-04-14',
      lineItems: [
        { description: 'Platform fee — buyer markup (10% of €2,500.00)', amountCents: 25000 },
        { description: 'Processing fee', amountCents: 5000 },
        { description: 'VAT (20%)', amountCents: 25000 },
      ],
    },
  },
  {
    id: makeDocId('mat-001', 'inv-creator'),
    transactionId: 'txn-mat-001',
    typeId: 'invoice_creator',
    status: 'finalized',
    documentRef: 'INV-C-2026-04-00847',
    issuedAt: '2026-04-14T10:05:00Z',
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'Marco Ribeiro',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: 'INV-C-2026-04-00847',
      receiptId: null,
      amountCents: 50000,
      currency: 'EUR',
      issueDate: '2026-04-14',
      paymentDate: null,
      lineItems: [
        { description: 'Platform fee — creator commission (20% of €2,500.00)', amountCents: 50000 },
      ],
    },
  },
  {
    id: makeDocId('mat-001', 'receipt-buyer'),
    transactionId: 'txn-mat-001',
    typeId: 'receipt_buyer',
    status: 'finalized',
    documentRef: 'RCT-2026-04-00847',
    issuedAt: '2026-04-14T10:10:00Z',
    counterparties: {
      party1: 'Marco Ribeiro (via Frontfiles)',
      party2: 'Reuters News Agency',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: null,
      receiptId: 'RCT-2026-04-00847',
      amountCents: 275000,
      currency: 'EUR',
      issueDate: '2026-04-14',
      paymentDate: '2026-04-14',
      lineItems: [
        { description: 'Frontfiles Standard Editorial Licence — 25 photographs, Porto Alegre flood coverage', amountCents: 250000 },
        { description: 'Buyer platform fee (10%)', amountCents: 25000 },
      ],
    },
  },
]

export const materialDocumentSet: TransactionDocumentSet = {
  transactionId: 'txn-mat-001',
  assignmentId: 'asgn-mat-001',
  assetRef: 'Porto Alegre flood coverage — 25 photographs',
  assetSchedule: ASSET_SCHEDULE_MAT,
  documents: matDocs,
  buyerPackDocumentIds: [
    makeDocId('mat-001', 'licence'),
    makeDocId('mat-001', 'contract-buyer'),
    makeDocId('mat-001', 'inv-buyer'),
    makeDocId('mat-001', 'receipt-buyer'),
  ],
  creatorPackDocumentIds: [
    makeDocId('mat-001', 'licence'),
    makeDocId('mat-001', 'contract-creator'),
    makeDocId('mat-001', 'inv-creator'),
  ],
  allFinalized: true,
  allSigned: true,
  createdAt: '2026-04-14T10:00:00Z',
}

// ══════════════════════════════════════════════
// 2. SERVICE ASSIGNMENT — asgn-svc-001
//    Buyer: The Guardian | Creator: Dimitris Papadopoulos
//    Partial — contracts signed, finance docs pending
//    Medium: site
// ══════════════════════════════════════════════

const svcLicenceId = makeDocId('svc-001', 'licence')
const svcCtrCreatorId = makeDocId('svc-001', 'contract-creator')
const svcCtrBuyerId = makeDocId('svc-001', 'contract-buyer')

// Licence — preview_ready, signatures pending
const svcSnapCreator = makeSnapshot(svcLicenceId, makeSnapshotId('svc-001', 'creator'), IDENTITY_DIMITRIS, '2026-04-10T13:55:00Z')
const svcSnapBuyer = makeSnapshot(svcLicenceId, makeSnapshotId('svc-001', 'buyer'), IDENTITY_GUARDIAN, '2026-04-10T13:55:00Z')
const svcLicReqCreator = makeSignerReq(makeSignReqId('svc-001', 'lic-creator'), svcLicenceId, svcSnapCreator.id, 'creator', 'Creator signature', 1, 'pending')
const svcLicReqBuyer = makeSignerReq(makeSignReqId('svc-001', 'lic-buyer'), svcLicenceId, svcSnapBuyer.id, 'buyer_representative', 'Buyer signature', 2, 'required')

// Creator-Frontfiles contract — signed
const svcCtrCSnapCreator = makeSnapshot(svcCtrCreatorId, makeSnapshotId('svc-001', 'ctr-c-creator'), IDENTITY_DIMITRIS, '2026-04-10T13:55:00Z')
const svcCtrCSnapPlatform = makeSnapshot(svcCtrCreatorId, makeSnapshotId('svc-001', 'ctr-c-platform'), IDENTITY_FRONTFILES, '2026-04-10T13:55:00Z')
const svcCtrCReqCreator = makeSignerReq(makeSignReqId('svc-001', 'ctr-c-creator'), svcCtrCreatorId, svcCtrCSnapCreator.id, 'creator', 'Creator signature', 1, 'signed')
const svcCtrCReqPlatform = makeSignerReq(makeSignReqId('svc-001', 'ctr-c-platform'), svcCtrCreatorId, svcCtrCSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'signed')
const svcCtrCHash = 'sha256:doc:svc-001-ctr-c:v1:final'
const svcCtrCRecCreator = makeSignatureRecord(makeSignRecId('svc-001', 'ctr-c-creator'), svcCtrCReqCreator.id, svcCtrCreatorId, svcCtrCSnapCreator.id, 'creator', svcCtrCHash, '2026-04-10T13:58:00Z')
const svcCtrCRecPlatform = makeSignatureRecord(makeSignRecId('svc-001', 'ctr-c-platform'), svcCtrCReqPlatform.id, svcCtrCreatorId, svcCtrCSnapPlatform.id, 'platform', svcCtrCHash, '2026-04-10T14:00:00Z')
const svcCtrCEvidence = makeEvidenceBundle(svcCtrCreatorId, svcCtrCHash, [svcCtrCReqCreator, svcCtrCReqPlatform], [svcCtrCRecCreator, svcCtrCRecPlatform], '2026-04-10T14:00:30Z')

// Buyer-Frontfiles contract — signed
const svcCtrBSnapBuyer = makeSnapshot(svcCtrBuyerId, makeSnapshotId('svc-001', 'ctr-b-buyer'), IDENTITY_GUARDIAN, '2026-04-10T13:55:00Z')
const svcCtrBSnapPlatform = makeSnapshot(svcCtrBuyerId, makeSnapshotId('svc-001', 'ctr-b-platform'), IDENTITY_FRONTFILES, '2026-04-10T13:55:00Z')
const svcCtrBReqBuyer = makeSignerReq(makeSignReqId('svc-001', 'ctr-b-buyer'), svcCtrBuyerId, svcCtrBSnapBuyer.id, 'buyer_representative', 'Buyer signature', 1, 'signed')
const svcCtrBReqPlatform = makeSignerReq(makeSignReqId('svc-001', 'ctr-b-platform'), svcCtrBuyerId, svcCtrBSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'signed')
const svcCtrBHash = 'sha256:doc:svc-001-ctr-b:v1:final'
const svcCtrBRecBuyer = makeSignatureRecord(makeSignRecId('svc-001', 'ctr-b-buyer'), svcCtrBReqBuyer.id, svcCtrBuyerId, svcCtrBSnapBuyer.id, 'buyer_representative', svcCtrBHash, '2026-04-10T13:58:00Z')
const svcCtrBRecPlatform = makeSignatureRecord(makeSignRecId('svc-001', 'ctr-b-platform'), svcCtrBReqPlatform.id, svcCtrBuyerId, svcCtrBSnapPlatform.id, 'platform', svcCtrBHash, '2026-04-10T14:00:00Z')
const svcCtrBEvidence = makeEvidenceBundle(svcCtrBuyerId, svcCtrBHash, [svcCtrBReqBuyer, svcCtrBReqPlatform], [svcCtrBRecBuyer, svcCtrBRecPlatform], '2026-04-10T14:00:30Z')

const svcDocs: TransactionDocument[] = [
  {
    id: svcLicenceId,
    transactionId: 'txn-svc-001',
    typeId: 'standard_editorial_licence',
    status: 'preview_ready',
    documentRef: 'FF-LIC-2026-00912',
    issuedAt: null,
    counterparties: {
      party1: 'Dimitris Papadopoulos (creator)',
      party2: 'The Guardian News & Media (buyer)',
    },
    partySnapshots: [svcSnapCreator, svcSnapBuyer],
    signerRequirements: [svcLicReqCreator, svcLicReqBuyer],
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: 'site',
    licenceDetails: {
      licenceName: 'Frontfiles Standard Editorial Licence',
      usageClass: 'Editorial',
      mediumScope: 'Single medium',
      selectedMedium: 'site',
      term: '1 year',
      exclusivity: 'Non-exclusive',
      territory: 'Worldwide',
    },
    assetSchedule: ASSET_SCHEDULE_SVC,
    finance: null,
  },
  {
    id: svcCtrCreatorId,
    transactionId: 'txn-svc-001',
    typeId: 'contract_creator_frontfiles',
    status: 'finalized',
    documentRef: 'FF-CTR-C-2026-00912',
    issuedAt: '2026-04-10T14:00:00Z',
    counterparties: {
      party1: 'Dimitris Papadopoulos',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [svcCtrCSnapCreator, svcCtrCSnapPlatform],
    signerRequirements: [svcCtrCReqCreator, svcCtrCReqPlatform],
    evidenceBundle: svcCtrCEvidence,
    contentHash: svcCtrCHash,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_SVC,
    finance: null,
  },
  {
    id: svcCtrBuyerId,
    transactionId: 'txn-svc-001',
    typeId: 'contract_buyer_frontfiles',
    status: 'finalized',
    documentRef: 'FF-CTR-B-2026-00912',
    issuedAt: '2026-04-10T14:00:00Z',
    counterparties: {
      party1: 'The Guardian News & Media',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [svcCtrBSnapBuyer, svcCtrBSnapPlatform],
    signerRequirements: [svcCtrBReqBuyer, svcCtrBReqPlatform],
    evidenceBundle: svcCtrBEvidence,
    contentHash: svcCtrBHash,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_SVC,
    finance: null,
  },
  {
    id: makeDocId('svc-001', 'inv-buyer'),
    transactionId: 'txn-svc-001',
    typeId: 'invoice_buyer',
    status: 'pending',
    documentRef: null,
    issuedAt: null,
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'The Guardian News & Media',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: null,
      receiptId: null,
      amountCents: 44000,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Platform fee — buyer markup (10% of €2,000.00)', amountCents: 20000 },
        { description: 'Processing fee', amountCents: 4000 },
        { description: 'VAT (20%)', amountCents: 20000 },
      ],
    },
  },
  {
    id: makeDocId('svc-001', 'inv-creator'),
    transactionId: 'txn-svc-001',
    typeId: 'invoice_creator',
    status: 'pending',
    documentRef: null,
    issuedAt: null,
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'Dimitris Papadopoulos',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: null,
      receiptId: null,
      amountCents: 40000,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Platform fee — creator commission (20% of €2,000.00)', amountCents: 40000 },
      ],
    },
  },
  {
    id: makeDocId('svc-001', 'receipt-buyer'),
    transactionId: 'txn-svc-001',
    typeId: 'receipt_buyer',
    status: 'pending',
    documentRef: null,
    issuedAt: null,
    counterparties: {
      party1: 'Dimitris Papadopoulos (via Frontfiles)',
      party2: 'The Guardian News & Media',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: null,
      receiptId: null,
      amountCents: 220000,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Fixer/logistics — Evros border 5-day assignment', amountCents: 200000 },
        { description: 'Buyer platform fee (10%)', amountCents: 20000 },
      ],
    },
  },
]

export const serviceDocumentSet: TransactionDocumentSet = {
  transactionId: 'txn-svc-001',
  assignmentId: 'asgn-svc-001',
  assetRef: 'Fixer/logistics — Evros border coverage, 5 days',
  assetSchedule: ASSET_SCHEDULE_SVC,
  documents: svcDocs,
  buyerPackDocumentIds: [
    makeDocId('svc-001', 'licence'),
    makeDocId('svc-001', 'contract-buyer'),
    makeDocId('svc-001', 'inv-buyer'),
    makeDocId('svc-001', 'receipt-buyer'),
  ],
  creatorPackDocumentIds: [
    makeDocId('svc-001', 'licence'),
    makeDocId('svc-001', 'contract-creator'),
    makeDocId('svc-001', 'inv-creator'),
  ],
  allFinalized: false,
  allSigned: false,
  createdAt: '2026-04-10T14:00:00Z',
}

// ══════════════════════════════════════════════
// 3. HYBRID ASSIGNMENT — asgn-hyb-001
//    Buyer: Expresso | Creator: Ana Sousa
//    All documents preview-ready (pre-finalization)
//    Signatures all pending
//    Medium: magazine
// ══════════════════════════════════════════════

const hybLicenceId = makeDocId('hyb-001', 'licence')
const hybCtrCreatorId = makeDocId('hyb-001', 'contract-creator')
const hybCtrBuyerId = makeDocId('hyb-001', 'contract-buyer')

// Snapshots
const hybSnapCreator = makeSnapshot(hybLicenceId, makeSnapshotId('hyb-001', 'creator'), IDENTITY_ANA_SOUSA, '2026-04-10T15:55:00Z')
const hybSnapBuyer = makeSnapshot(hybLicenceId, makeSnapshotId('hyb-001', 'buyer'), IDENTITY_EXPRESSO, '2026-04-10T15:55:00Z')

// All signer requirements pending
const hybLicReqCreator = makeSignerReq(makeSignReqId('hyb-001', 'lic-creator'), hybLicenceId, hybSnapCreator.id, 'creator', 'Creator signature', 1, 'required')
const hybLicReqBuyer = makeSignerReq(makeSignReqId('hyb-001', 'lic-buyer'), hybLicenceId, hybSnapBuyer.id, 'buyer_representative', 'Buyer signature', 2, 'required')

const hybCtrCSnapCreator = makeSnapshot(hybCtrCreatorId, makeSnapshotId('hyb-001', 'ctr-c-creator'), IDENTITY_ANA_SOUSA, '2026-04-10T15:55:00Z')
const hybCtrCSnapPlatform = makeSnapshot(hybCtrCreatorId, makeSnapshotId('hyb-001', 'ctr-c-platform'), IDENTITY_FRONTFILES, '2026-04-10T15:55:00Z')
const hybCtrCReqCreator = makeSignerReq(makeSignReqId('hyb-001', 'ctr-c-creator'), hybCtrCreatorId, hybCtrCSnapCreator.id, 'creator', 'Creator signature', 1, 'required')
const hybCtrCReqPlatform = makeSignerReq(makeSignReqId('hyb-001', 'ctr-c-platform'), hybCtrCreatorId, hybCtrCSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'required')

const hybCtrBSnapBuyer = makeSnapshot(hybCtrBuyerId, makeSnapshotId('hyb-001', 'ctr-b-buyer'), IDENTITY_EXPRESSO, '2026-04-10T15:55:00Z')
const hybCtrBSnapPlatform = makeSnapshot(hybCtrBuyerId, makeSnapshotId('hyb-001', 'ctr-b-platform'), IDENTITY_FRONTFILES, '2026-04-10T15:55:00Z')
const hybCtrBReqBuyer = makeSignerReq(makeSignReqId('hyb-001', 'ctr-b-buyer'), hybCtrBuyerId, hybCtrBSnapBuyer.id, 'buyer_representative', 'Buyer signature', 1, 'required')
const hybCtrBReqPlatform = makeSignerReq(makeSignReqId('hyb-001', 'ctr-b-platform'), hybCtrBuyerId, hybCtrBSnapPlatform.id, 'platform', 'Frontfiles signature', 2, 'required')

const hybDocs: TransactionDocument[] = [
  {
    id: hybLicenceId,
    transactionId: 'txn-hyb-001',
    typeId: 'standard_editorial_licence',
    status: 'preview_ready',
    documentRef: 'FF-LIC-2026-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Ana Sousa (creator)',
      party2: 'Expresso / Impresa SGPS (buyer)',
    },
    partySnapshots: [hybSnapCreator, hybSnapBuyer],
    signerRequirements: [hybLicReqCreator, hybLicReqBuyer],
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: 'magazine',
    licenceDetails: {
      licenceName: 'Frontfiles Standard Editorial Licence',
      usageClass: 'Editorial',
      mediumScope: 'Single medium',
      selectedMedium: 'magazine',
      term: '1 year',
      exclusivity: 'Non-exclusive',
      territory: 'Portugal + PALOP',
    },
    assetSchedule: ASSET_SCHEDULE_HYB,
    finance: null,
  },
  {
    id: hybCtrCreatorId,
    transactionId: 'txn-hyb-001',
    typeId: 'contract_creator_frontfiles',
    status: 'preview_ready',
    documentRef: 'FF-CTR-C-2026-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Ana Sousa',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [hybCtrCSnapCreator, hybCtrCSnapPlatform],
    signerRequirements: [hybCtrCReqCreator, hybCtrCReqPlatform],
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_HYB,
    finance: null,
  },
  {
    id: hybCtrBuyerId,
    transactionId: 'txn-hyb-001',
    typeId: 'contract_buyer_frontfiles',
    status: 'preview_ready',
    documentRef: 'FF-CTR-B-2026-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Expresso / Impresa SGPS',
      party2: 'Frontfiles Ltd',
    },
    partySnapshots: [hybCtrBSnapBuyer, hybCtrBSnapPlatform],
    signerRequirements: [hybCtrBReqBuyer, hybCtrBReqPlatform],
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: ASSET_SCHEDULE_HYB,
    finance: null,
  },
  {
    id: makeDocId('hyb-001', 'inv-buyer'),
    transactionId: 'txn-hyb-001',
    typeId: 'invoice_buyer',
    status: 'preview_ready',
    documentRef: 'INV-B-2026-04-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'Expresso / Impresa SGPS',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: 'INV-B-2026-04-01034',
      receiptId: null,
      amountCents: 57200,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Platform fee — buyer markup (10% of €2,600.00)', amountCents: 26000 },
        { description: 'Processing fee', amountCents: 5200 },
        { description: 'VAT (20%)', amountCents: 26000 },
      ],
    },
  },
  {
    id: makeDocId('hyb-001', 'inv-creator'),
    transactionId: 'txn-hyb-001',
    typeId: 'invoice_creator',
    status: 'preview_ready',
    documentRef: 'INV-C-2026-04-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Frontfiles Ltd',
      party2: 'Ana Sousa',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: 'INV-C-2026-04-01034',
      receiptId: null,
      amountCents: 52000,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Platform fee — creator commission (20% of €2,600.00)', amountCents: 52000 },
      ],
    },
  },
  {
    id: makeDocId('hyb-001', 'receipt-buyer'),
    transactionId: 'txn-hyb-001',
    typeId: 'receipt_buyer',
    status: 'preview_ready',
    documentRef: 'RCT-2026-04-01034',
    issuedAt: null,
    counterparties: {
      party1: 'Ana Sousa (via Frontfiles)',
      party2: 'Expresso / Impresa SGPS',
    },
    partySnapshots: null,
    signerRequirements: null,
    evidenceBundle: null,
    contentHash: null,
    licenceMedium: null,
    licenceDetails: null,
    assetSchedule: null,
    finance: {
      invoiceId: null,
      receiptId: 'RCT-2026-04-01034',
      amountCents: 286000,
      currency: 'EUR',
      issueDate: null,
      paymentDate: null,
      lineItems: [
        { description: 'Lisbon housing crisis — interviews + photo essay + 2 videos', amountCents: 260000 },
        { description: 'Buyer platform fee (10%)', amountCents: 26000 },
      ],
    },
  },
]

export const hybridDocumentSet: TransactionDocumentSet = {
  transactionId: 'txn-hyb-001',
  assignmentId: 'asgn-hyb-001',
  assetRef: 'Lisbon housing crisis — interviews, photo essay, 2 videos',
  assetSchedule: ASSET_SCHEDULE_HYB,
  documents: hybDocs,
  buyerPackDocumentIds: [
    makeDocId('hyb-001', 'licence'),
    makeDocId('hyb-001', 'contract-buyer'),
    makeDocId('hyb-001', 'inv-buyer'),
    makeDocId('hyb-001', 'receipt-buyer'),
  ],
  creatorPackDocumentIds: [
    makeDocId('hyb-001', 'licence'),
    makeDocId('hyb-001', 'contract-creator'),
    makeDocId('hyb-001', 'inv-creator'),
  ],
  allFinalized: false,
  allSigned: false,
  createdAt: '2026-04-10T16:00:00Z',
}

// ══════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════

export const mockDocumentSets: TransactionDocumentSet[] = [
  materialDocumentSet,
  serviceDocumentSet,
  hybridDocumentSet,
]

export const mockDocumentSetByAssignment: Record<string, TransactionDocumentSet> =
  Object.fromEntries(mockDocumentSets.map(ds => [ds.assignmentId, ds]))
