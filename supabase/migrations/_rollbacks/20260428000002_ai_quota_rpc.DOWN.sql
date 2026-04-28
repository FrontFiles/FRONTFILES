-- Rollback for 20260428000002_ai_quota_rpc.sql
DROP FUNCTION IF EXISTS sum_ai_cost_cents_since(timestamptz);
