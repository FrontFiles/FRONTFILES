/**
 * Frontfiles Bulk Upload v2 — Scenario Registry
 *
 * Typed metadata for the 3 canonical demo scenarios.
 * Importable by UI, tests, and verification helpers.
 */

export type ScenarioId = 'clean_single_story' | 'messy_multi_story' | 'scale_batch_50_plus'

export interface ScenarioMeta {
  id: ScenarioId
  label: string
  description: string
  targetUseCase: string
  expectedBehavior: string
  expectedExpressEligible: boolean
  expectedStoryProposalCount: number
  expectedAssetCountRange: [number, number]
  expectedInitialBlockerCountRange: [number, number]
  expectedInitialAdvisoryCountRange: [number, number]
}

export const SCENARIO_REGISTRY: Record<ScenarioId, ScenarioMeta> = {
  clean_single_story: {
    id: 'clean_single_story',
    label: 'Clean batch — 7 files, 1 story',
    description: 'Seven assets from a single Hong Kong press-freedom rally. High-confidence metadata, clean declarations, one event. Express-eligible. Includes one PRIVATE asset to prove advisory-not-blocking rule.',
    targetUseCase: 'Express path demo, fast newsroom single-event batch',
    expectedBehavior: 'All assets clustered in one proposed Story. Express card appears. No manifest-invalid. One PRIVATE no-price advisory. Accept-all + publish in under 60 seconds.',
    expectedExpressEligible: true,
    expectedStoryProposalCount: 1,
    expectedAssetCountRange: [7, 7],
    expectedInitialBlockerCountRange: [7, 7],   // all need story + price (PUBLIC/RESTRICTED no-price)
    expectedInitialAdvisoryCountRange: [2, 4],   // PRIVATE no-price, provenance_pending, etc.
  },
  messy_multi_story: {
    id: 'messy_multi_story',
    label: 'Mixed batch — 15 files, 3+ stories',
    description: '15 files across Manila floods, Manila evictions, and Shenzhen factory match. Includes duplicate, manifest-invalid, ambiguous Story candidates, mixed confidence, mixed privacy states.',
    targetUseCase: 'Hero workflow demo: manual Story intervention, issue fixing, ambiguity resolution',
    expectedBehavior: 'Express card does NOT appear. Multiple Story proposals. At least 1 manifest-invalid blocking. 1 duplicate advisory. Mix of PUBLIC/PRIVATE/RESTRICTED. Creator must manually fix several blockers.',
    expectedExpressEligible: false,
    expectedStoryProposalCount: 3,
    expectedAssetCountRange: [15, 15],
    expectedInitialBlockerCountRange: [12, 15],
    expectedInitialAdvisoryCountRange: [4, 8],
  },
  scale_batch_50_plus: {
    id: 'scale_batch_50_plus',
    label: 'Scale batch — 60 files, 6 stories',
    description: '60 files across Bangkok protests, Jakarta flooding, Taipei tech summit, Myanmar border, Seoul labour strike, and unclustered misc. Tests scale, mixed formats, multiple existing-story matches.',
    targetUseCase: 'Scale stress test: prove system handles 50+ assets with mixed quality, formats, and story ambiguity',
    expectedBehavior: 'Express NOT eligible. 6 Story proposals. Multiple manifest-invalid. Several duplicates. Wide mix of blocking and advisory issues. Filter and sort become essential.',
    expectedExpressEligible: false,
    expectedStoryProposalCount: 6,
    expectedAssetCountRange: [60, 60],
    expectedInitialBlockerCountRange: [50, 60],
    expectedInitialAdvisoryCountRange: [8, 20],
  },
}

export const SCENARIO_IDS: ScenarioId[] = ['clean_single_story', 'messy_multi_story', 'scale_batch_50_plus']

export function getScenarioMeta(id: ScenarioId): ScenarioMeta {
  return SCENARIO_REGISTRY[id]
}
