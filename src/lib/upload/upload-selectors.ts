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
  V2Filter,
  V2FilterPreset,
  StoryGroupKind,
  CommitOutcome,
  AssetFormat,
  ExceptionType,
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

// ── D2.1 — Layout state + story cover (per UX-SPEC-V4 §2 + §7) ──

/**
 * Layout state for the V4 three-pane progressive disclosure shell.
 *
 * Three states (per UX-SPEC-V4 §2 + the external-review correction
 * captured in §2.0.1):
 *   'empty'      — no assets yet; UploadShellV4 renders EmptyState
 *   'workspace'  — assets present; three-pane shell with placeholders/content
 *   'comparing'  — Compare mode active (compareAssetIds.length === 2 per IPV4-3)
 *
 * Replaces the C2-era `densityForCount` selector. Returns a string union
 * (per IPD1-5 = a) — components derive pane visibility from selectedAssetIds /
 * leftRailCollapsed separately.
 */
export type V4LayoutState = 'empty' | 'workspace' | 'comparing'

export interface LayoutStateView extends AssetsView {
  compareAssetIds?: string[] // optional so V2 fixtures parse (no compare in V2)
}

export function getLayoutState(view: LayoutStateView): V4LayoutState {
  if ((view.compareAssetIds?.length ?? 0) === 2) return 'comparing'
  if (view.assetOrder.length === 0) return 'empty'
  return 'workspace'
}

/**
 * Effective cover for a Story. Returns the explicit coverAssetId asset if
 * set; otherwise falls back to the first asset in `sequence` (or
 * proposedAssetIds for legacy stories that lack sequence). Returns null if
 * the story has no assets at all OR the resolved id isn't in assetsById.
 *
 * Used by LeftRailStoryHeader thumbnail rendering and any other surface
 * that displays a story's representative image. Per UX-SPEC-V4 §7 + spec §7.3
 * cover-leaves-story behavior (IPV4-2 default = silent fallback).
 */
export function getStoryCover(
  group: V2StoryGroup,
  assetsById: Record<string, V2Asset>,
): V2Asset | null {
  const explicitId = group.coverAssetId
  if (explicitId) {
    const asset = assetsById[explicitId]
    if (asset) return asset
    // Cover asset has left the story (excluded / reassigned). Per IPV4-2 = a:
    // silent fallback to first in sequence. No prompt.
  }
  const fallbackList = group.sequence ?? group.proposedAssetIds
  for (const id of fallbackList) {
    const asset = assetsById[id]
    if (asset) return asset
  }
  return null
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
  /**
   * Per-blocker-type counts (e.g. `{ needs_price: 3, needs_privacy: 2 }`).
   * Used by getCommitBarSummaryText (per UX-SPEC-V3 §10.2) to distinguish
   * one-type / multiple-types / critical (>50%) cases. Added at C2.4 —
   * backwards-compatible (existing consumers ignore the new field).
   */
  blockerCounts: Partial<Record<ExceptionType, number>>
  /** readyCount + blockedCount. Excludes excluded assets. Added at C2.4. */
  includedCount: number
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
    blockerCounts: blockerCounts as Partial<Record<ExceptionType, number>>,
    includedCount: included.length,
  }
}

/**
 * V3 publish readiness — per UX-BRIEF v3 §4.5 + C2-PLAN §3.2 parity exception.
 *
 * Story groups are opt-in in V3, so `needs_story` is dropped from the
 * blocking math here. The chip render layer (Phase 7e) already filters
 * needs_story at the consumer; this selector finishes the alignment for
 * commit-bar CTA math + plain-language summary.
 *
 * Implementation: walks getIncludedAssets, filters needs_story out of
 * exceptions before the blocking check. Mirrors getPublishReadiness
 * otherwise.
 *
 * V2 path keeps the unmodified getPublishReadiness above (parity contract).
 */
export function getV3PublishReadiness(view: AssetsView): PublishReadinessResult {
  const included = getIncludedAssets(view)
  let readyCount = 0
  let blockedCount = 0
  const blockerCounts: Record<string, number> = {}

  for (const asset of included) {
    const exceptions = getAssetExceptions(asset).filter(e => e.type !== 'needs_story')
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

  const blockerSummary: string[] = []
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
    blockerCounts: blockerCounts as Partial<Record<ExceptionType, number>>,
    includedCount: included.length,
  }
}

