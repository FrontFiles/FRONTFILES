/**
 * Frontfiles Bulk Upload v2 — Controllable Analysis Simulation Engine
 *
 * Replaces the basic v2-simulation.ts with a full-featured engine supporting:
 * - start / pause / resume / step / complete-all / reset
 * - speed multiplier (0.25x to 10x)
 * - per-asset staged states: queued → ingesting → analyzing → declaration_check → proposal_ready → complete
 * - deterministic — no Math.random(), uses scenario-seeded timing
 *
 * CRITICAL: Never sets storyGroupId. Story assignment is creator-only.
 * Creates StoryGroup proposals with proposedAssetIds for system suggestions.
 */

'use client'

import type { MockScenario } from './v2-mock-scenarios'
import type { V2Action } from './v2-state'
import type { AssetProposal, StoryCandidate, V2StoryGroup, ExtractedMetadata, MetadataConflict } from './v2-types'

// ── Per-Asset Simulation Stage ──

export type SimAssetStage =
  | 'queued'
  | 'ingesting'
  | 'analyzing'
  | 'declaration_check'
  | 'proposal_ready'
  | 'complete'

export const SIM_STAGE_ORDER: SimAssetStage[] = [
  'queued', 'ingesting', 'analyzing', 'declaration_check', 'proposal_ready', 'complete',
]

export interface SimAssetState {
  assetId: string
  assetIndex: number
  stage: SimAssetStage
  progress: number // 0-100 within current stage
}

// ── Engine State ──

export type SimEngineStatus = 'idle' | 'running' | 'paused' | 'complete'

export interface SimEngineState {
  status: SimEngineStatus
  speedMultiplier: number
  assetStates: SimAssetState[]
  storyGroupsProposed: boolean
  elapsedMs: number
}

// ── Engine Events (for UI observation) ──

export type SimEngineListener = (state: SimEngineState) => void

// ── Deterministic timing ──

function seededDelay(seed: number, base: number, variance: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  const r = x - Math.floor(x)
  return base + r * variance
}

// ── Engine Class ──

export class SimulationEngine {
  private scenario: MockScenario
  private assetIds: string[]
  private dispatch: (action: V2Action) => void

  private _state: SimEngineState
  private listeners: Set<SimEngineListener> = new Set()
  private rafId: number | null = null
  private lastTickTime: number = 0

  // Per-asset timing targets (ms from sim start)
  private assetTimings: Array<{
    ingestStart: number
    ingestEnd: number
    analyzeEnd: number
    declarationEnd: number
    proposalEnd: number
    completeTime: number
  }> = []

  private storyGroupDelay: number = 0

  constructor(
    scenario: MockScenario,
    assetIds: string[],
    dispatch: (action: V2Action) => void,
  ) {
    this.scenario = scenario
    this.assetIds = assetIds
    this.dispatch = dispatch

    this._state = {
      status: 'idle',
      speedMultiplier: 1,
      assetStates: assetIds.map((id, i) => ({
        assetId: id,
        assetIndex: i,
        stage: 'queued' as SimAssetStage,
        progress: 0,
      })),
      storyGroupsProposed: false,
      elapsedMs: 0,
    }

    // Compute deterministic timing for each asset
    for (let i = 0; i < assetIds.length; i++) {
      const stagger = i * seededDelay(i * 3, 80, 60) // 80-140ms stagger
      const ingestDuration = seededDelay(i * 7, 400, 500) // 400-900ms
      const analyzeDuration = seededDelay(i * 11, 300, 600) // 300-900ms
      const declarationDuration = seededDelay(i * 13, 200, 300) // 200-500ms
      const proposalDuration = seededDelay(i * 17, 100, 200) // 100-300ms

      const ingestStart = stagger
      const ingestEnd = ingestStart + ingestDuration
      const analyzeEnd = ingestEnd + analyzeDuration
      const declarationEnd = analyzeEnd + declarationDuration
      const proposalEnd = declarationEnd + proposalDuration
      const completeTime = proposalEnd + 50

      this.assetTimings.push({
        ingestStart,
        ingestEnd,
        analyzeEnd,
        declarationEnd,
        proposalEnd,
        completeTime,
      })
    }

    // Story group proposals come after ~60% of assets reach analyzing
    const sortedAnalyze = this.assetTimings.map(t => t.analyzeEnd).sort((a, b) => a - b)
    const sixtyPercent = Math.floor(sortedAnalyze.length * 0.6)
    this.storyGroupDelay = (sortedAnalyze[sixtyPercent] ?? 1500) + 200
  }

  // ── Public API ──

  get state(): SimEngineState {
    return this._state
  }

  subscribe(listener: SimEngineListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this._state.status === 'running') return
    if (this._state.status === 'complete') return

    this.dispatch({ type: 'START_ANALYSIS' })

