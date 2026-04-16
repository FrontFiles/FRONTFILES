// Filesystem adapter — round-trip + rejection tests.
// Uses a temp dir per test to avoid cross-test contamination.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { FilesystemStorageAdapter } from '../fs-adapter'
import { StorageRefError } from '../types'

async function makeTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ff-storage-'))
}

describe('FilesystemStorageAdapter', () => {
  let root: string
  let adapter: FilesystemStorageAdapter

  beforeEach(async () => {
    root = await makeTempRoot()
    adapter = new FilesystemStorageAdapter(root)
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('round-trips an original via putOriginal + getBytes', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) // JPEG SOI
    const ref = await adapter.putOriginal({
      assetId: 'asset-1',
      filename: 'IMG_4521.jpeg',
      bytes,
      contentType: 'image/jpeg',
    })
    expect(ref).toBe('originals/asset-1/IMG_4521.jpeg')

    const read = await adapter.getBytes(ref)
    expect(read.equals(bytes)).toBe(true)
  })

  it('round-trips each derivative role', async () => {
    const roles = ['thumbnail', 'watermarked_preview', 'og_image'] as const
    for (const role of roles) {
      const bytes = Buffer.from(`derivative-${role}`, 'utf8')
      const ref = await adapter.putDerivative({
        assetId: 'asset-2',
        role,
        bytes,
        contentType: 'image/jpeg',
      })
      expect(ref).toBe(`derivatives/asset-2/${role}.jpg`)
      expect((await adapter.getBytes(ref)).equals(bytes)).toBe(true)
    }
  })

  it('exists returns true only after a write', async () => {
    const ref = 'derivatives/asset-3/thumbnail.jpg'
    expect(await adapter.exists(ref)).toBe(false)
    await adapter.putDerivative({
      assetId: 'asset-3',
      role: 'thumbnail',
      bytes: Buffer.from('x'),
      contentType: 'image/jpeg',
    })
    expect(await adapter.exists(ref)).toBe(true)
  })

  it('overwrites byte-equivalently on repeated putDerivative', async () => {
    const ref = await adapter.putDerivative({
      assetId: 'asset-4',
      role: 'thumbnail',
      bytes: Buffer.from('v1'),
      contentType: 'image/jpeg',
    })
    await adapter.putDerivative({
      assetId: 'asset-4',
      role: 'thumbnail',
      bytes: Buffer.from('v2'),
      contentType: 'image/jpeg',
    })
    expect((await adapter.getBytes(ref)).toString()).toBe('v2')
  })

  it('creates intermediate directories', async () => {
    const ref = await adapter.putOriginal({
      assetId: 'deeply-nested-asset',
      filename: 'x.bin',
      bytes: Buffer.from('y'),
      contentType: 'application/octet-stream',
    })
    const absolute = path.join(root, ref)
    const stat = await fs.stat(absolute)
    expect(stat.isFile()).toBe(true)
  })

  it('rejects absolute storage_ref on getBytes', async () => {
    await expect(adapter.getBytes('/etc/passwd')).rejects.toBeInstanceOf(
      StorageRefError,
    )
  })

  it('rejects traversal storage_ref on exists', async () => {
    await expect(
      adapter.exists('originals/asset/../../etc/passwd'),
    ).rejects.toBeInstanceOf(StorageRefError)
  })

  it('rejects empty storage_ref on getBytes', async () => {
    await expect(adapter.getBytes('')).rejects.toBeInstanceOf(StorageRefError)
  })

  it('rejects path separators in filename on putOriginal', async () => {
    await expect(
      adapter.putOriginal({
        assetId: 'asset-5',
        filename: '../escape.jpg',
        bytes: Buffer.from(''),
        contentType: 'image/jpeg',
      }),
    ).rejects.toBeInstanceOf(StorageRefError)
  })

  it('getBytes throws on missing file (existence != readiness)', async () => {
    await expect(
      adapter.getBytes('derivatives/does-not-exist/thumbnail.jpg'),
    ).rejects.toThrow()
  })

  it('constructor rejects empty root', () => {
    expect(() => new FilesystemStorageAdapter('')).toThrow()
  })

  it('delete removes a previously-written file', async () => {
    const ref = await adapter.putOriginal({
      assetId: 'asset-del-1',
      filename: 'x.bin',
      bytes: Buffer.from('gone'),
      contentType: 'application/octet-stream',
    })
    expect(await adapter.exists(ref)).toBe(true)
    await adapter.delete(ref)
    expect(await adapter.exists(ref)).toBe(false)
  })

  it('delete is idempotent on missing refs', async () => {
    await expect(
      adapter.delete('derivatives/never-written/thumbnail.jpg'),
    ).resolves.toBeUndefined()
  })

  it('delete rejects invalid storage_ref', async () => {
    await expect(adapter.delete('/etc/passwd')).rejects.toBeInstanceOf(
      StorageRefError,
    )
    await expect(
      adapter.delete('originals/asset/../../etc/passwd'),
    ).rejects.toBeInstanceOf(StorageRefError)
    await expect(adapter.delete('')).rejects.toBeInstanceOf(StorageRefError)
  })
})
