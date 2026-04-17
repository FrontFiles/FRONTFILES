/**
 * Sentry — Edge runtime init (for middleware + edge API routes).
 *
 * Gracefully no-ops when NEXT_PUBLIC_SENTRY_DSN is not set.
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
  })
}
