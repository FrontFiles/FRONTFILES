# NR-D7a — Asset Upload + Storage + Metadata UI

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D6b (`5a7c100`) — pack creation flow + details tab
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~7 new + 1 modified file; route count delta +2 (106 → 108)

---

## 1. Why this directive

NR-D6b shipped Pack creation with the Details tab. The Pack editor's tab nav has placeholders for Assets and Embargo. NR-D7a replaces the Assets placeholder with the **upload + storage + metadata UI** per **PRD §5.1 P7**:

- Drag-and-drop upload zone (multi-file, up to 500 MB each)
- Per-file upload progress
- Per-Asset row UI: scan-result indicator, metadata editor (caption, alt-text, trademark flag), delete
- Validation: size cap, MIME types, alt-text required for images at publish (deferred to NR-D9 RPC)
- Storage backend: Supabase Storage via the existing `getStorageAdapter()` abstraction (`src/lib/storage/`)

**Out of scope (deferred):**
- AV scanning pipeline (NR-D7b — Asset rows ship in `pending` scan state and stay there until NR-D7b lands)
- Renditions (deferred to Phase NR-3 / consumer rendering — PRD §3.2 AssetRendition skipped in v1 critical path)
- Drag-to-reorder Assets (v1.1 polish)
- Replace-asset (v1.1; for v1, delete + re-upload)
- C2PA manifest stamping (NR-D10 — receipt-emission territory)

