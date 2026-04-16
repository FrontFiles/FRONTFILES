# PR 2 — Implementation Plan

**Status**: DRAFT — planning only, no code
**Date**: 2026-04-16
**Governing documents**: [ARCHITECTURE-BRIEF.md](./ARCHITECTURE-BRIEF.md), [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) §PR 2
**Scope**: upload API route + original persistence + idempotency, dormant behind `FFF_REAL_UPLOAD=false`.

---

## 1. Scope boundary

PR 2 does **not**:

- call any processing module (that is PR 3's enqueue step and PR 4's worker)
- touch the delivery route `src/app/api/media/[id]/route.ts`
- touch the simulation path (`src/lib/upload/v2-state.ts`, `v2-simulation-engine.ts`, `services.ts`)
- flip `FFF_REAL_UPLOAD` in any environment (PR 5 does that)

PR 2 does:

- add one API route and its server-side pipeline
- add exactly the schema columns needed for the idempotency contract
- extend `StorageAdapter` by one method (`delete`) — a scoped interface change explicitly called out below, because inline rollback on row-insert failure requires it
- add a feature-flag getter for `FFF_REAL_UPLOAD`

---

## 2. Files to add / touch

### 2.1 Add

| Path | Purpose |
|---|---|
| `frontfiles/supabase/migrations/<next-ts>_upload_idempotency.sql` | Schema delta for the idempotency contract (§3 below). Timestamp after the latest existing migration `20260417100003`. |
| `frontfiles/src/app/api/upload/route.ts` | `POST /api/upload` handler — thin; delegates to `commit-service`. |
| `frontfiles/src/lib/upload/commit-service.ts` | Orchestration: validate → fingerprint → idempotency lookup → putOriginal → transactional row insert → rollback on failure. |
| `frontfiles/src/lib/upload/server-validation.ts` | Server-side MIME sniff (magic bytes), size ceiling, allowed-format whitelist. Separate from `validation.ts` (which is client-only). |
| `frontfiles/src/lib/upload/__tests__/commit-service.test.ts` | Unit tests with mocked adapter + mocked DB driver. |
| `frontfiles/src/lib/upload/__tests__/server-validation.test.ts` | Magic-byte + size + MIME tests against known-good and known-bad fixture bytes. |
| `frontfiles/src/app/api/upload/__tests__/route.test.ts` | Route integration tests (flag off → 503; auth missing → 401; missing token → 400; happy path → 200). |
| `frontfiles/src/lib/storage/__tests__/fs-adapter.delete.test.ts` *(or extend existing `fs-adapter.test.ts`)* | Tests for the new `delete` method on the filesystem adapter. |

### 2.2 Touch

| Path | Change |
|---|---|
| `frontfiles/src/lib/storage/types.ts` | **Interface extension** (§5 below): add `delete(storageRef: string): Promise<void>` to `StorageAdapter`. No method renames. No change to the four PR 1 methods. |
| `frontfiles/src/lib/storage/fs-adapter.ts` | Implement `delete`: validate ref → `fs.unlink(absolute)`; treat `ENOENT` as a no-op success (idempotent). |
| `frontfiles/src/lib/storage/supabase-adapter.ts` | Implement `delete`: `client.storage.from(bucket).remove([storageRef])`; treat not-found as success. |
| `frontfiles/src/lib/flags.ts` | Add `isRealUploadEnabled()` reading `FFF_REAL_UPLOAD`. Follows the existing `isFffSharingEnabled` pattern. Server-only flag (no `NEXT_PUBLIC_` prefix) — PR 2's route reads it server-side. |

### 2.3 Not touched (explicit)

- `src/lib/upload/v2-state.ts`, `v2-simulation-engine.ts`, `v2-simulation.ts`, `services.ts`, `validation.ts` — simulation path untouched.
- `src/app/api/media/[id]/route.ts`, `src/lib/media/asset-media-repo.ts`, `src/lib/media/delivery-policy.ts` — delivery path untouched.
- `src/lib/processing/**` — derivative path untouched.
- `src/data/assets.ts`, `src/lib/mock-data.ts`, `public/assets/**` — mock surface untouched.

---

## 3. Schema delta (single migration)

One migration, reversible, additive only.

