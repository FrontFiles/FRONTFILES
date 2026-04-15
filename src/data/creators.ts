// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Creator Discovery Cards (derived)
//
// Phase A: the identity-carrying fields (id, name, slug,
// locationBase, regionsCovered, specialties, bio, trustBadge,
// avatarRef) are now derived from the canonical `userSeed`
// (see `data/users.ts`). Only the non-DB display decorations
// (`languages`, `frontfolioSummary`, `featuredStoryIds`,
// `featuredAssetIds`) live here, keyed by user id.
//
// The `Creator` interface and the `creators` / `creatorMap` /
// `creatorBySlug` exports are preserved so every consumer
// (messages, share metadata, search index, creator-content
// adapter, profiles) keeps working unchanged.
// ═══════════════════════════════════════════════════════════════

import { userSeed } from './users'
import type { UserSeed } from '@/lib/identity/types'
import type { TrustBadge } from '@/lib/types'

export interface Creator {
  id: string
  name: string
  slug: string
  locationBase: string
  regionsCovered: string[]
  specialties: string[]
  bio: string
  trustBadge: TrustBadge
  languages: string[]
  avatarRef: string
  frontfolioSummary: string
  featuredStoryIds: string[]
  featuredAssetIds: string[]
}

// ── Display-only decorations ───────────────────────────────────
//
// These four fields are intentionally NOT in the canonical
// `creator_profiles` row — they are discovery-card display
// metadata. The identity store does not own them; this file
// does.

interface CreatorDecoration {
  languages: string[]
  frontfolioSummary: string
  featuredStoryIds: string[]
  featuredAssetIds: string[]
}

const _decorations: Record<string, CreatorDecoration> = {
  'creator-001': {
    languages: ['Portuguese', 'Spanish', 'English'],
    frontfolioSummary:
      '47 certified assets across 6 Stories. Primary coverage: flood displacement and informal settlement disputes in Rio Grande do Sul.',
    featuredStoryIds: ['story-001', 'story-011'],
    featuredAssetIds: ['asset-001', 'asset-004', 'asset-043'],
  },
  'creator-002': {
    languages: ['Portuguese', 'English', 'French'],
    frontfolioSummary:
      '38 certified assets across 4 Stories. Primary coverage: parliamentary sessions, coastal erosion, and storm damage in central Portugal.',
    featuredStoryIds: ['story-002', 'story-003', 'story-014'],
    featuredAssetIds: ['asset-006', 'asset-010', 'asset-046'],
  },
  'creator-003': {
    languages: ['Greek', 'English', 'Turkish'],
    frontfolioSummary:
      '29 certified assets across 3 Stories. Primary coverage: border crossing logistics and asylum infrastructure at Evros.',
    featuredStoryIds: ['story-004'],
    featuredAssetIds: ['asset-013', 'asset-015'],
  },
  'creator-004': {
    languages: ['Italian', 'English'],
    frontfolioSummary:
      '34 certified assets across 3 Stories. Primary coverage: court proceedings, police misconduct cases, and coastal livelihoods in Sicily.',
    featuredStoryIds: ['story-010'],
    featuredAssetIds: ['asset-034', 'asset-036'],
  },
  'creator-005': {
    languages: ['French', 'Arabic', 'English'],
    frontfolioSummary:
      '31 certified assets across 3 Stories. Primary coverage: hospital overload during heat events and port congestion in Marseille.',
    featuredStoryIds: ['story-006', 'story-012'],
    featuredAssetIds: ['asset-020', 'asset-022'],
  },
  'creator-006': {
    languages: ['Polish', 'English', 'German'],
    frontfolioSummary:
      '26 certified assets across 3 Stories. Primary coverage: transit strikes, election rally logistics, and labor disputes in Warsaw and Łódź.',
    featuredStoryIds: ['story-007', 'story-013'],
    featuredAssetIds: ['asset-025', 'asset-029'],
  },
  'creator-007': {
    languages: ['Romanian', 'English', 'French'],
    frontfolioSummary:
      '22 certified assets across 2 Stories. Primary coverage: student protests and education policy disputes in Bucharest.',
    featuredStoryIds: ['story-008'],
    featuredAssetIds: ['asset-030', 'asset-031'],
  },
  'creator-008': {
    languages: ['Spanish', 'English', 'Portuguese'],
    frontfolioSummary:
      '19 certified assets across 2 Stories. Primary coverage: wildfire aftermath and drought response in Andalusia using data visualization and infographic formats.',
    featuredStoryIds: ['story-005', 'story-009'],
    featuredAssetIds: ['asset-017', 'asset-033'],
  },
  'creator-009': {
    languages: ['Greek', 'English'],
    frontfolioSummary:
      '15 certified assets across 2 Stories. Primary coverage: asylum processing facilities and humanitarian aid distribution in Evros and Thessaloniki.',
    featuredStoryIds: ['story-004'],
    featuredAssetIds: ['asset-016'],
  },
  'creator-010': {
    languages: ['English', 'Mandarin', 'Cantonese'],
    frontfolioSummary:
      '33 certified assets across 3 Stories. Primary coverage: climate collapse, semiconductor industry, and press freedom in Asia Pacific.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-115', 'asset-116'],
  },
  'creator-011': {
    languages: ['English', 'Twi', 'Ga'],
    frontfolioSummary:
      '24 certified assets across 3 Stories. Primary coverage: elections and mining in Ghana.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-059', 'asset-061'],
  },
  'creator-012': {
    languages: ['Hindi', 'English', 'Marathi'],
    frontfolioSummary:
      '28 certified assets across 3 Stories. Primary coverage: monsoon displacement in Mumbai.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-063', 'asset-065'],
  },
  'creator-013': {
    languages: ['Arabic', 'English', 'French'],
    frontfolioSummary:
      '32 certified assets across 4 Stories. Primary coverage: refugee infrastructure and water scarcity.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-075', 'asset-079'],
  },
  'creator-014': {
    languages: ['Swedish', 'English', 'Norwegian'],
    frontfolioSummary:
      '18 certified assets across 2 Stories. Primary coverage: energy transition in Sweden.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-122', 'asset-124'],
  },
  'creator-015': {
    languages: ['Japanese', 'English'],
    frontfolioSummary:
      '21 certified assets across 2 Stories. Primary coverage: disaster preparedness in Japan.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-129', 'asset-131'],
  },
  'creator-016': {
    languages: ['Spanish', 'English', 'Nahuatl'],
    frontfolioSummary:
      '27 certified assets across 3 Stories. Primary coverage: indigenous rights in southern Mexico.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-088', 'asset-114'],
  },
  'creator-017': {
    languages: ['Swahili', 'English', 'French'],
    frontfolioSummary:
      '19 certified assets across 2 Stories. Primary coverage: climate displacement in East Africa.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-089', 'asset-090'],
  },
  'creator-018': {
    languages: ['English'],
    frontfolioSummary:
      '23 certified assets across 3 Stories. Primary coverage: environmental crisis in eastern Australia.',
    featuredStoryIds: [],
    featuredAssetIds: ['asset-092', 'asset-094'],
  },
  'creator-019': {
    languages: ['English', 'Hausa', 'Yoruba'],
    frontfolioSummary:
      '31 certified assets across 3 Stories. Primary coverage: conflict displacement in Borno and Lake Chad basin.',
    featuredStoryIds: ['story-af-001'],
    featuredAssetIds: ['asset-af-001', 'asset-af-003'],
  },
  'creator-020': {
    languages: ['French', 'Bambara', 'English'],
    frontfolioSummary:
      '24 certified assets across 2 Stories. Primary coverage: Sahel coup cycle and civilian impact.',
    featuredStoryIds: ['story-af-002'],
    featuredAssetIds: ['asset-af-006', 'asset-af-007'],
  },
  'creator-021': {
    languages: ['Somali', 'Arabic', 'English'],
    frontfolioSummary:
      '28 certified assets across 3 Stories. Primary coverage: displacement and famine response in southern Somalia.',
    featuredStoryIds: ['story-af-003'],
    featuredAssetIds: ['asset-af-010', 'asset-af-011'],
  },
  'creator-022': {
    languages: ['Arabic', 'English'],
    frontfolioSummary:
      '35 certified assets across 3 Stories. Primary coverage: Yemen humanitarian crisis and civilian infrastructure collapse.',
    featuredStoryIds: ['story-me-001'],
    featuredAssetIds: ['asset-me-001', 'asset-me-003'],
  },
  'creator-023': {
    languages: ['Amharic', 'Tigrinya', 'English'],
    frontfolioSummary:
      '22 certified assets across 2 Stories. Primary coverage: Ethiopia post-Tigray recovery and Oromia displacement.',
    featuredStoryIds: ['story-af-004'],
    featuredAssetIds: ['asset-af-016', 'asset-af-017'],
  },
  'creator-024': {
    languages: ['Arabic', 'English'],
    frontfolioSummary:
      '30 certified assets across 2 Stories. Primary coverage: Sudan civil war displacement and humanitarian access.',
    featuredStoryIds: ['story-me-002'],
    featuredAssetIds: ['asset-me-006', 'asset-me-007'],
  },
}

