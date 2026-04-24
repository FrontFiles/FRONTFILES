/**
 * Frontfiles — Newsroom embed-snippet generator (NR-D4, F2)
 *
 * Produces the HTML embed snippet per PRD §5.3 J4 that publishers
 * paste into their CMS. The snippet renders a <figure> with the
 * asset rendition, a <figcaption> carrying credit + licence link,
 * and (for Packs where AI training is not permitted) a pair of
 * W3C TDMRep <meta> tags per PRD §2.7.
 *
 * Trademark overlay (per PRD §2.6, canonical 2-sentence form) and
 * correction notice (per PRD §3.2 Correction) append inside the
 * <figcaption> after the licence line.
 *
 * Pure module. String construction only; no template engine, no
 * I/O, no React.
 */

import type { NewsroomLicenceClass } from '@/lib/db/schema'

import { getLicenceClass } from './licence-classes'

export interface EmbedSnippetInput {
  renditionUrl: string
  altText: string
  creditLine: string
  packCanonicalUrl: string
  organizationName: string
  licenceClass: NewsroomLicenceClass
  isTrademarkAsset?: boolean
  lastCorrectedAt?: string
}

// HTML / attribute context escape. Single map used for all
// user-authored text and all attribute values. Safe to apply to
// URLs: server-computed URLs carry no raw `&` / `<` / `>` / `"` /
// `'`, so the function is a no-op on them — but if a caller ever
// passes a URL built from user input, this prevents attribute-
// context breakage.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ISO timestamp or ISO date → YYYY-MM-DD.
function isoDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function generateEmbedSnippet(input: EmbedSnippetInput): string {
  const licence = getLicenceClass(input.licenceClass)
  const emitTdm = !licence.flags.aiTrainingPermitted

  const renditionUrl = escapeHtml(input.renditionUrl)
  const altText = escapeHtml(input.altText)
  const creditLine = escapeHtml(input.creditLine)
  const packCanonicalUrl = escapeHtml(input.packCanonicalUrl)
  const organizationName = escapeHtml(input.organizationName)
  const licenceUri = escapeHtml(licence.uri)
  const licenceCode = escapeHtml(licence.code)

  const lines: string[] = []
  lines.push('<figure>')
  lines.push(`  <img src="${renditionUrl}" alt="${altText}">`)
  lines.push('  <figcaption>')
  lines.push(
    `    ${creditLine}. Source: <a href="${packCanonicalUrl}">${organizationName}</a>.`,
  )
  lines.push(
    `    Licence: <a href="${licenceUri}">${licenceCode}</a>.`,
  )

  if (input.isTrademarkAsset === true) {
    // PRD §2.6 canonical 2-sentence notice. The second sentence
    // is a load-bearing disclaimer: licence governs copyright,
    // trademark rights are retained separately.
    lines.push(
      `    <small class="trademark-notice">Trademark and brand rights retained by ${creditLine}. The licence above does not grant trademark rights.</small>`,
    )
  }

  if (input.lastCorrectedAt) {
    const date = escapeHtml(isoDateOnly(input.lastCorrectedAt))
    lines.push(
      `    <small class="correction-notice">Last corrected: ${date}</small>`,
    )
  }

  lines.push('  </figcaption>')

  if (emitTdm) {
    lines.push('  <meta name="tdm-reservation" content="1">')
    lines.push(
      `  <meta name="tdm-policy" content="${licenceUri}#tdm">`,
    )
  }

  lines.push('</figure>')

  return lines.join('\n')
}
