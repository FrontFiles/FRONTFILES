'use client'

import { useState, useReducer, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { v2Reducer, createV2InitialState, getAssets, getIncludedAssets, getStoryGroups, getAssetExceptions, getBlockingExceptions, getAdvisoryExceptions, getExpressEligibility, getAnalysisProgress, getUnassignedAssets } from '@/lib/upload/v2-state'
import type { V2State } from '@/lib/upload/v2-types'
import type { V2Action } from '@/lib/upload/v2-state'
import { SCENARIOS, type MockScenario } from '@/lib/upload/v2-mock-scenarios'
import type { ScenarioId } from '@/lib/upload/v2-scenario-registry'
import { SCENARIO_REGISTRY, SCENARIO_IDS } from '@/lib/upload/v2-scenario-registry'
import { type HydrationTarget } from '@/lib/upload/v2-hydration'
import { SimulationEngine, type SimEngineState, type SimAssetStage, SIM_STAGE_ORDER } from '@/lib/upload/v2-simulation-engine'
import { runAllVerifications, type VerificationResult } from '@/lib/upload/v2-verification'

const HYDRATION_TARGETS: { value: HydrationTarget; label: string }[] = [
  { value: 'add-files', label: 'Add Files' },
  { value: 'mid-analysis', label: 'Mid-Analysis (~50%)' },
  { value: 'early-review', label: 'Early Review' },
  { value: 'review-ready', label: 'Review Ready (full)' },
  { value: 'review-assigned', label: 'Review + All Assigned' },
]

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10]

