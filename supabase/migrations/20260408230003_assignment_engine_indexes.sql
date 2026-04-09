-- ════════════════════════════════════════════════════════════════
-- Migration 3: Assignment Engine — Indexes
--
-- Performance indexes for:
-- - List views (buyer/creator assignment lists)
-- - Timeline queries (events by assignment, by time)
-- - State transition queries (filter by state/sub_state)
-- - Role-based queries (reviewer, filer lookups)
-- - Stripe idempotent sync (payment intent lookup)
--
-- Depends on: 20260408230002_assignment_engine_tables.sql
-- Rollback: DROP INDEX for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- ASSIGNMENTS — List views and state queries
-- ──────────────────────────────────────────────

-- Buyer sees their assignments (list page, filtered by state)
CREATE INDEX idx_assignments_buyer_state
  ON assignments (buyer_id, state);

-- Creator sees their assignments (inbox, filtered by state)
CREATE INDEX idx_assignments_creator_state
  ON assignments (creator_id, state);

-- Staff queries: all disputed assignments
CREATE INDEX idx_assignments_state
  ON assignments (state)
  WHERE state = 'disputed';

-- Staff/system queries: sub-state lookups for background jobs
CREATE INDEX idx_assignments_sub_state
  ON assignments (sub_state);

-- Temporal sort for list views
CREATE INDEX idx_assignments_created_at
  ON assignments (created_at DESC);

-- ──────────────────────────────────────────────
-- MILESTONES — Assignment membership and state
-- ──────────────────────────────────────────────

-- All milestones for an assignment, ordered
CREATE INDEX idx_milestones_assignment_ordinal
  ON milestones (assignment_id, ordinal);

-- Milestones by state (background jobs: due alerts, provisional release check)
CREATE INDEX idx_milestones_state
  ON milestones (state);

-- Due date for milestone due alert job
CREATE INDEX idx_milestones_due_date
  ON milestones (due_date)
  WHERE state IN ('active', 'fulfilment_submitted');

-- ──────────────────────────────────────────────
-- FULFILMENT_SUBMISSIONS — Milestone membership
-- ──────────────────────────────────────────────

-- All submissions for a milestone, ordered by time
CREATE INDEX idx_fulfilment_submissions_milestone
  ON fulfilment_submissions (milestone_id, submitted_at DESC);

-- ──────────────────────────────────────────────
-- EVIDENCE_ITEMS — Submission membership and kind
-- ──────────────────────────────────────────────

-- All evidence for a submission
CREATE INDEX idx_evidence_items_submission
  ON evidence_items (fulfilment_submission_id);

-- Vault asset cross-reference (when checking if asset is used in fulfilment)
CREATE INDEX idx_evidence_items_vault_asset
  ON evidence_items (vault_asset_id)
  WHERE vault_asset_id IS NOT NULL;

-- ──────────────────────────────────────────────
-- REVIEW_RECORDS — Milestone membership
-- ──────────────────────────────────────────────

-- All reviews for a milestone, ordered by time
CREATE INDEX idx_review_records_milestone
  ON review_records (milestone_id, created_at DESC);

-- ──────────────────────────────────────────────
-- COMMISSION_CHANGE_REQUESTS — Assignment membership and state
-- ──────────────────────────────────────────────

-- All CCRs for an assignment, ordered by time
CREATE INDEX idx_ccrs_assignment
  ON commission_change_requests (assignment_id, created_at DESC);

-- Pending CCRs for auto-deny background job
CREATE INDEX idx_ccrs_pending_deadline
  ON commission_change_requests (response_deadline)
  WHERE state = 'pending';

-- ──────────────────────────────────────────────
-- ASSIGNMENT_DISPUTE_CASES — Assignment membership and state
-- ──────────────────────────────────────────────

-- All disputes for an assignment
CREATE INDEX idx_disputes_assignment
  ON assignment_dispute_cases (assignment_id);

-- Staff dispute queue: open disputes ordered by filed date
CREATE INDEX idx_disputes_state_filed
  ON assignment_dispute_cases (state, filed_at DESC)
  WHERE state IN ('filed', 'under_review');

-- Milestone-level dispute lookup
CREATE INDEX idx_disputes_milestone
  ON assignment_dispute_cases (milestone_id)
  WHERE milestone_id IS NOT NULL;

-- ──────────────────────────────────────────────
-- ESCROW_RECORDS — Stripe sync
-- ──────────────────────────────────────────────

-- Already has UNIQUE on stripe_payment_intent_id from table definition.
-- Assignment lookup already covered by UNIQUE on assignment_id.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_disputes_milestone;
-- DROP INDEX IF EXISTS idx_disputes_state_filed;
-- DROP INDEX IF EXISTS idx_disputes_assignment;
-- DROP INDEX IF EXISTS idx_ccrs_pending_deadline;
-- DROP INDEX IF EXISTS idx_ccrs_assignment;
-- DROP INDEX IF EXISTS idx_review_records_milestone;
-- DROP INDEX IF EXISTS idx_evidence_items_vault_asset;
-- DROP INDEX IF EXISTS idx_evidence_items_submission;
-- DROP INDEX IF EXISTS idx_fulfilment_submissions_milestone;
-- DROP INDEX IF EXISTS idx_milestones_due_date;
-- DROP INDEX IF EXISTS idx_milestones_state;
-- DROP INDEX IF EXISTS idx_milestones_assignment_ordinal;
-- DROP INDEX IF EXISTS idx_assignments_created_at;
-- DROP INDEX IF EXISTS idx_assignments_sub_state;
-- DROP INDEX IF EXISTS idx_assignments_state;
-- DROP INDEX IF EXISTS idx_assignments_creator_state;
-- DROP INDEX IF EXISTS idx_assignments_buyer_state;
