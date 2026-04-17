import { describe, it, expect } from 'vitest'
import {
  getApprovedProfile,
  getProfilesForLevel,
  getAllSeedProfiles,
  getMissingApprovedProfiles,
} from '../profiles'
import type { WatermarkIntrusionLevel, TemplateFamily } from '../types'

describe('getApprovedProfile', () => {
  it('returns a profile for each valid (level, family) pair', () => {
    const levels: WatermarkIntrusionLevel[] = ['light', 'standard', 'heavy']
    const families: TemplateFamily[] = ['portrait', 'landscape']

    for (const level of levels) {
      for (const family of families) {
        const profile = getApprovedProfile(level, family)
        expect(profile).not.toBeNull()
        expect(profile!.intrusionLevel).toBe(level)
        expect(profile!.templateFamily).toBe(family)
      }
    }
  })

  it('seed profiles are all draft (not approved)', () => {
    const profile = getApprovedProfile('standard', 'landscape')
    expect(profile).not.toBeNull()
    expect(profile!.approvalStatus).toBe('draft')
    expect(profile!.approvedBy).toBeNull()
    expect(profile!.approvedAt).toBeNull()
  })

  it('returns null for invalid combinations', () => {
    // @ts-expect-error — testing invalid input
    const profile = getApprovedProfile('invalid', 'portrait')
    expect(profile).toBeNull()
  })
})

describe('getProfilesForLevel', () => {
  it('returns both families for each level', () => {
    const profiles = getProfilesForLevel('standard')
    expect(profiles).toHaveLength(2)
    const families = profiles.map(p => p.templateFamily).sort()
    expect(families).toEqual(['landscape', 'portrait'])
  })

  it('heavy profiles have scatter config', () => {
    const profiles = getProfilesForLevel('heavy')
    for (const profile of profiles) {
      expect(profile.scatterConfig).not.toBeNull()
      expect(profile.scatterConfig!.density).toBeGreaterThan(0)
      expect(profile.scatterConfig!.opacity).toBeGreaterThan(0)
      expect(profile.scatterConfig!.opacity).toBeLessThanOrEqual(1)
    }
  })

  it('light and standard profiles have no scatter config', () => {
    for (const level of ['light', 'standard'] as const) {
      const profiles = getProfilesForLevel(level)
      for (const profile of profiles) {
        expect(profile.scatterConfig).toBeNull()
      }
    }
  })
})

describe('getAllSeedProfiles', () => {
  it('returns exactly 6 profiles (3 levels x 2 families)', () => {
    expect(getAllSeedProfiles()).toHaveLength(6)
  })

  it('all profiles are version 1', () => {
    for (const profile of getAllSeedProfiles()) {
      expect(profile.version).toBe(1)
    }
  })

  it('bar width ratio is consistent across all profiles', () => {
    for (const profile of getAllSeedProfiles()) {
      expect(profile.barWidthRatio).toBe(0.06)
    }
  })
})

describe('getMissingApprovedProfiles', () => {
  it('all 6 combinations are missing (seed profiles are draft)', () => {
    const missing = getMissingApprovedProfiles()
    expect(missing).toHaveLength(6)
  })
})
