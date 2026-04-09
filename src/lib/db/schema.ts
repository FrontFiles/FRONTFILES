/**
 * Assignment Engine — Database Row Types
 *
 * TypeScript types that mirror the PostgreSQL tables exactly.
 * These are the "database layer" types — they map 1:1 to SQL rows.
 * Domain-level types (Assignment, Milestone, etc.) live in lib/types.ts.
 *
 * When Supabase codegen is wired, this file can be replaced by the
 * generated Database type. Until then, these hand-written types
 * keep the store and query layer type-safe.
 *
 * Naming: TableNameRow (e.g. AssignmentRow, MilestoneRow).
 * Convention: snake_case column names match SQL exactly.
 */

import type {
  AssignmentClass,
  AssignmentState,
  AssignmentSubState,
  MilestoneType,
  MilestoneState,
  FulfilmentType,
  EvidenceItemKind,
  ReviewDetermination,
  CCRState,
  AssignmentDisputeTrigger,
  AssignmentDisputeScope,
  DisputeState,
  AssignmentDisputeResolution,
  BuyerCompanyRole,
  CertificationEventType,
} from '@/lib/types'

// ══════════════════════════════════════════════
// ROW TYPES — 1:1 with PostgreSQL tables
// ══════════════════════════════════════════════

export interface AssignmentRow {
  id: string
  buyer_id: string
  creator_id: string
  assignment_class: AssignmentClass
  state: AssignmentState
  sub_state: AssignmentSubState
  // Flattened AssignmentPlan
  scope: string
  deadline: string
  acceptance_criteria: string
  required_evidence_types: string[] // EvidenceItemKind values
  review_window_days: number
  plan_notes: string | null
  // Lifecycle
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface AssignmentRightsRecordRow {
  id: string
  assignment_id: string
  // Asset rights (NULL for pure service)
  asset_usage_rights: string | null
  asset_exclusivity_terms: string | null
  asset_permitted_modifications: string | null
  asset_duration: string | null
  asset_territory: string | null
  asset_publication_scope: string | null
  // Service terms (NULL for pure material)
  service_scope_of_work: string | null
  service_confidentiality: string | null
  service_attendance_obligations: string | null
  service_operational_restrictions: string | null
  service_reimbursement_terms: string | null
  service_liability_framing: string | null
  created_at: string
}

export interface EscrowRecordRow {
  id: string
  assignment_id: string
  stripe_payment_intent_id: string | null
  total_captured_cents: number
  total_released_cents: number
  total_refunded_cents: number
  total_frozen_cents: number
  captured_at: string | null
  created_at: string
}

export interface MilestoneRow {
  id: string
  assignment_id: string
  ordinal: number
  title: string
  scope_summary: string
  milestone_type: MilestoneType
  state: MilestoneState
  due_date: string
  acceptance_criteria: string
  required_evidence_types: string[] // EvidenceItemKind values
  releasable_amount_cents: number
  partial_acceptance_permitted: boolean
  review_window_days: number
  created_at: string
  completed_at: string | null
}

export interface FulfilmentSubmissionRow {
  id: string
  milestone_id: string
  fulfilment_type: FulfilmentType
  creator_notes: string | null
  submitted_at: string
}

export interface EvidenceItemRow {
  id: string
  fulfilment_submission_id: string
  kind: EvidenceItemKind
  label: string
  description: string | null
  vault_asset_id: string | null
  file_ref: string | null
  file_name: string | null
  file_size_bytes: number | null
  created_at: string
}

export interface ServiceLogRow {
  id: string
  evidence_item_id: string
  log_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  role: string
  completed_duties: string
}

export type ReviewerRole = BuyerCompanyRole | 'staff'

export interface ReviewRecordRow {
  id: string
  milestone_id: string
  reviewer_id: string
  reviewer_role: ReviewerRole
  determination: ReviewDetermination
  accepted_amount_cents: number | null
  notes: string
  evidence_basis: string
  created_at: string
}

export interface CommissionChangeRequestRow {
  id: string
  assignment_id: string
  requester_id: string
  state: CCRState
  rationale: string
  response_deadline: string
  responded_at: string | null
  response_note: string | null
  created_at: string
}

export interface CCRAmendedFieldRow {
  id: string
  ccr_id: string
  field: string
  current_value: string
  proposed_value: string
}

export type DisputeFilerRole = 'buyer' | 'creator'

export interface AssignmentDisputeCaseRow {
  id: string
  assignment_id: string
  milestone_id: string | null
  scope: AssignmentDisputeScope
  trigger: AssignmentDisputeTrigger
  state: DisputeState
  filer_id: string
  filer_role: DisputeFilerRole
  contested_amount_cents: number
  reason: string
  counter_evidence: string | null
  resolution: AssignmentDisputeResolution | null
  resolved_amount_cents: number | null
  staff_reviewer_id: string | null
  staff_notes: string | null
  filed_at: string
  counter_evidence_deadline: string | null
  resolved_at: string | null
  external_escalation_deadline: string | null
}

export interface AssignmentEventRow {
  id: string
  assignment_id: string
  milestone_id: string | null
  event_type: string // CertificationEventType — stored as text for extensibility
  description: string
  actor_id: string
  actor_role: string
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
}

// ══════════════════════════════════════════════
// TABLE NAME CONSTANTS
// ══════════════════════════════════════════════

export const TABLES = {
  assignments: 'assignments',
  assignment_rights_records: 'assignment_rights_records',
  escrow_records: 'escrow_records',
  milestones: 'milestones',
  fulfilment_submissions: 'fulfilment_submissions',
  evidence_items: 'evidence_items',
  service_logs: 'service_logs',
  review_records: 'review_records',
  commission_change_requests: 'commission_change_requests',
  ccr_amended_fields: 'ccr_amended_fields',
  assignment_dispute_cases: 'assignment_dispute_cases',
  assignment_events: 'assignment_events',
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]
