// Driver selection — env-driven, fs default, no throw on unset.
// PR 1 exit criterion §5.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  resolveStorageDriver,
  getStorageAdapter,
  FilesystemStorageAdapter,
} from '../index'

function withEnv(mutations: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(mutations)) saved[key] = process.env[key]
  try {
    for (const [key, value] of Object.entries(mutations)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    fn()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('resolveStorageDriver', () => {
  it('defaults to fs when unset', () => {
    withEnv({ FFF_STORAGE_DRIVER: undefined }, () => {
      expect(resolveStorageDriver()).toBe('fs')
    })
  })

  it('defaults to fs on empty string', () => {
    withEnv({ FFF_STORAGE_DRIVER: '' }, () => {
      expect(resolveStorageDriver()).toBe('fs')
    })
  })

  it('resolves fs explicitly', () => {
    withEnv({ FFF_STORAGE_DRIVER: 'fs' }, () => {
      expect(resolveStorageDriver()).toBe('fs')
    })
  })

  it('resolves supabase explicitly', () => {
    withEnv({ FFF_STORAGE_DRIVER: 'supabase' }, () => {
      expect(resolveStorageDriver()).toBe('supabase')
    })
  })

  it('is case-insensitive', () => {
    withEnv({ FFF_STORAGE_DRIVER: 'Supabase' }, () => {
      expect(resolveStorageDriver()).toBe('supabase')
    })
  })

  it('throws on unknown driver', () => {
    withEnv({ FFF_STORAGE_DRIVER: 'gcs' }, () => {
      expect(() => resolveStorageDriver()).toThrow()
    })
  })
})

describe('getStorageAdapter', () => {
  it('returns a FilesystemStorageAdapter when driver is fs', () => {
    withEnv(
      {
        FFF_STORAGE_DRIVER: 'fs',
        FFF_STORAGE_FS_ROOT: '/tmp/ff-storage-test',
      },
      () => {
        const adapter = getStorageAdapter()
        expect(adapter).toBeInstanceOf(FilesystemStorageAdapter)
      },
    )
  })

  it('returns fs adapter when driver is unset (safe default)', () => {
    withEnv(
      {
        FFF_STORAGE_DRIVER: undefined,
        FFF_STORAGE_FS_ROOT: '/tmp/ff-storage-test',
      },
      () => {
        const adapter = getStorageAdapter()
        expect(adapter).toBeInstanceOf(FilesystemStorageAdapter)
      },
    )
  })

  it('throws when driver is supabase but bucket is unset', () => {
    withEnv(
      {
        FFF_STORAGE_DRIVER: 'supabase',
        FFF_STORAGE_SUPABASE_BUCKET: undefined,
      },
      () => {
        expect(() => getStorageAdapter()).toThrow(
          /FFF_STORAGE_SUPABASE_BUCKET/,
        )
      },
    )
  })
})
