// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Social Layer Dataset (Phase 3)
// Follows, social counts, comments, conversations, messages
// ═══════════════════════════════════════════════════════════════

import type {
  CommentAuthor,
  Comment,
  Conversation,
  DirectMessage,
  SocialCounts,
  ConnectionState,
} from '../lib/types'
import { assets } from './assets'
import { stories } from './stories'
import { articles } from './articles'

// ════════════════════════════════════════════════════════════════
// 1. SOCIAL AUTHORS
// 28 total: 24 creators + 2 buyers + 2 external commenters
// ════════════════════════════════════════════════════════════════

// ── 24 creators ──────────────────────────────────────────────

const _sarahchen: CommentAuthor = {
  username: 'sarahchen',
  displayName: 'Sarah Chen',
  professionalTitle: 'Senior Correspondent, Asia Pacific',
  trustBadge: 'verified',
}
const _marcooliveira: CommentAuthor = {
  username: 'marcooliveira',
  displayName: 'Marco Oliveira',
  professionalTitle: 'Photojournalist, Southern Brazil',
  trustBadge: 'verified',
}
const _anasousa: CommentAuthor = {
  username: 'anasousa',
  displayName: 'Ana Sousa',
  professionalTitle: 'Parliamentary Photographer, Lisbon',
  trustBadge: 'verified',
}
const _dimitriskatsaros: CommentAuthor = {
  username: 'dimitriskatsaros',
  displayName: 'Dimitris Katsaros',
  professionalTitle: 'Border Correspondent, Evros Region',
  trustBadge: 'verified',
}
const _luciaferrante: CommentAuthor = {
  username: 'luciaferrante',
  displayName: 'Lucia Ferrante',
  professionalTitle: 'Court and Accountability Reporter, Sicily',
  trustBadge: 'verified',
}
const _yaraboukhari: CommentAuthor = {
  username: 'yaraboukhari',
  displayName: 'Yara Boukhari',
  professionalTitle: 'Public Health and Logistics Correspondent',
  trustBadge: 'verified',
}
const _tomasznowak: CommentAuthor = {
  username: 'tomasznowak',
  displayName: 'Tomasz Nowak',
  professionalTitle: 'Labor and Civic Reporter, Poland',
  trustBadge: 'verified',
}
const _elenavasile: CommentAuthor = {
  username: 'elenavasile',
  displayName: 'Elena Vasile',
  professionalTitle: 'Youth Movements Reporter, Bucharest',
  trustBadge: 'trusted',
}
const _carmenruiz: CommentAuthor = {
  username: 'carmenruiz',
  displayName: 'Carmen Ruiz',
  professionalTitle: 'Data Visualization Journalist, Andalusia',
  trustBadge: 'verified',
}
const _nikospapadopoulos: CommentAuthor = {
  username: 'nikospapadopoulos',
  displayName: 'Nikos Papadopoulos',
  professionalTitle: 'Humanitarian Logistics Photographer',
  trustBadge: 'trusted',
}
const _kofimensah: CommentAuthor = {
  username: 'kofimensah',
  displayName: 'Kofi Mensah',
  professionalTitle: 'Photojournalist',
  trustBadge: 'verified',
}
const _priyasharma: CommentAuthor = {
  username: 'priyasharma',
  displayName: 'Priya Sharma',
  professionalTitle: 'Visual Journalist',
  trustBadge: 'verified',
}
const _fatimaalrashid: CommentAuthor = {
  username: 'fatimaalrashid',
  displayName: 'Fatima Al-Rashid',
  professionalTitle: 'Documentary Photographer',
  trustBadge: 'verified',
}
const _larseriksson: CommentAuthor = {
  username: 'larseriksson',
  displayName: 'Lars Eriksson',
  professionalTitle: 'Reporter and Photographer',
  trustBadge: 'trusted',
}
const _aikotanaka: CommentAuthor = {
  username: 'aikotanaka',
  displayName: 'Aiko Tanaka',
  professionalTitle: 'Photojournalist',
  trustBadge: 'verified',
}
const _carlosmendoza: CommentAuthor = {
  username: 'carlosmendoza',
  displayName: 'Carlos Mendoza',
  professionalTitle: 'Documentary Filmmaker and Photographer',
  trustBadge: 'verified',
}
const _aminadiallo: CommentAuthor = {
  username: 'aminadiallo',
  displayName: 'Amina Diallo',
  professionalTitle: 'Visual Journalist',
  trustBadge: 'trusted',
}
const _jamesobrien: CommentAuthor = {
  username: 'jamesobrien',
  displayName: "James O'Brien",
  professionalTitle: 'Environmental Photojournalist',
  trustBadge: 'verified',
}
const _oluwaseunadeyemi: CommentAuthor = {
  username: 'oluwaseunadeyemi',
  displayName: 'Oluwaseun Adeyemi',
  professionalTitle: 'Security and Press Freedom Correspondent, Lagos',
  trustBadge: 'verified',
}
const _mariamtoure: CommentAuthor = {
  username: 'mariamtoure',
  displayName: 'Mariam Touré',
  professionalTitle: 'Sahel Coup and Press Freedom Reporter',
  trustBadge: 'trusted',
}
const _abdirahimhassan: CommentAuthor = {
  username: 'abdirahimhassan',
  displayName: 'Abdirahim Hassan',
  professionalTitle: 'Famine and Displacement Photojournalist, Somalia',
  trustBadge: 'verified',
}
const _yasminalharazi: CommentAuthor = {
  username: 'yasminAlharazi',
  displayName: 'Yasmin Al-Harazi',
  professionalTitle: 'Yemen Humanitarian and War Correspondent',
  trustBadge: 'verified',
}
const _tigisthaile: CommentAuthor = {
  username: 'tigisthaile',
  displayName: 'Tigist Haile',
  professionalTitle: 'Post-Conflict Recovery Correspondent, Ethiopia',
  trustBadge: 'trusted',
}
const _khalidibrahim: CommentAuthor = {
  username: 'khalidibrahim',
  displayName: 'Khalid Ibrahim',
  professionalTitle: 'Sudan Civil War Correspondent',
  trustBadge: 'verified',
}

