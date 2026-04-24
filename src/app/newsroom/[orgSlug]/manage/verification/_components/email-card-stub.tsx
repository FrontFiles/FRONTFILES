/**
 * Frontfiles — Domain email verification stub (NR-D5b-i, F7)
 *
 * Placeholder for the domain-email verification method card. The
 * real card (with OTP issue + verify via Resend) ships in NR-D5b-ii.
 *
 * Greyed render signals the card is present in the layout but not
 * yet actionable. Styling is intentionally minimal — PRD visual
 * treatment for the verification dashboard lands with NR-D11.
 */

export function EmailCardStub() {
  return (
    <section aria-disabled="true" style={{ opacity: 0.5 }}>
      <h2>Domain email</h2>
      <p>Domain-email verification ships in NR-D5b-ii.</p>
    </section>
  )
}
