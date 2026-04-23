// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Post Style Module
//
// The single source of truth for every class string used by the
// post/ components. Centralizes the composition of Tailwind
// utilities + the --post-* CSS custom properties declared in
// `src/app/globals.css`.
//
// Rules:
//   1. NO hardcoded hex, px, or slate values outside this file.
//      Every numeric / color value must resolve to a --post-*
//      token. If you find yourself typing `text-[15px]` or
//      `#0000ff` in a post component, add the token here instead.
//   2. The shadcn token layer is off-limits — do not mix
//      `bg-primary`, `text-muted-foreground`, `border-border`,
//      etc. with the --post-* layer. They serve different
//      domains (forms vs. editorial display).
//   3. Variant shapes are expressed as object keys (default /
//      compact), NOT as CVA config — the surface is small
//      enough that CVA would be ceremony without payoff.
//
// Matches the interim pixel-spec sheet 1:1.
// ═══════════════════════════════════════════════════════════════

// ─── Primitive class fragments ───────────────────────────────

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--post-focus-ring)] focus-visible:ring-offset-[var(--post-surface)]'

// ─── Outer card shell ────────────────────────────────────────

export const cardShell = [
  // structure
  'relative flex flex-col',
  'w-full max-w-[var(--post-card-max-w)] min-w-[var(--post-card-min-w)]',
  'p-[var(--post-card-padding)]',
  // chrome
  'bg-[var(--post-surface)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'rounded-[var(--post-card-radius)]',
  // hover state — spec: border darkens ~4% on hover
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-[var(--post-border-hover)]',
].join(' ')

// Top region of the card: author row + body + embed.
// Empty-body reduces this gap from 16px to 14px (spec).
export const cardTopRegion =
  'flex flex-col gap-[var(--post-section-gap)]'

export const cardTopRegionEmptyBody =
  'flex flex-col gap-[var(--post-body-to-embed-emptybody)]'

// Nested repost: spec sets body→nested to 14px (tighter than the
// normal 16px section gap). We express that by wrapping the
// outer stack in `gap: 14px` only for repost cards.
export const cardTopRegionRepost =
  'flex flex-col gap-[var(--post-body-to-nested)]'

// ─── Nested (compact) card shell ─────────────────────────────

export const nestedShell = [
  'flex flex-col',
  'w-full',
  'p-[var(--post-card-padding-compact)]',
  'gap-[var(--post-section-gap-compact)]',
  'bg-[var(--post-surface-nested)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'rounded-[var(--post-nested-radius)]',
].join(' ')

// ─── Repost label ────────────────────────────────────────────

export const repostLabelWrap =
  'flex items-center gap-1.5 mb-[var(--post-repost-label-gap)]'

export const repostLabelText =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

// ─── Author row ──────────────────────────────────────────────

export const authorRow = {
  default:
    'flex items-start gap-[var(--post-avatar-gap)] min-h-[var(--post-avatar)]',
  compact:
    'flex items-start gap-[var(--post-avatar-gap-compact)] min-h-[var(--post-avatar-compact)]',
}

export const authorAvatar = {
  default: [
    'shrink-0',
    'w-[var(--post-avatar)] h-[var(--post-avatar)]',
    'rounded-[var(--post-avatar-radius)]',
    'bg-[var(--post-surface-nested)]',
    'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
    'overflow-hidden flex items-center justify-center',
    FOCUS_RING,
  ].join(' '),
  compact: [
    'shrink-0',
    'w-[var(--post-avatar-compact)] h-[var(--post-avatar-compact)]',
    'rounded-[var(--post-avatar-radius)]',
    'bg-[var(--post-surface-nested)]',
    'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
    'overflow-hidden flex items-center justify-center',
    FOCUS_RING,
  ].join(' '),
}

export const authorAvatarFallback = {
  default: 'post-type-meta text-[var(--post-text-meta)] uppercase',
  compact: 'post-type-meta-compact text-[var(--post-text-meta)] uppercase',
}

export const authorNameCol =
  'min-w-0 flex-1 flex flex-col gap-[var(--post-name-title-gap)]'

export const authorNameRow =
  'flex items-center gap-[var(--post-name-badge-gap)] min-w-0'

