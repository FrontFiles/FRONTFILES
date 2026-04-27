/**
 * Frontfiles Upload V4 — Field Provenance Tag (D2.9 Move 8)
 *
 * Spec: D2.9-DIRECTIVE.md §3 Move 8 — every editable field carries a quiet
 * provenance signal so creators can tell where the value came from at a
 * glance: AI-generated (auto-accepted or proposal-as-ghost) vs creator-edited.
 *
 * Render rules (per directive Move 8 state machine):
 *   - source === 'creator'                             → "Edited by creator"
 *   - source === 'ai'                                  → "AI generated"
 *   - source === undefined && hasProposal === true     → "AI generated"
 *                                                        (input is showing
 *                                                        the proposal as a
 *                                                        muted ghost value)
 *   - else                                             → null (no tag)
 *
 * 'embedded' / 'extracted' sources fall through to null intentionally —
 * D2.9 doesn't surface IPTC/EXIF provenance in the inspector. Future
 * extension: add a "From file metadata" tag if/when that becomes useful.
 */

'use client'

import type { MetadataSource } from '@/lib/upload/v3-types'

interface Props {
  source: MetadataSource | undefined
  hasProposal: boolean
}

export default function FieldProvenanceTag({ source, hasProposal }: Props) {
  if (source === 'creator') {
    return (
      <span className="text-[10px] italic text-slate-600 leading-none">
        Edited by creator
      </span>
    )
  }
  if (source === 'ai' || (source === undefined && hasProposal)) {
    return (
      <span className="text-[10px] italic text-slate-500 leading-none">
        AI generated
      </span>
    )
  }
  return null
}
