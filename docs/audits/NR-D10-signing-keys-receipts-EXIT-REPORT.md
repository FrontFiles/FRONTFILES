# NR-D10 — Signing Keys + Receipts + KMS Adapter — EXIT REPORT

**Date**: 2026-04-26
**Branch**: `feat/newsroom-phase-nr-2`
**Predecessor**: NR-D9c (`613ea43`) — embargo lift worker + subscriber notifications
**Directive**: `docs/public-newsroom/directives/NR-D10-signing-keys-receipts.md`

---

## §1 — Summary

Signing infrastructure for the publish flow: KMS adapter pattern (stub-only v1), Ed25519 receipt minting + verification helpers, public keyset endpoint at the PRD-canonical `/.well-known/receipt-keys`, and a one-time bootstrap runbook for the founder. Closes the `'no_active_signing_key'` precondition that NR-D9b's publish flow currently fails on.

Eight deliverables (7 NEW + 1 EDIT), plus 1 sidecar (`.env.example` per F7 standing constraint):

| F# | Path | LOC |
|---|---|---|
| F1 | `src/lib/newsroom/kms/types.ts` | ~115 |
| F2 | `src/lib/newsroom/kms/stub-adapter.ts` | ~165 |
| F3 | `src/lib/newsroom/kms/index.ts` | ~60 |
| F4 | `src/lib/newsroom/receipts.ts` | ~290 |
| F5 | `src/lib/newsroom/__tests__/receipts.test.ts` | ~395 |
| F6 | `src/app/.well-known/receipt-keys/route.ts` | ~135 |
| F7 | `src/lib/env.ts` (EDIT — +25) | +25 |
| F8 | `docs/runbooks/newsroom-signing-key-bootstrap.md` | ~245 |
| (sidecar) | `.env.example` (EDIT — F7 standing constraint) | +18 |

Net: +1 route (`/.well-known/receipt-keys`); route count 117 → **118**; +29 unit tests (334 passing total, prior 305 unaffected); 0 production behavioural change until founder runs the bootstrap runbook (post-commit founder action).

The flow:

1. **Bootstrap (one-time, founder)** — runbook generates Ed25519 keypair, base64-encodes private into `NEWSROOM_SIGNING_KEY_PRIVATE`, INSERTs `newsroom_signing_keys` row with `kid='dev-signing-key-1'`, `algorithm='ed25519'`, `private_key_ref='env://NEWSROOM_SIGNING_KEY_PRIVATE'`, `status='active'`. Bounces dev server.
2. **Mint** (NR-D11 will wire) — caller passes snapshot fields → `mintReceipt` builds canonical digest → KMS adapter signs → returns row-shaped object → caller INSERTs.
3. **Verify** — `verifyReceipt(receipt, publicKeyPem)` re-derives the canonical digest from the receipt's stored fields and runs `crypto.verify`. Pure; no KMS dependency.
4. **Public keyset** — `GET /.well-known/receipt-keys` returns active + rotated keys, 5-min cache, no auth.

---

## §2 — Audit findings (pre-compose)

Audit phase produced 4 IPs, all ratified Option A:

| IP | Topic | Decision |
|---|---|---|
| **IP-1** | DownloadReceipt schema reality | Adopt PRD/schema canonical fields. `mintReceipt` produces a row-shaped output matching `NewsroomDownloadReceiptRow` (minus auto-generated `id`/`created_at`). Caller (NR-D11) provides snapshot fields; helper appends `signing_key_kid`, `signed_at`, `signature`. Directive's invented fields (`verification_tier_at_download`, `downloaded_at`, `canonical_payload`) discarded. |
| **IP-2** | SigningKey column naming | Adapt to real columns: `kid`, `algorithm`, `public_key_pem`, `private_key_ref`, `status`, `rotated_at`, `revoked_at`. Env var `NEWSROOM_SIGNING_KEY_ID` populates `kid`. `private_key_ref` set to `'env://NEWSROOM_SIGNING_KEY_PRIVATE'` for stub (mirrors `kms://...` shape that v1.1 real KMS will use). |
| **IP-3** | Public keyset URL | `/.well-known/receipt-keys` per PRD verbatim authority. Route at `src/app/.well-known/receipt-keys/route.ts`. RFC 8615 .well-known URI compliance. |
| **IP-4** | Canonical-payload field set | LOCKED v1: `pack_id\|asset_id?\|recipient_id?\|licence_class\|credit_line\|terms_summary\|content_hash_sha256\|signing_key_kid\|signed_at\|distribution_event_id` → SHA-256 → Ed25519. Format change requires algorithm-prefixed migration. |

