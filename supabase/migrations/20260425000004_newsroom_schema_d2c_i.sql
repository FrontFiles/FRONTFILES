-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Newsroom Schema Extensions, Part C-i (NR-D2c-i)
--
-- Provenance-substrate for the Newsroom v1 subsystem:
--
--   Enums (4):
--     newsroom_distribution_event_type
--     newsroom_distribution_source
--     newsroom_signing_algorithm
--     newsroom_signing_key_status
--
--   Tables (3):
--     newsroom_signing_keys            — Ed25519 key lifecycle
--     newsroom_distribution_events     — append-only event log
--     newsroom_download_receipts       — tamper-evident receipts
--
--   RLS policies on all three new tables (2 total, both SELECT):
--     signing_keys:          0 policies (RLS enabled, deny-all
--                                        for non-service_role;
--                                        /.well-known/receipt-keys
--                                        uses service_role in
--                                        NR-D10; admin reads
--                                        land in NR-D17)
--     distribution_events:   1 SELECT (org editor/admin)
--     download_receipts:     1 SELECT (public — receipt URLs
--                                      are PRD Part 5 §5.1 P4)
--   NO INSERT / UPDATE / DELETE policies on ANY of the three
--   tables — mutations routed through service_role RPCs in
--   NR-D10 and beyond.
--
-- INVARIANT: at-most-one-active signing key system-wide,
-- enforced by a partial UNIQUE INDEX over status where
-- status='active'.  Predicate is IMMUTABLE (enum-constant),
-- safe per NR-D1 exit report §2 lesson.
--
-- REFERENCES (NOT MODIFIED):
--   newsroom_packs, newsroom_assets, newsroom_recipients,
--   newsroom_licence_class (enum), set_updated_at(),
--   is_newsroom_editor_or_admin(uuid).
--
-- NO MUTATION TO ANY EXISTING OBJECT.  Unlike NR-D2a / NR-D2b,
-- this migration does not ALTER any pre-existing table: all
-- FKs from the three new tables point at existing objects and
-- the existing pack/asset/recipient tables have no columns
-- that need a deferred FK resolved here.
--
-- GOVERNING DOCS:
--   docs/public-newsroom/PRD.md                       (authority)
--   docs/public-newsroom/BUILD_CHARTER.md             (scope + mapping lock)
--   docs/public-newsroom/DIRECTIVE_SEQUENCE.md        (place in sequence)
--   docs/public-newsroom/directives/NR-D2c-i-provenance-stack.md
--
-- DEPENDS ON:
--   Migration 20260425000001 (NR-D1 — newsroom_packs,
--                             newsroom_assets, newsroom_licence_class,
--                             is_newsroom_editor_or_admin,
--                             set_updated_at).
--   Migration 20260425000003 (NR-D2b — newsroom_recipients;
--                             receipts and events FK to this
--                             table via ON DELETE SET NULL for
--                             GDPR Art. 17 erasure support
--                             (PRD §13.8)).
--
-- OUT OF SCOPE (hard boundary — NOT landing here):
--   - Claims, admin_users, admin_audit_events, beat_subscriptions
--     (NR-D2c-ii).
--   - RPCs (receipt-emit, key-rotate, event-write) → NR-D10.
--   - /.well-known/receipt-keys API route → NR-D10.
--   - KMS integration (private_key_ref resolution) → NR-D10.
--   - Admin-side SELECT policy on newsroom_signing_keys → NR-D17.
--   - Any INSERT/UPDATE/DELETE policy on any of the three tables.
--
-- ROLLBACK:
--   supabase/migrations/_rollbacks/20260425000004_newsroom_schema_d2c_i.DOWN.sql
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ENUMS                                                  │
-- │                                                             │
-- │  Four Newsroom-specific provenance primitives.  Scoped to   │
-- │  this subsystem; do not extend any existing enum.  Kept     │
-- │  independently versionable from NR-D1 / NR-D2a / NR-D2b     │
-- │  enums and from the commercial / entitlement value sets.    │
-- │                                                             │
-- │  newsroom_signing_algorithm is a single-value enum today    │
-- │  ('ed25519'); shape chosen to leave room for a future       │
-- │  rotation across algorithm families without a second ALTER. │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE newsroom_distribution_event_type AS ENUM (
  'pack_view',
  'asset_view',
  'asset_download',
  'pack_zip_download',
  'embed_render',
  'preview_access'
);

CREATE TYPE newsroom_distribution_source AS ENUM (
  'web',
  'embed',
  'api',
  'email_link'
);

CREATE TYPE newsroom_signing_algorithm AS ENUM (
  'ed25519'
);

