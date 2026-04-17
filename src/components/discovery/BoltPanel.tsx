'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type {
  BoltCandidate,
  BoltCluster,
  BoltFact,
  BoltSectionId,
  BoltSectionState,
  BoltSource,
  BoltSuggestion,
} from '@/lib/bolt/types'
import { BOLT_SECTION_LABELS, BOLT_SECTION_ORDER } from '@/lib/bolt/types'
import type {
  BoltPanelState,
  BoltPreviewActivation,
} from '@/hooks/useBoltSession'

// ============================================================
// List-detail activation model.
//
// Three independent stored fields live on the parent hook
// (useBoltSession): selectedResultId, hoveredResultId,
// focusedResultId. One derived field, activeResultId, is the
// single source of truth for the preview surface. This component
// only reads that derived value and fans setter calls back up.
//
// Precedence: hover > focus > selected > null.
// ============================================================

interface RowHandlers {
  selectedId: string | null
  activeId: string | null
  onHoverEnter: (id: string) => void
  onHoverLeave: () => void
  onFocus: (id: string) => void
  onBlur: () => void
  onSelect: (id: string) => void
}

// ============================================================
// Preview rendering strategy.
//
// Declared explicitly so the architecture expresses the ordered
// fallback hierarchy the product requires:
//
//   1. 'rendered'      — a repo-native rendered surface (e.g. a
//                        Frontfiles article preview). Reserved for
//                        future sources that point at internal
//                        Frontfiles content. Never used in Phase 1.
//   2. 'iframe-safe'   — destinations explicitly whitelisted as
//                        X-Frame-Options-compatible and safe to
//                        embed. None in Phase 1.
//   3. 'fallback-card' — canonical Phase 1 path for every external
//                        publisher source. Renders a source dossier
//                        card. Never fetches the page, never iframes
//                        it. This is not an error state; it is the
//                        intended strategy for third-party URLs.
// ============================================================

type BoltPreviewStrategy =
  | { kind: 'rendered'; surface: 'article-detail'; articleId: string }
  | { kind: 'iframe-safe'; url: string }
  | { kind: 'fallback-card' }

function resolvePreviewStrategy(_source: BoltSource): BoltPreviewStrategy {
  // Phase 1: every BOLT source is an external publisher URL. We do not
  // fetch, scrape, or iframe third-party pages. The fallback card is the
  // canonical strategy. When internal Frontfiles article sources appear
  // in a future phase, add a branch here that returns 'rendered' and the
  // BoltPreviewGrid will render the repo-native surface.
  return { kind: 'fallback-card' }
}

/** Default outer wrapper className — Discovery's fixed-width side panel.
 *  Callers (e.g. Composer) can override via `outerClassName` to make the
 *  panel fill its parent (`flex-1 min-w-0 ...`) instead of sitting at a
 *  fixed 480px. */
const DEFAULT_OUTER_CLASSNAME =
  'w-[480px] shrink-0 border-l border-black/15 bg-white flex flex-col h-full overflow-hidden'

export interface BoltPanelProps {
  state: BoltPanelState
  /** Parent-owned preview activation state (selected/hover/focus + derived active). */
  preview: BoltPreviewActivation
  onClose: () => void
  onRetry: () => void
  onRequestScope: () => void
  openButtonRef: React.RefObject<HTMLButtonElement | null>
  /** Optional override for the outer `<aside>` className. Use this when
   *  BoltPanel needs to fill its parent instead of its default 480px
   *  fixed width (e.g. Composer's SearchRail column when BOLT is the
   *  sole active surface). If omitted, falls back to Discovery's fixed
   *  side-panel shape. */
  outerClassName?: string
}

