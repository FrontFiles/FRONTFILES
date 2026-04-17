-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Download Event Audit Log
--
-- Migration 14: download_events table + supporting enums + indexes.
--
-- Canonical persistence model for download audit events.
-- Covers all three protected delivery channels:
--   original_media    — GET /api/media/{assetId}?delivery=original
--   package_zip       — GET /api/packages/{packageId}/download
--   package_artifact  — GET /api/packages/{packageId}/artifacts/{artifactId}
--
-- ── DESIGN PRINCIPLES ──
--
--   1. LOG THE EVENT, NOT THE BUSINESS OBJECT.
--      This table does not pollute licence_grants, asset_media,
--      or certified_packages with download state.  It is a
--      dedicated, append-only audit trail.
--
--   2. CAPTURE ATTEMPTS, NOT JUST SUCCESSES.
--      Denied and unavailable outcomes are logged for compliance,
--      dispute review, and abuse detection.
--
--   3. NEVER BECOME AUTHORIZATION TRUTH.
--      This table records what authorization basis was evaluated.
--      It does not participate in authorization decisions.
--      licence_grants remains the sole entitlement source.
--      Package ownership remains the sole package access source.
--
--   4. ONE ROW = ONE HTTP REQUEST ATTEMPT.
--      The event grain is the HTTP request, not the completed
--      transfer.  Byte-accurate completion tracking is a
--      transport-layer concern (CDN/S3 access logs).
--
-- ── WHAT IS LOGGED ──
--
--   original_media:   authenticated original-delivery attempts
--                     (preview/derivative requests are NOT logged)
--   package_zip:      package ZIP attempts where ownership resolved
--   package_artifact: artifact attempts where ownership resolved
--
-- ── WHAT IS NOT LOGGED ──
--
--   - Preview/derivative media requests (not protected downloads)
--   - Anonymous/unauthenticated requests (application noise)
--   - Package-route 404s where the ownership check returned null
--     (cannot distinguish "not found" from "not authorized"
--     without leaking existence — consistent with the API's
--     404-for-both design)
--
-- ── REDIRECTED original_file ARTIFACTS ──
--
--   Both routes log.  The artifact route logs outcome='redirected'
--   (package ownership checked, redirect issued).  The media route
--   logs a separate event with the entitlement outcome (allowed or
--   denied).  Two events for one user action is correct because
--   two distinct authorization checks in two distinct domains
--   occurred:
--     1. "Can this user access this package?"  → artifact route
--     2. "Does this user have an active grant?" → media route
--   Correlated by user_id + asset_id + timestamp proximity,
--   or explicitly by request_id when the header is set.
--
-- ── ENUMS vs TEXT+CHECK ──
--
--   This migration uses CREATE TYPE ... AS ENUM, consistent with
--   every other migration in the project (40+ enums, zero text-
--   check patterns).  The three new enums have small, stable
--   value sets:
--     delivery_channel  — 3 values (maps 1:1 to API routes)
--     access_basis      — 5 values (maps to authorization paths)
--     outcome           — 6 values (maps to HTTP response classes)
--
--   PostgreSQL enums are safe to ALTER TYPE ... ADD VALUE in
--   future migrations (non-blocking, append-only).  Removing a
--   value is harder but irrelevant — these represent structural
--   authorization paths and route shapes, not user-facing labels.
--
-- ── FOREIGN KEY STRATEGY ──
--
--   Actor columns (user_id, company_id):
--     FK with ON DELETE RESTRICT.  Identity rows are never
--     hard-deleted in Frontfiles.  If they were, the audit log
--     must fail loudly, not silently lose the actor reference.
--
--   Resource columns (asset_id, package_id, artifact_id,
--   licence_grant_id):
--     NO foreign keys.  The audit log must survive resource
--     lifecycle changes.  A revoked package, deleted asset, or
--     purged grant must not cascade-null or block-delete audit
--     evidence.  The uuid is the snapshot — if the row is gone,
--     the audit record preserves what was referenced at event
--     time.
--
-- DEPENDS ON:
--   Extensions: pgcrypto (gen_random_uuid)
--   Tables:     users, companies
--   Enums:      package_artifact_type (from migration 12/v2)
--
-- ROLLBACK: see bottom of file.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUM TYPES                                             │
-- └─────────────────────────────────────────────────────────────┘

-- Which protected delivery endpoint handled the request.
-- Maps 1:1 to the three download API routes.
-- NOT a generic event taxonomy — three concrete routes, three values.
CREATE TYPE download_delivery_channel AS ENUM (
  'original_media',     -- GET /api/media/{assetId}?delivery=original
  'package_zip',        -- GET /api/packages/{packageId}/download
  'package_artifact'    -- GET /api/packages/{packageId}/artifacts/{artifactId}
);

