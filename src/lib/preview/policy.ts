/**
 * Frontfiles — Canonical Preview Policy
 *
 * Single source of truth for deciding what data is shown, what metadata
 * is hidden, which actions are visible, and how size/view affect density.
 */

import type {
  PreviewFamily,
  PreviewView,
  PreviewSize,
  PreviewConfig,
  FieldVisibilityPolicy,
  ActionConfig,
  ActionId,
} from './types'
import { resolveMediaConfig } from './media'

// ══════════════════════════════════════════════
// FIELD VISIBILITY BY FAMILY
// ══════════════════════════════════════════════

const FIELD_DEFAULTS: Record<PreviewFamily, FieldVisibilityPolicy> = {
  asset: {
    thumbnail: 'always',
    title: 'primary',
    creatorIdentity: 'primary',
    location: 'secondary',
    date: 'tertiary',
    format: 'secondary',
    price: 'secondary',
    validation: 'secondary',
    description: 'overflow',
    assetCount: 'hidden',
    wordCount: 'optional',
    actions: 'primary',
  },
  story: {
    thumbnail: 'always',
    title: 'primary',
    creatorIdentity: 'primary',
    location: 'secondary',
    date: 'secondary',
    format: 'hidden',
    price: 'hidden',
    validation: 'hidden',
    description: 'secondary',
    assetCount: 'primary',
    wordCount: 'hidden',
    actions: 'primary',
  },
  article: {
    thumbnail: 'always',
    title: 'primary',
    creatorIdentity: 'primary',
    location: 'hidden',
    date: 'tertiary',
    format: 'hidden',
    price: 'hidden',
    validation: 'hidden',
    description: 'secondary',
    assetCount: 'secondary',
    wordCount: 'secondary',
    actions: 'primary',
  },
  frontfiler: {
    thumbnail: 'always',
    title: 'always',       // display name — always visible
    creatorIdentity: 'always',
    location: 'primary',
    date: 'hidden',
    format: 'hidden',
    price: 'hidden',
    validation: 'optional',
    description: 'secondary',
    assetCount: 'secondary',
    wordCount: 'hidden',
    actions: 'primary',
  },
  collection: {
    thumbnail: 'always',
    title: 'primary',
    creatorIdentity: 'secondary',
    location: 'hidden',
    date: 'tertiary',
    format: 'hidden',
    price: 'hidden',
    validation: 'hidden',
    description: 'overflow',
    assetCount: 'primary',
    wordCount: 'hidden',
    actions: 'secondary',
  },
}

// ══════════════════════════════════════════════
// SIZE OVERRIDES — what disappears at smaller sizes
// ══════════════════════════════════════════════

function applySize(fields: FieldVisibilityPolicy, size: PreviewSize): FieldVisibilityPolicy {
  const result = { ...fields }

  if (size === 'xs') {
    // Only always + primary survive at xs
    for (const key of Object.keys(result) as (keyof FieldVisibilityPolicy)[]) {
      if (result[key] !== 'always' && result[key] !== 'primary') {
        result[key] = 'hidden'
      }
    }
    result.actions = 'hidden'
    result.description = 'hidden'
  } else if (size === 'sm') {
    result.description = 'hidden'
    if (result.date === 'tertiary') result.date = 'hidden'
    if (result.wordCount === 'tertiary') result.wordCount = 'hidden'
  }

  return result
}

// ══════════════════════════════════════════════
// VIEW OVERRIDES
// ══════════════════════════════════════════════

function applyView(fields: FieldVisibilityPolicy, view: PreviewView): FieldVisibilityPolicy {
  const result = { ...fields }

  switch (view) {
    case 'compact':
    case 'inline':
      result.description = 'hidden'
      result.actions = 'overflow'
      if (result.date !== 'always') result.date = 'hidden'
      break
    case 'sidebar':
      result.description = 'hidden'
      result.actions = 'hidden'
      break
    case 'share':
      result.actions = 'hidden'
      result.price = 'hidden'
      break
    case 'list':
      // List view shows more metadata inline
      if (result.description === 'overflow') result.description = 'secondary'
      break
  }

  return result
}

// ══════════════════════════════════════════════
// ACTION VISIBILITY BY FAMILY
// ══════════════════════════════════════════════

