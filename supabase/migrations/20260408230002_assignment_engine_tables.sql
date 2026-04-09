-- ════════════════════════════════════════════════════════════════
-- Migration 2: Assignment Engine — Core Tables
--
-- All tables for the commissioned assignment domain.
-- Depends on: 20260408230001_assignment_engine_enums.sql
--
-- Money: stored as integer EUR cents (never decimal/float).
-- Timestamps: timestamptz, UTC.
-- IDs: uuid with gen_random_uuid() default.
-- Text arrays: text[] for multi-value enum-like fields stored as arrays.
--
-- Rollback: DROP TABLE in reverse dependency order (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. ASSIGNMENTS — Master contracted work record
-- TypeScript: Assignment + AssignmentPlan (flattened)
-- ──────────────────────────────────────────────

CREATE TABLE assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        uuid NOT NULL,
  creator_id      uuid NOT NULL,
  assignment_class assignment_class NOT NULL,
  state           assignment_state NOT NULL DEFAULT 'brief_issued',
  sub_state       assignment_sub_state NOT NULL DEFAULT 'draft',

  -- AssignmentPlan (flattened 1:1 — always read with assignment)
  scope           text NOT NULL,
  deadline        timestamptz NOT NULL,
  acceptance_criteria text NOT NULL,
  required_evidence_types text[] NOT NULL DEFAULT '{}',
  review_window_days integer NOT NULL DEFAULT 7,
  plan_notes      text,

  -- Lifecycle timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,

  -- Invariants
  CONSTRAINT assignments_deadline_future CHECK (deadline > created_at),
  CONSTRAINT assignments_review_window_positive CHECK (review_window_days > 0),
  CONSTRAINT assignments_accepted_after_created CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  CONSTRAINT assignments_completed_after_accepted CHECK (completed_at IS NULL OR completed_at >= accepted_at)
);

COMMENT ON TABLE assignments IS 'Master commissioned work contract between buyer and creator. System of record: Assignment Engine.';
COMMENT ON COLUMN assignments.scope IS 'Structured operating plan scope description.';
COMMENT ON COLUMN assignments.required_evidence_types IS 'Array of evidence_item_kind values required for fulfilment.';

-- ──────────────────────────────────────────────
-- 2. ASSIGNMENT_RIGHTS_RECORDS — Rights and terms (1:1)
-- TypeScript: AssignmentRightsRecord
-- ──────────────────────────────────────────────

CREATE TABLE assignment_rights_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,

  -- Asset rights (Material + Hybrid, NULL for pure Service)
  asset_usage_rights         text,
  asset_exclusivity_terms    text,
  asset_permitted_modifications text,
  asset_duration             text,
  asset_territory            text,
  asset_publication_scope    text,

  -- Service terms (Service + Hybrid, NULL for pure Material)
  service_scope_of_work      text,
  service_confidentiality    text,
  service_attendance_obligations text,
  service_operational_restrictions text,
  service_reimbursement_terms text,
  service_liability_framing  text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assignment_rights_records IS '1:1 rights and terms record. Asset rights NULL for service-only. Service terms NULL for material-only.';

-- ──────────────────────────────────────────────
-- 3. ESCROW_RECORDS — Platform mirror of Stripe escrow
-- TypeScript: EscrowRecord
-- Stripe Connect is authoritative; this is the Assignment Engine mirror.
-- ──────────────────────────────────────────────

CREATE TABLE escrow_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id           uuid NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE,  -- idempotent external sync reference
  total_captured_cents    integer NOT NULL DEFAULT 0,
  total_released_cents    integer NOT NULL DEFAULT 0,
  total_refunded_cents    integer NOT NULL DEFAULT 0,
  total_frozen_cents      integer NOT NULL DEFAULT 0,
  captured_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),

  -- Invariants: amounts cannot be negative
  CONSTRAINT escrow_captured_non_negative CHECK (total_captured_cents >= 0),
  CONSTRAINT escrow_released_non_negative CHECK (total_released_cents >= 0),
  CONSTRAINT escrow_refunded_non_negative CHECK (total_refunded_cents >= 0),
  CONSTRAINT escrow_frozen_non_negative CHECK (total_frozen_cents >= 0),
  -- Released + refunded + frozen cannot exceed captured
  CONSTRAINT escrow_balance_valid CHECK (
    total_released_cents + total_refunded_cents + total_frozen_cents <= total_captured_cents
  )
);

