-- ════════════════════════════════════════════════════════════════
-- Migration 1: Assignment Engine — Enum Types
--
-- Canonical PostgreSQL enum types backing the TypeScript union types
-- defined in src/lib/types.ts. Every enum value here must match its
-- TypeScript counterpart exactly (snake_case, lowercase).
--
-- Rollback: DROP TYPE ... CASCADE for each type (see bottom).
-- ════════════════════════════════════════════════════════════════

-- §10.7 — Assignment class (material, service, hybrid)
CREATE TYPE assignment_class AS ENUM (
  'material',
  'service',
  'hybrid'
);

-- §10.7–10.9 — Parent state machine (7 states)
CREATE TYPE assignment_state AS ENUM (
  'brief_issued',
  'escrow_captured',
  'in_progress',
  'delivered',
  'confirmed',
  'disputed',
  'cancelled'
);

-- §8.2 — Operational sub-state (14 states)
CREATE TYPE assignment_sub_state AS ENUM (
  'draft',
  'clarification_open',
  'accepted_pending_escrow',
  'active',
  'milestone_due',
  'fulfilment_submitted',
  'fulfilment_processing',
  'review_open',
  'changes_requested',
  'ccr_pending',
  'provisional_release_eligible',
  'provisional_release_executed',
  'settlement_queued',
  'closed'
);

-- §5 — Milestone types (class-aligned)
CREATE TYPE milestone_type AS ENUM (
  'material',
  'service',
  'hybrid'
);

-- §5 — Milestone state machine (10 states)
CREATE TYPE milestone_state AS ENUM (
  'pending',
  'active',
  'fulfilment_submitted',
  'review_open',
  'changes_requested',
  'accepted',
  'accepted_partial',
  'rejected',
  'disputed',
  'cancelled'
);

-- §6 — Fulfilment submission types
CREATE TYPE fulfilment_type AS ENUM (
  'asset',
  'service',
  'hybrid'
);

-- §6.2 — Evidence item families (8 kinds)
CREATE TYPE evidence_item_kind AS ENUM (
  'vault_asset',
  'service_log',
  'time_location_record',
  'handoff_note',
  'attendance_confirmation',
  'support_document',
  'buyer_acknowledgement',
  'other'
);

-- §10.1 — Review determinations (5 outcomes)
CREATE TYPE review_determination AS ENUM (
  'accepted',
  'accepted_partial',
  'changes_requested',
  'rejected',
  'dispute_opened'
);

-- §11 — Commission Change Request state (5 states)
CREATE TYPE ccr_state AS ENUM (
  'pending',
  'approved',
  'denied',
  'auto_denied',
  'withdrawn'
);

-- §13.1 — Assignment dispute triggers (8 types)
CREATE TYPE assignment_dispute_trigger AS ENUM (
  'creator_non_performance',
  'deadline_miss',
  'asset_failure_against_brief',
  'buyer_refusal_without_grounds',
  'service_non_compliance',
  'hybrid_partial_compliance',
  'rights_scope_disagreement',
  'non_response_after_fulfilment'
);

-- §13 — Dispute scope (milestone vs assignment-level)
CREATE TYPE assignment_dispute_scope AS ENUM (
  'milestone',
  'assignment'
);

-- §13 — Dispute state machine (5 states)
CREATE TYPE dispute_state AS ENUM (
  'filed',
  'under_review',
  'upheld',
  'not_upheld',
  'escalated_external'
);

-- §13 — Dispute resolution outcomes
CREATE TYPE assignment_dispute_resolution AS ENUM (
  'full_release',
  'partial_release',
  'full_refund',
  'partial_refund',
  'no_action'
);

-- §5 — Buyer company roles (for reviewer_role storage)
CREATE TYPE buyer_company_role AS ENUM (
  'admin',
  'content_commit_holder',
  'editor'
);

-- Reviewer role (buyer company role + staff)
CREATE TYPE reviewer_role AS ENUM (
  'admin',
  'content_commit_holder',
  'editor',
  'staff'
);

-- Filer role for disputes
CREATE TYPE dispute_filer_role AS ENUM (
  'buyer',
  'creator'
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS dispute_filer_role CASCADE;
-- DROP TYPE IF EXISTS reviewer_role CASCADE;
-- DROP TYPE IF EXISTS buyer_company_role CASCADE;
-- DROP TYPE IF EXISTS assignment_dispute_resolution CASCADE;
-- DROP TYPE IF EXISTS dispute_state CASCADE;
-- DROP TYPE IF EXISTS assignment_dispute_scope CASCADE;
-- DROP TYPE IF EXISTS assignment_dispute_trigger CASCADE;
-- DROP TYPE IF EXISTS ccr_state CASCADE;
-- DROP TYPE IF EXISTS review_determination CASCADE;
-- DROP TYPE IF EXISTS evidence_item_kind CASCADE;
-- DROP TYPE IF EXISTS fulfilment_type CASCADE;
-- DROP TYPE IF EXISTS milestone_state CASCADE;
-- DROP TYPE IF EXISTS milestone_type CASCADE;
-- DROP TYPE IF EXISTS assignment_sub_state CASCADE;
-- DROP TYPE IF EXISTS assignment_state CASCADE;
-- DROP TYPE IF EXISTS assignment_class CASCADE;
