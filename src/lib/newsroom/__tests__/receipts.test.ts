/**
 * Frontfiles — receipts.ts + KMS adapter unit tests (NR-D10, F5)
 *
 * Generates a fresh Ed25519 keypair per test run, sets the env
 * vars `vi.stubEnv`, resets the module cache, and exercises:
 *
 *   - StubKmsAdapter constructor (env validation + key parsing)
 *   - sign/getPublicKey contract
 *   - mintReceipt → row-shaped output (matches MintedReceipt)
 *   - verifyReceipt round-trip + tamper detection
 *   - Canonical-payload determinism
 *
 * No DB, no I/O. Pure Node crypto.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

import {
  KmsError,
  StubKmsAdapter,
  _resetKmsAdapterCache,
  getKmsAdapter,
} from '../kms'
import {
  _internal,
  mintReceipt,
  verifyReceipt,
  type MintedReceipt,
  type ReceiptMintInput,
} from '../receipts'

// ── Per-test-run keypair ───────────────────────────────────────

let TEST_PRIVATE_PEM_BASE64 = ''
let TEST_PUBLIC_PEM = ''
const TEST_KEY_ID = 'test-signing-key-1'

beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privatePem = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString()
  TEST_PRIVATE_PEM_BASE64 = Buffer.from(privatePem, 'utf8').toString('base64')
  TEST_PUBLIC_PEM = publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString()
})

beforeEach(() => {
  vi.stubEnv('NEWSROOM_SIGNING_KEY_PRIVATE', TEST_PRIVATE_PEM_BASE64)
  vi.stubEnv('NEWSROOM_SIGNING_KEY_ID', TEST_KEY_ID)
  _resetKmsAdapterCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  _resetKmsAdapterCache()
})

// ── Fixtures ───────────────────────────────────────────────────

function baseInput(overrides: Partial<ReceiptMintInput> = {}): ReceiptMintInput {
  return {
    pack_id: '11111111-1111-1111-1111-111111111111',
    asset_id: '22222222-2222-2222-2222-222222222222',
    recipient_id: '33333333-3333-3333-3333-333333333333',
    distribution_event_id: '44444444-4444-4444-4444-444444444444',
    licence_class: 'editorial_use_only',
    credit_line: 'Photo by Jane Reporter / Reuters',
    terms_summary: 'Editorial use; no resale; credit required.',
    content_hash_sha256:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    receipt_url:
      'https://frontfiles.com/receipts/44444444-4444-4444-4444-444444444444',
    ...overrides,
  }
}

// ── StubKmsAdapter ─────────────────────────────────────────────

describe('StubKmsAdapter', () => {
  it('constructs with valid env vars', () => {
    const adapter = new StubKmsAdapter()
    expect(adapter.id).toBe('stub_v1')
    expect(adapter.version).toBe('1.0.0')
  })

  it('throws KmsError("config") when NEWSROOM_SIGNING_KEY_PRIVATE is missing', () => {
    vi.stubEnv('NEWSROOM_SIGNING_KEY_PRIVATE', '')
    expect(() => new StubKmsAdapter()).toThrow(KmsError)
    try {
      new StubKmsAdapter()
    } catch (err) {
      expect(err).toBeInstanceOf(KmsError)
      expect((err as KmsError).category).toBe('config')
      expect((err as Error).message).toContain('NEWSROOM_SIGNING_KEY_PRIVATE')
    }
  })

  it('throws KmsError("config") when NEWSROOM_SIGNING_KEY_ID is missing', () => {
    vi.stubEnv('NEWSROOM_SIGNING_KEY_ID', '')
    expect(() => new StubKmsAdapter()).toThrow(KmsError)
  })

  it('throws KmsError("config") when private key is malformed', () => {
    vi.stubEnv(
      'NEWSROOM_SIGNING_KEY_PRIVATE',
      Buffer.from('not a real PEM').toString('base64'),
    )
    expect(() => new StubKmsAdapter()).toThrow(KmsError)
  })

  it('throws KmsError("config") when key is non-Ed25519', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rsaPem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString()
    vi.stubEnv(
      'NEWSROOM_SIGNING_KEY_PRIVATE',
      Buffer.from(rsaPem, 'utf8').toString('base64'),
    )
    expect(() => new StubKmsAdapter()).toThrow(KmsError)
    try {
      new StubKmsAdapter()
    } catch (err) {
      expect((err as Error).message).toContain('Ed25519')
    }
  })

  it('sign() returns a Buffer signature + correct echo', async () => {
    const adapter = new StubKmsAdapter()
    const result = await adapter.sign({
      payload: Buffer.from('hello world'),
      keyId: TEST_KEY_ID,
    })
    expect(result.signingKeyId).toBe(TEST_KEY_ID)
    expect(result.algorithm).toBe('ed25519')
    expect(Buffer.isBuffer(result.signature)).toBe(true)
    // Ed25519 signatures are 64 bytes
    expect(result.signature.length).toBe(64)
  })

  it('sign() throws KmsError("config") for unknown keyId', async () => {
    const adapter = new StubKmsAdapter()
    await expect(
      adapter.sign({
        payload: Buffer.from('x'),
        keyId: 'wrong-key-id',
      }),
    ).rejects.toThrow(KmsError)
  })

  it('getPublicKey() returns SPKI PEM for the configured kid', async () => {
    const adapter = new StubKmsAdapter()
    const ref = await adapter.getPublicKey(TEST_KEY_ID)
    expect(ref.keyId).toBe(TEST_KEY_ID)
    expect(ref.publicKeyPem).toContain('BEGIN PUBLIC KEY')
    expect(ref.publicKeyPem).toContain('END PUBLIC KEY')
    expect(ref.status).toBe('active')
  })

  it('getPublicKey() throws KmsError("config") for unknown keyId', async () => {
    const adapter = new StubKmsAdapter()
    await expect(adapter.getPublicKey('wrong')).rejects.toThrow(KmsError)
  })
})

// ── getKmsAdapter() factory ────────────────────────────────────

describe('getKmsAdapter', () => {
  it('returns a singleton (same instance across calls)', () => {
    const a = getKmsAdapter()
    const b = getKmsAdapter()
    expect(a).toBe(b)
  })

  it('rebuilds after _resetKmsAdapterCache()', () => {
    const a = getKmsAdapter()
    _resetKmsAdapterCache()
    const b = getKmsAdapter()
    expect(a).not.toBe(b)
  })
})

// ── mintReceipt ────────────────────────────────────────────────

describe('mintReceipt', () => {
  it('returns row-shaped output with all schema fields', async () => {
    const input = baseInput()
    const receipt = await mintReceipt(input)
    expect(receipt.pack_id).toBe(input.pack_id)
    expect(receipt.asset_id).toBe(input.asset_id)
    expect(receipt.recipient_id).toBe(input.recipient_id)
    expect(receipt.distribution_event_id).toBe(input.distribution_event_id)
    expect(receipt.licence_class).toBe(input.licence_class)
    expect(receipt.credit_line).toBe(input.credit_line)
    expect(receipt.terms_summary).toBe(input.terms_summary)
    expect(receipt.content_hash_sha256).toBe(input.content_hash_sha256)
    expect(receipt.receipt_url).toBe(input.receipt_url)
    expect(receipt.signing_key_kid).toBe(TEST_KEY_ID)
    expect(typeof receipt.signed_at).toBe('string')
    expect(receipt.signed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(typeof receipt.signature).toBe('string')
    expect(receipt.signature.length).toBeGreaterThan(0)
  })

  it('handles asset_id null (pack-level download)', async () => {
    const receipt = await mintReceipt(baseInput({ asset_id: null }))
    expect(receipt.asset_id).toBeNull()
    // verify the receipt with the test public key
    expect(verifyReceipt(receipt, TEST_PUBLIC_PEM)).toBe(true)
  })

  it('handles recipient_id null (anonymous)', async () => {
    const receipt = await mintReceipt(baseInput({ recipient_id: null }))
    expect(receipt.recipient_id).toBeNull()
    expect(verifyReceipt(receipt, TEST_PUBLIC_PEM)).toBe(true)
  })

  it('handles both asset_id AND recipient_id null', async () => {
    const receipt = await mintReceipt(
      baseInput({ asset_id: null, recipient_id: null }),
    )
    expect(verifyReceipt(receipt, TEST_PUBLIC_PEM)).toBe(true)
  })

  it('signature is base64-encoded and decodes to 64 bytes', async () => {
    const receipt = await mintReceipt(baseInput())
    const bytes = Buffer.from(receipt.signature, 'base64')
    expect(bytes.length).toBe(64)
  })
})

// ── verifyReceipt ──────────────────────────────────────────────

describe('verifyReceipt', () => {
  it('round-trip: mintReceipt → verifyReceipt → true', async () => {
    const receipt = await mintReceipt(baseInput())
    expect(verifyReceipt(receipt, TEST_PUBLIC_PEM)).toBe(true)
  })

  it('returns false on tampered pack_id', async () => {
    const receipt = await mintReceipt(baseInput())
    const tampered: MintedReceipt = { ...receipt, pack_id: '99999999-9999-9999-9999-999999999999' }
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('returns false on tampered credit_line', async () => {
    const receipt = await mintReceipt(baseInput())
    const tampered: MintedReceipt = { ...receipt, credit_line: 'Forged credit' }
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('returns false on tampered content_hash_sha256', async () => {
    const receipt = await mintReceipt(baseInput())
    const tampered: MintedReceipt = {
      ...receipt,
      content_hash_sha256:
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    }
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('returns false on tampered signed_at', async () => {
    const receipt = await mintReceipt(baseInput())
    const tampered: MintedReceipt = { ...receipt, signed_at: '2099-01-01T00:00:00.000Z' }
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('returns false on tampered signature bytes', async () => {
    const receipt = await mintReceipt(baseInput())
    // Flip one base64 char to corrupt the signature
    const sig = receipt.signature
    const corruptedSig = sig.charAt(0) === 'A'
      ? `B${sig.slice(1)}`
      : `A${sig.slice(1)}`
    const tampered: MintedReceipt = { ...receipt, signature: corruptedSig }
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('returns false with a wrong public key', async () => {
    const receipt = await mintReceipt(baseInput())
    const { publicKey: otherPub } = generateKeyPairSync('ed25519')
    const wrongPem = otherPub
      .export({ type: 'spki', format: 'pem' })
      .toString()
    expect(verifyReceipt(receipt, wrongPem)).toBe(false)
  })

  it('returns false with malformed PEM (no throw)', async () => {
    const receipt = await mintReceipt(baseInput())
    expect(verifyReceipt(receipt, 'not a PEM')).toBe(false)
  })

  it('returns false with malformed signature base64 (no throw)', async () => {
    const receipt = await mintReceipt(baseInput())
    const tampered: MintedReceipt = { ...receipt, signature: '!!!not base64!!!' }
    // Buffer.from('!!!', 'base64') doesn't throw — produces empty Buffer.
    // verify with empty signature should return false.
    expect(verifyReceipt(tampered, TEST_PUBLIC_PEM)).toBe(false)
  })

  it('verifies anonymous + pack-level receipts correctly', async () => {
    const receipt = await mintReceipt(
      baseInput({ asset_id: null, recipient_id: null }),
    )
    expect(verifyReceipt(receipt, TEST_PUBLIC_PEM)).toBe(true)
  })
})

// ── Canonical payload determinism ──────────────────────────────

describe('canonical payload', () => {
  it('same inputs produce same digest (deterministic)', () => {
    const args = {
      pack_id: 'p1',
      asset_id: 'a1' as string | null,
      recipient_id: 'r1' as string | null,
      licence_class: 'editorial_use_only' as const,
      credit_line: 'Test',
      terms_summary: 'Terms',
      content_hash_sha256: 'abc',
      signing_key_kid: 'kid1',
      signed_at: '2026-04-26T00:00:00.000Z',
      distribution_event_id: 'd1',
    }
    const a = _internal.buildCanonicalDigest(args)
    const b = _internal.buildCanonicalDigest(args)
    expect(a.equals(b)).toBe(true)
    // SHA-256 = 32 bytes
    expect(a.length).toBe(32)
  })

  it('null asset_id → "pack" sentinel; null recipient_id → "anon" sentinel', () => {
    const withNulls = _internal.buildCanonicalDigest({
      pack_id: 'p1',
      asset_id: null,
      recipient_id: null,
      licence_class: 'editorial_use_only',
      credit_line: 'Test',
      terms_summary: 'Terms',
      content_hash_sha256: 'abc',
      signing_key_kid: 'kid1',
      signed_at: '2026-04-26T00:00:00.000Z',
      distribution_event_id: 'd1',
    })
    const withSentinels = _internal.buildCanonicalDigest({
      pack_id: 'p1',
      asset_id: 'pack',
      recipient_id: 'anon',
      licence_class: 'editorial_use_only',
      credit_line: 'Test',
      terms_summary: 'Terms',
      content_hash_sha256: 'abc',
      signing_key_kid: 'kid1',
      signed_at: '2026-04-26T00:00:00.000Z',
      distribution_event_id: 'd1',
    })
    expect(withNulls.equals(withSentinels)).toBe(true)
  })

  it('changing any field changes the digest', () => {
    const baseArgs = {
      pack_id: 'p1',
      asset_id: 'a1' as string | null,
      recipient_id: 'r1' as string | null,
      licence_class: 'editorial_use_only' as const,
      credit_line: 'Test',
      terms_summary: 'Terms',
      content_hash_sha256: 'abc',
      signing_key_kid: 'kid1',
      signed_at: '2026-04-26T00:00:00.000Z',
      distribution_event_id: 'd1',
    }
    const baseline = _internal.buildCanonicalDigest(baseArgs)
    const fields: Array<keyof typeof baseArgs> = [
      'pack_id',
      'asset_id',
      'recipient_id',
      'licence_class',
      'credit_line',
      'terms_summary',
      'content_hash_sha256',
      'signing_key_kid',
      'signed_at',
      'distribution_event_id',
    ]
    for (const field of fields) {
      const changed = {
        ...baseArgs,
        [field]:
          field === 'licence_class'
            ? 'press_release_verbatim'
            : `${baseArgs[field]}-changed`,
      } as typeof baseArgs
      const result = _internal.buildCanonicalDigest(changed)
      expect(
        result.equals(baseline),
        `field "${String(field)}" did not affect the digest`,
      ).toBe(false)
    }
  })
})
