/**
 * Assignment Engine — Mock Data
 *
 * Three canonical scenarios:
 * 1. Material — photo assignment, 2 milestones, first accepted, second in review
 * 2. Service — fixer/logistics assignment, 3 milestones, in progress
 * 3. Hybrid — field coverage + edited packages, 2 milestones, with CCR history
 */

import type {
  Assignment,
  AssignmentPlan,
  Milestone,
  FulfilmentSubmission,
  EvidenceItem,
  ServiceLog,
  AssignmentRightsRecord,
  EscrowRecord,
  CommissionChangeRequest,
} from '@/lib/types'

// ══════════════════════════════════════════════
// 1. MATERIAL ASSIGNMENT — Photo coverage of flood recovery
// ══════════════════════════════════════════════

export const materialAssignment: Assignment = {
  id: 'asgn-mat-001',
  buyerId: 'buyer-reuters-01',
  creatorId: 'creator-marco-01',
  assignmentClass: 'material',
  state: 'delivered',
  subState: 'review_open',
  plan: {
    scope: 'Commissioned photo coverage of flood recovery operations in Porto Alegre metropolitan area. Minimum 25 editorial-quality photographs documenting relief efforts, temporary shelters, infrastructure damage assessment, and community recovery.',
    deadline: '2026-05-01T23:59:00Z',
    acceptanceCriteria: 'Minimum 25 photographs at editorial resolution. Geographic metadata present. Subjects relevant to flood recovery scope. No staged or re-enacted scenes.',
    requiredEvidenceTypes: ['vault_asset'],
    reviewWindowDays: 5,
    notes: 'Creator has prior access to affected areas via press accreditation.',
  },
  milestones: [
    {
      id: 'ms-mat-001-1',
      assignmentId: 'asgn-mat-001',
      ordinal: 1,
      title: 'Initial field coverage',
      scopeSummary: 'First batch: 12+ photographs from relief staging areas and temporary shelters.',
      milestoneType: 'material',
      state: 'accepted',
      dueDate: '2026-04-15T23:59:00Z',
      acceptanceCriteria: '12+ photos, geographic metadata, editorial quality.',
      requiredEvidenceTypes: ['vault_asset'],
      releasableAmountCents: 120000, // €1,200
      partialAcceptancePermitted: false,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [
        {
          id: 'fs-mat-001-1-1',
          milestoneId: 'ms-mat-001-1',
          fulfilmentType: 'asset',
          evidenceItems: [
            { id: 'ev-001', kind: 'vault_asset', label: 'Flood relief staging area — aerial', description: null, vaultAssetId: 'asset-flood-001', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:30:00Z' },
            { id: 'ev-002', kind: 'vault_asset', label: 'Temporary shelter interior — families', description: null, vaultAssetId: 'asset-flood-002', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:31:00Z' },
            { id: 'ev-003', kind: 'vault_asset', label: 'Infrastructure damage — bridge collapse', description: null, vaultAssetId: 'asset-flood-003', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:32:00Z' },
            { id: 'ev-004', kind: 'vault_asset', label: 'Relief workers — supply distribution', description: null, vaultAssetId: 'asset-flood-004', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:33:00Z' },
            { id: 'ev-005', kind: 'vault_asset', label: 'Community volunteer effort', description: null, vaultAssetId: 'asset-flood-005', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:34:00Z' },
            { id: 'ev-006', kind: 'vault_asset', label: 'Flooded residential street', description: null, vaultAssetId: 'asset-flood-006', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:35:00Z' },
            { id: 'ev-007', kind: 'vault_asset', label: 'Emergency medical tent', description: null, vaultAssetId: 'asset-flood-007', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:36:00Z' },
            { id: 'ev-008', kind: 'vault_asset', label: 'Aerial — extent of flooding', description: null, vaultAssetId: 'asset-flood-008', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:37:00Z' },
            { id: 'ev-009', kind: 'vault_asset', label: 'Press briefing — municipal authorities', description: null, vaultAssetId: 'asset-flood-009', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:38:00Z' },
            { id: 'ev-010', kind: 'vault_asset', label: 'Children at temporary school', description: null, vaultAssetId: 'asset-flood-010', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:39:00Z' },
            { id: 'ev-011', kind: 'vault_asset', label: 'Water rescue operation', description: null, vaultAssetId: 'asset-flood-011', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:40:00Z' },
            { id: 'ev-012', kind: 'vault_asset', label: 'Shelter exterior — night', description: null, vaultAssetId: 'asset-flood-012', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-13T10:41:00Z' },
          ],
          creatorNotes: 'First batch of 12 images from the Porto Alegre metropolitan flood zone. All shot between April 10-13. GPS metadata embedded.',
          submittedAt: '2026-04-13T14:00:00Z',
        },
      ],
      reviewDetermination: {
        id: 'rev-mat-001-1',
        milestoneId: 'ms-mat-001-1',
        reviewerId: 'buyer-reuters-01',
        reviewerRole: 'content_commit_holder',
        determination: 'accepted',
        acceptedAmountCents: null,
        notes: 'All 12 images meet editorial quality standards. Geographic coverage is comprehensive for the staging area scope.',
        evidenceBasis: '12 Vault-linked assets reviewed. Geographic metadata verified. Subjects match scope.',
        createdAt: '2026-04-14T09:00:00Z',
      },
      createdAt: '2026-04-01T10:00:00Z',
      completedAt: '2026-04-14T09:00:00Z',
    },
    {
      id: 'ms-mat-001-2',
      assignmentId: 'asgn-mat-001',
      ordinal: 2,
      title: 'Recovery and community impact',
      scopeSummary: 'Second batch: 13+ photographs documenting community recovery, infrastructure repair, and long-term impact.',
      milestoneType: 'material',
      state: 'fulfilment_submitted',
      dueDate: '2026-05-01T23:59:00Z',
      acceptanceCriteria: '13+ photos, geographic metadata, editorial quality, focus on recovery narrative.',
      requiredEvidenceTypes: ['vault_asset'],
      releasableAmountCents: 130000, // €1,300
      partialAcceptancePermitted: true,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [
        {
          id: 'fs-mat-001-2-1',
          milestoneId: 'ms-mat-001-2',
          fulfilmentType: 'asset',
          evidenceItems: [
            { id: 'ev-020', kind: 'vault_asset', label: 'Reconstruction — residential block', description: null, vaultAssetId: 'asset-flood-020', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-28T16:00:00Z' },
            { id: 'ev-021', kind: 'vault_asset', label: 'Community kitchen — volunteers', description: null, vaultAssetId: 'asset-flood-021', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-28T16:01:00Z' },
            { id: 'ev-022', kind: 'vault_asset', label: 'School reopening ceremony', description: null, vaultAssetId: 'asset-flood-022', fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: null, createdAt: '2026-04-28T16:02:00Z' },
          ],
          creatorNotes: 'Initial submission for milestone 2. 3 of 13 complete. Remaining images due by April 30.',
          submittedAt: '2026-04-28T18:00:00Z',
        },
      ],
      reviewDetermination: null,
      createdAt: '2026-04-01T10:00:00Z',
      completedAt: null,
    },
  ],
  rightsRecord: {
    assetRights: {
      usageRights: 'Non-exclusive editorial licence. Buyer may publish across owned editorial properties.',
      exclusivityTerms: '72-hour exclusivity window from delivery confirmation.',
      permittedModifications: 'Cropping and colour correction permitted. No compositing or AI alteration.',
      duration: '2 years from delivery confirmation.',
      territory: 'Worldwide.',
      publicationScope: 'Editorial use only. Not for advertising, promotional, or commercial reuse.',
    },
    serviceTerms: null,
  },
  escrow: {
    stripePaymentIntentId: 'pi_mock_mat_001',
    totalCapturedCents: 275000, // €2,750 (€2,500 + 10% markup)
    totalReleasedCents: 120000,
    totalRefundedCents: 0,
    totalFrozenCents: 0,
    capturedAt: '2026-04-02T08:00:00Z',
  },
  ccrHistory: [],
  createdAt: '2026-04-01T10:00:00Z',
  acceptedAt: '2026-04-01T16:00:00Z',
  completedAt: null,
  cancelledAt: null,
}

// ══════════════════════════════════════════════
// 2. SERVICE ASSIGNMENT — Fixer/logistics for Greece border coverage
// ══════════════════════════════════════════════

export const serviceAssignment: Assignment = {
  id: 'asgn-svc-001',
  buyerId: 'buyer-guardian-01',
  creatorId: 'creator-dimitris-01',
  assignmentClass: 'service',
  state: 'in_progress',
  subState: 'active',
  plan: {
    scope: 'Provide fixering, translation (Greek/English), and logistics coordination for a 5-day field reporting trip covering migrant reception conditions at the Evros border region. Duties include: local transport arrangement, interpreter services during interviews, government office liaison for press accreditation, and safety assessment of field locations.',
    deadline: '2026-04-25T23:59:00Z',
    acceptanceCriteria: 'Daily service logs with time, location, and completed duties. Handoff notes at end of each day. Final debrief document.',
    requiredEvidenceTypes: ['service_log', 'handoff_note', 'attendance_confirmation'],
    reviewWindowDays: 5,
    notes: 'Creator has existing local press contacts and familiarity with the region.',
  },
  milestones: [
    {
      id: 'ms-svc-001-1',
      assignmentId: 'asgn-svc-001',
      ordinal: 1,
      title: 'Pre-trip logistics and accreditation',
      scopeSummary: 'Arrange transport, accommodation, and press accreditation before field days begin.',
      milestoneType: 'service',
      state: 'accepted',
      dueDate: '2026-04-18T23:59:00Z',
      acceptanceCriteria: 'Confirmed transport booking, accommodation details, accreditation application submitted or confirmed.',
      requiredEvidenceTypes: ['service_log', 'support_document'],
      releasableAmountCents: 40000, // €400
      partialAcceptancePermitted: false,
      reviewWindowDays: 3,
      fulfilmentSubmissions: [
        {
          id: 'fs-svc-001-1-1',
          milestoneId: 'ms-svc-001-1',
          fulfilmentType: 'service',
          evidenceItems: [
            { id: 'ev-svc-001', kind: 'service_log', label: 'Logistics coordination — April 16', description: null, vaultAssetId: null, fileRef: null, fileName: null, fileSizeBytes: null, serviceLog: { date: '2026-04-16', startTime: '09:00', endTime: '17:00', location: 'Alexandroupoli', role: 'Fixer/logistics coordinator', completedDuties: 'Confirmed vehicle rental (4x4 SUV). Booked accommodation at Hotel Thraki for 5 nights. Contacted Prefecture press office for accreditation paperwork.' }, createdAt: '2026-04-16T18:00:00Z' },
            { id: 'ev-svc-002', kind: 'support_document', label: 'Vehicle rental confirmation', description: 'Europcar booking ref. EU-38291', vaultAssetId: null, fileRef: '/uploads/svc-001/vehicle-booking.pdf', fileName: 'vehicle-booking.pdf', fileSizeBytes: 142000, serviceLog: null, createdAt: '2026-04-16T18:05:00Z' },
            { id: 'ev-svc-003', kind: 'support_document', label: 'Accommodation confirmation', description: 'Hotel Thraki, 5 nights, twin room', vaultAssetId: null, fileRef: '/uploads/svc-001/hotel-booking.pdf', fileName: 'hotel-booking.pdf', fileSizeBytes: 98000, serviceLog: null, createdAt: '2026-04-16T18:06:00Z' },
            { id: 'ev-svc-004', kind: 'support_document', label: 'Press accreditation application', description: 'Submitted to Evros Prefecture press office', vaultAssetId: null, fileRef: '/uploads/svc-001/accreditation-app.pdf', fileName: 'accreditation-app.pdf', fileSizeBytes: 210000, serviceLog: null, createdAt: '2026-04-17T10:00:00Z' },
          ],
          creatorNotes: 'All pre-trip logistics confirmed. Accreditation application submitted — confirmation expected within 24h.',
          submittedAt: '2026-04-17T12:00:00Z',
        },
      ],
      reviewDetermination: {
        id: 'rev-svc-001-1',
        milestoneId: 'ms-svc-001-1',
        reviewerId: 'buyer-guardian-01',
        reviewerRole: 'editor',
        determination: 'accepted',
        acceptedAmountCents: null,
        notes: 'Logistics confirmed. Accreditation pending but application looks complete.',
        evidenceBasis: 'Service log, 3 support documents reviewed.',
        createdAt: '2026-04-17T16:00:00Z',
      },
      createdAt: '2026-04-10T10:00:00Z',
      completedAt: '2026-04-17T16:00:00Z',
    },
    {
      id: 'ms-svc-001-2',
      assignmentId: 'asgn-svc-001',
      ordinal: 2,
      title: 'Field days 1-3: translation and access',
      scopeSummary: 'On-ground fixering during first 3 field days. Translation during interviews, local navigation, safety oversight.',
      milestoneType: 'service',
      state: 'active',
      dueDate: '2026-04-22T23:59:00Z',
      acceptanceCriteria: 'Daily service logs with hours, location, duties. At least 1 handoff note per day.',
      requiredEvidenceTypes: ['service_log', 'handoff_note'],
      releasableAmountCents: 90000, // €900
      partialAcceptancePermitted: true,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-10T10:00:00Z',
      completedAt: null,
    },
    {
      id: 'ms-svc-001-3',
      assignmentId: 'asgn-svc-001',
      ordinal: 3,
      title: 'Field days 4-5 and debrief',
      scopeSummary: 'Final 2 field days plus written debrief document summarising contacts, locations visited, and follow-up recommendations.',
      milestoneType: 'service',
      state: 'pending',
      dueDate: '2026-04-25T23:59:00Z',
      acceptanceCriteria: 'Daily service logs. Handoff notes. Final debrief document (min. 500 words).',
      requiredEvidenceTypes: ['service_log', 'handoff_note', 'support_document'],
      releasableAmountCents: 70000, // €700
      partialAcceptancePermitted: false,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-10T10:00:00Z',
      completedAt: null,
    },
  ],
  rightsRecord: {
    assetRights: null,
    serviceTerms: {
      scopeOfWork: 'Fixering, translation (Greek/English), logistics coordination, local press liaison, safety assessment.',
      confidentiality: 'All source identities and interview locations are confidential unless the source provides written consent.',
      attendanceObligations: 'Available 08:00–20:00 local time during the 5 field days. On-call for urgent logistical needs outside these hours.',
      operationalRestrictions: 'Must not independently publish or share any information gathered during the assignment.',
      reimbursementTerms: 'Fuel and tolls reimbursed at actual cost with receipts. Meals included in daily rate.',
      liabilityFraming: 'Creator assumes no liability for access denial by authorities. Best-effort basis for press accreditation.',
    },
  },
  escrow: {
    stripePaymentIntentId: 'pi_mock_svc_001',
    totalCapturedCents: 220000, // €2,200 (€2,000 + 10% markup)
    totalReleasedCents: 40000,
    totalRefundedCents: 0,
    totalFrozenCents: 0,
    capturedAt: '2026-04-11T08:00:00Z',
  },
  ccrHistory: [],
  createdAt: '2026-04-10T10:00:00Z',
  acceptedAt: '2026-04-10T14:00:00Z',
  completedAt: null,
  cancelledAt: null,
}

// ══════════════════════════════════════════════
// 3. HYBRID ASSIGNMENT — Field coverage + edited packages
// ══════════════════════════════════════════════

export const hybridAssignment: Assignment = {
  id: 'asgn-hyb-001',
  buyerId: 'buyer-dw-01',
  creatorId: 'creator-ana-01',
  assignmentClass: 'hybrid',
  state: 'in_progress',
  subState: 'ccr_pending',
  plan: {
    scope: 'Coverage of Lisbon housing crisis: 3 days of field interviews (service component) plus a curated 20-image photo essay and 2 short-form video packages (material component). Service includes interview coordination, local source introductions, and location scouting.',
    deadline: '2026-05-10T23:59:00Z',
    acceptanceCriteria: 'Service: daily logs + interview notes. Material: 20+ editorial photos with metadata, 2 video packages (each 90-120s, captioned).',
    requiredEvidenceTypes: ['vault_asset', 'service_log', 'handoff_note'],
    reviewWindowDays: 7,
    notes: 'Creator is based in Lisbon and has established contacts in housing advocacy organisations.',
  },
  milestones: [
    {
      id: 'ms-hyb-001-1',
      assignmentId: 'asgn-hyb-001',
      ordinal: 1,
      title: 'Service: field interviews and source coordination',
      scopeSummary: '3 days of interview coordination, source introductions, and location scouting in Lisbon neighbourhoods.',
      milestoneType: 'service',
      state: 'active',
      dueDate: '2026-04-30T23:59:00Z',
      acceptanceCriteria: 'Daily service logs. Interview scheduling notes. At least 6 confirmed interview subjects.',
      requiredEvidenceTypes: ['service_log', 'handoff_note'],
      releasableAmountCents: 80000, // €800
      partialAcceptancePermitted: true,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-05T10:00:00Z',
      completedAt: null,
    },
    {
      id: 'ms-hyb-001-2',
      assignmentId: 'asgn-hyb-001',
      ordinal: 2,
      title: 'Material: photo essay and video packages',
      scopeSummary: '20+ curated editorial photographs and 2 short-form video packages (90-120s each, captioned).',
      milestoneType: 'material',
      state: 'pending',
      dueDate: '2026-05-10T23:59:00Z',
      acceptanceCriteria: '20+ photos at editorial resolution. 2 video packages with captions. Geographic metadata on all assets.',
      requiredEvidenceTypes: ['vault_asset'],
      releasableAmountCents: 180000, // €1,800
      partialAcceptancePermitted: true,
      reviewWindowDays: 7,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-05T10:00:00Z',
      completedAt: null,
    },
  ],
  rightsRecord: {
    assetRights: {
      usageRights: 'Non-exclusive editorial licence for photo essay and video packages.',
      exclusivityTerms: '48-hour exclusivity from delivery confirmation.',
      permittedModifications: 'Cropping, colour grading, and subtitle overlay permitted. No AI modification.',
      duration: '1 year from delivery confirmation.',
      territory: 'EU and UK.',
      publicationScope: 'Editorial publication across DW digital and broadcast channels.',
    },
    serviceTerms: {
      scopeOfWork: 'Interview coordination, source introductions, location scouting across Lisbon neighbourhoods.',
      confidentiality: 'Source identities protected unless written consent obtained.',
      attendanceObligations: 'Available during agreed field days, 08:00-19:00 local time.',
      operationalRestrictions: 'No independent publication of interview content or source contacts.',
      reimbursementTerms: 'Local transport reimbursed at actual cost.',
      liabilityFraming: 'Best-effort basis for source availability.',
    },
  },
  escrow: {
    stripePaymentIntentId: 'pi_mock_hyb_001',
    totalCapturedCents: 286000, // €2,860 (€2,600 + 10% markup)
    totalReleasedCents: 0,
    totalRefundedCents: 0,
    totalFrozenCents: 0,
    capturedAt: '2026-04-06T08:00:00Z',
  },
  ccrHistory: [
    {
      id: 'ccr-hyb-001-1',
      assignmentId: 'asgn-hyb-001',
      requesterId: 'creator-ana-01',
      state: 'pending',
      amendedFields: [
        { field: 'deadline', currentValue: '2026-05-10', proposedValue: '2026-05-17' },
        { field: 'scope', currentValue: '20+ editorial photographs', proposedValue: '25+ editorial photographs (expanded to include Alfama and Mouraria neighbourhoods)' },
        { field: 'price', currentValue: '€2,600', proposedValue: '€2,900 (+€300 for expanded geographic scope)' },
      ],
      rationale: 'Two additional neighbourhoods (Alfama and Mouraria) have become relevant due to recent eviction actions. Expanding scope would strengthen the essay but requires additional field days and budget.',
      responseDeadline: '2026-04-16T23:59:00Z',
      respondedAt: null,
      responseNote: null,
      createdAt: '2026-04-09T11:00:00Z',
    },
  ],
  createdAt: '2026-04-05T10:00:00Z',
  acceptedAt: '2026-04-05T15:00:00Z',
  completedAt: null,
  cancelledAt: null,
}

// ══════════════════════════════════════════════
// 4. PENDING FUNDING — Accepted brief awaiting escrow capture
// ══════════════════════════════════════════════

export const pendingFundingAssignment: Assignment = {
  id: 'asgn-fund-001',
  buyerId: 'buyer-ap-01',
  creatorId: 'creator-sofia-01',
  assignmentClass: 'material',
  state: 'brief_issued',
  subState: 'accepted_pending_escrow',
  plan: {
    scope: 'Commissioned photo coverage of the EU Parliament spring session debates in Strasbourg. Minimum 15 editorial-quality photographs documenting plenary sessions, committee meetings, and corridor diplomacy.',
    deadline: '2026-05-15T23:59:00Z',
    acceptanceCriteria: 'Minimum 15 photographs at editorial resolution. Chamber and committee access confirmed. No staged or posed shots.',
    requiredEvidenceTypes: ['vault_asset'],
    reviewWindowDays: 5,
    notes: 'Creator holds EU Parliament press accreditation (valid through 2027).',
  },
  milestones: [
    {
      id: 'ms-fund-001-1',
      assignmentId: 'asgn-fund-001',
      ordinal: 1,
      title: 'Plenary session coverage',
      scopeSummary: 'First batch: 8+ photographs from plenary debates and key votes.',
      milestoneType: 'material',
      state: 'pending',
      dueDate: '2026-05-08T23:59:00Z',
      acceptanceCriteria: '8+ photos from plenary sessions. Subject identification in metadata.',
      requiredEvidenceTypes: ['vault_asset'],
      releasableAmountCents: 80000, // €800
      partialAcceptancePermitted: false,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-10T10:00:00Z',
      completedAt: null,
    },
    {
      id: 'ms-fund-001-2',
      assignmentId: 'asgn-fund-001',
      ordinal: 2,
      title: 'Committee and corridor coverage',
      scopeSummary: 'Second batch: 7+ photographs from committee meetings and corridor interactions.',
      milestoneType: 'material',
      state: 'pending',
      dueDate: '2026-05-15T23:59:00Z',
      acceptanceCriteria: '7+ photos from committee sessions and informal meetings.',
      requiredEvidenceTypes: ['vault_asset'],
      releasableAmountCents: 70000, // €700
      partialAcceptancePermitted: true,
      reviewWindowDays: 5,
      fulfilmentSubmissions: [],
      reviewDetermination: null,
      createdAt: '2026-04-10T10:00:00Z',
      completedAt: null,
    },
  ],
  rightsRecord: {
    assetRights: {
      usageRights: 'Non-exclusive editorial licence. Buyer may publish across owned wire service properties.',
      exclusivityTerms: '48-hour exclusivity window from delivery confirmation.',
      permittedModifications: 'Cropping and colour correction permitted. No compositing or AI alteration.',
      duration: '1 year from delivery confirmation.',
      territory: 'Worldwide.',
      publicationScope: 'Editorial wire service distribution. Not for advertising or promotional use.',
    },
    serviceTerms: null,
  },
  escrow: {
    stripePaymentIntentId: null,
    totalCapturedCents: 0,
    totalReleasedCents: 0,
    totalRefundedCents: 0,
    totalFrozenCents: 0,
    capturedAt: null,
  },
  ccrHistory: [],
  createdAt: '2026-04-10T10:00:00Z',
  acceptedAt: '2026-04-12T14:00:00Z',
  completedAt: null,
  cancelledAt: null,
}

// ══════════════════════════════════════════════
// ALL MOCK ASSIGNMENTS
// ══════════════════════════════════════════════

export const mockAssignments: Assignment[] = [
  materialAssignment,
  serviceAssignment,
  hybridAssignment,
  pendingFundingAssignment,
]

export const mockAssignmentMap: Record<string, Assignment> = Object.fromEntries(
  mockAssignments.map(a => [a.id, a])
)