// ── Derivation from userSeed ───────────────────────────────────

function toCreator(seed: UserSeed): Creator | null {
  const profile = seed.creatorProfile
  if (!profile) return null
  const deco = _decorations[seed.user.id]
  if (!deco) {
    // A seed without a decoration would produce an incomplete
    // discovery card. Surface this loudly in dev so a new
    // creator cannot be seeded without its display metadata.
    throw new Error(
      `data/creators.ts: missing decoration for creator '${seed.user.id}'. ` +
        `Add an entry to the _decorations map.`,
    )
  }
  return {
    id: seed.user.id,
    name: seed.user.display_name,
    slug: seed.user.username,
    locationBase: profile.location_base ?? '',
    regionsCovered: profile.coverage_areas,
    specialties: profile.specialisations,
    bio: profile.biography ?? '',
    trustBadge: profile.trust_badge,
    languages: deco.languages,
    avatarRef: seed.user.avatar_url ?? '',
    frontfolioSummary: deco.frontfolioSummary,
    featuredStoryIds: deco.featuredStoryIds,
    featuredAssetIds: deco.featuredAssetIds,
  }
}

/**
 * Ordered list of creators, derived from the canonical
 * `userSeed`. Order matches the legacy hardcoded array
 * (numerical: creator-001 → creator-024) so any downstream
 * indexing or "first creator" heuristics continue to
 * produce the same result.
 */
export const creators: Creator[] = (() => {
  const out: Creator[] = []
  const seen = new Set<string>()
  // Numerical order (001–024) first
  const order = Array.from({ length: 24 }, (_, i) =>
    `creator-${String(i + 1).padStart(3, '0')}`,
  )
  const byId: Record<string, Creator> = {}
  for (const seed of userSeed) {
    const c = toCreator(seed)
    if (c) byId[seed.user.id] = c
  }
  for (const id of order) {
    const c = byId[id]
    if (c) {
      out.push(c)
      seen.add(id)
    }
  }
  // Any extras (defensive — should be empty given the seed)
  for (const id of Object.keys(byId)) {
    if (!seen.has(id)) out.push(byId[id])
  }
  return out
})()

export const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]))
export const creatorBySlug = Object.fromEntries(
  creators.map((c) => [c.slug, c]),
)
