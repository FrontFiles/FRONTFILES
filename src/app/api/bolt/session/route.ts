/**
 * POST /api/bolt/session
 *
 * Accepts a DiscoveryScope + optional refinement and returns a BOLT briefing.
 *
 * Phase 2: Uses the Fractal News search orchestrator to return real results
 * from trusted sources, with vault cross-referencing. Falls back to fixtures
 * if the real search returns no results.
 */

import type { NextRequest } from 'next/server'
import type {
  BoltSessionRequest,
  BoltSessionResponse,
  BoltSectionState,
  BoltSource,
  BoltFact,
  BoltCluster,
  BoltCandidate,
  BoltSuggestion,
} from '@/lib/bolt/types'
import { buildFixtureBriefing } from '@/lib/bolt/fixtures'
import { scopeIsEmpty, summarizeScope, scopeHash } from '@/lib/bolt/scope'
import { searchFractalNews, getTiersSearched } from '@/lib/bolt/search'
import { crossRefWithVault } from '@/lib/bolt/cross-ref'
import { TRUSTED_SOURCES } from '@/lib/bolt/sources'

interface ErrorBody {
  error: string
  message: string
}

const errorJson = (body: ErrorBody, status: number): Response =>
  Response.json(body, { status })

export async function POST(request: NextRequest): Promise<Response> {
  let body: BoltSessionRequest
  try {
    body = (await request.json()) as BoltSessionRequest
  } catch {
    return errorJson(
      { error: 'INVALID_BODY', message: 'Request body must be valid JSON.' },
      400
    )
  }

  if (!body || typeof body !== 'object' || !body.scope) {
    return errorJson(
      { error: 'MISSING_SCOPE', message: 'scope is required.' },
      400
    )
  }

  if (scopeIsEmpty(body.scope)) {
    return errorJson(
      { error: 'EMPTY_SCOPE', message: 'Context Source needs a scope from Discovery.' },
      422
    )
  }

  // Dev-mode magic query strings for exercising UI states.
  const q = (body.scope.query || '').toLowerCase()
  if (q.includes('error')) {
    return errorJson(
      { error: 'DEV_FORCED_ERROR', message: 'Context Source could not complete this briefing (dev-forced error).' },
      500
    )
  }

  // Small delay so loading skeleton is visible during testing.
  await new Promise(r => setTimeout(r, 400))

  // ── Real search ──
  const sources = searchFractalNews(body.scope)

  // No results — return honest empty briefing, not fake fixtures
  if (sources.length === 0) {
    const summary = summarizeScope(body.scope)
    const hash = scopeHash(body.scope)
    const emptyBriefing: BoltSessionResponse = {
      sessionId: `sess-${hash.slice(0, 8)}`,
      scopeSummary: summary,
      sections: [
        { id: 'briefing-top', status: 'empty', reason: 'No external sources found for this query. Try broader terms.' },
        { id: 'coverage', status: 'empty', reason: 'No coverage clusters found.' },
        { id: 'sources', status: 'empty', reason: 'No trusted sources matched this query.' },
        { id: 'hard-to-get', status: 'empty', reason: 'No niche sources found.' },
        { id: 'suggested-searches', status: 'ready', payload: { kind: 'suggested-searches', suggestions: [
          { id: 'sug-broader', pattern: 'geo-expand', scopeSummary: `${body.scope.query} news coverage`, rationale: 'Try adding broader context terms.' },
          { id: 'sug-region', pattern: 'geo-narrow', scopeSummary: `${body.scope.query} Brazil OR Portugal`, rationale: 'Add a geographic focus.' },
        ] } },
        { id: 'lightbox-candidates', status: 'empty', reason: 'No vault matches without external sources.' },
      ],
      transparency: {
        scopeSummary: summary,
        connectorsAttempted: [{ id: 'tier-all', status: 'ok', items: 0 }],
        tiersSearched: [1, 2, 3, 4],
        notes: ['All 4 tiers searched, 0 results matched the query'],
      },
      mode: 'live',
    }
    return Response.json(emptyBriefing, { status: 200 })
  }

  // ── Vault cross-reference ──
  const vaultMatches = crossRefWithVault(sources)

  // ── Build real briefing ──
  const summary = summarizeScope(body.scope)
  const hash = scopeHash(body.scope)
  const tiersSearched = getTiersSearched(sources)

  const sections = buildSections(sources, vaultMatches, body.scope.query || '')

  const briefing: BoltSessionResponse = {
    sessionId: `sess-${hash.slice(0, 8)}`,
    scopeSummary: summary,
    sections,
    transparency: {
      scopeSummary: summary,
      connectorsAttempted: tiersSearched.map(t => ({
        id: `tier-${t}`,
        status: 'ok' as const,
        items: sources.filter(s => s.tier === t).length,
      })),
      tiersSearched,
      notes: [
        `Searched ${sources.length} sources across ${tiersSearched.length} tiers`,
        `${vaultMatches.length} vault cross-references found`,
        'Inverse weighting: local/specialist sources scored higher',
      ],
    },
    mode: 'live',
  }

  return Response.json(briefing, { status: 200 })
}

