/**
 * Frontfiles Upload V3 — Parity Contract Test (THE GATEKEEPER)
 *
 * Spec: C2-PLAN.md §3.2 (parity contract lock) + C2.1-DIRECTIVE §3.0 + §6.
 *
 * For every fixture in v2-mock-scenarios.ts, this test:
 *   1. Hydrates into V2State via the existing v2 hydration path.
 *   2. Hydrates the SAME fixture into V3State via hydrateV3FromV2State.
 *   3. Runs the extracted shared selectors on BOTH states.
 *   4. Asserts identical outputs.
 *
 * The selectors live in upload-selectors.ts (Option B per C2.1-DIRECTIVE
 * §3.0 amendment). Both V2State and V3State satisfy the narrow input
 * views (AssetsView, StoryGroupsView, DefaultsView) via structural typing.
 *
 * If this test fails, the V2/V3 parity contract is broken and EITHER
 * the spec needs to explicitly redefine the diverging selector OR the
 * V3 implementation has drifted from V2 in a way that breaks fixture
 * behavior. Hard-fail; no warnings.
 *
 * Documented divergences (per UX-BRIEF v3 §4.5 + §4.6 + spec):
 *   - needs_story: still surfaced by getAssetExceptions identically in
 *     both states because storyGroupId is preserved unchanged. The UX
 *     renders it differently (Story groups opt-in in V3); the SELECTOR
 *     output is identical.
 *   - Express-eligibility: NOT extracted; V3 doesn't compute it; the
 *     parity test does NOT call getExpressEligibility on V3State.
 */

import { describe, it, expect } from 'vitest'
import { hydrateFromScenario, type HydrationTarget } from '../v2-hydration'
import {
  CLEAN_SINGLE_STORY,
  MESSY_MULTI_STORY,
  SCALE_BATCH_50_PLUS,
  ARCHIVE_150_MIXED,
} from '../v2-mock-scenarios'
import { hydrateV3FromV2State } from '../v3-hydration'
import {
  getAssets,
  getIncludedAssets,
  getStoryGroups,
  getAssetExceptions,
  getBlockingExceptions,
  getAdvisoryExceptions,
  getPublishReadiness,
  getTotalListedValue,
  getCompletionSummary,
  getAnalysisProgress,
} from '../upload-selectors'

const FIXTURES = [
  { name: 'CLEAN_SINGLE_STORY', scenario: CLEAN_SINGLE_STORY },
  { name: 'MESSY_MULTI_STORY', scenario: MESSY_MULTI_STORY },
  { name: 'SCALE_BATCH_50_PLUS', scenario: SCALE_BATCH_50_PLUS },
  // C2.2 §3.1 — extends parity coverage to Archive-scale fixtures.
  // Only the 150-asset fixture is included here; 500 and 1500 are
  // deferred to a perf-test follow-up to keep the parity suite fast.
  { name: 'ARCHIVE_150_MIXED', scenario: ARCHIVE_150_MIXED },
] as const

// All hydration targets except 'add-files' (no analysis yet — parity is
// trivially identical) and 'mid-analysis' (non-deterministic ordering).
const TARGETS: HydrationTarget[] = ['review-ready', 'review-assigned']

describe('V2/V3 Parity Contract — getAssets / getIncludedAssets', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getAssets(v3State).map(a => a.id)).toEqual(getAssets(v2State).map(a => a.id))
        expect(getIncludedAssets(v3State).map(a => a.id)).toEqual(
          getIncludedAssets(v2State).map(a => a.id),
        )
      })
    }
  }
})

describe('V2/V3 Parity Contract — getStoryGroups', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getStoryGroups(v3State)).toEqual(getStoryGroups(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getAssetExceptions (per asset)', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target} — every asset's exceptions match`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        const v2Assets = getAssets(v2State)
        const v3Assets = getAssets(v3State)
        expect(v3Assets.length).toBe(v2Assets.length)
        for (let i = 0; i < v2Assets.length; i++) {
          const v2Excs = getAssetExceptions(v2Assets[i])
          const v3Excs = getAssetExceptions(v3Assets[i])
          expect(v3Excs).toEqual(v2Excs)
        }
      })
    }
  }
})

describe('V2/V3 Parity Contract — getBlockingExceptions', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getBlockingExceptions(v3State)).toEqual(getBlockingExceptions(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getAdvisoryExceptions', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getAdvisoryExceptions(v3State)).toEqual(getAdvisoryExceptions(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getPublishReadiness', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getPublishReadiness(v3State)).toEqual(getPublishReadiness(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getTotalListedValue', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getTotalListedValue(v3State)).toBe(getTotalListedValue(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getCompletionSummary', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getCompletionSummary(v3State)).toEqual(getCompletionSummary(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — getAnalysisProgress', () => {
  for (const fixture of FIXTURES) {
    for (const target of TARGETS) {
      it(`${fixture.name} @ ${target}`, () => {
        const v2State = hydrateFromScenario(fixture.scenario, target)
        const v3State = hydrateV3FromV2State(v2State)
        expect(getAnalysisProgress(v3State)).toEqual(getAnalysisProgress(v2State))
      })
    }
  }
})

describe('V2/V3 Parity Contract — V3 hydration preserves V2Asset shape', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name} — assetsById entries are reference-equal`, () => {
      const v2State = hydrateFromScenario(fixture.scenario, 'review-ready')
      const v3State = hydrateV3FromV2State(v2State)
      // V3 hydration MUST share the same V2Asset references (or at least
      // structurally identical) — V2Asset is the data-model contract per
      // UX-BRIEF v3 §4.7.
      expect(v3State.assetsById).toBe(v2State.assetsById)
      expect(v3State.assetOrder).toBe(v2State.assetOrder)
      expect(v3State.storyGroupsById).toBe(v2State.storyGroupsById)
      expect(v3State.storyGroupOrder).toBe(v2State.storyGroupOrder)
      expect(v3State.defaults).toBe(v2State.defaults)
    })
  }
})
