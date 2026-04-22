/**
 * Frontfiles — Rights template registry + validator (P4 concern
 * 4A.2 Part A)
 *
 * Three counsel-reviewed template identifiers + the `custom` flag
 * (spec §F15). Part A ships IDENTIFIER + LABEL + TRANSFER-FLAG
 * only — counsel-final template bodies (clause copy, default params,
 * jurisdictional carve-outs) land in Part C2 per directive §D
 * dispatch gate. Do not bloat this file with placeholder copy.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_DIRECTIVE.md §DELIVERABLES for
 *     rights.ts, §D for the counsel gating Part C2 dispatch,
 *     D9 for the "tighten `rights` in the offer lib, NOT in
 *     `src/lib/ledger/schemas.ts`" decision.
 *   - docs/audits/P4_CONCERN_4A_1_DIRECTIVE.md §EXIT REPORT 10(d)
 *     — `rights` / `rights_diff` typed as `z.unknown()` pending
 *     4A.2 tightening. This file closes 10(d) for the offer
 *     surface; assignment / dispute `rights_diff` remain deferred
 *     to 4A.3 / 4A.4.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §F7 — custom templates
 *     "flagged for admin review"; the flag here is a boolean on
 *     the parse result, not a DB side-effect.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §F15 — v1 template set.
 *
 * Namespace import shape: `import * as z from 'zod'` per 4A.1
 * D-decision (bundler safety across Next.js + Vitest 4 + Bun).
 */

import * as z from 'zod'

import type { Rights, RightsTemplateId } from './types'

// ─── Registry ─────────────────────────────────────────────────────
//
// Exactly four entries — three counsel-reviewed ids + `custom`.
// Each carries { id, label, is_transfer } and NOTHING ELSE in
// Part A. Adding `default_params`, `terms`, or any clause copy here
// without counsel sign-off would regress directive §D.
export const RIGHTS_TEMPLATES: Readonly<
  Record<RightsTemplateId, {
    id: RightsTemplateId
    label: string
    is_transfer: boolean
  }>
> = {
  editorial_one_time: {
    id: 'editorial_one_time',
    label: 'Editorial — one-time use',
    is_transfer: false,
  },
  editorial_with_archive_12mo: {
    id: 'editorial_with_archive_12mo',
    label: 'Editorial — one-time use + 12-month archive',
    is_transfer: false,
  },
  commercial_restricted: {
    id: 'commercial_restricted',
    label: 'Commercial — restricted scope',
    is_transfer: false,
  },
  custom: {
    id: 'custom',
    label: 'Custom — flagged for admin review',
    is_transfer: false,
  },
} as const

// ─── Zod schema ───────────────────────────────────────────────────
//
// Admits any of the four template ids; `params` is an open record
// in Part A (counsel-final shape is unlocked here). Tightens in
// Part C2 once template bodies ship.
const TemplateIdSchema = z.enum([
  'editorial_one_time',
  'editorial_with_archive_12mo',
  'commercial_restricted',
  'custom',
])

export const RightsSchema = z
  .object({
    template: TemplateIdSchema,
    params: z.record(z.string(), z.unknown()),
    is_transfer: z.boolean(),
  })
  .strict()

// ─── Validator ────────────────────────────────────────────────────

export type ValidateRightsResult =
  | { ok: true; rights: Rights; needsAdminReview: boolean }
  | { ok: false; reason: string }

/**
 * Parse an opaque `rights` value into a typed Rights object.
 * `template === 'custom'` entries are admitted but the return
 * carries `needsAdminReview: true` so the caller can flag them
 * per §F7. The flag is advisory; DB side-effects live downstream
 * (admin queue wiring is 4A.3+).
 */
export function validateRights(rights: unknown): ValidateRightsResult {
  const parsed = RightsSchema.safeParse(rights)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { ok: false, reason: issues }
  }
  return {
    ok: true,
    rights: parsed.data,
    needsAdminReview: parsed.data.template === 'custom',
  }
}
