/**
 * Frontfiles — Rights-display pure renderer (P4 concern 4A.2.C2).
 *
 * Pure function `renderRights(rights: Rights): ReactElement` keyed
 * on `rights.template`. Consumed by `OfferDetailClient` (Prompt 6)
 * in place of the SCAFFOLD's `JSON.stringify(offer.rights, null, 2)`
 * placeholder.
 *
 * Every supported template's render output matches the ordered
 * render-shape spec at `docs/specs/ECONOMIC_FLOW_v1.md`:
 *   - `editorial_one_time`           — §F15.1.a (4 lines).
 *   - `editorial_with_archive_12mo`  — §F15.1.b (6 lines).
 *   - `commercial_restricted`        — §F15.1.c (7 + conditional 8).
 *   - `custom`                       — §F15.1.d (3 + conditional 4).
 *
 * The `default` branch matches §F15.1.f — forward-compat safety
 * net for a DDL-ahead-of-UI window; production appearance is a P1
 * incident trigger.
 *
 * Server-side validation (§F15.1.e) enforces params shape before
 * the offer row persists. Per §F2 directive narrative, the client
 * renderer assumes server-validated input — no defensive
 * re-validation.
 *
 * References:
 *   - docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md §F2, §F10, AC1.
 *   - docs/specs/ECONOMIC_FLOW_v1.md §F15.1.a (L406), b (L428),
 *     c (L446), d (L474), e (L494), f (L510).
 *
 * FLAG-37 / C2 E5 carry-forward — countryName/formatTerritory
 * helpers deferred. §F15.1.a L3 / §F15.1.b L6 reference
 * `countryName(territory)` and §F15.1.c L3 references
 * `formatTerritory(territory)`. Neither helper is implemented in
 * this repo. v1 renders raw ISO-2 codes for non-'worldwide'
 * territory values (and `.join(', ')` for the array variant of
 * §F15.1.c). Future concern to implement the proper helpers — see
 * C2 §EXIT CRITERIA E5 carry-forward item (directive micropatch
 * pending).
 */

import { createElement, Fragment, type ReactElement } from 'react'

import type { Rights } from './types'

// ─── Public entry ─────────────────────────────────────────────────

export function renderRights(rights: Rights): ReactElement {
  // Widen `template` to `string` so the `default` branch stays
  // type-reachable. Runtime template values can sit outside the four
  // typed literals during a forward-compat window (§F15.1.f).
  const template: string = rights.template
  switch (template) {
    case 'editorial_one_time':
      return editorialOneTimeBlock(rights)
    case 'editorial_with_archive_12mo':
      return editorialWithArchiveBlock(rights)
    case 'commercial_restricted':
      return commercialRestrictedBlock(rights)
    case 'custom':
      return customBlock(rights)
    default:
      return unknownFallbackBlock(rights)
  }
}

// ─── Internal helpers ─────────────────────────────────────────────

function line(
  key: string,
  text: string,
  className?: string,
): ReactElement {
  const props: { key: string; className?: string } = { key }
  if (className !== undefined) props.className = className
  return createElement('div', props, text)
}

function assemble(
  nodes: Array<ReactElement | null>,
): ReactElement {
  return createElement(
    Fragment,
    null,
    ...nodes.filter((n): n is ReactElement => n !== null),
  )
}

// ─── editorial_one_time (§F15.1.a) ────────────────────────────────

type EditorialOneTimeParams = {
  publication_name: string
  publication_issue?: string
  territory: 'worldwide' | string
  exclusivity_days?: number
}

function editorialOneTimeBlock(rights: Rights): ReactElement {
  const p = rights.params as EditorialOneTimeParams
  return assemble([
    line('l1', 'Editorial, one-time use'),
    line(
      'l2',
      p.publication_issue !== undefined
        ? `Publication: ${p.publication_name} (${p.publication_issue})`
        : `Publication: ${p.publication_name}`,
    ),
    // FLAG-37 — countryName(territory) helper deferred.
    line(
      'l3',
      p.territory === 'worldwide'
        ? 'Territory: Worldwide'
        : `Territory: ${p.territory}`,
    ),
    line(
      'l4',
      p.exclusivity_days !== undefined && p.exclusivity_days > 0
        ? `Exclusive for ${p.exclusivity_days} days from publication`
        : 'Non-exclusive',
    ),
  ])
}

// ─── editorial_with_archive_12mo (§F15.1.b) ───────────────────────

type EditorialArchiveParams = EditorialOneTimeParams & {
  archive_format: 'web' | 'print' | 'both'
  archive_territory?: 'worldwide' | string
}