/** Asset, story, and article share the same action set */
const CONTENT_ACTIONS: ActionConfig[] = [
  { id: 'lightbox', visibility: 'inline' },
  { id: 'like', visibility: 'inline' },
  { id: 'comment', visibility: 'inline' },
  { id: 'share', visibility: 'inline' },
]

const FRONTFILER_ACTIONS: ActionConfig[] = [
  { id: 'follow', visibility: 'inline' },
  { id: 'message', visibility: 'inline' },
  { id: 'share', visibility: 'inline' },
]

const COLLECTION_ACTIONS: ActionConfig[] = [
  { id: 'lightbox', visibility: 'inline' },
  { id: 'share', visibility: 'inline' },
]

const FAMILY_ACTIONS: Record<PreviewFamily, ActionConfig[]> = {
  asset: CONTENT_ACTIONS,
  story: CONTENT_ACTIONS,
  article: CONTENT_ACTIONS,
  frontfiler: FRONTFILER_ACTIONS,
  collection: COLLECTION_ACTIONS,
}

function resolveActions(
  family: PreviewFamily,
  view: PreviewView,
  size: PreviewSize,
): ActionConfig[] {
  const base = FAMILY_ACTIONS[family].map(a => ({ ...a }))

  // Compact/sidebar/xs: hide all or move to overflow
  if (size === 'xs' || view === 'sidebar') {
    return base.map(a => ({ ...a, visibility: 'hidden' as const }))
  }
  if (view === 'compact' || view === 'inline') {
    return base.map(a => ({ ...a, visibility: 'overflow' as const }))
  }
  if (view === 'share') {
    return base.map(a => ({ ...a, visibility: 'hidden' as const }))
  }

  return base
}

// ══════════════════════════════════════════════
// TITLE RULES BY SIZE
// ══════════════════════════════════════════════

const TITLE_RULES: Record<PreviewSize, { maxChars: number; maxLines: number; descLines: number }> = {
  xs: { maxChars: 40, maxLines: 1, descLines: 0 },
  sm: { maxChars: 60, maxLines: 2, descLines: 0 },
  md: { maxChars: 80, maxLines: 2, descLines: 2 },
  lg: { maxChars: 120, maxLines: 2, descLines: 3 },
  xl: { maxChars: 160, maxLines: 3, descLines: 4 },
}

// ══════════════════════════════════════════════
// MAIN RESOLVER
// ══════════════════════════════════════════════

/**
 * Resolves the full preview configuration for a given family + view + size.
 * This is the single entry point for all preview rendering decisions.
 */
export function resolvePreviewConfig(
  family: PreviewFamily,
  view: PreviewView,
  size: PreviewSize,
): PreviewConfig {
  const baseFields = FIELD_DEFAULTS[family]
  const sizedFields = applySize(baseFields, size)
  const viewedFields = applyView(sizedFields, view)
  const media = resolveMediaConfig(family, size)
  const actions = resolveActions(family, view, size)
  const titleRules = TITLE_RULES[size]

  return {
    family,
    view,
    size,
    fields: viewedFields,
    media,
    actions,
    titleMaxChars: titleRules.maxChars,
    titleMaxLines: titleRules.maxLines,
    descriptionMaxLines: titleRules.descLines,
  }
}

/**
 * Check if a field should be visible at a given visibility level.
 * Pass the current size to determine threshold.
 */
export function isFieldVisible(
  visibility: FieldVisibilityPolicy[keyof FieldVisibilityPolicy],
  size: PreviewSize,
): boolean {
  if (visibility === 'always' || visibility === 'primary') return true
  if (visibility === 'hidden') return false
  if (visibility === 'secondary') return size !== 'xs'
  if (visibility === 'tertiary') return size === 'lg' || size === 'xl'
  if (visibility === 'optional') return size === 'lg' || size === 'xl'
  if (visibility === 'overflow') return false // overflow is hover/expand only
  return false
}

/**
 * Returns the action IDs that should be rendered inline.
 */
export function getInlineActions(actions: ActionConfig[]): ActionId[] {
  return actions.filter(a => a.visibility === 'inline').map(a => a.id)
}

/**
 * Returns the action IDs that should appear on hover.
 */
export function getHoverActions(actions: ActionConfig[]): ActionId[] {
  return actions.filter(a => a.visibility === 'inline' || a.visibility === 'hover').map(a => a.id)
}
