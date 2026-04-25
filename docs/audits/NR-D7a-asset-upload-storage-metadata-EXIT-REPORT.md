# NR-D7a Exit Report — Asset Upload + Storage + Metadata UI

**Directive:** `docs/public-newsroom/directives/NR-D7a-asset-upload-storage-metadata.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Predecessor:** `5a7c100` (NR-D6b — pack creation flow + details tab)
**Date:** 2026-04-25
**Verdict (self-assessment):** Pass.

---

## 1. Summary

Locked scope after IP-1 + IP-2 ratification: **4 EDIT + 8 NEW = 12 deliverables** (was 1 EDIT + 7 NEW in directive header — IP-1 added F0a/b/c storage extension; IP-2 split F7 into F7a + F7b). Total source lines added across the 12 source files ≈ 2,884.

| F# | File | Lines | Action | Role |
|---|---|---|---|---|
| **F0a** | `src/lib/storage/types.ts` | 190 (+59) | EDIT | Add `SignedPutUrlInput` / `SignedPutUrlOutput` + `signedPutUrl` interface method (IP-1) |
| **F0b** | `src/lib/storage/supabase-adapter.ts` | 184 (+50) | EDIT | Implement `signedPutUrl` via `createSignedUploadUrl` (IP-1) |
| **F0c** | `src/lib/storage/fs-adapter.ts` | 113 (+18) | EDIT | Throw with "use supabase driver" message (IP-1, Option A1) |
| F1 | `manage/packs/[packSlug]/assets/page.tsx` | 150 | NEW | Server-component shell — assets list + upload zone |
| F2 | `_components/pack-editor-shell.tsx` | 133 (+22) | EDIT | Flip Assets tab from disabled span to active link |
| F3 | `assets/_components/upload-zone.tsx` | 471 | NEW (`'use client'`) | Drag-drop + checksum + dimensions + signed-URL fetch + PUT + progress |
| F4 | `assets/_components/asset-row.tsx` | 274 | NEW (`'use client'`) | 4-state matrix + metadata edit + delete |
| F5 | `api/.../assets/route.ts` | 385 | NEW | POST: auth → admin → INSERT asset + scan_result + signedPutUrl |
| F6 | `api/.../assets/[assetId]/route.ts` | 419 | NEW | PATCH metadata + DELETE (with best-effort storage cleanup) |
| **F7a** | `src/lib/newsroom/asset-form-constants.ts` | 124 | NEW (client-safe) | Constants + `kindFromMime` + `extensionForMime` + `newsroomOriginalPath` (IP-2) |
| **F7b** | `src/lib/newsroom/asset-form.ts` | 172 | NEW (`'server-only'`) | zod schemas with kind-specific dim refines (IP-2) |
| F8 | `__tests__/asset-form.test.ts` | 269 | NEW | 28 vitest cases |

**Audit findings that shaped the implementation** (per §3 of the directive; all four IPs ratified by founder pre-composition):

| Audit | Resolution |
|---|---|
| **(a) `newsroom_assets` RLS** | SELECT + INSERT policies at [migration:632/647](supabase/migrations/20260425000001_newsroom_schema_foundation.sql:632) gate via `EXISTS` on parent pack with `is_newsroom_editor_or_admin(p.company_id)`. Service-role bypasses. ✓ Same posture as NR-D6b. |
| **(b) `newsroom_asset_scan_results`** | Table at [d2a:110](supabase/migrations/20260425000002_newsroom_schema_d2a.sql:110). **`scanner_suite text NOT NULL` + `scanner_version text NOT NULL`** — IP-3 sentinel values. No auto-create trigger; F5 explicitly INSERTs. |
| **(c) Schema.ts row types** | `NewsroomAssetKind` (line 627), `NewsroomAssetRow` (681), `NewsroomScanResult` (710 — note: NOT `NewsroomAssetScanState` as directive named), `NewsroomAssetScanResultRow` (729). All present from NR-D1/D2a. |
| **(d) Storage adapter — CRITICAL GATE** | `StorageAdapter` lacked `signedPutUrl`. **IP-1 ratified Option A1.** F0a extends interface; F0b implements via `createSignedUploadUrl`; F0c throws with clear message. |
| **(e) Path convention** | `originalPath(assetId, filename)` at [paths.ts:37](src/lib/storage/paths.ts:37) is vault-namespace; `validateStorageRef` doesn't enforce a prefix → newsroom paths pass. F7a's `newsroomOriginalPath` produces `newsroom/packs/{packId}/assets/{assetId}/original.{ext}` separate namespace. ✓ |
| **(f) Checksum + dimensions** | No client-side helper exists. F3 introduces `crypto.subtle.digest` + DOM-API dim extraction inline. v1 acceptance: synchronous full-buffer hash for 500MB files (memory cost acceptable on desktop). |
| **(g) Editor shell tab** | NR-D6b F3's pack-editor-shell.tsx had Assets as `<span>`. F2 EDIT flips to `<Link>`; Embargo stays disabled until NR-D8. |

---

## 2. IPs surfaced and resolved

All four IPs ratified pre-composition. None diverged in implementation.

| IP | Verdict | Implementation |
|---|---|---|
| **IP-1** Extend `StorageAdapter` with `signedPutUrl` (Option A1) | APPROVE | F0a extends interface; F0b Supabase impl via `createSignedUploadUrl`; F0c fs-adapter throws with clear message pointing operators at `FFF_STORAGE_DRIVER=supabase`. ~127 lines combined. |
| **IP-2** Split F7 into client-safe constants + server-only zod | APPROVE | F7a (`asset-form-constants.ts`, no marker) + F7b (`asset-form.ts`, `'server-only'`). F3/F4 import values from F7a; F5/F6 import zod from F7b; F8 tests both. |
| **IP-3** Sentinel scanner values for scan_results | APPROVE | F5 INSERTs scan_result row with `scanner_suite='unscanned'`, `scanner_version='0.0.0'`, `result='pending'` (default). NR-D7b overwrites all three when its scanner runs. Documented inline in F5 + below in §3. |
| **IP-4** Type-name correction (`NewsroomScanResult`, not `NewsroomAssetScanState`) | APPROVE | All references in F1/F4 use `NewsroomScanResult`. |

**No mid-session IPs surfaced.** Composition followed the ratified plan exactly.

---

## 3. Decisions that diverged

Three small directive-vs-implementation reconciliations, all benign:

1. **F5 sentinel scanner values for the scan_results NOT-NULL columns (IP-3 ratified).** `newsroom_asset_scan_results.scanner_suite` and `scanner_version` are `text NOT NULL` per migration. NR-D7a writes `scanner_suite='unscanned'` and `scanner_version='0.0.0'`. NR-D7b's scanner pipeline overwrites both with real values when it runs. F5 inline-documents this contract so NR-D7b's audit picks it up on dispatch.

2. **F2 disables the Assets tab in create mode (no pack yet).** PRD §5.1 P6 implies the tab is always present after Pack creation, but in create mode (`pack === null`, before Save Draft has run) there's no `pack.slug` to route to. F2 renders a disabled `<span>` with title "Save the pack first to upload assets." until a draft exists. After save → redirect to edit page → tab becomes a `<Link>`. PRD-silent on the create-mode case; mirrors NR-D6b's "save first" UX shape.

3. **Two-INSERT shape for F5 (asset row + scan_result row) is sequential, not transactional.** PostgREST doesn't expose multi-table transactions. If the second INSERT fails, the first leaves an orphan asset row with no scan_result. Per directive §F5 step 9, accepted v1. v1.1 cleanup sweep handles orphans. Logged in F5 inline.

---

## 4. Open questions for founder

- **Visual smoke (VERIFY 7) deferred.** Same fixture-dependence as NR-D5b-i / NR-D6a / NR-D6b. End-to-end upload path is not exercised in this directive.

- **fs-adapter throws on `signedPutUrl` (IP-1 Option A1 trade-off).** Dev environments default to `FFF_STORAGE_DRIVER=fs`. Asset uploads now require `FFF_STORAGE_DRIVER=supabase` in dev (the local Supabase docker stack already runs for migrations + DB). Worth confirming whether NR-D7b should switch the dev default to `supabase`, OR whether NR-D7a should add a tiny dev-only Next.js route to satisfy the fs-adapter side (Option A2 from the IP). Either path completes the dev story; A1 punts that work.

- **Orphan-asset cleanup posture.** Two failure modes leave orphans:
  1. F5 step 1 INSERT succeeds, step 2 INSERT fails → asset row without scan_result.
  2. F5 succeeds completely, but client never PUTs the bytes (network drop) → asset row + scan_result row, no storage object.
  
  v1 accepts both; a v1.1 housekeeping sweep can flag-and-clean. Worth confirming the cadence (cron job? on-demand admin action? automatic on next pack edit?).

- **Replace + Retry-scan buttons in F4 are dead UI in NR-D7a.** They render disabled with a "ships in v1.1 / NR-D7b" tooltip when reachable. That keeps the 4-state matrix structurally complete so NR-D7b doesn't need F4 changes, but it's UI debt — disabled buttons that never enable can confuse users. Worth confirming whether v1.1 polish should hide them entirely (gate on capability flag) versus showing-disabled.

- **Audio MIMEs include `audio/mpeg`** (the canonical MIME for `.mp3`). Some browsers report `.mp3` files as `audio/mp3` (non-canonical). The `kindFromMime` lowercase fold catches case variants but not non-canonical aliases. F3 may need a small alias map if user reports surface this — not blocking.

---

## 5. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/asset-form.test.ts
 Test Files  1 passed (1)
      Tests  28 passed (28)
   Duration  394ms
```