function editorialWithArchiveBlock(rights: Rights): ReactElement {
  const p = rights.params as EditorialArchiveParams
  // §F15.1.b: archive_territory defaults to territory if omitted.
  const effectiveArchiveTerritory =
    p.archive_territory ?? p.territory
  return assemble([
    line('l1', 'Editorial, one-time use'),
    line(
      'l2',
      p.publication_issue !== undefined
        ? `Publication: ${p.publication_name} (${p.publication_issue})`
        : `Publication: ${p.publication_name}`,
    ),
    // FLAG-37 — countryName(territory) helper deferred.
    line(
      'l3',
      p.territory === 'worldwide'
        ? 'Territory: Worldwide'
        : `Territory: ${p.territory}`,
    ),
    line(
      'l4',
      p.exclusivity_days !== undefined && p.exclusivity_days > 0
        ? `Exclusive for ${p.exclusivity_days} days from publication`
        : 'Non-exclusive',
    ),
    line(
      'l5',
      `Archive access: ${p.archive_format} for 12 months from publication`,
    ),
    // FLAG-37 — countryName(archive_territory) helper deferred.
    line(
      'l6',
      effectiveArchiveTerritory === 'worldwide'
        ? 'Archive territory: Worldwide'
        : `Archive territory: ${effectiveArchiveTerritory}`,
    ),
  ])
}

// ─── commercial_restricted (§F15.1.c) ─────────────────────────────

type CommercialRestrictedParams = {
  campaign_name: string
  territory: 'worldwide' | string | string[]
  channels: Array<'print' | 'web' | 'ooh' | 'social' | 'broadcast'>
  duration_months: number
  exclusive_in_channel: boolean
  credit_required: boolean
}

function commercialRestrictedBlock(rights: Rights): ReactElement {
  const p = rights.params as CommercialRestrictedParams
  // FLAG-37 — formatTerritory(territory) helper deferred; handles
  // three variants (worldwide literal / single ISO / ISO array).
  const territoryStr =
    p.territory === 'worldwide'
      ? 'Worldwide'
      : Array.isArray(p.territory)
        ? p.territory.join(', ')
        : p.territory
  return assemble([
    line('l1', 'Commercial, restricted scope'),
    line('l2', `Campaign: ${p.campaign_name}`),
    line('l3', `Territory: ${territoryStr}`),
    line('l4', `Channels: ${p.channels.join(', ')}`),
    line('l5', `Duration: ${p.duration_months} months`),
    line(
      'l6',
      p.exclusive_in_channel
        ? 'Exclusive within listed channels'
        : 'Non-exclusive',
    ),
    line(
      'l7',
      p.credit_required
        ? 'Creator credit required'
        : 'No credit required',
    ),
    rights.is_transfer
      ? line('l8', 'Includes transfer of underlying rights')
      : null,
  ])
}

// ─── custom (§F15.1.d) ────────────────────────────────────────────

type CustomParams = {
  description: string
  counsel_note?: string
}

function customBlock(rights: Rights): ReactElement {
  const p = rights.params as CustomParams
  const counselLine =
    p.counsel_note !== undefined && p.counsel_note !== ''
      ? `Counsel notes: ${p.counsel_note}`
      : 'Pending counsel review'
  return assemble([
    // §F15.1.d L1 visual warning treatment per IP-4b: 1px top-rule
    // + distinct marker (font-bold). Brutalist baseline preserved.
    line(
      'l1',
      'Custom rights — admin-flagged for counsel review',
      'border-t border-black pt-2 font-bold',
    ),
    line('l2', `Description: ${p.description}`),
    line('l3', counselLine),
    rights.is_transfer
      ? line('l4', 'Includes transfer of underlying rights')
      : null,
  ])
}

// ─── default / unknown fallback (§F15.1.f) ────────────────────────

function unknownFallbackBlock(rights: Rights): ReactElement {
  // L1: unrecognized template label.
  // L2: "Raw params:" label as a plain <div> (IP-4c) + a separate
  //     <pre> block for the pretty-printed JSON payload.
  // L3 (conditional on rights.is_transfer): transfer flag.
  return assemble([
    line('l1', `Unrecognized rights template: ${rights.template}`),
    line('l2', 'Raw params:'),
    createElement(
      'pre',
      { key: 'l2json' },
      JSON.stringify(rights.params, null, 2),
    ),
    rights.is_transfer
      ? line('l3', 'Flagged: transfer of underlying rights')
      : null,
  ])
}
