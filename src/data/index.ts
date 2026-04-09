// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Data Barrel Export
// Central import point for all mock seed data
// ═══════════════════════════════════════════════════════════════

// Core entities
export { creators, creatorMap, creatorBySlug } from './creators'
export type { Creator } from './creators'

export { stories, storyMap, storyBySlug } from './stories'
export type { StoryData } from './stories'

export { assets, publicAssets, searchableAssets, spotlightAssets, curatedAssets, assetMap } from './assets'
export type { AssetData, AssetFormat, PrivacyLevel, ValidationDeclaration } from './assets'

export { articles, articleMap, articleBySlug } from './articles'
export type { ArticleData } from './articles'

// Reference data
export { geographies, geographyMap } from './geographies'
export type { Geography } from './geographies'

export { tags, tagMap, tagsByLabel } from './tags'
export type { Tag } from './tags'

// Discovery systems
export { savedSearches, savedSearchMap } from './searches'
export type { SavedSearchData } from './searches'

export { recommendations, recommendationMap, getRecommendationsFor, getRecommendationsByType } from './recommendations'
export type { RecommendationGroup, RecommendationModuleType } from './recommendations'

export { curatedSelections, curatedMap } from './curated'
export type { CuratedSelection } from './curated'

export { spotlightItems, spotlightRanked } from './spotlight'
export type { SpotlightItem } from './spotlight'

export { lightboxes, lightboxMap } from './lightbox'
export type { LightboxData } from './lightbox'

// ═══════════════════════════════════════════════════════════════
// Utility: resolve any object ID to its entity
// ═══════════════════════════════════════════════════════════════
import { assetMap } from './assets'
import { storyMap } from './stories'
import { articleMap } from './articles'

export function resolveObject(objectType: 'asset' | 'story' | 'article', objectId: string) {
  switch (objectType) {
    case 'asset': return assetMap[objectId] ?? null
    case 'story': return storyMap[objectId] ?? null
    case 'article': return articleMap[objectId] ?? null
    default: return null
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary stats (for landing page and dashboard use)
// ═══════════════════════════════════════════════════════════════
import { publicAssets } from './assets'
import { stories } from './stories'
import { creators } from './creators'
import { articles } from './articles'

export const platformStats = {
  certifiedAssets: publicAssets.length,
  activeStories: stories.length,
  verifiedCreators: creators.length,
  publishedArticles: articles.length,
}