export function BoltPanel({
  state,
  preview,
  onClose,
  onRetry,
  onRequestScope,
  openButtonRef,
  outerClassName,
}: BoltPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Move focus into the panel on open.
  useEffect(() => {
    if (state.status !== 'closed') {
      closeRef.current?.focus()
    }
  }, [state.status])

  // Escape closes and returns focus to the opener.
  useEffect(() => {
    if (state.status === 'closed') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        openButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.status, onClose, openButtonRef])

  if (state.status === 'closed') return null

  const scopeChipLabel =
    state.status === 'loading'
      ? state.scopeSummary
      : state.status === 'ready' || state.status === 'partial'
        ? state.briefing.scopeSummary
        : null

  return (
    <aside
      role="complementary"
      aria-label="Context Source briefing panel"
      className={outerClassName ?? DEFAULT_OUTER_CLASSNAME}
    >
      {/* -- Header — compact single row -------------------------------- */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-black/8">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#0000ff] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-[11px] font-black text-[#0000ff] italic tracking-tight">Context Source</span>
          <span className="text-[8px] font-semibold uppercase tracking-widest text-black/30 ml-1">External sources</span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={() => { onClose(); openButtonRef.current?.focus() }}
          className="w-5 h-5 flex items-center justify-center text-black/30 hover:text-black transition-colors"
          aria-label="Close Context Source"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* -- Body ------------------------------------------------------- */}
      {/*
        For ready/partial states, SectionsBody owns its own internal scroll
        because the preview grid must stay pinned above the scrolling sections.
        The other states scroll normally here.
      */}
      <div className="flex-1 min-h-0 flex flex-col">
        {state.status === 'no_scope' && (
          <div className="flex-1 overflow-y-auto">
            <NoScopeBody onRequestScope={onRequestScope} />
          </div>
        )}
        {state.status === 'loading' && (
          <div className="flex-1 overflow-y-auto">
            <LoadingBody />
          </div>
        )}
        {(state.status === 'ready' || state.status === 'partial') && (
          <SectionsBody sections={state.briefing.sections} preview={preview} scopeLabel={scopeChipLabel} />
        )}
        {state.status === 'error' && (
          <div className="flex-1 overflow-y-auto">
            <ErrorBody
              message={state.message}
              canRetry={state.canRetry}
              onRetry={onRetry}
            />
          </div>
        )}
      </div>

      {/* -- Transparency footer --------------------------------------- */}
      {(state.status === 'ready' || state.status === 'partial') && (
        <div className="shrink-0 border-t border-black/10 px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-black/50 flex items-center justify-between">
          <span>
            Searched {state.briefing.transparency.connectorsAttempted.length}{' '}
            connectors · Tiers{' '}
            {state.briefing.transparency.tiersSearched.join(', ')}
          </span>
          {state.briefing.mode === 'fixture' && (
            <span className="text-[#0000ff]">DEV FIXTURES</span>
          )}
        </div>
      )}
    </aside>
  )
}

// ---- Preview grid ----------------------------------------------------------

/**
 * The list-detail preview surface. Sits pinned above the scrollable
 * sections and reacts to hover / focus / selection on sourceable rows.
 *
 * Rendering strategy is resolved per-source (see resolvePreviewStrategy):
 *   - 'rendered'      → BoltPreviewRenderedSurface (reserved, Phase 2+)
 *   - 'iframe-safe'   → BoltPreviewSafeEmbed (reserved, Phase 2+)
 *   - 'fallback-card' → BoltPreviewFallbackCard (canonical Phase 1 path)
 *
 * No animations on content swap. Only transition-colors on borders
 * and backgrounds, which is exempt under prefers-reduced-motion.
 */
function BoltPreviewGrid({ source }: { source: BoltSource | null }) {
  return (
    <aside
      role="region"
      aria-label="Context Source preview"
      aria-live="polite"
      className="shrink-0 border-b border-black/10 bg-white min-h-[180px] px-5 py-3 flex flex-col"
    >
      {source ? (
        <BoltPreviewContent source={source} />
      ) : (
        <BoltPreviewPlaceholder />
      )}
    </aside>
  )
}

function BoltPreviewPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 max-w-[280px] leading-relaxed">
        Hover, tab, or select a result to inspect its destination.
      </p>
    </div>
  )
}

/**
 * Resolves the right rendering path for the active source.
 * Phase 1: always falls through to BoltPreviewFallbackCard.
 * Future phases simply add branches; row components are unaffected.
 */
