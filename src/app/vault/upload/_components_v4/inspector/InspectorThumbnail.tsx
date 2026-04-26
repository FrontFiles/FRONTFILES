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

import { useEffect, useMemo } from 'react'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function InspectorThumbnail({ asset }: Props) {
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

  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [url])

  return (
    <div className="flex-shrink-0">
      {/* Filename header — sticky at the top of the rail body for context */}
      <div className="border-b border-black px-3 py-2 sticky top-0 bg-white z-10 min-w-0">
        <span
          className="text-sm font-mono text-black truncate block"
          title={asset.filename}
        >
          {asset.filename}
        </span>
      </div>

      {/* 16:9 landscape thumbnail per L6 — fills rail width (~400 × 225) */}
      <div className="aspect-video bg-slate-100 overflow-hidden border-b border-black flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={asset.filename}
            className="w-full h-full object-contain"
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
