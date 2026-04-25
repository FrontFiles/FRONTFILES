/**
 * Frontfiles — Asset-form zod schemas (NR-D7a, F7b)
 *
 * Server-only zod schemas for the Asset upload + metadata-edit
 * flows. Imported by F5 (POST) and F6 (PATCH); test-imported by
 * F8.
 *
 * `'server-only'` enforced here because zod is a server-side
 * concern in this directive. The client form (F3 upload-zone)
 * does its own validation against constants in F7a
 * (asset-form-constants). IP-2 ratified the split.
 *
 * Kind-specific dim invariants mirror the migration's CHECK
 * constraints on `newsroom_assets`:
 *   image → width + height required
 *   video → width + height + duration required
 *   audio → duration required
 *
 * The schema enforces these at the application layer so a bad
 * INSERT throws a clean zod error rather than a Postgres CHECK
 * violation surfaced as a 500.
 *
 * Spec cross-references:
 *   - directives/NR-D7a-asset-upload-storage-metadata.md §F7
 *   - migration newsroom_assets §5 (line 409, dim CHECKs at
 *     line 433/439/445)
 *   - src/lib/newsroom/asset-form-constants.ts (F7a)
 */

import 'server-only'

import * as z from 'zod'

import {
  ASSET_ALT_TEXT_MAX,
  ASSET_CAPTION_MAX,
  ASSET_MAX_BYTES,
} from './asset-form-constants'

// ── Asset kind enum (matches NewsroomAssetKind from schema.ts) ──

const ASSET_KIND_VALUES = [
  'image',
  'video',
  'audio',
  'document',
  'text',
] as const

// SHA-256 hex digest format. The migration enforces
// `length(checksum_sha256) = 64`; we additionally constrain
// to lowercase hex so a row never has to be re-canonicalised on
// read.
const SHA256_HEX = /^[a-f0-9]{64}$/

// ── Create schema ──────────────────────────────────────────────

/**
 * Schema for POST /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets.
 *
 * The body comes from F3 (upload-zone client) after it has:
 *   1. Validated MIME against ACCEPTED_MIME_TYPES
 *   2. Computed SHA-256 over file bytes
 *   3. Extracted kind-specific dimensions (image/video/audio)
 *
 * The kind-specific refines below mirror the DB CHECK constraints.
 * If a future migration relaxes them, sync the refines here too.
 */
export const createAssetSchema = z
  .object({
    filename: z.string().min(1).max(500),
    mime_type: z.string().min(1),
    file_size_bytes: z
      .number()
      .int()
      .positive()
      .max(ASSET_MAX_BYTES),
    checksum_sha256: z.string().regex(SHA256_HEX),
    kind: z.enum(ASSET_KIND_VALUES),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    duration_seconds: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'image') {
      if (data.width == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['width'],
          message: 'width is required for image assets',
        })
      }
      if (data.height == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['height'],
          message: 'height is required for image assets',
        })
      }
    }
    if (data.kind === 'video') {
      if (data.width == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['width'],
          message: 'width is required for video assets',
        })
      }
      if (data.height == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['height'],
          message: 'height is required for video assets',
        })
      }
      if (data.duration_seconds == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['duration_seconds'],
          message: 'duration_seconds is required for video assets',
        })
      }
    }
    if (data.kind === 'audio') {
      if (data.duration_seconds == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['duration_seconds'],
          message: 'duration_seconds is required for audio assets',
        })
      }
    }
  })

export type CreateAssetInput = z.infer<typeof createAssetSchema>

// ── Update-metadata schema ─────────────────────────────────────

/**
 * Schema for PATCH /api/newsroom/orgs/[orgSlug]/packs/[packSlug]/
 *                                              assets/[assetId].
 *
 * Only the three "metadata" fields are editable post-upload in
 * NR-D7a:
 *   - caption        (text, ≤ 500 chars)
 *   - alt_text       (text, ≤ 500 chars; required-for-images
 *                     enforced at publish time, NR-D9, not here)
 *   - is_trademark_asset  (boolean)
 *
 * Replacing an asset's bytes is v1.1 scope (delete + re-upload
 * is the v1 workflow). Replacing the slug is meaningless for
 * assets (they have no slug). All other column updates would
 * require re-running the upload pipeline.
 */
export const updateAssetMetadataSchema = z
  .object({
    caption: z.string().max(ASSET_CAPTION_MAX).nullable().optional(),
    alt_text: z.string().max(ASSET_ALT_TEXT_MAX).nullable().optional(),
    is_trademark_asset: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided.',
  })

export type UpdateAssetMetadataInput = z.infer<
  typeof updateAssetMetadataSchema
>
