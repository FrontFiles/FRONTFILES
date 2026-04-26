# Newsroom Signing Key Bootstrap (Dev / Closed Beta)

One-time procedure to seed the first active SigningKey row for the
Newsroom publish flow. Required for any publish attempt to succeed
(precondition: at least one `newsroom_signing_keys` row with
`status='active'`, plus matching env vars on the running server).

**Audience:** founder + dev environment operators.
**Frequency:** once per environment (dev, staging, etc.). Production
(NR-G5) replaces this runbook with the real KMS provisioning runbook
(NR-H1 prerequisite). Until then, `StubKmsAdapter` reads the
private key from env.

**Pre-reqs:** `psql` connected to the local Supabase, `openssl`,
write access to `.env.local`.

---

## 1. Generate an Ed25519 keypair

```bash
openssl genpkey -algorithm ed25519 -out /tmp/newsroom-signing.pem
```

The output is a PEM-encoded PKCS8 private key. Treat the file as a
secret — it goes into `.env.local` (gitignored) shortly and gets
deleted from disk after.

## 2. Extract the base64-encoded private (for env var)

```bash
base64 < /tmp/newsroom-signing.pem | tr -d '\n'
```

Copy the output. This becomes `NEWSROOM_SIGNING_KEY_PRIVATE` in
step 4. (`tr -d '\n'` strips line breaks so the value sits on one
env-file line.)

## 3. Extract the PEM-encoded public (for the DB)

```bash
openssl pkey -in /tmp/newsroom-signing.pem -pubout
```

Copy the multi-line output. This becomes the `public_key_pem`
column in step 5. The whole `-----BEGIN PUBLIC KEY-----` /
`-----END PUBLIC KEY-----` block (including line breaks) goes
into the DB verbatim.

## 4. Set env vars in `.env.local`

Append to `.env.local`:

```
NEWSROOM_SIGNING_KEY_PRIVATE="<paste base64 output from step 2>"
NEWSROOM_SIGNING_KEY_ID="dev-signing-key-1"
```

`NEWSROOM_SIGNING_KEY_ID` is a freeform string identifier that
populates the `kid` column. The default value `dev-signing-key-1`
satisfies the `kid` CHECK constraint format
(`^[A-Za-z0-9_-]{8,128}$`). You can pick another value
(e.g. `nr-20260426-1`) — just make sure it matches the value you
INSERT in step 5.

## 5. INSERT the SigningKey row

The table columns (from migration 20260425000004 / NR-D2c-i) are:

| Column | Value |
|---|---|
| `id` | auto (`gen_random_uuid()`) |
| `kid` | matches `NEWSROOM_SIGNING_KEY_ID` |
| `algorithm` | `'ed25519'` (default; can omit) |
| `public_key_pem` | from step 3 |
| `private_key_ref` | `'env://NEWSROOM_SIGNING_KEY_PRIVATE'` (documents where the private key lives — mirrors the `kms://...` shape that v1.1 real KMS will use) |
| `status` | `'active'` |
| `rotated_at` | `NULL` |
| `revoked_at` | `NULL` |
| `created_at` | auto (`now()`) |
| `updated_at` | auto (`now()`) |

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
INSERT INTO newsroom_signing_keys (
  kid,
  algorithm,
  public_key_pem,
  private_key_ref,
  status
)
VALUES (
  'dev-signing-key-1',
  'ed25519',
  '-----BEGIN PUBLIC KEY-----
<paste the public PEM block from step 3 — multi-line OK>
-----END PUBLIC KEY-----
',
  'env://NEWSROOM_SIGNING_KEY_PRIVATE',
  'active'
);
SQL
```

> ⚠ The `idx_newsroom_signing_keys_single_active` partial unique
> index allows at most ONE row with `status='active'` at a time. If
> a previous bootstrap already inserted one, this INSERT will fail
> with `duplicate key value violates unique constraint`. Either
> rotate the existing key first (set `status='rotated'`,
> `rotated_at=now()`), or run with a different `kid` and a
> different status value for testing rotation.

## 6. Restart dev server

The env vars are read once at process start. Bounce the dev server
so the new values flow into `StubKmsAdapter`:

```bash
# Kill any running `next dev`, then:
bun run dev
```

## 7. Clean up the on-disk PEM

```bash
rm /tmp/newsroom-signing.pem
```

The private key now lives only in `.env.local` (gitignored) and in
the running Node process. Public key + kid are in the DB.

---

## Verification

### Step A — keyset endpoint

```bash
curl http://localhost:3000/.well-known/receipt-keys | jq
```

Expected output:

```json
{
  "keys": [
    {
      "signing_key_kid": "dev-signing-key-1",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
      "algorithm": "ed25519",
      "status": "active",
      "created_at": "2026-04-26T...",
      "rotated_at": null
    }
  ]
}
```

If `keys` is empty, step 5's INSERT didn't land. Re-check by
running:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT kid, status FROM newsroom_signing_keys;"
```

