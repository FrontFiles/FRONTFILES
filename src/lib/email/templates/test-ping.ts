/**
 * FRONTFILES — Test-ping email template
 *
 * Minimal HTML template used ONLY to verify the Resend pipeline
 * end-to-end. Not a user-facing communication. Don't reuse this
 * template for anything else — the canonical template set arrives
 * as part of Task #12 (react-email based).
 *
 * Visual language follows the Frontfiles editorial canon:
 *   - Inter sans-serif, system fallback
 *   - Black / blue (#0000ff) / white, no decorative colour
 *   - Strong typographic hierarchy, minimal chrome
 *   - No marketing-style ornaments or gradients
 */

export interface TestPingInput {
  /** ISO-8601 timestamp of the send — echoed in the email body. */
  stamp: string
  /** Correlation trace ID for this send (shown in body for debugging). */
  traceId: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function buildTestPingEmail(input: TestPingInput): RenderedEmail {
  const subject = `Frontfiles pipeline test — ${input.stamp}`

  const text = [
    'Frontfiles — transactional email pipeline test',
    '',
    'This is a smoke-test email confirming the Resend pipeline is live.',
    'No action required.',
    '',
    `Timestamp: ${input.stamp}`,
    `Trace ID:  ${input.traceId}`,
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
            Transactional email pipeline test
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            This is an automated smoke-test email confirming the Frontfiles
            Resend pipeline is wired end-to-end. No action required.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">
            If you received this email by accident, you can ignore it — it
            does not affect your account.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#666666;line-height:1.6;">
          <div style="text-transform:uppercase;letter-spacing:0.08em;font-weight:700;font-size:10px;color:#000000;margin-bottom:8px;">
            Diagnostic
          </div>
          <div>Timestamp: <span style="color:#0000ff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.stamp)}</span></div>
          <div>Trace ID:&nbsp;&nbsp;<span style="color:#0000ff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.traceId)}</span></div>
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
