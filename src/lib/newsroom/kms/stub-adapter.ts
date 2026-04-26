/**
 * Frontfiles — Stub KMS adapter (NR-D10, F2)
 *
 * Loads an Ed25519 private key from `NEWSROOM_SIGNING_KEY_PRIVATE`
 * (base64-encoded PEM) and signs in-process via `crypto.sign`.
 * The matching kid lives in `NEWSROOM_SIGNING_KEY_ID`. Both env
 * vars are required — constructor throws `KmsError('config')`
 * otherwise, with a pointer to the bootstrap runbook.
 *
 * Acceptable for closed beta with vetted distributors:
 *   - private key stored in env (encrypted at rest by hosting
 *     provider's secret store)
 *   - in-process signing; never crosses a network boundary
 *   - single-key per process (one active SigningKey row at a
 *     time per the partial unique index in NR-D2c-i)
 *
 * Production hardening (NR-G5) replaces this with a real KMS
 * adapter (Google Cloud KMS / AWS KMS / Vault) that holds
 * private keys in tenancy-isolated HSM. Tracked under v1.1 /
 * NR-H1 prerequisite.
 *
 * IP-2 ratification (2026-04-26): env var `NEWSROOM_SIGNING_KEY_ID`
 * populates the `newsroom_signing_keys.kid` column. The TS-side
 * identifier `keyId` is the canonical name in this code; the DB
 * column is `kid`.
 *
 * Spec cross-references:
 *   - directives/NR-D10-signing-keys-receipts.md §F2
 *   - docs/runbooks/newsroom-signing-key-bootstrap.md
 *   - PRD §3.2 SigningKey (algorithm = Ed25519 v1 fixed)
 */

import 'server-only'

import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  type KeyObject,
} from 'node:crypto'

import { KmsError } from './types'

// NOTE: We read `process.env` directly (not the parsed `env` from
// `@/lib/env`) so `vi.stubEnv` in the test suite can override the
// values at runtime. The parsed `env` is a frozen-at-import-time
// snapshot — Zod-validated, but a snapshot — and tests need to
// rebuild the adapter under different env configs. The Zod schema
// for these two vars is `z.string().min(1).optional()` (effectively
// no validation beyond non-empty), so reading raw `process.env`
// here doesn't lose any constraint.
//
// Mirrors the pattern from NR-D7b (storage adapter / scanner factory)
// per the carry-forward note in DIRECTIVE_SEQUENCE.md v1.1 backlog.
import type {
  KmsAdapter,
  KmsKeyRef,
  SignInput,
  SignOutput,
} from './types'

export class StubKmsAdapter implements KmsAdapter {
  readonly id = 'stub_v1'
  readonly version = '1.0.0'

  private readonly privateKey: KeyObject
  private readonly publicKey: KeyObject
  private readonly keyId: string

  constructor() {
    if (!process.env.NEWSROOM_SIGNING_KEY_PRIVATE) {
      throw new KmsError(
        'config',
        'NEWSROOM_SIGNING_KEY_PRIVATE is not set. See docs/runbooks/newsroom-signing-key-bootstrap.md.',
      )
    }
    if (!process.env.NEWSROOM_SIGNING_KEY_ID) {
      throw new KmsError(
        'config',
        'NEWSROOM_SIGNING_KEY_ID is not set. See docs/runbooks/newsroom-signing-key-bootstrap.md.',
      )
    }

    let pem: string
    try {
      pem = Buffer.from(
        process.env.NEWSROOM_SIGNING_KEY_PRIVATE,
        'base64',
      ).toString('utf8')
    } catch (err) {
      throw new KmsError(
        'config',
        `Failed to base64-decode NEWSROOM_SIGNING_KEY_PRIVATE: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }

    try {
      this.privateKey = createPrivateKey(pem)
      this.publicKey = createPublicKey(this.privateKey)
    } catch (err) {
      throw new KmsError(
        'config',
        `Failed to parse Ed25519 private key (must be PEM-encoded PKCS8): ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }

    // Defensive: refuse anything other than Ed25519. Locked v1.
    if (this.privateKey.asymmetricKeyType !== 'ed25519') {
      throw new KmsError(
        'config',
        `Expected Ed25519 key, got ${this.privateKey.asymmetricKeyType}. Regenerate with \`openssl genpkey -algorithm ed25519\`.`,
      )
    }

    this.keyId = process.env.NEWSROOM_SIGNING_KEY_ID
  }

  async sign(input: SignInput): Promise<SignOutput> {
    if (input.keyId !== this.keyId) {
      throw new KmsError(
        'config',
        `StubKmsAdapter only signs with keyId='${this.keyId}', got '${input.keyId}'.`,
      )
    }
    // Ed25519 in node: `sign(null, payload, privateKey)`. The
    // `null` algorithm parameter is required — the algorithm is
    // derived from the key type. See node:crypto docs.
    const signature = cryptoSign(
      null,
      Buffer.from(input.payload),
      this.privateKey,
    )
    return {
      signature,
      signingKeyId: this.keyId,
      algorithm: 'ed25519',
    }
  }

  async getPublicKey(keyId: string): Promise<KmsKeyRef> {
    if (keyId !== this.keyId) {
      throw new KmsError(
        'config',
        `StubKmsAdapter only knows keyId='${this.keyId}', got '${keyId}'.`,
      )
    }
    const publicKeyPem = this.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString()
    return {
      keyId,
      publicKeyPem,
      // The stub adapter doesn't read DB state — it always reports
      // 'active' for the configured kid. Truth-of-status lives in
      // `newsroom_signing_keys.status` (the keyset endpoint joins
      // adapter output with that).
      status: 'active',
    }
  }
}
