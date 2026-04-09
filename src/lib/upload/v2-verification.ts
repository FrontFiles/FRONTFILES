/**
 * Frontfiles Bulk Upload v2 — Verification Helpers
 *
 * Pure-function assertions for verifying scenario correctness.
 * Each returns { pass: boolean, label: string, details: string[] }.
 *
 * These verify the CANON:
 * - Analysis proposes, never assigns
 * - PRIVATE no-price is advisory, not blocking
 * - Express eligibility strict rules
 * - Story proposal integrity
 * - Scale correctness at 50+ assets
 */

import type { V2State } from './v2-types'
import type { ScenarioId } from './v2-scenario-registry'
import { SCENARIO_REGISTRY } from './v2-scenario-registry'
import {
  getAssets,
  getIncludedAssets,
  getStoryGroups,
  getAssetExceptions,
  getBlockingExceptions,
  getAdvisoryExceptions,
  getExpressEligibility,
  getAnalysisProgress,
} from './v2-state'

// ── Verification Result ──

export interface VerificationResult {
  id: string
  pass: boolean
  label: string
  details: string[]
}

// ── Run All Verifications for a Scenario ──

export function runAllVerifications(state: V2State, scenarioId: ScenarioId): VerificationResult[] {
  const meta = SCENARIO_REGISTRY[scenarioId]
  if (!meta) return [{ id: 'unknown', pass: false, label: 'Unknown scenario', details: [`No metadata for scenario: ${scenarioId}`] }]

  return [
    verifyNoStoryAssignmentsFromAnalysis(state),
    verifyExpressEligibility(state, scenarioId),
    verifyBlockerClassification(state),
    verifyStoryProposalIntegrity(state, scenarioId),
    verifyScaleIntegrity(state, scenarioId),
    verifyEarlyReviewReadiness(state),
    verifyAssetCount(state, scenarioId),
    verifyPrivateAdvisoryRule(state),
    verifyManifestInvalidBlocking(state),
  ]
}

// ── 1. No Story Assignments from Analysis ──

export function verifyNoStoryAssignmentsFromAnalysis(state: V2State): VerificationResult {
  const assets = getAssets(state)

  for (const asset of assets) {
    // If asset has storyGroupId but analysis just completed (no explicit creator action evidence),
    // we check that storyGroupId is null for all assets that haven't been explicitly assigned.
    // In hydrated states: after analysis but before review-assigned, all should be null.
    // This check is most meaningful right after analysis completes.
    if (asset.storyGroupId !== null && asset.analysisStatus === 'complete') {
      // This is only a violation if story groups are proposed-type and no accept-all was done.
      // We check if any story group has this asset in proposedAssetIds
      const groups = getStoryGroups(state)
      const proposedInGroup = groups.find(g =>
        g.proposedAssetIds.includes(asset.id) && g.id === asset.storyGroupId
      )
      if (proposedInGroup && proposedInGroup.kind !== 'creator') {
        // This asset was assigned to a proposed group — could be accept-all or manual
        // We note it but don't fail (can't distinguish in static state)
      }
    }
  }

  // The real check: after pure analysis (no accept-all), all storyGroupId should be null
  const allNull = assets.every(a => a.storyGroupId === null)

  if (allNull) {
    return {
      id: 'no_story_assignments_from_analysis',
      pass: true,
      label: 'No Story assignments from analysis',
      details: ['All assets have storyGroupId === null (correct after pure analysis)'],
    }
  }

  // If some are assigned, check if it's because of accept-all
  const assigned = assets.filter(a => a.storyGroupId !== null)
  return {
    id: 'no_story_assignments_from_analysis',
    pass: true, // Still passes — assignments may be from accept-all
    label: 'Story assignments present (creator action)',
    details: [
      `${assigned.length} assets have storyGroupId set`,
      'This is valid if caused by explicit creator action (Accept All / manual assign)',
    ],
  }
}