-- What authorization basis was found and applied.
--
-- Originals (licence_grants path):
--   creator_self_access — creator downloading own asset; entitlement bypassed
--   personal_grant      — buyer's own active licence grant
--   company_grant       — buyer via company membership on a company grant
--
-- Packages (ownership path):
--   package_owner       — user owns the package, directly or via company
--                         Whether access is personal or via company is
--                         derivable from certified_packages.owner_company_id;
--                         not duplicated here to avoid an extra query at
--                         write time.
--
-- Failed attempts:
--   none                — no authorization basis found
CREATE TYPE download_access_basis AS ENUM (
  'creator_self_access',
  'personal_grant',
  'company_grant',
  'package_owner',
  'none'
);

-- What happened to the request.
--
-- allowed      — authorization passed, delivery initiated (2xx)
-- denied       — authorization check failed (403)
-- unavailable  — resource exists but not in servable state (409)
-- not_found    — resource or derivative not found (404)
-- redirected   — original_file artifact redirected to media route (302)
-- error        — server error during file serving (5xx)
CREATE TYPE download_outcome AS ENUM (
  'allowed',
  'denied',
  'unavailable',
  'not_found',
  'redirected',
  'error'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  DOWNLOAD EVENTS TABLE                                  │
-- │                                                             │
-- │  GRAIN: one row per HTTP request attempt against a          │
-- │         protected download endpoint.                        │
-- │                                                             │
-- │  APPEND-ONLY: the application layer never issues UPDATE     │
-- │  or DELETE.  Retention (archival, partition pruning) is a   │
-- │  future operational concern, not an application concern.    │
-- │  No updated_at column, no set_updated_at trigger.           │
-- │                                                             │
-- │  AUTHORIZATION BOUNDARY:                                    │
-- │  A row with outcome='allowed' in this table does NOT        │
-- │  authorize future downloads.  It records that authorization │
-- │  was evaluated and passed AT THAT MOMENT.  licence_grants   │
-- │  remains the sole entitlement truth.  Package ownership     │
-- │  remains the sole package-access truth.                     │
-- │                                                             │
-- │  PACKAGE ACCESS ≠ ORIGINAL ENTITLEMENT:                     │
-- │  A successful package_artifact download of type             │
-- │  original_file results in a 302 redirect to the media       │
-- │  endpoint, which independently re-verifies the licence      │
-- │  grant.  The two events (redirected + allowed/denied) are   │
-- │  intentionally separate audit records because they          │
-- │  represent two distinct authorization checks.               │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE download_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── When ──

  occurred_at         timestamptz NOT NULL DEFAULT now(),

  -- ── Who ──

  -- Authenticated user who made the request.
  -- FK with RESTRICT: identity rows are never hard-deleted;
  -- if somehow attempted, the audit log must block it.
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Company context when the access basis involves a company:
  -- company_grant (originals) or company-owned package.
  -- NULL for personal access and creator-self-access.
  -- FK with RESTRICT: same rationale as user_id.
  company_id          uuid REFERENCES companies(id) ON DELETE RESTRICT,

  -- ── What channel ──

  delivery_channel    download_delivery_channel NOT NULL,

  -- ── Resource identifiers ──
  --
  -- Set based on delivery_channel.  No foreign keys — the audit
  -- log must survive resource lifecycle changes (revocation,
  -- archival, purge) without cascading or blocking.
  --
  -- original_media:   asset_id (required), licence_grant_id (when found)
  -- package_zip:      package_id (required)
  -- package_artifact: package_id + artifact_id + artifact_type (required),
  --                   asset_id (when artifact_type = original_file)

  asset_id            uuid,
  licence_grant_id    uuid,
  package_id          uuid,
  artifact_id         uuid,
  artifact_type       package_artifact_type,

  -- ── Authorization ──

  access_basis        download_access_basis NOT NULL,

  -- ── Outcome ──

  outcome             download_outcome NOT NULL,

  -- Machine-readable reason code when outcome = denied or unavailable.
  -- Free text, not an enum — deny reasons span three disjoint code
  -- sets (entitlement DenyReason, package status codes, artifact
  -- status codes) and are best treated as opaque strings the
  -- application writes and compliance queries filter on.
  --
  -- Known values at design time:
  --   Originals:  NO_ACTIVE_GRANT, GRANT_EXPIRED, GRANT_SUSPENDED,
  --               GRANT_REVOKED, GRANT_PENDING, AUTH_REQUIRED,
  --               NO_ACTIVE_COMPANY_MEMBERSHIP,
  --               INSUFFICIENT_COMPANY_ROLE,
  --               NO_READY_ORIGINAL_MEDIA
  --   Packages:   PACKAGE_NOT_READY, EMPTY_PACKAGE
  --   Artifacts:  PACKAGE_REVOKED, ARTIFACT_NOT_AVAILABLE
  deny_reason         text,

  -- HTTP response status code returned to the client.
  http_status         smallint NOT NULL,

  -- ── Request context ──

  ip_address          inet,

  -- User-Agent header.  Truncated to 1000 chars at write time
  -- by the application.  The DB does not enforce length — the
  -- application layer is the right place for truncation policy.
  user_agent          text,

  -- From X-Request-Id header if present.  Text, not uuid — the
  -- header format is not controlled by Frontfiles (may come from
  -- a load balancer, CDN, or client).  Primary use: correlate an
  -- artifact redirect event with the subsequent media delivery
  -- event from the same user action.
  request_id          text,

  -- ══════════════════════════════════════════════
  -- CHECK CONSTRAINTS
  -- ══════════════════════════════════════════════

  -- ── Channel → resource coherence ──
  --
  -- Each channel has required and forbidden resource identifiers.
  -- These constraints prevent structurally nonsensical rows.

  -- original_media must have asset_id.
  CONSTRAINT de_original_needs_asset CHECK (
    delivery_channel != 'original_media'
    OR asset_id IS NOT NULL
  ),

  -- package_zip must have package_id.
  CONSTRAINT de_zip_needs_package CHECK (
    delivery_channel != 'package_zip'
    OR package_id IS NOT NULL
  ),

  -- package_artifact must have package_id, artifact_id, and artifact_type.
  -- Non-artifact channels must NOT have artifact_id or artifact_type.
  CONSTRAINT de_artifact_fields_coherent CHECK (
    (delivery_channel = 'package_artifact'
      AND package_id IS NOT NULL
      AND artifact_id IS NOT NULL
      AND artifact_type IS NOT NULL)
    OR
    (delivery_channel != 'package_artifact'
      AND artifact_id IS NULL
      AND artifact_type IS NULL)
  ),

  -- licence_grant_id is only meaningful for original_media events
  -- (it records which grant the entitlement module evaluated).
  -- Packages never consult licence_grants — recording a grant_id
  -- on a package event would be semantically dishonest.
  CONSTRAINT de_grant_only_for_originals CHECK (
    delivery_channel = 'original_media'
    OR licence_grant_id IS NULL
  ),

  -- ── Outcome → deny_reason coherence ──
  --
  -- deny_reason is required when the outcome is denied or
  -- unavailable (the investigator needs to know WHY), and
  -- forbidden otherwise (a reason on a success is confusing
  -- and suggests a logging bug).

  CONSTRAINT de_deny_reason_coherent CHECK (
    (outcome IN ('denied', 'unavailable') AND deny_reason IS NOT NULL)
    OR
    (outcome NOT IN ('denied', 'unavailable') AND deny_reason IS NULL)
  ),

  -- ── HTTP status sanity ──

  CONSTRAINT de_http_status_range CHECK (
    http_status BETWEEN 100 AND 599
  )
);


