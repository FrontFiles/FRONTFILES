# Image Asset Lifecycle — Canonical Architecture Brief

**Status**: DRAFT — governs next implementation phase  
**Date**: 2026-04-16  
**Scope**: image assets only (photo, illustration, infographic, vector)

---

## 1. Current Pipeline Audit

### 1.1 Upload flow

The upload pipeline is **entirely simulated**. No file bytes leave the browser.

1. User selects files → browser `File` objects captured
2. `ADD_FILES` action stores `File` reference in `V2Asset.file` (in-memory React state)
3. `SimulationEngine` runs fake progress (0→100%) via `requestAnimationFrame`
4. `UPDATE_ANALYSIS_RESULT` dispatches mock metadata proposals
5. `COMPLETE_COMMIT` sets `committedAt` timestamp — **no storage write occurs**
6. `File` object lives in browser memory until page unload

**Files**:
- `src/lib/upload/v2-state.ts` — reducer, ADD_FILES at line 140, COMPLETE_COMMIT at line 686
- `src/lib/upload/v2-types.ts` — V2Asset interface at line 157, `file: File | null`
- `src/lib/upload/v2-simulation-engine.ts` — controllable fake pipeline

**No upload API route exists.** No `/api/upload`, no presigned URL generation, no storage bucket write.

### 1.2 Metadata extraction flow

Simulated. `simulateContentAnalysis()` in `services.ts` generates fake EXIF/IPTC/XMP/C2PA data. The actual `File` bytes are never read. In production, this becomes a real service that reads the file after storage write.

### 1.3 Storage write flow

**Does not exist.** The `File` object is held in React state and discarded on page unload. No write to Supabase Storage, S3, or filesystem. The mock serves files from `public/assets/` — these are pre-placed sample images, not uploaded content.

**Files involved in mock serving**:
- `src/data/assets.ts` — `AssetData.thumbnailRef` (e.g. `/assets/8654_large.jpeg`)
- `src/lib/mock-data.ts` — `VaultAsset.thumbnailUrl` (e.g. `/assets/11862_large.jpeg`)
- `public/assets/` — ~200 sample images, pre-placed

### 1.4 Derivative / media-role model

The **schema** is production-ready. The **runtime** is mock.

**Schema** (`supabase/migrations/20260413230001` + `20260413230002`):
- `media_role` enum: `original | watermarked_preview | thumbnail | detail_preview | og_image | video_stream | audio_stream`
- `asset_media` table: `(asset_id, media_role)` UNIQUE, `storage_ref`, `generation_status` (pending/processing/ready/failed)
- Delivery route returns 404 unless `generation_status = 'ready'`

**Runtime** (`src/lib/media/asset-media-repo.ts`):
- `getReadyMedia()` maps ALL visual roles to the same mock `thumbnailRef` path
- No actual `asset_media` rows exist in the database
- The mock does NOT fall back to original when a derivative is missing — it treats the mock file AS every derivative

### 1.5 Delivery resolution path

Fully implemented and production-hardened.

```
Browser: /api/media/{id}?ctx=preview
  → resolveMediaRole(null, null, 'preview') → 'watermarked_preview'
  → getAssetGovernance(id) → privacy/publication/declaration checks → 404 if blocked
  → getReadyMedia(id, 'watermarked_preview') → {storageRef, contentType} → 404 if null
  → readFile(join(cwd, 'public', storageRef)) → Buffer
  → NextResponse with Cache-Control: private, max-age=300
```

**Original delivery** adds: authentication check → rate limit → `resolveDownloadAuthorization()` (queries `licence_grants`) → audit log → `Cache-Control: no-store`

**Files**:
- `src/app/api/media/[id]/route.ts` — complete delivery handler
- `src/lib/media/asset-media-repo.ts` — `resolveMediaRole()`, `getAssetGovernance()`, `getReadyMedia()`
- `src/lib/media/delivery-policy.ts` — `resolveProtectedUrl()`, browser-safe URL generation
- `src/lib/entitlement/services.ts` — `resolveDownloadAuthorization()`
- `src/lib/rate-limit/original-downloads.ts` — rate limiting
- `src/lib/download-events/` — audit logging
- `src/middleware.ts` — blocks direct browser access to `/public/assets/`

### 1.6 Current leak prevention

Strong. No known leak paths.
- `CONTEXT_ROLE_MAP` cannot resolve to `'original'` — only explicit `?delivery=original` can
- Missing derivative → 404, never fallback to original
- Browser never receives `storage_ref` — only `/api/media/{id}?ctx=...` URLs
- `middleware.ts` blocks direct `/assets/` access
- `PreviewMedia.tsx` ignores the raw `src` prop and uses `resolvePreviewUrl(assetId)` at line 59

---

## 2. Canonical Target Lifecycle

