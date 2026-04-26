# NR-D10 — Signing Keys + Receipts + KMS Adapter

**Phase:** NR-2 (Distributor build) — **closes NR-G2**
**Predecessor:** NR-D9c (`613ea43`) — embargo lift worker + subscriber notifications
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~7 new + 1 modified file; route count delta +1 (117 → 118)

---

## 1. Why this directive

NR-D9b's publish flow currently fails at the RPC level with `missing_preconditions: ['no_active_signing_key']` because no `newsroom_signing_keys` row with `status='active'` exists. NR-D10 ships the **signing infrastructure** that closes NR-G2:

- **KMS adapter pattern** (mirrors `getStorageAdapter()` / `getScannerAdapter()`): stub default for closed beta + dev/test, real adapter (Google Cloud KMS / AWS KMS / Vault) deferred to v1.1 / NR-G5 hardening per NR-H1 human prerequisite.
- **Stub KMS adapter** loads Ed25519 private key from env var; signs in-process. Acceptable for closed beta with vetted distributors and OS-level encryption-at-rest.
- **Receipt minting + verification helpers** — PRD §3.2 DownloadReceipt format, called by NR-D11 from the download endpoint when consumer-side ships.
- **Public keyset endpoint** — `GET /api/newsroom/keyset` returns active public keys for third-party receipt verification. No auth.
- **Runbook doc** — one-time dev bootstrap procedure for generating + inserting the first SigningKey row.

**Locked architecture (per founder ratification):**

- KMS adapter: Option A — stub-default with real-KMS deferred. Real adapter is a v1.1 / NR-G5 deliverable, blocked on NR-H1 (KMS tenancy).
- `mintReceipt` helper: Option A — included in NR-D10 as a callable pure helper; NR-D11 wires the download endpoint to call it.

**In scope:**

- KMS adapter interface + stub implementation + factory
- Ed25519 signing function (callable via the adapter)
- `mintReceipt(input) → { payload, signature, signing_key_id }` helper
- `verifyReceipt(receipt, publicKey) → boolean` helper (pure, no KMS dependency)
- Public keyset endpoint
- Bootstrap runbook (founder runs once to seed the first dev SigningKey)
- Tests for adapter + signing + mint + verify
- 2 new env vars: `NEWSROOM_SIGNING_KEY_PRIVATE` (base64-encoded private key) + `NEWSROOM_SIGNING_KEY_ID` (matches a SigningKey row's `kms_key_id`)

**Out of scope (deferred):**

- **Download endpoint integration** — NR-D11. NR-D10 provides `mintReceipt`; NR-D11 calls it + INSERTs the receipt row.
- **Real KMS adapter implementation** (Google Cloud KMS / AWS KMS / Vault) — v1.1 / NR-G5. Stub adapter is the only impl shipping in NR-D10.
- **Key rotation flow** — NR-D19 (admin A7 surface). NR-D10 supports the schema (`status='rotating'`) but doesn't ship rotation UI.
- **Receipt revocation** — not in PRD scope.
- **Signing-key-derived URL token integrity** — separate concern; embargo recipient tokens (NR-D8) are random base64url, not signed.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | **§3.2 SigningKey (line 468) + DownloadReceipt (line 450) — verbatim authority for fields**, §3.4 invariant 5 ("Every download emits a DistributionEvent and a DownloadReceipt (1:1). No silent downloads."), §3.4 invariant 8 (verification-badge snapshot preserved on receipt) |
| NR-D2c-i migration | `supabase/migrations/20260425000004_newsroom_schema_d2c_i.sql` | `newsroom_signing_keys` (line 155), `newsroom_download_receipts` schema; `newsroom_signing_key_status` enum (line 111) |
| Existing schema.ts | `src/lib/db/schema.ts` | Confirm `NewsroomSigningKeyRow`, `NewsroomSigningKeyStatus`, `NewsroomDownloadReceiptRow` types exist |
| NR-D7b adapter precedent | `src/lib/scanner/types.ts` + `src/lib/scanner/index.ts` | Factory pattern to mirror exactly (env-driven driver selection) |
| NR-D5b-i HMAC precedent | `src/lib/newsroom/verification.ts` | Crypto helper pattern (`createHmac`, env secret loading); receipt module mirrors style |
| NR-H1 | `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` line 85 | KMS tenancy human prerequisite (blocks v1.1 / NR-G5; NR-D10 ships without it via stub) |

PRD §3.2 SigningKey + DownloadReceipt are verbatim authority for column names, types, and semantic meaning of every field.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) `newsroom_signing_keys` table exists from NR-D2c-i (confirmed by NR-D9a audit (d)). Status enum has `'active'`.
- (P2) NR-D7b's scanner adapter is the structural template: `src/lib/scanner/{types,index,stub-adapter,gcv-safesearch-adapter}.ts`. NR-D10's KMS adapter mirrors that shape.
- (P3) Vercel cron cap (2/2) does NOT bind here — NR-D10 has no cron requirement. Public keyset endpoint is a normal GET route.
- (P4) `.env.local` JWT drift (NR-D7b v1.1 backlog) does NOT block NR-D10 — the keyset endpoint is no-auth + service-role free; the stub KMS signing is in-process; no supabase-js path that would hit PGRST301.