function BoltPreviewContent({ source }: { source: BoltSource }) {
  const domain = domainFromUrl(source.url) ?? source.publisher.toLowerCase()
  const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(source.url)}?w=440`
  const [imgReady, setImgReady] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  // Load screenshot in background. mShots returns a placeholder on first
  // request, then the real screenshot on subsequent requests. We poll
  // twice: once immediately and once after 3s to catch the real image.
  useEffect(() => {
    setImgReady(false)
    setImgSrc(null)
    let cancelled = false

    function tryLoad() {
      const img = new Image()
      img.onload = () => {
        // mShots placeholder is 400x300 grey. Real screenshots are larger.
        if (!cancelled && img.naturalWidth > 400) {
          setImgSrc(screenshotUrl)
          setImgReady(true)
        }
      }
      // Cache-bust for the retry so we get the fresh render
      img.src = screenshotUrl + '&_t=' + Date.now()
    }

    tryLoad()
    const timer = setTimeout(tryLoad, 3500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [screenshotUrl])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <TierBadge tier={source.tier} />
          <span className="text-[8px] font-bold uppercase tracking-widest text-black/40 truncate max-w-[180px]">
            {domain}
          </span>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#0000cc] shrink-0"
        >
          Open &rarr;
        </a>
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block flex-1 min-h-0 border border-black/8 bg-slate-50 overflow-hidden relative group"
      >
        {/* Screenshot — only shown once loaded and validated */}
        {imgReady && imgSrc && (
          <img
            src={imgSrc}
            alt={`Preview of ${source.title}`}
            className="w-full h-full object-cover object-top"
          />
        )}

        {/* Loading state — shown while screenshot is being captured */}
        {!imgReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-5 h-5 border border-[#0000ff]/30 border-t-[#0000ff] rounded-full animate-spin mx-auto mb-2" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-black/25">Loading preview</span>
            </div>
          </div>
        )}

        {/* Gradient overlay with title — always visible */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
          <h3 className="text-[12px] font-black text-white leading-snug line-clamp-2">
            {source.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/60">
            <span className="font-bold text-white/80">{source.publisher}</span>
            {source.publishedAt && <span>{fmtDate(source.publishedAt)}</span>}
            {source.accessState === 'paywall' && <span className="text-yellow-300">Paywall</span>}
          </div>
        </div>
      </a>
    </div>
  )
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ---- State bodies ----------------------------------------------------------

function NoScopeBody({ onRequestScope }: { onRequestScope: () => void }) {
  return (
    <div className="px-5 py-6">
      <div className="text-[18px] font-black text-black leading-tight">
        Context Source needs a scope from Discovery.
      </div>
      <p className="text-[11px] text-black/70 leading-relaxed mt-3">
        Context Source does not search on its own. Use the Discovery search bar to enter a
        query, apply filters, or open a creator, company, or location. Then open
        Context Source to run the same scope against external sources.
      </p>
      <button
        type="button"
        onClick={onRequestScope}
        className="mt-5 w-full h-10 bg-[#0000ff] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#0000cc] transition-colors"
      >
        Open Discovery search
      </button>
    </div>
  )
}

function LoadingBody() {
  return (
    <div className="px-5 py-4 space-y-5">
      {BOLT_SECTION_ORDER.map(id => (
        <div key={id}>
          <SectionHeader id={id} loading />
          <div className="mt-2 space-y-2">
            <div className="h-4 bg-slate-100 animate-pulse" />
            <div className="h-4 bg-slate-100 animate-pulse w-4/5" />
            <div className="h-4 bg-slate-100 animate-pulse w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorBody({
  message,
  canRetry,
  onRetry,
}: {
  message: string
  canRetry: boolean
  onRetry: () => void
}) {
  return (
    <div className="px-5 py-6">
      <div className="text-[14px] font-black text-black leading-tight">
        Context Source could not complete this briefing.
      </div>
      <p className="text-[11px] text-black/70 leading-relaxed mt-3">{message}</p>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 w-full h-10 bg-[#0000ff] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#0000cc] transition-colors"
        >
          Retry briefing
        </button>
      )}
    </div>
  )
}

function SectionsBody({
  sections,
  preview,
  scopeLabel,
}: {
  sections: ReadonlyArray<BoltSectionState>
  preview: BoltPreviewActivation
  scopeLabel: string | null
}) {
  // Resolve the active source by looking up the derived activeResultId
  // from the parent hook against a flat id → BoltSource index built
  // from the current briefing. The index is memoised per sections
  // reference; changing the briefing produces a fresh index and the
  // parent hook has already reset the triplet via run().
  const sourceIndex = useMemo(() => buildSourceIndex(sections), [sections])
  const activeSource = preview.activeResultId
    ? sourceIndex.get(preview.activeResultId) ?? null
    : null

  // Adapt the hook's id-or-null setters into the row-level RowHandlers
  // shape (which uses "leave"/"blur" callbacks with no arguments).
  // Keeping the two shapes separate prevents row components from
  // mutating preview state directly.
  const handlers: RowHandlers = {
    selectedId: preview.selectedResultId,
    activeId: preview.activeResultId,
    onHoverEnter: (id: string) => preview.setHoveredResult(id),
    onHoverLeave: () => preview.setHoveredResult(null),
    onFocus: (id: string) => preview.setFocusedResult(id),
    onBlur: () => preview.setFocusedResult(null),
    onSelect: (id: string) => preview.setSelectedResult(id),
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <BoltPreviewGrid source={activeSource} />
      {/* Scope label — sits between preview and scrollable sections */}
      {scopeLabel && (
        <div className="shrink-0 px-4 py-1.5 border-b border-black/6 text-[8px] font-semibold uppercase tracking-widest text-black/35">
          Briefing for: <span className="text-black/60">&ldquo;{scopeLabel}&rdquo;</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/10">
        {sections.map(section => (
          <div key={section.id} className="px-5 py-4">
            <SectionHeader id={section.id} />
            <div className="mt-3">
              <SectionInner section={section} handlers={handlers} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Build a flat `sourceId → BoltSource` lookup across every sourceable row
// in every section. Suggestions are excluded — they are scope updates, not
// destinations. Used to resolve the active row id back to a full source
// for the preview grid.
function buildSourceIndex(
  sections: ReadonlyArray<BoltSectionState>
): Map<string, BoltSource> {
  const map = new Map<string, BoltSource>()
  for (const section of sections) {
    if (section.status !== 'ready') continue
    const p = section.payload
    if (p.kind === 'briefing-top') {
      for (const f of p.facts) map.set(f.source.id, f.source)
    } else if (p.kind === 'coverage') {
      for (const c of p.clusters) map.set(c.representative.id, c.representative)
    } else if (p.kind === 'sources' || p.kind === 'hard-to-get') {
      for (const s of p.items) map.set(s.id, s)
    } else if (p.kind === 'lightbox-candidates') {
      for (const cand of p.candidates) map.set(cand.source.id, cand.source)
    }
  }
  return map
}

function SectionHeader({
  id,
  loading,
}: {
  id: BoltSectionId
  loading?: boolean
}) {
  const label = BOLT_SECTION_LABELS[id]
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-black">
          {label.title}
        </div>
        <div className="text-[9px] text-black/40 mt-0.5">{label.sub}</div>
      </div>
      {loading && (
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#0000ff]">
          Loading
        </span>
      )}
    </div>
  )
}

function SectionInner({
  section,
  handlers,
}: {
  section: BoltSectionState
  handlers: RowHandlers
}) {
  if (section.status === 'empty') {
    return (
      <div className="text-[11px] text-black/50 italic">{section.reason}</div>
    )
  }
  if (section.status === 'error') {
    return <div className="text-[11px] text-red-700">{section.message}</div>
  }

  const p = section.payload
  switch (p.kind) {
    case 'briefing-top':
      return (
        <ul role="listbox" aria-label="Key facts" className="space-y-3">
          {p.facts.map(f => (
            <FactRow key={f.id} fact={f} handlers={handlers} />
          ))}
        </ul>
      )
    case 'coverage':
      return (
        <ul role="listbox" aria-label="Coverage" className="space-y-3">
          {p.clusters.map(c => (
            <ClusterRow key={c.id} cluster={c} handlers={handlers} />
          ))}
        </ul>
      )
    case 'sources':
      return (
        <ul role="listbox" aria-label="Sources" className="space-y-3">
          {p.items.map(s => (
            <SourceRow key={s.id} source={s} handlers={handlers} />
          ))}
        </ul>
      )
    case 'hard-to-get':
      return (
        <ul role="listbox" aria-label="Hard to get" className="space-y-3">
          {p.items.map(s => (
            <SourceRow key={s.id} source={s} showProvenance handlers={handlers} />
          ))}
        </ul>
      )
    case 'suggested-searches':
      // Suggested searches are DiscoveryScope updates, not destinations —
      // they intentionally do not participate in the preview activation model.
      return (
        <ul className="space-y-2">
          {p.suggestions.map(s => (
            <SuggestionRow key={s.id} suggestion={s} />
          ))}
        </ul>
      )
    case 'lightbox-candidates':
      return (
        <ul role="listbox" aria-label="Lightbox candidates" className="space-y-3">
          {p.candidates.map((c, i) => (
            <CandidateRow
              key={`${c.source.id}-${i}`}
              candidate={c}
              handlers={handlers}
            />
          ))}
        </ul>
      )
  }
}

// ---- Row activation helpers ------------------------------------------------

function rowHandlersForSource(source: BoltSource, handlers: RowHandlers) {
  const isSelected = handlers.selectedId === source.id
  const isActive = handlers.activeId === source.id
  return {
    isSelected,
    isActive,
    liProps: {
      role: 'option' as const,
      'aria-selected': isSelected,
      onMouseEnter: () => handlers.onHoverEnter(source.id),
      onMouseLeave: handlers.onHoverLeave,
    },
    anchorProps: {
      onFocus: () => handlers.onFocus(source.id),
      onBlur: handlers.onBlur,
      onClick: () => handlers.onSelect(source.id),
    },
  }
}

function selectedBorderClass(isSelected: boolean, isActive: boolean): string {
  // Persistent selection = solid blue left border + faint blue tint.
  // Transient hover/focus highlight = dark grey border + faint grey tint.
  // Blue belongs to action/selection; grey belongs to transient inspection.
  // Both states share a fixed pl-3 gutter so the row text never moves.
  const base = 'pl-3 border-l transition-colors'
  if (isSelected) return `${base} border-[#0000ff] bg-[#0000ff]/[0.04]`
  if (isActive) return `${base} border-black/40 bg-black/[0.03]`
  return `${base} border-transparent`
}

