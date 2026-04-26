/**
 * Frontfiles Upload V3 — Duplicate Resolver (C2.3 §1.1)
 *
 * Spec: UX-SPEC-V3.md §7.2.
 *
 * Renders inside SideDetailPanel's exceptions section when an asset has
 * `duplicateStatus === 'likely_duplicate'` and a non-null `duplicateOfId`.
 * Side-by-side thumbnail comparison + two resolution actions:
 *
 *   "Keep both"                  → RESOLVE_DUPLICATE { kind: 'keep_both' }
 *   "Mark this one as duplicate" → RESOLVE_DUPLICATE { kind: 'mark_as_duplicate' }
 *
 * Per spec §7.2: marking-as-duplicate sets `duplicate_of_id` to the other
 * asset; the marked asset is then excluded from commit (DB CHECK constraint
 * enforces). Reducer handles the state mutation; this component is wire-only.
 */

'use client'

import { useUploadContext } from './UploadContext'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  thisAsset: V2Asset
  otherAsset: V2Asset
}

const ACTION_BTN =
  'text-xs text-left border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors w-full'

export default function DuplicateResolver({ thisAsset, otherAsset }: Props) {
  const { dispatch } = useUploadContext()

  return (
    <div className="border border-black p-2 mt-2 bg-white">
      <div className="text-[10px] font-bold uppercase tracking-widest text-black mb-2">
        ⚠ Possible duplicate of:
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2 min-w-0">
        <ThumbCell asset={thisAsset} label="This asset" />
        <ThumbCell asset={otherAsset} label="Other asset" />
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_DUPLICATE',
              assetId: thisAsset.id,
              kind: 'keep_both',
              otherAssetId: otherAsset.id,
            })
          }
          className={ACTION_BTN}
        >
          Keep both
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_DUPLICATE',
              assetId: thisAsset.id,
              kind: 'mark_as_duplicate',
              otherAssetId: otherAsset.id,
            })
          }
          className={ACTION_BTN}
        >
          Mark this one as duplicate of that one
        </button>
      </div>
    </div>
  )
}

function ThumbCell({ asset, label }: { asset: V2Asset; label: string }) {
  return (
    <div className="border border-black bg-slate-100 p-1 min-w-0">
      <div className="aspect-square bg-slate-200 mb-1 flex items-center justify-center text-[8px] uppercase text-slate-400 overflow-hidden">
        {asset.thumbnailRef ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailRef}
            alt={asset.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          asset.format ?? '—'
        )}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-xs font-mono text-black truncate" title={asset.filename}>
        {asset.filename}
      </div>
    </div>
  )
}