// ── 2 buyers ─────────────────────────────────────────────────

const _mariasantos: CommentAuthor = {
  username: 'mariasantos',
  displayName: 'Maria Santos',
  professionalTitle: 'Content Director, Global Report Media',
  trustBadge: null,
}
const _jamesokafor: CommentAuthor = {
  username: 'jamesokafor',
  displayName: 'James Okafor',
  professionalTitle: 'Photo Editor, Conflict Coverage Unit',
  trustBadge: 'verified',
}

// ── 2 external commenters (not platform creators) ────────────

const _marcoricci: CommentAuthor = {
  username: 'marcoricci',
  displayName: 'Marco Ricci',
  professionalTitle: 'Photo Editor, European Bureau',
  trustBadge: 'verified',
}
const _ananyagupta: CommentAuthor = {
  username: 'ananyagupta',
  displayName: 'Ananya Gupta',
  professionalTitle: 'Investigative Reporter, South Asia',
  trustBadge: 'trusted',
}

/** All 28 social participants keyed by username. */
export const socialAuthors: Record<string, CommentAuthor> = {
  // 24 creators
  sarahchen: _sarahchen,
  marcooliveira: _marcooliveira,
  anasousa: _anasousa,
  dimitriskatsaros: _dimitriskatsaros,
  luciaferrante: _luciaferrante,
  yaraboukhari: _yaraboukhari,
  tomasznowak: _tomasznowak,
  elenavasile: _elenavasile,
  carmenruiz: _carmenruiz,
  nikospapadopoulos: _nikospapadopoulos,
  kofimensah: _kofimensah,
  priyasharma: _priyasharma,
  fatimaalrashid: _fatimaalrashid,
  larseriksson: _larseriksson,
  aikotanaka: _aikotanaka,
  carlosmendoza: _carlosmendoza,
  aminadiallo: _aminadiallo,
  jamesobrien: _jamesobrien,
  oluwaseunadeyemi: _oluwaseunadeyemi,
  mariamtoure: _mariamtoure,
  abdirahimhassan: _abdirahimhassan,
  yasminAlharazi: _yasminalharazi,
  tigisthaile: _tigisthaile,
  khalidibrahim: _khalidibrahim,
  // 2 buyers
  mariasantos: _mariasantos,
  jamesokafor: _jamesokafor,
  // 2 external commenters
  marcoricci: _marcoricci,
  ananyagupta: _ananyagupta,
}

// ════════════════════════════════════════════════════════════════
// 2. FOLLOW GRAPH
// Asymmetric adjacency list: followGraph[username] = who they follow
// Full creators are more interconnected; sparse creators follow
// flagship and cluster leaders but have fewer mutual links.
// ════════════════════════════════════════════════════════════════

/**
 * Who each participant follows. Not symmetric.
 * Full profile creators follow each other in geographic clusters.
 * Sparse creators follow flagship + cluster leaders.
 * Buyers follow conflict/flagship creators they license from.
 * External commenters follow creators whose work they critique.
 */
