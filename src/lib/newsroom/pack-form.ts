/**
 * Frontfiles — Pack-form zod schemas (NR-D6b, F7b)
 *
 * Server-only zod schemas for the create + update Pack flows.
 * Imported by F5 (POST) and F6 (PATCH); test-imported by F8.
 *
 * `'server-only'` is enforced here because zod is a server-side
 * concern in this directive — the API routes parse incoming JSON
 * bodies, the client form (F4) does its own client-side hint
 * validation against the constants in F7a (pack-form-constants).
 * IP-1 ratified the split; see F7a for the full rationale.
 *
 * Licence-class enum values are duplicated here from
 * src/lib/newsroom/licence-classes.ts as a const tuple for zod
 * typing (z.enum requires a literal-tuple shape). Both lists
 * derive from the same migration enum
 * (`newsroom_licence_class`) — drift between them is a typing
 * foot-gun. Keep them synced.
 *
 * Spec cross-references:
 *   - directives/NR-D6b-pack-creation-details-tab.md §F7
 *   - src/lib/newsroom/pack-form-constants.ts (F7a)
 *   - src/lib/newsroom/licence-classes.ts (NR-D4 source of truth)
 */

import 'server-only'

import * as z from 'zod'

import type { NewsroomLicenceClass } from '@/lib/db/schema'

import {
  PACK_CREDIT_LINE_MAX,
  PACK_DESCRIPTION_MAX,
  PACK_SLUG_MAX,
  PACK_SUBTITLE_MAX,
  PACK_TITLE_MAX,
  SLUG_FORMAT,
} from './pack-form-constants'

// ── Licence enum (must stay synced with migration enum) ──

const LICENCE_VALUES = [
  'press_release_verbatim',
  'editorial_use_only',
  'promotional_use',
  'cc_attribution',
  'cc_public_domain',
] as const satisfies ReadonlyArray<NewsroomLicenceClass>

// ── Schemas ────────────────────────────────────────────────────

/**
 * Schema for POST /api/newsroom/orgs/[orgSlug]/packs.
 *
 * All required fields enforced; subtitle is the only optional
 * column. zod returns parsed-out types, so the route can pass
 * `parsed.data` straight to the INSERT (after companyId +
 * created_by_user_id are layered in server-side).
 */
export const createPackSchema = z.object({
  title: z.string().min(1).max(PACK_TITLE_MAX),
  subtitle: z.string().max(PACK_SUBTITLE_MAX).nullable().optional(),
  description: z.string().min(1).max(PACK_DESCRIPTION_MAX),
  credit_line: z.string().min(1).max(PACK_CREDIT_LINE_MAX),
  licence_class: z.enum(LICENCE_VALUES),
  slug: z.string().regex(SLUG_FORMAT).max(PACK_SLUG_MAX),
})

export type CreatePackInput = z.infer<typeof createPackSchema>

/**
 * Schema for PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug].
 *
 * All fields optional; refine layer rejects empty bodies so the
 * client can't send a no-op request. Field-level validation is
 * the same as create — same min/max, same enum, same regex.
 *
 * Mutability locks for credit_line + licence_class post-publish
 * are NR-D9 scope; this directive only handles draft edits, so
 * partial-update semantics are unrestricted.
 */
export const updatePackSchema = createPackSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided.' },
)

export type UpdatePackInput = z.infer<typeof updatePackSchema>
