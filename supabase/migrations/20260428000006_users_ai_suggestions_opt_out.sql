-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E6: users.ai_suggestions_opt_out
--
-- Per E6-DIRECTIVE.md §12.
--
-- When TRUE, AI proposal UI surfaces are hidden for this creator.
-- The worker still runs (per E1 v2 §7.3 — preserves data for analytics),
-- but no proposal affordances appear in the upload UI. Default FALSE.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN ai_suggestions_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.ai_suggestions_opt_out IS
  'E6: when TRUE, AI proposal UI surfaces are hidden for this creator. Worker still runs server-side (preserves data for analytics + instant re-enable). Default FALSE.';