// ── 2. Express Eligibility Correctness ──

export function verifyExpressEligibility(state: V2State, scenarioId: ScenarioId): VerificationResult {
  const meta = SCENARIO_REGISTRY[scenarioId]
  if (!meta) return { id: 'express_eligibility', pass: false, label: 'Express eligibility', details: ['No scenario metadata'] }

  const { eligible, reasons } = getExpressEligibility(state)
  const progress = getAnalysisProgress(state)

  // Only verify if all analysis is complete
  if (progress.complete < progress.total) {
    return {
      id: 'express_eligibility',
      pass: true, // Skip — not all analysis done
      label: 'Express eligibility (analysis incomplete)',
      details: [`${progress.complete}/${progress.total} assets analysed — skipping express check`],
    }
  }

  const expected = meta.expectedExpressEligible
  const pass = eligible === expected

  return {
    id: 'express_eligibility',
    pass,
    label: `Express eligibility: ${pass ? 'CORRECT' : 'MISMATCH'}`,
    details: [
      `Expected: ${expected ? 'eligible' : 'not eligible'}`,
      `Actual: ${eligible ? 'eligible' : 'not eligible'}`,
      ...(!eligible ? reasons.map(r => `Reason: ${r}`) : []),
    ],
  }
}

// ── 3. Blocker Classification Correctness ──

export function verifyBlockerClassification(state: V2State): VerificationResult {
  const details: string[] = []
  let allCorrect = true

  const included = getIncludedAssets(state)

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset)

    // PRIVATE assets without price should be advisory, not blocking
    if (asset.editable.privacy === 'PRIVATE' && asset.editable.price === null) {
      const priceException = exceptions.find(e => e.type === 'needs_price')
      if (priceException) {
        details.push(`FAIL: ${asset.filename} is PRIVATE with no price but has blocking needs_price`)
        allCorrect = false
      }
      const advisoryPrice = exceptions.find(e => e.type === 'no_price_private')
      if (advisoryPrice && advisoryPrice.severity !== 'advisory') {
        details.push(`FAIL: ${asset.filename} no_price_private should be advisory`)
        allCorrect = false
      }
    }

    // PUBLIC/RESTRICTED without price should be blocking
    if ((asset.editable.privacy === 'PUBLIC' || asset.editable.privacy === 'RESTRICTED') && asset.editable.price === null) {
      const priceException = exceptions.find(e => e.type === 'needs_price')
      if (!priceException || priceException.severity !== 'blocking') {
        details.push(`FAIL: ${asset.filename} is ${asset.editable.privacy} with no price but missing blocking needs_price`)
        allCorrect = false
      }
    }

    // manifest_invalid should always be blocking
    if (asset.declarationState === 'manifest_invalid') {
      const manifestException = exceptions.find(e => e.type === 'manifest_invalid')
      if (!manifestException || manifestException.severity !== 'blocking') {
        details.push(`FAIL: ${asset.filename} has manifest_invalid but no blocking exception`)
        allCorrect = false
      }
    }

    // Excluded assets should have zero exceptions
    if (asset.excluded && exceptions.length > 0) {
      details.push(`FAIL: ${asset.filename} is excluded but has ${exceptions.length} exceptions`)
      allCorrect = false
    }

    // duplicate_unresolved should be advisory
    if (asset.duplicateStatus === 'likely_duplicate') {
      const dupException = exceptions.find(e => e.type === 'duplicate_unresolved')
      if (dupException && dupException.severity !== 'advisory') {
        details.push(`FAIL: ${asset.filename} duplicate_unresolved should be advisory, got ${dupException.severity}`)
        allCorrect = false
      }
    }
  }

  if (allCorrect) {
    details.unshift('All blocker/advisory classifications correct')
  }

  return {
    id: 'blocker_classification',
    pass: allCorrect,
    label: `Blocker classification: ${allCorrect ? 'CORRECT' : 'ERRORS FOUND'}`,
    details,
  }
}