    this._state = { ...this._state, status: 'running' }
    this.lastTickTime = performance.now()
    this.scheduleTick()
    this.notify()
  }

  pause(): void {
    if (this._state.status !== 'running') return
    this._state = { ...this._state, status: 'paused' }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.notify()
  }

  resume(): void {
    if (this._state.status !== 'paused') return
    this._state = { ...this._state, status: 'running' }
    this.lastTickTime = performance.now()
    this.scheduleTick()
    this.notify()
  }

  setSpeed(multiplier: number): void {
    this._state = { ...this._state, speedMultiplier: Math.max(0.25, Math.min(10, multiplier)) }
    this.notify()
  }

  /** Advance exactly one asset to its next stage */
  stepNext(): void {
    // Find the first non-complete asset
    const idx = this._state.assetStates.findIndex(a => a.stage !== 'complete')
    if (idx === -1) return

    const current = this._state.assetStates[idx]
    const stageIdx = SIM_STAGE_ORDER.indexOf(current.stage)
    const nextStage = SIM_STAGE_ORDER[stageIdx + 1]
    if (!nextStage) return

    const updated = [...this._state.assetStates]
    updated[idx] = { ...current, stage: nextStage, progress: 0 }

    // Apply the dispatch for this transition
    this.applyStageTransition(idx, nextStage)

    this._state = { ...this._state, assetStates: updated }

    // Check if all complete
    if (nextStage === 'complete' && updated.every(a => a.stage === 'complete')) {
      this.finalizeIfNeeded()
    }

    this.notify()
  }

  /** Complete all remaining assets instantly */
  completeAll(): void {
    if (this._state.status === 'complete') return

    // Cancel animation frame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    // Ensure START_ANALYSIS was dispatched
    if (this._state.status === 'idle') {
      this.dispatch({ type: 'START_ANALYSIS' })
    }

    const updated = this._state.assetStates.map((a, i) => {
      if (a.stage !== 'complete') {
        // Apply all remaining transitions
        const currentIdx = SIM_STAGE_ORDER.indexOf(a.stage)
        for (let s = currentIdx + 1; s < SIM_STAGE_ORDER.length; s++) {
          this.applyStageTransition(i, SIM_STAGE_ORDER[s])
        }
        return { ...a, stage: 'complete' as SimAssetStage, progress: 100 }
      }
      return a
    })

    this._state = { ...this._state, assetStates: updated, status: 'complete' }

    // Propose story groups if not done
    if (!this._state.storyGroupsProposed) {
      this.proposeStoryGroups()
    }

    this.notify()
  }

  /** Reset to initial state */
  reset(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this._state = {
      status: 'idle',
      speedMultiplier: this._state.speedMultiplier,
      assetStates: this.assetIds.map((id, i) => ({
        assetId: id,
        assetIndex: i,
        stage: 'queued',
        progress: 0,
      })),
      storyGroupsProposed: false,
      elapsedMs: 0,
    }
    this.notify()
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.listeners.clear()
  }

  // ── Internal ──

  private notify(): void {
    for (const fn of this.listeners) {
      fn(this._state)
    }
  }

  private scheduleTick(): void {
    this.rafId = requestAnimationFrame((now) => this.tick(now))
  }

  private tick(now: number): void {
    if (this._state.status !== 'running') return

    const delta = (now - this.lastTickTime) * this._state.speedMultiplier
    this.lastTickTime = now
    const elapsed = this._state.elapsedMs + delta

    const updated = this._state.assetStates.map((a, i) => {
      if (a.stage === 'complete') return a

      const timing = this.assetTimings[i]
      let newStage: SimAssetStage = a.stage
      let newProgress = a.progress

      if (elapsed >= timing.completeTime) {
        newStage = 'complete'
        newProgress = 100
      } else if (elapsed >= timing.proposalEnd) {
        newStage = 'proposal_ready'
        newProgress = Math.min(100, Math.round(((elapsed - timing.proposalEnd) / (timing.completeTime - timing.proposalEnd)) * 100))
      } else if (elapsed >= timing.declarationEnd) {
        newStage = 'declaration_check'
        newProgress = Math.min(100, Math.round(((elapsed - timing.declarationEnd) / (timing.proposalEnd - timing.declarationEnd)) * 100))
      } else if (elapsed >= timing.analyzeEnd) {
        newStage = 'analyzing'
        newProgress = 100
      } else if (elapsed >= timing.ingestEnd) {
        newStage = 'analyzing'
        newProgress = Math.min(100, Math.round(((elapsed - timing.ingestEnd) / (timing.analyzeEnd - timing.ingestEnd)) * 100))
      } else if (elapsed >= timing.ingestStart) {
        newStage = 'ingesting'
        newProgress = Math.min(100, Math.round(((elapsed - timing.ingestStart) / (timing.ingestEnd - timing.ingestStart)) * 100))
      } else {
        newStage = 'queued'
        newProgress = 0
      }

      // Dispatch transitions when stage changes
      if (newStage !== a.stage) {
        this.applyStageTransition(i, newStage)
      }

      return { ...a, stage: newStage, progress: newProgress }
    })

    // Story group proposals
    let groupsProposed = this._state.storyGroupsProposed
    if (!groupsProposed && elapsed >= this.storyGroupDelay) {
      this.proposeStoryGroups()
      groupsProposed = true
    }

    const allComplete = updated.every(a => a.stage === 'complete')

    this._state = {
      ...this._state,
      assetStates: updated,
      storyGroupsProposed: groupsProposed,
      elapsedMs: elapsed,
      status: allComplete ? 'complete' : 'running',
    }

    this.notify()

    if (!allComplete) {
      this.scheduleTick()
    }
  }

  private applyStageTransition(assetIndex: number, newStage: SimAssetStage): void {
    const assetId = this.assetIds[assetIndex]
    if (!assetId) return

    switch (newStage) {
      case 'ingesting':
        this.dispatch({ type: 'UPDATE_ANALYSIS_PROGRESS', assetId, progress: 10 })
        break

      case 'analyzing':
        this.dispatch({ type: 'UPDATE_ANALYSIS_PROGRESS', assetId, progress: 50 })
        break

      case 'declaration_check':
        this.dispatch({ type: 'UPDATE_ANALYSIS_PROGRESS', assetId, progress: 75 })
        break

      case 'proposal_ready':
        this.dispatch({ type: 'UPDATE_ANALYSIS_PROGRESS', assetId, progress: 90 })
        break

      case 'complete': {
        const template = this.scenario.analysisTemplates.find(t => t.assetIndex === assetIndex)
        if (!template) {
          this.dispatch({ type: 'ANALYSIS_FAILED', assetId })
          break
        }

        // Build story candidates
        const storyCandidates: StoryCandidate[] = []
        for (const gt of this.scenario.storyGroupTemplates) {
          if (gt.assetIndices.includes(assetIndex)) {
            storyCandidates.push({
              storyGroupId: `sg_${this.scenario.id}_${this.scenario.storyGroupTemplates.indexOf(gt)}`,
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
            basis: `${this.scenario.assets[assetIndex]?.format ?? 'photo'} / ${template.privacySuggestion.toLowerCase()} / ${template.declarationState.replace(/_/g, ' ')}`,
            factors: [
              { label: this.scenario.assets[assetIndex]?.format ?? 'photo', effect: 'neutral', weight: 1.0 },
              { label: template.declarationState.replace(/_/g, ' '), effect: template.declarationState === 'fully_validated' ? 'increase' : 'neutral', weight: 0.3 },
            ],
          },
          privacySuggestion: template.privacySuggestion,
          licenceSuggestions: template.licenceSuggestions,
          confidence: template.confidence,
          rationale: `Based on ${template.geography.length > 0 ? template.geography.join(', ') : 'content analysis'} with ${Math.round(template.confidence * 100)}% confidence.`,
          storyCandidates,
        }

        // Build full ExtractedMetadata from template partial (fill nulls for unset fields)
        const rawEm = template.extractedMetadata
        const extractedMetadata: ExtractedMetadata | null = rawEm ? {
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

        this.dispatch({
          type: 'UPDATE_ANALYSIS_RESULT',
          assetId,
          proposal,
          declarationState: template.declarationState,
          duplicateStatus: template.duplicateOf !== undefined ? 'likely_duplicate' : 'none',
          duplicateOfId: template.duplicateOf !== undefined ? this.assetIds[template.duplicateOf] ?? null : null,
          extractedMetadata,
          conflicts: template.conflicts ?? undefined,
        })
        break
      }
    }
  }

  private proposeStoryGroups(): void {
    for (let gi = 0; gi < this.scenario.storyGroupTemplates.length; gi++) {
      const gt = this.scenario.storyGroupTemplates[gi]
      const groupId = `sg_${this.scenario.id}_${gi}`
      const group: Omit<V2StoryGroup, 'createdAt'> = {
        id: groupId,
        name: gt.name,
        kind: gt.kind,
        proposedAssetIds: gt.assetIndices.map(idx => this.assetIds[idx]).filter(Boolean),
        existingStoryId: gt.existingStoryId ?? null,
        existingStoryTitle: gt.existingStoryTitle ?? null,
        existingStoryAssetCount: gt.existingStoryAssetCount ?? null,
        rationale: gt.rationale,
        confidence: gt.confidence,
      }
      this.dispatch({ type: 'ADD_STORY_GROUP_PROPOSAL', group })
    }
    this._state = { ...this._state, storyGroupsProposed: true }
  }

  private finalizeIfNeeded(): void {
    if (!this._state.storyGroupsProposed) {
      this.proposeStoryGroups()
    }
    this._state = { ...this._state, status: 'complete' }
  }
}
