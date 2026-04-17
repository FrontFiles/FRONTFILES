// BOLT shared types — used by the API route, the client hook, the panel, and fixtures.
// Phase 1 subset of the approved BOLT session contract. Adding fields later should not
// require changing the downstream consumers.

export type DiscoveryScope = Readonly<{
  /** Free-text query from the Discovery search bar. null when empty. */
  query: string | null
  /** Active format filter chips. Empty or ['All'] means "no format filter". */
  formats: ReadonlyArray<string>
  /** Informational only — whether the Geo rail is open. Not part of retrieval scope. */
  sidebarOpen: boolean
}>

// ---- Section model ----

export type BoltSectionId =
  | 'briefing-top'
  | 'coverage'
  | 'sources'
  | 'hard-to-get'
  | 'suggested-searches'
  | 'lightbox-candidates'

export const BOLT_SECTION_ORDER: ReadonlyArray<BoltSectionId> = [
  'briefing-top',
  'coverage',
  'sources',
  'hard-to-get',
  'suggested-searches',
  'lightbox-candidates',
]

export const BOLT_SECTION_LABELS: Readonly<
  Record<BoltSectionId, { title: string; sub: string }>
> = {
  'briefing-top': { title: 'KEY FACTS', sub: 'Cited and quotable' },
  coverage: { title: 'COVERAGE', sub: 'News grouped by angle, global to local' },
  sources: { title: 'SOURCES', sub: 'Ranked by editorial tier, not recency' },
  'hard-to-get': { title: 'HARD TO GET', sub: 'Niche, regional, and archival' },
  'suggested-searches': {
    title: 'SUGGESTED SEARCHES',
    sub: 'Next angles, runnable in Discovery',
  },
  'lightbox-candidates': {
    title: 'LIGHTBOX CANDIDATES',
    sub: 'Ready to save to your active Lightbox',
  },
}

// ---- Item shapes ----

export type BoltTier = 1 | 2 | 3 | 4

export type BoltAccessState =
  | 'open'
  | 'paywall'
  | 'access_limited'
  | 'archive_only'
  | 'unreachable'

export type BoltSource = Readonly<{
  id: string
  title: string
  publisher: string
  tier: BoltTier
  url: string
  region?: string
  language: string
  publishedAt?: string
  excerpt?: string
  foundIn?: string
  accessState: BoltAccessState
  rationale: string
}>

export type BoltFact = Readonly<{
  id: string
  claim: string
  source: BoltSource
}>

export type BoltCluster = Readonly<{
  id: string
  angleLabel: string
  geoTier: 'global' | 'national' | 'regional' | 'local'
  outlets: number
  regions: number
  representative: BoltSource
  items: ReadonlyArray<BoltSource>
}>

export type BoltSuggestion = Readonly<{
  id: string
  pattern:
    | 'geo-narrow'
    | 'geo-expand'
    | 'entity-focus'
    | 'angle-focus'
    | 'time-window'
  scopeSummary: string
  rationale: string
}>

export type BoltCandidate = Readonly<{
  source: BoltSource
  reason: string
}>

// ---- Section state (discriminated by id + status) ----

export type BoltSectionPayload =
  | { kind: 'briefing-top'; facts: ReadonlyArray<BoltFact> }
  | { kind: 'coverage'; clusters: ReadonlyArray<BoltCluster> }
  | { kind: 'sources'; items: ReadonlyArray<BoltSource> }
  | { kind: 'hard-to-get'; items: ReadonlyArray<BoltSource> }
  | { kind: 'suggested-searches'; suggestions: ReadonlyArray<BoltSuggestion> }
  | { kind: 'lightbox-candidates'; candidates: ReadonlyArray<BoltCandidate> }

export type BoltSectionState = Readonly<
  | { id: BoltSectionId; status: 'ready'; payload: BoltSectionPayload }
  | { id: BoltSectionId; status: 'empty'; reason: string }
  | { id: BoltSectionId; status: 'error'; message: string }
>

// ---- Transparency footer ----

export type BoltConnectorAttempt = Readonly<{
  id: string
  status: 'ok' | 'partial' | 'error'
  items: number
}>

export type BoltTransparency = Readonly<{
  scopeSummary: string
  connectorsAttempted: ReadonlyArray<BoltConnectorAttempt>
  tiersSearched: ReadonlyArray<number>
  notes: ReadonlyArray<string>
}>

// ---- Session contract ----

export type BoltSessionRequest = Readonly<{
  scope: DiscoveryScope
  refinement?: string
  scopeHash: string
}>

export type BoltSessionResponse = Readonly<{
  sessionId: string
  scopeSummary: string
  sections: ReadonlyArray<BoltSectionState>
  transparency: BoltTransparency
  /** 'fixture' when the backend is served from local fixtures. */
  mode: 'fixture' | 'live'
}>
