/**
 * Frontfiles Upload — Shared Selectors (Option B per C2.1-DIRECTIVE §3.0)
 *
 * Pure selector functions that compute facts from upload state. Extracted
 * from v2-state.ts so both the V2 reducer (dormant) and the V3 reducer
 * (canonical, post-C2) can consume them via a single source of truth.
 *
 * Design discipline (per founder guardrail):
 * - Inputs are NARROW. Selectors take view-shaped types (AssetsView,
 *   StoryGroupsView, DefaultsView), NEVER full V2State or V3State.
 * - Stage-era fields are NOT in any view. getExpressEligibility was NOT
 *   extracted — it lives in v2-state.ts as dormant since express-path is
 *   retired in V3.
 * - Both V2State and V3State satisfy these views via structural typing.
 * - Function bodies are mechanical moves from v2-state.ts; behavior is
 *   identical to the pre-extraction implementation. The existing v2-state
 *   test coverage is the regression net per C2.1-DIRECTIVE §5.
 */

import type {
  V2Asset,
  V2StoryGroup,
  V2Defaults,
  V2Exception,
  V2CompletionSummary,
  StoryGroupKind,
  CommitOutcome,
} from './v2-types'
import { TRANSACTABLE_STATES } from './types'
import { isListablePrivacy } from '@/lib/asset/visibility'

// ── Narrow input view types ─────────────────────────────────────────

export interface AssetsView {
  assetsById: Record<string, V2Asset>
  assetOrder: string[]
}

export interface StoryGroupsView {
  storyGroupsById: Record<string, V2StoryGroup>
  storyGroupOrder: string[]
}

export interface DefaultsView {
  defaults: V2Defaults
}

// ── Basic Getters ──

export function getAssets(view: AssetsView): V2Asset[] {
  return view.assetOrder.map(id => view.assetsById[id]).filter(Boolean)
}

export function getIncludedAssets(view: AssetsView): V2Asset[] {
  return getAssets(view).filter(a => !a.excluded)
}

export function getAssignedAssets(view: AssetsView): V2Asset[] {
  return getIncludedAssets(view).filter(a => a.storyGroupId !== null)
}

export function getUnassignedAssets(view: AssetsView): V2Asset[] {
  return getIncludedAssets(view).filter(a => a.storyGroupId === null)
}

export function getAssetsForStoryGroup(view: AssetsView, storyGroupId: string): V2Asset[] {
  return getIncludedAssets(view).filter(a => a.storyGroupId === storyGroupId)
}

export function getStoryGroups(view: StoryGroupsView): V2StoryGroup[] {
  return view.storyGroupOrder.map(id => view.storyGroupsById[id]).filter(Boolean)
}

// ── Exception Computation ──

export function getAssetExceptions(asset: V2Asset): V2Exception[] {
  if (asset.excluded) return []

  const exceptions: V2Exception[] = []

  // Blocking: Story required for publish-ready completion
  if (!asset.storyGroupId) {
    exceptions.push({ type: 'needs_story', severity: 'blocking', label: 'Needs Story assignment' })
  }

  // Blocking: privacy required
  if (!asset.editable.privacy) {
    exceptions.push({ type: 'needs_privacy', severity: 'blocking', label: 'Needs privacy setting' })
  }

  // Blocking: manifest invalid
  if (asset.declarationState === 'manifest_invalid') {
    exceptions.push({ type: 'manifest_invalid', severity: 'blocking', label: 'Declaration invalid — cannot publish' })
  }

  // Blocking: unresolved metadata conflict
  if (asset.conflicts?.some(c => c.resolvedBy === null)) {
    exceptions.push({ type: 'unresolved_conflict', severity: 'blocking', label: 'Unresolved metadata conflict' })
  }

  // Blocking: price required for listable (PUBLIC or RESTRICTED) privacy.
  // Both states are transactable; PRIVATE is not.
  if (isListablePrivacy(asset.editable.privacy) && asset.editable.price === null) {
    exceptions.push({ type: 'needs_price', severity: 'blocking', label: 'Needs price' })
  }

  // Blocking: licences required for listable privacy.
  if (isListablePrivacy(asset.editable.privacy) && asset.editable.licences.length === 0) {
    exceptions.push({ type: 'needs_licences', severity: 'blocking', label: 'Needs licence selection' })
  }

  // Advisory: PRIVATE without price (non-blocking)
  if (asset.editable.privacy === 'PRIVATE' && asset.editable.price === null) {
    exceptions.push({ type: 'no_price_private', severity: 'advisory', label: 'No price set (private — can set later in Vault)' })
  }

  // Advisory: PRIVATE without licences (non-blocking)
  if (asset.editable.privacy === 'PRIVATE' && asset.editable.licences.length === 0) {
    exceptions.push({ type: 'no_licences_private', severity: 'advisory', label: 'No licences set (private — can set later in Vault)' })
  }

  // Advisory: duplicate
  if (asset.duplicateStatus === 'likely_duplicate') {
    exceptions.push({ type: 'duplicate_unresolved', severity: 'advisory', label: 'Possible duplicate' })
  }

  // Advisory: low confidence
  if (asset.proposal && asset.proposal.confidence < 0.5) {
    exceptions.push({ type: 'low_confidence', severity: 'advisory', label: 'Low metadata confidence — review recommended' })
  }

  // Advisory: provenance pending
  if (asset.declarationState === 'provenance_pending') {
    exceptions.push({ type: 'provenance_pending', severity: 'advisory', label: 'Provenance pending' })
  }

  return exceptions
}