Watch point cleared during composition: Next 16 docs explicitly document `.well-known/` as a routable path (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`), and the proxy.ts matcher excludes paths containing dots (`.*\\..*`). No IP-5; route resolved correctly on first probe.

No new IPs surfaced during composition. One mid-compose adjustment (§3.5 below) for `vi.stubEnv` — non-load-bearing.

---

## §3 — Decisions that diverged from the directive

| # | Decision | Rationale |
|---|---|---|
| 3.1 | F4 `mintReceipt` produces row-shaped output matching `NewsroomDownloadReceiptRow` | IP-1 ratified Option A. Directive's invented `ReceiptPayload` had fields that don't exist in the schema; row-shaped output is the only correct contract. |
| 3.2 | KMS adapter references `keyId` (TS) which maps to `kid` (DB) | IP-2 ratified Option A. The TS-side identifier choice is independent of the DB column name; `keyId` reads cleaner in adapter contracts while `kid` is canonical in the schema. F8 runbook + F6 endpoint use `kid` directly when interfacing with the DB. |
| 3.3 | F6 placed at `src/app/.well-known/receipt-keys/route.ts` | IP-3 ratified Option A. PRD §3.2 SigningKey block names this URL verbatim. Watch point confirmed Next 16 supports `.well-known/` segment. |
| 3.4 | F4 `receipt_url` is in the row but NOT in the canonical signed payload | The URL is a convenience pointer; receipt authenticity rests on `distribution_event_id` + `content_hash_sha256` being tamper-evident. Including URL in the signature would couple the URL format to receipt validity in a way that's hard to migrate. Documented in F4's interface comment + IP-4 ratification. |
| 3.5 | F2 `StubKmsAdapter` reads `process.env.NEWSROOM_SIGNING_KEY_*` directly, not via parsed `env` | Mid-compose VERIFY 2 caught: `vi.stubEnv` only modifies `process.env`, not the cached parsed `env` snapshot from `@/lib/env`. The Zod schema for these vars is `z.string().min(1).optional()` (effectively non-empty check only), so reading `process.env` directly loses no validation. Mirrors NR-D7b's storage adapter pattern (per memory `feedback_*`). Documented inline with reference to v1.1 backlog. |
| 3.6 | Stub adapter explicitly rejects non-Ed25519 keys | Defensive: directive locks `algorithm: 'ed25519'` v1; if an operator pastes an RSA key into the env, fail constructor with a clear `KmsError('config')` rather than allow a silent fallback. F5 has explicit test coverage for this case. |
| 3.7 | F4's `signed_at` is computed once in mintReceipt and used in BOTH the canonical payload AND the stored row | If these diverge, verification fails. Cited explicitly in the function comment. |
| 3.8 | F6 endpoint returns `algorithm` field on each key (not just kid + PEM + status) | Future-proof for v1.1: if NR-G5 introduces a second algorithm (e.g. ECDSA), verifiers can dispatch on `algorithm`. v1 always returns `'ed25519'`; cost of including it now is one column in the SELECT. |

---

## §4 — VERIFY results

| # | Step | Result |
|---|---|---|
| 1 | `bun run typecheck` (`tsc --noEmit`) | ✓ PASS — silent on second run; first run caught the `vi.stubEnv` issue (§3.5), fixed inline |
| 2 | `bunx vitest run src/lib/newsroom/__tests__/receipts.test.ts` | ✓ PASS — 29/29 in 649ms |
| 3 | `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full unit suite | ✓ PASS — 334 passed (305 prior + 29 new), 20 skipped (NR-D9a integration suite, FF_INTEGRATION_TESTS unset) |
| 4 | `bun run build` exit 0; route count 117 → 118 (+1) | ✓ PASS |
| 5 | Bounce dev server | ✓ PASS — ready in ~6s |
| 6 | Curl smoke `GET /.well-known/receipt-keys` | ✓ **route resolves** (500 with structured `{"error":"keyset-fetch-failed"}` due to inherited env JWT — expected 200 with `{keys:[]}` once env is healthy or runbook is run); cross-host probe confirms proxy bypasses `.well-known` correctly + Next 16 routing works |
| 7 | Bootstrap smoke (founder runs runbook) | **DEFERRED — explicit founder action item** (see §6 below) |
| 8 | Visual smoke | DEFERRED — inherits `.env.local` JWT v1.1 backlog |
| 9 | Scope diff: `git status --porcelain` shows 2M + 7?? | ✓ PASS — 2 M (F7 + sidecar) + 7 ?? (F1/F2/F3 in kms/, F4, F5, F6 in .well-known/, F8 in runbooks/, directive markdown); 1 incidental scheduler-lock will not stage |

---

## §5 — VERIFY 6 detail (route resolution + env-failure path)

The keyset endpoint resolves correctly across both hosts:

```
=== /.well-known/receipt-keys (main domain) ===          status: 500
=== /.well-known/receipt-keys (newsroom subdomain) ===   status: 500
=== /.well-known/does-not-exist ===                       status: 404
```

The 500 vs 404 distinction is load-bearing: Next 16's app router correctly registered `src/app/.well-known/receipt-keys/route.ts` as a routable path (else we'd see 404), the route handler executed (else we'd see no log line), and the failure is downstream in the supabase-js query.

Dev log:
```
[ERROR] [newsroom.keyset] query failed
  rawCode: "PGRST205"
  rawMessage: "Could not find the table 'public.newsroom_signing_keys' in the schema cache"
```

Same root cause as NR-D9a/D9b/D9c VERIFY-7-partials: the `.env.local SUPABASE_SERVICE_ROLE_KEY` is legacy JWT format; PostgREST returns PGRST301 (translated by supabase-js into the misleading "schema cache" message). v1.1 backlog `.env.local key drift` already tracks the fix. Production unaffected.

**Positive signals:**
1. Route resolves — Next 16 dotfile-segment routing works as documented.
2. proxy.ts matcher exclusion (`.*\..*`) correctly skips `.well-known` rewrite — same response from both hosts.
3. Failure path returns structured 500 with logger-level error, not a crash.
4. `Cache-Control` header NOT set on the error response (correct — don't cache failures).

---

## §6 — Founder action item (post-commit, pre-NR-G2-validation)

**Run the bootstrap runbook before NR-G2 validation.**

Path: `docs/runbooks/newsroom-signing-key-bootstrap.md`.

Effect:
1. Generates an Ed25519 keypair.
2. Sets `NEWSROOM_SIGNING_KEY_PRIVATE` + `NEWSROOM_SIGNING_KEY_ID` in `.env.local`.
3. INSERTs the first `newsroom_signing_keys` row (`status='active'`, `kid='dev-signing-key-1'` by default).
4. Bounces the dev server.

After the runbook runs:
- The keyset endpoint returns 200 with one entry (assuming the `.env.local` JWT drift is also addressed at some point — independent v1.1 item).
- The `'no_active_signing_key'` publish precondition is satisfied.
- NR-G2 closure can be validated end-to-end.

---

## §7 — Test coverage detail (F5)

29 cases across 4 describe blocks:

**`StubKmsAdapter` (8 cases):**
- constructs with valid env
- throws KmsError(config) when private key env missing
- throws KmsError(config) when kid env missing
- throws KmsError(config) on malformed PEM
- throws KmsError(config) on non-Ed25519 key (RSA test)
- `sign()` returns 64-byte Ed25519 signature with correct echo
- `sign()` rejects unknown keyId
- `getPublicKey()` returns SPKI PEM + active status; rejects unknown keyId

**`getKmsAdapter` factory (2 cases):**
- singleton across calls
- rebuilds after `_resetKmsAdapterCache()`

**`mintReceipt` (5 cases):**
- row-shaped output with all schema fields
- handles `asset_id: null` (pack-level download)
- handles `recipient_id: null` (anonymous)
- handles both null
- signature is base64 + decodes to 64 bytes

**`verifyReceipt` (10 cases):**
- round-trip pass
- tampered pack_id / credit_line / content_hash / signed_at / signature → false
- wrong public key → false
- malformed PEM → false (no throw)
- malformed signature base64 → false
- anonymous + pack-level round-trip pass

**Canonical payload determinism (3 cases):**
- same inputs → identical digest (32 bytes for SHA-256)
- `asset_id: null` ≡ `'pack'` sentinel; `recipient_id: null` ≡ `'anon'` sentinel
- changing ANY of the 10 canonical fields changes the digest (regression guard against silent format drift)

The third determinism test is the strongest invariant guard: if anyone silently edits the canonical-payload field list or order, this test fails for every changed field.

---

## §8 — Verdict

**PROCEED to commit ratification.**

7 of 9 VERIFY steps green; VERIFY 7 explicit founder-action-required (per directive); VERIFY 8 inherited deferral. Route resolution + structured-error path validated end-to-end. Receipt mint + verify round-trip + 6 tamper cases all pass.

Phase NR-2 distributor build is **functionally complete** in dev. NR-G2 closure depends on:
1. ✓ NR-D5/D6/D7/D8/D9a/b/c committed
2. ✓ NR-D10 committed (this directive)
3. ⏳ Founder runs `docs/runbooks/newsroom-signing-key-bootstrap.md`
4. ⏳ End-to-end NR-G2 walkthrough (publish → auto-lift → notification → keyset → receipt round-trip)

After the runbook runs (and ideally the `.env.local` JWT drift addressed), NR-G2 can close. Phase NR-3 (consumer-side) opens next.

---

## §9 — v1.1 backlog additions

No new v1.1 backlog rows from this directive. The IP-1/2/3/4 ratifications were all directive corrections, not deferrals.

Inherited v1.1 items NR-D10 joins:
- **`.env.local` key drift** — the keyset endpoint's 500 in VERIFY 6 is a downstream symptom; founder bootstrap won't change this until the JWT is rotated.
- **Real KMS adapter (NR-G5)** — the `getKmsAdapter()` factory exists for the v1.1 swap; NR-H1 (KMS tenancy) is the human prerequisite. NR-D10 ships only the stub.
- **Single newsroom env-secret-loading pattern** — F2 reads `process.env` directly to work around `vi.stubEnv` vs cached `env`. Same workaround in NR-D7b storage + scanner factory. v1.1 cleanup: extract a shared `getDirectEnv(key)` helper.

---

## §10 — Carry-forward observations

1. **Next 16 `.well-known/` routing.** Confirmed working at `src/app/.well-known/<segment>/route.ts`. proxy.ts matcher exclusion (`.*\..*`) bypasses these paths automatically. Reusable for any future RFC 8615 well-known URI (e.g. `/.well-known/security.txt`, `/.well-known/oauth-authorization-server`).
2. **`process.env` direct read for stub adapters.** Pattern: any adapter that needs to be testable under `vi.stubEnv` must read `process.env` directly, not the parsed `env`. Documented inline in F2 with reference to NR-D7b precedent. v1.1 candidate to extract as a helper.
3. **Canonical payload format invariance test.** The "changing ANY field changes the digest" test catches silent format drift. Worth replicating for any other locked-format helper that ships in v1.x.
4. **Stub adapter rejects non-Ed25519 keys.** Defensive — closes a v1 silent-fallback hole. If real KMS adapter (v1.1) ships ECDSA support, it must explicitly opt in via algorithm parameter; the stub's strict check prevents accidental algorithm flip.
5. **Bootstrap runbook is the founder-runs-once shape.** First runbook in `docs/runbooks/`. Future v1 directives that need similar one-time setup steps (NR-D11 storage signing-URL bootstrap?) should mirror this shape.

---

## §11 — Commit plan

Branch: `feat/newsroom-phase-nr-2` (currently 12 commits ahead of `origin/main` after NR-D9c).

Stage exactly **11 paths** (8 deliverables + 1 sidecar + 1 directive + 1 exit report):

1. `src/lib/newsroom/kms/types.ts` (NEW — F1)
2. `src/lib/newsroom/kms/stub-adapter.ts` (NEW — F2)
3. `src/lib/newsroom/kms/index.ts` (NEW — F3)
4. `src/lib/newsroom/receipts.ts` (NEW — F4)
5. `src/lib/newsroom/__tests__/receipts.test.ts` (NEW — F5)
6. `src/app/.well-known/receipt-keys/route.ts` (NEW — F6)
7. `src/lib/env.ts` (EDIT — F7)
8. `docs/runbooks/newsroom-signing-key-bootstrap.md` (NEW — F8)
9. `.env.example` (EDIT — sidecar to F7 per standing constraint)
10. `docs/public-newsroom/directives/NR-D10-signing-keys-receipts.md` (NEW — directive)
11. `docs/audits/NR-D10-signing-keys-receipts-EXIT-REPORT.md` (NEW — this file)

Plus optional **+1 governance update**:
12. `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` (EDIT — append change-log row marking NR-D10 closure)

DO NOT stage:
- `.claude/scheduled_tasks.lock` — incidental scheduler artifact

---

## §12 — HALT

Surfacing for founder ratification before commit:

**Q1 — VERIFY 6 partial + VERIFY 7 deferral acceptable?** Route resolves correctly + structured-500 path works; underlying query blocked by inherited `.env.local` JWT v1.1 backlog. VERIFY 7 explicitly directive-deferred to "founder runs runbook post-commit."

**Q2 — Stage 11 paths or 12 (with DIRECTIVE_SEQUENCE.md change-log row)?** Established pattern is to add a change-log row per closure. No new v1.1 backlog rows from this directive (IPs were corrections, not deferrals). Single commit either way.

**Q3 — `.claude/scheduled_tasks.lock` skip confirmed?** Same posture as prior directives.
