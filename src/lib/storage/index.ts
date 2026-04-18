// ═══════════════════════════════════════════════════════════════
// Frontfiles — Storage module entry point
//
// Public surface of the storage substrate. Re-exports the
// interface, types, path helpers, and adapters, and provides the
// `getStorageAdapter()` factory that reads `FFF_STORAGE_DRIVER`
// to select an implementation.
//
// Driver selection (server-only):
//
//   FFF_STORAGE_DRIVER=fs        → FilesystemStorageAdapter rooted at
//                                   FFF_STORAGE_FS_ROOT, defaulting to
//                                   `<cwd>/.storage`.
//   FFF_STORAGE_DRIVER=supabase  → SupabaseStorageAdapter bound to the
//                                   bucket named by
//                                   FFF_STORAGE_SUPABASE_BUCKET.
//   unset                        → fs (safe default; plan exit criterion §5).
//
// PR 1 LANDING: this module has no importers anywhere else in
// the repo. The grep check in the exit criteria verifies that.
// Later PRs import `getStorageAdapter` at the upload-route, worker,
// and backfill seams.
// ═══════════════════════════════════════════════════════════════

import * as path from 'node:path'

import { env } from '@/lib/env'
import { FilesystemStorageAdapter } from './fs-adapter'
import { SupabaseStorageAdapter } from './supabase-adapter'
import type { StorageAdapter } from './types'

export type {
  DerivativeRole,
  PutOriginalInput,
  PutDerivativeInput,
  StorageAdapter,
  StorageRefErrorCode,
} from './types'
export { DERIVATIVE_ROLES, StorageRefError } from './types'
export { originalPath, derivativePath, validateStorageRef } from './paths'
export { FilesystemStorageAdapter } from './fs-adapter'
export { SupabaseStorageAdapter } from './supabase-adapter'

// ── Driver selection ───────────────────────────────────────

export type StorageDriver = 'fs' | 'supabase'

/**
 * Resolve the configured storage driver. Unset env → `'fs'` (does
 * not throw) per plan exit criterion §5.
 *
 * env.ts Zod schema enforces the `'fs' | 'supabase'` enum at module
 * load time with a `'fs'` default, so by the time this function runs
 * the value is already validated and narrowed.
 */
export function resolveStorageDriver(): StorageDriver {
  return env.FFF_STORAGE_DRIVER
}

/**
 * Build the storage adapter selected by environment config.
 * Server-only — do not call from a client component.
 */
export function getStorageAdapter(): StorageAdapter {
  const driver = resolveStorageDriver()
  if (driver === 'fs') {
    const root =
      env.FFF_STORAGE_FS_ROOT?.trim() ||
      path.join(process.cwd(), '.storage')
    return new FilesystemStorageAdapter(root)
  }
  // driver === 'supabase'
  const bucket = env.FFF_STORAGE_SUPABASE_BUCKET?.trim()
  if (!bucket) {
    throw new Error(
      'FFF_STORAGE_DRIVER=supabase but FFF_STORAGE_SUPABASE_BUCKET is not set',
    )
  }
  return new SupabaseStorageAdapter(bucket)
}
