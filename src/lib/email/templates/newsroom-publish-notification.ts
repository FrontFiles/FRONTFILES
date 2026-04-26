/**
 * FRONTFILES — Newsroom publish-notification email (NR-D9c, F6)
 *
 * Renders the fanout email sent to subscribers when a Pack
 * publishes (immediate publish OR auto-lift). Mirrors the
 * `newsroom-embargo-invite.ts` shape: plain `.ts` with inline
 * HTML + plaintext, no JSX, no React Email.
 *
 * PRD §3.2 BeatSubscription does not specify the body verbatim —
 * v1 composes a minimal, brand-consistent message. NR-D9c IP-1
 * locks the v1 fanout to `notify_on='new_pack'` only; the same
 * template is used for both immediate publish and embargo auto-
 * lift events. v1.1 (NR-D14) may diverge templates if user
 * preference granularity warrants.
 *
 * Subject:
 *   "New from {OrgName}: {Pack.title}"
 *
 * Body:
 *   {OrgName} has published a new pack: {Pack.title}.
 *
 *   View: {canonicalUrl}
 *
 *   You are receiving this because you subscribed to updates
 *   from {OrgName}. Unsubscribe: {unsubscribeUrl}.
 *
 * The unsubscribe URL is a placeholder pattern resolved by
 * NR-D14's subscription-management surface. Until then, the URL
 * 404s gracefully and the unsubscribe link in the footer is the
 * GDPR-friendly opt-out hint that NR-D14 will wire to a real
 * page (`/subscriptions/manage?t={recipient_id}`).
 *
 * Spec cross-references:
 *   - directives/NR-D9c-lift-worker-notifications.md §F6
 *   - PRD.md §3.2 BeatSubscription (consumer notif primitive)
 *   - src/lib/email/templates/newsroom-embargo-invite.ts (shape precedent)
 */

export interface PublishNotificationInput {
  /** The recipient's email address (display only — `to:` is set by the caller). */
  recipientEmail: string
  /** The Pack's title — verbatim in subject + body. */
  packTitle: string
  /** The publishing newsroom's name — verbatim in subject + body. */
  orgName: string
  /** Canonical pack URL (`packCanonicalUrl(orgSlug, packSlug)`). */
  canonicalUrl: string
  /** Recipient-keyed unsubscribe URL (NR-D14 resolves to a managed page). */
  unsubscribeUrl: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function buildPublishNotificationEmail(
  input: PublishNotificationInput,
): RenderedEmail {
  const subject = `New from ${input.orgName}: ${input.packTitle}`

  const text = [
    `${input.orgName} has published a new pack: ${input.packTitle}.`,
    '',
    `View: ${input.canonicalUrl}`,
    '',
    `You are receiving this because you subscribed to updates from ${input.orgName}.`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join('\n')

  const escapedOrgName = escapeHtml(input.orgName)
  const escapedPackTitle = escapeHtml(input.packTitle)
  const escapedCanonicalUrl = escapeHtml(input.canonicalUrl)
  const escapedUnsubscribeUrl = escapeHtml(input.unsubscribeUrl)

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <tr>
        <td style="border-bottom:1px solid #000000;padding-bottom:16px;">
          <div style="font-size:18px;font-weight:900;letter-spacing:-0.01em;line-height:1;">
            <span style="color:#000000;">FRONT</span><span style="color:#0000ff;">FILES</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.01em;line-height:1.2;">
            New from ${escapedOrgName}
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            <strong>${escapedOrgName}</strong> has published a new pack:
            <strong>${escapedPackTitle}</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;padding-bottom:24px;">
          <a href="${escapedCanonicalUrl}" style="display:inline-block;padding:12px 20px;border:2px solid #000000;background:#0000ff;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">
            View the pack
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;font-size:13px;line-height:1.55;color:#666666;">
          Direct link: ${escapedCanonicalUrl}
        </td>
      </tr>
      <tr>
        <td style="padding-top:32px;border-top:1px solid #eeeeee;font-size:11px;color:#999999;line-height:1.6;">
          You are receiving this because you subscribed to updates from
          ${escapedOrgName}.
          <br>
          <a href="${escapedUnsubscribeUrl}" style="color:#999999;text-decoration:underline;">Unsubscribe</a>
          &middot; Frontfiles &mdash; a provenance-first marketplace for editorial work.
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

// ─── Helpers ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