COMMENT ON TABLE escrow_records IS 'Platform mirror of Stripe Connect escrow. Stripe is authoritative.';
COMMENT ON COLUMN escrow_records.stripe_payment_intent_id IS 'Idempotent sync reference. UNIQUE constraint prevents double-capture.';

-- ──────────────────────────────────────────────
-- 4. MILESTONES — Contractual checkpoints
-- TypeScript: Milestone
-- ──────────────────────────────────────────────

CREATE TABLE milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  ordinal         integer NOT NULL,
  title           text NOT NULL,
  scope_summary   text NOT NULL,
  milestone_type  milestone_type NOT NULL,
  state           milestone_state NOT NULL DEFAULT 'pending',
  due_date        timestamptz NOT NULL,
  acceptance_criteria text NOT NULL,
  required_evidence_types text[] NOT NULL DEFAULT '{}',
  releasable_amount_cents integer NOT NULL,
  partial_acceptance_permitted boolean NOT NULL DEFAULT false,
  review_window_days integer NOT NULL DEFAULT 7,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,

  -- Unique ordinal per assignment
  CONSTRAINT milestones_ordinal_unique UNIQUE (assignment_id, ordinal),
  -- Money must be positive
  CONSTRAINT milestones_amount_positive CHECK (releasable_amount_cents >= 0),
  CONSTRAINT milestones_review_window_positive CHECK (review_window_days > 0)
);

COMMENT ON TABLE milestones IS 'Contractual checkpoint — smallest unit carrying scope, evidence, review, release, refund, or dispute logic.';

-- ──────────────────────────────────────────────
-- 5. FULFILMENT_SUBMISSIONS — Work packages against milestones
-- TypeScript: FulfilmentSubmission
-- ──────────────────────────────────────────────

CREATE TABLE fulfilment_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  fulfilment_type fulfilment_type NOT NULL,
  creator_notes   text,
  submitted_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fulfilment_submissions IS 'Structured submission package against a milestone.';

-- ──────────────────────────────────────────────
-- 6. EVIDENCE_ITEMS — Proof objects inside submissions
-- TypeScript: EvidenceItem
-- ──────────────────────────────────────────────

CREATE TABLE evidence_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfilment_submission_id uuid NOT NULL REFERENCES fulfilment_submissions(id) ON DELETE CASCADE,
  kind                    evidence_item_kind NOT NULL,
  label                   text NOT NULL,
  description             text,

  -- For vault_asset kind
  vault_asset_id          uuid,  -- FK to vault_assets when that table exists

  -- For document-based kinds
  file_ref                text,
  file_name               text,
  file_size_bytes         bigint,

  created_at              timestamptz NOT NULL DEFAULT now(),

  -- File size must be positive when present
  CONSTRAINT evidence_file_size_positive CHECK (file_size_bytes IS NULL OR file_size_bytes > 0)
);

COMMENT ON TABLE evidence_items IS 'Single proof object inside a fulfilment submission.';
COMMENT ON COLUMN evidence_items.vault_asset_id IS 'Reference to vault_assets table. FK added when vault_assets table is created.';

-- ──────────────────────────────────────────────
-- 7. SERVICE_LOGS — Structured service work records (1:1 with evidence_item)
-- TypeScript: ServiceLog
-- ──────────────────────────────────────────────

CREATE TABLE service_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL UNIQUE REFERENCES evidence_items(id) ON DELETE CASCADE,
  log_date        date NOT NULL,
  start_time      time,
  end_time        time,
  location        text,
  role            text NOT NULL,
  completed_duties text NOT NULL,

  -- End time must be after start time when both present
  CONSTRAINT service_logs_time_order CHECK (
    start_time IS NULL OR end_time IS NULL OR end_time > start_time
  )
);

COMMENT ON TABLE service_logs IS 'Structured record of service work performed. 1:1 with evidence_item when kind = service_log.';

-- ──────────────────────────────────────────────
-- 8. REVIEW_RECORDS — Fulfilment review outcomes
-- TypeScript: ReviewRecord
-- ──────────────────────────────────────────────

CREATE TABLE review_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL,
  reviewer_role   reviewer_role NOT NULL,
  determination   review_determination NOT NULL,
  accepted_amount_cents integer,  -- for partial release
  notes           text NOT NULL,
  evidence_basis  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Partial amount must be positive and only for accepted_partial
  CONSTRAINT review_partial_amount_check CHECK (
    (determination = 'accepted_partial' AND accepted_amount_cents IS NOT NULL AND accepted_amount_cents > 0)
    OR (determination != 'accepted_partial' AND accepted_amount_cents IS NULL)
  )
);

