/**
 * Frontfiles Upload Subsystem — File Validation
 *
 * Pre-ingestion validation for file format, size, and type.
 * Runs before any upload bytes are sent.
 */

import type { AssetFormat, UploadFailureReason } from './types'
import { FILE_CONSTRAINTS } from './types'

export interface FileValidationResult {
  valid: boolean
  format: AssetFormat | null
  reason: UploadFailureReason | null
  constraint: { maxSizeLabel: string } | null
}

/**
 * Validate a file against canonical format and size constraints.
 * Returns the detected format on success, or a rejection reason on failure.
 */
export function validateFile(file: File, declaredFormat: AssetFormat): FileValidationResult {
  // Empty file check
  if (file.size === 0) {
    return { valid: false, format: null, reason: 'file_empty', constraint: null }
  }

  // Find constraint for declared format
  const constraint = FILE_CONSTRAINTS.find(c => c.format === declaredFormat)
  if (!constraint) {
    return { valid: false, format: null, reason: 'unsupported_format', constraint: null }
  }

  // MIME type check
  const mimeMatch = constraint.acceptedMimeTypes.some(mime => {
    if (mime === file.type) return true
    // Fallback: check file extension for types browsers may not report correctly
    return false
  })

  if (!mimeMatch && file.type) {
    // Check if the MIME type matches any other format
    const altConstraint = FILE_CONSTRAINTS.find(c =>
      c.acceptedMimeTypes.includes(file.type) && c.format !== declaredFormat
    )
    if (!altConstraint) {
      return { valid: false, format: null, reason: 'unsupported_format', constraint: { maxSizeLabel: constraint.maxSizeLabel } }
    }
    // Type exists but doesn't match declared format — still reject as unsupported for this format
    return { valid: false, format: null, reason: 'unsupported_format', constraint: { maxSizeLabel: constraint.maxSizeLabel } }
  }

  // Size check
  if (file.size > constraint.maxSizeBytes) {
    return { valid: false, format: declaredFormat, reason: 'file_size_exceeded', constraint: { maxSizeLabel: constraint.maxSizeLabel } }
  }

  return { valid: true, format: declaredFormat, reason: null, constraint: { maxSizeLabel: constraint.maxSizeLabel } }
}

/**
 * Detect the most likely format from a file's MIME type.
 * Used as a default when the creator hasn't explicitly declared a format.
 */
export function detectFormat(file: File): AssetFormat | null {
  const mime = file.type.toLowerCase()

  // Video
  if (mime.startsWith('video/')) return 'video'

  // Audio
  if (mime.startsWith('audio/')) return 'audio'

  // Text/document
  if (
    mime === 'text/plain' ||
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime.includes('wordprocessingml')
  ) return 'text'

  // SVG → vector
  if (mime === 'image/svg+xml') return 'vector'

  // Image → default to photo (creator can reclassify as illustration/infographic)
  if (mime.startsWith('image/')) return 'photo'

  return null
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
