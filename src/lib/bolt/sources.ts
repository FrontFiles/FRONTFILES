/**
 * BOLT — Fractal News Source Registry
 *
 * 4-tier trusted source architecture for the Frontfiles corroboration
 * mission. The agent prioritizes the "Local Lens" over the "Global Echo":
 * a corroborating report from a credible local outlet (Tier 3-4) carries
 * HIGHER metadata weight than a generic summary from a global outlet.
 *
 * Tier 1: Global Ground Truth Agencies — wire services, global broadcasters
 * Tier 2: Regional Giants — quality national/regional outlets
 * Tier 3: Local & Investigative — GIJN members, OCCRP, exiled media
 * Tier 4: Humanitarian & Crisis Specialist — OSINT, UN, crisis reporting
 */

import type { BoltTier } from './types'

export interface TrustedSource {
  name: string
  domain: string
  tier: BoltTier
  region?: string
  language: string
  category: 'wire' | 'broadcaster' | 'national' | 'regional' | 'investigative' | 'humanitarian' | 'osint' | 'local'
}

// ═══════════════════════════════════════════════
// TIER 1 — Global Ground Truth Agencies
// ═══════════════════════════════════════════════

const TIER_1: TrustedSource[] = [
  { name: 'Reuters', domain: 'reuters.com', tier: 1, language: 'en', category: 'wire' },
  { name: 'Associated Press', domain: 'apnews.com', tier: 1, language: 'en', category: 'wire' },
  { name: 'Agence France-Presse', domain: 'france24.com', tier: 1, language: 'en', category: 'wire' },
  { name: 'BBC News', domain: 'bbc.com', tier: 1, language: 'en', category: 'broadcaster' },
  { name: 'Deutsche Presse-Agentur', domain: 'dw.com', tier: 1, language: 'en', category: 'wire' },
  { name: 'Al Jazeera', domain: 'aljazeera.com', tier: 1, language: 'en', category: 'broadcaster' },
]

// ═══════════════════════════════════════════════
// TIER 2 — Regional Giants
// ═══════════════════════════════════════════════

const TIER_2: TrustedSource[] = [
  { name: 'The Guardian', domain: 'theguardian.com', tier: 2, region: 'GB', language: 'en', category: 'national' },
  { name: 'Le Monde', domain: 'lemonde.fr', tier: 2, region: 'FR', language: 'fr', category: 'national' },
  { name: 'El País', domain: 'elpais.com', tier: 2, region: 'ES', language: 'es', category: 'national' },
  { name: 'Folha de S.Paulo', domain: 'folha.uol.com.br', tier: 2, region: 'BR', language: 'pt', category: 'national' },
  { name: 'Agência Brasil', domain: 'agenciabrasil.ebc.com.br', tier: 2, region: 'BR', language: 'pt', category: 'national' },
  { name: 'The Hindu', domain: 'thehindu.com', tier: 2, region: 'IN', language: 'en', category: 'national' },
  { name: 'NHK World', domain: 'www3.nhk.or.jp', tier: 2, region: 'JP', language: 'en', category: 'broadcaster' },
  { name: 'Público', domain: 'publico.pt', tier: 2, region: 'PT', language: 'pt', category: 'national' },
  { name: 'EFE', domain: 'efe.com', tier: 2, region: 'ES', language: 'es', category: 'wire' },
  { name: 'Kyodo News', domain: 'english.kyodonews.net', tier: 2, region: 'JP', language: 'en', category: 'wire' },
]

// ═══════════════════════════════════════════════
// TIER 3 — Local & Investigative
// ═══════════════════════════════════════════════

const TIER_3: TrustedSource[] = [
  { name: 'OCCRP', domain: 'occrp.org', tier: 3, language: 'en', category: 'investigative' },
  { name: 'Bellingcat', domain: 'bellingcat.com', tier: 3, language: 'en', category: 'osint' },
  { name: 'GIJN', domain: 'gijn.org', tier: 3, language: 'en', category: 'investigative' },
  { name: 'Forbidden Stories', domain: 'forbiddenstories.org', tier: 3, language: 'en', category: 'investigative' },
  { name: 'The Bureau of Investigative Journalism', domain: 'thebureauinvestigates.com', tier: 3, region: 'GB', language: 'en', category: 'investigative' },
  { name: 'Meduza', domain: 'meduza.io', tier: 3, region: 'RU', language: 'en', category: 'investigative' },
  { name: 'Iran International', domain: 'iranintl.com', tier: 3, region: 'IR', language: 'en', category: 'investigative' },
  { name: 'Rappler', domain: 'rappler.com', tier: 3, region: 'PH', language: 'en', category: 'investigative' },
  { name: 'Mediapart', domain: 'mediapart.fr', tier: 3, region: 'FR', language: 'fr', category: 'investigative' },
]

// ═══════════════════════════════════════════════
// TIER 4 — Humanitarian & Crisis Specialist
// ═══════════════════════════════════════════════

const TIER_4: TrustedSource[] = [
  { name: 'The New Humanitarian', domain: 'thenewhumanitarian.org', tier: 4, language: 'en', category: 'humanitarian' },
  { name: 'ReliefWeb', domain: 'reliefweb.int', tier: 4, language: 'en', category: 'humanitarian' },
  { name: 'PesaCheck', domain: 'pesacheck.org', tier: 4, region: 'KE', language: 'en', category: 'osint' },
  { name: 'Africa Check', domain: 'africacheck.org', tier: 4, region: 'ZA', language: 'en', category: 'osint' },
  { name: 'Climate Home News', domain: 'climatechangenews.com', tier: 4, language: 'en', category: 'humanitarian' },
  { name: 'Mongabay', domain: 'mongabay.com', tier: 4, language: 'en', category: 'humanitarian' },
]

// ═══════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════

export const TRUSTED_SOURCES: TrustedSource[] = [
  ...TIER_1, ...TIER_2, ...TIER_3, ...TIER_4,
]

export const DOMAIN_ALLOW_LIST: string[] = TRUSTED_SOURCES.map(s => s.domain)

export function getSourcesForTier(tier: BoltTier): TrustedSource[] {
  return TRUSTED_SOURCES.filter(s => s.tier === tier)
}

export function getSourcesByRegion(region: string): TrustedSource[] {
  return TRUSTED_SOURCES.filter(s => s.region === region)
}

export function resolvePublisher(url: string): TrustedSource | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return TRUSTED_SOURCES.find(s => hostname.includes(s.domain.replace('www.', ''))) ?? null
  } catch {
    return null
  }
}

/**
 * Build domain filter strings for search queries, grouped by tier.
 * Returns `site:reuters.com OR site:apnews.com OR ...` style strings.
 */
export function buildDomainFilter(tier: BoltTier): string {
  return getSourcesForTier(tier)
    .map(s => `site:${s.domain}`)
    .join(' OR ')
}

/**
 * Inverse weighting score: local/specialist sources score higher
 * than global wires for corroboration purposes.
 *
 * Tier 4 (humanitarian/OSINT) = +40
 * Tier 3 (investigative/local) = +30
 * Tier 2 (regional) = +20
 * Tier 1 (global wires) = +10
 */
export function tierWeight(tier: BoltTier): number {
  return (5 - tier) * 10
}