export const followGraph: Record<string, string[]> = {
  // ── European cluster (001-009) ────────────────────────────
  marcooliveira: ['anasousa', 'sarahchen', 'oluwaseunadeyemi', 'carmenruiz'],
  anasousa: ['marcooliveira', 'sarahchen', 'luciaferrante', 'dimitriskatsaros'],
  dimitriskatsaros: ['nikospapadopoulos', 'sarahchen', 'anasousa', 'fatimaalrashid'],
  luciaferrante: ['anasousa', 'sarahchen', 'yaraboukhari'],
  yaraboukhari: ['sarahchen', 'carmenruiz', 'luciaferrante', 'oluwaseunadeyemi'],
  tomasznowak: ['elenavasile', 'sarahchen', 'marcooliveira'],
  elenavasile: ['tomasznowak', 'sarahchen', 'yaraboukhari'],
  carmenruiz: ['yaraboukhari', 'sarahchen', 'marcooliveira', 'luciaferrante'],
  nikospapadopoulos: ['dimitriskatsaros', 'sarahchen', 'yaraboukhari'],

  // ── Flagship (010) ────────────────────────────────────────
  sarahchen: ['marcooliveira', 'anasousa', 'oluwaseunadeyemi', 'yasminalharazi', 'khalidibrahim', 'tigisthaile'],

  // ── Africa cluster (019-024) ──────────────────────────────
  oluwaseunadeyemi: ['mariamtoure', 'sarahchen', 'khalidibrahim', 'abdirahimhassan'],
  mariamtoure: ['oluwaseunadeyemi', 'sarahchen', 'tigisthaile', 'abdirahimhassan'],
  abdirahimhassan: ['khalidibrahim', 'sarahchen', 'oluwaseunadeyemi', 'tigisthaile'],
  yasminAlharazi: ['khalidibrahim', 'sarahchen', 'tigisthaile', 'abdirahimhassan'],
  tigisthaile: ['abdirahimhassan', 'mariamtoure', 'sarahchen', 'yasminAlharazi'],
  khalidibrahim: ['yasminAlharazi', 'sarahchen', 'oluwaseunadeyemi', 'abdirahimhassan'],

  // ── Sparse creators (011-018) — minimal follows ───────────
  kofimensah: ['oluwaseunadeyemi', 'sarahchen'],
  priyasharma: ['sarahchen'],
  fatimaalrashid: ['sarahchen', 'yasminAlharazi', 'dimitriskatsaros'],
  larseriksson: ['sarahchen'],
  aikotanaka: ['sarahchen'],
  carlosmendoza: ['marcooliveira', 'sarahchen'],
  aminadiallo: ['oluwaseunadeyemi', 'sarahchen'],
  jamesobrien: ['sarahchen'],

  // ── Buyers ───────────────────────────────────────────────
  mariasantos: ['sarahchen', 'marcooliveira', 'oluwaseunadeyemi', 'yasminAlharazi', 'khalidibrahim'],
  jamesokafor: ['sarahchen', 'oluwaseunadeyemi', 'yasminAlharazi', 'khalidibrahim', 'abdirahimhassan', 'tigisthaile'],

  // ── External commenters ───────────────────────────────────
  marcoricci: ['sarahchen', 'marcooliveira', 'elenavasile', 'carmenruiz', 'yaraboukhari'],
  ananyagupta: ['sarahchen', 'dimitriskatsaros', 'fatimaalrashid', 'priyasharma'],
}

/** Returns the number of accounts following a given username. */
export function getFollowerCount(username: string): number {
  return Object.values(followGraph).filter(list => list.includes(username)).length
}

/** Returns true if `follower` follows `subject`. */
export function isFollowing(follower: string, subject: string): boolean {
  return (followGraph[follower] ?? []).includes(subject)
}

// ════════════════════════════════════════════════════════════════
// 3. DETERMINISTIC SOCIAL COUNTS
// Hash-based — same content ID always produces the same counts.
// Activity multipliers model creator prominence.
// ════════════════════════════════════════════════════════════════

