/**
 * Frontfiles — host.ts unit tests (NR-D3)
 *
 * Covers case-insensitive `newsroom.*` host matching, port and
 * localhost variants, and null/undefined/empty rejection.
 */

import { describe, expect, it } from 'vitest'

import { isNewsroomHost } from '@/lib/newsroom/host'

describe('isNewsroomHost', () => {
  it('matches newsroom.frontfiles.com', () => {
    expect(isNewsroomHost('newsroom.frontfiles.com')).toBe(true)
  })

  it('matches newsroom.frontfiles.com:443 (host with port)', () => {
    expect(isNewsroomHost('newsroom.frontfiles.com:443')).toBe(true)
  })

  it('matches NEWSROOM.FRONTFILES.COM (case-insensitive)', () => {
    expect(isNewsroomHost('NEWSROOM.FRONTFILES.COM')).toBe(true)
  })

  it('matches newsroom.frontfiles.localhost:3000 (dev variant)', () => {
    expect(isNewsroomHost('newsroom.frontfiles.localhost:3000')).toBe(true)
  })

  it('rejects frontfiles.com (main domain)', () => {
    expect(isNewsroomHost('frontfiles.com')).toBe(false)
  })

  it('rejects www.frontfiles.com (non-newsroom subdomain)', () => {
    expect(isNewsroomHost('www.frontfiles.com')).toBe(false)
  })

  it('rejects not-newsroom.frontfiles.com (prefix lookalike)', () => {
    expect(isNewsroomHost('not-newsroom.frontfiles.com')).toBe(false)
  })

  it('rejects empty, null, and undefined', () => {
    expect(isNewsroomHost('')).toBe(false)
    expect(isNewsroomHost(null)).toBe(false)
    expect(isNewsroomHost(undefined)).toBe(false)
  })
})