/**
 * Commit-bar plain-language summary text per UX-SPEC-V3 §10.2.
 *
 * Mapping (in order of precedence):
 *   blockedCount === 0                  → ''                              (no text — just CTA)
 *   blockedCount > 50% of included      → 'Most assets need attention'    (critical override)
 *   single blocker type, count = 1      → '1 needs <label>'
 *   single blocker type, count > 1      → 'N need <label>'
 *   multiple blocker types              → '{blockedCount} issues to resolve'
 *
 * Note: blockedCount counts unique blocked ASSETS. Multiple blockers on
 * one asset still count as 1 blocked asset. Sum of blockerCounts values
 * may exceed blockedCount when assets have multiple blockers each — use
 * blockedCount in the multiple-types case to match §10.2's "5 issues to
 * resolve" wording where "issues" = blocked-asset count.
 */
export function getCommitBarSummaryText(readiness: PublishReadinessResult): string {
  const { blockedCount, includedCount, blockerCounts } = readiness

  if (blockedCount === 0) return ''

  // Critical: >50% of included assets are blocked
  if (includedCount > 0 && blockedCount / includedCount > 0.5) {
    return 'Most assets need attention'
  }

  const types = Object.keys(blockerCounts) as ExceptionType[]
  if (types.length === 1) {
    const type = types[0]
    const count = blockerCounts[type] ?? 0
    const label = COMMIT_BAR_BLOCKER_LABEL[type] ?? type
    const verb = count === 1 ? 'needs' : 'need'
    return `${count} ${verb} ${label}`
  }

  // Multiple types
  return `${blockedCount} issues to resolve`
}

/**
 * User-facing labels for blocker types in the commit-bar one-type
 * summary text. Verb conjugation ('needs' vs 'need') is applied by
 * getCommitBarSummaryText. Per spec §10.2 example: "1 needs price set" /
 * "3 need price set".
 */
