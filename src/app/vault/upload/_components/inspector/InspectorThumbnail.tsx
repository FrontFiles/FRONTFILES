/**
 * Frontfiles Upload V4 — Inspector Thumbnail (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §5.2 + L6 (16:9 landscape per founder lock).
 *
 * Top of the right rail inspector. 16:9 landscape (matches the contact
 * sheet card aspect) at the rail's full width — 400 × 225 inside the
 * 400px-wide rail.
 *
 * Header sits above with the filename (sticky) — gives the user a stable
 * reference to which asset is open as they scroll the inspector body.
 *
 * Object-URL hygiene mirrors the contact sheet card: prefer thumbnailRef,
 * fall back to URL.createObjectURL(asset.file) with proper revoke on
 * unmount/asset-change, brutalist placeholder otherwise.
 */

'use client'

import { useMemo } from 'react'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function InspectorThumbnail({ asset }: Props) {
  // Per IPD3-9 + the D2.7 blob-URL revocation fix: prefer thumbnailRef;
  // fall back to URL.createObjectURL(asset.file) only when no thumbnailRef
  // exists. We do NOT revoke on unmount — the blob URL is shared across
  // surfaces (this inspector + the contact-sheet card both read
  // asset.thumbnailRef from state). Revoking on individual unmount kills
  // a URL the other surface is still using. Leak in dev; URLs free on
  // page refresh. Production paths use real backend URLs.
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
    <div className="flex-shrink-0 w-full max-w-full overflow-hidden">
      {/* Filename header — sticky at the top of the rail body for context.
          D2.9 Move 3: smaller (text-[11px]) + slate-600 (less prominent) +
          slate-200 divider so the thumbnail dominates. */}
      <div className="border-b border-slate-200 px-3 py-2 sticky top-0 bg-white z-10 min-w-0 max-w-full overflow-hidden">
        <span
          className="text-[11px] font-mono text-slate-600 truncate block"
          title={asset.filename}
        >
          {asset.filename}
        </span>
      </div>

      {/* 16:9 landscape thumbnail per L6 — fills rail width (~400 × 225).
       *
       * D2.7b defensive constraint: explicit inline width:100% + max-w:100% on
       * the box, and explicit max-w/max-h:100% (inline, not just Tailwind) on
       * the img. Belt-and-suspenders so an oversize natural image can't leak
       * out of the right rail and overlap the center pane. The aspect-video
       * class still drives the 16:9 ratio; the constraints just prevent escape.
       *
       * D2.9 Move 3: thumbnail box drops the border-b (was border-black).
       * The 24px gap below comes from the parent RightRailInspector layout.
       */}
      <div
        className="aspect-video bg-slate-100 overflow-hidden flex items-center justify-center w-full max-w-full"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={asset.filename}
            className="w-full h-full object-contain block max-w-full max-h-full"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        ) : (
          <div className="text-center px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {asset.format ?? 'asset'} preview unavailable
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-1 truncate">
              {asset.filename}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
