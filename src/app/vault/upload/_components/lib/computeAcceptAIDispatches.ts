/**
 * Frontfiles Upload V4 — ✓ AI dispatch sequencer (D2.5 §6.4)
 *
 * Pure helper. Given the current state and the multi-selection, returns the
 * ordered list of dispatches that the ContextualActionBar's ✓ AI button
 * needs to execute.
 *
 * Sequence per spec UX-SPEC-V4 §9.4 + D2.5-DIRECTIVE §6.4:
 *   1. ONE BULK_ACCEPT_PROPOSALS_FOR_SELECTION for telemetry (no-op state-wise
 *      per IPI-1; ['caption', 'tags'] only — 'geography' isn't in the action's
 *      fields union, but the actual writes happen via UPDATE_ASSET_FIELD below).
 *   2. PER selected asset with a non-null proposal, sequenced UPDATE_ASSET_FIELD
 *      writes for caption (proposal.description) / tags / geography — only
 *      when the proposal value is non-null AND differs from the current
 *      editable value (don't overwrite manual edits with the same value).
 *
 * NEVER price (founder lock L6: AI auto-accept never touches price).
 *
 * Pure / deterministic / no React — hostable in Node test env.
 */

import type { V3State, V3Action } from '@/lib/upload/v3-types'

/**
 * Narrowed dispatch types this helper emits.
 *
 * Subtype of V3Action so the consumer can spread the result directly into
 * dispatch() without casting.
 */
export type AutoAcceptDispatch =
  | Extract<V3Action, { type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION' }>
  | Extract<V3Action, { type: 'UPDATE_ASSET_FIELD' }>

/**
 * Computes the ✓ AI dispatch sequence.
 *
 * Returns an empty array when no selected asset has a proposal — the caller
 * should disable the ✓ AI button in that case so the empty-array path is
 * defensive only.
 */
export function computeAcceptAIDispatches(
  state: V3State,
  selectedAssetIds: string[],
): AutoAcceptDispatch[] {
  const dispatches: AutoAcceptDispatch[] = []

  // Subset of selection that actually has a proposal.
  const idsWithProposal: string[] = []
  for (const id of selectedAssetIds) {
    const asset = state.assetsById[id]
    if (asset && asset.proposal) idsWithProposal.push(id)
  }
  if (idsWithProposal.length === 0) return dispatches

  // (1) Telemetry no-op — fields union excludes 'geography' so we list only
  //     caption + tags here. Real writes happen below via UPDATE_ASSET_FIELD.
  dispatches.push({
    type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION',
    assetIds: idsWithProposal,
    fields: ['caption', 'tags'],
  })

  // (2) Sequenced writes per asset. Caption maps proposal.description →
  //     editable.description ('description' is the schema name; 'caption' is
  //     the UX label). Tags + geography map 1:1.
  for (const id of idsWithProposal) {
    const asset = state.assetsById[id]
    if (!asset || !asset.proposal) continue
    const p = asset.proposal
    const e = asset.editable

    // Caption (proposal.description → editable.description)
    if (p.description != null && p.description !== e.description) {
      dispatches.push({
        type: 'UPDATE_ASSET_FIELD',
        assetId: id,
        field: 'description',
        value: p.description,
      })
    }

    // Tags — array; compare by JSON shape (length + ordered values).
    // Empty proposal.tags ([]) vs empty current ([]) is treated as no-change.
    if (p.tags != null && !arraysEqual(p.tags, e.tags)) {
      dispatches.push({
        type: 'UPDATE_ASSET_FIELD',
        assetId: id,
        field: 'tags',
        value: p.tags,
      })
    }

    // Geography — array, same equality treatment.
    if (p.geography != null && !arraysEqual(p.geography, e.geography)) {
      dispatches.push({
        type: 'UPDATE_ASSET_FIELD',
        assetId: id,
        field: 'geography',
        value: p.geography,
      })
    }
  }

  return dispatches
}

/** Shallow equality for primitive-element arrays (strings, numbers). */
function arraysEqual<T extends string | number>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