export function DevHarness() {
  const [state, dispatch] = useReducer(v2Reducer, null, createV2InitialState)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('clean_single_story')
  const [simState, setSimState] = useState<SimEngineState | null>(null)
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([])
  const [activeTab, setActiveTab] = useState<'state' | 'simulation' | 'verification' | 'issues'>('state')
  const engineRef = useRef<SimulationEngine | null>(null)

  // Subscribe to engine state changes
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const unsub = engine.subscribe((s) => setSimState({ ...s }))
    return unsub
  }, [simState?.status]) // re-subscribe when engine changes

  // ── Scenario Actions ──

  const handleHydrate = useCallback((target: HydrationTarget) => {
    // Destroy existing engine
    engineRef.current?.destroy()
    engineRef.current = null
    setSimState(null)

    const scenario = SCENARIOS[selectedScenario]

    // Reset and re-hydrate via dispatch sequence
    dispatch({ type: 'RESET_FLOW' })

    // Slight delay to let reset propagate, then hydrate
    setTimeout(() => {
      // Add files
      dispatch({
        type: 'ADD_FILES',
        files: scenario.assets.map((a, i) => ({
          id: `hydrated_${scenario.id}_${i}`,
          filename: a.filename,
          fileSize: a.fileSize,
          format: a.format,
          file: null,
          thumbnailRef: a.thumbnailRef ?? null,
        })),
      })

      // If target is beyond add-files, apply analysis results via dispatch
      if (target !== 'add-files') {
        dispatch({ type: 'START_ANALYSIS' })
        applyHydrationViaDispatch(scenario, selectedScenario, target, dispatch)
      }
    }, 10)
  }, [selectedScenario])

  const handleStartSimulation = useCallback(() => {
    // Destroy existing engine
    engineRef.current?.destroy()

    const scenario = SCENARIOS[selectedScenario]

    // Reset state
    dispatch({ type: 'RESET_FLOW' })

    setTimeout(() => {
      // Add files
      dispatch({
        type: 'ADD_FILES',
        files: scenario.assets.map((a, i) => ({
          id: `sim_${scenario.id}_${i}`,
          filename: a.filename,
          fileSize: a.fileSize,
          format: a.format,
          file: null,
        })),
      })

      // Create engine with the new asset IDs
      setTimeout(() => {
        const assetIds = scenario.assets.map((_, i) => `sim_${scenario.id}_${i}`)
        const engine = new SimulationEngine(scenario, assetIds, dispatch)
        engineRef.current = engine
        const unsub = engine.subscribe((s) => setSimState({ ...s }))
        engine.start()

        // Cleanup subscription on next engine creation
        return unsub
      }, 10)
    }, 10)
  }, [selectedScenario])

  const handleRunVerification = useCallback(() => {
    const results = runAllVerifications(state, selectedScenario)
    setVerificationResults(results)
    setActiveTab('verification')
  }, [state, selectedScenario])

  // ── Derived State ──

  const assets = getAssets(state)
  const included = getIncludedAssets(state)
  const groups = getStoryGroups(state)
  const progress = getAnalysisProgress(state)
  const blockers = getBlockingExceptions(state)
  const advisories = getAdvisoryExceptions(state)
  const express = getExpressEligibility(state)
  const unassigned = getUnassignedAssets(state)
  const meta = SCENARIO_REGISTRY[selectedScenario]

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Left: Controls */}
      <div className="w-80 border-r-2 border-black bg-white flex flex-col overflow-y-auto">
        {/* Scenario Picker */}
        <div className="p-4 border-b border-black">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Scenario</label>
          <select
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value as ScenarioId)}
            className="w-full border-2 border-black px-3 py-2 text-xs font-mono bg-white"
          >
            {SCENARIO_IDS.map(id => (
              <option key={id} value={id}>{SCENARIO_REGISTRY[id].label}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{meta.description}</p>
        </div>

        {/* Stage Shortcuts (Hydration) */}
        <div className="p-4 border-b border-black">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jump to State</label>
          <div className="space-y-1">
            {HYDRATION_TARGETS.map(h => (
              <button
                key={h.value}
                onClick={() => handleHydrate(h.value)}
                className="w-full text-left px-3 py-2 text-xs font-mono border border-slate-200 hover:border-black hover:bg-slate-50 transition-colors"
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Analysis Simulation Controls */}
        <div className="p-4 border-b border-black">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Simulation Engine</label>
          <div className="space-y-2">
            <button
              onClick={handleStartSimulation}
              className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest bg-black text-white hover:bg-slate-800"
            >
              Start Simulation
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => engineRef.current?.pause()}
                disabled={simState?.status !== 'running'}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Pause
              </button>
              <button
                onClick={() => engineRef.current?.resume()}
                disabled={simState?.status !== 'paused'}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Resume
              </button>
              <button
                onClick={() => engineRef.current?.stepNext()}
                disabled={!simState || simState.status === 'complete'}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Step
              </button>
            </div>
            <button
              onClick={() => engineRef.current?.completeAll()}
              disabled={!simState || simState.status === 'complete'}
              className="w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Complete All
            </button>

            {/* Speed control */}
            {simState && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Speed: {simState.speedMultiplier}x</label>
                <div className="flex gap-1 flex-wrap">
                  {SPEED_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => engineRef.current?.setSpeed(s)}
                      className={cn(
                        'px-2 py-1 text-[10px] font-mono border transition-colors',
                        simState.speedMultiplier === s
                          ? 'border-[#0000ff] bg-[#0000ff]/5 text-[#0000cc]'
                          : 'border-slate-200 hover:border-black',
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Simulation status */}
            {simState && (
              <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                <div>Status: <span className={cn(
                  'font-bold',
                  simState.status === 'running' && 'text-green-600',
                  simState.status === 'paused' && 'text-amber-600',
                  simState.status === 'complete' && 'text-[#0000ff]',
                )}>{simState.status}</span></div>
                <div>Elapsed: {Math.round(simState.elapsedMs)}ms</div>
                <div>Groups proposed: {simState.storyGroupsProposed ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>
        </div>

        {/* Verification */}
        <div className="p-4 border-b border-black">
          <button
            onClick={handleRunVerification}
            className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest border-2 border-green-600 text-green-700 hover:bg-green-50 transition-colors"
          >
            Run Verification
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Quick Actions</label>
          <div className="space-y-1">
            <button
              onClick={() => dispatch({ type: 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS' })}
              className="w-full text-left px-3 py-2 text-xs font-mono border border-slate-200 hover:border-black hover:bg-slate-50"
            >
              Accept All Proposals
            </button>
            <button
              onClick={() => dispatch({ type: 'APPLY_EXPRESS_FLOW' })}
              className="w-full text-left px-3 py-2 text-xs font-mono border border-slate-200 hover:border-black hover:bg-slate-50"
            >
              Apply Express Flow
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}
              className="w-full text-left px-3 py-2 text-xs font-mono border border-slate-200 hover:border-black hover:bg-slate-50"
            >
              Force Stage: Review
            </button>
            <button
              onClick={() => dispatch({ type: 'RESET_FLOW' })}
              className="w-full text-left px-3 py-2 text-xs font-mono border border-red-200 hover:border-red-500 hover:bg-red-50 text-red-600"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>

      {/* Right: Panels */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="border-b-2 border-black bg-white flex-shrink-0">
          <div className="flex">
            {([
              { id: 'state', label: 'State Summary' },
              { id: 'simulation', label: 'Simulation' },
              { id: 'verification', label: 'Verification' },
              { id: 'issues', label: 'Issues' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-slate-400 hover:text-black',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'state' && <StateSummaryPanel state={state} meta={meta} express={express} progress={progress} blockers={blockers} advisories={advisories} unassigned={unassigned} groups={groups} assets={assets} included={included} />}
          {activeTab === 'simulation' && <SimulationPanel simState={simState} />}
          {activeTab === 'verification' && <VerificationPanel results={verificationResults} />}
          {activeTab === 'issues' && <IssuesPanel state={state} />}
        </div>
      </div>
    </div>
  )
}

// ── Hydration via Dispatch ──

function applyHydrationViaDispatch(
  scenario: MockScenario,
  scenarioId: ScenarioId,
  target: HydrationTarget,
  dispatch: (action: V2Action) => void,
) {
  const analysisCount = target === 'mid-analysis' || target === 'early-review'
    ? Math.floor(scenario.assets.length * 0.5)
    : scenario.assets.length

  // Apply analysis results
  for (let i = 0; i < analysisCount; i++) {
    const template = scenario.analysisTemplates.find((t: { assetIndex: number }) => t.assetIndex === i)
    const assetId = `hydrated_${scenarioId}_${i}`

    if (!template) {
      dispatch({ type: 'ANALYSIS_FAILED', assetId })
      continue
    }

    const storyCandidates: import('@/lib/upload/v2-types').StoryCandidate[] = []
    for (const gt of scenario.storyGroupTemplates) {
      if (gt.assetIndices.includes(i)) {
        storyCandidates.push({
          storyGroupId: `sg_${scenarioId}_${scenario.storyGroupTemplates.indexOf(gt)}`,
          score: gt.confidence,
          rationale: gt.rationale,
        })
      }
    }

    const proposal: import('@/lib/upload/v2-types').AssetProposal = {
      title: template.title,
      description: template.description,
      tags: template.tags,
      geography: template.geography,
      priceSuggestion: {
        amount: template.priceSuggestionCents,
        confidence: template.confidence * 0.9,
        basis: `${scenario.assets[i]?.format ?? 'photo'} / ${template.privacySuggestion.toLowerCase()}`,
        factors: [],
      },
      privacySuggestion: template.privacySuggestion,
      licenceSuggestions: template.licenceSuggestions,
      confidence: template.confidence,
      rationale: `Analysis confidence ${Math.round(template.confidence * 100)}%`,
      storyCandidates,
    }

    dispatch({
      type: 'UPDATE_ANALYSIS_RESULT',
      assetId,
      proposal,
      declarationState: template.declarationState,
      duplicateStatus: template.duplicateOf !== undefined ? 'likely_duplicate' : 'none',
      duplicateOfId: template.duplicateOf !== undefined ? `hydrated_${scenarioId}_${template.duplicateOf}` : null,
    })
  }

  // Add story group proposals
  if (analysisCount >= Math.floor(scenario.assets.length * 0.3)) {
    for (let gi = 0; gi < scenario.storyGroupTemplates.length; gi++) {
      const gt = scenario.storyGroupTemplates[gi]
      const groupId = `sg_${scenarioId}_${gi}`
      dispatch({
        type: 'ADD_STORY_GROUP_PROPOSAL',
        group: {
          id: groupId,
          name: gt.name,
          kind: gt.kind,
          proposedAssetIds: gt.assetIndices.map((idx: number) => `hydrated_${scenarioId}_${idx}`),
          existingStoryId: gt.existingStoryId ?? null,
          existingStoryTitle: gt.existingStoryTitle ?? null,
          existingStoryAssetCount: gt.existingStoryAssetCount ?? null,
          rationale: gt.rationale,
          confidence: gt.confidence,
        },
      })
    }
  }

  // Stage transitions
  if (target === 'early-review') {
    dispatch({ type: 'ENTER_REVIEW_EARLY' })
  } else if (target === 'review-ready' || target === 'review-assigned') {
    dispatch({ type: 'SET_STAGE', stage: 'review' })
  }

  // Accept all if target is review-assigned
  if (target === 'review-assigned') {
    setTimeout(() => {
      dispatch({ type: 'ACCEPT_ALL_PROPOSED_ASSIGNMENTS' })
    }, 10)
  }
}

// ── State Summary Panel ──

function StateSummaryPanel({
  state, meta, express, progress, blockers, advisories, unassigned, groups, assets, included,
}: {
  state: V2State
  meta: import('@/lib/upload/v2-scenario-registry').ScenarioMeta
  express: ReturnType<typeof getExpressEligibility>
  progress: ReturnType<typeof getAnalysisProgress>
  blockers: ReturnType<typeof getBlockingExceptions>
  advisories: ReturnType<typeof getAdvisoryExceptions>
  unassigned: ReturnType<typeof getUnassignedAssets>
  groups: ReturnType<typeof getStoryGroups>
  assets: ReturnType<typeof getAssets>
  included: ReturnType<typeof getIncludedAssets>
}) {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Stage + Counts */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Stage" value={state.batch.currentStage} />
        <MetricCard label="Assets" value={`${assets.length}`} sub={`${included.length} included`} />
        <MetricCard label="Analysis" value={`${progress.complete}/${progress.total}`} sub={`${progress.percent}%`} />
        <MetricCard label="Story Groups" value={`${groups.length}`} sub={`expected: ${meta.expectedStoryProposalCount}`} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Blocking" value={`${blockers.length}`} color={blockers.length > 0 ? 'red' : 'green'} />
        <MetricCard label="Advisory" value={`${advisories.length}`} color={advisories.length > 0 ? 'amber' : 'green'} />
        <MetricCard label="Unassigned" value={`${unassigned.length}`} color={unassigned.length > 0 ? 'red' : 'green'} />
        <MetricCard label="Express" value={express.eligible ? 'Eligible' : 'Not eligible'} color={express.eligible ? 'green' : 'slate'} />
      </div>

      {/* Expected vs Actual */}
      <div className="border-2 border-black">
        <div className="px-4 py-2 bg-slate-50 border-b border-black">
          <span className="text-[10px] font-bold uppercase tracking-widest">Expected vs Actual</span>
        </div>
        <div className="divide-y divide-slate-100">
          <CompareRow label="Express eligible" expected={meta.expectedExpressEligible ? 'Yes' : 'No'} actual={express.eligible ? 'Yes' : 'No'} pass={express.eligible === meta.expectedExpressEligible || progress.complete < progress.total} />
          <CompareRow label="Story groups" expected={`${meta.expectedStoryProposalCount}`} actual={`${groups.length}`} pass={groups.length === meta.expectedStoryProposalCount} />
          <CompareRow label="Asset count" expected={`${meta.expectedAssetCountRange[0]}-${meta.expectedAssetCountRange[1]}`} actual={`${assets.length}`} pass={assets.length >= meta.expectedAssetCountRange[0] && assets.length <= meta.expectedAssetCountRange[1]} />
          <CompareRow label="Blocking assets" expected={`${meta.expectedInitialBlockerCountRange[0]}-${meta.expectedInitialBlockerCountRange[1]}`} actual={`${blockers.length}`} pass={blockers.length >= meta.expectedInitialBlockerCountRange[0] && blockers.length <= meta.expectedInitialBlockerCountRange[1]} />
          <CompareRow label="Advisory assets" expected={`${meta.expectedInitialAdvisoryCountRange[0]}-${meta.expectedInitialAdvisoryCountRange[1]}`} actual={`${advisories.length}`} pass={advisories.length >= meta.expectedInitialAdvisoryCountRange[0] && advisories.length <= meta.expectedInitialAdvisoryCountRange[1]} />
        </div>
      </div>

      {/* Story Groups Detail */}
      {groups.length > 0 && (
        <div className="border-2 border-black">
          <div className="px-4 py-2 bg-slate-50 border-b border-black">
            <span className="text-[10px] font-bold uppercase tracking-widest">Story Groups</span>
          </div>
          <div className="divide-y divide-slate-100">
            {groups.map(g => {
              const assignedCount = included.filter(a => a.storyGroupId === g.id).length
              return (
                <div key={g.id} className="px-4 py-2 flex items-center gap-3">
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5',
                    g.kind === 'proposed' && 'bg-[#0000ff]/10 text-[#0000cc]',
                    g.kind === 'matched-existing' && 'bg-amber-100 text-amber-700',
                    g.kind === 'creator' && 'bg-green-100 text-green-700',
                  )}>
                    {g.kind}
                  </span>
                  <span className="text-xs font-bold flex-1">{g.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {assignedCount} assigned / {g.proposedAssetIds.length} proposed
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    conf: {Math.round(g.confidence * 100)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Simulation Panel ──

function SimulationPanel({ simState }: { simState: SimEngineState | null }) {
  if (!simState) {
    return (
      <div className="text-sm text-slate-400 p-8 text-center">
        No simulation running. Use the controls to start one.
      </div>
    )
  }

  // Count assets per stage
  const stageCounts: Record<SimAssetStage, number> = {
    queued: 0, ingesting: 0, analyzing: 0, declaration_check: 0, proposal_ready: 0, complete: 0,
  }
  for (const a of simState.assetStates) {
    stageCounts[a.stage]++
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Stage distribution bar */}
      <div className="border-2 border-black">
        <div className="px-4 py-2 bg-slate-50 border-b border-black">
          <span className="text-[10px] font-bold uppercase tracking-widest">Asset Stage Distribution</span>
        </div>
        <div className="p-4">
          <div className="flex h-8 border border-black overflow-hidden">
            {SIM_STAGE_ORDER.map(stage => {
              const count = stageCounts[stage]
              const pct = simState.assetStates.length > 0 ? (count / simState.assetStates.length) * 100 : 0
              if (pct === 0) return null
              return (
                <div
                  key={stage}
                  className={cn(
                    'flex items-center justify-center text-[9px] font-bold uppercase tracking-wider',
                    stage === 'queued' && 'bg-slate-200 text-slate-600',
                    stage === 'ingesting' && 'bg-[#0000ff]/15 text-[#0000cc]',
                    stage === 'analyzing' && 'bg-purple-200 text-purple-700',
                    stage === 'declaration_check' && 'bg-amber-200 text-amber-700',
                    stage === 'proposal_ready' && 'bg-green-200 text-green-700',
                    stage === 'complete' && 'bg-green-500 text-white',
                  )}
                  style={{ width: `${pct}%` }}
                >
                  {count > 0 && count}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            {SIM_STAGE_ORDER.map(stage => (
              <div key={stage} className="text-center">
                <div className="text-[9px] font-mono text-slate-400">{stage.replace('_', ' ')}</div>
                <div className="text-xs font-bold">{stageCounts[stage]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-asset detail (scrollable) */}
      <div className="border-2 border-black">
        <div className="px-4 py-2 bg-slate-50 border-b border-black">
          <span className="text-[10px] font-bold uppercase tracking-widest">Per-Asset State ({simState.assetStates.length})</span>
        </div>
        <div className="max-h-96 overflow-auto divide-y divide-slate-100">
          {simState.assetStates.map(a => (
            <div key={a.assetId} className="px-4 py-1.5 flex items-center gap-2 text-[10px] font-mono">
              <span className="w-6 text-slate-400 text-right">{a.assetIndex}</span>
              <span className={cn(
                'px-1.5 py-0.5 font-bold uppercase tracking-wider',
                a.stage === 'queued' && 'bg-slate-100 text-slate-500',
                a.stage === 'ingesting' && 'bg-[#0000ff]/10 text-[#0000ff]',
                a.stage === 'analyzing' && 'bg-purple-100 text-purple-600',
                a.stage === 'declaration_check' && 'bg-amber-100 text-amber-600',
                a.stage === 'proposal_ready' && 'bg-green-100 text-green-600',
                a.stage === 'complete' && 'bg-green-500 text-white',
              )}>
                {a.stage}
              </span>
              <div className="flex-1 bg-slate-100 h-1.5">
                <div
                  className={cn(
                    'h-full transition-all',
                    a.stage === 'complete' ? 'bg-green-500' : 'bg-[#0000ff]',
                  )}
                  style={{ width: `${a.progress}%` }}
                />
              </div>
              <span className="w-8 text-right text-slate-400">{a.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Verification Panel ──

function VerificationPanel({ results }: { results: VerificationResult[] }) {
  if (results.length === 0) {
    return (
      <div className="text-sm text-slate-400 p-8 text-center">
        No verification results yet. Load a scenario and click Run Verification.
      </div>
    )
  }

  const passCount = results.filter(r => r.pass).length

  return (
    <div className="space-y-3 max-w-4xl">
      <div className="flex items-center gap-3">
        <span className={cn(
          'text-sm font-bold',
          passCount === results.length ? 'text-green-600' : 'text-red-600',
        )}>
          {passCount}/{results.length} passed
        </span>
      </div>

      {results.map(r => (
        <div
          key={r.id}
          className={cn(
            'border-2',
            r.pass ? 'border-green-300 bg-green-50/50' : 'border-red-300 bg-red-50/50',
          )}
        >
          <div className="px-4 py-2 flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5',
              r.pass ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700',
            )}>
              {r.pass ? 'PASS' : 'FAIL'}
            </span>
            <span className="text-xs font-bold">{r.label}</span>
          </div>
          {r.details.length > 0 && (
            <div className="px-4 pb-2 space-y-0.5">
              {r.details.map((d, i) => (
                <div key={i} className="text-[10px] font-mono text-slate-600">{d}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Issues Panel ──

function IssuesPanel({ state }: { state: V2State }) {
  const included = getIncludedAssets(state)
  const allExceptions: Array<{ filename: string; assetId: string; type: string; severity: string; label: string }> = []

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset)
    for (const e of exceptions) {
      allExceptions.push({
        filename: asset.filename,
        assetId: asset.id,
        type: e.type,
        severity: e.severity,
        label: e.label,
      })
    }
  }

  if (allExceptions.length === 0) {
    return (
      <div className="text-sm text-slate-400 p-8 text-center">
        No issues. Load a scenario to see exceptions.
      </div>
    )
  }

  const blocking = allExceptions.filter(e => e.severity === 'blocking')
  const advisory = allExceptions.filter(e => e.severity === 'advisory')

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex gap-4">
        <span className="text-xs font-bold text-red-600">{blocking.length} blocking</span>
        <span className="text-xs font-bold text-amber-600">{advisory.length} advisory</span>
      </div>

      {/* Blocking */}
      {blocking.length > 0 && (
        <div className="border-2 border-red-300">
          <div className="px-4 py-2 bg-red-50 border-b border-red-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">Blocking ({blocking.length})</span>
          </div>
          <div className="max-h-64 overflow-auto divide-y divide-red-100">
            {blocking.map((e, i) => (
              <div key={i} className="px-4 py-1.5 flex items-center gap-2 text-[10px]">
                <span className="font-mono text-slate-400 truncate max-w-40">{e.filename}</span>
                <span className="font-bold text-red-600 px-1.5 py-0.5 bg-red-100">{e.type}</span>
                <span className="text-slate-500 flex-1">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advisory */}
      {advisory.length > 0 && (
        <div className="border-2 border-amber-300">
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Advisory ({advisory.length})</span>
          </div>
          <div className="max-h-64 overflow-auto divide-y divide-amber-100">
            {advisory.map((e, i) => (
              <div key={i} className="px-4 py-1.5 flex items-center gap-2 text-[10px]">
                <span className="font-mono text-slate-400 truncate max-w-40">{e.filename}</span>
                <span className="font-bold text-amber-600 px-1.5 py-0.5 bg-amber-100">{e.type}</span>
                <span className="text-slate-500 flex-1">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared Components ──

function MetricCard({ label, value, sub, color = 'slate' }: { label: string; value: string; sub?: string; color?: 'slate' | 'red' | 'green' | 'amber' | 'blue' }) {
  return (
    <div className="border-2 border-black p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={cn(
        'text-lg font-bold font-mono mt-0.5',
        color === 'red' && 'text-red-600',
        color === 'green' && 'text-green-600',
        color === 'amber' && 'text-amber-600',
        color === 'blue' && 'text-[#0000ff]',
      )}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-slate-400">{sub}</div>}
    </div>
  )
}

function CompareRow({ label, expected, actual, pass }: { label: string; expected: string; actual: string; pass: boolean }) {
  return (
    <div className="px-4 py-2 flex items-center gap-4">
      <span className="text-xs font-bold w-36">{label}</span>
      <span className="text-[10px] font-mono text-slate-400 w-24">exp: {expected}</span>
      <span className={cn(
        'text-[10px] font-mono font-bold w-24',
        pass ? 'text-green-600' : 'text-red-600',
      )}>
        act: {actual}
      </span>
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5',
        pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
      )}>
        {pass ? 'MATCH' : 'MISMATCH'}
      </span>
    </div>
  )
}
