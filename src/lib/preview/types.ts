/**
 * Frontfiles — Canonical Preview System Types
 *
 * Every card, preview, list item, search result, share preview, and compact
 * module converges toward this single type system.
 *
 * A preview may change density, orientation, visible metadata, and action
 * exposure, but it remains recognisably the same object family everywhere.
 */

// ══════════════════════════════════════════════
// PREVIEW FAMILY — what kind of object is this?
// ══════════════════════════════════════════════

export type PreviewFamily =
  | 'asset'
  | 'frontfiler'
  | 'story'
  | 'article'
  | 'collection'

// ══════════════════════════════════════════════
// PREVIEW VIEW — how is it being displayed?
// ══════════════════════════════════════════════

export type PreviewView =
  | 'grid'
  | 'list'
  | 'compact'
  | 'search'
  | 'related'
  | 'inline'
  | 'sidebar'
  | 'share'

// ══════════════════════════════════════════════
// PREVIEW SIZE — density tier
// ══════════════════════════════════════════════

export type PreviewSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// ══════════════════════════════════════════════
// PREVIEW STATE — interactive / display state
// ══════════════════════════════════════════════

export type PreviewState =
  | 'default'
  | 'hover'
  | 'focus'
  | 'selected'
  | 'loading'
  | 'saved'
  | 'liked'
  | 'missing'
  | 'unavailable'

// ══════════════════════════════════════════════
// FIELD VISIBILITY — information hierarchy
// ══════════════════════════════════════════════

/**
 * Controls which data fields appear:
 * - always:    forbidden to disappear
 * - primary:   shown by default at all sizes >= sm
 * - secondary: shown at md+, first to hide on smaller sizes
 * - tertiary:  shown at lg+
 * - optional:  shown only when contextually relevant
 * - overflow:  hidden unless expanded / hover
 * - hidden:    never shown in this configuration
 */
export type FieldVisibility =
  | 'always'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'optional'
  | 'overflow'
  | 'hidden'

// ══════════════════════════════════════════════
// FIELD VISIBILITY POLICY
// ══════════════════════════════════════════════

export interface FieldVisibilityPolicy {
  thumbnail: FieldVisibility     // media zone — forbidden to disappear
  title: FieldVisibility         // primary text
  creatorIdentity: FieldVisibility // avatar + name
  location: FieldVisibility
  date: FieldVisibility
  format: FieldVisibility
  price: FieldVisibility
  validation: FieldVisibility
  description: FieldVisibility
  assetCount: FieldVisibility
  wordCount: FieldVisibility
  actions: FieldVisibility
}

// ══════════════════════════════════════════════
// ACTION VISIBILITY
// ══════════════════════════════════════════════

export type ActionId = 'lightbox' | 'like' | 'comment' | 'share' | 'follow' | 'message' | 'preview' | 'overflow'

export type ActionVisibility = 'inline' | 'hover' | 'overflow' | 'hidden'

export interface ActionConfig {
  id: ActionId
  visibility: ActionVisibility
}

// ══════════════════════════════════════════════
// CROP STRATEGY
// ══════════════════════════════════════════════

/**
 * Priority order for cropping:
 * 1. focal — explicit editorial focal point
 * 2. face  — face-aware crop for people/headshots
 * 3. smart — subject-aware smart crop
 * 4. safe  — safe center crop (last-resort fallback)
 */
export type CropStrategy = 'focal' | 'face' | 'smart' | 'safe'

// ══════════════════════════════════════════════
// MEDIA CONFIG — resolved per family + size
// ══════════════════════════════════════════════

export interface MediaConfig {
  /** CSS aspect ratio class, e.g. 'aspect-video' or 'aspect-[4/3]' */
  aspectClass: string
  /** Numeric ratio for calculations (width/height) */
  aspectRatio: number
  /** Primary crop strategy */
  cropStrategy: CropStrategy
  /** CSS object-position fallback */
  objectPosition: string
  /** Whether to show format-specific rendering (video player, audio waveform, text excerpt) */
  formatRendering: boolean
}

// ══════════════════════════════════════════════
// RESOLVED PREVIEW CONFIG
// ══════════════════════════════════════════════

/**
 * The fully resolved configuration for a specific preview instance.
 * Computed from family + view + size by the policy layer.
 */
export interface PreviewConfig {
  family: PreviewFamily
  view: PreviewView
  size: PreviewSize
  fields: FieldVisibilityPolicy
  media: MediaConfig
  actions: ActionConfig[]
  /** Max characters for title before truncation */
  titleMaxChars: number
  /** Max lines for title (line-clamp) */
  titleMaxLines: number
  /** Max lines for description (line-clamp) */
  descriptionMaxLines: number
}
