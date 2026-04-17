-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Row-Level Security (v1 core)
--
-- Strategy:
--   - RLS is already ENABLED on every public-schema table by earlier
--     migrations. Without policies, all non-service-role access is DENIED
--     by default — the SAFE starting state.
--   - This migration adds MINIMUM policies needed for client-side code
--     (anon + authenticated) to access the core tables they touch.
--   - Service role continues to bypass RLS entirely (no policy needed for
--     service role — it's the implicit superuser for this layer).
--   - 23 of 37 tables remain deny-by-default for anon + authenticated.
--     They are reachable only via server-side service-role code. Future
--     migrations will extend RLS per-feature as client paths need them.
--
-- Tables covered (14):
--   users, creator_profiles, buyer_accounts, vault_assets, asset_media,
--   posts, licence_grants, transactions, upload_batches, companies,
--   company_memberships, assignments, direct_offer_threads, download_events
--
-- Tables NOT yet covered (service-role only):
--   assignment_dispute_cases, assignment_events, assignment_rights_records,
--   buyer_company_memberships, ccr_amended_fields,
--   certified_package_artifacts, certified_package_items,
--   certified_packages, commission_change_requests, direct_offer_events,
--   escrow_records, evidence_items, external_connections,
--   external_credentials, external_webhook_events, fulfilment_submissions,
--   milestones, offer_checkout_intents, review_records, service_logs,
--   transaction_line_items, user_granted_types, watermark_profiles
--
-- All policies are idempotent: DROP POLICY IF EXISTS before CREATE.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  users                                                  │
-- │                                                             │
-- │  Public read of all user rows — profile pages are public    │
-- │  by design. Self-update only for the authenticated user's   │
-- │  own row.                                                   │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS users_anon_read ON users;
CREATE POLICY users_anon_read ON users
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS users_auth_read ON users;
CREATE POLICY users_auth_read ON users
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  creator_profiles                                       │
-- │                                                             │
-- │  Extended creator profile. Public read; self-manage.        │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS creator_profiles_anon_read ON creator_profiles;
CREATE POLICY creator_profiles_anon_read ON creator_profiles
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS creator_profiles_auth_read ON creator_profiles;
CREATE POLICY creator_profiles_auth_read ON creator_profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS creator_profiles_self_insert ON creator_profiles;
CREATE POLICY creator_profiles_self_insert ON creator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_profiles_self_update ON creator_profiles;
CREATE POLICY creator_profiles_self_update ON creator_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  buyer_accounts                                         │
-- │                                                             │
-- │  Private per-user buyer info. SELF only, all operations.    │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS buyer_accounts_self_read ON buyer_accounts;
CREATE POLICY buyer_accounts_self_read ON buyer_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS buyer_accounts_self_insert ON buyer_accounts;
CREATE POLICY buyer_accounts_self_insert ON buyer_accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS buyer_accounts_self_update ON buyer_accounts;
CREATE POLICY buyer_accounts_self_update ON buyer_accounts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  vault_assets                                           │
-- │                                                             │
-- │  Public readability gated on privacy_state = 'PUBLIC' AND   │
-- │  publication_state = 'PUBLISHED'. Creator has full CRUD on  │
-- │  their own assets regardless of state.                      │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS vault_assets_anon_read_public ON vault_assets;
CREATE POLICY vault_assets_anon_read_public ON vault_assets
  FOR SELECT TO anon
  USING (privacy_state = 'PUBLIC' AND publication_state = 'PUBLISHED');

DROP POLICY IF EXISTS vault_assets_auth_read ON vault_assets;
CREATE POLICY vault_assets_auth_read ON vault_assets
  FOR SELECT TO authenticated
  USING (
    (privacy_state = 'PUBLIC' AND publication_state = 'PUBLISHED')
    OR creator_id = auth.uid()
  );

DROP POLICY IF EXISTS vault_assets_creator_insert ON vault_assets;
CREATE POLICY vault_assets_creator_insert ON vault_assets
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS vault_assets_creator_update ON vault_assets;
CREATE POLICY vault_assets_creator_update ON vault_assets
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS vault_assets_creator_delete ON vault_assets;
CREATE POLICY vault_assets_creator_delete ON vault_assets
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §5  asset_media                                            │
-- │                                                             │
-- │  Read follows vault_assets visibility via asset_id FK.      │
-- │  Writes are service-role only (processing pipeline owns     │
-- │  this table).                                               │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS asset_media_anon_read ON asset_media;
CREATE POLICY asset_media_anon_read ON asset_media
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM vault_assets va
    WHERE va.id = asset_media.asset_id
      AND va.privacy_state = 'PUBLIC'
      AND va.publication_state = 'PUBLISHED'
  ));

