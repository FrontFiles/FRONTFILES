/**
 * FRONTFILES — Newsroom embargo-invite email (NR-D8, F9)
 *
 * Renders the invite that goes to a new pre-lift recipient.
 * Mirrors `newsroom-domain-otp.ts`'s shape: plain `.ts` with
 * inline HTML + plaintext, no JSX, no React Email.
 *
 * PRD §5.1 P8 invite-email body verbatim:
 *
 *   Subject: "Embargoed: {Pack title} from {Organization.name}"
 *   Body:
 *     {sender_org} has granted you embargoed access to: {Pack.title}.
 *
 *     Lifts: {lift_at in recipient's local TZ}.
 *
 *     Policy from {sender_org}: {policy_text}
 *
 *     Access the pack here: {token_url}
 *
 *     By accessing this pack before lift, you accept the embargo
 *     terms above.
 *
 * Phishing-resistance note: the URL IS clickable here (unlike
 * newsroom-domain-otp.ts which is link-light). The preview URL
 * is the only action the recipient takes; the URL itself
 * carries the secret token. The PRD intent is for the URL to
 * route the recipient to NR-D11's gated preview page.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P8 (invite-email body — verbatim)
 *   - directives/NR-D8-embargo-configuration.md §F9
 *   - src/lib/email/templates/newsroom-domain-otp.ts (shape precedent)
 */

export interface EmbargoInviteInput {
  /** The recipient's email address (for display in the salutation). */
  recipientEmail: string
  /** The Pack's title — verbatim in subject + body. */
  packTitle: string
  /** The sender Organization's name — verbatim in subject + body. */
  senderOrgName: string
  /**
   * Pre-formatted lift-at string for display. Caller is
   * responsible for picking the right timezone — F6 uses UTC
   * for v1 (recipient TZ unknown at invite time; the preview
   * page can re-format when they click in).
   */
  liftAtFormatted: string
  /** The embargo's policy text — verbatim in body. */
  policyText: string
  /** The pre-lift preview URL (with embedded access token). */
  previewUrl: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function buildEmbargoInviteEmail(
  input: EmbargoInviteInput,
): RenderedEmail {
  const subject = `Embargoed: ${input.packTitle} from ${input.senderOrgName}`

  const text = [
    `${input.senderOrgName} has granted you embargoed access to: ${input.packTitle}.`,
    '',
    `Lifts: ${input.liftAtFormatted}.`,
    '',
    `Policy from ${input.senderOrgName}: ${input.policyText}`,
    '',
    `Access the pack here: ${input.previewUrl}`,
    '',
    'By accessing this pack before lift, you accept the embargo terms above.',
  ].join('\n')

  const escapedSenderOrg = escapeHtml(input.senderOrgName)
  const escapedPackTitle = escapeHtml(input.packTitle)
  const escapedLiftAt = escapeHtml(input.liftAtFormatted)
  const escapedPolicyText = escapeHtml(input.policyText)
  // The previewUrl is constructed by buildPreviewUrl() — its
  // token segment is base64url-encoded so it's safe inside an
  // href. The host + path segments come from constants.
  // escapeHtml on the URL text content protects against any
  // user-supplied org/pack slug that contains HTML-significant
  // characters when the URL gets rendered as visible text.
  const escapedPreviewUrl = escapeHtml(input.previewUrl)

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
            Embargoed access invitation
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            <strong>${escapedSenderOrg}</strong> has granted you embargoed access to: <strong>${escapedPackTitle}</strong>.
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            Lifts: <strong>${escapedLiftAt}</strong>.
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            Policy from ${escapedSenderOrg}:
          </p>
          <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #0000ff;background:#f6f7ff;font-size:14px;line-height:1.55;white-space:pre-wrap;">
${escapedPolicyText}
          </blockquote>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;padding-bottom:24px;">
          <a href="${escapedPreviewUrl}" style="display:inline-block;padding:12px 20px;border:2px solid #000000;background:#0000ff;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">
            Access the pack
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;font-size:13px;line-height:1.55;color:#666666;">
          By accessing this pack before lift, you accept the embargo terms above.
        </td>
      </tr>
      <tr>
        <td style="padding-top:32px;font-size:11px;color:#999999;line-height:1.6;">
          Frontfiles &mdash; a provenance-first marketplace for editorial work.
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
