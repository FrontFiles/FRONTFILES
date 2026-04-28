-- Rollback for 20260428000001_users_ai_region.sql
ALTER TABLE users DROP COLUMN IF EXISTS ai_region;
DROP TYPE IF EXISTS user_ai_region;
