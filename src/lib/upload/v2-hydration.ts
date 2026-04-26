// ═══════════════════════════════════════════════════════════════
// DORMANT — replaced by C2 (new shell at app/vault/upload/).
// Scheduled for deletion at the explicit cutover PR (PR 5+).
// DO NOT extend. DO NOT import from production code paths.
// See docs/upload/C2-PLAN.md §3.3 for the coexistence rule.
// ═══════════════════════════════════════════════════════════════
/**
 * Frontfiles Bulk Upload v2 — Reducer Hydration Helpers
 *
 * Jump to any workflow state deterministically for dev/test scenarios.
 * Each helper returns a V2State ready to feed into the reducer.
 *
 * Key invariants preserved:
 * - storyGroupId is NEVER set by hydration (analysis proposes, creator decides)
 * - Exceptions are computed, not stored
 * - PRIVATE no-price is advisory, not blocking
 */

import type { V2State, V2Asset, V2StoryGroup } from './v2-types'
import type { MockScenario } from './v2-mock-scenarios'
import type { AssetProposal, StoryCandidate } from './v2-types'
import { createV2InitialState } from './v2-state'

// ── Hydration Targets ──

export type HydrationTarget =
  | 'add-files'          // Files loaded, no analysis started
  | 'mid-analysis'       // ~50% of assets analysed
  | 'early-review'       // Entered review before all analysis complete
  | 'review-ready'       // All analysis complete, story groups proposed, nothing assigned
  | 'review-assigned'    // All analysis + all assets assigned via accept-all

// ── Core Hydration Function ──

export function hydrateFromScenario(
  scenario: MockScenario,
  target: HydrationTarget,
): V2State {
  const base = createV2InitialState()
  const now = new Date().toISOString()

  // Step 1: Always add files
  const assetIds: string[] = []
  const assetsById: Record<string, V2Asset> = {}

  for (let i = 0; i < scenario.assets.length; i++) {
    const id = `hydrated_${scenario.id}_${i}`
    assetIds.push(id)
    assetsById[id] = {
      id,
      filename: scenario.assets[i].filename,
      fileSize: scenario.assets[i].fileSize,
      format: scenario.assets[i].format,
      file: null,
      thumbnailRef: scenario.assets[i].thumbnailRef ?? null,
      excluded: false,
      storyGroupId: null, // NEVER auto-assigned
      proposal: null,
      editable: {
        title: '',
        description: '',
        tags: [],
        geography: [],
        captureDate: null,
        privacy: null,
        licences: [],
        price: null,
        metadataSource: {},
      },
      conflicts: [],
      extractedMetadata: null,
      declarationState: null,
      duplicateStatus: 'none',
      duplicateOfId: null,
      analysisStatus: 'pending',
      uploadProgress: 0,
      existingStoryMatch: null,
      createdAt: now,
      committedAt: null,
    }
  }

  let state: V2State = {
    ...base,
    batch: { ...base.batch, currentStage: 'add-files' },
    assetsById,
    assetOrder: assetIds,
  }

  if (target === 'add-files') return state

  // Step 2: Apply analysis results
  const analysisCount = target === 'mid-analysis' || target === 'early-review'
    ? Math.floor(scenario.assets.length * 0.5)
    : scenario.assets.length

  state = applyAnalysisResults(state, scenario, assetIds, analysisCount)
  state = { ...state, batch: { ...state.batch, currentStage: 'analysis' } }

  // Step 3: Add story group proposals (once enough analysis is done)
  if (analysisCount >= Math.floor(scenario.assets.length * 0.5)) {
    state = addStoryGroupProposals(state, scenario, assetIds)
  }

  if (target === 'mid-analysis') return state

  // Step 4: Enter review
  if (target === 'early-review') {
    return {
      ...state,
      batch: { ...state.batch, currentStage: 'review' },
      ui: { ...state.ui, reviewEnteredEarly: true },
    }
  }

  // Step 5: Full review-ready — all analysis complete
  state = applyAnalysisResults(state, scenario, assetIds, scenario.assets.length)
  state = {
    ...state,
    batch: { ...state.batch, currentStage: 'review' },
  }

  if (target === 'review-ready') return state

  // Step 6: Accept all proposed assignments
  if (target === 'review-assigned') {
    state = acceptAllProposals(state)
  }

  return state
}