28/28 passed. Breakdown:

| Group | Count | Notes |
|---|---|---|
| `kindFromMime` | 3 | accepted MIMEs (12 cases), rejects unaccepted, defensive case+whitespace |
| `extensionForMime` | 3 | accepted MIMEs (7 cases), rejects unaccepted, parity with kindFromMime |
| `newsroomOriginalPath` | 2 | canonical shape, extension preserved |
| `createAssetSchema` | 13 | image/video/audio happy paths, dim refines (image/video/audio), oversize, max-boundary, checksum format (3 bad shapes), bad kind, negative size, document/text without dims |
| `updateAssetMetadataSchema` | 7 | empty rejected, single-field, alt-text only, trademark-only, null caption, oversized caption, multi-field |
| **Total** | **28** | (directive estimated 14–18; extras are defensive and consistent with NR-D6a/D6b density) |

Full newsroom suite (VERIFY 3): **190/190 across 11 files** — NR-D5b-i + NR-D5b-ii + NR-D4 + NR-D6a + NR-D6b + NR-D7a all green.

---

## 6. Build + typecheck

| Step | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 (silent) |
| Vitest (asset-form) | `bunx vitest run src/lib/newsroom/__tests__/asset-form.test.ts` | 28/28 pass |
| Vitest (full newsroom) | `bunx vitest run src/lib/newsroom/__tests__` | 190/190 across 11 files |
| Build | `bun run build` | exit 0; **route count 106 → 109 (+3)** — `/manage/packs/[packSlug]/assets`, `/api/.../assets`, `/api/.../assets/[assetId]` |
| Scope diff | `git status --porcelain` | 4 modified (F0a + F0b + F0c + F2) + 8 untracked (F1/F3/F4/F5/F6/F7a/F7b/F8 split into 6 paths via folders); zero strays |

