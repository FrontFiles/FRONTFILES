/**
 * Frontfiles Bulk Upload v2 — Analysis Simulation
 *
 * Simulates asynchronous upload + analysis pipeline.
 * CRITICAL: Never sets storyGroupId. Story assignment is creator-only.
 * Creates StoryGroup proposals with proposedAssetIds for system suggestions.
 */

'use client'

import type { MockScenario } from './v2-mock-scenarios'
import type { V2Action } from './v2-state'
import type { AssetProposal, StoryCandidate, V2StoryGroup } from './v2-types'

// ── Simulation Runner ──

export function simulateV2Analysis(
  scenario: MockScenario,
  assetIds: string[],
  dispatch: (action: V2Action) => void,
): { cancel: () => void } {
  let cancelled = false
  const timeouts: ReturnType<typeof setTimeout>[] = []

  function schedule(fn: () => void, delay: number) {
    const t = setTimeout(() => { if (!cancelled) fn() }, delay)
    timeouts.push(t)
  }

  // Step 1: Simulate upload progress for each asset
  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i]
    const baseDelay = i * 120 // stagger starts
    const uploadDuration = 600 + Math.random() * 800

    // Upload progress ticks
    const steps = 6
    for (let step = 1; step <= steps; step++) {
      schedule(() => {
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          assetId,
          progress: Math.round((step / steps) * 100),
        })
      }, baseDelay + (uploadDuration / steps) * step)
    }

    // Analysis completion
    const analysisDelay = baseDelay + uploadDuration + 400 + Math.random() * 1200
    const template = scenario.analysisTemplates.find(t => t.assetIndex === i)

    if (!template) {
      // No template — mark as failed
      schedule(() => {
        dispatch({ type: 'ANALYSIS_FAILED', assetId })
      }, analysisDelay)
      continue
    }

    schedule(() => {
      // Build story candidates from scenario group templates
      const storyCandidates: StoryCandidate[] = []
      for (const gt of scenario.storyGroupTemplates) {
        if (gt.assetIndices.includes(i)) {
          storyCandidates.push({
            storyGroupId: `sg_${scenario.id}_${scenario.storyGroupTemplates.indexOf(gt)}`,
            score: gt.confidence,
            rationale: gt.rationale,
          })
        }
      }

      // Also add weaker "also considered" candidates for nearby groups
      for (const gt of scenario.storyGroupTemplates) {
        if (!gt.assetIndices.includes(i) && Math.random() < 0.15) {
          storyCandidates.push({
            storyGroupId: `sg_${scenario.id}_${scenario.storyGroupTemplates.indexOf(gt)}`,
            score: 0.2 + Math.random() * 0.3,
            rationale: `Weak signal: ${gt.rationale.substring(0, 60)}...`,
          })
        }
      }

      const proposal: AssetProposal = {
        title: template.title,
        description: template.description,
        tags: template.tags,
        geography: template.geography,
        priceSuggestion: {
          amount: template.priceSuggestionCents,
          confidence: template.confidence * 0.9,
          basis: `${scenario.assets[i]?.format ?? 'photo'} / ${template.privacySuggestion.toLowerCase()} / ${template.declarationState.replace(/_/g, ' ')}`,
          factors: [
            { label: scenario.assets[i]?.format ?? 'photo', effect: 'neutral', weight: 1.0 },
            { label: template.declarationState.replace(/_/g, ' '), effect: template.declarationState === 'fully_validated' ? 'increase' : 'neutral', weight: 0.3 },
          ],
        },
        privacySuggestion: template.privacySuggestion,
        licenceSuggestions: template.licenceSuggestions,
        confidence: template.confidence,
        rationale: `Based on ${template.geography.length > 0 ? template.geography.join(', ') : 'content analysis'} with ${Math.round(template.confidence * 100)}% confidence.`,
        storyCandidates,
      }

      dispatch({
        type: 'UPDATE_ANALYSIS_RESULT',
        assetId,
        proposal,
        declarationState: template.declarationState,
        duplicateStatus: template.duplicateOf !== undefined ? 'likely_duplicate' : 'none',
        duplicateOfId: template.duplicateOf !== undefined ? assetIds[template.duplicateOf] ?? null : null,
      })
    }, analysisDelay)
  }

  // Step 2: Create Story group proposals after enough analysis completes
  const groupDelay = Math.min(assetIds.length * 120, 2000) + 1500
  for (let gi = 0; gi < scenario.storyGroupTemplates.length; gi++) {
    const gt = scenario.storyGroupTemplates[gi]
    schedule(() => {
      const groupId = `sg_${scenario.id}_${gi}`
      const group: Omit<V2StoryGroup, 'createdAt'> = {
        id: groupId,
        name: gt.name,
        kind: gt.kind,
        proposedAssetIds: gt.assetIndices.map(idx => assetIds[idx]).filter(Boolean),
        existingStoryId: gt.existingStoryId ?? null,
        existingStoryTitle: gt.existingStoryTitle ?? null,
        existingStoryAssetCount: gt.existingStoryAssetCount ?? null,
        rationale: gt.rationale,
        confidence: gt.confidence,
      }
      dispatch({ type: 'ADD_STORY_GROUP_PROPOSAL', group })
    }, groupDelay + gi * 200)
  }

  return {
    cancel: () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    },
  }
}