DROP POLICY IF EXISTS asset_media_auth_read ON asset_media;
CREATE POLICY asset_media_auth_read ON asset_media
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vault_assets va
    WHERE va.id = asset_media.asset_id
      AND (
        (va.privacy_state = 'PUBLIC' AND va.publication_state = 'PUBLISHED')
        OR va.creator_id = auth.uid()
      )
  ));


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §6  posts (FFF broadcast layer)                            │
-- │                                                             │
-- │  visibility enum: public, connections                       │
-- │  status enum: published, removed, hidden_by_author          │
-- │                                                             │
-- │  'connections' visibility is deferred to v2 (social mode).  │
-- │  Only 'public' + 'published' is exposed to anon.            │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS posts_anon_read_public ON posts;
CREATE POLICY posts_anon_read_public ON posts
  FOR SELECT TO anon
  USING (visibility = 'public' AND status = 'published');

DROP POLICY IF EXISTS posts_auth_read ON posts;
CREATE POLICY posts_auth_read ON posts
  FOR SELECT TO authenticated
  USING (
    (visibility = 'public' AND status = 'published')
    OR author_user_id = auth.uid()
  );

DROP POLICY IF EXISTS posts_author_insert ON posts;
CREATE POLICY posts_author_insert ON posts
  FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS posts_author_update ON posts;
CREATE POLICY posts_author_update ON posts
  FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS posts_author_delete ON posts;
CREATE POLICY posts_author_delete ON posts
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §7  licence_grants                                         │
-- │                                                             │
-- │  Read: buyer OR creator party to the grant.                 │
-- │  Writes: service role only (grants are minted by webhook    │
-- │  handlers and admin actions, never client-side).            │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS licence_grants_participant_read ON licence_grants;
CREATE POLICY licence_grants_participant_read ON licence_grants
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR creator_id = auth.uid()
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §8  transactions                                           │
-- │                                                             │
-- │  Read: buyer user of the transaction.                       │
-- │  Writes: service role only (transactions created by         │
-- │  checkout + webhook handlers).                              │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS transactions_buyer_read ON transactions;
CREATE POLICY transactions_buyer_read ON transactions
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid());


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §9  upload_batches                                         │
-- │                                                             │
-- │  Creator RW own only.                                       │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS upload_batches_creator_read ON upload_batches;
CREATE POLICY upload_batches_creator_read ON upload_batches
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS upload_batches_creator_insert ON upload_batches;
CREATE POLICY upload_batches_creator_insert ON upload_batches
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS upload_batches_creator_update ON upload_batches;
CREATE POLICY upload_batches_creator_update ON upload_batches
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §10  companies                                             │
-- │                                                             │
-- │  Read: any ACTIVE member of the company.                    │
-- │  Writes: service role only (admin actions via server API).  │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS companies_member_read ON companies;
CREATE POLICY companies_member_read ON companies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  ));


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §11  company_memberships                                   │
-- │                                                             │
-- │  Read: user sees own memberships AND active members of      │
-- │  companies they are active in.                              │
-- │  Writes: service role only for v1.                          │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS company_memberships_member_read ON company_memberships;
CREATE POLICY company_memberships_member_read ON company_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM company_memberships self
      WHERE self.user_id = auth.uid()
        AND self.company_id = company_memberships.company_id
        AND self.status = 'active'
    )
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §12  assignments                                           │
-- │                                                             │
-- │  Read: buyer OR creator party to the assignment.            │
-- │  Writes: service role only (state transitions via API).     │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS assignments_participant_read ON assignments;
CREATE POLICY assignments_participant_read ON assignments
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR creator_id = auth.uid()
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §13  direct_offer_threads                                  │
-- │                                                             │
-- │  Read: buyer OR creator on the thread.                      │
-- │  Writes: service role only (offer lifecycle transitions via │
-- │  /api/direct-offer/*).                                      │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS direct_offer_threads_participant_read ON direct_offer_threads;
CREATE POLICY direct_offer_threads_participant_read ON direct_offer_threads
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR creator_id = auth.uid()
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §14  download_events                                       │
-- │                                                             │
-- │  Read: self only (users see their own download history).    │
-- │  Writes: service role only (events appended by the media    │
-- │  delivery endpoint after every authorisation check).        │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS download_events_self_read ON download_events;
CREATE POLICY download_events_self_read ON download_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- END OF v1 RLS CORE POLICIES
--
-- Policies created: 37 across 14 tables.
-- Tables still deny-by-default (23): see header for list.
--
-- Validation:
--   After this migration, run the CCP 2 test cases (a-e) to verify
--   the policies behave correctly under anon, authenticated (self),
--   authenticated (other user), and service_role contexts.
-- ════════════════════════════════════════════════════════════════
