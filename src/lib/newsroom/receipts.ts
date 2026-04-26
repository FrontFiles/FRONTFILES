/**
 * Frontfiles — Receipt minting + verification (NR-D10, F4)
 *
 * Produces tamper-evident DownloadReceipt records per PRD §3.2.
 * Two pure functions:
 *
 *   - `mintReceipt(input) → MintedReceipt`
 *     Builds the canonical-payload digest, signs via the KMS
 *     adapter, and returns a row-shaped object ready for INSERT
 *     into `newsroom_download_receipts` (NR-D11 owns the INSERT).
 *
 *   - `verifyReceipt(receipt, publicKeyPem) → boolean`
 *     Re-derives the canonical digest from the receipt's claimed
 *     fields and verifies the signature. Pure — no KMS adapter
 *     dependency. Used by third-party verifiers (and our own
 *     tests).
 *
 * IP-1 ratification (2026-04-26): output shape matches the real
 * `newsroom_download_receipts` table (per `NewsroomDownloadReceiptRow`
 * minus auto-generated `id`/`created_at`). Caller (NR-D11) provides
 * snapshot fields; this helper appends `signing_key_kid`, `signed_at`,
 * `signature`.
 *
 * IP-4 ratification (2026-04-26) — canonical-payload format LOCKED v1:
 *
 *   `${pack_id}|${asset_id ?? 'pack'}|${recipient_id ?? 'anon'}|
 *    ${licence_class}|${credit_line}|${terms_summary}|
 *    ${content_hash_sha256}|${signing_key_kid}|${signed_at_iso}|
 *    ${distribution_event_id}`
 *   → UTF-8 → SHA-256 → Ed25519 over the digest.
 *
 * **Format change requires an algorithm-prefixed migration path —
 * receipts shipped today must remain verifiable forever.** Any
 * future v1.x or v2 with a different canonical form must coexist
 * with the v1 form via algorithm-discrimination at verify time.
 *
 * Spec cross-references:
 *   - directives/NR-D10-signing-keys-receipts.md §F4
 *   - PRD §3.2 DownloadReceipt (verbatim authority for fields)
 *   - PRD §3.4 invariant 5 (1:1 receipt-per-download)
 *   - src/lib/newsroom/kms/* (adapter)
 */

import 'server-only'

import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
} from 'node:crypto'

import type { NewsroomLicenceClass } from '@/lib/db/schema'

import { getKmsAdapter } from './kms'

// ── Public types ───────────────────────────────────────────────

/**
 * Snapshot fields the caller (NR-D11 download endpoint) provides
 * at receipt-mint time. The shape mirrors `newsroom_download_
 * receipts` minus auto-generated columns and minus
 * adapter-generated columns (`signing_key_kid`, `signed_at`,
 * `signature`). The adapter provides those; this object plus
 * those three is the row to INSERT.
 *
 * `asset_id` is nullable — a pack-level download receipt (zip of
 * all assets) has no single asset_id.
 *
 * `recipient_id` is nullable — anonymous downloads have no
 * recipient row.
 *
 * `distribution_event_id` is the FK to the corresponding
 * `newsroom_distribution_events` row. The receipts table has a
 * UNIQUE constraint on this column (1:1 enforced).
 */
export interface ReceiptMintInput {
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  distribution_event_id: string
  licence_class: NewsroomLicenceClass
  credit_line: string
  terms_summary: string
  content_hash_sha256: string
  /**
   * Public retrievable receipt URL. Caller computes this (e.g.
   * `${RECEIPT_BASE_URL}/${distribution_event_id}`) and passes
   * in. Stored verbatim in the row; covered by the signature so a
   * verifier can confirm the URL hasn't been tampered with.
   *
   * NOTE: receipt_url is included in the row but NOT in the
   * canonical signed payload (per IP-4 ratification). The URL is a
   * convenience pointer; the receipt's authenticity rests on
   * `distribution_event_id` + `content_hash_sha256` being
   * tamper-evident.
   */
  receipt_url: string
}

/**
 * Output: row-shaped object ready for INSERT (with the auto-
 * generated `id` + `created_at` filled by the DB defaults). The
 * caller's INSERT specifies all of these columns explicitly.
 */
export interface MintedReceipt {
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  distribution_event_id: string
  licence_class: NewsroomLicenceClass
  credit_line: string
  terms_summary: string
  content_hash_sha256: string
  signing_key_kid: string
  signed_at: string
  /** Base64-encoded Ed25519 signature over the canonical digest. */
  signature: string
  receipt_url: string
}

// ── Canonical payload ──────────────────────────────────────────

/**
 * IP-4 LOCKED format. Field order matches PRD §3.2 column order
 * (less algorithmic noise + receipt_url). Pipe separator: none of
 * the contained string types contain a pipe in valid use.
 *
 * Inputs to this function are the exact values that go into the
 * stored row — verifier re-derives by reading the row, applying
 * this same transform, and comparing the resulting digest's
 * signature.
 */