The "Scanning…" indicator in PRD §5.1 P7 will display permanently in NR-D7a because no scanner runs yet. NR-D7b lights it up. UI copy matches PRD verbatim — internal state semantics change without user-visible copy change.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.2 Asset (line 295) + AssetScanResult (line 315), §3.3 publish preconditions (line 576), **§5.1 P7 Upload zone + per-Asset rows + metadata + validation (lines 846–875, verbatim)** |
| Existing migrations | `supabase/migrations/20260425000001_*` | `newsroom_assets` (line 409) with image/video/audio dim CHECKs; `newsroom_asset_kind` enum (line 98) |
| AssetScanResult migration | `supabase/migrations/20260425000002_*` | `newsroom_asset_scan_results` (line 110) |
| Existing storage abstraction | `src/lib/storage/index.ts` | `getStorageAdapter()`, `originalPath()`, `validateStorageRef`, error types — REUSE |
| Existing schema.ts | `src/lib/db/schema.ts` | Confirm `NewsroomAssetRow`, `NewsroomAssetKind`, `NewsroomAssetScanResultRow` types — append if missing |
| Existing Pack editor shell | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` | NR-D6b F3 — F2 EDIT enables the Assets tab link |
| Auth precedent | All NR-D5b-i / NR-D5b-ii / NR-D6a / NR-D6b API routes | inline Bearer extraction → `supabase.auth.getUser(token)` → direct membership query → service-role write |

PRD §5.1 P7 is verbatim authority for upload-zone copy, per-Asset row states, metadata field labels, and validation error strings.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (already verified during NR-D7a directive drafting)

- (P1) **Storage abstraction exists**: `src/lib/storage/index.ts` exports `getStorageAdapter()` returning a `StorageAdapter` with both fs (dev) and Supabase implementations. `originalPath()` produces canonical paths. **REUSE this**; do NOT introduce a new storage layer.
- (P2) **`newsroom_assets` table exists** with all PRD §3.2 columns + 3 CHECK constraints (image dims, video dims+duration, audio duration). Cascade on pack_id.
- (P3) **`newsroom_asset_scan_results` table exists** (NR-D2a migration line 110) with FK 1:1 to `asset_id`. Initial state column accepts `'pending'`.
- (P4) **Existing API route precedent** is exhaustively established (NR-D5b-i / NR-D5b-ii / NR-D6a / NR-D6b). Mirror exactly: inline Bearer extraction, `supabase.auth.getUser(token)`, direct membership-table query, service-role for writes.

### Audit checks to run

#### (a) `newsroom_assets` RLS posture
- Confirm RLS policies on `newsroom_assets` exist and follow the same shape as `newsroom_packs`: public-select for published-pack-assets + admin-self for own-pack writes via `is_newsroom_editor_or_admin`.
- Service-role bypasses RLS — same pattern as NR-D6b. Confirm by file location of policies; surface as IP if posture differs.

#### (b) `newsroom_asset_scan_results` shape
- Read columns. Confirm initial state can be `'pending'` and that the row INSERT pattern is "create alongside the Asset INSERT in the same transaction or as immediate follow-up".
- Two writes: confirm whether the scan_result row is auto-created via trigger or must be explicitly INSERTed by the API route. Surface as IP if trigger-based — the API route shape changes.

#### (c) Schema.ts row types
- Grep `src/lib/db/schema.ts` for `NewsroomAssetRow`, `NewsroomAssetKind`, `NewsroomAssetScanResultRow`, `NewsroomScanResult` (NOT `NewsroomAssetScanState` — IP-4 corrected the type name).
- All row types confirmed present (lines 627, 681, 710, 729). No schema.ts edit needed.

#### (d) Storage adapter audit
- Read `getStorageAdapter()` signature in `src/lib/storage/index.ts` and `StorageAdapter` interface in `src/lib/storage/types.ts`.
- Confirm method shape for: signed-upload-URL issuance (or equivalent — adapter may expose `getUploadUrl(path) → signedUrl` or `putOriginal(path, blob)`).
- **AUDIT-GATE (the Option A condition):** if the Supabase adapter cannot produce signed upload URLs OR the configured bucket has a per-file size limit < 500 MB, HALT and surface as IP. Otherwise proceed.

#### (e) Path-convention design
- The Frontfiles vault side uses `originalPath(...)` — read its inputs. Confirm whether the path scheme can accommodate newsroom assets (e.g. accepts a `tenant`/`namespace` arg) or whether NR-D7a needs a parallel `newsroomOriginalPath(packId, assetId)` helper.
- Recommend adding a thin wrapper in `src/lib/newsroom/asset-storage.ts` that adapts the storage adapter for newsroom paths. Avoids changing the existing storage module.

#### (f) Client-side checksum + dimensions
- Confirm browser-supported APIs: `crypto.subtle.digest('SHA-256', arrayBuffer)` for hashing; `URL.createObjectURL` + `Image.onload` for image dims; `<video>.metadata` for video dims+duration; equivalent for audio.
- Implementation lives in F4 (upload-zone client). Streaming hash for 500 MB files needs chunked reads — Web Streams API + `crypto.subtle.digest` won't stream natively, so for v1 we accept synchronous full-file ArrayBuffer hashing. Memory cost: temporary 500 MB allocation per file. Acceptable for a desktop browser flow.
- Surface as IP if a pre-existing checksum/dimensions helper exists in the codebase that should be reused.

#### (g) Editor shell tab modification
- F2 edits NR-D6b's `pack-editor-shell.tsx`. Currently the Assets tab is rendered as `<span>` (disabled). F2 changes it to `<Link>` to `/manage/packs/[packSlug]/assets`.
- Embargo tab stays disabled (NR-D8). Details tab stays as the default destination on edit-page mount.

### Audit deliverable

After running checks (a)–(g), report:
- Findings table.
- IPs requiring sign-off (HALT before composing).
- Locked file list.

If audit clears with no IPs, state "No IPs surfaced — proceeding to composition."

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| **F0a** | `src/lib/storage/types.ts` | **EDIT (IP-1)** — add `SignedPutUrlInput`/`SignedPutUrlOutput` types + `signedPutUrl` method on `StorageAdapter` interface | +30 |
| **F0b** | `src/lib/storage/supabase-adapter.ts` | **EDIT (IP-1)** — implement `signedPutUrl` via `createSignedUploadUrl` | +25 |
| **F0c** | `src/lib/storage/fs-adapter.ts` | **EDIT (IP-1, Option A1)** — throw with "use supabase driver" message; documents local-Supabase-docker as the dev story | +15 |
| F1 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/assets/page.tsx` | NEW — server component; fetches Pack + Assets + scan_results; renders upload zone + asset list | ~120 |
| F2 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` | EDIT — flip the Assets tab from disabled span to active link | +5 / -3 |
| F3 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/assets/_components/upload-zone.tsx` | NEW — `'use client'` drag-and-drop, per-file checksum + dimensions, signed-URL fetch, upload progress, error display | ~280 |
| F4 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/assets/_components/asset-row.tsx` | NEW — `'use client'` per-asset row: scan-state badge, metadata edit (caption/alt/trademark), delete | ~200 |
| F5 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/route.ts` | NEW — POST: auth → admin → validate → INSERT asset + scan_result(pending, sentinel scanner) → signedPutUrl | ~250 |
| F6 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/[assetId]/route.ts` | NEW — PATCH (metadata) + DELETE (asset + storage cleanup, best-effort) | ~220 |
| **F7a** | `src/lib/newsroom/asset-form-constants.ts` | **NEW (IP-2 split, client-safe)** — `ASSET_*_MAX`, `ACCEPTED_MIME_TYPES`, `kindFromMime`, `newsroomOriginalPath`. **No `'server-only'`** | ~80 |
| **F7b** | `src/lib/newsroom/asset-form.ts` | **NEW (IP-2 split, server-only)** — zod schemas; imports constants from F7a | ~80 |
| F8 | `src/lib/newsroom/__tests__/asset-form.test.ts` | NEW — vitest cases for kind-from-mime, schema validation, path helper | ~140 |

Totals (post-IP-1 + IP-2): 4 EDIT + 8 NEW = 12 conceptual deliverables; +3 routes (1 page + 2 API), so 106 → 109. Final commit = 14 paths (12 deliverables + directive + exit report).

| New route | Type |
|---|---|
| `/{orgSlug}/manage/packs/[packSlug]/assets` | page |
| `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets` | API POST |
| `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/assets/[assetId]` | API PATCH + DELETE (single route file, two methods) |

VERIFY 4 expects route count 106 → 109 (+3).

---

## 5. F-specs

### F1 — `/manage/packs/[packSlug]/assets/page.tsx` (NEW)

Server component. Parallel fetches: company → newsroom_profile → pack → assets+scan_results (left-join or two queries + JS merge). 404s on missing Pack or status ≠ draft.

Renders:
```tsx
<PackEditorShell orgSlug={...} orgName={...} pack={...} saveState="saved">
  <UploadZone orgSlug={...} packSlug={...} packId={...} />
  <AssetList orgSlug={...} packSlug={...} packId={...} assets={...} />
