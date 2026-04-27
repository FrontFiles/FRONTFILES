/**
 * Frontfiles Upload V4 — Files → Asset Descriptors helper (D2.7 §1.1)
 *
 * Pure helper that maps a FileList (or File[]) to the shape that ADD_FILES
 * accepts. Detects asset format from MIME type (per IPD7-4) and generates
 * blob: URLs for image previews (per IPD7-5).
 *
 * Used by UploadShell's drop handler + file-picker change handler.
 *
 * Per spec §12.3 + L7: this is client-side only. The real upload pipeline
 * (HTTP POST + persistence) lands at PR 5. D2.7 just creates the in-memory
 * asset descriptor.
 */

import type { AssetFormat } from '../../../../../lib/upload/types'

export interface AssetDescriptor {
  filename: string
  fileSize: number
  format: AssetFormat | null
  file: File | null
  thumbnailRef?: string | null
}

/**
 * Map a list of File objects to ADD_FILES descriptors.
 *
 * - Format detection per IPD7-4: MIME prefix → AssetFormat enum.
 * - Image files get a blob: URL via URL.createObjectURL for instant preview
 *   in the contact sheet card (per IPD7-5).
 * - Non-image files get thumbnailRef: null (placeholder rendered by card).
 *
 * Caller is responsible for revoking the blob URLs when assets are
 * removed (the V2Asset card / inspector thumbnail components already
 * handle this on unmount).
 */
export function filesToAssetDescriptors(files: FileList | File[]): AssetDescriptor[] {
  const list: File[] = Array.isArray(files) ? files : Array.from(files)
  return list.map(file => {
    const format = detectFormat(file)
    const thumbnailRef = format === 'photo' ? safeCreateObjectURL(file) : null
    return {
      filename: file.name,
      fileSize: file.size,
      format,
      file,
      thumbnailRef,
    }
  })
}

/**
 * Detect AssetFormat from a File's MIME type + extension fallback.
 *
 * Mapping per IPD7-4:
 *   image/* (excl. svg)        → 'photo'
 *   image/svg+xml              → 'vector'
 *   video/*                    → 'video'
 *   audio/*                    → 'audio'
 *   text/*                     → 'text'
 *   application/postscript     → 'illustration'
 *   .ai extension              → 'illustration'
 *   anything else              → null
 */
function detectFormat(file: File): AssetFormat | null {
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()

  if (mime === 'image/svg+xml' || name.endsWith('.svg')) return 'vector'
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'text'
  if (mime === 'application/postscript' || name.endsWith('.ai') || name.endsWith('.eps')) {
    return 'illustration'
  }
  return null
}

function safeCreateObjectURL(file: File): string | null {
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}