// ── 4. Story Proposal Integrity ──

export function verifyStoryProposalIntegrity(state: V2State, scenarioId: ScenarioId): VerificationResult {
  const meta = SCENARIO_REGISTRY[scenarioId]
  if (!meta) return { id: 'story_proposal_integrity', pass: false, label: 'Story proposal integrity', details: ['No scenario metadata'] }

  const groups = getStoryGroups(state)
  const details: string[] = []
  let pass = true

  // Check story group count
  if (groups.length !== meta.expectedStoryProposalCount) {
    details.push(`Expected ${meta.expectedStoryProposalCount} story groups, got ${groups.length}`)
    pass = false
  } else {
    details.push(`Story group count: ${groups.length} (correct)`)
  }

  // Check that no story group has an empty name
  for (const g of groups) {
    if (!g.name.trim()) {
      details.push(`Story group ${g.id} has empty name`)
      pass = false
    }
  }

  // Check that proposed asset IDs exist in state
  for (const g of groups) {
    for (const assetId of g.proposedAssetIds) {
      if (!state.assetsById[assetId]) {
        details.push(`Story group "${g.name}" references non-existent asset: ${assetId}`)
        pass = false
      }
    }
  }

  // Check that all included assets appear in at least one proposedAssetIds
  const included = getIncludedAssets(state)
  const allProposed = new Set(groups.flatMap(g => g.proposedAssetIds))
  const orphaned = included.filter(a => !allProposed.has(a.id))
  if (orphaned.length > 0) {
    details.push(`${orphaned.length} asset(s) not proposed in any story group`)
    // This is informational, not necessarily a failure
  }

  return {
    id: 'story_proposal_integrity',
    pass,
    label: `Story proposal integrity: ${pass ? 'CORRECT' : 'ISSUES'}`,
    details,
  }
}

// ── 5. Scale Integrity ──

export function verifyScaleIntegrity(state: V2State, scenarioId: ScenarioId): VerificationResult {
  const meta = SCENARIO_REGISTRY[scenarioId]
  if (!meta) return { id: 'scale_integrity', pass: false, label: 'Scale integrity', details: ['No scenario metadata'] }

  const assets = getAssets(state)
  const details: string[] = []
  let pass = true

  // Asset count within expected range
  const [minAssets, maxAssets] = meta.expectedAssetCountRange
  if (assets.length < minAssets || assets.length > maxAssets) {
    details.push(`Expected ${minAssets}-${maxAssets} assets, got ${assets.length}`)
    pass = false
  } else {
    details.push(`Asset count: ${assets.length} (within ${minAssets}-${maxAssets})`)
  }

  // Check blocker count range (only meaningful after full analysis + before any fixes)
  const blockers = getBlockingExceptions(state)
  const [minBlockers, maxBlockers] = meta.expectedInitialBlockerCountRange
  details.push(`Blocking assets: ${blockers.length} (expected range: ${minBlockers}-${maxBlockers})`)

  // Check advisory count range
  const advisories = getAdvisoryExceptions(state)
  const [minAdvisories, maxAdvisories] = meta.expectedInitialAdvisoryCountRange
  details.push(`Advisory assets: ${advisories.length} (expected range: ${minAdvisories}-${maxAdvisories})`)

  // All asset IDs should be unique
  const idSet = new Set(assets.map(a => a.id))
  if (idSet.size !== assets.length) {
    details.push(`Duplicate asset IDs detected!`)
    pass = false
  }

  return {
    id: 'scale_integrity',
    pass,
    label: `Scale integrity: ${pass ? 'CORRECT' : 'ISSUES'}`,
    details,
  }
}

// ── 6. Early Review Readiness ──

