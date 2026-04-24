/**
 * Frontfiles — Newsroom P1 signup Zod schema (NR-D5a, F4)
 *
 * Shared between the client form (UX-hint validation) and the
 * server API route (trust-boundary re-validation). Pure data — no
 * runtime side effects, no server-only imports — so it is safe to
 * import from either side of the client/server boundary.
 *
 * The schema below is bound verbatim to NR-D5a §SCHEMA and mirrors
 * the PRD §5.1 P1 field semantics. Error messages match the P1
 * copy where the PRD prescribes one; field-format messages are
 * phrased for inline UX.
 *
 * References:
 *   - docs/public-newsroom/PRD.md §5.1 P1 (field copy + validation)
 *   - docs/public-newsroom/directives/NR-D5a-p1-signup.md §SCHEMA
 *   - supabase/migrations/20260425000001_newsroom_schema_foundation.sql
 *     L145-147 (primary_domain CHECK regex — identical to the
 *     regex below, so a schema-accepted domain will never fail the
 *     DB-side CHECK)
 *   - supabase/migrations/20260413230015_companies_and_memberships.sql
 *     L131 (country_code CHECK ^[A-Z]{2}$ — matches `countryCode`
 *     regex below after the .toUpperCase() transform)
 *
 * Note on termsAccepted: the `z.literal('on')` shape matches the
 * HTML checkbox FormData convention. The client form encodes the
 * checkbox as 'on' | undefined before submitting so the wire shape
 * matches this schema on both sides.
 */

import * as z from 'zod'

export const SignupSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(1, 'Organisation name is required')
    .max(120, 'Organisation name is too long'),
  legalName: z
    .string()
    .trim()
    .min(1, 'Registered legal name is required')
    .max(200, 'Legal name is too long'),
  primaryDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
      'Enter a valid domain (e.g. acme.com)',
    ),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Select a country'),
  termsAccepted: z.literal('on', {
    errorMap: () => ({
      message:
        'You must accept the Distributor Terms and Content Standards',
    }),
  }),
})

export type SignupInput = z.infer<typeof SignupSchema>
