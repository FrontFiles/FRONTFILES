/**
 * Sentry — client-side (browser) init.
 *
 * Gracefully no-ops when NEXT_PUBLIC_SENTRY_DSN is not set, so the app
 * runs fine before Sentry is signed up for. When DSN is set, Sentry
 * activates and captures client-side errors + performance.
 *
 * Add the DSN to .env.local once the Sentry project exists:
 *   NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxx.ingest.sentry.io/xxxxx
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Performance monitoring — adjust down for prod based on volume.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Session replay for error debugging. Samples only on error
    // to keep payloads small.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  })
}
