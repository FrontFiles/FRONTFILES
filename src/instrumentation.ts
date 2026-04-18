/**
 * Next.js instrumentation hook.
 *
 * Called once when the Next.js process boots. Imports the right Sentry
 * config based on the runtime (Node.js vs Edge). Sentry gracefully
 * no-ops if NEXT_PUBLIC_SENTRY_DSN is not set.
 *
 * NOTE on env reads: this file intentionally reads `process.env.NEXT_RUNTIME`
 * directly. `NEXT_RUNTIME` is a runtime signal injected by Next.js itself
 * (not a configuration variable) and is therefore not part of the Zod
 * schema in `src/lib/env.ts`. All *configuration* env reads (like
 * NEXT_PUBLIC_SENTRY_DSN) do go through `@/lib/env`.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { env } from '@/lib/env'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Sentry captures request errors in Next.js 15+ when this is exported.
// Next.js passes a simplified request info shape — not the raw Request object.
export async function onRequestError(
  err: unknown,
  request: {
    path: string
    method: string
    headers: Record<string, string>
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'middleware'
  },
) {
  if (env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureRequestError(err, request, context)
  }
}
