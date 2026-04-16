// ═══════════════════════════════════════════════════════════════
// Frontfiles — Upload server-side validation
//
// Server-authoritative checks on uploaded bytes. Runs *after*
// the client-side validation in `./validation.ts` and treats
// that prior validation as untrusted — magic bytes are sniffed
// here, size is re-measured from the buffer, and the claimed
// MIME is cross-checked against the sniffed type.
//
// Scope is PR 2: image MIMEs only. Other formats land later.
// ═══════════════════════════════════════════════════════════════

// ── Allowed content types ──────────────────────────────────

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
] as const

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number]

// 64 MB — a working ceiling for originals in PR 2. Tuneable in
// a later PR once real-world percentiles are observed.
export const MAX_ORIGINAL_BYTES = 64 * 1024 * 1024

// ── Validation result ──────────────────────────────────────

export type ServerValidationResult =
  | { ok: true; mime: AllowedImageMime }
  | { ok: false; code: ServerValidationErrorCode; detail: string }

export type ServerValidationErrorCode =
  | 'empty'
  | 'oversize'
  | 'mime_not_allowed'
  | 'magic_mismatch'
  | 'unknown_magic'

// ── Public API ─────────────────────────────────────────────

/**
 * Validate an uploaded byte buffer against the allowed-MIME
 * whitelist and the declared content type.
 *
 * Returns a discriminated union so the route handler can map
 * each failure to a precise HTTP status (400, 413, 415) without
 * parsing error messages.
 */
export function validateUploadBytes(
  bytes: Buffer,
  claimedMime: string,
): ServerValidationResult {
  if (bytes.length === 0) {
    return { ok: false, code: 'empty', detail: 'empty payload' }
  }
  if (bytes.length > MAX_ORIGINAL_BYTES) {
    return {
      ok: false,
      code: 'oversize',
      detail: `payload ${bytes.length} bytes exceeds ceiling ${MAX_ORIGINAL_BYTES}`,
    }
  }

  const sniffed = sniffImageMime(bytes)
  if (sniffed === null) {
    return {
      ok: false,
      code: 'unknown_magic',
      detail: 'could not identify image format from magic bytes',
    }
  }

  if (!isAllowedImageMime(claimedMime)) {
    return {
      ok: false,
      code: 'mime_not_allowed',
      detail: `claimed mime ${claimedMime} is not in the allowed set`,
    }
  }

  if (sniffed !== claimedMime) {
    return {
      ok: false,
      code: 'magic_mismatch',
      detail: `claimed ${claimedMime} but magic bytes say ${sniffed}`,
    }
  }

  return { ok: true, mime: sniffed }
}

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime)
}

// ── Magic-byte sniff ───────────────────────────────────────
//
// Only the four image families we accept. Returns the canonical
// MIME string or null if nothing matches.
//
// References:
//   JPEG: https://www.iana.org/assignments/media-types/image/jpeg
//   PNG:  RFC 2083 §3.1 — 8-byte signature
//   WebP: RIFF container, WEBP fourcc at offset 8
//   TIFF: two BOM variants (II / MM) followed by 42 (0x2A)

export function sniffImageMime(bytes: Buffer): AllowedImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    // skip 4-byte length at bytes[4..8]
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 4) {
    const b0 = bytes[0]
    const b1 = bytes[1]
    const b2 = bytes[2]
    const b3 = bytes[3]
    const littleEndianTiff =
      b0 === 0x49 && b1 === 0x49 && b2 === 0x2a && b3 === 0x00
    const bigEndianTiff =
      b0 === 0x4d && b1 === 0x4d && b2 === 0x00 && b3 === 0x2a
    if (littleEndianTiff || bigEndianTiff) {
      return 'image/tiff'
    }
  }
  return null
}
