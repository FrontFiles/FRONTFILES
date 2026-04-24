// ═══════════════════════════════════════════════════════════════
// rights-display — pure-helper tests (§R6-pure / §F10)
//
// Runs under Vitest's existing Node environment; no RTL, no jsdom
// (see C2 §F10 + SCAFFOLD §R6 for why). Exercises the named export
// `renderRights` directly with hand-built Rights fixtures and
// asserts on react-dom/server's renderToString output.
//
// Coverage: 5 test cases per directive §F10 (4 canonical templates
// + 1 unknown-template fallback), with `is_transfer: true` vs
// `is_transfer: false` sub-assertions bundled inside the
// commercial_restricted and custom cases per IP-3 ratification.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'

import { renderRights } from '@/lib/offer/rights-display'
import type { Rights } from '@/lib/offer/types'

// ─── editorial_one_time (§F15.1.a) ────────────────────────────────

describe('renderRights — editorial_one_time (§F15.1.a)', () => {
  it('renders the 4-line ordered output', () => {
    const rights: Rights = {
      template: 'editorial_one_time',
      params: {
        publication_name: 'The Atlantic',
        publication_issue: 'Spring 2026 print',
        territory: 'worldwide',
        exclusivity_days: 30,
      },
      is_transfer: false,
    }
    const html = renderToString(renderRights(rights))

    // L1
    expect(html).toContain('Editorial, one-time use')
    // L2 — publication with issue suffix
    expect(html).toContain(
      'Publication: The Atlantic (Spring 2026 print)',
    )
    // L3 — territory worldwide
    expect(html).toContain('Territory: Worldwide')
    // L4 — exclusivity positive
    expect(html).toContain('Exclusive for 30 days from publication')
  })
})

// ─── editorial_with_archive_12mo (§F15.1.b) ───────────────────────

describe('renderRights — editorial_with_archive_12mo (§F15.1.b)', () => {
  it('renders 6 lines — §F15.1.a L1-4 plus the 2-line archive block', () => {
    const rights: Rights = {
      template: 'editorial_with_archive_12mo',
      params: {
        publication_name: 'Wired',
        territory: 'US',
        exclusivity_days: 0,
        archive_format: 'both',
        // archive_territory omitted — defaults to `territory` per §F15.1.b.
      },
      is_transfer: false,
    }
    const html = renderToString(renderRights(rights))

    // L1-L4 — byte-match §F15.1.a (excluding suffix; no
    // publication_issue in fixture, exclusivity_days: 0).
    expect(html).toContain('Editorial, one-time use')
    expect(html).toContain('Publication: Wired')
    // FLAG-37 stub — raw ISO-2 code rendered for non-'worldwide'.
    expect(html).toContain('Territory: US')
    expect(html).toContain('Non-exclusive')

    // L5 — archive access line.
    expect(html).toContain(
      'Archive access: both for 12 months from publication',
    )
    // L6 — archive territory (defaulted to territory).
    expect(html).toContain('Archive territory: US')
  })
})

// ─── commercial_restricted (§F15.1.c) ─────────────────────────────

describe('renderRights — commercial_restricted (§F15.1.c)', () => {
  it('renders 7 lines when is_transfer: false and 8 lines when is_transfer: true (IP-3 bundled)', () => {
    // Sub-assertion (a) — is_transfer: false → 7 lines, no L8.
    const baseRights: Rights = {
      template: 'commercial_restricted',
      params: {
        campaign_name: 'Summer Launch',
        territory: ['US', 'CA'], // array variant per §F15.1.c
        channels: ['print', 'web'],
        duration_months: 12,
        exclusive_in_channel: true,
        credit_required: false,
      },
      is_transfer: false,
    }
    const htmlFalse = renderToString(renderRights(baseRights))

    // L1-L7 byte-match spec.
    expect(htmlFalse).toContain('Commercial, restricted scope')
    expect(htmlFalse).toContain('Campaign: Summer Launch')
    // FLAG-37 stub — ISO-2 array joined with ', '.
    expect(htmlFalse).toContain('Territory: US, CA')
    expect(htmlFalse).toContain('Channels: print, web')
    expect(htmlFalse).toContain('Duration: 12 months')
    expect(htmlFalse).toContain('Exclusive within listed channels')
    expect(htmlFalse).toContain('No credit required')
    // L8 MUST be absent when is_transfer: false.
    expect(htmlFalse).not.toContain(
      'Includes transfer of underlying rights',
    )

    // Sub-assertion (b) — is_transfer: true → 8 lines with L8.
    const transferRights: Rights = {
      template: 'commercial_restricted',
      params: {
        campaign_name: 'Winter Push',
        territory: 'worldwide',
        channels: ['social'],
        duration_months: 6,
        exclusive_in_channel: false,
        credit_required: true,
      },
      is_transfer: true,
    }
    const htmlTrue = renderToString(renderRights(transferRights))

    expect(htmlTrue).toContain('Commercial, restricted scope')
    expect(htmlTrue).toContain('Campaign: Winter Push')
    expect(htmlTrue).toContain('Territory: Worldwide')
    expect(htmlTrue).toContain('Channels: social')
    expect(htmlTrue).toContain('Duration: 6 months')
    expect(htmlTrue).toContain('Non-exclusive')
    expect(htmlTrue).toContain('Creator credit required')
    // L8 conditional line — byte-match §F15.1.c L8.
    expect(htmlTrue).toContain('Includes transfer of underlying rights')
  })
})