The exact sequence for an image asset from upload to delivery:

```
STEP 1 — UPLOAD ACCEPTED
  Client selects file(s)
  Client-side validation: format, MIME, size constraints
  Rejected files never leave the browser

STEP 2 — FILE VALIDATED (server-side)
  API receives file bytes (presigned upload or direct POST)
  Server re-validates: MIME sniffing, magic bytes, size
  Rejected files return 4xx, no storage write

STEP 3 — ORIGINAL PERSISTED
  File written to storage: {bucket}/originals/{asset_id}/{filename}
  Storage write returns the storage_ref (S3 key)
  asset_media row created:
    asset_id, media_role='original', storage_ref, generation_status='ready'
    content_type, file_size_bytes, width, height (from metadata)

STEP 4 — METADATA EXTRACTED
  Read EXIF/IPTC/XMP/C2PA from the stored original
  Generate metadata proposal
  Run provenance/declaration checks
  Store extracted metadata on vault_assets row

STEP 5 — ASSET ROW COMMITTED
  vault_assets row created with:
    creator_id, format, privacy_state, publication_state, declaration_state
    intrusion_level (default: 'standard')
    editorial metadata (title, description, tags, geography, etc.)
  Asset is now a governed entity — but has NO preview derivatives yet

STEP 6 — DERIVATIVE JOBS CREATED
  For each derivative spec (thumbnail, watermarked_preview, og_image):
    asset_media row created:
      asset_id, media_role, generation_status='pending'
      storage_ref=NULL (not yet generated)
      watermark_profile_version=NULL
  Jobs enqueued for async processing

STEP 7 — DERIVATIVES GENERATED (async, per job)
  Read original from storage
  Resize/compress to target dimensions (Sharp)
  For watermarked roles: composite watermark using approved profile
  Write derivative to storage: {bucket}/derivatives/{asset_id}/{role}.jpg
  Update asset_media row:
    storage_ref = derivative storage path
    generation_status = 'ready'
    width, height, file_size_bytes, content_type
    watermark_profile_version = profile.version

  On failure:
    generation_status = 'failed'
    No derivative stored
    Delivery returns 404 for this role (fail-closed)

STEP 8 — DELIVERY RESOLVER SERVES ELIGIBLE ROLES
  Preview request: governance check → role resolution → getReadyMedia()
    → 404 if generation_status != 'ready'
    → serve derivative with Cache-Control: private, max-age=300
  Original request: + entitlement check + rate limit + audit log
    → serve original with Cache-Control: no-store

  NEVER: serve original as fallback for missing derivative
  NEVER: serve pending/failed derivative
  NEVER: expose storage_ref to browser
```

### Ordering invariants

- **Step 3 before Step 6**: original MUST be persisted before derivative jobs are created. Derivative processing reads from stored original, not from the upload stream.
- **Step 5 before Step 6**: asset row MUST exist before derivative rows. `asset_media.asset_id` is a FK to `vault_assets.id`.
- **Step 7 is async and idempotent**: can be retried, re-run after profile changes, or run as backfill.
- **Steps 3-4 may be concurrent**: metadata extraction can happen in parallel with original storage write if the file bytes are available in memory. But the asset row (Step 5) must wait for both.

---

## 3. Data Model

### 3.1 Canonical entities (product truth)

| Entity / Field | Canonical? | Purpose |
|---|---|---|
| `vault_assets.id` | Yes | The governed work identity |
| `vault_assets.creator_id` | Yes | Who owns this work |
| `vault_assets.format` | Yes | Asset type (photo/video/audio/text/illustration/infographic/vector) |
| `vault_assets.privacy_state` | Yes | Discovery visibility |
| `vault_assets.publication_state` | Yes | Publication lifecycle |
| `vault_assets.declaration_state` | Yes | Provenance/validation status |
| `vault_assets.intrusion_level` | Yes | Creator's chosen watermark intensity (light/standard/heavy) |
| `vault_assets.creator_price_cents` | Yes | Commercial price |
| `vault_assets.enabled_licences` | Yes | Available licence types |
| `vault_assets.watermark_mode` | **Legacy** | Old frontend watermark mode — to be dropped after migration |
| `asset_media.media_role` | Yes | What this file IS (original/watermarked_preview/thumbnail/og_image) |
| `asset_media.storage_ref` | Yes | Where the file lives — opaque key, never exposed to browser |
| `licence_grants.*` | Yes | Sole source of original-delivery authorization |

### 3.2 Operational entities (pipeline machinery)

