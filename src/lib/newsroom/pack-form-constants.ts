/**
 * Frontfiles — Pack-form constants + slugify (NR-D6b, F7a)
 *
 * Client-safe foundation for the Pack Details form. Contains the
 * length caps, the slug-format regex, and the slugify helper.
 * NO `'server-only'` marker — F4 (the `'use client'` Details
 * form) imports SLUG_FORMAT and the max-length constants for
 * client-side validation hints.
 *
 * Zod schemas live next door in `pack-form.ts` (F7b) which IS
 * `'server-only'`. The split was ratified pre-composition as
 * IP-1: a value import of constants from a server-only module
 * breaks Next.js's client/server module-graph boundary, so
 * constants get their own boundary-free home.
 *
 * SLUG_FORMAT mirrors the migration's CHECK constraint
 * `newsroom_packs_slug_format` at
 * supabase/migrations/20260425000001_newsroom_schema_foundation.sql:309
 * — the regex must stay synced with the DB constraint or the
 * application-side validation drifts from what the table accepts.
 *
 * Spec cross-references:
 *   - directives/NR-D6b-pack-creation-details-tab.md §F7
 *   - migration newsroom_packs_slug_format CHECK
 */

// ── Length caps ────────────────────────────────────────────────

export const PACK_TITLE_MAX = 200
export const PACK_SUBTITLE_MAX = 200
export const PACK_DESCRIPTION_MAX = 5000
export const PACK_CREDIT_LINE_MAX = 200
export const PACK_SLUG_MAX = 60

// ── Slug format ────────────────────────────────────────────────

/**
 * Slug format: lowercase alphanumeric + hyphens, 1–60 chars,
 * no leading/trailing hyphens, no doubled hyphens at the
 * boundaries (the inner middle can have any hyphen pattern).
 *
 * MUST match migration's newsroom_packs_slug_format CHECK
 * constraint exactly. Drift here is a data-layer foot-gun.
 */
export const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/

// ── Slugify ────────────────────────────────────────────────────

const FALLBACK_SLUG = 'pack'

/**
 * Slugify a Pack title for the URL slug.
 *
 * Pipeline:
 *   1. NFKD normalize (so accented characters decompose)
 *   2. Strip combining marks (e.g. "São Paulo" → "Sao Paulo")
 *   3. Lowercase
 *   4. Replace non-alphanumeric runs with a single hyphen
 *   5. Trim leading/trailing hyphens
 *   6. Truncate to PACK_SLUG_MAX
 *   7. Trim a hyphen left dangling by the truncation boundary
 *
 * If the result is empty (e.g. the title is all symbols), returns
 * 'pack' as a safe fallback so the slug always satisfies
 * SLUG_FORMAT and the form has a usable default. Manual edits
 * by the user can replace it.
 *
 * Output is guaranteed to satisfy SLUG_FORMAT — F8 covers this
 * with a property check across diverse inputs.
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining marks (Unicode block)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const truncated = normalized.slice(0, PACK_SLUG_MAX).replace(/-+$/, '')
  return truncated.length > 0 ? truncated : FALLBACK_SLUG
}
