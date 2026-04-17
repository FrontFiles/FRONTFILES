/**
 * FRONTFILES — Structured server logger (pino)
 *
 * Wraps pino with:
 *   - JSON output in production (machine-parseable by log-aggregator / Sentry)
 *   - Pretty-printed output in development (human-readable)
 *   - Trace-ID context for correlating logs with Sentry events
 *   - `audit()` helper that ALSO persists to the audit_log table
 *
 * USAGE:
 *   ```ts
 *   import { logger, audit } from '@/lib/logger'
 *
 *   // Regular structured log
 *   logger.info({ user_id: uid, route: '/api/upload' }, 'upload committed')
 *
 *   // Audit event (log + persist to audit_log table)
 *   await audit({
 *     event_type: 'licence.minted',
 *     actor_id: buyerId,
 *     target_type: 'licence_grant',
 *     target_id: grantId,
 *     metadata: { amount_cents: 5000 },
 *   })
 *   ```
 *
 * The logger is server-only. Do not import it in client components.
 */

import pino, { type Logger } from 'pino'
import { env, isProd } from './env'
import { getSupabaseClient, isSupabaseConfigured } from './db/client'

// ─── Pino configuration ─────────────────────────────────────────

const baseConfig = {
  level: isProd ? 'info' : 'debug',
  base: {
    app: 'frontfiles',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // Never log these fields, even if they accidentally appear in metadata
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
      '*.service_role_key',
      'stripe_secret',
    ],
    censor: '[REDACTED]',
  },
}

/**
 * Root logger. Exported for direct use at module level.
 * For per-request logging, use `childLogger(traceId)` so every log
 * line in a request carries the same trace_id.
 */
export const logger: Logger = isProd
  ? pino(baseConfig)
  : pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,app,env',
        },
      },
    })

/** Create a child logger bound to a specific trace_id + optional context. */
export function childLogger(traceId: string, context?: Record<string, unknown>): Logger {
  return logger.child({ trace_id: traceId, ...context })
}

// ─── Audit log helper ───────────────────────────────────────────

/**
 * Types of events canonically tracked in audit_log.
 * Keep this list intentional — audit_log is security/compliance-grade,
 * not a general-purpose event log.
 */
export type AuditEventType =
  // Auth
  | 'auth.signup'
  | 'auth.signin'
  | 'auth.signout'
  | 'auth.magiclink.sent'
  | 'auth.account.linked'
  // Assets / uploads
  | 'asset.commit'
  | 'asset.updated'
  | 'asset.deleted'
  | 'asset.moderation.flagged'
  | 'asset.validation.tier_changed'
  // Licences / transactions
  | 'licence.minted'
  | 'licence.revoked'
  | 'transaction.created'
  | 'transaction.paid'
  | 'transaction.refunded'
  | 'transaction.failed'
  // Stripe
  | 'stripe.webhook.received'
  | 'stripe.account.updated'
  | 'stripe.payout.settled'
  | 'stripe.dispute.filed'
  | 'stripe.dispute.resolved'
  // AI
  | 'ai.vision.analyse'
  | 'ai.gemini.call'
  | 'ai.cache.hit'
  | 'ai.cache.miss'
  // KYC
  | 'kyc.onboarding.started'
  | 'kyc.status.updated'
  | 'kyc.payout_ready.true'
  | 'kyc.payout_ready.false'
  // Disputes
  | 'dispute.filed'
  | 'dispute.classified'
  | 'dispute.resolved'
  // Email (transactional + marketing)
  | 'email.transactional.sent'
  | 'email.transactional.failed'
  | 'email.marketing.sent'
  | 'email.marketing.failed'
  // Admin / staff
  | 'staff.action'

export interface AuditEvent {
  event_type: AuditEventType
  actor_id?: string | null
  target_type?: string | null
  target_id?: string | null
  metadata?: Record<string, unknown>
  trace_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
}

/**
 * Write an event to the audit_log table AND emit a matching structured log.
 *
 * This is the ONLY path allowed to write to audit_log from application code.
 * Never INSERT directly — always go through this helper so logs + DB stay aligned.
 *
 * Silently continues on DB write failure (logged as error) so audit failures
 * don't cascade into primary-action failures.
 */
export async function audit(event: AuditEvent): Promise<void> {
  const log = event.trace_id ? childLogger(event.trace_id) : logger

  // Emit the structured log line first (always succeeds)
  log.info(
    {
      audit: true,
      event_type: event.event_type,
      actor_id: event.actor_id ?? null,
      target_type: event.target_type ?? null,
      target_id: event.target_id ?? null,
      metadata: event.metadata ?? {},
    },
    `[audit] ${event.event_type}`,
  )

  // Persist to audit_log table (service-role only).
  // In mock-mode (no Supabase env), skip persistence — audit is still
  // captured in the structured log line above.
  if (!isSupabaseConfigured()) return

  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('audit_log').insert({
      event_type: event.event_type,
      actor_id: event.actor_id ?? null,
      target_type: event.target_type ?? null,
      target_id: event.target_id ?? null,
      metadata: event.metadata ?? {},
      trace_id: event.trace_id ?? null,
      ip_address: event.ip_address ?? null,
      user_agent: event.user_agent ?? null,
    })
    if (error) {
      log.error({ err: error, event_type: event.event_type }, '[audit] DB write failed')
    }
  } catch (err) {
    log.error({ err, event_type: event.event_type }, '[audit] unexpected failure')
  }
}

/**
 * Generate a unique trace ID for the current request/operation.
 * Callers should pass this to `childLogger(traceId)` and to any downstream
 * services that support distributed tracing (Sentry, Stripe idempotency, etc.)
 */
export function newTraceId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  )
}