| Entity / Field | Operational? | Purpose |
|---|---|---|
| `asset_media.generation_status` | Yes | Pipeline state: pending/processing/ready/failed |
| `asset_media.watermark_profile_version` | Yes | Which profile version produced this derivative |
| `asset_media.file_size_bytes` | Yes | Post-processing file size |
| `asset_media.width` / `height` | Yes | Post-processing dimensions |
| `asset_media.created_at` | Yes | When this row was created |
| `watermark_profiles.*` | Yes | Processing recipes, versioned, approval-gated |
| `download_events.*` | Yes | Append-only audit trail |

### 3.3 What the DB knows vs what storage knows

**DB is authoritative for**:
- What the file IS (media_role)
- Whether it is READY to serve (generation_status)
- Who owns the asset (creator_id)
- Whether delivery is authorized (licence_grants)
- Which watermark profile was used (watermark_profile_version)

**Storage is authoritative for**:
- The actual file bytes
- Nothing else

**storage_ref is a pointer, not truth.** The DB owns the meaning; storage owns the bytes. If storage_ref points to a file that doesn't exist on disk, the delivery route returns 404 — same as if the row didn't exist. Storage path existence is never used as a proxy for authorization, readiness, or identity.

---

## 4. Storage Model

### 4.1 Storage contract

| Category | Path pattern | Deterministic? | Example |
|---|---|---|---|
| Originals | `originals/{asset_id}/{original_filename}` | Yes (from asset_id + filename) | `originals/a1b2c3d4/IMG_4521.jpeg` |
| Thumbnails | `derivatives/{asset_id}/thumbnail.jpg` | Yes (from asset_id + role) | `derivatives/a1b2c3d4/thumbnail.jpg` |
| Watermarked previews | `derivatives/{asset_id}/watermarked_preview.jpg` | Yes (from asset_id + role) | `derivatives/a1b2c3d4/watermarked_preview.jpg` |
| OG images | `derivatives/{asset_id}/og_image.jpg` | Yes (from asset_id + role) | `derivatives/a1b2c3d4/og_image.jpg` |

### 4.2 Rules

1. **Paths are deterministic** from (asset_id, media_role). Given both, the storage path is computable. But the DB `storage_ref` column is the canonical pointer — never derive the path at delivery time.
2. **Originals preserve the source filename** in the path for provenance. The filename is metadata, not identity.
3. **Derivatives always use role-based filenames** (`thumbnail.jpg`, `watermarked_preview.jpg`, `og_image.jpg`). No versioning in the filename — overwritten on re-generation.
4. **All derivatives are JPEG.** Originals preserve their source format.
5. **Storage paths are opaque to the browser.** Resolved server-side only.
6. **No CDN or signed URL in this pass.** Route handler reads and streams. CDN/signed-URL is a future optimization.

### 4.3 What is stored in DB vs inferred

| Data point | Stored in DB | Inferred from path? |
|---|---|---|
| media_role | `asset_media.media_role` | Never inferred |
| generation_status | `asset_media.generation_status` | Never inferred |
| storage_ref | `asset_media.storage_ref` | Never inferred — stored explicitly |
| content_type | `asset_media.content_type` | Never inferred from extension at delivery time |
| file existence | N/A | Verified at read time, but failure = 404, not "regenerate" |

**Your instruction is the governing rule**: the database knows what a file is, what role it has, and whether it is ready. Storage paths support that, not replace it.

---

## 5. Failure and Retry Model

### 5.1 Fail-closed rules

| Scenario | Behavior | HTTP |
|---|---|---|
| Derivative `generation_status != 'ready'` | 404, do not serve | 404 |
| Derivative row doesn't exist | 404, do not serve | 404 |
| Storage file missing on disk | 404, do not serve | 404 |
| Approved profile missing for (level, family) | Processing refuses to start, derivative stays `pending` | N/A |
| Original missing when derivative job runs | Job fails, `generation_status = 'failed'` | N/A |
| **Never**: serve original as fallback | — | — |
| **Never**: serve failed/pending derivative | — | — |

### 5.2 Retry behavior

- Processing jobs are **idempotent**. Re-running for the same (asset_id, media_role) overwrites the previous derivative.
- `generation_status` transitions: `pending → processing → ready` (success) or `pending → processing → failed` (error).
- Failed jobs can be retried by resetting `generation_status` to `pending` and re-enqueuing.
- **No automatic retry.** Retry is an explicit operational action (manual or via scheduled job).
- Retry preserves the (asset_id, media_role) UNIQUE constraint — no duplicate rows created.

### 5.3 Idempotency guarantee

- **Same input, same output**: given the same original file + same watermark profile version, the derivative is byte-equivalent (Sharp with deterministic settings).
- **UNIQUE constraint**: `(asset_id, media_role)` prevents duplicate rows. INSERT OR UPDATE semantics.
- **Re-generation after profile change**: find derivatives where `watermark_profile_version < current_approved_version`, reset to `pending`, re-process.

### 5.4 Backfill rules

