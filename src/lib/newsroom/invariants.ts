/**
 * Frontfiles — Newsroom Pack publish invariants (NR-D4, F5)
 *
 * Pure precondition checkers for the `draft → scheduled` and
 * `draft → published` transitions per PRD §3.3. The caller
 * (NR-D9 publish RPC, P10 pre-publish checklist UI) assembles
 * input from query results; this module verifies the eight
 * invariant fields and produces a structured verdict.
 *
 * Invariants (PRD §3.3, reproduced in field semantics below):
 *   1. title non-empty
 *   2. credit_line non-empty
 *   3. licence_class set
 *   4. ≥ 1 asset
 *   5. every asset scan_result === 'clean'
 *   6. every image asset has non-empty alt_text
 *   7. RightsWarranty row confirmed (all three bools true)
 *   8. schedule valid for the chosen publish mode
 *
 * Pure module. No DB, no I/O.
 */

import type {
  NewsroomAssetKind,
  NewsroomLicenceClass,
} from '@/lib/db/schema'

export interface PackPublishInput {
  title: string
  creditLine: string
  licenceClass: NewsroomLicenceClass | null
  assets: ReadonlyArray<{
    kind: NewsroomAssetKind
    altText: string | null
    scanResult: 'pending' | 'clean' | 'flagged' | 'error'
  }>
  rightsWarrantyConfirmed: boolean
  schedule:
    | { kind: 'none' }
    | { kind: 'scheduled_plain'; publishAt: string }
    | {
        kind: 'scheduled_embargo'
        liftAt: string
        recipientsCount: number
        policyText: string
      }
}

export interface PublishPreconditionReport {
  hasTitle: boolean
  hasCreditLine: boolean
  hasLicenceClass: boolean
  hasAtLeastOneAsset: boolean
  allAssetScansClean: boolean
  allImagesHaveAltText: boolean
  hasRightsWarranty: boolean
  scheduleValid: boolean
}

function isFutureIso(iso: string): boolean {
  const d = new Date(iso)
  const t = d.getTime()
  if (isNaN(t)) return false
  return t > Date.now()
}

function isScheduleValid(
  schedule: PackPublishInput['schedule'],
): boolean {
  switch (schedule.kind) {
    case 'none':
      return true
    case 'scheduled_plain':
      return isFutureIso(schedule.publishAt)
    case 'scheduled_embargo':
      return (
        isFutureIso(schedule.liftAt) &&
        schedule.recipientsCount >= 1 &&
        schedule.policyText.trim().length > 0
      )
  }
}

export function checkPublishPreconditions(
  input: PackPublishInput,
): PublishPreconditionReport {
  const hasTitle = input.title.trim().length > 0
  const hasCreditLine = input.creditLine.trim().length > 0
  const hasLicenceClass = input.licenceClass != null
  const hasAtLeastOneAsset = input.assets.length >= 1

  const allAssetScansClean =
    input.assets.length > 0 &&
    input.assets.every((a) => a.scanResult === 'clean')

  const allImagesHaveAltText = input.assets.every((a) => {
    if (a.kind !== 'image') return true
    return a.altText != null && a.altText.trim().length > 0
  })

  const hasRightsWarranty = input.rightsWarrantyConfirmed === true
  const scheduleValid = isScheduleValid(input.schedule)

  return {
    hasTitle,
    hasCreditLine,
    hasLicenceClass,
    hasAtLeastOneAsset,
    allAssetScansClean,
    allImagesHaveAltText,
    hasRightsWarranty,
    scheduleValid,
  }
}

export function isPublishable(
  report: PublishPreconditionReport,
): boolean {
  return Object.values(report).every((v) => v === true)
}

export function blockingPreconditions(
  report: PublishPreconditionReport,
): ReadonlyArray<keyof PublishPreconditionReport> {
  const keys = Object.keys(report) as Array<
    keyof PublishPreconditionReport
  >
  return keys.filter((k) => report[k] === false)
}