// ── Internal Helpers ──

function applyAnalysisResults(
  state: V2State,
  scenario: MockScenario,
  assetIds: string[],
  count: number,
): V2State {
  const updated = { ...state.assetsById }

  for (let i = 0; i < count; i++) {
    const template = scenario.analysisTemplates.find(t => t.assetIndex === i)
    const assetId = assetIds[i]
    if (!assetId || !updated[assetId]) continue

    if (!template) {
      // No template — mark as failed
      updated[assetId] = { ...updated[assetId], analysisStatus: 'failed' }
      continue
    }

    // Build story candidates
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

    // Build extracted metadata from template if present
    const rawEm = template.extractedMetadata
    const extractedMetadata: import('./v2-types').ExtractedMetadata | null = rawEm ? {
      cameraMake: rawEm.cameraMake ?? null, cameraModel: rawEm.cameraModel ?? null,
      iso: rawEm.iso ?? null, aperture: rawEm.aperture ?? null,
      shutterSpeed: rawEm.shutterSpeed ?? null, focalLength: rawEm.focalLength ?? null,
      gpsLat: rawEm.gpsLat ?? null, gpsLon: rawEm.gpsLon ?? null,
      gpsLocationLabel: rawEm.gpsLocationLabel ?? null,
      iptcHeadline: rawEm.iptcHeadline ?? null, iptcCaption: rawEm.iptcCaption ?? null,
      iptcKeywords: rawEm.iptcKeywords ?? [], iptcByline: rawEm.iptcByline ?? null,
      iptcCity: rawEm.iptcCity ?? null, iptcCountry: rawEm.iptcCountry ?? null,
      iptcDateCreated: rawEm.iptcDateCreated ?? null, iptcCopyright: rawEm.iptcCopyright ?? null,
      iptcCredit: rawEm.iptcCredit ?? null, iptcSource: rawEm.iptcSource ?? null,
      xmpCreatorTool: rawEm.xmpCreatorTool ?? null, xmpRights: rawEm.xmpRights ?? null,
      c2paPresent: rawEm.c2paPresent ?? false, c2paVersion: rawEm.c2paVersion ?? null,
      c2paValid: rawEm.c2paValid ?? null, c2paSignerIdentity: rawEm.c2paSignerIdentity ?? null,
      dimensions: rawEm.dimensions ?? null, durationSeconds: rawEm.durationSeconds ?? null,
      colorSpace: rawEm.colorSpace ?? null, codec: rawEm.codec ?? null,
    } : null

    const em = extractedMetadata

    // Source hierarchy: embedded (IPTC) > AI proposal > blank
    // Only auto-fill title, description, tags, geography from embedded or AI
    const titleSource = em?.iptcHeadline ? 'embedded' as const : 'ai' as const
    const titleValue = em?.iptcHeadline || proposal.title
    const descSource = em?.iptcCaption ? 'embedded' as const : 'ai' as const
    const descValue = em?.iptcCaption || proposal.description
    const tagsSource = (em?.iptcKeywords && em.iptcKeywords.length > 0) ? 'embedded' as const : 'ai' as const
    const tagsValue = (em?.iptcKeywords && em.iptcKeywords.length > 0) ? em.iptcKeywords : proposal.tags
    const geoSource = em?.iptcCity ? 'embedded' as const : 'ai' as const
    const geoValue = em?.iptcCity ? [em.iptcCity, em.iptcCountry].filter(Boolean) as string[] : proposal.geography

    const asset = updated[assetId]
    updated[assetId] = {
      ...asset,
      analysisStatus: 'complete',
      uploadProgress: 100,
      proposal,
      declarationState: template.declarationState,
      duplicateStatus: template.duplicateOf !== undefined ? 'likely_duplicate' : 'none',
      duplicateOfId: template.duplicateOf !== undefined ? assetIds[template.duplicateOf] ?? null : null,
      extractedMetadata,
      conflicts: template.conflicts ?? [],
      // Auto-fill editable from embedded > AI, but NEVER privacy/licences/price
      editable: {
        ...asset.editable,
        title: asset.editable.title || titleValue,
        description: asset.editable.description || descValue,
        tags: asset.editable.tags.length > 0 ? asset.editable.tags : tagsValue,
        geography: asset.editable.geography.length > 0 ? asset.editable.geography : geoValue,
        captureDate: asset.editable.captureDate || em?.iptcDateCreated || null,
        // NEVER auto-fill privacy, licences, or price — creator sovereignty
        privacy: asset.editable.privacy,
        licences: asset.editable.licences,
        price: asset.editable.price,
        metadataSource: {
          ...asset.editable.metadataSource,
          title: asset.editable.title ? asset.editable.metadataSource.title : titleSource,
          description: asset.editable.description ? asset.editable.metadataSource.description : descSource,
          tags: asset.editable.tags.length > 0 ? asset.editable.metadataSource.tags : tagsSource,
          geography: asset.editable.geography.length > 0 ? asset.editable.metadataSource.geography : geoSource,
        },
      },
      // NEVER set storyGroupId — analysis proposes, creator decides
    }
  }

  // Mark remaining assets as still analysing
  for (let i = count; i < assetIds.length; i++) {
    const assetId = assetIds[i]
    if (assetId && updated[assetId] && updated[assetId].analysisStatus === 'pending') {
      updated[assetId] = { ...updated[assetId], analysisStatus: 'uploading', uploadProgress: 30 + Math.round((i % 5) * 12) }
    }
  }

  return { ...state, assetsById: updated }
}