export const authorName = {
  default: [
    'post-type-author-name',
    'text-[var(--post-text-primary)]',
    'truncate',
    'hover:text-[var(--post-accent)] transition-colors',
    FOCUS_RING,
  ].join(' '),
  compact: [
    'post-type-author-name-compact',
    'text-[var(--post-text-primary)]',
    'truncate',
    'hover:text-[var(--post-accent)] transition-colors',
    FOCUS_RING,
  ].join(' '),
}

export const authorTitle = {
  default:
    'post-type-title text-[var(--post-text-secondary)] truncate',
  compact:
    'post-type-title-compact text-[var(--post-text-secondary)] truncate',
}

export const authorTrustBadge = {
  default: 'w-[var(--post-trust-badge)] h-[var(--post-trust-badge)] shrink-0 text-[var(--post-accent)]',
  compact: 'w-[var(--post-trust-badge-compact)] h-[var(--post-trust-badge-compact)] shrink-0 text-[var(--post-accent)]',
}

export const authorTimestamp = {
  default: 'shrink-0 text-right flex flex-col items-end',
  compact: 'shrink-0 text-right flex flex-col items-end',
}

export const authorTimestampDate = {
  default: 'post-type-meta text-[var(--post-text-meta)] uppercase',
  compact: 'post-type-meta-compact text-[var(--post-text-meta)] uppercase',
}

export const authorTimestampTime =
  'post-type-meta text-[var(--post-text-disabled)] uppercase mt-0.5'

// ─── Body ────────────────────────────────────────────────────

export const postBody = [
  'post-type-body',
  'text-[var(--post-text-primary)]',
  'max-w-[var(--post-body-max-w)]',
  'whitespace-pre-wrap',
  // Paragraph spacing via margin-top on paragraphs 2+.
  '[&>p+p]:mt-[var(--post-body-paragraph-gap)]',
].join(' ')

export const postBodyCompact = [
  'post-type-body-compact',
  'text-[var(--post-text-primary)]',
  'line-clamp-3 whitespace-pre-wrap',
].join(' ')

// ─── Attachment embed ────────────────────────────────────────

export const embedShell = {
  default: [
    'group/embed block',
    'bg-[var(--post-surface)]',
    'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
    'rounded-[var(--post-embed-radius)]',
    'p-[var(--post-embed-pad)]',
    'min-h-[var(--post-embed-min-h)]',
    'transition-colors',
    'hover:border-[var(--post-border-hover)]',
    FOCUS_RING,
  ].join(' '),
  compact: [
    'group/embed block',
    'bg-[var(--post-surface)]',
    'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
    'rounded-[var(--post-embed-radius)]',
    'p-[var(--post-embed-pad-compact)]',
    'min-h-[var(--post-embed-min-h-compact)]',
    'transition-colors',
    'hover:border-[var(--post-border-hover)]',
    FOCUS_RING,
  ].join(' '),
}

export const embedRow =
  'flex items-stretch gap-[var(--post-thumb-text-gap)]'

export const embedThumb = {
  default: [
    'shrink-0',
    'w-[var(--post-embed-thumb)] h-[var(--post-embed-thumb)]',
    'rounded-[var(--post-thumb-radius)]',
    'bg-[var(--post-surface-nested)] overflow-hidden relative',
  ].join(' '),
  compact: [
    'shrink-0',
    'w-[var(--post-embed-thumb-compact)] h-[var(--post-embed-thumb-compact)]',
    'rounded-[var(--post-thumb-radius-compact)]',
    'bg-[var(--post-surface-nested)] overflow-hidden relative',
  ].join(' '),
}

export const embedThumbMosaic = {
  default: [
    'shrink-0',
    'w-[var(--post-embed-thumb)] h-[var(--post-embed-thumb)]',
    'rounded-[var(--post-thumb-radius)] overflow-hidden',
    'grid grid-cols-2 grid-rows-2 gap-px bg-[var(--post-border)]',
  ].join(' '),
  compact: [
    'shrink-0',
    'w-[var(--post-embed-thumb-compact)] h-[var(--post-embed-thumb-compact)]',
    'rounded-[var(--post-thumb-radius-compact)] overflow-hidden',
    'grid grid-cols-2 grid-rows-2 gap-px bg-[var(--post-border)]',
  ].join(' '),
}