export function getBlockingExceptions(view: AssetsView): Array<{ assetId: string; exceptions: V2Exception[] }> {
  return getIncludedAssets(view)
    .map(a => ({ assetId: a.id, exceptions: getAssetExceptions(a).filter(e => e.severity === 'blocking') }))
    .filter(r => r.exceptions.length > 0)
}

export function getAdvisoryExceptions(view: AssetsView): Array<{ assetId: string; exceptions: V2Exception[] }> {
  return getIncludedAssets(view)
    .map(a => ({ assetId: a.id, exceptions: getAssetExceptions(a).filter(e => e.severity === 'advisory') }))
    .filter(r => r.exceptions.length > 0)
}

// ── Publish Readiness ──

export interface PublishReadinessResult {
  ready: boolean
  blockerSummary: string[]
  readyCount: number
  blockedCount: number
  advisoryCount: number
  excludedCount: number
}

export function getPublishReadiness(view: AssetsView): PublishReadinessResult {
  const included = getIncludedAssets(view)
  let readyCount = 0
  let blockedCount = 0
  const blockerCounts: Record<string, number> = {}

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset)
    const blocking = exceptions.filter(e => e.severity === 'blocking')
    if (blocking.length > 0) {
      blockedCount++
      for (const b of blocking) {
        blockerCounts[b.type] = (blockerCounts[b.type] || 0) + 1
      }
    } else {
      readyCount++
    }
  }

  const advisoryCount = getAdvisoryExceptions(view).length
  const excludedCount = getAssets(view).filter(a => a.excluded).length

  // Generate human-readable blocker summary
  const blockerSummary: string[] = []
  if (blockerCounts['needs_story']) blockerSummary.push(`${blockerCounts['needs_story']} asset${blockerCounts['needs_story'] > 1 ? 's' : ''} need Story assignment`)
  if (blockerCounts['needs_privacy']) blockerSummary.push(`${blockerCounts['needs_privacy']} asset${blockerCounts['needs_privacy'] > 1 ? 's' : ''} need privacy setting`)
  if (blockerCounts['needs_price']) blockerSummary.push(`${blockerCounts['needs_price']} asset${blockerCounts['needs_price'] > 1 ? 's' : ''} need pricing`)
  if (blockerCounts['needs_licences']) blockerSummary.push(`${blockerCounts['needs_licences']} asset${blockerCounts['needs_licences'] > 1 ? 's' : ''} need licence selection`)
  if (blockerCounts['manifest_invalid']) blockerSummary.push(`${blockerCounts['manifest_invalid']} asset${blockerCounts['manifest_invalid'] > 1 ? 's have' : ' has'} invalid declaration`)
  if (blockerCounts['unresolved_conflict']) blockerSummary.push(`${blockerCounts['unresolved_conflict']} asset${blockerCounts['unresolved_conflict'] > 1 ? 's have' : ' has'} unresolved metadata conflicts`)

  return {
    ready: readyCount > 0,
    blockerSummary,
    readyCount,
    blockedCount,
    advisoryCount,
    excludedCount,
  }
}

// ── Story Coverage Summary ──

export interface StoryCoverageSummary {
  totalIncluded: number
  assigned: number
  unassigned: number
  groups: Array<{ id: string; name: string; kind: StoryGroupKind; assignedCount: number; proposedCount: number }>
}

