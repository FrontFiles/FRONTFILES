-- ════════════════════════════════════════════════════════════════
-- Migration: External Providers — Enum types
--
-- Canonical enums for the external provider foundation. Every
-- enum mirrors a TypeScript union in
-- `src/lib/providers/types.ts` 1:1. Keep them in lockstep.
--
-- The provider key is INTENTIONALLY a text column (not an enum)
-- because we want to add new providers without ALTER TYPE
-- migrations. The application validates the key against the
-- canonical registry in `lib/providers/registry.ts`. Enums are
-- reserved for shapes that change rarely (categories, statuses,
-- owner types) where the payoff of typed columns outweighs the
-- migration cost.
--
-- Depends on: nothing.
-- Rollback: DROP TYPE … CASCADE for each (see bottom).
-- ════════════════════════════════════════════════════════════════

-- Provider taxonomy. Code branches by category for cross-provider
-- behaviour (e.g. "billing capability" cuts across stripe + future
-- alternatives) so the enum is short on purpose.
CREATE TYPE provider_category AS ENUM (
  'payments',
  'identity_verification',
  'payouts',
  'storage',
  'mail',
  'calendar',
  'analytics',
  'crm',
  'enterprise_sso'
);

-- How the connection authenticates with the provider. The app
-- never branches on "is this Stripe vs Google" — it branches on
-- this enum, which keeps adapter switches centralized.
CREATE TYPE provider_auth_type AS ENUM (
  'api_key',
  'oauth2',
  'oauth2_pkce',
  'connect_oauth',
  'webhook_only',
  'none'
);

-- Who owns an external connection. This is the polymorphic
-- ownership tag for `external_connections.owner_id`. CHECK
-- constraints in the tables migration enforce that
-- `owner_id` is NULL exactly when `owner_type='platform'`.
CREATE TYPE provider_owner_type AS ENUM (
  'user',
  'company',
  'workspace',
  'platform'
);

-- Connection lifecycle. Note the difference between `error` and
-- `reauth_required`: a transient API error keeps the connection
-- in `active` until the next health probe; `reauth_required`
-- means the user must complete the OAuth flow again.
CREATE TYPE provider_connection_status AS ENUM (
  'pending',
  'active',
  'revoked',
  'error',
  'reauth_required'
);

-- Webhook signature verification outcome. Default for new rows
-- is `unverified` so the verification boundary HAS to set the
-- value before the row counts as trusted.
CREATE TYPE provider_webhook_signature_status AS ENUM (
  'verified',
  'rejected',
  'unverified'
);

-- Webhook processing pipeline. `dead_letter` is the terminal
-- state for repeatedly-failed events that need operator action.
CREATE TYPE provider_webhook_processing_status AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'dead_letter'
);

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TYPE IF EXISTS provider_webhook_processing_status CASCADE;
-- DROP TYPE IF EXISTS provider_webhook_signature_status CASCADE;
-- DROP TYPE IF EXISTS provider_connection_status CASCADE;
-- DROP TYPE IF EXISTS provider_owner_type CASCADE;
-- DROP TYPE IF EXISTS provider_auth_type CASCADE;
-- DROP TYPE IF EXISTS provider_category CASCADE;