export const embedText =
  'min-w-0 flex-1 flex flex-col gap-[var(--post-embed-title-meta-gap)] py-0.5'

export const embedTitle =
  'post-type-embed-title text-[var(--post-text-primary)] line-clamp-2'

export const embedTitleCompact =
  'post-type-embed-title text-[var(--post-text-primary)] line-clamp-2'

export const embedMeta =
  'post-type-embed-meta text-[var(--post-text-secondary)] line-clamp-2'

export const embedMetaFaint =
  'post-type-embed-meta text-[var(--post-text-meta)]'

// Format pill sitting on the thumb corner.
export const embedFormatPill =
  'absolute top-1.5 left-1.5 post-type-meta text-[var(--post-text-meta)] bg-[var(--post-surface)]/85 backdrop-blur-sm px-1 py-0.5 uppercase'

// Attribution chip (pill) shown at the bottom of the embed.
export const attributionChip = {
  default: [
    'inline-flex items-center gap-1.5',
    'h-[var(--post-chip-h)] px-[var(--post-chip-px)]',
    'rounded-[var(--post-chip-radius)]',
    'bg-[var(--post-accent-tint)]',
    'post-type-chip text-[var(--post-accent)]',
    'transition-colors',
    'hover:bg-[var(--post-accent-tint-hover)]',
    FOCUS_RING,
  ].join(' '),
  compact: [
    'inline-flex items-center gap-1.5',
    'h-[var(--post-chip-h-compact)] px-[var(--post-chip-px-compact)]',
    'rounded-[var(--post-chip-radius)]',
    'bg-[var(--post-accent-tint)]',
    'post-type-chip text-[var(--post-accent)]',
    'transition-colors',
    'hover:bg-[var(--post-accent-tint-hover)]',
    FOCUS_RING,
  ].join(' '),
}

export const attributionChipMargin = 'mt-[var(--post-attribution-chip-margin)]'

export const attributionChipBadge =
  'w-[10px] h-[10px] shrink-0 text-[var(--post-accent)]'

// ─── Action bar ──────────────────────────────────────────────

export const actionBarShell = [
  'flex items-stretch',
  'mt-[var(--post-divider-top-margin)]',
  'pt-[var(--post-actions-top-padding)]',
  'border-t border-[length:var(--post-border-width)] border-[var(--post-divider)]',
  // Wraps on very narrow screens per spec (action bar may wrap to 2 rows below 480px).
  'flex-wrap min-[480px]:flex-nowrap',
].join(' ')

export const actionButton = [
  'flex-1 min-w-[80px]',
  'h-[var(--post-action-row-h)]',
  'inline-flex items-center justify-center',
  'gap-[var(--post-icon-label-gap)]',
  'post-type-action-label',
  'text-[var(--post-text-disabled)]',
  // Disabled state — no hover, no pointer events (spec).
  'cursor-not-allowed select-none',
  'disabled:cursor-not-allowed',
].join(' ')

export const actionIcon =
  'w-[var(--post-action-icon)] h-[var(--post-action-icon)] shrink-0'

export const actionCount =
  'font-mono text-[var(--post-text-disabled)]'

// ─── View-post permalink chip ────────────────────────────────

export const viewPostChipWrap =
  'flex justify-end mt-[var(--post-viewpost-chip-margin)]'

export const viewPostChip = {
  default: [
    'inline-flex items-center gap-1',
    'h-[var(--post-chip-h)] px-[var(--post-chip-px)]',
    'rounded-[var(--post-chip-radius)]',
    'bg-[var(--post-accent-tint)]',
    'post-type-chip text-[var(--post-accent)]',
    'transition-colors',
    'hover:bg-[var(--post-accent-tint-hover)] hover:text-[var(--post-accent-hover)]',
    FOCUS_RING,
  ].join(' '),
  compact: [
    'inline-flex items-center gap-1',
    'h-[var(--post-chip-h-compact)] px-[var(--post-chip-px-compact)]',
    'rounded-[var(--post-chip-radius)]',
    'bg-[var(--post-accent-tint)]',
    'post-type-chip text-[var(--post-accent)]',
    'transition-colors',
    'hover:bg-[var(--post-accent-tint-hover)] hover:text-[var(--post-accent-hover)]',
    FOCUS_RING,
  ].join(' '),
}