```
vault_assets ADD COLUMN client_upload_token text NULL
vault_assets ADD COLUMN original_size_bytes bigint NULL
vault_assets ADD COLUMN metadata_checksum   text   NULL

asset_media  ADD COLUMN original_sha256     text   NULL

CREATE UNIQUE INDEX vault_assets_creator_upload_token_key
  ON vault_assets (creator_id, client_upload_token)
  WHERE client_upload_token IS NOT NULL;
```

Justifications (each tied to the idempotency contract in [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) §PR 2):

| Column | Why it lives here |
|---|---|
| `vault_assets.client_upload_token` | Index target for the scope key `(creator_id, client_upload_token)`. Lives on `vault_assets` because the token identifies an *upload attempt*, which is one-to-one with a governed asset. |
| `vault_assets.original_size_bytes` | Fingerprint field #1 per plan text. On `vault_assets` rather than `asset_media` because size is a property of the submitted payload, not the stored file (they are equal by construction; separating keeps the fingerprint columns together). |
| `vault_assets.metadata_checksum` | Fingerprint field #3. Hex SHA-256 over a canonical form of the client-supplied metadata JSON (key-sorted, no whitespace) that accompanies the upload. |
| `asset_media.original_sha256` | Fingerprint field #2. Lives on the `role='original'` `asset_media` row because it describes file bytes. NULL on derivative rows. |
| Partial unique index | Enforces one open token per creator. `WHERE client_upload_token IS NOT NULL` permits legacy / imported rows that have no token. |

Nothing else in the schema changes. No enum drift, no constraint rewrites, no dropped columns.

Rollback block in the migration: drop index, drop columns, in reverse order.

---

## 4. Idempotency token handling

### 4.1 Token shape and transport

- Format: UUID v4 (36 chars). Server rejects anything longer than 64 chars or containing non-printable chars.
- Transport: HTTP header `X-Upload-Token`. (Header rather than body field so it survives a request body re-stream and is logged cleanly.)
- Client responsibility: mint one UUID per upload *attempt*; reuse verbatim on retry of the same upload; mint a fresh token for a genuinely new upload.

### 4.2 Fingerprint

Three fields define equality of two requests bearing the same token:

1. `original_sha256` — server-computed hex SHA-256 of the file bytes.
2. `original_size_bytes` — `bytes.length` (server-authoritative, ignores client claims).
3. `metadata_checksum` — server-computed hex SHA-256 of the canonical JSON of the submitted metadata.

All three are server-computed. The client may send a claimed sha256 alongside the file for cross-checking, but the server's computation is authoritative.

### 4.3 Lookup + decision table

On receipt, after validation but before any write:

```
row = SELECT va.id, va.original_size_bytes, va.metadata_checksum,
             am.original_sha256
      FROM vault_assets va
      JOIN asset_media am
        ON am.asset_id = va.id AND am.media_role = 'original'
      WHERE va.creator_id = :creator_id
        AND va.client_upload_token = :token
      LIMIT 1
```

| Lookup outcome | Fingerprint match | Response | Writes |
|---|---|---|---|
| No row | — | Proceed to §6 (persist). | Eventual new rows. |
| Row exists | All three match | `200 { asset_id: row.id }` | None. |
| Row exists | Any mismatch | `409 { code: 'idempotency_conflict', mismatched: [...] }` | None. |

The `mismatched` array names which field(s) differed. Bytes, if already buffered, are discarded. No storage write occurred at this point in the flow so there is nothing to clean up.

### 4.4 Token race (concurrent submission)

Two simultaneous requests can both pass §4.3 (both see "no row"), both proceed to §6, and both try to INSERT `vault_assets`. The partial unique index makes one INSERT win and the other fail with a unique-violation error. Handling in §7.3.

---

## 5. Scoped interface extension — `StorageAdapter.delete`

The PR 1 adapter has four methods. PR 2 adds one:

```
delete(storageRef: string): Promise<void>
```

Semantics:

- `validateStorageRef(storageRef)` first — same rejection rules as `getBytes`.
- Missing file is **not** an error (idempotent). `ENOENT` on the filesystem and not-found on Supabase both return silently. Any other error throws.
- Used only by the commit service's rollback path (§7). No production caller deletes "ready" originals through this method; that is an operational concern for later.

