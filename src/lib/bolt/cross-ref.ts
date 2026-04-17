/**
 * BOLT — Vault Cross-Reference Engine
 *
 * Matches external BOLT source articles against vault assets
 * by geography + keyword overlap. When a Reuters article about
 * Porto Alegre floods matches 3 vault assets from the same region,
 * we surface that connection.
 *
 * Lightweight: runs in-memory against existing asset data.
 */

import type { BoltSource } from './types'
import { searchableAssets, type AssetData } from '@/data/assets'
import { geographyMap } from '@/data/geographies'

export interface VaultMatch {
  sourceId: string
  assetIds: string[]
  matchScore: number
  matchReason: string
}

/**
 * Cross-reference BOLT sources against vault assets.
 * Returns matches where external articles cover the same
 * events/regions as vault content.
 */
export function crossRefWithVault(sources: BoltSource[]): VaultMatch[] {
  const matches: VaultMatch[] = []

  for (const source of sources) {
    const sourceTerms = extractTerms(source.title + ' ' + (source.excerpt ?? ''))
    const sourceRegion = source.region?.toLowerCase()

    const matchedAssets: { id: string; score: number }[] = []

    for (const asset of searchableAssets) {
      let score = 0

      // Geography match: source region overlaps asset geography
      if (sourceRegion && asset.geography) {
        const geo = geographyMap[asset.geography]
        if (geo) {
          const geoLabel = geo.locationLabel?.toLowerCase() ?? ''
          const geoCountry = geo.country?.toLowerCase() ?? ''
          if (geoCountry.includes(sourceRegion) || sourceRegion.includes(geoCountry)) {
            score += 20
          }
          // Check if geo label matches source region text
          if (sourceRegion === 'br' && geoLabel.includes('brazil')) score += 15
          if (sourceRegion === 'pt' && geoLabel.includes('portugal')) score += 15
          if (sourceRegion === 'gr' && geoLabel.includes('greece')) score += 15
        }
      }

      // Keyword overlap: source terms match asset tags, title, description
      const assetTerms = [
        ...asset.tags,
        ...asset.title.toLowerCase().split(/\s+/),
        ...asset.locationLabel.toLowerCase().split(/\s+/),
      ]
      let keywordHits = 0
      for (const term of sourceTerms) {
        if (assetTerms.some(at => at.includes(term) || term.includes(at))) {
          keywordHits++
        }
      }
      score += keywordHits * 5

      if (score >= 15) {
        matchedAssets.push({ id: asset.id, score })
      }
    }

    if (matchedAssets.length > 0) {
      // Sort by score, take top 5
      matchedAssets.sort((a, b) => b.score - a.score)
      const topAssets = matchedAssets.slice(0, 5)
      const avgScore = topAssets.reduce((s, a) => s + a.score, 0) / topAssets.length

      matches.push({
        sourceId: source.id,
        assetIds: topAssets.map(a => a.id),
        matchScore: Math.round(avgScore),
        matchReason: buildMatchReason(topAssets.length, source),
      })
    }
  }

  return matches
}

function extractTerms(text: string): string[] {
  return text.toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length > 3)
}

function buildMatchReason(count: number, source: BoltSource): string {
  return `${count} vault asset${count === 1 ? '' : 's'} cover${count === 1 ? 's' : ''} the same ${source.region ? 'region' : 'topic'} as this ${source.publisher} report`
}