// ═══════════════════════════════════════════════
// SECTION BUILDERS
// ═══════════════════════════════════════════════

function buildSections(
  sources: BoltSource[],
  vaultMatches: { sourceId: string; assetIds: string[]; matchScore: number; matchReason: string }[],
  query: string,
): BoltSectionState[] {
  const sections: BoltSectionState[] = []

  // KEY FACTS — top 3 sources as quotable facts
  const topSources = sources.slice(0, 3)
  if (topSources.length > 0) {
    const facts: BoltFact[] = topSources.map(s => ({
      id: `fact-${s.id}`,
      claim: s.excerpt ?? s.title,
      source: s,
    }))
    sections.push({ id: 'briefing-top', status: 'ready', payload: { kind: 'briefing-top', facts } })
  } else {
    sections.push({ id: 'briefing-top', status: 'empty', reason: 'No key facts found for this query.' })
  }

  // COVERAGE — cluster by region
  const regionMap = new Map<string, BoltSource[]>()
  for (const s of sources) {
    const region = s.region || 'Global'
    if (!regionMap.has(region)) regionMap.set(region, [])
    regionMap.get(region)!.push(s)
  }
  const clusters: BoltCluster[] = Array.from(regionMap.entries()).map(([region, items], i) => ({
    id: `cluster-${i}`,
    angleLabel: region === 'Global' ? 'Global coverage' : `${region} regional coverage`,
    geoTier: region === 'Global' ? 'global' as const : 'regional' as const,
    outlets: new Set(items.map(s => s.publisher)).size,
    regions: 1,
    representative: items[0],
    items,
  }))
  if (clusters.length > 0) {
    sections.push({ id: 'coverage', status: 'ready', payload: { kind: 'coverage', clusters } })
  } else {
    sections.push({ id: 'coverage', status: 'empty', reason: 'No coverage clusters found.' })
  }

  // SOURCES — all sources ranked
  sections.push({ id: 'sources', status: 'ready', payload: { kind: 'sources', items: sources } })

  // HARD TO GET — Tier 3-4 sources
  const niche = sources.filter(s => s.tier >= 3)
  if (niche.length > 0) {
    sections.push({ id: 'hard-to-get', status: 'ready', payload: { kind: 'hard-to-get', items: niche } })
  } else {
    sections.push({ id: 'hard-to-get', status: 'empty', reason: 'No niche/investigative sources found for this query.' })
  }

  // SUGGESTED SEARCHES — derive from result gaps
  const suggestions: BoltSuggestion[] = []
  const hasLocal = sources.some(s => s.tier >= 3)
  if (!hasLocal) {
    suggestions.push({ id: 'sug-local', pattern: 'geo-narrow', scopeSummary: `${query} local community reporting`, rationale: 'No local/investigative sources found. Narrow the geographic scope.' })
  }
  suggestions.push({ id: 'sug-time', pattern: 'time-window', scopeSummary: `${query} last 7 days`, rationale: 'Focus on the most recent developments.' })
  suggestions.push({ id: 'sug-entity', pattern: 'entity-focus', scopeSummary: `${query} official response`, rationale: 'Search for government or institutional response coverage.' })
  sections.push({ id: 'suggested-searches', status: 'ready', payload: { kind: 'suggested-searches', suggestions } })

  // LIGHTBOX CANDIDATES — sources with vault matches
  const candidates: BoltCandidate[] = vaultMatches.slice(0, 3).map(m => {
    const source = sources.find(s => s.id === m.sourceId)!
    return { source, reason: m.matchReason }
  })
  if (candidates.length > 0) {
    sections.push({ id: 'lightbox-candidates', status: 'ready', payload: { kind: 'lightbox-candidates', candidates } })
  } else {
    sections.push({ id: 'lightbox-candidates', status: 'empty', reason: 'No vault matches found for these sources.' })
  }

  return sections
}