-- ══════════════════════════════════════════════════════════════
-- TABLE AND COLUMN COMMENTS
-- ══════════════════════════════════════════════════════════════

COMMENT ON TABLE download_events IS
  'Append-only audit log.  One row per HTTP request attempt against a '
  'protected download endpoint.  NEVER used for authorization decisions.  '
  'licence_grants is the sole entitlement truth; package ownership is the '
  'sole package-access truth.  This table records WHAT HAPPENED, not '
  'what is ALLOWED.';

COMMENT ON COLUMN download_events.occurred_at IS
  'When the route handler evaluated the request.  NOT transfer completion — '
  'that is a transport-layer concern tracked by CDN/S3 logs.';

COMMENT ON COLUMN download_events.user_id IS
  'Authenticated user.  NOT NULL — anonymous requests are not audit events.  '
  'FK to users(id) ON DELETE RESTRICT.';

COMMENT ON COLUMN download_events.company_id IS
  'Company context when access was via company_grant or company-owned package.  '
  'NULL for personal_grant, creator_self_access, and denied attempts without '
  'company context.  FK to companies(id) ON DELETE RESTRICT.';

COMMENT ON COLUMN download_events.delivery_channel IS
  'Which download endpoint: original_media, package_zip, or package_artifact.  '
  'Maps 1:1 to the three delivery API routes.';