Route count delta confirmed: baseline 106 (NR-D6b close) → 109 with the 3 new routes.

---

## 7. Runtime smoke

Two-phase smoke per the standing carry-forward (dev-server bounce before curl smoke).

**VERIFY 6 — four new route surfaces (no auth):**

```
$ curl -s -H "Host: newsroom.frontfiles.localhost" \
    http://localhost:3000/some-test-org/manage/packs/some-pack/assets
HTTP 200 — body 31 841 bytes; AdminGate "Loading…" placeholder present

$ curl -s -X POST -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/assets
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X PATCH -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/assets/some-id
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X DELETE \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/assets/some-id
HTTP 401 {"ok":false,"reason":"unauthenticated"}
```

All four route surfaces fail-closed at the auth boundary. Page route returns 200 with the AdminGate `Loading…` placeholder (auth gate fires client-side; same pattern as every prior NR-D6 page).

**End-to-end upload (POST → signed URL → PUT → row visible)** was NOT executed — would require:
- Signed-in admin Bearer token + a real verified-source company in fixtures
- `FFF_STORAGE_DRIVER=supabase` env + a Supabase Storage bucket configured
- A test file under 500MB with computable dimensions

Coverage delivered without that:
- F8 unit tests (28/28) cover schemas + path helper + MIME mapping
- typecheck on F3/F4's complex client-side state machines
- VERIFY 6 confirms server response shape + auth gate