const CREATOR_ACTIVITY: Record<string, number> = {
  'creator-010': 2.5, // Sarah Chen — flagship, highest engagement
  'creator-001': 2.0, // Marco Oliveira — breaking news, high visibility
  'creator-019': 1.8, // Oluwaseun Adeyemi — conflict coverage draws attention
  'creator-022': 1.6, // Yasmin Al-Harazi — Yemen humanitarian, high interest
  'creator-002': 1.5, // Ana Sousa — institutional, steady engagement
  'creator-024': 1.5, // Khalid Ibrahim — Sudan, high interest
  'creator-005': 1.4, // Yara Boukhari — health crisis, timely
  'creator-006': 1.3, // Tomasz Nowak — civic unrest
  'creator-003': 1.0, // Dimitris Katsaros — standard
  'creator-004': 1.0, // Lucia Ferrante — standard
  'creator-007': 1.0, // Elena Vasile — standard
  'creator-008': 1.0, // Carmen Ruiz — standard
  'creator-009': 1.0, // Nikos Papadopoulos — standard
  'creator-020': 0.9, // Mariam Touré — active but smaller audience
  'creator-021': 0.9, // Abdirahim Hassan — active but smaller audience
  'creator-023': 0.9, // Tigist Haile — active but smaller audience
  'creator-011': 0.3, // Kofi Mensah — sparse/dormant
  'creator-012': 0.3, // Priya Sharma — sparse/incomplete
  'creator-013': 0.3, // Fatima Al-Rashid — sparse/low social
  'creator-014': 0.3, // Lars Eriksson — sparse/dormant
  'creator-015': 0.3, // Aiko Tanaka — sparse/incomplete
  'creator-016': 0.3, // Carlos Mendoza — sparse/sporadic
  'creator-017': 0.3, // Amina Diallo — sparse/new
  'creator-018': 0.3, // James O'Brien — sparse/dormant
}