COMMENT ON COLUMN download_events.asset_id IS
  'The vault asset targeted.  Set for original_media events (always) and '
  'package_artifact events when artifact_type=original_file (for redirect '
  'tracking).  No FK — audit survives asset lifecycle changes.';

COMMENT ON COLUMN download_events.licence_grant_id IS
  'The licence grant the entitlement module evaluated.  Set for original_media '
  'events when a grant was found (allowed or denied — a denied suspended grant '
  'still has a grant_id).  No FK — audit survives grant lifecycle changes.';

COMMENT ON COLUMN download_events.package_id IS
  'The certified package targeted.  Set for package_zip and package_artifact '
  'events.  No FK — audit survives package lifecycle changes.';

COMMENT ON COLUMN download_events.artifact_id IS
  'The specific artifact targeted.  Set for package_artifact events only.  '
  'No FK — audit survives artifact lifecycle changes.';

COMMENT ON COLUMN download_events.artifact_type IS
  'Artifact type (certificate, licence_agreement, original_file, etc.).  '
  'Set for package_artifact events only.  Uses the existing '
  'package_artifact_type enum.';

COMMENT ON COLUMN download_events.access_basis IS
  'What authorization basis was found and applied.  "none" when no basis '
  'was found (denied attempts).  Does not distinguish personal vs company '
  'package ownership — derivable from certified_packages.owner_company_id.';

COMMENT ON COLUMN download_events.outcome IS
  'What happened.  "redirected" on package_artifact events means the '
  'original_file artifact was 302-redirected to /api/media for independent '
  'entitlement verification.  A separate original_media event records that '
  'check.  These are intentionally two audit records.';

COMMENT ON COLUMN download_events.deny_reason IS
  'Machine-readable reason code from the authorization module.  Set only when '
  'outcome is "denied" or "unavailable".  Values: entitlement DenyReason '
  'codes (NO_ACTIVE_GRANT, GRANT_EXPIRED, etc.), package status codes '
  '(PACKAGE_NOT_READY), or artifact status codes (ARTIFACT_NOT_AVAILABLE).  '
  'Free text — not an enum — because it spans three disjoint code sets.';

COMMENT ON COLUMN download_events.http_status IS
  'HTTP response status code returned to the client (200, 302, 403, 404, 409, 500).';

COMMENT ON COLUMN download_events.request_id IS
  'X-Request-Id header if present.  Text — format not controlled by Frontfiles.  '
  'Correlates artifact redirect events with subsequent media delivery events.';


-- ══════════════════════════════════════════════════════════════
-- INDEXES
--
-- Six query patterns, each with a corresponding index.
-- All time-range queries use occurred_at DESC.
-- Partial indexes exclude NULL resource IDs to keep the index
-- tight on the relevant subset.
-- ══════════════════════════════════════════════════════════════

-- 1. User timeline — "all download attempts by user X, newest first"
-- Hot path: user's download history page, abuse investigation.
CREATE INDEX idx_de_user
  ON download_events (user_id, occurred_at DESC);

-- 2. Asset audit — "who downloaded original of asset Y"
-- Dispute review: prove who accessed a specific original file.
CREATE INDEX idx_de_asset
  ON download_events (asset_id, occurred_at DESC)
  WHERE asset_id IS NOT NULL;

-- 3. Package audit — "who downloaded package Z or its artifacts"
-- Compliance: trace all access to a governed evidence bundle.
CREATE INDEX idx_de_package
  ON download_events (package_id, occurred_at DESC)
  WHERE package_id IS NOT NULL;

-- 4. Grant audit — "all downloads under licence grant G"
-- Dispute/compliance: usage history for a specific licence right.
CREATE INDEX idx_de_grant
  ON download_events (licence_grant_id, occurred_at DESC)
  WHERE licence_grant_id IS NOT NULL;

-- 5. Deny investigation — "recent denied and unavailable attempts"
-- Abuse detection, support escalation, auth debugging.
CREATE INDEX idx_de_denied
  ON download_events (occurred_at DESC)
  WHERE outcome IN ('denied', 'unavailable');

-- 6. Request correlation — "find the other event(s) for this request"
-- Links artifact redirect → media delivery for original_file downloads.
-- Partial: only rows where the header was actually present.
CREATE INDEX idx_de_request_id
  ON download_events (request_id)
  WHERE request_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS download_events;
-- DROP TYPE IF EXISTS download_outcome;
-- DROP TYPE IF EXISTS download_access_basis;
-- DROP TYPE IF EXISTS download_delivery_channel;