</PackEditorShell>
```

Where `AssetList` is rendered inline by F1 as a server-side mapping over the assets array, each row delegated to `<AssetRow>` (F4) — F1 is the page, the list-of-rows is just `assets.map(a => <AssetRow .../>)`.

### F2 — `pack-editor-shell.tsx` (EDIT)

Locate the Assets tab placeholder span. Replace with `<Link href={\`/${orgSlug}/manage/packs/${pack.slug}/assets\`}>`. Active state styling: highlight when current route is `/assets`. Embargo tab stays disabled.

### F3 — `upload-zone.tsx` (NEW, `'use client'`)

Drag-and-drop zone + per-file pipeline.

**Per-file pipeline:**
1. Validate file size + MIME (PRD §5.1 P7 validation errors verbatim)
2. Compute SHA-256 checksum (`crypto.subtle.digest`, full-file ArrayBuffer)
3. Extract kind-specific dimensions (image/video/audio via DOM APIs)
4. POST `/api/newsroom/orgs/{orgSlug}/packs/{packSlug}/assets` with `{filename, mime_type, file_size_bytes, checksum_sha256, kind, width?, height?, duration_seconds?}`
5. On 201: receive `{ asset, signedUploadUrl }`. PUT file bytes to `signedUploadUrl`. Track XHR upload progress.
6. On upload success: `router.refresh()` to re-render with the new row.
7. On any error: display per-file error in the upload-zone error list; do NOT remove the orphan row (v1 acceptance — v1.1 cleanup sweep handles orphans).

**Upload-zone copy (PRD §5.1 P7 verbatim):**

| State | Copy |
|---|---|
| Empty | "Drop files or click to upload. Images, video, audio, PDFs, up to 500 MB each." |
| Drag over | "Drop to upload" |
| In progress | Progress bar per file |
| Failed | "Upload failed. {reason}." + Retry |

**Validation errors (PRD §5.1 P7 verbatim):**
- "Alt text is required for image assets." — at publish time, not upload time (deferred)
- "File exceeds 500 MB. Compress or split."
- "File type not accepted. Accepted: {list}."
- "{n} asset(s) flagged for review. Contact support if this is in error." — scanner state, not relevant in NR-D7a

### F4 — `asset-row.tsx` (NEW, `'use client'`)

One row per Asset. Server-component-ready props (no callbacks):

```ts
{
  orgSlug: string
  packSlug: string
  asset: NewsroomAssetRow
  scanResult: NewsroomAssetScanResultRow | null
}
```

**Per-Asset row states (PRD §5.1 P7 verbatim):**

| Scan result | Indicator | Actions |
|---|---|---|
| `pending` | "Scanning…" | Remove |
| `clean` | green dot | Edit caption / alt / trademark flag; replace; remove |
| `flagged` | red dot "Flagged for review" | Remove; view reason (if admin shared); no edit; publish blocked |
| `error` | yellow dot "Scan error" | Retry scan; remove |

**Per-Asset metadata fields (PRD §5.1 P7 verbatim):**
- Caption — "Caption (appears beside asset)"
- Alt text — "Alt text (accessibility, required for images)"
- is_trademark_asset — checkbox: "This is a logo or trademark" / helper: "Adds a trademark notice wherever the asset appears."
- Renditions — read-only "Thumbnail 400px · Web 1600px · Print 3000px · Social 1200×630" (placeholder text in NR-D7a; real renditions come post-D7c)

**NR-D7a actual states:** all rows show `pending` (scan-result.state === 'pending'). The 4-state matrix is implemented in full anyway — NR-D7b lights up the others without F4 changes.

**Replace action:** "Replace" link is rendered for `clean` state per PRD; in NR-D7a, no clean rows exist, so the Replace branch is dead code in this directive's runtime but present for NR-D7b's use. Include but mark with a code comment.

**Save behaviour:** PATCH on blur (autosave for metadata fields). Delete via confirmation modal → DELETE → `router.refresh()`.

### F5 — `api/.../assets/route.ts` (NEW, POST)

```ts
export const runtime = 'nodejs'

export async function POST(request, { params }) {
  if (!isAuthWired()) return 404 'feature-disabled'

  // 1. Bearer + auth.getUser → 401
  // 2. Resolve company by orgSlug → 404
  // 3. Direct membership query (admin role) → 403
  // 4. Resolve pack by (company_id, slug) → 404
  // 5. Refuse if pack.status !== 'draft' → 409 'not-editable'
  // 6. Validate body via createAssetSchema (F7)
  //    - size ≤ 500 MB (or constant)
  //    - mime_type in accepted list
  //    - kind matches mime
  //    - if kind=image: width + height present
  //    - if kind=video: width + height + duration present
  //    - if kind=audio: duration present
  //    - checksum_sha256 length 64
  // 7. Generate storage path: newsroomOriginalPath(packId, newAssetId, ext)
  // 8. Service-role INSERT into newsroom_assets with the path as storage_url
  // 9. Service-role INSERT into newsroom_asset_scan_results with:
  //    - asset_id = newAssetId
  //    - result = 'pending' (column default; explicit for clarity)
  //    - scanner_suite = 'unscanned'   ← IP-3 sentinel; NR-D7b overwrites
  //    - scanner_version = '0.0.0'     ← IP-3 sentinel; NR-D7b overwrites
  //    Code comment must document the convention so NR-D7b knows to update.
  //    (BOTH writes in a transaction if PostgREST permits; otherwise sequential — second INSERT failure leaves orphan asset row, accept v1)
  // 10. Adapter: const signed = await adapter.signedPutUrl({ storageRef: path, ttlSeconds: 900, contentType: mime })
  //     Returns { url, headers?, expiresAt }. Method shape locked by IP-1.
  // 11. Return 201 { ok: true, asset, signedUploadUrl: signedUrl }
}
```

Auth helper inline per precedent (no extraction in this directive).

### F6 — `api/.../assets/[assetId]/route.ts` (NEW, PATCH + DELETE)

**PATCH:**
- Auth → admin → resolve pack via assetId join → refuse if pack.status !== 'draft'
- Validate body via updateAssetMetadataSchema (only caption, alt_text, is_trademark_asset editable in this directive)
- Service-role UPDATE; return updated row

**DELETE:**
- Auth → admin → resolve pack via assetId join → refuse if pack.status !== 'draft'
- Service-role DELETE on newsroom_assets row (CASCADE deletes scan_results)
- Best-effort storage cleanup: `await adapter.delete(asset.storage_url)`; failures logged + swallowed (orphan storage file is acceptable v1)
- Return 204

### F7 — `asset-form.ts` (NEW)

```ts
import 'server-only'
import { z } from 'zod'

import type { NewsroomAssetKind } from '@/lib/db/schema'

export const ASSET_MAX_BYTES = 500 * 1024 * 1024  // 500 MB
export const ASSET_CAPTION_MAX = 500
export const ASSET_ALT_TEXT_MAX = 500

export const ACCEPTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg'],
  document: ['application/pdf'],
  text: ['text/plain', 'text/markdown'],
} as const

/** Map MIME type to NewsroomAssetKind. Returns null for unaccepted types. */
export function kindFromMime(mime: string): NewsroomAssetKind | null { ... }

/** Build a canonical storage path for a newsroom asset's original. */
export function newsroomOriginalPath(packId: string, assetId: string, extension: string): string {
  return `newsroom/packs/${packId}/assets/${assetId}/original.${extension}`
}

export const createAssetSchema = z.object({
  filename: z.string().min(1).max(500),
  mime_type: z.string().min(1),
  file_size_bytes: z.number().int().positive().max(ASSET_MAX_BYTES),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(['image', 'video', 'audio', 'document', 'text']),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  duration_seconds: z.number().int().nonnegative().optional().nullable(),
}).refine(/* image: w+h required; video: w+h+duration; audio: duration */)

export const updateAssetMetadataSchema = z.object({
  caption: z.string().max(ASSET_CAPTION_MAX).nullable().optional(),
  alt_text: z.string().max(ASSET_ALT_TEXT_MAX).nullable().optional(),
  is_trademark_asset: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'At least one field required.' })
```

Note: F4 (client) needs `ASSET_MAX_BYTES` + `ACCEPTED_MIME_TYPES` for client-side validation hints. Apply the NR-D6b IP-1 pattern: split out `asset-form-constants.ts` if `'server-only'` blocks the client value imports. Surface as IP if needed.

### F8 — `__tests__/asset-form.test.ts` (NEW)

Vitest cases:
- `kindFromMime`:
  - Each accepted MIME → correct kind (5+ cases)
  - Unaccepted MIME → null (1–2 cases)
- `newsroomOriginalPath`:
  - Path shape verbatim
  - Extension applied
- `createAssetSchema`:
  - Valid image payload passes
  - Image without width fails
  - Video without duration fails
  - Audio without duration fails
  - Oversize file fails
  - Bad checksum format fails
  - Unaccepted kind fails
- `updateAssetMetadataSchema`:
  - Single field passes
  - Empty object fails
  - Caption too long fails

Aim for 14–18 cases.

---

## 6. New env vars

None. Storage uses existing `FFF_STORAGE_DRIVER` / `FFF_STORAGE_SUPABASE_BUCKET` env (already in env.ts).

---

## 7. VERIFY block

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/newsroom/__tests__/asset-form.test.ts` — all cases green.
3. `bunx vitest run src/lib/newsroom/__tests__` — full newsroom suite green.
4. `bun run build` exit 0; route count 106 → 109 (+3).
5. **Bounce dev server before VERIFY 6.**
6. Curl smoke (no auth) on the three new routes:
   - `GET /{orgSlug}/manage/packs/[any-slug]/assets` → 200 (AdminGate Loading)
   - `POST /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/assets` → 401
   - `PATCH /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/assets/[any-id]` → 401
   - `DELETE /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/assets/[any-id]` → 401
7. Visual smoke deferred (fixture-dependence; mirrors NR-D5b-i / NR-D6a / NR-D6b).
8. Scope diff: `git status --porcelain` shows exactly 12 paths (4M + 8??) — post-IP-1 + IP-2: 3 storage adapter EDITs + 1 editor-shell EDIT + 7 newsroom NEWs + 1 F7 split = 12 deliverables.

---

## 8. Exit report mandate

Save to `docs/audits/NR-D7a-asset-upload-storage-metadata-EXIT-REPORT.md`. Standard sections per prior directives. Founder ratifies before commit + push.

---

## 9. Standing carry-forward checks

Inherited from NR-D6a / NR-D6b:

- Audit-first IP discipline.
- Service-role for newsroom_* writes; auth-context for caller identity + direct membership query.
- Direct membership query (NOT `is_newsroom_editor_or_admin` RPC — broken under service-role).
- `runtime = 'nodejs'` on F5 + F6.
- Inline auth helpers (no shared extractor in codebase).
- Bounce dev server between `bun run build` and curl smoke.
- Tight per-directive commits; selective add of exactly 14 paths total (12 deliverables — 4 EDIT + 8 NEW — + directive + exit report). No `git add -A`.
- PRD §5.1 P7 verbatim.
- Reuse `getStorageAdapter()` from `src/lib/storage/`. No new storage layer.

---

## 10. Predecessor sequence

NR-D1 → NR-D2a → NR-D2b → NR-D2c-i → NR-D2c-ii → NR-D3 → NR-D4 (Phase NR-1)
→ NR-D5a → NR-D5b-i → NR-D5b-ii → governance merge → NR-D6a → **NR-D6b (`5a7c100`)**
→ **NR-D7a — this directive**
→ NR-D7b (AV scanning pipeline)
→ NR-D8 (embargo)
→ NR-D9 (rights warranty + publish + state machine RPC) — unblocks publish
→ NR-G2 phase gate
→ ... NR-D21

---

End of NR-D7a directive.
