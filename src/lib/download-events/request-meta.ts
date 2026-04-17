/**
 * Frontfiles — Request Metadata Extraction
 *
 * Extracts IP address, user agent, and request ID from a
 * NextRequest for download audit logging.
 *
 * Call once at the top of each route handler, pass into the
 * event builder so header extraction is not repeated.
 */

import type { NextRequest } from 'next/server'
import type { RequestMeta } from './types'

/**
 * Extract audit-relevant metadata from the incoming request.
 *
 * IP resolution order:
 *   1. X-Forwarded-For (first entry — client IP behind proxy/LB)
 *   2. X-Real-IP (common alternative)
 *   3. null (IP not available)
 *
 * Request ID:
 *   X-Request-Id header if present. Format is opaque text —
 *   may come from LB, CDN, or client.
 */
export function getRequestMeta(request: NextRequest): RequestMeta {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') ?? null

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent') ?? null,
    requestId: request.headers.get('x-request-id') ?? null,
  }
}
