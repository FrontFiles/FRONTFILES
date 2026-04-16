// ═══════════════════════════════════════════════════════════════
// Frontfiles — Supabase Storage adapter (prod)
//
// Thin wrapper over `@supabase/supabase-js` Storage API. The
// service-role client from `@/lib/db/client` is used — service
// role is required because Storage RLS is not configured in this
// pass and all storage access is mediated by the server anyway.
//
// PR 1 POSTURE: this implementation lands structurally. It is
// not required to be configured against a live bucket before
// merge (plan exit criteria §6). The first live use is PR 2
// when the upload route writes originals.
//
// BUCKET CHOICE: `FFF_STORAGE_SUPABASE_BUCKET` must be set when
// this driver is selected. Bucket naming, public/private config,
// and retention policies are operational concerns outside the
// adapter.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/db/client'

import { originalPath, derivativePath, validateStorageRef } from './paths'
import type {
  PutOriginalInput,
  PutDerivativeInput,
  StorageAdapter,
} from './types'

export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly client: SupabaseClient

  constructor(
    private readonly bucket: string,
    clientOverride?: SupabaseClient,
  ) {
    if (!bucket || typeof bucket !== 'string') {
      throw new Error('SupabaseStorageAdapter: bucket is required')
    }
    this.client = clientOverride ?? getSupabaseClient()
  }

  async putOriginal(input: PutOriginalInput): Promise<string> {
    const ref = originalPath(input.assetId, input.filename)
    await this.upload(ref, input.bytes, input.contentType)
    return ref
  }

  async putDerivative(input: PutDerivativeInput): Promise<string> {
    const ref = derivativePath(input.assetId, input.role)
    await this.upload(ref, input.bytes, input.contentType)
    return ref
  }

  async getBytes(storageRef: string): Promise<Buffer> {
    validateStorageRef(storageRef)
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(storageRef)
    if (error || !data) {
      throw new Error(
        `SupabaseStorageAdapter.getBytes failed for ${storageRef}: ${error?.message ?? 'no data'}`,
      )
    }
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async exists(storageRef: string): Promise<boolean> {
    validateStorageRef(storageRef)
    // `list` with the exact filename as the search term is the
    // cheapest existence check that works on every Supabase plan
    // without requiring the `info()` endpoint to be enabled.
    const dir = dirname(storageRef)
    const name = basename(storageRef)
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(dir, { search: name, limit: 1 })
    if (error) return false
    return !!data && data.some(entry => entry.name === name)
  }

  async delete(storageRef: string): Promise<void> {
    validateStorageRef(storageRef)
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([storageRef])
    // Supabase Storage `.remove()` resolves without error even
    // when the object is absent. Any returned error therefore
    // represents a real failure (auth, transport, bucket policy)
    // and must propagate so the commit-service logs it as a
    // compensating-action failure.
    if (error) {
      throw new Error(
        `SupabaseStorageAdapter.delete failed for ${storageRef}: ${error.message}`,
      )
    }
  }

  private async upload(
    storageRef: string,
    bytes: Buffer | Uint8Array,
    contentType: string,
  ): Promise<void> {
    validateStorageRef(storageRef)
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storageRef, Buffer.from(bytes), {
        contentType,
        // Derivatives overwrite byte-equivalently on retry
        // (ARCHITECTURE-BRIEF §5.3); originals overwrite only
        // when the same idempotency token replays with identical
        // bytes — enforced by the upload route in PR 2. Either
        // way, the correct behavior is upsert.
        upsert: true,
      })
    if (error) {
      throw new Error(
        `SupabaseStorageAdapter.upload failed for ${storageRef}: ${error.message}`,
      )
    }
  }
}

// ── Local path helpers (no `node:path` import) ─────────────
//
// The Supabase Storage key space uses `/` regardless of host OS.
// Using `node:path` here would risk picking up Windows separators
// in a dev environment and corrupting the key.
function dirname(ref: string): string {
  const idx = ref.lastIndexOf('/')
  return idx === -1 ? '' : ref.slice(0, idx)
}

function basename(ref: string): string {
  const idx = ref.lastIndexOf('/')
  return idx === -1 ? ref : ref.slice(idx + 1)
}