### Step B — round-trip via the receipts module (optional)

In a short Node REPL or test:

```ts
import { mintReceipt, verifyReceipt } from '@/lib/newsroom/receipts'
import { getKmsAdapter } from '@/lib/newsroom/kms'

const adapter = getKmsAdapter()
const ref = await adapter.getPublicKey('dev-signing-key-1')

const receipt = await mintReceipt({
  pack_id: '00000000-0000-0000-0000-000000000001',
  asset_id: '00000000-0000-0000-0000-000000000002',
  recipient_id: null,
  distribution_event_id: '00000000-0000-0000-0000-000000000003',
  licence_class: 'editorial_use_only',
  credit_line: 'Test',
  terms_summary: 'Test terms',
  content_hash_sha256: 'abc'.repeat(21) + 'a',  // 64 hex chars
  receipt_url: 'https://frontfiles.com/receipts/test',
})

console.log(receipt)
console.log('verify:', verifyReceipt(receipt, ref.publicKeyPem))  // true
```

### Step C — publish smoke

The `'no_active_signing_key'` publish-precondition error should no
longer fire. Either:

- Use the publish UI (P9 → P10), or
- Call the RPC directly via psql:

```sql
SELECT newsroom_pack_transition(
  '<your-pack-id>'::uuid,
  'published'::newsroom_pack_status,
  '<your-user-id>'::uuid,
  false
);
```

Expected: `{"ok": true, ...}` if all OTHER preconditions are met.
If you still see `{"ok": false, "missing_preconditions":
["no_active_signing_key", ...]}`, re-check the `newsroom_signing_keys`
row's `status` column.

---

## Rotation (NR-D19 territory)

Key rotation is admin-side (NR-D19). For a dev environment that
needs to test rotation:

```sql
-- Step 1: flip the existing key to 'rotated' (clears the
-- single-active-key constraint).
UPDATE newsroom_signing_keys
   SET status = 'rotated',
       rotated_at = now()
 WHERE kid = 'dev-signing-key-1';

-- Step 2: regenerate keypair (steps 1–3 of this runbook), update
-- env vars (NEWSROOM_SIGNING_KEY_PRIVATE + NEWSROOM_SIGNING_KEY_ID
-- to a new kid like 'dev-signing-key-2').

-- Step 3: INSERT the new active row (step 5 with the new kid).

-- Step 4: bounce the dev server.
```

After rotation, the keyset endpoint returns BOTH keys (active +
rotated), and verifiers can validate receipts signed by either kid.
Receipts signed by the rotated key remain verifiable; new receipts
sign with the new key.

Production rotation is admin A7 surface (NR-D19) with co-sign +
audit logging — out of scope for v1.

---

## Troubleshooting

**Constructor throws `KmsError('config')` at request time:**
- One of the env vars is missing or empty. Check `.env.local`.
- The private key isn't valid Ed25519 PEM. Re-run step 1.
- The base64 has line breaks. Re-run step 2 with `tr -d '\n'`.

**Keyset endpoint returns empty array:**
- The DB INSERT didn't land. Re-check via psql `SELECT`.
- The `status` is something other than `'active'` or `'rotated'`.
- PostgREST schema cache is stale. `docker restart supabase_rest_frontfiles`.

**Verifier sees `false` from `verifyReceipt`:**
- The receipt was signed by a different key. Cross-check
  `signing_key_kid` against the keyset.
- The receipt fields were tampered with after signing.
- The PEM passed to `verifyReceipt` is malformed (must be SPKI).