const COMMIT_BAR_BLOCKER_LABEL: Partial<Record<ExceptionType, string>> = {
  needs_price: 'price set',
  needs_privacy: 'privacy set',
  needs_licences: 'licences set',
  manifest_invalid: 'a valid declaration',
  unresolved_conflict: 'metadata conflict resolved',
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

// ── Filtered / sorted / searched assets (NEW per C2.2-DIRECTIVE §3.9) ──
//
// Replaces the V2-coupled `getFilteredAssets` in v2-state.ts. Operates on a
// narrow view that includes filter/search/sort state from V3UIState (or its
// equivalent in V2). Both V2State and V3State satisfy this view via
// structural typing.
//
// Behavior parity with the dormant v2-state.ts version is enforced
// implicitly: the implementation mirrors the same filter presets, sort
// logic, and search semantics. Existing v2-state tests + the C2.1 parity
// test remain the regression net for the V2 path.

export type FilterableSortField =
  | 'filename'
  | 'format'
  | 'story'
  | 'privacy'
  | 'price'
  | 'status'
  | 'declaration'
  | 'issues'
  | 'title'
  | 'size'
  | 'captureDate'
  | 'confidence'
  | 'location'

export interface FilterableView extends AssetsView {
  filter: V2Filter
  searchQuery: string
  sortField: FilterableSortField
  sortDirection: 'asc' | 'desc'
}

export function getFilteredSortedSearchedAssets(view: FilterableView): V2Asset[] {
  let assets = getAssets(view)
  const { filter, searchQuery, sortField, sortDirection } = view

  // Search query filter (full-text on filename + title + tags + format)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    assets = assets.filter(
      a =>
        a.filename.toLowerCase().includes(q) ||
        a.editable.title.toLowerCase().includes(q) ||
        a.editable.tags.some(t => t.toLowerCase().includes(q)) ||
        (a.format && a.format.toLowerCase().includes(q)),
    )
  }

  // Filter preset (single value per V2Filter.preset; "exclusive" per IPII-2)
  switch (filter.preset) {
    case 'blocking':
      assets = assets.filter(
        a => !a.excluded && getAssetExceptions(a).some(e => e.severity === 'blocking'),
      )
      break
    case 'advisory':
      assets = assets.filter(
        a => !a.excluded && getAssetExceptions(a).some(e => e.severity === 'advisory'),
      )
      break
    case 'unassigned':
      assets = assets.filter(a => !a.excluded && a.storyGroupId === null)
      break
    case 'assigned':
      assets = assets.filter(a => !a.excluded && a.storyGroupId !== null)
      break
    case 'duplicates':
      assets = assets.filter(a => a.duplicateStatus !== 'none')
      break
    case 'excluded':
      assets = assets.filter(a => a.excluded)
      break
    case 'ready':
      assets = assets.filter(
        a =>
          !a.excluded &&
          a.analysisStatus === 'complete' &&
          getAssetExceptions(a).filter(e => e.severity === 'blocking').length === 0,
      )
      break
    case 'processing':
      assets = assets.filter(
        a =>
          a.analysisStatus === 'uploading' ||
          a.analysisStatus === 'analysing' ||
          a.analysisStatus === 'pending',
      )
      break
    case 'failed':
      assets = assets.filter(a => a.analysisStatus === 'failed')
      break
    case 'conflicts':
      assets = assets.filter(a => a.conflicts?.some(c => c.resolvedBy === null))
      break
    case 'missing-required':
      assets = assets.filter(
        a =>
          !a.excluded &&
          getAssetExceptions(a).some(
            e =>
              e.type === 'needs_story' ||
              e.type === 'needs_privacy' ||
              e.type === 'needs_price' ||
              e.type === 'needs_licences',
          ),
      )
      break
    case 'private-ready':
      assets = assets.filter(
        a =>
          !a.excluded &&
          a.editable.privacy === 'PRIVATE' &&
          getAssetExceptions(a).filter(e => e.severity === 'blocking').length === 0,
      )
      break
    case 'all':
    default:
      break
  }

  // Secondary filters
  if (filter.storyGroupId) {
    assets = assets.filter(a => a.storyGroupId === filter.storyGroupId)
  }
  if (filter.format) {
    assets = assets.filter(a => a.format === filter.format)
  }
  if (filter.privacy) {
    assets = assets.filter(a => a.editable.privacy === filter.privacy)
  }
  if (filter.declaration) {
    assets = assets.filter(a => a.declarationState === filter.declaration)
  }
  if (filter.hasConflicts === true) {
    assets = assets.filter(a => a.conflicts?.some(c => c.resolvedBy === null))
  }

  // Sort
  const dir = sortDirection === 'desc' ? -1 : 1
  const sorted = [...assets].sort((a, b) => {
    switch (sortField) {
      case 'filename':
        return dir * a.filename.localeCompare(b.filename)
      case 'title':
        return dir * a.editable.title.localeCompare(b.editable.title)
      case 'size':
        return dir * (a.fileSize - b.fileSize)
      case 'format':
        return dir * String(a.format ?? '').localeCompare(String(b.format ?? ''))
      case 'price':
        return dir * ((a.editable.price ?? 0) - (b.editable.price ?? 0))
      case 'privacy':
        return dir * String(a.editable.privacy ?? '').localeCompare(String(b.editable.privacy ?? ''))
      case 'status':
        return dir * a.analysisStatus.localeCompare(b.analysisStatus)
      case 'declaration':
        return dir * String(a.declarationState ?? '').localeCompare(String(b.declarationState ?? ''))
      case 'story':
        return dir * String(a.storyGroupId ?? '').localeCompare(String(b.storyGroupId ?? ''))
      case 'issues':
        return dir * (getAssetExceptions(a).length - getAssetExceptions(b).length)
      case 'captureDate':
        return dir * String(a.editable.captureDate ?? '').localeCompare(String(b.editable.captureDate ?? ''))
      case 'confidence':
        return dir * ((a.proposal?.confidence ?? 0) - (b.proposal?.confidence ?? 0))
      case 'location':
        return dir * (a.editable.geography[0] ?? '').localeCompare(b.editable.geography[0] ?? '')
      default:
        return 0
    }
  })

  return sorted
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
