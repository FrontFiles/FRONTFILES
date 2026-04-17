// BOLT fixture briefing generator.
// This file is intentionally isolated. When a real orchestrator lands, delete
// this file and swap `buildFixtureBriefing` in the API route for the real call.
// Everything returned here conforms to the public BoltSessionResponse contract.

import type {
  BoltCandidate,
  BoltCluster,
  BoltFact,
  BoltSectionState,
  BoltSessionRequest,
  BoltSessionResponse,
  BoltSource,
  BoltSuggestion,
  BoltTransparency,
} from './types'
import { summarizeScope } from './scope'

const T1_PUBS = [
  { publisher: 'Associated Press', domain: 'apnews.com', region: 'US', lang: 'en' },
  { publisher: 'Reuters', domain: 'reuters.com', region: 'GB', lang: 'en' },
  { publisher: 'BBC News', domain: 'bbc.com', region: 'GB', lang: 'en' },
] as const

const T2_PUBS = [
  { publisher: 'The Guardian', domain: 'theguardian.com', region: 'GB', lang: 'en' },
  { publisher: 'Le Monde', domain: 'lemonde.fr', region: 'FR', lang: 'fr' },
] as const

const T3_PUBS = [
  { publisher: 'Público', domain: 'publico.pt', region: 'PT', lang: 'pt' },
  { publisher: 'El País Regional', domain: 'elpais.com', region: 'ES', lang: 'es' },
] as const

const T4_PUBS = [
  { publisher: 'Porto Daily', domain: 'porto-daily.pt', region: 'PT-13', lang: 'pt' },
  { publisher: 'Lisbon Echo', domain: 'lisbon-echo.pt', region: 'PT-11', lang: 'pt' },
] as const

const cap = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const ago = (hoursAgo: number): string =>
  new Date(Date.now() - hoursAgo * 3600_000).toISOString()

const mkSource = (
  id: string,
  scopeLabel: string,
  pub: { publisher: string; domain: string; region: string; lang: string },
  tier: 1 | 2 | 3 | 4,
  hoursAgo: number,
  opts: Partial<BoltSource> = {}
): BoltSource => ({
  id,
  title: `${cap(scopeLabel)} — field dispatch (${id})`,
  publisher: pub.publisher,
  tier,
  url: `https://${pub.domain}/article/${id}`,
  region: pub.region,
  language: pub.lang,
  publishedAt: ago(hoursAgo),
  excerpt:
    `Verified dispatch covering ${scopeLabel}, including timeline, on-record quotes, and multiple ` +
    `independently sourced details. Ranks above newer wire rewrites on corroboration and tier.`,
  accessState: 'open',
  rationale: `T${tier} authority from ${pub.publisher} drives this placement.`,
  ...opts,
})

const mkFact = (id: string, claim: string, source: BoltSource): BoltFact => ({
  id,
  claim,
  source,
})

const mkCluster = (
  id: string,
  angleLabel: string,
  geoTier: BoltCluster['geoTier'],
  items: ReadonlyArray<BoltSource>
): BoltCluster => ({
  id,
  angleLabel,
  geoTier,
  outlets: items.length,
  regions: new Set(items.map(i => i.region ?? '—')).size,
  representative: items[0],
  items,
})

const mkSuggestion = (
  id: string,
  pattern: BoltSuggestion['pattern'],
  scopeSummary: string,
  rationale: string
): BoltSuggestion => ({ id, pattern, scopeSummary, rationale })

const mkCandidate = (source: BoltSource, reason: string): BoltCandidate => ({
  source,
  reason,
})

function readySection(
  id: BoltSectionState['id'],
  payload: Extract<BoltSectionState, { status: 'ready' }>['payload']
): BoltSectionState {
  return { id, status: 'ready', payload }
}

function emptySection(
  id: BoltSectionState['id'],
  reason: string
): BoltSectionState {
  return { id, status: 'empty', reason }
}

const EMPTY_REASONS: Record<BoltSectionState['id'], string> = {
  'briefing-top': `No cited facts passed Context Source's standard for this scope.`,
  coverage: 'No coverage clusters formed from the sources found.',
  sources: `No trusted sources cleared the tier floor.`,
  'hard-to-get': 'No hard-to-get intelligence for this scope.',
  'suggested-searches': 'No follow-up angles for this scope.',
  'lightbox-candidates': 'No Lightbox-ready items from this briefing.',
}