// ---- Row components --------------------------------------------------------

function FactRow({ fact, handlers }: { fact: BoltFact; handlers: RowHandlers }) {
  const { isSelected, isActive, liProps, anchorProps } = rowHandlersForSource(
    fact.source,
    handlers
  )
  return (
    <li {...liProps} className={selectedBorderClass(isSelected, isActive)}>
      {/*
        The invisible anchor above the claim gives keyboard Tab a focus target
        on this row without displacing the claim text. Screen readers treat
        it as a link to the source of the fact.
      */}
      <a
        href={fact.source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open source for fact: ${fact.claim}`}
        className="block group focus:outline-none focus-visible:outline-2 focus-visible:outline-[#0000ff]"
        {...anchorProps}
      >
        <p className="text-[12px] text-black leading-snug group-hover:text-[#0000ff] transition-colors">
          {fact.claim}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-widest">
          <TierBadge tier={fact.source.tier} />
          <span className="font-bold text-black truncate">
            {fact.source.publisher}
          </span>
          {fact.source.publishedAt && (
            <span className="text-black/40">{fmtDate(fact.source.publishedAt)}</span>
          )}
        </div>
      </a>
    </li>
  )
}

function ClusterRow({
  cluster,
  handlers,
}: {
  cluster: BoltCluster
  handlers: RowHandlers
}) {
  // A cluster's activation previews the representative source — the one
  // the ranker pinned to the top of the cluster.
  const { isSelected, isActive, liProps, anchorProps } = rowHandlersForSource(
    cluster.representative,
    handlers
  )
  return (
    <li {...liProps} className={selectedBorderClass(isSelected, isActive)}>
      <a
        href={cluster.representative.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open representative source for cluster: ${cluster.angleLabel}`}
        className="block group focus:outline-none focus-visible:outline-2 focus-visible:outline-[#0000ff]"
        {...anchorProps}
      >
        <div className="text-[11px] font-bold text-black leading-tight group-hover:text-[#0000ff] transition-colors">
          {cluster.angleLabel}
        </div>
        <div className="text-[9px] text-black/50 mt-0.5 uppercase tracking-widest">
          {cluster.outlets} outlets · {cluster.regions} regions · {cluster.geoTier}
        </div>
        <div className="text-[10px] text-black/70 mt-1 truncate">
          {cluster.representative.title}
        </div>
      </a>
    </li>
  )
}

