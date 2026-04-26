/**
 * Frontfiles — KMS adapter interface (NR-D10, F1)
 *
 * Adapter pattern mirrors `src/lib/scanner/types.ts` (NR-D7b
 * precedent). v1 ships a single implementation: `StubKmsAdapter`,
 * which loads the Ed25519 private key from `NEWSROOM_SIGNING_KEY_
 * PRIVATE` env var and signs in-process. The interface is shaped
 * so a future real adapter (Google Cloud KMS / AWS KMS / Vault —
 * NR-H1 prerequisite, v1.1 / NR-G5 deliverable) drops in without
 * caller-side changes.
 *
 * Field-name posture (per NR-D10 IP-2 ratification): the adapter's
 * `keyId` parameter maps semantically to the `kid` column in
 * `newsroom_signing_keys`. Env var `NEWSROOM_SIGNING_KEY_ID` holds
 * the kid value the stub adapter signs with — the env-var name
 * documents intent ("the SigningKey row's identifier"); the column
 * is `kid` per PRD §3.2.
 *
 * Spec cross-references:
 *   - directives/NR-D10-signing-keys-receipts.md §F1
 *   - PRD §3.2 SigningKey (verbatim authority for kid + status)
 *   - src/lib/scanner/types.ts (NR-D7b — adapter pattern precedent)
 */

import type { NewsroomSigningKeyStatus } from '@/lib/db/schema'

/**
 * Input to a sign request. `payload` is the bytes the adapter
 * signs verbatim — typically a SHA-256 digest of a canonical
 * payload (see `src/lib/newsroom/receipts.ts` F4). `keyId` is the
 * `newsroom_signing_keys.kid` value the caller wants to sign with.
 *
 * The adapter rejects unknown `keyId` with `KmsError('config')`.
 * Stub: rejects anything other than the env-configured kid.
 */
export interface SignInput {
  payload: Buffer | Uint8Array
  keyId: string
}

export interface SignOutput {
  /** Raw signature bytes (Ed25519 = 64 bytes). */
  signature: Buffer
  /** Echo of the kid signed under, for caller convenience. */
  signingKeyId: string
  /** Locked v1 — only Ed25519 is supported. */
  algorithm: 'ed25519'
}

/**
 * Public-key descriptor the adapter returns for verification.
 * `keyId` is the SigningKey row's `kid`; `publicKeyPem` is
 * SPKI-format PEM the verifier feeds to `crypto.createPublicKey`.
 */
export interface KmsKeyRef {
  keyId: string
  publicKeyPem: string
  status: NewsroomSigningKeyStatus
}

/**
 * The adapter contract. Implementations are server-only (the
 * adapter holds private-key material in process for the stub
 * variant).
 *
 * `id` and `version` are reported in structured logs and audit
 * trails so we can identify which signing impl produced a given
 * receipt during incident response.
 */
export interface KmsAdapter {
  /** e.g. `'stub_v1'`, `'gcp_kms_v1'`. */
  readonly id: string
  /** SemVer of the adapter implementation, not the KMS provider. */
  readonly version: string

  sign(input: SignInput): Promise<SignOutput>
  getPublicKey(keyId: string): Promise<KmsKeyRef>
}

/**
 * Categorised error class. Distinguishes:
 *
 *   - `'config'`     — missing env, unknown kid, malformed key.
 *                      Caller should surface as 5xx config issue;
 *                      retry won't help.
 *   - `'transient'`  — network blip / rate limit (real KMS adapter
 *                      territory; stub never raises this). Caller
 *                      may retry with backoff.
 *   - `'permanent'`  — KMS rejected the operation deterministically
 *                      (e.g. key disabled, IAM denied). Retry won't
 *                      help; surface as 5xx.
 *
 * Stub adapter only raises `'config'`.
 */
export class KmsError extends Error {
  constructor(
    public readonly category: 'config' | 'transient' | 'permanent',
    message: string,
  ) {
    super(message)
    this.name = 'KmsError'
  }
}