// ─── Removed-quote placeholder ───────────────────────────────

export const removedQuote = [
  'flex items-center gap-3',
  'px-4 py-4',
  'border border-dashed border-[var(--post-border)]',
  'bg-[var(--post-surface-nested)]',
  'rounded-[var(--post-nested-radius)]',
].join(' ')

export const removedQuoteIcon =
  'w-4 h-4 shrink-0 text-[var(--post-text-meta)]'

export const removedQuoteText =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

// ─── Unavailable (hydration-failed) card ─────────────────────

export const unavailableCard = [
  'flex flex-col gap-2',
  'w-full max-w-[var(--post-card-max-w)]',
  'p-[var(--post-card-padding)]',
  'bg-[var(--post-surface)]',
  'border border-dashed border-[var(--post-border)]',
  'rounded-[var(--post-card-radius)]',
].join(' ')

export const unavailableTitle =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

export const unavailableBody =
  'post-type-body-compact text-[var(--post-text-secondary)]'

export const unavailableId =
  'font-mono post-type-meta-compact text-[var(--post-text-disabled)]'

// ─── PostsContent header / tabs / empty state ────────────────

export const feedHeader =
  'flex items-center justify-between border-b border-[var(--post-divider)] pb-3'

export const feedHeaderLabel =
  'flex items-center gap-3 post-type-meta text-[var(--post-text-meta)] uppercase'

export const feedHeaderCount =
  'font-mono text-[var(--post-text-disabled)]'

export const feedBackLink =
  'post-type-meta text-[var(--post-text-meta)] uppercase hover:text-[var(--post-accent)] transition-colors'

export const tabBar =
  'flex items-center justify-between border-b border-[var(--post-divider)]'

export const tabBarInner = 'flex'

export const tabButton = (active: boolean) =>
  [
    'px-4 py-2.5',
    'post-type-action-label uppercase',
    'flex items-center gap-2',
    'transition-colors',
    active
      ? 'border-b-2 border-[var(--post-accent)] text-[var(--post-text-primary)]'
      : 'text-[var(--post-text-meta)] hover:text-[var(--post-text-primary)]',
  ].join(' ')

export const tabButtonCount = 'font-mono post-type-meta text-[var(--post-text-disabled)]'

export const feedList = 'flex flex-col gap-4'

export const emptyStateShell = [
  'flex flex-col items-center gap-3',
  'w-full max-w-[var(--post-card-max-w)]',
  'px-8 py-12',
  'bg-[var(--post-surface)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'rounded-[var(--post-card-radius)]',
].join(' ')

export const emptyStateLabel =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

export const emptyStateHeadline =
  'post-type-empty text-[var(--post-text-secondary)] text-center max-w-md'

export const emptyStateHelper =
  'post-type-empty text-[var(--post-text-meta)] text-center max-w-md'

// ─── Global feed shell ───────────────────────────────────────
//
// The /feed page composes a 3-column desktop layout. None of
// these classes contain hardcoded colors — they all resolve
// through the existing --post-* tokens or Tailwind neutrals
// already used by the rest of the platform chrome.

export const feedShell =
  'flex-1 min-h-0 flex flex-col bg-[var(--post-surface)]'

export const feedColumns =
  'flex flex-1 overflow-hidden'

export const feedLeftRail = [
  'hidden lg:flex flex-col',
  'w-64 shrink-0',
  'border-r border-[var(--post-divider)]',
  'bg-[var(--post-surface)]',
  'overflow-y-auto',
].join(' ')

export const feedMainColumn =
  'flex-1 min-w-0 overflow-y-auto'

export const feedMainInner = [
  'mx-auto',
  'w-full max-w-[var(--post-card-max-w)]',
  'px-4 sm:px-6 lg:px-8 py-6',
  'flex flex-col gap-5',
].join(' ')

export const feedRightRail = [
  'hidden xl:flex flex-col',
  'w-80 shrink-0',
  'border-l border-[var(--post-divider)]',
  'bg-[var(--post-surface)]',
  'overflow-y-auto',
].join(' ')