function addStoryGroupProposals(
  state: V2State,
  scenario: MockScenario,
  assetIds: string[],
): V2State {
  const storyGroupsById: Record<string, V2StoryGroup> = { ...state.storyGroupsById }
  const storyGroupOrder: string[] = [...state.storyGroupOrder]

  for (let gi = 0; gi < scenario.storyGroupTemplates.length; gi++) {
    const gt = scenario.storyGroupTemplates[gi]
    const groupId = `sg_${scenario.id}_${gi}`

    if (storyGroupsById[groupId]) continue // already added

    storyGroupsById[groupId] = {
      id: groupId,
      name: gt.name,
      kind: gt.kind,
      proposedAssetIds: gt.assetIndices.map(idx => assetIds[idx]).filter(Boolean),
      existingStoryId: gt.existingStoryId ?? null,
      existingStoryTitle: gt.existingStoryTitle ?? null,
      existingStoryAssetCount: gt.existingStoryAssetCount ?? null,
      rationale: gt.rationale,
      confidence: gt.confidence,
      createdAt: new Date().toISOString(),
    }
    storyGroupOrder.push(groupId)
  }

  return { ...state, storyGroupsById, storyGroupOrder }
}

function acceptAllProposals(state: V2State): V2State {
  const updated = { ...state.assetsById }

  for (const groupId of state.storyGroupOrder) {
    const group = state.storyGroupsById[groupId]
    if (!group) continue
    for (const assetId of group.proposedAssetIds) {
      const asset = updated[assetId]
      if (asset && asset.storyGroupId === null && !asset.excluded) {
        updated[assetId] = { ...asset, storyGroupId: groupId }
      }
    }
  }

  return { ...state, assetsById: updated }
}

// ── Convenience: get asset IDs from hydrated state ──

export function getHydratedAssetIds(state: V2State): string[] {
  return [...state.assetOrder]
}