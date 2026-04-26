// ═══════════════════════════════════════════════════════════════
// Frontfiles — Filesystem storage adapter (dev / test)
//
// Writes bytes under a configurable root directory. The root is
// injected at construction time so tests can point at a temp dir.
// The `index.ts` factory reads `FFF_STORAGE_FS_ROOT` for the
// runtime default.
//
// SCOPE: dev and test. Production deploys point `FFF_STORAGE_DRIVER`
// at `supabase` (or a future driver). The filesystem adapter is
// never intended to sit behind a production request.
//
// SECURITY: every input ref / path is validated before touching
// `node:fs`. `validateStorageRef` forbids absolute paths and `..`
// segments so a caller cannot escape the root.
// ═══════════════════════════════════════════════════════════════

import { promises as fs } from 'node:fs'
import * as path from 'node:path'

import { originalPath, derivativePath, validateStorageRef } from './paths'
import type {
  PutOriginalInput,
  PutDerivativeInput,
  SignedPutUrlInput,
  SignedPutUrlOutput,
  StorageAdapter,
} from './types'

export class FilesystemStorageAdapter implements StorageAdapter {
  constructor(private readonly root: string) {
    if (!root || typeof root !== 'string') {
      throw new Error('FilesystemStorageAdapter: root is required')
    }
  }

  async putOriginal(input: PutOriginalInput): Promise<string> {
    const ref = originalPath(input.assetId, input.filename)
    await this.writeBytes(ref, input.bytes)
    return ref
  }

  async putDerivative(input: PutDerivativeInput): Promise<string> {
    const ref = derivativePath(input.assetId, input.role)
    await this.writeBytes(ref, input.bytes)
    return ref
  }

  async getBytes(storageRef: string): Promise<Buffer> {
    validateStorageRef(storageRef)
    const absolute = this.absoluteFor(storageRef)
    return fs.readFile(absolute)
  }

  async exists(storageRef: string): Promise<boolean> {
    validateStorageRef(storageRef)
    const absolute = this.absoluteFor(storageRef)
    try {
      await fs.access(absolute)
      return true
    } catch {
      return false
    }
  }

  async delete(storageRef: string): Promise<void> {
    validateStorageRef(storageRef)
    const absolute = this.absoluteFor(storageRef)
    try {
      await fs.unlink(absolute)
    } catch (err) {
      // Missing target is a no-op: the adapter contract says
      // delete is idempotent on absence so callers can retry the
      // rollback path without branching.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
      throw err
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async signedPutUrl(
    _input: SignedPutUrlInput,
  ): Promise<SignedPutUrlOutput> {
    // Filesystem adapter has no concept of presigned URLs — there's
    // no over-the-wire endpoint to delegate to a browser. Browser-
    // side uploads (NR-D7a asset upload) need real signed URLs from
    // a backing object store. Surface a clear message so the
    // operator understands the cause is configuration, not code.
    throw new Error(
      'FilesystemStorageAdapter.signedPutUrl: not implemented. ' +
        'Browser uploads require presigned URL support; set ' +
        'FFF_STORAGE_DRIVER=supabase (with FFF_STORAGE_SUPABASE_BUCKET) ' +
        'to use the Supabase adapter for asset uploads.',
    )
  }

  private async writeBytes(
    storageRef: string,
    bytes: Buffer | Uint8Array,
  ): Promise<void> {
    validateStorageRef(storageRef)
    const absolute = this.absoluteFor(storageRef)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    // Buffer.from is a no-op when `bytes` is already a Buffer.
    await fs.writeFile(absolute, Buffer.from(bytes))
  }

  private absoluteFor(storageRef: string): string {
    // `storageRef` is already validated as relative + traversal-free.
    // `path.join` with a relative ref cannot escape the root.
    return path.join(this.root, storageRef)
  }
}