COMMENT ON TABLE review_records IS 'Recorded outcome of fulfilment review. Multiple reviews per milestone allowed (revision cycles).';

-- ──────────────────────────────────────────────
-- 9. COMMISSION_CHANGE_REQUESTS — Formal amendment requests
-- TypeScript: CommissionChangeRequest
-- ──────────────────────────────────────────────

CREATE TABLE commission_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  requester_id    uuid NOT NULL,
  state           ccr_state NOT NULL DEFAULT 'pending',
  rationale       text NOT NULL,
  response_deadline timestamptz NOT NULL,
  responded_at    timestamptz,
  response_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Response deadline must be after creation
  CONSTRAINT ccr_deadline_after_created CHECK (response_deadline > created_at)
);

COMMENT ON TABLE commission_change_requests IS 'Formal request to amend scope, price, timing. 5-business-day response window.';

-- ──────────────────────────────────────────────
-- 10. CCR_AMENDED_FIELDS — Per-field amendments in a CCR
-- TypeScript: CCRAmendedField
-- ──────────────────────────────────────────────

CREATE TABLE ccr_amended_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ccr_id          uuid NOT NULL REFERENCES commission_change_requests(id) ON DELETE CASCADE,
  field           text NOT NULL,
  current_value   text NOT NULL,
  proposed_value  text NOT NULL
);

COMMENT ON TABLE ccr_amended_fields IS 'Individual field-level amendment within a CCR.';

-- ──────────────────────────────────────────────
-- 11. ASSIGNMENT_DISPUTE_CASES — Dispute cases
-- TypeScript: AssignmentDisputeCase
-- Supports both milestone-level and assignment-level disputes.
-- ──────────────────────────────────────────────

CREATE TABLE assignment_dispute_cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  milestone_id    uuid REFERENCES milestones(id) ON DELETE SET NULL,  -- NULL = assignment-level
  scope           assignment_dispute_scope NOT NULL,
  trigger         assignment_dispute_trigger NOT NULL,
  state           dispute_state NOT NULL DEFAULT 'filed',
  filer_id        uuid NOT NULL,
  filer_role      dispute_filer_role NOT NULL,
  contested_amount_cents integer NOT NULL,
  reason          text NOT NULL,
  counter_evidence text,
  resolution      assignment_dispute_resolution,
  resolved_amount_cents integer,
  staff_reviewer_id uuid,
  staff_notes     text,
  filed_at        timestamptz NOT NULL DEFAULT now(),
  counter_evidence_deadline timestamptz,
  resolved_at     timestamptz,
  external_escalation_deadline timestamptz,

  -- Contested amount must be positive
  CONSTRAINT dispute_contested_positive CHECK (contested_amount_cents > 0),
  -- Resolved amount must be non-negative when present
  CONSTRAINT dispute_resolved_non_negative CHECK (resolved_amount_cents IS NULL OR resolved_amount_cents >= 0),
  -- Milestone-scope requires milestone_id, assignment-scope requires NULL
  CONSTRAINT dispute_scope_milestone_check CHECK (
    (scope = 'milestone' AND milestone_id IS NOT NULL)
    OR (scope = 'assignment' AND milestone_id IS NULL)
  ),
  -- Resolution fields must be set together
  CONSTRAINT dispute_resolution_fields CHECK (
    (resolution IS NULL AND resolved_amount_cents IS NULL AND resolved_at IS NULL)
    OR (resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

COMMENT ON TABLE assignment_dispute_cases IS 'Dispute case record. Supports milestone-level and assignment-level disputes.';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (reverse dependency order)
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS assignment_dispute_cases CASCADE;
-- DROP TABLE IF EXISTS ccr_amended_fields CASCADE;
-- DROP TABLE IF EXISTS commission_change_requests CASCADE;
-- DROP TABLE IF EXISTS review_records CASCADE;
-- DROP TABLE IF EXISTS service_logs CASCADE;
-- DROP TABLE IF EXISTS evidence_items CASCADE;
-- DROP TABLE IF EXISTS fulfilment_submissions CASCADE;
-- DROP TABLE IF EXISTS milestones CASCADE;
-- DROP TABLE IF EXISTS escrow_records CASCADE;
-- DROP TABLE IF EXISTS assignment_rights_records CASCADE;
-- DROP TABLE IF EXISTS assignments CASCADE;
