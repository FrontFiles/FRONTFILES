/**
 * Frontfiles — Newsroom receipt terms generator (NR-D4, F3)
 *
 * Produces the human-readable `terms_summary` captured on every
 * DownloadReceipt (PRD §3.2 DownloadReceipt field schema line 461:
 * "Generated from licence_class + flags"). Captured at download
 * time by the NR-D10 signing RPC; immutable on the receipt row.
 *
 * The summary is a short plain-text string (2–5 sentences, single
 * space between) suitable for the P4 signed receipt view and for
 * inclusion in the receipt JSON body.
 *
 * Trademark clause (when present) uses the PRD §2.6 canonical
 * 2-sentence form.
 *
 * Pure module. No I/O.
 */

import type { NewsroomLicenceClass } from '@/lib/db/schema'

import { getLicenceClass } from './licence-classes'

export interface ReceiptTermsInput {
  licenceClass: NewsroomLicenceClass
  creditLine: string
  isTrademarkAsset?: boolean
}

export function generateReceiptTerms(input: ReceiptTermsInput): string {
  const licence = getLicenceClass(input.licenceClass)
  const sentences: string[] = []

  // Line 1: short human label.
  sentences.push(`${licence.humanLabel}.`)

  // Line 2: credit line.
  sentences.push(`Credit: ${input.creditLine}.`)

  // Line 3: no-modify clause (FF-* classes + any future class
  // where canModify=false).
  if (!licence.flags.canModify) {
    sentences.push('Do not alter the asset.')
  }

  // Line 4: AI training opt-out clause (FF-* classes).
  if (!licence.flags.aiTrainingPermitted) {
    sentences.push('AI training not permitted by this source.')
  }

  // Line 5: trademark overlay (PRD §2.6 canonical 2-sentence form).
  if (input.isTrademarkAsset === true) {
    sentences.push(
      `Trademark and brand rights retained by ${input.creditLine}. The licence above does not grant trademark rights.`,
    )
  }

  return sentences.join(' ')
}