### Audit checks to run

#### (a) `newsroom_signing_keys` schema confirmation
- Confirm columns from migration NR-D2c-i: `id, public_key (text or bytea), kms_key_id (text), status (newsroom_signing_key_status), created_at, activated_at, revoked_at`. PRD §3.2 line 468 is canonical.
- Specifically confirm `kms_key_id` column exists (used as the KMS adapter's key reference). If missing, surface as IP — would require mini-migration.
- Confirm `at-most-one-active` invariant exists (per NR-D2c-i exit report mentioned partial unique index). If yes, F4 / runbook bootstrap must respect it.

#### (b) `newsroom_download_receipts` schema confirmation
- PRD §3.2 line 450 is canonical. Confirm columns: `id, asset_id, recipient_id (nullable for anonymous), downloaded_at, verification_tier_at_download (enum snapshot), signature (text or bytea), signing_key_id (FK)`.
- NR-D10 doesn't INSERT into this table (NR-D11 does); only `mintReceipt` helper produces a structured object ready for INSERT.

#### (c) Schema.ts row types
- Confirm `NewsroomSigningKeyRow`, `NewsroomSigningKeyStatus`, `NewsroomDownloadReceiptRow` exported. Likely present from NR-D2c-i appends. If missing, F-something appends.

#### (d) Ed25519 in node:crypto
- Confirm `crypto.generateKeyPairSync('ed25519')` + `crypto.sign(null, payload, privateKey)` work in Node 22. Standard since Node 12; should be fine.
- Confirm key serialization: PEM via `privateKey.export({type: 'pkcs8', format: 'pem'})` is the canonical Node format. Stub adapter reads PEM-format private key from env, parses with `crypto.createPrivateKey(pem)`.

#### (e) Receipt canonical-payload format
- PRD doesn't specify the canonical-payload byte format for signing. NR-D10 locks: pipe-concatenated UTF-8 bytes of `${asset_id}|${recipient_id ?? 'anon'}|${downloaded_at_iso}|${verification_tier}|${signing_key_id}` → SHA-256 → Ed25519 signature over the digest.
- Surface as IP if a more elaborate format (canonical JSON, CBOR) is preferred. Recommend the simple format for v1.

#### (f) `at-most-one-active` for NR-D10 dev seeding
- If the partial unique index exists, the bootstrap runbook can only insert one active key per environment (good — prevents accidental key proliferation).
- If multiple SigningKey rows are needed for testing rotation (NR-D19 territory), one active + N revoked is the supported pattern.

### Audit deliverable

Findings table + IPs + locked file list. HALT before composing.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `src/lib/newsroom/kms/types.ts` | NEW — `KmsAdapter` interface + types (`SignInput`, `SignOutput`, `KmsKeyRef`); `KmsError` class | ~80 |
| F2 | `src/lib/newsroom/kms/stub-adapter.ts` | NEW — `StubKmsAdapter`: reads PEM private key from `env.NEWSROOM_SIGNING_KEY_PRIVATE`, signs in-process via `crypto.sign('ed25519', ...)` | ~140 |
| F3 | `src/lib/newsroom/kms/index.ts` | NEW — `getKmsAdapter()` factory + re-exports. Returns stub when `NEWSROOM_SIGNING_KEY_PRIVATE` is set; throws clear error otherwise | ~70 |
| F4 | `src/lib/newsroom/receipts.ts` | NEW — `'server-only'`; `mintReceipt(input) → ReceiptPayload`, `verifyReceipt(receipt, publicKeyPem) → boolean`, canonical-payload format, KMS adapter integration | ~180 |
| F5 | `src/lib/newsroom/__tests__/receipts.test.ts` | NEW — vitest cases: stub adapter sign/verify roundtrip, mintReceipt structure, verifyReceipt true/false cases, env-missing throw | ~220 |
| F6 | `src/app/.well-known/receipt-keys/route.ts` | NEW (per IP-3 PRD path) — `GET` route, no auth; queries `newsroom_signing_keys WHERE status IN ('active','rotated')`; returns `{ keys: [{ kid, public_key_pem, algorithm, status, created_at, rotated_at }, ...] }` per RFC 8615 .well-known | ~120 |
| F7 | `src/lib/env.ts` | EDIT — add `NEWSROOM_SIGNING_KEY_PRIVATE` (PEM string, optional in dev/required in prod) + `NEWSROOM_SIGNING_KEY_ID` (string identifier matching SigningKey row's `kms_key_id`) | +25 |
| F8 | `docs/runbooks/newsroom-signing-key-bootstrap.md` | NEW — one-time dev bootstrap procedure: generate Ed25519 keypair, base64-encode private, INSERT SigningKey row, set env vars | ~120 |

Totals: 7 NEW + 1 EDIT = 8 conceptual deliverables; +1 route (`/api/newsroom/keyset`); 117 → 118.

**No migration in this directive** — `newsroom_signing_keys` and `newsroom_download_receipts` already exist from NR-D2c-i. The first SigningKey row is inserted via the runbook (founder runs once for dev), not via migration (private keys never in version control).

**Schema corrections applied per audit (IP-1 + IP-2):**
- `newsroom_signing_keys` real columns: `(id, kid, algorithm, public_key_pem, private_key_ref, status, rotated_at, revoked_at, created_at, updated_at)` — NOT the directive's earlier sketch (`kms_key_id`, `public_key`, `activated_at`).
- `newsroom_download_receipts` real columns: `(id, distribution_event_id [UNIQUE FK], pack_id, asset_id, recipient_id, licence_class, credit_line, terms_summary, content_hash_sha256, signing_key_kid [FK], signed_at, signature, receipt_url)` — much richer than the directive's earlier sketch. PRD §3.2 verbatim authority.
- `private_key_ref` = opaque KMS reference URI: stub uses `'env://NEWSROOM_SIGNING_KEY_PRIVATE'`; production KMS uses e.g. `'gcp-kms://projects/.../cryptoKeys/...'`.
- `kid` = JWK-convention key ID; populated from env var `NEWSROOM_SIGNING_KEY_ID` (semantic name retained).
- F4 `mintReceipt` produces a row-shaped payload matching the real receipt schema; NR-D11 INSERTs.
- F8 runbook INSERTs with real columns: `(id, kid, algorithm, public_key_pem, private_key_ref, status)`.

---

## 5. F-specs

### F1 — `src/lib/newsroom/kms/types.ts` (NEW)

```ts
import type { NewsroomSigningKeyStatus } from '@/lib/db/schema'

export interface SignInput {
  payload: Buffer | Uint8Array  // bytes to sign (typically a SHA-256 digest of canonical payload)
  keyId: string                 // matches SigningKey.kms_key_id
}

export interface SignOutput {
  signature: Buffer             // raw signature bytes
  signingKeyId: string          // echoed for verification convenience
  algorithm: 'ed25519'          // locked v1
}

export interface KmsKeyRef {
  keyId: string                 // matches SigningKey.kms_key_id
  publicKeyPem: string          // PEM-encoded Ed25519 public key
  status: NewsroomSigningKeyStatus
}

export interface KmsAdapter {
  readonly id: string                                 // e.g. 'stub_v1', 'gcp_kms_v1'
  readonly version: string                            // e.g. '1.0.0'
  sign(input: SignInput): Promise<SignOutput>
  getPublicKey(keyId: string): Promise<KmsKeyRef>     // for verification + keyset endpoint
}

export class KmsError extends Error {
  constructor(
    public readonly category: 'config' | 'transient' | 'permanent',
    message: string,
  ) {
    super(message)
    this.name = 'KmsError'
  }
}
```

### F2 — `src/lib/newsroom/kms/stub-adapter.ts` (NEW)

```ts
import 'server-only'
import { createPrivateKey, createPublicKey, sign as cryptoSign } from 'node:crypto'

import { env } from '@/lib/env'

import { KmsError } from './types'
import type { KmsAdapter, KmsKeyRef, SignInput, SignOutput } from './types'

/**
 * Stub KMS adapter — loads the Ed25519 private key from
 * NEWSROOM_SIGNING_KEY_PRIVATE env var (PEM-encoded, base64-decoded).
 *
 * Acceptable for closed beta with vetted distributors; private key
 * lives in env (encrypted at rest by the OS / hosting provider's
 * env-secret store). Production hardening (real KMS — Google Cloud
 * KMS / AWS KMS / Vault) deferred to v1.1 per NR-H1 prerequisite.
 *
 * The stub adapter is single-key: it serves whatever private key the
 * env var holds. NEWSROOM_SIGNING_KEY_ID provides the matching SigningKey
 * row's kms_key_id (used to resolve which DB row this key corresponds to).
 *
 * Throws `KmsError('config', ...)` if env vars missing.
 */
export class StubKmsAdapter implements KmsAdapter {
  readonly id = 'stub_v1'
  readonly version = '1.0.0'

  private readonly privateKey: ReturnType<typeof createPrivateKey>
  private readonly publicKey: ReturnType<typeof createPublicKey>
  private readonly keyId: string

  constructor() {
    if (!env.NEWSROOM_SIGNING_KEY_PRIVATE) {
      throw new KmsError('config', 'NEWSROOM_SIGNING_KEY_PRIVATE is not set. See docs/runbooks/newsroom-signing-key-bootstrap.md.')
    }
    if (!env.NEWSROOM_SIGNING_KEY_ID) {
      throw new KmsError('config', 'NEWSROOM_SIGNING_KEY_ID is not set. See bootstrap runbook.')
    }

    // Decode base64-encoded PEM
    const pem = Buffer.from(env.NEWSROOM_SIGNING_KEY_PRIVATE, 'base64').toString('utf8')
    this.privateKey = createPrivateKey(pem)
    this.publicKey = createPublicKey(this.privateKey)
    this.keyId = env.NEWSROOM_SIGNING_KEY_ID
  }

  async sign(input: SignInput): Promise<SignOutput> {
    if (input.keyId !== this.keyId) {
      throw new KmsError('config', `StubKmsAdapter only signs with keyId='${this.keyId}', got '${input.keyId}'.`)
    }
    // Ed25519 in node: sign(null, payload, privateKey) — algorithm derived from key type
    const signature = cryptoSign(null, Buffer.from(input.payload), this.privateKey)
    return { signature, signingKeyId: this.keyId, algorithm: 'ed25519' }
  }

  async getPublicKey(keyId: string): Promise<KmsKeyRef> {
    if (keyId !== this.keyId) {
      throw new KmsError('config', `StubKmsAdapter only knows keyId='${this.keyId}', got '${keyId}'.`)
    }
    const publicKeyPem = this.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    return { keyId, publicKeyPem, status: 'active' }
  }
}
```

### F3 — `src/lib/newsroom/kms/index.ts` (NEW)

```ts
import { env } from '@/lib/env'

import { StubKmsAdapter } from './stub-adapter'
import type { KmsAdapter } from './types'

export type { KmsAdapter, KmsKeyRef, SignInput, SignOutput } from './types'
export { KmsError } from './types'
export { StubKmsAdapter } from './stub-adapter'

let cachedAdapter: KmsAdapter | null = null

/**
 * Returns the configured KMS adapter. Cached after first call (per process)
 * since key-loading + parse is non-trivial.
 *
 * v1: only StubKmsAdapter is implemented. v1.1 / NR-G5: real adapter
 * (GCP KMS / AWS KMS / Vault) added; selection driven by additional env
 * vars (e.g. KMS_DRIVER='gcp', KMS_PROJECT_ID=...).
 */
export function getKmsAdapter(): KmsAdapter {
  if (cachedAdapter) return cachedAdapter
  // v1: always stub
  cachedAdapter = new StubKmsAdapter()
  return cachedAdapter
}

// Test helper: reset the cached adapter (used by vitest to test config errors)
export function _resetKmsAdapterCache(): void {
  cachedAdapter = null
}
```

### F4 — `src/lib/newsroom/receipts.ts` (NEW)

```ts
import 'server-only'
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto'

import type { NewsroomVerificationTier } from '@/lib/db/schema'

import { getKmsAdapter } from './kms'

export interface ReceiptMintInput {
  assetId: string
  recipientId: string | null            // null = anonymous download
  downloadedAt: Date
  verificationTier: NewsroomVerificationTier  // snapshot of org tier at download time
}

export interface ReceiptPayload {
  asset_id: string
  recipient_id: string | null
  downloaded_at: string                 // ISO 8601
  verification_tier_at_download: NewsroomVerificationTier
  signing_key_id: string
  signature: string                     // base64-encoded Ed25519 signature
  algorithm: 'ed25519'
  canonical_payload: string             // for audit: the exact bytes that were signed (hex SHA-256 digest)
}

/**
 * Canonical-payload format (locked v1):
 *   `${asset_id}|${recipient_id ?? 'anon'}|${downloaded_at_iso}|${verification_tier}|${signing_key_id}`
 * → UTF-8 bytes → SHA-256 digest → Ed25519 signature over the digest.
 *
 * Verification: same concat → same digest → cryptoVerify with public key.
 *
 * Pipe-separator chosen for human-debuggability + no-encoding-needed (none of
 * the field types contain pipes). Format is locked for v1 — receipts minted
 * with this format must be verifiable forever, so any future format change
 * requires an `algorithm`-prefixed migration path.
 */
function buildCanonicalDigest(input: {
  assetId: string
  recipientId: string | null
  downloadedAt: Date
  verificationTier: NewsroomVerificationTier
  signingKeyId: string
}): Buffer {
  const concat = [
    input.assetId,
    input.recipientId ?? 'anon',
    input.downloadedAt.toISOString(),
    input.verificationTier,
    input.signingKeyId,
  ].join('|')
  return createHash('sha256').update(concat, 'utf8').digest()
}

export async function mintReceipt(input: ReceiptMintInput): Promise<ReceiptPayload> {
  const adapter = getKmsAdapter()
  const signingKeyId = process.env.NEWSROOM_SIGNING_KEY_ID  // already validated by adapter constructor
  if (!signingKeyId) {
    throw new Error('mintReceipt: NEWSROOM_SIGNING_KEY_ID not set')
  }

  const digest = buildCanonicalDigest({
    assetId: input.assetId,
    recipientId: input.recipientId,
    downloadedAt: input.downloadedAt,
    verificationTier: input.verificationTier,
    signingKeyId,
  })

  const { signature } = await adapter.sign({ payload: digest, keyId: signingKeyId })

  return {
    asset_id: input.assetId,
    recipient_id: input.recipientId,
    downloaded_at: input.downloadedAt.toISOString(),
    verification_tier_at_download: input.verificationTier,
    signing_key_id: signingKeyId,
    signature: signature.toString('base64'),
    algorithm: 'ed25519',
    canonical_payload: digest.toString('hex'),
  }
}

export function verifyReceipt(receipt: ReceiptPayload, publicKeyPem: string): boolean {
  if (receipt.algorithm !== 'ed25519') return false

  // Re-derive the digest from the receipt's claimed fields
  const digest = buildCanonicalDigest({
    assetId: receipt.asset_id,
    recipientId: receipt.recipient_id,
    downloadedAt: new Date(receipt.downloaded_at),
    verificationTier: receipt.verification_tier_at_download,
    signingKeyId: receipt.signing_key_id,
  })

  // Sanity: claimed canonical_payload must match re-derived digest
  if (digest.toString('hex') !== receipt.canonical_payload) return false

  const publicKey = createPublicKey(publicKeyPem)
  const signatureBytes = Buffer.from(receipt.signature, 'base64')

  return cryptoVerify(null, digest, publicKey, signatureBytes)
}
```

### F5 — `__tests__/receipts.test.ts` (NEW)

Vitest cases:

**Stub adapter (uses test-keypair generated in beforeAll):**
- `sign` returns Buffer; `signingKeyId` matches; `algorithm` = 'ed25519'
- `sign` throws `KmsError('config')` when `keyId` doesn't match
- `getPublicKey` returns valid PEM
- Constructor throws when `NEWSROOM_SIGNING_KEY_PRIVATE` missing
- Constructor throws when `NEWSROOM_SIGNING_KEY_ID` missing

**mintReceipt:**
- Returns valid `ReceiptPayload` with all fields populated
- Anonymous (recipient_id null) handled correctly
- Each tier value (unverified / verified_source / verified_publisher) included verbatim in payload

**verifyReceipt:**
- Round-trip: `mintReceipt` → `verifyReceipt` → true
- Tampered signature → false
- Tampered asset_id → false (canonical_payload mismatch)
- Tampered downloaded_at → false
- Wrong public key → false
- Wrong algorithm → false
- Anonymous receipt round-trip → true

**Canonical payload format invariance:**
- Same inputs → identical digest (deterministic)
- Order of fields in input doesn't matter (only canonical concat order matters)

Aim for 18–22 cases.

### F6 — `/api/newsroom/keyset/route.ts` (NEW)

```ts
import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'

export const runtime = 'nodejs'

interface PublicKeyEntry {
  signing_key_id: string  // matches kms_key_id
  public_key_pem: string
  status: 'active' | 'rotating'  // revoked excluded from public keyset
  activated_at: string
}

/**
 * Public keyset endpoint. No auth — third parties verifying download
 * receipts need to fetch the active public key set without
 * authentication.
 *
 * Returns active + rotating keys (revoked excluded — receipts signed
 * with a revoked key are no longer trusted, but historical receipts
 * remain verifiable via archive endpoints — out of scope for v1).
 *
 * Response shape: JSON Web Key Set (JWKS-inspired but simpler):
 *   { keys: [{ signing_key_id, public_key_pem, status, activated_at }, ...] }
 */
export async function GET() {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('newsroom_signing_keys')
    .select('kms_key_id, public_key, status, activated_at')
    .in('status', ['active', 'rotating'])
    .order('activated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'keyset-fetch-failed' }, { status: 500 })
  }

  const keys: PublicKeyEntry[] = (data ?? []).map((row) => ({
    signing_key_id: row.kms_key_id,
    public_key_pem: row.public_key,
    status: row.status,
    activated_at: row.activated_at,
  }))

  return NextResponse.json({ keys }, {
    status: 200,
    headers: {
      // Cache for 5 minutes; verifiers should refresh periodically but
      // not hammer the endpoint.
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  })
}
```

### F7 — `src/lib/env.ts` (EDIT)

```ts
NEWSROOM_SIGNING_KEY_PRIVATE: z.string().min(1).optional(),  // base64-encoded PEM; required in production for publish
NEWSROOM_SIGNING_KEY_ID: z.string().min(1).optional(),       // matches SigningKey row's kms_key_id
```

`.env.example` documents both with comments pointing at the bootstrap runbook.

### F8 — `docs/runbooks/newsroom-signing-key-bootstrap.md` (NEW)

```markdown
# Newsroom Signing Key Bootstrap (Dev / Closed Beta)

One-time procedure to seed the first active SigningKey row for the
Newsroom publish flow. Required for any publish attempt to succeed
(precondition: at least one `newsroom_signing_keys` row with
`status='active'`).

Production (NR-G5): replaced by the real KMS provisioning runbook
(NR-H1). This runbook is for dev + closed beta only.

## 1. Generate Ed25519 keypair

```bash
openssl genpkey -algorithm ed25519 -out /tmp/newsroom-signing.pem
```

## 2. Extract base64-encoded private (for env var)

```bash
base64 < /tmp/newsroom-signing.pem | tr -d '\n'
```

Copy the output. This is your `NEWSROOM_SIGNING_KEY_PRIVATE`.

## 3. Extract PEM-encoded public (for DB)

```bash
openssl pkey -in /tmp/newsroom-signing.pem -pubout
```

Copy the multi-line output. This is the `public_key` column.

## 4. Set env vars in `.env.local`

```
NEWSROOM_SIGNING_KEY_PRIVATE="<paste base64 from step 2>"
NEWSROOM_SIGNING_KEY_ID="dev-signing-key-1"
```

## 5. INSERT the SigningKey row

```bash
psql $DATABASE_URL -c "
INSERT INTO newsroom_signing_keys (id, public_key, kms_key_id, status, activated_at)
VALUES (
  gen_random_uuid(),
  '<paste public PEM from step 3 — multi-line OK>',
  'dev-signing-key-1',
  'active',
  now()
);
"
```

## 6. Restart dev server

```bash
# Kill existing dev server, then:
bun run dev
```

## 7. Clean up

```bash
rm /tmp/newsroom-signing.pem
```

The private key now lives only in `.env.local` (gitignored) and in the
running Node process. Public key + key ID are in the DB.

## Verification

Hit the public keyset endpoint:

```bash
curl http://localhost:3000/api/newsroom/keyset | jq
```

Expected: `{ keys: [{ signing_key_id: 'dev-signing-key-1', public_key_pem: '...', status: 'active', activated_at: '...' }] }`.

## Rotation (NR-D19 territory)

Key rotation is admin-side (NR-D19). For dev: insert a second key with
`status='active'` (the partial unique index will reject) — instead,
flip the existing key's `status` to `'rotating'` first, then insert
the new one. Document supersession in admin audit when NR-D19 lands.
```

---

## 6. New env vars

`NEWSROOM_SIGNING_KEY_PRIVATE` (base64 PEM, optional in dev / required in production for publish to succeed).
`NEWSROOM_SIGNING_KEY_ID` (string identifier, optional in dev).

Both documented in `.env.example` with pointer to the runbook.

---

## 7. VERIFY block

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/newsroom/__tests__/receipts.test.ts` — green.
3. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full suite green; prior 305/305 still passing.
4. `bun run build` exit 0; route count 117 → 118.
5. **Bounce dev server** (env vars added).
6. Curl smoke (no auth needed for keyset):
   - `GET /api/newsroom/keyset` → 200 with `{ keys: [...] }`. If founder has not yet run the bootstrap runbook, the array is empty `{ keys: [] }` — that's the expected fresh-DB response.
7. Bootstrap smoke (founder runs the runbook):
   - Follow steps 1–7 of `docs/runbooks/newsroom-signing-key-bootstrap.md`
   - Re-curl keyset → array now has 1 entry
   - Attempt a publish via the existing UI flow (or call transitionPack directly via psql) — `'no_active_signing_key'` precondition no longer fires
8. Visual smoke deferred (inherits `.env.local` JWT v1.1 backlog; the keyset endpoint itself works since it's no-auth + service-role).
9. Scope diff: `git status --porcelain` shows exactly 8 paths (1M + 7??).

---

## 8. Exit report mandate

`docs/audits/NR-D10-signing-keys-receipts-EXIT-REPORT.md`. Standard sections + explicit founder action item: "Run the bootstrap runbook before NR-G2 closure validation."

---

## 9. Standing carry-forward checks

- Audit-first IP discipline.
- KMS adapter mirrors scanner adapter pattern; v1 stub only, real adapter is v1.1 / NR-G5 deliverable.
- Receipt canonical-payload format (per IP-4 audit correction):
  ```
  ${pack_id}|${asset_id ?? 'pack'}|${recipient_id ?? 'anon'}|${licence_class}|${credit_line}|${terms_summary}|${content_hash_sha256}|${signing_key_kid}|${signed_at_iso}|${distribution_event_id}
  ```
  → UTF-8 bytes → SHA-256 digest → Ed25519 signature over digest. **LOCKED v1.** Any future format change requires an `algorithm`-prefixed migration path; receipts minted today must remain verifiable forever. Format covers all PRD §3.2 receipt snapshot fields establishing legal provenance (licence + credit + terms + content hash + recipient).
- Public keyset endpoint is no-auth + cached for 5 minutes.
- runtime='nodejs' on F6.
- Service-role client for keyset query (mirrors NR-D6a posture for newsroom_* reads).
- New env vars added to `.env.example` with comments + runbook pointer.
- Tight per-directive commits; selective add of exactly 10 paths (8 deliverables + directive + exit report). DIRECTIVE_SEQUENCE.md update if new v1.1 items emerge.

---

## 10. Predecessor sequence

NR-D9c (`613ea43`) → **NR-D10 — this directive** → **NR-G2 phase gate** (verified company can create + embargo + publish a Pack with signed receipts).

After NR-D10 commits AND the founder runs the bootstrap runbook, NR-G2 can be validated end-to-end:
1. Sign up + verify domain (NR-D5 ✓)
2. Create Pack + add assets + configure embargo (NR-D6 + D7 + D8 ✓)
3. Confirm rights warranty + publish (NR-D9b ✓)
4. Auto-lift embargo + notify subscribers (NR-D9c ✓)
5. Public keyset endpoint serves the active signing key (NR-D10 ← this directive)
6. Receipt minting helper callable from NR-D11 download endpoint (NR-D10 ← this directive)

NR-G2 closure marks Phase NR-2 complete. Phase NR-3 (consumer-side: public Pack pages, preview resolver, journalist accounts) opens next.

---

End of NR-D10 directive.
