/**
 * FRONTFILES — Transactional email sender
 *
 * Canonical entry point for ALL transactional email sends. Every
 * send:
 *   1. Logs a structured pino line with template + recipient hash.
 *   2. Writes an audit_log row (`email.transactional.sent` on
 *      success, `email.transactional.failed` on error).
 *   3. Returns the Resend message ID on success so callers can
 *      correlate back to the Resend dashboard.
 *
 * DUAL-MODE:
 *   When `isResendConfigured()` is false (no API key — typical in
 *   local-only dev), this function LOGS the send intent but does
 *   NOT hit the Resend API. That way route handlers can freely
 *   call sendTransactionalEmail() during development without
 *   configuring Resend, and prod deploys get real delivery.
 *
 * TEMPLATE ID:
 *   Canonical slug for the template being sent (e.g. 'welcome',
 *   'magic-link', 'receipt'). Stored in audit_log.metadata.template
 *   so compliance can reconstruct which emails a user received
 *   without needing the actual rendered HTML.
 *
 * USAGE:
 *   ```ts
 *   import { sendTransactionalEmail } from '@/lib/email/send'
 *   import { buildTestPingEmail } from '@/lib/email/templates/test-ping'
 *
 *   const { subject, html } = buildTestPingEmail({ stamp: ... })
 *   const result = await sendTransactionalEmail({
 *     to: 'user@example.com',
 *     templateId: 'test-ping',
 *     subject,
 *     html,
 *     actorId: userId,
 *     traceId: req.trace_id,
 *   })
 *   if (!result.ok) throw new Error(result.error)
 *   ```
 */

import { getResendClient, getTransactionalFrom, isResendConfigured } from './client'
import { logger, audit } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────

export interface SendEmailInput {
  /** Recipient address(es). A single string or an array of strings. */
  to: string | string[]
  /** Canonical slug identifying the template (e.g. 'welcome'). Stored in audit. */
  templateId: string
  /** Rendered subject line. */
  subject: string
  /** Rendered HTML body. */
  html: string
  /** Optional plain-text fallback for clients that don't render HTML. */
  text?: string
  /** Optional reply-to address. */
  replyTo?: string
  /** User whose action triggered this email (for audit trail). */
  actorId?: string | null
  /** Distributed-trace ID to correlate with other log lines + Sentry. */
  traceId?: string | null
  /** Optional structured tags — surfaced in the Resend dashboard for filtering. */
  tags?: Record<string, string>
}

export interface SendEmailResult {
  ok: boolean
  /** Resend message ID when ok=true. null in mock-mode or on failure. */
  messageId: string | null
  /** Human-readable error when ok=false. */
  error?: string
  /** True when the send was skipped because Resend isn't configured. */
  mocked: boolean
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Send a transactional email through Resend, with logging + audit.
 *
 * Never throws. On API failure, returns `{ ok: false, error }` and
 * still writes an `email.transactional.failed` audit row — so
 * support can trace every attempted send, including failures.
 */
export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to]

  const baseMeta = {
    template: input.templateId,
    // Never log the actual recipient address — use a stable hash-ish
    // shape (domain only) for observability without PII leak. The
    // full address still lands in audit_log.metadata.
    recipient_domains: recipients.map((addr) => addr.split('@')[1] ?? 'unknown'),
    recipient_count: recipients.length,
  }

  // ── Mock mode: log + audit, but don't hit Resend ──
  if (!isResendConfigured()) {
    logger.info(
      { ...baseMeta, mocked: true },
      '[email] send skipped — Resend not configured (mock mode)',
    )
    await audit({
      event_type: 'email.transactional.sent',
      actor_id: input.actorId ?? null,
      target_type: 'email',
      target_id: null,
      trace_id: input.traceId ?? null,
      metadata: {
        ...baseMeta,
        recipients,
        subject: input.subject,
        mocked: true,
      },
    })
    return { ok: true, messageId: null, mocked: true }
  }

  // ── Real send ──
  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: getTransactionalFrom(),
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      tags: input.tags
        ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
        : undefined,
    })

    if (error || !data) {
      const errorMessage = error?.message ?? 'Unknown Resend error'
      logger.error(
        { ...baseMeta, err: errorMessage },
        '[email] Resend send failed',
      )
      await audit({
        event_type: 'email.transactional.failed',
        actor_id: input.actorId ?? null,
        target_type: 'email',
        target_id: null,
        trace_id: input.traceId ?? null,
        metadata: {
          ...baseMeta,
          recipients,
          subject: input.subject,
          error: errorMessage,
        },
      })
      return { ok: false, messageId: null, error: errorMessage, mocked: false }
    }

    logger.info(
      { ...baseMeta, resend_id: data.id },
      '[email] sent via Resend',
    )
    await audit({
      event_type: 'email.transactional.sent',
      actor_id: input.actorId ?? null,
      target_type: 'email',
      target_id: data.id,
      trace_id: input.traceId ?? null,
      metadata: {
        ...baseMeta,
        recipients,
        subject: input.subject,
        resend_id: data.id,
      },
    })
    return { ok: true, messageId: data.id, mocked: false }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error(
      { ...baseMeta, err: errorMessage },
      '[email] unexpected failure',
    )
    await audit({
      event_type: 'email.transactional.failed',
      actor_id: input.actorId ?? null,
      target_type: 'email',
      target_id: null,
      trace_id: input.traceId ?? null,
      metadata: {
        ...baseMeta,
        recipients,
        subject: input.subject,
        error: errorMessage,
      },
    })
    return { ok: false, messageId: null, error: errorMessage, mocked: false }
  }
}
