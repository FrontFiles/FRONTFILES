/**
 * Frontfiles — invariants.ts unit tests (NR-D4, T5)
 *
 * Covers precondition evaluation for the eight publish-readiness
 * fields per PRD §3.3: title, credit_line, licence_class, ≥1
 * asset, all scans clean, alt text on images, rights warranty,
 * schedule validity for each of the three schedule shapes.
 */

import { describe, expect, it } from 'vitest'

import type { PackPublishInput } from '@/lib/newsroom/invariants'
import {
  blockingPreconditions,
  checkPublishPreconditions,
  isPublishable,
} from '@/lib/newsroom/invariants'

function futureIso(minutesAhead = 60): string {
  return new Date(Date.now() + minutesAhead * 60 * 1000).toISOString()
}

function pastIso(minutesBehind = 60): string {
  return new Date(Date.now() - minutesBehind * 60 * 1000).toISOString()
}

const FULLY_VALID: PackPublishInput = {
  title: 'AM 2026 launch',
  creditLine: 'Nike',
  licenceClass: 'editorial_use_only',
  assets: [
    {
      kind: 'image',
      altText: 'Studio shot of AM 2026',
      scanResult: 'clean',
    },
  ],
  rightsWarrantyConfirmed: true,
  schedule: { kind: 'none' },
}

describe('checkPublishPreconditions — fully-valid input', () => {
  it('passes all eight checks', () => {
    const r = checkPublishPreconditions(FULLY_VALID)
    expect(r.hasTitle).toBe(true)
    expect(r.hasCreditLine).toBe(true)
    expect(r.hasLicenceClass).toBe(true)
    expect(r.hasAtLeastOneAsset).toBe(true)
    expect(r.allAssetScansClean).toBe(true)
    expect(r.allImagesHaveAltText).toBe(true)
    expect(r.hasRightsWarranty).toBe(true)
    expect(r.scheduleValid).toBe(true)
    expect(isPublishable(r)).toBe(true)
    expect(blockingPreconditions(r)).toEqual([])
  })
})

describe('checkPublishPreconditions — empty input', () => {
  it('reports every required field missing', () => {
    const r = checkPublishPreconditions({
      title: '',
      creditLine: '',
      licenceClass: null,
      assets: [],
      rightsWarrantyConfirmed: false,
      schedule: { kind: 'none' },
    })
    expect(r.hasTitle).toBe(false)
    expect(r.hasCreditLine).toBe(false)
    expect(r.hasLicenceClass).toBe(false)
    expect(r.hasAtLeastOneAsset).toBe(false)
    expect(r.allAssetScansClean).toBe(false)
    // allImagesHaveAltText vacuously true on 0 image assets.
    expect(r.allImagesHaveAltText).toBe(true)
    expect(r.hasRightsWarranty).toBe(false)
    expect(r.scheduleValid).toBe(true)
    expect(isPublishable(r)).toBe(false)
    expect(blockingPreconditions(r)).toEqual([
      'hasTitle',
      'hasCreditLine',
      'hasLicenceClass',
      'hasAtLeastOneAsset',
      'allAssetScansClean',
      'hasRightsWarranty',
    ])
  })
})

describe('checkPublishPreconditions — whitespace handling', () => {
  it('title and credit line of only whitespace fail', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      title: '   ',
      creditLine: '\t\n ',
    })
    expect(r.hasTitle).toBe(false)
    expect(r.hasCreditLine).toBe(false)
  })
})

