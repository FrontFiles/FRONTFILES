/**
 * Sentry — Node.js server runtime init.
 *
 * Gracefully no-ops when NEXT_PUBLIC_SENTRY_DSN is not set.
 * Captures uncaught server-side errors + performance traces.
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