// ─── custom (§F15.1.d) ────────────────────────────────────────────

describe('renderRights — custom (§F15.1.d)', () => {
  it('renders 3 lines when is_transfer: false and 4 lines when is_transfer: true (IP-3 bundled)', () => {
    // Sub-assertion (a) — is_transfer: false → 3 lines, no L4.
    const baseRights: Rights = {
      template: 'custom',
      params: {
        description: 'Bespoke usage terms negotiated separately.',
        // counsel_note omitted — renders fallback copy per §F15.1.d L3.
      },
      is_transfer: false,
    }
    const htmlFalse = renderToString(renderRights(baseRights))

    // L1 — visual warning treatment per IP-4b: 1px top-rule + bold.
    expect(htmlFalse).toContain(
      'Custom rights — admin-flagged for counsel review',
    )
    expect(htmlFalse).toContain('border-t border-black pt-2 font-bold')
    // L2 — description.
    expect(htmlFalse).toContain(
      'Description: Bespoke usage terms negotiated separately.',
    )
    // L3 — counsel_note-absent fallback.
    expect(htmlFalse).toContain('Pending counsel review')
    // L4 MUST be absent when is_transfer: false.
    expect(htmlFalse).not.toContain(
      'Includes transfer of underlying rights',
    )

    // Sub-assertion (b) — is_transfer: true → 4 lines with L4.
    const transferRights: Rights = {
      template: 'custom',
      params: {
        description: 'Full buy-out.',
        counsel_note: 'Reviewed 2026-04-22 — approved.',
      },
      is_transfer: true,
    }
    const htmlTrue = renderToString(renderRights(transferRights))

    expect(htmlTrue).toContain(
      'Custom rights — admin-flagged for counsel review',
    )
    expect(htmlTrue).toContain('Description: Full buy-out.')
    // L3 — counsel_note-present variant.
    expect(htmlTrue).toContain(
      'Counsel notes: Reviewed 2026-04-22 — approved.',
    )
    // L4 conditional line.
    expect(htmlTrue).toContain('Includes transfer of underlying rights')
  })
})

// ─── unknown-template fallback (§F15.1.f) ─────────────────────────

describe('renderRights — unknown-template fallback (§F15.1.f)', () => {
  it('renders the 3-line §F15.1.f fallback for a template value outside the typed union', () => {
    // Cast through unknown — the runtime may produce a template
    // value outside the typed 4-literal union during a forward-compat
    // window (DDL extends the enum ahead of UI). This is the P1
    // incident trigger scenario per §F15.1.f.
    const rights = {
      template: 'nonexistent_v1',
      params: { foo: 'bar', baz: 42 },
      is_transfer: false,
    } as unknown as Rights
    const html = renderToString(renderRights(rights))

    // L1 — unrecognized-template label includes the raw template value.
    expect(html).toContain('Unrecognized rights template: nonexistent_v1')
    // L2 — "Raw params:" label (IP-4c ratified — separate from JSON block).
    expect(html).toContain('Raw params:')
    // JSON block — content appears inside a <pre> element.
    expect(html).toContain('<pre>')
    expect(html).toContain('foo')
    expect(html).toContain('bar')
    expect(html).toContain('baz')
    expect(html).toContain('42')
    expect(html).toContain('</pre>')

    // L3 MUST be absent when is_transfer: false.
    expect(html).not.toContain('Flagged: transfer of underlying rights')
  })
})
