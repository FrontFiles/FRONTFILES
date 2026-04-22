-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260421000001_relocate_buyer_company_role.sql
--
-- Reverses the column-type swap on both membership tables back to
-- public.buyer_company_role, then drops the now-unused identity-
-- layer type. The dependent policy `companies_admin_update` is
-- dropped and recreated symmetrically with M1 UP.
--
-- Only meaningful if M3 has NOT yet dropped
-- public.buyer_company_role (M3 is forward-only; once M3 commits,
-- the DOWN path for M1 is out-of-band per plan §4.2 M3).
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M1 rollback
-- ════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS companies_admin_update ON public.companies;

ALTER TABLE public.company_memberships
  ALTER COLUMN role
    TYPE public.buyer_company_role
    USING role::text::public.buyer_company_role;

ALTER TABLE public.buyer_company_memberships
  ALTER COLUMN role
    TYPE public.buyer_company_role
    USING role::text::public.buyer_company_role;

DROP TYPE public.identity_buyer_company_role;

CREATE POLICY companies_admin_update ON public.companies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role = 'admin'
  ));

COMMIT;