function SourceContent({
  source,
  showProvenance,
  anchorProps,
}: {
  source: BoltSource
  showProvenance?: boolean
  anchorProps?: {
    onFocus?: () => void
    onBlur?: () => void
    onClick?: () => void
  }
}) {
  return (
    <>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group focus:outline-none focus-visible:outline-2 focus-visible:outline-[#0000ff]"
        {...anchorProps}
      >
        <div className="text-[11px] font-bold text-black leading-tight line-clamp-2 group-hover:text-[#0000ff] transition-colors">
          {source.title}
        </div>
      </a>
      <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-widest flex-wrap">
        <TierBadge tier={source.tier} />
        <span className="font-bold text-black">{source.publisher}</span>
        {source.region && <span className="text-black/40">{source.region}</span>}
        {source.accessState === 'paywall' && (
          <span className="text-[#0000ff]">Paywall</span>
        )}
        {source.accessState === 'archive_only' && (
          <span className="text-[#0000ff]">Archive</span>
        )}
        {source.accessState === 'access_limited' && (
          <span className="text-[#0000ff]">Access limited</span>
        )}
      </div>
      {source.excerpt && (
        <p className="text-[10px] text-black/60 mt-1 line-clamp-2 leading-snug">
          {source.excerpt}
        </p>
      )}
      {showProvenance && source.foundIn && (
        <div className="text-[9px] text-black/40 mt-1 italic">
          Found in {source.foundIn}
        </div>
      )}
    </>
  )
}

function SourceRow({
  source,
  showProvenance,
  handlers,
}: {
  source: BoltSource
  showProvenance?: boolean
  handlers: RowHandlers
}) {
  const { isSelected, isActive, liProps, anchorProps } = rowHandlersForSource(
    source,
    handlers
  )
  return (
    <li {...liProps} className={selectedBorderClass(isSelected, isActive)}>
      <SourceContent
        source={source}
        showProvenance={showProvenance}
        anchorProps={anchorProps}
      />
    </li>
  )
}

function SuggestionRow({ suggestion }: { suggestion: BoltSuggestion }) {
  return (
    <li className="border border-black/20 px-3 py-2 hover:border-[#0000ff] transition-colors">
      <div className="text-[11px] font-bold text-black">
        {suggestion.scopeSummary}
      </div>
      <div className="text-[9px] text-black/50 mt-0.5">
        {suggestion.rationale}
      </div>
    </li>
  )
}

function CandidateRow({
  candidate,
  handlers,
}: {
  candidate: BoltCandidate
  handlers: RowHandlers
}) {
  const { isSelected, isActive, liProps, anchorProps } = rowHandlersForSource(
    candidate.source,
    handlers
  )
  return (
    <li {...liProps} className={selectedBorderClass(isSelected, isActive)}>
      <SourceContent source={candidate.source} anchorProps={anchorProps} />
      <div className="text-[9px] text-[#0000ff] mt-0.5 font-bold uppercase tracking-widest">
        {candidate.reason}
      </div>
    </li>
  )
}

function TierBadge({ tier }: { tier: 1 | 2 | 3 | 4 }) {
  return (
    <span className="inline-block border border-black/30 px-1 text-[8px] font-black text-black/70">
      T{tier}
    </span>
  )
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}
