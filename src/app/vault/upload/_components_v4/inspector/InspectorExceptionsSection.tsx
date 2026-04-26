/**
 * Frontfiles Upload V4 — Inspector Exceptions Section (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §5.3 (Exceptions section is collapsible per L7) +
 * IPD4-3 default = (a) closed by default.
 *
 * Adapted from C2.6's SideDetailPanel ExceptionsSection (now dormant).
 * Lists active exceptions for the open asset (filtered to drop needs_story
 * per UX-BRIEF v3 §4.5). Embeds DuplicateResolver for likely_duplicate
 * status + ConflictResolver for unresolved metadata conflicts.
 *
 * DuplicateResolver is reused as-is from the C2 spine (still in
 * src/app/vault/upload/_components/ — not dormant).
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from '../../_components/UploadContext'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset, MetadataConflict } from '@/lib/upload/v3-types'
import DuplicateResolver from '../../_components/DuplicateResolver'

interface Props {
  asset: V2Asset
}

export default function InspectorExceptionsSection({ asset }: Props) {
  const { state } = useUploadContext()
  const [open, setOpen] = useState(false)

  const exceptions = getAssetExceptions(asset).filter(e => e.type !== 'needs_story')
  const hasDuplicate = asset.duplicateStatus === 'likely_duplicate'
  const otherDup = asset.duplicateOfId ? state.assetsById[asset.duplicateOfId] : null
  const conflicts = asset.conflicts.filter(c => c.resolvedBy === null)

  const totalIssues = exceptions.length + (hasDuplicate ? 1 : 0) + conflicts.length

  return (
    <div className="border-b border-black flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>{open ? '▼' : '▶'}</span>
          <span>Exceptions</span>
        </span>
        <span className="text-slate-500 font-mono">{totalIssues}</span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {totalIssues === 0 ? (
            <div className="text-xs text-slate-500 italic">No active exceptions.</div>
          ) : (
            <>
              {exceptions.length > 0 && (
                <ul className="flex flex-col gap-0.5 mb-2">
                  {exceptions.map((e, i) => (
                    <li
                      key={`${e.type}-${i}`}
                      className={`text-xs ${e.severity === 'blocking' ? 'text-black' : 'text-slate-600'}`}
                    >
                      {e.severity === 'blocking' ? '⚠' : 'ℹ'} {e.label}
                    </li>
                  ))}
                </ul>
              )}

              {hasDuplicate && otherDup && (
                <DuplicateResolver thisAsset={asset} otherAsset={otherDup} />
              )}

              {conflicts.map((conflict, i) => (
                <ConflictResolver
                  key={`${String(conflict.field)}-${i}`}
                  asset={asset}
                  conflict={conflict}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ConflictResolver({ asset, conflict }: { asset: V2Asset; conflict: MetadataConflict }) {
  const { dispatch } = useUploadContext()
  return (
    <div className="border border-black p-2 mt-2 bg-yellow-50">
      <div className="text-[10px] font-bold uppercase tracking-widest text-black mb-1">
        Metadata conflict — {String(conflict.field)}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_CONFLICT',
              assetId: asset.id,
              field: conflict.field,
              value: conflict.embeddedValue,
            })
          }
          className="text-xs text-left border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors"
        >
          Use embedded: <span className="font-mono">{conflict.embeddedValue}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_CONFLICT',
              assetId: asset.id,
              field: conflict.field,
              value: conflict.aiValue,
            })
          }
          className="text-xs text-left border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors"
        >
          Use AI ({Math.round(conflict.aiConfidence * 100)}%):{' '}
          <span className="font-mono">{conflict.aiValue}</span>
        </button>
      </div>
    </div>
  )
}
