/**
 * Frontfiles — Defensive caption truncation
 *
 * Per E1.5 §4.4 + E3-DIRECTIVE.md §14.5.2.
 *
 * Gemini structured output usually respects the 200-char cap (it's in the
 * prompt + the JSON schema implicitly enforces via max length on the
 * Zod validator), but the cap is binding (DB CHECK constraint on
 * asset_proposals.caption). If Gemini exceeds, truncate at last word
 * boundary ≤ 197 chars + "...". Logs a soft signal via audit_log so
 * prompt refinement can correlate.
 *
 * SERVER-ONLY.
 */

import { audit } from '@/lib/logger'

const CAP = 200
const TRUNCATE_TARGET = 197 // leaves room for "..."

export async function guardCaption(caption: string, assetId: string): Promise<string> {
  if (caption.length <= CAP) return caption

  const slice = caption.slice(0, TRUNCATE_TARGET)
  const lastSpace = slice.lastIndexOf(' ')
  const truncated = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '...'

  await audit({
    event_type: 'ai.gemini.caption_truncated',
    target_type: 'asset',
    target_id: assetId,
    metadata: {
      original_length: caption.length,
      truncated_length: truncated.length,
    },
  })

  return truncated
}