describe('checkPublishPreconditions — asset checks', () => {
  it('image asset with null altText fails allImagesHaveAltText', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [
        { kind: 'image', altText: null, scanResult: 'clean' },
      ],
    })
    expect(r.allImagesHaveAltText).toBe(false)
    expect(isPublishable(r)).toBe(false)
  })

  it('image asset with whitespace-only altText fails allImagesHaveAltText', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [
        { kind: 'image', altText: '   ', scanResult: 'clean' },
      ],
    })
    expect(r.allImagesHaveAltText).toBe(false)
  })

  it('flagged scan on any asset fails allAssetScansClean', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [
        {
          kind: 'image',
          altText: 'ok',
          scanResult: 'clean',
        },
        {
          kind: 'image',
          altText: 'ok',
          scanResult: 'flagged',
        },
      ],
    })
    expect(r.allAssetScansClean).toBe(false)
  })

  it('pending and error scans also fail allAssetScansClean', () => {
    const pending = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [
        { kind: 'image', altText: 'ok', scanResult: 'pending' },
      ],
    })
    expect(pending.allAssetScansClean).toBe(false)

    const err = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [{ kind: 'image', altText: 'ok', scanResult: 'error' }],
    })
    expect(err.allAssetScansClean).toBe(false)
  })

  it('non-image assets (audio, document, text, video) with null altText still pass', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      assets: [
        { kind: 'audio', altText: null, scanResult: 'clean' },
        { kind: 'document', altText: null, scanResult: 'clean' },
        { kind: 'text', altText: null, scanResult: 'clean' },
        { kind: 'video', altText: null, scanResult: 'clean' },
      ],
    })
    expect(r.allImagesHaveAltText).toBe(true)
    expect(r.allAssetScansClean).toBe(true)
    expect(isPublishable(r)).toBe(true)
  })
})

describe('checkPublishPreconditions — rights warranty', () => {
  it('rightsWarrantyConfirmed=false fails hasRightsWarranty', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      rightsWarrantyConfirmed: false,
    })
    expect(r.hasRightsWarranty).toBe(false)
  })
})

describe('checkPublishPreconditions — schedule validity', () => {
  it('scheduled_plain with future publishAt passes', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: { kind: 'scheduled_plain', publishAt: futureIso() },
    })
    expect(r.scheduleValid).toBe(true)
  })

  it('scheduled_plain with past publishAt fails', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: { kind: 'scheduled_plain', publishAt: pastIso() },
    })
    expect(r.scheduleValid).toBe(false)
  })

  it('scheduled_plain with unparseable publishAt fails', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: { kind: 'scheduled_plain', publishAt: 'not-a-date' },
    })
    expect(r.scheduleValid).toBe(false)
  })

  it('scheduled_embargo fully valid passes', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: {
        kind: 'scheduled_embargo',
        liftAt: futureIso(120),
        recipientsCount: 3,
        policyText: 'Do not publish before lift.',
      },
    })
    expect(r.scheduleValid).toBe(true)
  })

  it('scheduled_embargo with 0 recipients fails', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: {
        kind: 'scheduled_embargo',
        liftAt: futureIso(120),
        recipientsCount: 0,
        policyText: 'Do not publish before lift.',
      },
    })
    expect(r.scheduleValid).toBe(false)
  })

  it('scheduled_embargo with empty policyText fails', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: {
        kind: 'scheduled_embargo',
        liftAt: futureIso(120),
        recipientsCount: 3,
        policyText: '   ',
      },
    })
    expect(r.scheduleValid).toBe(false)
  })

  it('scheduled_embargo with past liftAt fails', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      schedule: {
        kind: 'scheduled_embargo',
        liftAt: pastIso(),
        recipientsCount: 3,
        policyText: 'Do not publish before lift.',
      },
    })
    expect(r.scheduleValid).toBe(false)
  })
})

describe('blockingPreconditions', () => {
  it('returns only the failing keys', () => {
    const r = checkPublishPreconditions({
      ...FULLY_VALID,
      title: '',
      rightsWarrantyConfirmed: false,
    })
    const blocked = blockingPreconditions(r)
    expect(blocked).toContain('hasTitle')
    expect(blocked).toContain('hasRightsWarranty')
    expect(blocked).not.toContain('hasCreditLine')
    expect(blocked).not.toContain('scheduleValid')
  })
})
