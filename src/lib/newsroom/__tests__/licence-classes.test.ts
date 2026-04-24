/**
 * Frontfiles — licence-classes.ts unit tests (NR-D4, T1)
 *
 * Covers presence of all five classes, per-class flag shape
 * (PRD §2.1), machine-readable metadata (code + uri, PRD §2.4),
 * blurb spot-checks (PRD §2.3 verbatim sentinels), and helper
 * behaviour (getLicenceClass, isFFLicenceClass).
 */

import { describe, expect, it } from 'vitest'

import type { NewsroomLicenceClass } from '@/lib/db/schema'
import {
  getLicenceClass,
  isFFLicenceClass,
  LICENCE_CLASSES,
} from '@/lib/newsroom/licence-classes'

const ALL_IDS: NewsroomLicenceClass[] = [
  'press_release_verbatim',
  'editorial_use_only',
  'promotional_use',
  'cc_attribution',
  'cc_public_domain',
]

describe('LICENCE_CLASSES presence and shape', () => {
  it('includes all five enumerated classes', () => {
    expect(Object.keys(LICENCE_CLASSES).sort()).toEqual(
      [...ALL_IDS].sort(),
    )
  })

  it.each(ALL_IDS)(
    '%s has non-empty code, uri, humanLabel, and blurb',
    (id) => {
      const c = LICENCE_CLASSES[id]
      expect(c.id).toBe(id)
      expect(c.code.length).toBeGreaterThan(0)
      expect(c.uri.length).toBeGreaterThan(0)
      expect(c.uri).toMatch(/^https:\/\//)
      expect(c.humanLabel.length).toBeGreaterThan(0)
      expect(c.blurb.length).toBeGreaterThan(0)
    },
  )
})

describe('per-class flag shape (PRD §2.1)', () => {
  it('press_release_verbatim: false, true, editorial, false, true', () => {
    expect(LICENCE_CLASSES.press_release_verbatim.flags).toEqual({
      canModify: false,
      requiresAttribution: true,
      useContext: 'editorial',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    })
  })

  it('editorial_use_only: false, true, editorial, false, true', () => {
    expect(LICENCE_CLASSES.editorial_use_only.flags).toEqual({
      canModify: false,
      requiresAttribution: true,
      useContext: 'editorial',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    })
  })

  it('promotional_use: false, true, any, false, true', () => {
    expect(LICENCE_CLASSES.promotional_use.flags).toEqual({
      canModify: false,
      requiresAttribution: true,
      useContext: 'any',
      aiTrainingPermitted: false,
      redistributionPermitted: true,
    })
  })

  it('cc_attribution: true, true, any, true, true', () => {
    expect(LICENCE_CLASSES.cc_attribution.flags).toEqual({
      canModify: true,
      requiresAttribution: true,
      useContext: 'any',
      aiTrainingPermitted: true,
      redistributionPermitted: true,
    })
  })

  it('cc_public_domain: true, false, any, true, true', () => {
    expect(LICENCE_CLASSES.cc_public_domain.flags).toEqual({
      canModify: true,
      requiresAttribution: false,
      useContext: 'any',
      aiTrainingPermitted: true,
      redistributionPermitted: true,
    })
  })
})

describe('machine-readable metadata (PRD §2.4)', () => {
  it('press_release_verbatim → FF-PRV-1.0', () => {
    const c = LICENCE_CLASSES.press_release_verbatim
    expect(c.code).toBe('FF-PRV-1.0')
    expect(c.uri).toBe(
      'https://frontfiles.com/licences/press-release-verbatim/1.0',
    )
  })

  it('editorial_use_only → FF-EDU-1.0', () => {
    const c = LICENCE_CLASSES.editorial_use_only
    expect(c.code).toBe('FF-EDU-1.0')
    expect(c.uri).toBe(
      'https://frontfiles.com/licences/editorial-use-only/1.0',
    )
  })

  it('promotional_use → FF-PROMO-1.0', () => {
    const c = LICENCE_CLASSES.promotional_use
    expect(c.code).toBe('FF-PROMO-1.0')
    expect(c.uri).toBe(
      'https://frontfiles.com/licences/promotional-use/1.0',
    )
  })

  it('cc_attribution → CC-BY-4.0', () => {
    const c = LICENCE_CLASSES.cc_attribution
    expect(c.code).toBe('CC-BY-4.0')
    expect(c.uri).toBe('https://creativecommons.org/licenses/by/4.0/')
  })

  it('cc_public_domain → CC0-1.0', () => {
    const c = LICENCE_CLASSES.cc_public_domain
    expect(c.code).toBe('CC0-1.0')
    expect(c.uri).toBe(
      'https://creativecommons.org/publicdomain/zero/1.0/',
    )
  })
})

describe('blurb spot-checks (PRD §2.3 verbatim sentinels)', () => {
  it('press_release_verbatim blurb starts with "Published for reporting."', () => {
    expect(LICENCE_CLASSES.press_release_verbatim.blurb).toMatch(
      /^Published for reporting\./,
    )
  })

  it('cc_public_domain blurb starts with "No rights reserved."', () => {
    expect(LICENCE_CLASSES.cc_public_domain.blurb).toMatch(
      /^No rights reserved\./,
    )
  })

  it('editorial_use_only blurb contains the sponsored-content exclusion', () => {
    expect(LICENCE_CLASSES.editorial_use_only.blurb).toContain(
      'Not for advertising, sponsored content, native advertising, advertorial, or branded content.',
    )
  })
})

describe('getLicenceClass', () => {
  it.each(ALL_IDS)('returns the config for %s', (id) => {
    expect(getLicenceClass(id)).toBe(LICENCE_CLASSES[id])
  })
})

describe('isFFLicenceClass', () => {
  it('returns true for the three FF-* classes', () => {
    expect(isFFLicenceClass('press_release_verbatim')).toBe(true)
    expect(isFFLicenceClass('editorial_use_only')).toBe(true)
    expect(isFFLicenceClass('promotional_use')).toBe(true)
  })

  it('returns false for the two CC classes', () => {
    expect(isFFLicenceClass('cc_attribution')).toBe(false)
    expect(isFFLicenceClass('cc_public_domain')).toBe(false)
  })
})