export function getStoryCoverageSummary(view: AssetsView & StoryGroupsView): StoryCoverageSummary {
  const included = getIncludedAssets(view)
  const assigned = included.filter(a => a.storyGroupId !== null)
  const groups = getStoryGroups(view).map(g => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    assignedCount: included.filter(a => a.storyGroupId === g.id).length,
    proposedCount: g.proposedAssetIds.length,
  }))

  return {
    totalIncluded: included.length,
    assigned: assigned.length,
    unassigned: included.length - assigned.length,
    groups,
  }
}

// ── Total Listed Value ──

export function getTotalListedValue(view: AssetsView): number {
  return getIncludedAssets(view)
    .filter(a => isListablePrivacy(a.editable.privacy))
    .reduce((sum, a) => sum + (a.editable.price ?? 0), 0)
}

// ── Commit Outcome per Asset ──

export function getAssetCommitOutcome(asset: V2Asset): CommitOutcome {
  if (asset.excluded) return 'excluded'

  const exceptions = getAssetExceptions(asset)
  if (exceptions.some(e => e.severity === 'blocking')) return 'blocked'

  if (asset.editable.privacy === 'PRIVATE') return 'stored_not_transactable'

  const isTransactable = asset.declarationState && TRANSACTABLE_STATES.includes(asset.declarationState)

  if (asset.editable.privacy === 'RESTRICTED' && isTransactable) return 'transactable_via_link'
  if (asset.editable.privacy === 'PUBLIC' && isTransactable) return 'ready_for_discovery_and_transaction'

  return 'stored_not_transactable'
}

// ── Completion Summary ──

export function getCompletionSummary(view: AssetsView & StoryGroupsView): V2CompletionSummary {
  const assets = getAssets(view)
  const committed = assets.filter(a => a.committedAt !== null)
  const excluded = assets.filter(a => a.excluded)
  const blocked = assets.filter(a => !a.excluded && !a.committedAt)

  const storyMap = new Map<string, { name: string; assetCount: number; listedValue: number; isNew: boolean }>()
  for (const asset of committed) {
    if (!asset.storyGroupId) continue
    const group = view.storyGroupsById[asset.storyGroupId]
    if (!group) continue
    const existing = storyMap.get(group.id)
    const price = (asset.editable.privacy === 'PUBLIC' || asset.editable.privacy === 'RESTRICTED')
      ? (asset.editable.price ?? 0) : 0
    if (existing) {
      existing.assetCount++
      existing.listedValue += price
    } else {
      storyMap.set(group.id, {
        name: group.name,
        assetCount: 1,
        listedValue: price,
        isNew: group.kind !== 'matched-existing',
      })
    }
  }

  let stored = 0
  let transactableViaLink = 0
  let readyForDiscovery = 0
  for (const asset of committed) {
    const outcome = getAssetCommitOutcome(asset)
    if (outcome === 'stored_not_transactable') stored++
    if (outcome === 'transactable_via_link') transactableViaLink++
    if (outcome === 'ready_for_discovery_and_transaction') readyForDiscovery++
  }

  return {
    totalCommitted: committed.length,
    totalExcluded: excluded.length,
    totalBlocked: blocked.length,
    totalListedValue: committed
      .filter(a => a.editable.privacy === 'PUBLIC' || a.editable.privacy === 'RESTRICTED')
      .reduce((sum, a) => sum + (a.editable.price ?? 0), 0),
    stories: Array.from(storyMap.entries()).map(([id, data]) => ({
      id,
      ...data,
      vaultUrl: `/vault/stories/${id}`,
    })),
    outcomeBreakdown: { stored, transactableViaLink, readyForDiscovery },
  }
}

// ── Analysis Progress ──

export interface AnalysisProgressResult {
  total: number
  complete: number
  failed: number
  inProgress: number
  percent: number
}

export function getAnalysisProgress(view: AssetsView): AnalysisProgressResult {
  const assets = getAssets(view)
  const complete = assets.filter(a => a.analysisStatus === 'complete').length
  const failed = assets.filter(a => a.analysisStatus === 'failed').length
  const total = assets.length
  return {
    total,
    complete,
    failed,
    inProgress: total - complete - failed,
    percent: total > 0 ? Math.round((complete / total) * 100) : 0,
  }
}