CREATE TYPE newsroom_signing_key_status AS ENUM (
  'active',
  'rotated',
  'revoked'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  newsroom_signing_keys                                  │
-- │                                                             │
-- │  One row per Ed25519 signing key across the system's entire │
-- │  key lifecycle.  At-most-one row with status='active' at    │
-- │  any time (partial UNIQUE INDEX over (status) WHERE         │
-- │  status='active').  Rotated / revoked keys stay in the      │
-- │  table indefinitely so historical receipts remain           │
-- │  verifiable against their signing key.                      │
-- │                                                             │
-- │  private_key_ref stores a KMS reference (e.g.               │
-- │  'projects/frontfiles/.../cryptoKeys/receipts/.../N').      │
-- │  The raw private key bytes NEVER touch this table.  The     │
-- │  KMS-integration contract lands in NR-D10; at DB level we   │
-- │  enforce only non-empty text.                               │
-- │                                                             │
-- │  State lifecycle (PRD Part 5 §5.1 P4):                      │
-- │    active   ⇔ rotated_at IS NULL AND revoked_at IS NULL     │
-- │    rotated  ⇔ rotated_at IS NOT NULL AND revoked_at IS NULL │
-- │    revoked  ⇔ revoked_at IS NOT NULL  (rotated_at NULL or   │
-- │              NOT NULL — "revoked while active" vs           │
-- │              "rotated then revoked" are both valid paths)   │
-- │                                                             │
-- │  Rotation (NR-D10) is a two-step:  flip current 'active' →  │
-- │  'rotated' first, then INSERT a new row with 'active'.      │
-- │  The partial unique index rejects accidental parallel       │
-- │  'active' rows even under concurrent rotations.             │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_signing_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kid              text NOT NULL,
  algorithm        newsroom_signing_algorithm NOT NULL DEFAULT 'ed25519',
  public_key_pem   text NOT NULL,
  private_key_ref  text NOT NULL,

  status           newsroom_signing_key_status NOT NULL DEFAULT 'active',
  rotated_at       timestamptz,
  revoked_at       timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_signing_keys_kid_unique UNIQUE (kid),

  -- URL-safe identifier, 8–128 chars.  NR-D10 will standardise
  -- on a specific format (e.g. 'nr-YYYYMMDD-<n>').
  CONSTRAINT newsroom_signing_keys_kid_format CHECK (
    kid ~ '^[A-Za-z0-9_-]{8,128}$'
  ),

  CONSTRAINT newsroom_signing_keys_public_key_nonempty CHECK (
    length(public_key_pem) > 0
  ),

  CONSTRAINT newsroom_signing_keys_private_ref_nonempty CHECK (
    length(private_key_ref) > 0
  ),

  -- State-coherence:
  --   active   ⇒ rotated_at NULL AND revoked_at NULL
  --   rotated  ⇒ rotated_at NOT NULL AND revoked_at NULL
  --   revoked  ⇒ revoked_at NOT NULL (rotated_at may be NULL or
  --             NOT NULL — "revoked-while-active" and
  --             "rotated-then-revoked" are both valid paths).
  CONSTRAINT newsroom_signing_keys_state_coherence CHECK (
    (status = 'active'  AND rotated_at IS NULL AND revoked_at IS NULL)
    OR
    (status = 'rotated' AND rotated_at IS NOT NULL AND revoked_at IS NULL)
    OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

COMMENT ON TABLE newsroom_signing_keys IS
  'Ed25519 signing-key lifecycle.  At-most-one row with '
  'status=''active'' (partial UNIQUE INDEX).  private_key_ref '
  'stores a KMS reference; raw key bytes never touch this '
  'table.  Rotated / revoked keys retained indefinitely so '
  'historical receipts remain verifiable.';

COMMENT ON COLUMN newsroom_signing_keys.kid IS
  'Public key identifier embedded in every signed receipt and '
  'exposed by the /.well-known/receipt-keys endpoint (NR-D10).  '
  'URL-safe, 8–128 chars.  UNIQUE across the table.';

COMMENT ON COLUMN newsroom_signing_keys.private_key_ref IS
  'Opaque KMS reference (e.g. Google KMS cryptoKeyVersion '
  'resource name).  Resolved by the signing server at receipt-'
  'emit time in NR-D10.  Never the raw key bytes.';

-- ── Indexes ──

-- At-most-one-active invariant — rejects a second row with
-- status='active' until the current active row is flipped to
-- 'rotated' or 'revoked'.  Predicate is IMMUTABLE (enum-
-- constant), safe per NR-D1 exit report §2 lesson.
CREATE UNIQUE INDEX idx_newsroom_signing_keys_single_active
  ON newsroom_signing_keys (status)
  WHERE status = 'active';

-- Drives the /.well-known/receipt-keys endpoint (NR-D10) to
-- list currently-published keys (active + rotated, excluding
-- revoked).  Predicate is IMMUTABLE (enum-constant), safe per
-- NR-D1 exit report §2 lesson.
CREATE INDEX idx_newsroom_signing_keys_published
  ON newsroom_signing_keys (kid)
  WHERE status != 'revoked';

CREATE TRIGGER trg_newsroom_signing_keys_updated_at
  BEFORE UPDATE ON newsroom_signing_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  newsroom_distribution_events                           │
-- │                                                             │
-- │  Append-only event log — one row per tracked distribution   │
-- │  event.  NO updated_at column; rows are immutable after     │
-- │  insert.  No trigger.  No UPDATE policy in §5.              │
-- │                                                             │
-- │  FK policy rationale:                                       │
-- │    - pack_id RESTRICT: packs rarely deleted (takedown is a  │
-- │      tombstone, not a delete); events outlive takedowns     │
-- │      for audit purposes.                                    │
-- │    - asset_id RESTRICT: same rationale at asset granularity.│
-- │    - recipient_id SET NULL: GDPR Art. 17 erasure per PRD    │
-- │      §13.8 must null out the recipient reference without    │
-- │      deleting the event row.  outlet_domain is on the event │
-- │      directly, so outlet-level analytics survive recipient  │
-- │      erasure.                                               │
-- │                                                             │
-- │  metadata is jsonb default '{}'::jsonb — pipeline-specific  │
-- │  fields (referrer, embed_host, user_agent_family, etc.)     │
-- │  live here without schema migrations.                       │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_distribution_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pack_id          uuid NOT NULL
                     REFERENCES newsroom_packs(id) ON DELETE RESTRICT,
  asset_id         uuid
                     REFERENCES newsroom_assets(id) ON DELETE RESTRICT,
  recipient_id     uuid
                     REFERENCES newsroom_recipients(id) ON DELETE SET NULL,
  anon_session_id  text,

  event_type       newsroom_distribution_event_type NOT NULL,
  source           newsroom_distribution_source     NOT NULL,

  outlet_domain    text,
  user_agent       text,
  ip_country       char(2),

  occurred_at      timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  -- ISO 3166-1 alpha-2 country code (2 uppercase letters).
  CONSTRAINT newsroom_de_ip_country_format CHECK (
    ip_country IS NULL OR ip_country ~ '^[A-Z]{2}$'
  ),

  -- FQDN pattern (lowercase, hyphen-permitted labels, ≥2 parts).
  -- Same shape as NR-D1 newsroom_profiles_domain_format and
  -- NR-D2b newsroom_outlets_domain_format.
  CONSTRAINT newsroom_de_outlet_domain_format CHECK (
    outlet_domain IS NULL
    OR outlet_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);

COMMENT ON TABLE newsroom_distribution_events IS
  'Append-only distribution-event log.  No updated_at column; '
  'rows immutable after insert.  recipient_id SET NULL on '
  'delete for GDPR Art. 17 erasure (PRD §13.8); pack_id and '
  'asset_id RESTRICT because events outlive takedowns.';

-- ── Indexes ──

-- Per-pack analytics drill-down (PRD P14).
CREATE INDEX idx_newsroom_de_pack_time
  ON newsroom_distribution_events (pack_id, occurred_at DESC);

-- Outlet-attribution analytics (PRD P14).  Partial: rows with
-- no outlet_domain don't contribute to this access pattern.
CREATE INDEX idx_newsroom_de_outlet_time
  ON newsroom_distribution_events (outlet_domain, occurred_at DESC)
  WHERE outlet_domain IS NOT NULL;

-- Event-type filtering.
CREATE INDEX idx_newsroom_de_event_type_time
  ON newsroom_distribution_events (event_type, occurred_at DESC);

-- Journalist export history (PRD J8).  Partial: anonymous
-- events don't contribute to this access pattern.
CREATE INDEX idx_newsroom_de_recipient_time
  ON newsroom_distribution_events (recipient_id, occurred_at DESC)
  WHERE recipient_id IS NOT NULL;

-- NO trigger — events are immutable, no updated_at column.


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  newsroom_download_receipts                             │
-- │                                                             │
-- │  Tamper-evident download receipt — 1:1 with the subset of   │
-- │  newsroom_distribution_events where event_type IN           │
-- │  ('asset_download', 'pack_zip_download').  Immutable after  │
-- │  insert: no updated_at column, no trigger, no UPDATE        │
-- │  policy in §5.                                              │
-- │                                                             │
-- │  SNAPSHOT COLUMNS (licence_class, credit_line,              │
-- │  terms_summary, content_hash_sha256): captured at the time  │
-- │  of the download and frozen.  The receipt must remain       │
-- │  verifiable against the bytes served and the licence        │
-- │  presented even after the source Pack is later edited.      │
-- │  signing_key_kid is similarly snapshotted — even if the     │
-- │  key is later rotated or revoked, the receipt still carries │
-- │  the kid that was active at signing time.                   │
-- │                                                             │
-- │  FK policy rationale:                                       │
-- │    - distribution_event_id RESTRICT + UNIQUE: 1:1 with the  │
-- │      event; event row must not vanish while receipt exists. │
-- │    - pack_id RESTRICT: receipts outlive pack takedowns.     │
-- │    - asset_id RESTRICT: same at asset granularity.          │
-- │    - recipient_id SET NULL: GDPR Art. 17 erasure per PRD    │
-- │      §13.8.                                                 │
-- │    - signing_key_kid RESTRICT: receipts must never lose     │
-- │      their key reference.  A revoked key stays in the       │
-- │      signing-keys table so its public_key_pem remains       │
-- │      retrievable for independent verification (receipt is   │
-- │      "signed by a revoked key" but still inspectable per    │
-- │      PRD Part 5 §5.1 P4 state table).                       │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE newsroom_download_receipts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  distribution_event_id  uuid NOT NULL UNIQUE
                           REFERENCES newsroom_distribution_events(id)
                           ON DELETE RESTRICT,

  pack_id                uuid NOT NULL
                           REFERENCES newsroom_packs(id) ON DELETE RESTRICT,
  asset_id               uuid
                           REFERENCES newsroom_assets(id) ON DELETE RESTRICT,
  recipient_id           uuid
                           REFERENCES newsroom_recipients(id) ON DELETE SET NULL,

  licence_class          newsroom_licence_class NOT NULL,
  credit_line            text NOT NULL,
  terms_summary          text NOT NULL,
  content_hash_sha256    text NOT NULL,

  signing_key_kid        text NOT NULL
                           REFERENCES newsroom_signing_keys(kid)
                           ON DELETE RESTRICT,
  signed_at              timestamptz NOT NULL DEFAULT now(),
  signature              text NOT NULL,

  receipt_url            text NOT NULL,

  created_at             timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ──

  CONSTRAINT newsroom_dr_distribution_event_unique
    UNIQUE (distribution_event_id),

  CONSTRAINT newsroom_dr_receipt_url_unique UNIQUE (receipt_url),

  -- 64 lowercase hex chars.  Same format as NR-D1
  -- newsroom_assets.checksum_sha256.
  CONSTRAINT newsroom_dr_content_hash_format CHECK (
    length(content_hash_sha256) = 64
    AND content_hash_sha256 ~ '^[0-9a-f]{64}$'
  ),

  CONSTRAINT newsroom_dr_credit_line_nonempty CHECK (
    length(credit_line) > 0
  ),

  CONSTRAINT newsroom_dr_terms_summary_nonempty CHECK (
    length(terms_summary) > 0
  ),

  CONSTRAINT newsroom_dr_signature_nonempty CHECK (
    length(signature) > 0
  ),

  -- Shape: https://{host}/receipts/{id-or-slug}.  NR-D10 will
  -- standardise on the id uuid; keeping the pattern flexible
  -- here to avoid early coupling.
  CONSTRAINT newsroom_dr_receipt_url_format CHECK (
    receipt_url ~ '^https://[a-z0-9.-]+/receipts/[A-Za-z0-9_-]+$'
  )
);

COMMENT ON TABLE newsroom_download_receipts IS
  'Tamper-evident download receipt — 1:1 with the download-'
  'subset of newsroom_distribution_events.  Snapshot columns '
  '(licence_class, credit_line, terms_summary, '
  'content_hash_sha256, signing_key_kid) captured at download '
  'time and frozen.  Immutable: no updated_at, no UPDATE '
  'policy.  recipient_id SET NULL on delete for GDPR erasure.';

COMMENT ON COLUMN newsroom_download_receipts.signing_key_kid IS
  'Kid of the signing key that signed this receipt — FK to '
  'newsroom_signing_keys(kid) ON DELETE RESTRICT so the key '
  'row (and its public_key_pem) remains retrievable for '
  'independent verification, even after rotation or revocation.';

-- ── Indexes ──

-- Per-pack receipt listing (PRD P4 admin view, PRD P14 analytics).
CREATE INDEX idx_newsroom_dr_pack_time
  ON newsroom_download_receipts (pack_id, signed_at DESC);

-- Key-rotation inspection — "how many receipts did this key
-- sign?" (NR-D17 admin query).
CREATE INDEX idx_newsroom_dr_signing_key
  ON newsroom_download_receipts (signing_key_kid);

-- NO trigger — receipts are immutable, no updated_at column.


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  RLS POLICIES                                           │
-- │                                                             │
-- │  Enable RLS on all three new tables.  Attach SELECT-only    │
-- │  policies where authenticated or anon reads are authorised. │
-- │  NO INSERT / UPDATE / DELETE policies on ANY table —        │
-- │  mutations routed through service_role RPCs in NR-D10 and   │
-- │  beyond.  Reuses the NR-D1 helper                           │
-- │  is_newsroom_editor_or_admin(uuid); no new helpers.         │
-- │                                                             │
-- │  POSTURE SUMMARY:                                           │
-- │    - signing_keys: RLS enabled, ZERO policies = deny-all    │
-- │      for non-service_role.  Deliberate:                     │
-- │        * Public-key material served by                      │
-- │          /.well-known/receipt-keys (NR-D10), which runs     │
-- │          with service_role credentials and selects only     │
-- │          the public columns (kid, algorithm, public_key_pem,│
-- │          status) of non-revoked rows.                       │
-- │        * Admin-side reads land with admin infrastructure    │
-- │          in NR-D17 (a security-role policy will be added    │
-- │          there).                                            │
-- │        * private_key_ref must NEVER be readable by any      │
-- │          authenticated session, even admins; only the       │
-- │          signing server (service_role) needs it.            │
-- │    - distribution_events: visible to editors/admins of the  │
-- │      pack's company (drives P14 analytics).  Anon does not  │
-- │      see events.  Journalist view of own events (J8 export  │
-- │      history) uses service_role via API route (query        │
-- │      filters on recipient_id = caller's recipient id).      │
-- │    - download_receipts: publicly readable per PRD Part 5    │
-- │      §5.1 P4 — receipt URLs are intentionally public so     │
-- │      any party can independently verify a credit_line,      │
-- │      licence_class, hash, kid, and signature.  Recipient    │
-- │      identity is NOT exposed in the raw row — recipient_id  │
-- │      is a uuid with no public resolution path (the NR-D2b   │
-- │      newsroom_recipients RLS blocks anon SELECT).  The PRD  │
-- │      P4 UI renders a masked email via a service-role side   │
-- │      channel.                                               │
-- │                                                             │
-- │  service_role bypasses RLS by default (Supabase convention) │
-- │  and is what server-side signing, event writers, admin      │
-- │  queues, and key-rotation workflows use for the operations  │
-- │  not granted to authenticated below.                        │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE newsroom_signing_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_distribution_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_download_receipts    ENABLE ROW LEVEL SECURITY;

-- ── newsroom_signing_keys ──
--
-- NO POLICIES.  RLS enabled + zero policies = deny-all for
-- authenticated and anon.  See posture comment above.

-- INSERT / UPDATE / DELETE: service_role only (key lifecycle
-- managed by NR-D10 key-rotate RPC).

-- ── newsroom_distribution_events ──

-- Editors / admins of the pack's company see events on their
-- own packs (drives PRD P14 analytics).  Anon does not see
-- events.  Journalist own-events view (J8) uses service_role
-- via API route with recipient_id filter.
CREATE POLICY newsroom_de_select_org
  ON newsroom_distribution_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM newsroom_packs p
      WHERE p.id = newsroom_distribution_events.pack_id
        AND is_newsroom_editor_or_admin(p.company_id)
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (events emitted
-- by server-side writer in NR-D10 and beyond).  UPDATE is
-- also prevented structurally — no updated_at column, events
-- immutable after insert.

-- ── newsroom_download_receipts ──

-- Publicly readable per PRD Part 5 §5.1 P4 (signed-receipt
-- view).  Receipt content (credit_line, licence_class, hash,
-- kid, signature) is intentionally public: inspection-required
-- for independent verification of provenance.  Recipient
-- identity is NOT exposed via this row — recipient_id is a
-- uuid whose corresponding newsroom_recipients row is gated
-- by the NR-D2b RLS policy (anon cannot SELECT).  The P4 UI
-- renders a masked email via service-role side channel.
CREATE POLICY newsroom_dr_select_public
  ON newsroom_download_receipts
  FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE: service_role only (receipts
-- emitted by NR-D10 signing RPC).  Immutability enforced at
-- both application and database layers — no updated_at
-- column, no UPDATE policy.
