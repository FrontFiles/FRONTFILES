-- ════════════════════════════════════════════════════════════════
-- Common trigger functions
--
-- Purpose: canonical definition of set_updated_at(). Invoked by
-- 7 trigger sites across 20260413230015, 20260413230016, and
-- 20260419110000; historically installed out-of-band on prod.
-- This migration backfills the versioned definition so
-- `supabase db reset` reproduces prod faithfully.
--
-- Idempotency: CREATE OR REPLACE is safe to re-run.
--
-- Prod apply note: before applying to prod, introspect the
-- existing function body to confirm match (there is no
-- versioned reference for the current prod definition).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