function buildFullSections(scopeLabel: string): BoltSectionState[] {
  // Sources — 5 items across tiers for visible diversity
  const s1 = mkSource('s1', scopeLabel, T1_PUBS[0], 1, 4)
  const s2 = mkSource('s2', scopeLabel, T1_PUBS[1], 1, 11)
  const s3 = mkSource('s3', scopeLabel, T2_PUBS[0], 2, 28)
  const s4 = mkSource('s4', scopeLabel, T2_PUBS[1], 2, 40)
  const s5 = mkSource('s5', scopeLabel, T3_PUBS[0], 3, 73)

  // Coverage — 2 clusters, one local-leaning
  const c1Items = [
    mkSource('c1a', scopeLabel, T4_PUBS[0], 4, 6, {
      foundIn: 'Porto regional press index',
    }),
    mkSource('c1b', scopeLabel, T4_PUBS[1], 4, 9, {
      foundIn: 'Porto regional press index',
    }),
    mkSource('c1c', scopeLabel, T3_PUBS[0], 3, 14),
  ]
  const c2Items = [
    mkSource('c2a', scopeLabel, T1_PUBS[2], 1, 3),
    mkSource('c2b', scopeLabel, T1_PUBS[0], 1, 8),
  ]
  const clusters: BoltCluster[] = [
    mkCluster('cl-local', `Local reaction to ${scopeLabel}`, 'local', c1Items),
    mkCluster('cl-global', `Global coverage of ${scopeLabel}`, 'global', c2Items),
  ]

  // Hard to get — 3 off-mainstream items
  const hg1 = mkSource('hg1', scopeLabel, T4_PUBS[0], 4, 18, {
    foundIn: 'Porto regional press index',
  })
  const hg2 = mkSource('hg2', scopeLabel, T4_PUBS[1], 4, 32, {
    foundIn: 'Lisbon regional archive',
  })
  const hg3: BoltSource = {
    ...mkSource('hg3', scopeLabel, T3_PUBS[1], 3, 96),
    foundIn: 'EU subject archive',
    accessState: 'archive_only',
    rationale: 'Hard-to-get: archive source outside the mainstream index.',
  }

  // Key facts — validated, citation-ready
  const facts: BoltFact[] = [
    mkFact(
      'f1',
      `${cap(scopeLabel)} was confirmed on the record by three independent publishers in the last 24 hours.`,
      s1
    ),
    mkFact(
      'f2',
      `Regional sources in Porto filed local reaction coverage within 6 hours of the main wire.`,
      c1Items[0]
    ),
    mkFact(
      'f3',
      `At least two archival sources place ${scopeLabel} within a broader, under-reported editorial pattern.`,
      hg3
    ),
  ]

  // Suggested searches — structured, distinct patterns
  const suggestions: BoltSuggestion[] = [
    mkSuggestion(
      'sg1',
      'geo-narrow',
      `${scopeLabel} · Porto`,
      'Covers the local angle in the region where strongest corroboration was found.'
    ),
    mkSuggestion(
      'sg2',
      'angle-focus',
      `${scopeLabel} · regional funding`,
      'Surfaces the regional-funding angle found in a hard-to-get archive.'
    ),
    mkSuggestion(
      'sg3',
      'entity-focus',
      `${scopeLabel} · creator profile`,
      'Pivots the scope to the creator most cited by surfaced items.'
    ),
    mkSuggestion(
      'sg4',
      'time-window',
      `${scopeLabel} · last 7 days`,
      'Narrows to the recency band where cluster momentum is highest.'
    ),
  ]

  // Lightbox candidates — a curated trio complementing the Lightbox
  const candidates: BoltCandidate[] = [
    mkCandidate(s1, 'Top cited source with quotable excerpt.'),
    mkCandidate(hg1, 'Hard-to-get regional source, not in your Lightbox.'),
    mkCandidate(c1Items[0], 'Cluster representative for the local angle.'),
  ]

  return [
    readySection('briefing-top', { kind: 'briefing-top', facts }),
    readySection('coverage', { kind: 'coverage', clusters }),
    readySection('sources', { kind: 'sources', items: [s1, s2, s3, s4, s5] }),
    readySection('hard-to-get', { kind: 'hard-to-get', items: [hg1, hg2, hg3] }),
    readySection('suggested-searches', {
      kind: 'suggested-searches',
      suggestions,
    }),
    readySection('lightbox-candidates', {
      kind: 'lightbox-candidates',
      candidates,
    }),
  ]
}

function allEmptySections(): BoltSectionState[] {
  return (
    ['briefing-top', 'coverage', 'sources', 'hard-to-get', 'suggested-searches', 'lightbox-candidates'] as const
  ).map(id => emptySection(id, EMPTY_REASONS[id]))
}

function partialSections(scopeLabel: string): BoltSectionState[] {
  const full = buildFullSections(scopeLabel)
  // Empty the coverage section to exercise the partial path.
  return full.map(s =>
    s.id === 'coverage' ? emptySection('coverage', EMPTY_REASONS.coverage) : s
  )
}

function buildTransparency(scopeLabel: string, partial: boolean): BoltTransparency {
  return {
    scopeSummary: scopeLabel,
    connectorsAttempted: [
      { id: 'ap-wire-v1', status: 'ok', items: 2 },
      { id: 'trade-index-v1', status: 'ok', items: 2 },
      {
        id: 'porto-regional-v1',
        status: partial ? 'partial' : 'ok',
        items: partial ? 0 : 3,
      },
      { id: 'sec-edgar-v1', status: 'ok', items: 1 },
    ],
    tiersSearched: [1, 2, 3, 4],
    notes: partial ? ['Regional aggregator returned no clusters.'] : [],
  }
}

function sessionId(scopeHash: string): string {
  // Deterministic per scope so repeat tests have a stable id.
  return `sess-${Math.abs(hash32(scopeHash)).toString(16)}`
}

function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}

export function buildFixtureBriefing(req: BoltSessionRequest): BoltSessionResponse {
  const scopeLabel = summarizeScope(req.scope)
  const q = (req.scope.query || '').toLowerCase()
  const isEmpty = q.includes('empty')
  const isPartial = q.includes('partial')

  const sections: BoltSectionState[] = isEmpty
    ? allEmptySections()
    : isPartial
      ? partialSections(scopeLabel)
      : buildFullSections(scopeLabel)

  return Object.freeze({
    sessionId: sessionId(req.scopeHash),
    scopeSummary: scopeLabel,
    sections: Object.freeze(sections),
    transparency: buildTransparency(scopeLabel, isPartial),
    mode: 'fixture',
  })
}
