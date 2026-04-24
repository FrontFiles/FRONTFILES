/**
 * Frontfiles — Newsroom licence-class config (NR-D4, F1)
 *
 * Single source of truth for PRD Part 2. Five enumerated licence
 * classes, each with:
 *
 *   - stable id (matches NewsroomLicenceClass string union)
 *   - machine-readable `code` (e.g. FF-PRV-1.0)
 *   - `uri` (licence landing page)
 *   - `humanLabel` (short display label)
 *   - `blurb` (PRD §2.3 verbatim; renders on Pack page, embed
 *     snippet attribution, download receipt terms summary, and
 *     the licence page — one source of truth, no paraphrasing)
 *   - five deterministic permission `flags` per PRD §2.1
 *
 * Pure module. No imports beyond the schema enum type. No I/O.
 */

import type { NewsroomLicenceClass } from '@/lib/db/schema'

export type LicenceUseContext = 'editorial' | 'promotional' | 'any'

export interface LicenceFlags {
  canModify: boolean
  requiresAttribution: boolean
  useContext: LicenceUseContext
  aiTrainingPermitted: boolean
  redistributionPermitted: boolean
}

export interface LicenceClassConfig {
  id: NewsroomLicenceClass
  code: string
  uri: string
  humanLabel: string
  blurb: string
  flags: LicenceFlags
}

export const LICENCE_CLASSES: Readonly<
  Record<NewsroomLicenceClass, LicenceClassConfig>
> = {
  press_release_verbatim: {
    id: 'press_release_verbatim',
    code: 'FF-PRV-1.0',
    uri: 'https://frontfiles.com/licences/press-release-verbatim/1.0',
    humanLabel: 'Press release (verbatim)',
    blurb:
      'Published for reporting. Reproduce the text without modification. Excerpting is permitted when quoted accurately for news reporting or commentary. Translation is permitted when faithful and marked as a translation. Credit the source as shown.',
    flags: {
      canModify: false,
      requiresAttribution: true,
      useContext: 'editorial',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    },
  },

  editorial_use_only: {
    id: 'editorial_use_only',
    code: 'FF-EDU-1.0',
    uri: 'https://frontfiles.com/licences/editorial-use-only/1.0',
    humanLabel: 'Editorial use only',
    blurb:
      'Use in news reporting, commentary, or review. Credit the source. Do not alter the asset. Not for advertising, sponsored content, native advertising, advertorial, or branded content.',
    flags: {
      canModify: false,
      requiresAttribution: true,
      useContext: 'editorial',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    },
  },

  promotional_use: {
    id: 'promotional_use',
    code: 'FF-PROMO-1.0',
    uri: 'https://frontfiles.com/licences/promotional-use/1.0',
    humanLabel: 'Promotional use',
    blurb:
      'Use in editorial or promotional contexts. Credit the source. Do not alter the asset.',
    flags: {
      canModify: false,
      requiresAttribution: true,
      useContext: 'any',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    },
  },

  cc_attribution: {
    id: 'cc_attribution',
    code: 'CC-BY-4.0',
    uri: 'https://creativecommons.org/licenses/by/4.0/',
    humanLabel: 'CC Attribution 4.0',
    blurb:
      'Use, adapt, and redistribute for any purpose, including commercial. Credit the creator as shown. Full terms: creativecommons.org/licenses/by/4.0/',
    flags: {
      canModify: true,
      requiresAttribution: true,
      useContext: 'any',
      aiTrainingPermitted: true,
      redistributionPermitted: true,
    },
  },

  cc_public_domain: {
    id: 'cc_public_domain',
    code: 'CC0-1.0',
    uri: 'https://creativecommons.org/publicdomain/zero/1.0/',
    humanLabel: 'CC0 Public Domain',
    blurb:
      'No rights reserved. Use, adapt, and redistribute freely. Attribution appreciated, not required. Full terms: creativecommons.org/publicdomain/zero/1.0/',
    flags: {
      canModify: true,
      requiresAttribution: false,
      useContext: 'any',
      aiTrainingPermitted: true,
      redistributionPermitted: true,
    },
  },
} as const

export function getLicenceClass(
  id: NewsroomLicenceClass,
): LicenceClassConfig {
  return LICENCE_CLASSES[id]
}

// True for the three proprietary FF-* classes, false for the two
// CC classes. Used by the Build Charter §3.5 fallback path where
// FF-* classes are flagged-disabled until counsel sign-off.
export function isFFLicenceClass(id: NewsroomLicenceClass): boolean {
  return (
    id === 'press_release_verbatim' ||
    id === 'editorial_use_only' ||
    id === 'promotional_use'
  )
}
