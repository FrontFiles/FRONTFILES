/**
 * Frontfiles Upload V4 — Compare Card (D2.6 §6)
 *
 * Spec: UX-SPEC-V4 §10.2 (per-side anatomy) + D2.6-DIRECTIVE §6.
 *
 * One side of the 2-up compare view. Intentionally minimal per spec:
 *   - 16:9 large preview (object-contain, max-w 800)
 *   - Filename below
 *
 * Per IPD6-2 = (a) ratified: NOT a full inspector embedding. To edit
 * fields, the user exits compare and selects the asset normally.
 *
 * Per IPD6-4 = (a) ratified: card is read-only — no click handlers.
 *
 * Object-URL hygiene mirrors InspectorThumbnail (IPD3-9): prefer
 * thumbnailRef, fall back to URL.createObjectURL(asset.file), do NOT
 * revoke on unmount (URLs shared across surfaces).
 */

'use client'

import { useMemo } from 'react'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function CompareCard({ asset }: Props) {
  const url = useMemo<string | null>(() => {
    if (asset.thumbnailRef) return asset.thumbnailRef
    if (asset.file) {
      try {
        return URL.createObjectURL(asset.file)
      } catch {
        return null
      }
    }
    return null
  }, [asset.thumbnailRef, asset.file])

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 min-w-0 min-h-0 overflow-hidden">
      {/* 16:9 preview, capped at 800px wide so two columns fit comfortably
          on wide viewports while still scaling down on narrow ones. */}
      <div className="aspect-video w-full max-w-[800px] bg-slate-100 border border-black overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={asset.filename}
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        ) : (
          <div className="text-center px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {asset.format ?? 'asset'} preview unavailable
            </div>
          </div>
        )}
      </div>

      {/* Filename caption, mono small, truncated if very long. */}
      <span
        className="text-xs font-mono text-black truncate max-w-full"
        title={asset.filename}
      >
        {asset.filename}
      </span>
    </div>
  )
}