function _djb2Hash(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Deterministic social counts for any content item.
 * Same inputs always produce the same output — safe to call at render time.
 */
export function getSocialCounts(contentId: string, creatorId: string): SocialCounts {
  const baseHash = _djb2Hash(contentId)
  const creatorMultiplier = CREATOR_ACTIVITY[creatorId] ?? 1.0
  const typeMultiplier = contentId.startsWith('article') ? 1.8
    : contentId.startsWith('story') ? 1.5
    : 1.0

  const rawLikes = (baseHash % 120) + 2           // 2–121 base range
  const rawComments = ((baseHash >>> 8) % 8)       // 0–7 base range

  return {
    likes: Math.round(rawLikes * creatorMultiplier * typeMultiplier),
    comments: Math.round(rawComments * creatorMultiplier),
    userLiked: (baseHash % 5) === 0,               // ~20% liked by viewer
  }
}

// ── Precomputed map for all content at module load ─────────────

/** Social counts for every asset, story, and article. */
export const socialCounts: Record<string, SocialCounts> = (() => {
  const map: Record<string, SocialCounts> = {}
  for (const a of assets) {
    map[a.id] = getSocialCounts(a.id, a.creatorId)
  }
  for (const s of stories) {
    map[s.id] = getSocialCounts(s.id, s.creatorId)
  }
  for (const a of articles) {
    map[a.id] = getSocialCounts(a.id, a.sourceCreatorIds[0] ?? '')
  }
  return map
})()

/** @deprecated Use socialCounts */
export const mockSocialCounts = socialCounts

// ════════════════════════════════════════════════════════════════
// 4. COMMENTS — 30 hand-authored
// Persona clusters: buyers comment on licensing/provenance;
// external commenters on editorial quality/methodology;
// creators on peer work and cross-regional parallels.
// ════════════════════════════════════════════════════════════════

export const comments: Comment[] = [
  // ── Migrated from mock-data.ts (cmt-001–010) — unchanged ──
  {
    id: 'cmt-001',
    targetType: 'story',
    targetId: 'story-001',
    author: _marcoricci,
    body: 'The aerial footage from Cebu adds significant context to the ground-level reporting. Strong visual sequencing throughout.',
    createdAt: '2026-03-21T08:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-002',
    targetType: 'story',
    targetId: 'story-001',
    author: _ananyagupta,
    body: 'Have you considered pairing this with the IPCC displacement data from last quarter? The Mekong Delta vector map could anchor a cross-regional comparison.',
    createdAt: '2026-03-21T11:15:00Z',
    parentId: null,
  },
  {
    id: 'cmt-003',
    targetType: 'story',
    targetId: 'story-001',
    author: _sarahchen,
    body: 'Good call. I have the IPCC dataset and a few supplementary infographics in draft. Will update the story package next week.',
    createdAt: '2026-03-21T14:00:00Z',
    parentId: 'cmt-002',
  },
  {
    id: 'cmt-004',
    targetType: 'article',
    targetId: 'article-001',
    author: _jamesokafor,
    body: 'This is essential reading. The on-the-ground detail from the Mekong Delta villages is something wire coverage consistently misses.',
    createdAt: '2026-03-20T09:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-005',
    targetType: 'article',
    targetId: 'article-001',
    author: _mariasantos,
    body: 'We licensed three assets from this package for our quarterly climate report. The provenance chain made editorial review straightforward.',
    createdAt: '2026-03-20T16:45:00Z',
    parentId: null,
  },
  {
    id: 'cmt-006',
    targetType: 'article',
    targetId: 'article-001',
    author: _marcoricci,
    body: 'The L4 assembly verification is a real differentiator. Knowing the source imagery is certified end-to-end changes how we can use it.',
    createdAt: '2026-03-21T10:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-007',
    targetType: 'asset',
    targetId: 'asset-001',
    author: _jamesokafor,
    body: 'Strong composition under difficult conditions. The depth of field isolates the action without losing the wider crowd context.',
    createdAt: '2026-03-17T12:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-008',
    targetType: 'asset',
    targetId: 'asset-002',
    author: _ananyagupta,
    body: 'The expression on Minister Li captures the tension perfectly. This frame will age well.',
    createdAt: '2026-03-18T09:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-009',
    targetType: 'asset',
    targetId: 'asset-002',
    author: _marcoricci,
    body: 'We used this alongside a panel shot from the same session. Excellent editorial pairing.',
    createdAt: '2026-03-18T14:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-010',
    targetType: 'story',
    targetId: 'story-003',
    author: _jamesokafor,
    body: 'Important documentation work. The situation at Mae Sot is badly underreported.',
    createdAt: '2026-03-24T08:00:00Z',
    parentId: null,
  },
  // ── New comments (cmt-011–030) ─────────────────────────────
  {
    id: 'cmt-011',
    targetType: 'story',
    targetId: 'story-af-001',
    author: _jamesokafor,
    body: 'The access you secured in Borno is exceptional. ISWAP checkpoint documentation rarely surfaces with this level of verification.',
    createdAt: '2026-03-28T09:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-012',
    targetType: 'story',
    targetId: 'story-af-001',
    author: _mariasantos,
    body: 'Global Report editorial is reviewing this package. The Sahel security series aligns with our Q3 conflict coverage brief.',
    createdAt: '2026-03-28T14:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-013',
    targetType: 'story',
    targetId: 'story-004',
    author: _marcoricci,
    body: 'The checkpoint queue composition is technically strong. Low-light discipline throughout the sequence.',
    createdAt: '2026-03-22T10:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-014',
    targetType: 'story',
    targetId: 'story-004',
    author: _ananyagupta,
    body: 'The infrastructure framing gives this documentary weight beyond the immediate news cycle. Useful for policy analysis contexts.',
    createdAt: '2026-03-22T15:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-015',
    targetType: 'story',
    targetId: 'story-af-001',
    author: _sarahchen,
    body: 'The press restriction documentation here is as important as the displacement coverage itself.',
    createdAt: '2026-03-29T08:15:00Z',
    parentId: null,
  },
  {
    id: 'cmt-016',
    targetType: 'story',
    targetId: 'story-me-001',
    author: _jamesokafor,
    body: 'Covering both Houthi and government-controlled areas consistently is technically demanding. The certification chain holds up.',
    createdAt: '2026-03-26T11:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-017',
    targetType: 'article',
    targetId: 'article-003',
    author: _ananyagupta,
    body: 'The cross-documentation methodology is rigorous. Two independent certifications of the same infrastructure strengthens the evidentiary weight significantly.',
    createdAt: '2026-03-23T09:45:00Z',
    parentId: null,
  },
  {
    id: 'cmt-018',
    targetType: 'asset',
    targetId: 'asset-af-001',
    author: _marcoricci,
    body: 'The framing communicates restricted access without making it literal. Strong editorial instinct.',
    createdAt: '2026-03-27T13:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-019',
    targetType: 'story',
    targetId: 'story-002',
    author: _mariasantos,
    body: 'We are tracking this for EU policy syndication. The Assembleia documentation meets our provenance standards.',
    createdAt: '2026-03-25T10:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-020',
    targetType: 'story',
    targetId: 'story-me-001',
    author: _sarahchen,
    body: 'The cholera documentation sequence here fills a critical gap. Hospital infrastructure collapse documented from inside the facility.',
    createdAt: '2026-03-26T16:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-021',
    targetType: 'article',
    targetId: 'article-002',
    author: _sarahchen,
    body: 'The institutional documentation methodology is transferable. Clean sourcing through the assembly gallery is the right model.',
    createdAt: '2026-03-24T09:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-022',
    targetType: 'asset',
    targetId: 'asset-me-001',
    author: _marcoricci,
    body: 'Hospital interior under conflict conditions. The composition holds despite the access constraints.',
    createdAt: '2026-03-27T10:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-023',
    targetType: 'asset',
    targetId: 'asset-af-010',
    author: _jamesokafor,
    body: 'The arrival sequence preserves individual dignity at scale. Technically and editorially consistent throughout.',
    createdAt: '2026-03-29T11:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-024',
    targetType: 'story',
    targetId: 'story-006',
    author: _ananyagupta,
    body: 'The hospital corridor documentation has methodological parallels with surge-capacity reporting I have done in South Asia. Worth a comparative note.',
    createdAt: '2026-03-23T14:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-025',
    targetType: 'story',
    targetId: 'story-me-001',
    author: _mariasantos,
    body: 'This package is under editorial review for our humanitarian conflict report. The provenance records are complete.',
    createdAt: '2026-03-27T15:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-026',
    targetType: 'story',
    targetId: 'story-004',
    author: _sarahchen,
    body: 'The logistics perspective on EU external borders is consistently underweighted in wire coverage. This adds archival value.',
    createdAt: '2026-03-23T08:30:00Z',
    parentId: null,
  },
  {
    id: 'cmt-027',
    targetType: 'story',
    targetId: 'story-me-002',
    author: _oluwaseunadeyemi,
    body: 'The displacement corridor documentation matches patterns I have documented around Lake Chad. Worth noting the parallel access constraints.',
    createdAt: '2026-03-30T09:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-028',
    targetType: 'story',
    targetId: 'story-011',
    author: _jamesokafor,
    body: 'The settlement infrastructure documentation is thorough. The contrast between formal and informal structures in single frames is effective.',
    createdAt: '2026-03-25T14:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-029',
    targetType: 'asset',
    targetId: 'asset-004',
    author: _marcoricci,
    body: 'Aerial sequencing of the displacement zone. The systematic framing approach works well for evidence documentation.',
    createdAt: '2026-03-22T11:00:00Z',
    parentId: null,
  },
  {
    id: 'cmt-030',
    targetType: 'article',
    targetId: 'article-003',
    author: _mariasantos,
    body: 'The dual-certified approach on asylum processing infrastructure is exactly what our editorial standards require. Under review for licensing.',
    createdAt: '2026-03-24T16:00:00Z',
    parentId: null,
  },
]

/** @deprecated Use comments */
export const mockComments = comments

// ════════════════════════════════════════════════════════════════
// 5. CONVERSATIONS & MESSAGES
// 8 conversations, 26 messages.
// All participants are from socialAuthors.
// The current UI (messages/page.tsx) renders from sarahchen's POV;
// creator-to-creator conversations (conv-005, 007) are in the
// dataset for completeness and future viewer-aware routing.
// ════════════════════════════════════════════════════════════════

export const messages: DirectMessage[] = [
  // ── conv-001: sarahchen ↔ mariasantos (licensing inquiry) ──
  {
    id: 'dm-001',
    conversationId: 'conv-001',
    sender: _sarahchen,
    body: 'Hi Maria. Thank you for your interest in the climate coverage. Happy to discuss terms.',
    createdAt: '2026-03-27T10:00:00Z',
    read: true,
  },
  {
    id: 'dm-002',
    conversationId: 'conv-001',
    sender: _mariasantos,
    body: 'Great. We are particularly interested in the Mekong Delta and Cebu packages. Our editorial team reviewed the provenance records and everything checks out.',
    createdAt: '2026-03-27T15:30:00Z',
    read: true,
  },
  {
    id: 'dm-003',
    conversationId: 'conv-001',
    sender: _mariasantos,
    body: 'We would like to discuss exclusive licensing for the climate collapse series. Can we set up a call this week?',
    createdAt: '2026-03-28T14:20:00Z',
    read: false,
  },
  // ── conv-002: sarahchen ↔ marcoricci (editorial feedback) ──
  {
    id: 'dm-004',
    conversationId: 'conv-002',
    sender: _marcoricci,
    body: 'Sarah, the protest sequence from Hong Kong is exceptional. A few notes on the crop for the lead image.',
    createdAt: '2026-03-24T16:00:00Z',
    read: true,
  },
  {
    id: 'dm-005',
    conversationId: 'conv-002',
    sender: _marcoricci,
    body: 'The tight crop on frame 3 loses the police line in the background. For editorial context, a wider crop would be stronger.',
    createdAt: '2026-03-25T08:45:00Z',
    read: true,
  },
  {
    id: 'dm-006',
    conversationId: 'conv-002',
    sender: _sarahchen,
    body: 'Thanks for the edit notes. I will reshoot the wide establishing shot next visit.',
    createdAt: '2026-03-26T09:15:00Z',
    read: true,
  },
  // ── conv-003: sarahchen ↔ ananyagupta (cross-border piece) ──
  {
    id: 'dm-007',
    conversationId: 'conv-003',
    sender: _sarahchen,
    body: 'Ananya, are you still working on the South Asia displacement piece? I have some overlap from the Myanmar border.',
    createdAt: '2026-03-22T08:30:00Z',
    read: true,
  },
  {
    id: 'dm-008',
    conversationId: 'conv-003',
    sender: _ananyagupta,
    body: 'Yes, wrapping up field work next week. Would be valuable to cross-reference your Mae Sot documentation.',
    createdAt: '2026-03-23T14:00:00Z',
    read: true,
  },
  {
    id: 'dm-009',
    conversationId: 'conv-003',
    sender: _ananyagupta,
    body: 'The cross-border piece is looking strong. Let me know when you publish so I can reference it in mine.',
    createdAt: '2026-03-25T11:40:00Z',
    read: true,
  },
  // ── conv-004: sarahchen ↔ jamesokafor (conflict package) ──
  {
    id: 'dm-010',
    conversationId: 'conv-004',
    sender: _jamesokafor,
    body: 'Sarah, the conflict coverage from the Taiwan Strait package — are any of those assets available for single-issue editorial?',
    createdAt: '2026-03-29T10:00:00Z',
    read: true,
  },
  {
    id: 'dm-011',
    conversationId: 'conv-004',
    sender: _sarahchen,
    body: 'Yes, the tier II certified assets are open for editorial. The tier I series is currently under exclusive review.',
    createdAt: '2026-03-29T12:30:00Z',
    read: true,
  },
  {
    id: 'dm-012',
    conversationId: 'conv-004',
    sender: _jamesokafor,
    body: 'Understood. I will check which tier the aerial documentation falls under. The establishing shots are exactly what we need.',
    createdAt: '2026-03-29T15:00:00Z',
    read: false,
  },
  // ── conv-005: marcooliveira ↔ anasousa (peer collaboration) ──
  {
    id: 'dm-013',
    conversationId: 'conv-005',
    sender: _anasousa,
    body: 'Marco, I saw your Guaíba flood coverage. I have documentation of the Portuguese government flood response — there could be a comparative piece.',
    createdAt: '2026-03-26T09:00:00Z',
    read: true,
  },
  {
    id: 'dm-014',
    conversationId: 'conv-005',
    sender: _marcooliveira,
    body: 'That would be strong. The policy response divergence between Portugal and Brazil on river management is underreported.',
    createdAt: '2026-03-26T14:00:00Z',
    read: true,
  },
  {
    id: 'dm-015',
    conversationId: 'conv-005',
    sender: _anasousa,
    body: 'I can share the assembly session footage if you want to cross-reference the ministerial statements.',
    createdAt: '2026-03-27T09:30:00Z',
    read: true,
  },
  {
    id: 'dm-016',
    conversationId: 'conv-005',
    sender: _marcooliveira,
    body: 'Send it over. I can match it with the Defesa Civil documentation from May.',
    createdAt: '2026-03-27T16:00:00Z',
    read: true,
  },
  // ── conv-006: mariasantos ↔ oluwaseunadeyemi (Sahel licensing) ──
  {
    id: 'dm-017',
    conversationId: 'conv-006',
    sender: _mariasantos,
    body: 'Oluwaseun, Global Report is building a Sahel security series for Q3. Your Borno documentation is exactly the level of verification we need.',
    createdAt: '2026-03-28T10:00:00Z',
    read: true,
  },
  {
    id: 'dm-018',
    conversationId: 'conv-006',
    sender: _oluwaseunadeyemi,
    body: 'Thank you for reaching out. Several assets from the Lake Chad series are available for editorial licensing. I will send the full index.',
    createdAt: '2026-03-28T16:30:00Z',
    read: true,
  },
  {
    id: 'dm-019',
    conversationId: 'conv-006',
    sender: _mariasantos,
    body: 'Please do. We are particularly interested in the checkpoint documentation and the displacement camp arrivals.',
    createdAt: '2026-03-29T09:00:00Z',
    read: false,
  },
  // ── conv-007: yasminalharazi ↔ khalidibrahim (Yemen/Sudan parallels) ──
  {
    id: 'dm-020',
    conversationId: 'conv-007',
    sender: _yasminalharazi,
    body: 'Khalid, the Darfur displacement documentation you published last week — the aid obstruction framing mirrors what I documented at Hodeidah port.',
    createdAt: '2026-03-27T08:00:00Z',
    read: true,
  },
  {
    id: 'dm-021',
    conversationId: 'conv-007',
    sender: _khalidibrahim,
    body: 'Yes, I noticed the parallel. The blockade mechanics differ but the civilian impact documentation has common methodology.',
    createdAt: '2026-03-27T13:00:00Z',
    read: true,
  },
  {
    id: 'dm-022',
    conversationId: 'conv-007',
    sender: _yasminalharazi,
    body: 'Worth flagging to The New Humanitarian. A joint contextual note from two certified sources would carry weight.',
    createdAt: '2026-03-28T08:30:00Z',
    read: true,
  },
  // ── conv-008: mariasantos ↔ marcooliveira (Brazil flood licensing) ──
  {
    id: 'dm-023',
    conversationId: 'conv-008',
    sender: _mariasantos,
    body: 'Marco, we covered your Rio Grande do Sul flood series in our last report. Are the aerial survey assets available for syndication?',
    createdAt: '2026-03-29T10:00:00Z',
    read: true,
  },
  {
    id: 'dm-024',
    conversationId: 'conv-008',
    sender: _marcooliveira,
    body: 'The aerial documentation is certified at tier II. All public assets are available for editorial licensing.',
    createdAt: '2026-03-29T14:00:00Z',
    read: true,
  },
  {
    id: 'dm-025',
    conversationId: 'conv-008',
    sender: _mariasantos,
    body: 'We are interested in the levee breach sequences specifically. Can you confirm the certification timestamps?',
    createdAt: '2026-03-30T09:30:00Z',
    read: true,
  },
  {
    id: 'dm-026',
    conversationId: 'conv-008',
    sender: _marcooliveira,
    body: 'Certification records are all in the provenance chain — timestamps from the Defesa Civil embedded period. I will send the specific asset IDs.',
    createdAt: '2026-03-30T14:00:00Z',
    read: false,
  },
]

export const conversations: Conversation[] = [
  {
    id: 'conv-001',
    participants: [_sarahchen, _mariasantos],
    lastMessage: messages.find(m => m.id === 'dm-003')!,
    unreadCount: 1,
    createdAt: '2026-03-27T10:00:00Z',
  },
  {
    id: 'conv-002',
    participants: [_sarahchen, _marcoricci],
    lastMessage: messages.find(m => m.id === 'dm-006')!,
    unreadCount: 0,
    createdAt: '2026-03-24T16:00:00Z',
  },
  {
    id: 'conv-003',
    participants: [_sarahchen, _ananyagupta],
    lastMessage: messages.find(m => m.id === 'dm-009')!,
    unreadCount: 0,
    createdAt: '2026-03-22T08:30:00Z',
  },
  {
    id: 'conv-004',
    participants: [_sarahchen, _jamesokafor],
    lastMessage: messages.find(m => m.id === 'dm-012')!,
    unreadCount: 1,
    createdAt: '2026-03-29T10:00:00Z',
  },
  {
    id: 'conv-005',
    participants: [_marcooliveira, _anasousa],
    lastMessage: messages.find(m => m.id === 'dm-016')!,
    unreadCount: 0,
    createdAt: '2026-03-26T09:00:00Z',
  },
  {
    id: 'conv-006',
    participants: [_mariasantos, _oluwaseunadeyemi],
    lastMessage: messages.find(m => m.id === 'dm-019')!,
    unreadCount: 1,
    createdAt: '2026-03-28T10:00:00Z',
  },
  {
    id: 'conv-007',
    participants: [_yasminalharazi, _khalidibrahim],
    lastMessage: messages.find(m => m.id === 'dm-022')!,
    unreadCount: 0,
    createdAt: '2026-03-27T08:00:00Z',
  },
  {
    id: 'conv-008',
    participants: [_mariasantos, _marcooliveira],
    lastMessage: messages.find(m => m.id === 'dm-026')!,
    unreadCount: 1,
    createdAt: '2026-03-29T10:00:00Z',
  },
]

/** @deprecated Use conversations */
export const mockConversations = conversations

/** @deprecated Use messages */
export const mockMessages = messages

// ════════════════════════════════════════════════════════════════
// 6. CONNECTION STATE
// ════════════════════════════════════════════════════════════════

/**
 * Static connection state for Sarah Chen's profile view.
 * connections = follower count derived from followGraph.
 */
export const mockConnectionState: ConnectionState = {
  connections: getFollowerCount('sarahchen'),
  isConnected: false,
  isBlocked: false,
}

/**
 * Returns a ConnectionState for any subject as viewed by a given viewer.
 * Used for Phase 4 profile page wiring.
 */
export function getConnectionState(
  viewerUsername: string,
  subjectUsername: string,
): ConnectionState {
  return {
    connections: getFollowerCount(subjectUsername),
    isConnected: isFollowing(viewerUsername, subjectUsername),
    isBlocked: false,
  }
}
