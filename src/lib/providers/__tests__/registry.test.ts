// ═══════════════════════════════════════════════════════════════
// Provider registry — integrity tests
//
// The registry is the single source of truth for provider
// metadata. These tests guard the contract that the rest of the
// foundation depends on:
//
//   - every `ProviderKey` union member has a descriptor
//   - every descriptor declares at least one capability
//   - every descriptor declares at least one owner mode
//   - capability-flavour helpers find the providers we expect
//   - the same key is never declared twice
//
// A failure here means the registry has drifted from the type
// system (or vice versa) and downstream code can no longer
// trust either as a source of truth.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  getProviderDescriptor,
  isKnownProvider,
  listProviders,
  listProvidersWithCapability,
  providerSupportsOwnerMode,
} from '../registry'
import type { ProviderKey } from '../types'

const KNOWN_KEYS: ProviderKey[] = [
  'stripe',
  'google_identity',
  'google_drive',
  'google_gmail',
  'google_calendar',
]

describe('provider registry — integrity', () => {
  it('every typed ProviderKey has a registered descriptor', () => {
    for (const key of KNOWN_KEYS) {
      const desc = getProviderDescriptor(key)
      expect(desc, `descriptor for ${key}`).not.toBeNull()
      expect(desc!.key).toBe(key)
    }
  })

  it('listProviders returns one entry per typed key', () => {
    const all = listProviders()
    expect(all.length).toBe(KNOWN_KEYS.length)
    const keys = all.map((p) => p.key).sort()
    expect(keys).toEqual([...KNOWN_KEYS].sort())
  })

  it('every descriptor declares at least one capability', () => {
    for (const desc of listProviders()) {
      expect(desc.capabilities.length, `${desc.key} capabilities`).toBeGreaterThan(0)
    }
  })

  it('every descriptor declares at least one owner mode', () => {
    for (const desc of listProviders()) {
      expect(desc.owner_modes.length, `${desc.key} owner_modes`).toBeGreaterThan(0)
    }
  })

  it('isKnownProvider accepts every typed key and rejects strangers', () => {
    for (const key of KNOWN_KEYS) {
      expect(isKnownProvider(key)).toBe(true)
    }
    expect(isKnownProvider('not-a-provider')).toBe(false)
    expect(isKnownProvider('')).toBe(false)
  })
})

describe('provider registry — capability fan-out', () => {
  it('billing capability resolves to Stripe', () => {
    const billing = listProvidersWithCapability('billing')
    expect(billing.map((p) => p.key)).toContain('stripe')
  })

  it('payouts capability resolves to Stripe', () => {
    const payouts = listProvidersWithCapability('payouts')
    expect(payouts.map((p) => p.key)).toContain('stripe')
  })

  it('storage capability resolves to Google Drive', () => {
    const storage = listProvidersWithCapability('storage')
    expect(storage.map((p) => p.key)).toContain('google_drive')
  })

  it('mail_send capability resolves to Gmail', () => {
    const mail = listProvidersWithCapability('mail_send')
    expect(mail.map((p) => p.key)).toContain('google_gmail')
  })

  it('sso capability resolves to Google Identity', () => {
    const sso = listProvidersWithCapability('sso')
    expect(sso.map((p) => p.key)).toContain('google_identity')
  })

  it('unknown capability returns an empty list', () => {
    // @ts-expect-error -- intentionally invalid capability
    expect(listProvidersWithCapability('not-a-capability')).toEqual([])
  })
})

describe('provider registry — owner mode rules', () => {
  it('Stripe supports user, company, and platform', () => {
    expect(providerSupportsOwnerMode('stripe', 'user')).toBe(true)
    expect(providerSupportsOwnerMode('stripe', 'company')).toBe(true)
    expect(providerSupportsOwnerMode('stripe', 'platform')).toBe(true)
  })

  it('Google Identity is user-only', () => {
    expect(providerSupportsOwnerMode('google_identity', 'user')).toBe(true)
    expect(providerSupportsOwnerMode('google_identity', 'company')).toBe(false)
    expect(providerSupportsOwnerMode('google_identity', 'platform')).toBe(false)
  })

  it('Google Drive supports user and company', () => {
    expect(providerSupportsOwnerMode('google_drive', 'user')).toBe(true)
    expect(providerSupportsOwnerMode('google_drive', 'company')).toBe(true)
    expect(providerSupportsOwnerMode('google_drive', 'platform')).toBe(false)
  })
})
