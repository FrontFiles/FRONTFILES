/**
 * Frontfiles — Download Event Audit Module
 *
 * Public API for download audit logging.
 *
 * Usage in route handlers:
 *   import { logDownloadEvent, getRequestMeta } from '@/lib/download-events'
 *   const meta = getRequestMeta(request)
 *   void logDownloadEvent({ ...event, ...meta })
 */

export { logDownloadEvent } from './logger'
export { getRequestMeta } from './request-meta'
export type {
  DownloadChannel,
  DownloadAccessBasis,
  DownloadOutcome,
  DownloadEventInsert,
  RequestMeta,
} from './types'
