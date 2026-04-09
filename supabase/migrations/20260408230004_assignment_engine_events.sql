-- ════════════════════════════════════════════════════════════════
-- Migration 4: Assignment Engine — Append-Only Event Log
--
-- Integration with the Certification Event Log (CEL).
-- TypeScript: CertificationEvent + AssignmentEventPayload
--
-- APPEND-ONLY: Events may never be modified or deleted.
-- This is enforced by:
--   1. A trigger that rejects UPDATE and DELETE on the table.
--   2. RLS policies (future migration) that only permit INSERT.
--
-- The event_type column stores CertificationEventType values as text
-- rather than an enum, because the CEL is a shared system and new
-- event types may be added without schema migration.
--
-- Depends on: 20260408230002_assignment_engine_tables.sql
-- Rollback: DROP TABLE, DROP FUNCTION (see bottom).
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- ASSIGNMENT_EVENTS — Append-only CEL partition
-- ──────────────────────────────────────────────

CREATE TABLE assignment_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  milestone_id    uuid REFERENCES milestones(id) ON DELETE SET NULL,
  event_type      text NOT NULL,
  description     text NOT NULL,
  actor_id        uuid NOT NULL,
  actor_role      text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  idempotency_key text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assignment_events IS 'Append-only event log for assignment lifecycle. CEL integration. No UPDATE or DELETE permitted.';
COMMENT ON COLUMN assignment_events.event_type IS 'CertificationEventType value. Stored as text for cross-system extensibility.';
COMMENT ON COLUMN assignment_events.idempotency_key IS 'Prevents duplicate event emission. Used by webhook handlers and retry-safe operations.';
COMMENT ON COLUMN assignment_events.assignment_id IS 'ON DELETE RESTRICT — events must not be orphaned by assignment deletion.';

-- ──────────────────────────────────────────────
-- APPEND-ONLY ENFORCEMENT TRIGGER
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assignment_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'assignment_events is append-only. % operations are forbidden.', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assignment_events_no_update
  BEFORE UPDATE ON assignment_events
  FOR EACH ROW
  EXECUTE FUNCTION assignment_events_immutable();

CREATE TRIGGER trg_assignment_events_no_delete
  BEFORE DELETE ON assignment_events
  FOR EACH ROW
  EXECUTE FUNCTION assignment_events_immutable();

-- ──────────────────────────────────────────────
-- INDEXES — Timeline queries
-- ──────────────────────────────────────────────

-- All events for an assignment in chronological order (timeline panel)
CREATE INDEX idx_assignment_events_assignment_time
  ON assignment_events (assignment_id, created_at DESC);

-- All events for a milestone (milestone detail view)
CREATE INDEX idx_assignment_events_milestone
  ON assignment_events (milestone_id, created_at DESC)
  WHERE milestone_id IS NOT NULL;

-- Events by type (for background job queries, e.g. find all escrow_released events)
CREATE INDEX idx_assignment_events_type
  ON assignment_events (event_type, created_at DESC);

-- Idempotency key lookup (already UNIQUE, but B-tree index covers it)

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_assignment_events_no_delete ON assignment_events;
-- DROP TRIGGER IF EXISTS trg_assignment_events_no_update ON assignment_events;
-- DROP FUNCTION IF EXISTS assignment_events_immutable();
-- DROP TABLE IF EXISTS assignment_events CASCADE;
