-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Add users.ai_region (Phase 4.B.5a, absorbed into E3)
--
-- Per INTEGRATION_READINESS.md D8 + Phase 4.B.5a:
-- "Creator-residency field on users table before any Vertex AI call."
-- Required by E3 (per-asset Vertex Gemini Vision job).
--
-- Default 'eu' for all existing rows + new rows. CCP 7 / Phase 4.B
-- onboarding work captures the user's actual residency at signup
-- and updates this column. Until then, all calls route to
-- europe-west4.
--
-- Down-migration at supabase/migrations/_rollbacks/.
-- ════════════════════════════════════════════════════════════════

CREATE TYPE user_ai_region AS ENUM ('eu', 'us');

ALTER TABLE users
  ADD COLUMN ai_region user_ai_region NOT NULL DEFAULT 'eu';

COMMENT ON COLUMN users.ai_region IS
  'High-level AI processing residency per D8. eu → europe-west4, us → us-central1. Default eu for all existing + new rows; onboarding (CCP 7 / Phase 4.B) captures actual residency.';