This is not an improvisation of PR 1: it is an additive method landed in PR 2 because PR 2 is where the first caller exists. The four existing methods and their signatures are unchanged. The "do not convert put* to positional" rule from the PR 1 review still holds.

---

## 6. Draft asset row creation

### 6.1 Exact fields written to `vault_assets` on first accept

| Column | Value | Source |
|---|---|---|
| `id` | server-generated UUID v4 | pre-generated so the storage write can use the asset_id in the path without a prior DB round-trip |
| `creator_id` | authenticated session user's id | session |
| `slug` | `draft-{id}` | deterministic; later editor flow replaces on publish. Satisfies `slug NOT NULL UNIQUE`. |
| `title` | sanitized filename stem (or `'Untitled'` if empty after stripping) | filename; satisfies `title NOT NULL` |
| `format` | `'photo'` | PR 2 only accepts image MIMEs; other formats land in later PRs |
| `privacy_state` | `'PRIVATE'` | schema default — explicit for clarity |
| `publication_state` | `'DRAFT'` | schema default — explicit for clarity |
| `declaration_state` | `'provenance_pending'` | closest enum match to brief's "declaration=pending" |
| `client_upload_token` | request header value | idempotency |
| `original_size_bytes` | `bytes.length` | fingerprint |
| `metadata_checksum` | server-computed hex sha256 of canonical metadata JSON | fingerprint |
| `tags`, `enabled_licences` | empty arrays (defaults) | schema defaults — not set explicitly |
| `intrusion_level` | omitted — schema default `'standard'` applies | set by the DEFAULT in `20260417100002` |
| `uploaded_at`, `created_at`, `updated_at` | omitted — schema defaults `now()` | schema defaults |
| every other column | NULL | editorial fields populated by later editor flow |

### 6.2 Exact fields written to `asset_media` on first accept

| Column | Value |
|---|---|
| `asset_id` | the UUID generated for `vault_assets.id` |
| `media_role` | `'original'` |
| `storage_ref` | return value of `adapter.putOriginal(...)` |
| `content_type` | validated MIME (e.g. `image/jpeg`) |
| `file_size_bytes` | `bytes.length` |
| `width`, `height` | read from image metadata (via `sharp().metadata()`) before the storage write |
| `generation_status` | `'ready'` — bytes are on disk and the row is canonical |
| `original_sha256` | server-computed hex sha256 of bytes |
| `id`, `created_at` | schema defaults |

No derivative rows are created. PR 3 does that.

---

## 7. Original persistence flow

Ordered steps. Each numbered step maps to a function boundary in `commit-service.ts`.

1. **Flag gate.** If `!isRealUploadEnabled()` → return `503 { code: 'not_enabled' }`. No work.
2. **Session.** Resolve creator_id from auth session. If absent → `401`.
3. **Transport parse.** `await req.formData()`; extract `file` (`Blob`) and `metadata` (JSON string). Read `X-Upload-Token` header. Validate token format (§4.1). Malformed/missing → `400`.
4. **Read bytes.** `const bytes = Buffer.from(await file.arrayBuffer())`. Enforce `bytes.length <= MAX_ORIGINAL_BYTES` (constant in `server-validation.ts`). Oversize → `413`.
5. **Server validation** (§`server-validation.ts`): magic-byte sniff matches declared MIME; MIME in allowed set (`image/jpeg`, `image/png`, `image/webp`, `image/tiff`); claimed extension consistent. Fail → `415`.
6. **Fingerprints.**
   - `original_sha256 = sha256Hex(bytes)`
   - `original_size_bytes = bytes.length`
   - `metadata_checksum = sha256Hex(canonicalJSON(metadata))`
7. **Idempotency lookup** (§4.3). On match → `200 { asset_id }` and stop. On mismatch → `409` and stop.
8. **Pre-generate asset_id.** `const assetId = crypto.randomUUID()`.
9. **Image metadata.** `const { width, height } = await sharp(bytes).metadata()`. Missing / non-positive → `415` (malformed image).
10. **Storage write.** `const storage_ref = await adapter.putOriginal({ assetId, filename, bytes, contentType: mime })`. Throw → `500 { code: 'storage_write_failed' }`. No DB state mutated yet, so no rollback.
11. **DB transaction.**
    - `BEGIN`
    - INSERT `vault_assets` (§6.1 values)
    - INSERT `asset_media` (§6.2 values)
    - `COMMIT`