// ─── Composer entry card ─────────────────────────────────────

export const composerEntryShell = [
  'w-full max-w-[var(--post-card-max-w)]',
  'p-4',
  'bg-[var(--post-surface)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'rounded-[var(--post-card-radius)]',
  'flex items-center gap-3',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-[var(--post-border-hover)]',
].join(' ')

export const composerEntryAvatar = [
  'shrink-0',
  'w-10 h-10',
  'rounded-[var(--post-avatar-radius)]',
  'bg-[var(--post-surface-nested)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'overflow-hidden',
  'flex items-center justify-center',
].join(' ')

export const composerEntryButton = [
  'flex-1 min-w-0 text-left',
  'h-10 px-3',
  'rounded-[var(--post-chip-radius)]',
  'bg-[var(--post-surface-nested)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'post-type-body-compact text-[var(--post-text-meta)]',
  'truncate',
  'transition-colors',
  'hover:bg-[var(--post-accent-tint)] hover:border-[var(--post-accent)] hover:text-[var(--post-accent)]',
].join(' ')

export const composerEntryAction = [
  'shrink-0',
  'h-10 px-4',
  'rounded-[var(--post-chip-radius)]',
  'bg-[var(--post-accent)]',
  'text-white post-type-action-label uppercase',
  'transition-colors',
  'hover:bg-[var(--post-accent-hover)]',
].join(' ')

// ─── Rail sections (left + right rails) ──────────────────────

export const railSection =
  'flex flex-col gap-2 px-5 py-5 border-b border-[var(--post-divider)]'

export const railSectionLabel =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

export const railNavList = 'flex flex-col gap-0.5'

export const railNavItem = (active: boolean) =>
  [
    'flex items-center gap-2 px-2 h-9 -mx-2',
    'rounded-[var(--post-chip-radius)]',
    'post-type-action-label',
    'transition-colors',
    active
      ? 'bg-[var(--post-accent-tint)] text-[var(--post-accent)]'
      : 'text-[var(--post-text-secondary)] hover:bg-[var(--post-surface-nested)] hover:text-[var(--post-text-primary)]',
  ].join(' ')

export const railNavIcon = 'w-4 h-4 shrink-0'

// ─── Discovery rail item (right side suggestions) ────────────

export const discoveryItem =
  'flex items-start gap-3 group cursor-pointer'

export const discoveryAvatar = [
  'shrink-0',
  'w-10 h-10',
  'rounded-[var(--post-avatar-radius)]',
  'bg-[var(--post-surface-nested)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'overflow-hidden',
  'flex items-center justify-center',
].join(' ')

export const discoveryName =
  'post-type-author-name-compact text-[var(--post-text-primary)] group-hover:text-[var(--post-accent)] transition-colors truncate'

export const discoveryTitle =
  'post-type-title-compact text-[var(--post-text-secondary)] truncate'

export const discoveryFollowChip = [
  'mt-2 inline-flex items-center justify-center',
  'h-7 px-3',
  'rounded-[var(--post-chip-radius)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'post-type-chip text-[var(--post-text-secondary)]',
  'transition-colors',
  'hover:border-[var(--post-accent)] hover:text-[var(--post-accent)]',
].join(' ')

// ─── Trust signal block ──────────────────────────────────────

export const signalRow =
  'flex items-baseline justify-between gap-3'

export const signalLabel =
  'post-type-meta text-[var(--post-text-meta)] uppercase'

export const signalValue =
  'font-mono post-type-author-name-compact text-[var(--post-text-primary)]'

// ─── Optional metadata strip (chips below the embed) ─────────

export const metaStrip =
  'flex flex-wrap items-center gap-1.5 mt-[var(--post-attribution-chip-margin)]'

export const metaChip = [
  'inline-flex items-center gap-1',
  'h-[var(--post-chip-h)] px-[var(--post-chip-px)]',
  'rounded-[var(--post-chip-radius)]',
  'bg-[var(--post-surface-nested)]',
  'border border-[length:var(--post-border-width)] border-[var(--post-border)]',
  'post-type-chip text-[var(--post-text-secondary)]',
].join(' ')
