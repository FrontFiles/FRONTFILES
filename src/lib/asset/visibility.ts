// ═══════════════════════════════════════════════════════════════
// Frontfiles — Asset visibility predicates
//
// Tiny pure-function module that encodes "is this asset / story
// / collection visible to a public viewer" in exactly one place.
//
// Why this exists:
//
//   The same `a.privacy === 'PUBLIC' && a.publication === 'PUBLISHED'`
//   filter was repeated 6+ times across `ProfileContent`,
//   `FrontfolioContent`, `creator/[handle]/frontfolio/page.tsx`,
//   `VaultStatusPanel`, etc. Each copy is a chance for the rule
//   to drift. This module is the single owner.
//
//   It is NOT the security boundary — that lives in
//   `lib/entitlement/services.ts -> resolveDownloadAuthorization`
//   for original delivery, and in the database (RLS, eventually)
//   for query-time filters. This is the UI / list-filtering
//   helper layer.
//
// Conventions:
//
//   - Predicates are pure: `Foo => boolean`. No dependencies on
//     React, the user context, or the entitlement service.
//   - Predicates are narrowing-friendly so consumers can use
//     `arr.filter(isPublishedPublicAsset)` with full type
//     inference.
//   - `isListable*` predicates are the "creator can publish or
//     show this in their vault" rule — looser than public
//     (RESTRICTED counts) but stricter than "any state".
// ═══════════════════════════════════════════════════════════════

import type {
  Collection,
  PrivacyState,
  PublicationState,
  Story,
  VaultAsset,
} from '@/lib/types'

// ─── Asset predicates ────────────────────────────────────────

/**
 * The canonical "public, published vault asset" rule. Used by
 * every profile / frontfolio / search surface that lists a
 * creator's portfolio to non-creator viewers.
 */
export function isPublishedPublicAsset(asset: VaultAsset): boolean {
  return asset.privacy === 'PUBLIC' && asset.publication === 'PUBLISHED'
}

/**
 * "Listable" — public or restricted. Used by the upload v2
 * commit screen to count assets that will end up in the
 * licensable catalogue, vs purely PRIVATE ones.
 *
 * Accepts nullish privacy (e.g. a draft asset whose privacy is
 * not yet set) and treats it as "not listable". The `===`
 * comparisons below already handle null/undefined correctly.
 */
export function isListablePrivacy(privacy: PrivacyState | null | undefined): boolean {
  return privacy === 'PUBLIC' || privacy === 'RESTRICTED'
}

/**
 * Same predicate, structured around an editable upload state
 * shape so call sites can pass `asset.editable.privacy`
 * without unwrapping.
 */
export function isListableEditable(editable: { privacy: PrivacyState }): boolean {
  return isListablePrivacy(editable.privacy)
}

// ─── Story / Collection predicates ───────────────────────────

/** Same rule as `isPublishedPublicAsset`, applied to Story rows. */
export function isPublishedPublicStory(story: Story): boolean {
  return story.privacy === 'PUBLIC' && story.publication === 'PUBLISHED'
}

/**
 * Collections only carry `privacy` (no separate publication
 * state). Public collections are always listable.
 */
export function isPublicCollection(collection: Collection): boolean {
  return collection.privacy === 'PUBLIC'
}

// ─── Generic helpers ─────────────────────────────────────────

/**
 * True when an entity is in any non-public state. Useful for
 * the inverse question ("hide this from public surfaces").
 */
export function isNonPublic(privacy: PrivacyState): boolean {
  return privacy !== 'PUBLIC'
}

/**
 * True when an asset is BOTH published AND non-public — the
 * "soft-archive" state. Currently unused but exposed so the
 * vault status panel can stop computing the same thing inline.
 */
export function isPublishedNonPublic(asset: {
  privacy: PrivacyState
  publication: PublicationState
}): boolean {
  return asset.publication === 'PUBLISHED' && asset.privacy !== 'PUBLIC'
}