12. **Response.** `200 { asset_id: assetId }`.

### 7.1 Transaction scoping

The two INSERTs run inside one transaction. If either fails, both roll back together. The transaction does **not** wrap the storage write (which is non-transactional); storage cleanup is done explicitly in §7.2.

### 7.2 Post-hoc compensation order (summary)

```
storage write succeeded, then transaction failed:
  adapter.delete(storage_ref)   ← best-effort; errors logged, not re-thrown
  return 500
```

Details in §8.

### 7.3 Token race handling

If the DB transaction fails specifically with a unique-violation on `vault_assets_creator_upload_token_key`:

1. `await adapter.delete(storage_ref)` — the losing request's bytes are orphans at its own asset_id path.
2. Re-run the §4.3 lookup.
3. If fingerprints match → `200 { asset_id: existing.id }`.
4. If any mismatch → `409 { code: 'idempotency_conflict' }`.

This is the only branch where a unique violation is *expected*. Any other unique violation (shouldn't occur given pre-generated UUIDs for `id`) is logged and returns `500`.

---

## 8. Rollback behavior on row-insert failure

Exhaustive. Each failure class is enumerated, with its compensation:

| Failure point | Compensation | HTTP |
|---|---|---|
| §7.1 flag gate | none | 503 |
| §7.2 session missing | none | 401 |
| §7.3 malformed request / bad token / missing file | none | 400 |
| §7.4 oversize | none | 413 |
| §7.5 MIME / magic mismatch | none | 415 |
| §7.7 idempotency conflict | none (no writes happened) | 409 |
| §7.9 non-image / malformed metadata | none | 415 |
| §7.10 storage write throws | none (no DB state); log | 500 |
| §7.11 transaction fails (generic) | `adapter.delete(storage_ref)` best-effort; log both original DB error and any delete error | 500 |
| §7.11 transaction fails with unique violation on `(creator_id, client_upload_token)` | §7.3 race branch — `delete` + re-lookup → 200 or 409 | 200 \| 409 |

**`adapter.delete` best-effort semantics**: any error from `delete` during rollback is logged with `{ asset_id, storage_ref, original_error, delete_error }` and then suppressed. The request's outer response is driven by the original failure. An orphan blob in the rare "delete itself failed" case falls into the "long-tail orphan" bucket documented in [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) Orphan blob cleanup §3, which is acknowledged and deferred.

**Why this order.** Bytes-first-then-row means the DB never holds a row that points at non-existent bytes, which would violate the brief's "DB is authoritative" invariant in the wrong direction (the DB would claim readiness while storage lacks bytes). A crash between §7.10 and §7.11 leaves an orphan blob with no row — invisible to delivery, cleanable later. A crash after §7.11 leaves a canonical asset — the desired terminal state.

---

## 9. Tests

### 9.1 `server-validation.test.ts`

- Accepts a valid JPEG (magic `FF D8 FF`), PNG (`89 50 4E 47`), WEBP (`52 49 46 46 ... 57 45 42 50`), TIFF (`49 49 2A 00` / `4D 4D 00 2A`).
- Rejects a file whose claimed MIME `image/jpeg` carries PNG magic (and vice versa).
- Rejects an unlisted MIME (`image/gif`, `application/pdf`, etc.).
- Rejects oversize payloads at the exact ceiling + 1 byte.
- Rejects empty bytes.

### 9.2 `commit-service.test.ts` (mocked adapter + mocked DB)

Happy path:
- Inserts exactly the fields in §6.1 and §6.2; returns the pre-generated `asset_id`.

Idempotency:
- Existing row, all three fingerprints match → returns `{ asset_id: existing }`, zero write calls on adapter and DB.
- Existing row, sha mismatch → 409; mismatched includes `original_sha256`.
- Existing row, size mismatch → 409.
- Existing row, metadata mismatch → 409.

Failure modes:
- `adapter.putOriginal` throws → 500; zero DB calls made.
- `asset_media` INSERT throws → 500; `adapter.delete(storage_ref)` called once with the returned ref; both `vault_assets` and `asset_media` absent (transaction rolled back).
- `vault_assets` INSERT throws unique-violation → enters race branch; `adapter.delete` called; re-lookup runs; returns 200 on fingerprint match, 409 on mismatch.
- `adapter.delete` throws during rollback → the original 500 is still returned; delete error is logged but not surfaced.

### 9.3 `route.test.ts`

- `FFF_REAL_UPLOAD=false` → 503 (verifies the flag gate is wired before anything else).
- No session → 401.
- Missing `X-Upload-Token` → 400.
- Oversized body → 413 without reading the whole file (stream-aware ceiling).
- Happy path with fs adapter in a temp root → 200 with `{ asset_id }`; row and file both present; `asset_media.original_sha256` equals sha of bytes.

### 9.4 `fs-adapter.delete.test.ts`

- `delete` removes a previously-written file.
- `delete` on a non-existent ref resolves (idempotent).
- `delete` rejects absolute / traversal / empty refs with `StorageRefError`.

No tests are added against the Supabase adapter in PR 2 — per PR 1 exit criterion §6, the Supabase driver remains a structural implementation not exercised against a live bucket until a later PR.

---

## 10. Internal consistency checks

- Every column written in §6 exists in the schema confirmed against `20260413230002_vault_asset_tables.sql` + `20260417100002_watermark_profile_tables.sql`. The three new columns are the only additions.
- The only `StorageAdapter` change is the additive `delete`. PR 1's four methods are unchanged in name and signature.
- `isRealUploadEnabled` is a server-only flag (no `NEXT_PUBLIC_` prefix) because PR 2's route reads it from a route handler. This matches PR 5's planned client-side semantics: PR 5 will additionally mirror it via a public flag if the UI needs to know, or will infer from a 503 response.
- No change to `v2-state.ts`, `services.ts`, or any simulation module — the simulation path remains authoritative for users until PR 5 flips the flag.
- The idempotency contract's three fingerprints are all columns that exist after §3's migration; no fingerprint field depends on state PR 2 doesn't provision.
- `adapter.delete` is called in exactly two places in the commit service: §7.3 (race branch) and §7.11 (transaction failure). Both paths log the outcome. No other caller introduced.
- No new runtime dependency needed. `sharp` is already in the repo (listed in `package.json` `trustedDependencies`); `crypto.randomUUID()` and `crypto.createHash('sha256')` are Node built-ins.

---

## 11. Open items (surfacing — not blocking plan approval)

1. **Metadata payload shape.** The client's upload POST carries a metadata blob alongside the file. PR 2 only needs to compute a checksum over it; the exact schema of that blob is a separate PR's concern. For PR 2 the checksum is over whatever canonical JSON is agreed, and the blob is not persisted in any column beyond the checksum.
2. **Rate limiting.** PR 5's risk list calls for rate limiting on `/api/upload` "reuse patterns from `src/lib/rate-limit/original-downloads.ts`." PR 2 can wire the limiter structurally now or defer; recommendation: defer to PR 5, since with the flag off there is no exposure in PR 2.
3. **`declaration_state` value.** PR 2 uses `'provenance_pending'` as the closest mapping from brief's "declaration=pending." If a different draft-state enum value is preferred, that is a one-line change in `commit-service.ts` and does not affect the rest of the plan.
4. **Draft slug format.** `draft-{id}` keeps the unique constraint satisfied with zero collision risk. If a human-readable interim slug is preferred, it needs its own uniqueness strategy — recommend keeping `draft-{id}` for PR 2 simplicity.

None of these block building PR 2.

---

## 12. What PR 2 does NOT introduce

- No derivative pipeline work.
- No change to delivery.
- No change to simulation.
- No change to schema beyond the four listed additive columns + one partial unique index.
- No new runtime dependencies in `package.json`.
- No new env vars beyond `FFF_REAL_UPLOAD` (flag) — `FFF_STORAGE_DRIVER`, `FFF_STORAGE_FS_ROOT`, `FFF_STORAGE_SUPABASE_BUCKET` already landed in PR 1.