function buildCanonicalDigest(args: {
  pack_id: string
  asset_id: string | null
  recipient_id: string | null
  licence_class: NewsroomLicenceClass
  credit_line: string
  terms_summary: string
  content_hash_sha256: string
  signing_key_kid: string
  signed_at: string
  distribution_event_id: string
}): Buffer {
  const concat = [
    args.pack_id,
    args.asset_id ?? 'pack',
    args.recipient_id ?? 'anon',
    args.licence_class,
    args.credit_line,
    args.terms_summary,
    args.content_hash_sha256,
    args.signing_key_kid,
    args.signed_at,
    args.distribution_event_id,
  ].join('|')
  return createHash('sha256').update(concat, 'utf8').digest()
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Build + sign a DownloadReceipt. Caller is responsible for:
 *   - INSERTing the resulting row into `newsroom_download_receipts`
 *   - The 1:1 invariant via the UNIQUE constraint on
 *     `distribution_event_id` (PG raises 23505 on duplicate)
 *   - Concurrency: NR-D11's download flow runs the INSERT inside
 *     the same transaction that emits the DistributionEvent row.
 *
 * `signed_at` is set here from `Date.now()` — the receipt's stored
 * `signed_at` timestamp is always when the signature was computed.
 *
 * The KMS adapter is resolved via `getKmsAdapter()` and the
 * adapter's `sign` is awaited. v1 stub: synchronous in practice
 * (no I/O); the async signature future-proofs for v1.1 KMS.
 */
export async function mintReceipt(
  input: ReceiptMintInput,
): Promise<MintedReceipt> {
  const adapter = getKmsAdapter()

  // Resolve the kid via the adapter — for the stub, this is the
  // single env-configured kid. Real KMS would consult the
  // currently-active key.
  const adapterKey = await adapter.getPublicKey(
    process.env.NEWSROOM_SIGNING_KEY_ID ?? '',
  )
  const signing_key_kid = adapterKey.keyId

  // signed_at must be the same value in both the canonical-payload
  // AND the stored row, or verification fails. Compute once.
  const signed_at = new Date().toISOString()

  const digest = buildCanonicalDigest({
    pack_id: input.pack_id,
    asset_id: input.asset_id,
    recipient_id: input.recipient_id,
    licence_class: input.licence_class,
    credit_line: input.credit_line,
    terms_summary: input.terms_summary,
    content_hash_sha256: input.content_hash_sha256,
    signing_key_kid,
    signed_at,
    distribution_event_id: input.distribution_event_id,
  })

  const { signature } = await adapter.sign({
    payload: digest,
    keyId: signing_key_kid,
  })

  return {
    pack_id: input.pack_id,
    asset_id: input.asset_id,
    recipient_id: input.recipient_id,
    distribution_event_id: input.distribution_event_id,
    licence_class: input.licence_class,
    credit_line: input.credit_line,
    terms_summary: input.terms_summary,
    content_hash_sha256: input.content_hash_sha256,
    signing_key_kid,
    signed_at,
    signature: signature.toString('base64'),
    receipt_url: input.receipt_url,
  }
}

/**
 * Verify a stored receipt against a public key (PEM, SPKI format).
 * Pure: no KMS dependency. Returns true iff:
 *   1. The receipt's `signed_at` parses and re-creates the same
 *      digest as was originally signed.
 *   2. The signature decodes from base64.
 *   3. `cryptoVerify` confirms the signature against the public key.
 *
 * Wrong key, tampered fields, decoding errors all return false —
 * never throw. Verifier code paths must treat this as a binary
 * trust gate.
 *
 * The function does NOT check `signing_key_kid` against any DB
 * row — verifiers fetch the public key by kid from the keyset
 * endpoint (`/.well-known/receipt-keys`), then call this function
 * with that PEM.
 */
export function verifyReceipt(
  receipt: Pick<
    MintedReceipt,
    | 'pack_id'
    | 'asset_id'
    | 'recipient_id'
    | 'distribution_event_id'
    | 'licence_class'
    | 'credit_line'
    | 'terms_summary'
    | 'content_hash_sha256'
    | 'signing_key_kid'
    | 'signed_at'
    | 'signature'
  >,
  publicKeyPem: string,
): boolean {
  let digest: Buffer
  try {
    digest = buildCanonicalDigest({
      pack_id: receipt.pack_id,
      asset_id: receipt.asset_id,
      recipient_id: receipt.recipient_id,
      licence_class: receipt.licence_class,
      credit_line: receipt.credit_line,
      terms_summary: receipt.terms_summary,
      content_hash_sha256: receipt.content_hash_sha256,
      signing_key_kid: receipt.signing_key_kid,
      signed_at: receipt.signed_at,
      distribution_event_id: receipt.distribution_event_id,
    })
  } catch {
    return false
  }

  let signatureBytes: Buffer
  try {
    signatureBytes = Buffer.from(receipt.signature, 'base64')
  } catch {
    return false
  }

  let publicKey
  try {
    publicKey = createPublicKey(publicKeyPem)
  } catch {
    return false
  }

  try {
    return cryptoVerify(null, digest, publicKey, signatureBytes)
  } catch {
    return false
  }
}

// ── Test-internal export ───────────────────────────────────────

/**
 * Exported for the F5 test suite to validate canonical-payload
 * determinism. Not part of the public API; consumers should use
 * `mintReceipt` / `verifyReceipt`.
 */
export const _internal = { buildCanonicalDigest }
