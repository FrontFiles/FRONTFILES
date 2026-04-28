-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — sum_ai_cost_cents_since RPC
--
-- Per E3 directive §14: pre-call spend-cap check needs to sum
-- ai_analysis.cost_cents across recent rows. ai_analysis is RLS
-- service-role-only, so the RPC runs SECURITY DEFINER on the
-- service-role's behalf, with REVOKE PUBLIC + explicit GRANT to
-- service_role making the access boundary explicit.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sum_ai_cost_cents_since(since timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_cents), 0)::bigint
  FROM ai_analysis
  WHERE created_at >= since AND cost_cents IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION sum_ai_cost_cents_since(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sum_ai_cost_cents_since(timestamptz) TO service_role;

COMMENT ON FUNCTION sum_ai_cost_cents_since(timestamptz) IS
  'E3: pre-call spend-cap check. Sums ai_analysis.cost_cents since the given timestamp. SECURITY DEFINER + service_role grant only.';