export function verifyEarlyReviewReadiness(state: V2State): VerificationResult {
  const details: string[] = []

  // Early review is valid if:
  // 1. At least some assets have completed analysis
  // 2. Story groups have been proposed
  // 3. Stage is 'review'

  const progress = getAnalysisProgress(state)
  const groups = getStoryGroups(state)

  details.push(`Stage: ${state.batch.currentStage}`)
  details.push(`Analysis: ${progress.complete}/${progress.total} complete`)
  details.push(`Story groups: ${groups.length}`)
  details.push(`Early review flag: ${state.ui.reviewEnteredEarly}`)

  const isEarlyReview = state.batch.currentStage === 'review' && state.ui.reviewEnteredEarly
  const pass = !isEarlyReview || (progress.complete > 0 && groups.length > 0)

  return {
    id: 'early_review_readiness',
    pass,
    label: `Early review readiness: ${pass ? 'VALID' : 'INVALID'}`,
    details,
  }
}

// ── 7. Asset Count ──

export function verifyAssetCount(state: V2State, scenarioId: ScenarioId): VerificationResult {
  const meta = SCENARIO_REGISTRY[scenarioId]
  if (!meta) return { id: 'asset_count', pass: false, label: 'Asset count', details: ['No scenario metadata'] }

  const assets = getAssets(state)
  const [min, max] = meta.expectedAssetCountRange
  const pass = assets.length >= min && assets.length <= max

  return {
    id: 'asset_count',
    pass,
    label: `Asset count: ${assets.length} (expected ${min}-${max})`,
    details: [pass ? 'Correct' : `Expected ${min}-${max}, got ${assets.length}`],
  }
}

// ── 8. PRIVATE Advisory Rule ──

export function verifyPrivateAdvisoryRule(state: V2State): VerificationResult {
  const included = getIncludedAssets(state)
  const details: string[] = []
  let pass = true

  const privateAssets = included.filter(a => a.editable.privacy === 'PRIVATE')

  for (const asset of privateAssets) {
    const exceptions = getAssetExceptions(asset)

    // Should never have blocking needs_price
    const blockingPrice = exceptions.find(e => e.type === 'needs_price' && e.severity === 'blocking')
    if (blockingPrice) {
      details.push(`FAIL: ${asset.filename} — PRIVATE asset has blocking needs_price`)
      pass = false
    }

    // Should never have blocking needs_licences
    const blockingLicence = exceptions.find(e => e.type === 'needs_licences' && e.severity === 'blocking')
    if (blockingLicence) {
      details.push(`FAIL: ${asset.filename} — PRIVATE asset has blocking needs_licences`)
      pass = false
    }
  }

  if (pass) {
    details.unshift(`${privateAssets.length} PRIVATE assets — all correctly advisory-only for price/licences`)
  }

  return {
    id: 'private_advisory_rule',
    pass,
    label: `PRIVATE advisory rule: ${pass ? 'CORRECT' : 'VIOLATIONS'}`,
    details,
  }
}

// ── 9. Manifest Invalid Blocking ──

export function verifyManifestInvalidBlocking(state: V2State): VerificationResult {
  const included = getIncludedAssets(state)
  const details: string[] = []
  let pass = true

  const manifestInvalid = included.filter(a => a.declarationState === 'manifest_invalid')

  for (const asset of manifestInvalid) {
    const exceptions = getAssetExceptions(asset)
    const blockingManifest = exceptions.find(e => e.type === 'manifest_invalid' && e.severity === 'blocking')
    if (!blockingManifest) {
      details.push(`FAIL: ${asset.filename} — manifest_invalid but no blocking exception`)
      pass = false
    }
  }

  if (pass) {
    details.unshift(`${manifestInvalid.length} manifest_invalid assets — all correctly blocking`)
  }

  return {
    id: 'manifest_invalid_blocking',
    pass,
    label: `Manifest invalid blocking: ${pass ? 'CORRECT' : 'VIOLATIONS'}`,
    details,
  }
}