---

## 8. Verdict

**Pass.** Directive scope met as ratified after IP-1's storage extension and IP-2's F7 split: 4 EDIT + 8 NEW = 12 deliverables; +3 routes (106 → 109). All four IPs honoured. PRD §5.1 P7 copy verbatim in F3 (upload-zone empty/drag-over/error strings) + F4 (scan-state matrix + metadata field labels). F5 admin gate matches NR-D6b precedent (direct membership query, admin-only). Storage adapter extended cleanly without forking — both fs and Supabase implementations land in one pass, fs throws with a clear operator message rather than failing silently. F4 implements the full 4-state matrix even though only `'pending'` is reachable in NR-D7a runtime; NR-D7b can light up the others without touching F4. Two-INSERT pattern in F5 with sentinel scanner values is documented inline so NR-D7b's audit picks up the contract.

NR-D7a is ready for commit + push + founder ratification.

**Next directive in sequence:** NR-D7b (AV scanning pipeline) — overwrites the F5 sentinel scanner_suite/scanner_version values when its scanner runs, lights up F4's `'clean' / 'flagged' / 'error'` branches.

---

## 9. Carry-forward observations for NR-D7b and beyond

1. **Storage adapter `signedPutUrl` is now part of the contract.** Every adapter implementation must support it (or throw with a clear message — fs's pattern). Future adapters (S3, R2, etc.) need to implement.

2. **Sentinel scanner values are an inter-directive contract.** F5 writes `scanner_suite='unscanned'` + `scanner_version='0.0.0'`. NR-D7b's scanner pipeline overwrites both. Worth ratifying these strings as constants in `asset-form-constants.ts` if NR-D7b also references them — currently they're inline strings in F5 only.

3. **dev workflow now requires `FFF_STORAGE_DRIVER=supabase` for asset uploads.** fs-adapter throws on `signedPutUrl`. Dev `.env.local` may need updating; document in NR-D7b's audit if it touches the upload path.

4. **Path-namespace convention is now `newsroom/packs/{packId}/assets/{assetId}/original.{ext}`.** NR-D11 (consumer download path) and any future surface that resolves storage refs should respect this namespace. `validateStorageRef` doesn't enforce prefixes; convention is application-layer.

5. **F4's 4-state matrix is structurally complete but only `'pending'` is reachable.** Replace + Retry-scan buttons render disabled with "ships in NR-D7b/v1.1" tooltips. NR-D7b should wire those buttons (or hide them with a capability flag) when it lands.

6. **Two-INSERT pattern for atomic-ish multi-row writes.** Without PostgREST transactions, sequential INSERTs leave orphans on partial failure. Documented as accepted v1; future cleanup sweep is a v1.1 housekeeping job. NR-D8 (embargo) likely faces the same shape — Pack + Embargo + Recipients all interdependent.

7. **Client-side full-file hashing for 500MB is acceptable v1.** Memory cost is real (one `ArrayBuffer` per concurrent upload); v1.1 polish could move to chunked digest using Web Streams + transformer when available everywhere.

8. **AdminGate inheritance still works for nested routes.** `/manage/packs/[packSlug]/assets` is two levels deeper than `/manage/`; layout inheritance covers it without any extra gate. NR-D7b/D8/D9 can rely on the same.