- Assets with `original` media row but missing derivative rows → create `pending` derivative rows → process.
- Assets with no `original` media row → cannot generate derivatives. These are incomplete imports requiring original file provision.
- Backfill uses the same pipeline as new uploads. No special code path.

---

## 6. Beta Migration Compatibility

### 6.1 How imported beta assets enter the lifecycle

Beta assets arrive with an original file but no canonical derivatives.

```
IMPORT:
  1. Write original to storage
  2. Create asset_media row: role='original', status='ready'
  3. Create vault_assets row with mapped metadata
  4. NO derivative rows created at import time

POST-IMPORT BACKFILL:
  5. Backfill job finds assets with original but missing derivatives
  6. Creates pending derivative rows
  7. Processes through standard pipeline
  8. Derivatives appear as they complete
```

### 6.2 What is imported directly

| Field | Action | Notes |
|---|---|---|
| Original file bytes | Direct write to storage | Source of truth, preserved as-is |
| title, description, tags | Direct mapping | Text fields |
| format | Map + lowercase | "Photo" → "photo" |
| privacy, publication | Direct mapping | Same enum values |
| capture_date, geography | Direct mapping | |
| creator_id | Resolve to new user ID | Requires user migration first |

### 6.3 What is regenerated later

| Artifact | Action | Notes |
|---|---|---|
| thumbnail | Generated from original | 400px short edge, JPEG q80 |
| watermarked_preview | Generated from original | 1600px long edge, JPEG q85, watermarked |
| og_image | Generated from original | 1200x630, JPEG q85, watermarked |

### 6.4 What legacy fields require mapping

| Legacy field | Maps to | Rule |
|---|---|---|
| `watermark_mode='none'` | `intrusion_level` | **Founder decision required** — 'none' has no equivalent in new system |
| `watermark_mode='subtle'` | `intrusion_level='light'` | Direct mapping |
| `watermark_mode='standard'` | `intrusion_level='standard'` | Direct mapping |
| `watermark_mode='strong'` | `intrusion_level='heavy'` | Direct mapping |
| `thumbnailRef` / `thumb` / `poster` / `cardImage` / `cover` | Re-resolve via `resolveProtectedUrl()` | Never import raw storage paths into preview URLs |
| `format` (capitalized) | Lowercase | "Photo" → "photo" |

### 6.5 Assumptions about legacy data

1. Each beta asset has exactly one file (the original). No pre-existing derivatives.
2. Beta storage paths will be remapped to the new path scheme during import.
3. Beta `watermark_mode` values exist and are one of none/subtle/standard/strong.
4. Creator identity resolution (beta user → production user) is handled by a separate user migration, not by this pipeline.

---

## 7. Founder Decisions Still Required

1. **`watermark_mode='none'` mapping**: Legacy assets that opted out of watermarking. In the new system, every preview is watermarked. Should these receive `intrusion_level='light'` (least intrusive) or `'standard'` (default)?

2. **Watermark profile approval**: The 6 draft profiles (3 levels x 2 families) remain unapproved. The processing pipeline will refuse to generate watermarked derivatives until at least one profile per (level, family) pair is approved.

3. **Derivative dimension targets**: Thumbnail 400px short edge, watermarked_preview 1600px long edge, og_image 1200x630 — proposed but not frozen as canonical.

4. **`detail_preview` merge timing**: The `detail_preview` role exists in the enum. The containment pass reverted the lightbox-preview remap. When should the merge happen? At pipeline activation, or deferred?

5. **Storage bucket configuration**: Supabase Storage vs. S3 vs. other. The architecture is bucket-agnostic but the actual bucket setup requires infrastructure decisions.

6. **Concurrency model**: Single-server in-process queue vs. external job queue. Affects whether row-level locking is needed on `asset_media` during processing.

---

## 8. Sequencing Recommendation

Per your instruction:

1. **Lock ingestion/storage lifecycle** — define the exact upload API, storage write, and asset_media row creation sequence. No ambiguity about what writes where and when.

2. **Lock delivery fail-closed behavior** — confirm the existing delivery route's fail-closed invariants are sufficient. Add tests for edge cases (missing derivative, missing original, concurrent processing).

3. **Lock retry/backfill model** — define the exact query for finding assets needing re-processing, the status transition rules, and the backfill job interface.

4. **Wire the dormant processing module** — connect the real upload flow to the derivative pipeline. This is the activation step — everything before it is preparation.

---

## 9. Governing Principle

> The database knows what a file is, what role it has, and whether it is ready.
> Storage paths support that, not replace it.

This means:
- `media_role` is an enum column, not parsed from a filename
- `generation_status` is a state machine column, not inferred from file existence
- `storage_ref` is a stored pointer, not computed from a convention
- Authorization comes from `licence_grants`, not from storage ACLs
- Delivery decisions are made from DB state, then verified against storage
