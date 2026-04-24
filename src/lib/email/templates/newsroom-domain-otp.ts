/**
 * FRONTFILES — Newsroom domain-email OTP template (NR-D5b-ii, F11)
 *
 * Renders the transactional email that delivers a 6-digit OTP to
 * the address being claimed for newsroom domain-email
 * verification. Mirrors test-ping.ts's shape:
 *
 *   buildNewsroomDomainOtpEmail({code, primaryDomain,
 *                                expiresInMinutes})
 *     → { subject, html, text }
 *
 * Visual language follows the Frontfiles editorial canon (same
 * as test-ping.ts):
 *   - Inter sans-serif, system fallback
 *   - Black / blue (#0000ff) / white, no decorative colour
 *   - Strong typographic hierarchy, minimal chrome
 *   - The OTP is the visual focus, monospace, large
 *
 * Phishing-resistance: this template is INTENTIONALLY link-
 * light. There are no clickable links — not to the company
 * page, not to the verification dashboard, not to any login
 * surface. The OTP is the only action the recipient takes.
 * Mitigates the "verification email contains a clickable link
 * to a fake login page" attack vector.
 *
 * Codebase convention: `.ts` (no JSX), inline HTML strings
 * via tagged-template-style template literals + an escapeHtml
 * helper. React Email is not in use; mirroring test-ping.ts
 * keeps the template-library footprint at zero. This decision
 * was ratified as IP-1 during NR-D5b-ii dispatch.
 *
 * Spec cross-references:
 *   - directives/NR-D5b-ii-domain-email-otp.md §F11
 *   - src/lib/email/templates/test-ping.ts (shape precedent)
 *   - src/lib/email/send.ts (consumer)
 */

export interface NewsroomDomainOtpInput {
  /** The 6-digit OTP code, plaintext. Embedded in the email body. */
  code: string
  /** The primary domain being verified — shown for context. */
  primaryDomain: string
  /** TTL of the code in minutes (10 by application policy). */
  expiresInMinutes: number
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function buildNewsroomDomainOtpEmail(
  input: NewsroomDomainOtpInput,
): RenderedEmail {
  const { code, primaryDomain, expiresInMinutes } = input
  const subject = 'Your Frontfiles verification code'

  const text = [
    'Frontfiles — Newsroom verification code',
    '',
    `Someone with admin access to a Frontfiles Newsroom`,
    `organisation at ${primaryDomain} requested a verification`,
    'code for this email address.',
    '',
    `Your code: ${code}`,
    '',
    `This code expires in ${expiresInMinutes} minutes. Enter it`,
    'in the verification dashboard to complete domain-email',
    'verification.',
    '',
    "If you did not request this code, you can ignore this email.",
    'No action will be taken on your address.',
    '',
    '— Frontfiles operations',
  ].join('\n')

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
            Your verification code
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            Someone with admin access to a Frontfiles Newsroom organisation at <strong>${escapeHtml(primaryDomain)}</strong> requested a verification code for this email address.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">
            Enter this code in the verification dashboard to complete domain-email verification.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;padding-bottom:8px;">
          <div style="display:inline-block;padding:20px 32px;border:2px solid #000000;background:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.16em;color:#0000ff;">
            ${escapeHtml(code)}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:24px;font-size:14px;line-height:1.55;color:#000000;">
          This code expires in <strong>${expiresInMinutes} minutes</strong>.
        </td>
      </tr>
      <tr>
        <td style="padding-top:24px;font-size:13px;line-height:1.55;color:#666666;">
          If you did not request this code, you can ignore this email. No action will be taken on your address.
        </td>
      </tr>
      <tr>
        <td style="padding-top:32px;font-size:11px;color:#999999;line-height:1.6;">
          Frontfiles — a provenance-first marketplace for editorial work.
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
