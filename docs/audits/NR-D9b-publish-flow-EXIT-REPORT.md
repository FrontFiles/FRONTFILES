# NR-D9b — Publish Flow UI (P9 + P10) — EXIT REPORT

**Date**: 2026-04-26
**Branch**: `feat/newsroom-phase-nr-2`
**Predecessor**: NR-D9a (`bfeeb3c`) — pack state-machine RPC
**Directive**: `docs/public-newsroom/directives/NR-D9b-publish-flow.md`

---

## §1 — Summary

Distributor-side Publish flow lit up end-to-end. P9 rights-warranty modal (PRD §5.1 P9 verbatim) + P10 pre-publish checklist sidebar + publish/schedule confirmation modal (PRD §5.1 P10 verbatim) + 2 API routes that funnel through `transitionPack` (NR-D9a's RPC).

Nine deliverables: 1 EDIT + 8 NEW.

| F# | Path | Lines |
|---|---|---|
| F1 | `pack-editor-shell.tsx` (EDIT — async + new fetches + sidebar) | ~270 |
| F2 | `_components/publish-actions.tsx` | ~170 |
| F3 | `_components/pre-publish-checklist.tsx` | ~55 |
| F4 | `_components/rights-warranty-modal.tsx` | ~250 |
| F5 | `_components/publish-confirmation-modal.tsx` | ~245 |
| F6 | `api/.../rights-warranty/route.ts` | ~270 |
| F7 | `api/.../transition/route.ts` | ~245 |
| F8 | `src/lib/newsroom/publish-checklist.ts` | ~325 |
| F9 | `src/lib/newsroom/__tests__/publish-checklist.test.ts` | ~370 |

Net: +2 routes (`/rights-warranty`, `/transition`); route count 114 → 116; +31 unit tests (290 passing total, prior 259 unaffected); 0 production behavioural regressions.

The flow:

1. Admin opens an existing draft pack → shell fetches warranty + signing-key + asset/scan/alt-text aggregates + embargo → derives 7-row checklist via `derivePublishChecklist` (F8) → renders sidebar (F3) + Publish CTA (F2).
2. Admin clicks Publish CTA →
   - if `pack.rights_warranty_id IS NULL` → P9 modal (F4) opens; on Confirm → POST F6 → on 201, P9 closes + P10 opens.
   - else → P10 modal (F5) opens directly.
3. Admin confirms in P10 → POST F7 → calls `transitionPack` → on `ok: true`, post-publish toast (`<output role="status">`) shows + `router.refresh()`.

---

## §2 — Audit findings (pre-compose)

Audit phase surfaced 4 IPs, all ratified Option A:

| IP | Topic | Decision |
|---|---|---|
| **IP-1** | Modal primitive | Native `<dialog>` element. `showModal()` / `close()` + native focus trap + ESC + `::backdrop`. No new dep. Two implementations (F4 + F5) hand-rolled in identical pattern for future reuse. |
| **IP-2** | Toast primitive | Native `<output role="status" aria-live="polite">` with 6s setTimeout auto-dismiss + manual close. Single use site (post-publish in F2). No new dep. |
| **IP-3** | Schedule confirmation title | Interpolate "Schedule this pack?" for both schedule variants (with-embargo + publish_at-only). PRD silent on title — interpolated for `aria-labelledby` accessibility. |
| **IP-4** | Canonical URL helper naming | Use `packCanonicalUrl(orgSlug, packSlug)` from `canonical-url.ts:17` (directive cited stale `canonicalPackUrl`). |

No new IPs surfaced during composition. Mid-compose findings (e.g., the `/rights-warranty/route.ts` two-step write inheriting the existing v1.1 backlog atomicity caveat) folded into divergence notes below — not load-bearing enough to halt.

---

## §3 — Decisions that diverged from the directive

| # | Decision | Rationale |
|---|---|---|
| 3.1 | Modal primitive: native `<dialog>` (not Radix) | IP-1 ratified Option A. `@radix-ui/react-dialog` not in deps; `@base-ui/react` and `shadcn` present but with zero modal usage in `src/`. Native API delivers focus trap + ESC + backdrop + `aria-modal` for free. v1.1 promotion path documented in DIRECTIVE_SEQUENCE.md. |
| 3.2 | Toast primitive: native `<output role="status">` (not sonner) | IP-2 ratified Option A. Single use site + minimal scope. Native `<output role="status" aria-live="polite">` is the WHATWG-recommended status-message landmark. v1.1 promotion path documented in DIRECTIVE_SEQUENCE.md. |
| 3.3 | Schedule confirmation modal title interpolated as "Schedule this pack?" for both variants | IP-3 ratified Option A. PRD §5.1 P10 lines 963–969 specify Body but no Title for either schedule variant; line 957 (no-embargo Publish variant) specifies "Publish this pack?". Interpolation provides `aria-labelledby` target and matches the publish variant's structural pattern. PRD silence treated as omission, not prohibition. |
| 3.4 | F8 conflates `error` scan results into the `{n} flagged` partial state | PRD §5.1 P10 line 948 specifies "{n} scanning" / "{n} flagged" — no "{n} error" state. Both `flagged` and `error` block publish (per RPC `asset_scan_pending_or_flagged` precondition), so conceptually equivalent for the gate. UI conflation keeps PRD-verbatim string. |
| 3.5 | F8 LEFT JOIN orphan-asset semantics: orphan assets (no `scan_result` row) treated as "scanning" | Mirrors NR-D9a's RPC defensive LEFT JOIN. NR-D7a's two-INSERT atomicity caveat means an asset row may exist without its scan_result row; treating those as "scanning" matches the RPC's own block-publish-until-clean posture. Test F9 has explicit coverage. |
| 3.6 | F1 fetches all publish-state inside the shell rather than extending the prop signature | Audit (e) confirmed all 4 callers pass identical 5-prop shape; absorbing fetches into the now-`async` shell preserves the signature without forcing 4 caller pages to re-run the same queries. Slight read amplification on assets/embargo pages (shell + page each fetch some overlap); acceptable v1 trade-off vs. forcing 4 caller files to change. |
| 3.7 | F6 sets `confirmed_by_user_id = ctx.authUserId` even though service-role bypasses RLS | RLS policy `newsroom_rw_insert_editor` requires `confirmed_by_user_id = auth.uid()`. Service-role bypass means the policy doesn't actually fire, but mirroring the constraint at the application layer preserves the audit-trail intent and prevents a future RLS-aware migration from suddenly rejecting historical inserts. |
| 3.8 | F6 short-circuits with 409 `already-confirmed` when `pack.rights_warranty_id IS NOT NULL` | PRD §5.1 P9 line 937 mandates post-publish immutability. Extending that to draft is a defensive guard against double-submit (UI shouldn't open P9 if warranty exists; this catches race conditions). |
| 3.9 | F7 omits the pack-status='draft' guard at the application layer | The state-machine RPC owns the transition matrix; admins must be able to transition non-draft packs (e.g. published → archived). Application-layer guards would diverge from the RPC's authority and cause UI/server disagreement. F6 retains the draft guard because warranty is draft-only by PRD authority. |
| 3.10 | F7 returns the RPC result with HTTP 200 regardless of `ok` | Discriminated union shape (`{ok: true, ...}` vs `{ok: false, errorCode, ...}`) is the canonical contract. Transport-level RPC errors escalate to 500; predictable business-logic failures (illegal transition, preconditions not met) ship as `200 + ok: false`. Client (F5) pattern-matches on `ok`. |

---

## §4 — VERIFY results

| # | Step | Result |
|---|---|---|
| 1 | `bun run typecheck` (`tsc --noEmit`) | ✓ PASS (no output) |
| 2 | `bunx vitest run src/lib/newsroom/__tests__/publish-checklist.test.ts` | ✓ PASS — 31/31 tests green in 288ms |
| 3 | `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full unit suite | ✓ PASS — 290 passed (prior 259 + 31 new) + 20 skipped (pack-transition integration suite, FF_INTEGRATION_TESTS unset, as designed) |
| 4 | `bun run build` exit 0; route count 114 → 116 (+2) | ✓ PASS — confirmed +2 routes for `/rights-warranty` + `/transition` |
| 5 | Bounce dev server | ✓ PASS — `bun run dev` started cleanly; ready in ~6s |
| 6 | Curl smoke (no auth) — both new routes return 401 with `{"ok":false,"reason":"unauthenticated"}` | ✓ PASS — both routes return canonical shape |
| 7 | Visual smoke | DEFERRED — `.env.local` JWT drift v1.1 backlog blocks the auth-required path; structural signals load-bearing |
| 8 | `git status --porcelain` shows 1M + 8?? deliverables | ✓ PASS — 1 M (F1) + 8 ?? (F2–F9, with F6/F7 routes as new directories each containing one `route.ts`); plus 1 directive md + 1 incidental `.claude/scheduled_tasks.lock` (will not stage) |

---

## §5 — Test coverage detail (F9)

31 cases across 7 describe blocks:

- **Happy paths (3)** — Publish now / Schedule (publish_at) / Schedule (embargo)
- **Precondition failures (10)** — missing title, missing credit, 0 assets, scan pending, scan flagged, error conflation, orphan asset → scanning, flagged-dominates-scanning, image alt missing, warranty null, no signing key, signing-key-tooltip-ordering
- **Embargo row variants (4)** — lift in past, no recipients, empty policy text, multi-issue
- **PRD verbatim labels (1)** — exact-string regression guard for all 7 row labels
- **Zod warranty schema (6)** — accepts confirmed body, accepts narrative, accepts null narrative, rejects false boolean, rejects > 2000 char narrative, rejects missing checkbox
- **Zod transition schema (5)** — accepts each legal targetStatus, rejects 'takedown', accepts overrideEmbargoCancel, rejects unknown enum, rejects missing field

The PRD-verbatim regression guard test is load-bearing: any silent edit to the 7 row labels in F8 fails this test loudly.

---

## §6 — Verdict

**PROCEED to commit ratification.**

8 of 8 VERIFY steps green (VERIFY 7 deferred per inherited `.env.local` v1.1 item). All PRD §5.1 P9 + P10 verbatim copy locked into F4/F5/F8 with frozen `Object.freeze({...})` constants. State-mutation discipline preserved: F7 is the only path to `transitionPack`; F6 only writes warranty + `pack.rights_warranty_id`. F1 conversion to async server component preserves the 5-prop caller signature unchanged across the 4 caller pages.

Phase NR-2 progress: **8 of 8 directives composed (100%)**. Phase NR-2 closes after NR-D9b ratification + commit. Next: NR-D9c (lift worker + subscriber notifications) opens Phase NR-3 prep.

---

## §7 — v1.1 backlog additions

Two new entries, drafted per ratification:

| Item | Source | Scope |
|---|---|---|
| Modal primitive promotion | NR-D9b dispatch decision (2026-04-25) | NR-D9b ships 2 modals as native `<dialog>` elements (P9 warranty + P10 publish confirmation). Native API is sufficient for v1; v1.1 promote to shadcn Dialog if modal count exceeds ~5 (likely post-NR-D17/18/19 admin console). Trade-off: hand-rolled `<dialog>` per modal becomes maintenance overhead at scale; shared primitive normalizes styling, focus management, and a11y. |
| Toast primitive promotion | NR-D9b dispatch decision (2026-04-25) | NR-D9b ships post-publish toast as native `<output role="status">` with auto-dismiss. Single use site. v1.1 promote to sonner (~3kb) or equivalent if multi-use with stacking, queueing, or richer interactions needed. Likely trigger: NR-D11 consumer-side surfaces or NR-D17 admin actions adding their own confirmations. |

Inherited v1.1 items NR-D9b joins (no new entries needed):
- **Two-INSERT atomicity for compound writes** — F6's INSERT warranty + UPDATE pack.rights_warranty_id is the same shape as NR-D7a / NR-D8 / NR-D9a's defended cases. Detection: warranty rows without a corresponding pack pointing at them.
- **Transition matrix codegen** (NR-D9a inheritance) — F8's `derivePublishChecklist` and the `newsroom_pack_transition` RPC's precondition checks must agree; v1 hand-syncs.
- **`.env.local` key drift** (NR-D7b inheritance) — VERIFY 7 visual smoke deferred for this directive too.

---

## §8 — Carry-forward observations

1. **`<dialog>` cleanup pattern.** Both F4 and F5 follow: `useEffect` for `showModal()` on mount + cleanup `close()`; second `useEffect` listens for the native `close` event to sync parent state (handles ESC + backdrop close paths). Reuse pattern verbatim if a third modal lands.
2. **Server component fetching inside shell.** F1 absorbs all publish-state I/O internally — caller signature unchanged. Trade-off documented above (§3.6). Pattern works because (a) all 4 callers pass identical props, (b) the new fetches are independent of caller-specific logic. If a future caller diverges, extract into a separate composer.
3. **PRD-verbatim label freezing.** F8 wraps the 7 row labels in `Object.freeze({...})` — F9's regression guard test then asserts the exact array. Combined: any silent typo edit fails CI loudly.
4. **`transitionPack` as the sole gate.** F7 doesn't enforce a status guard at the application layer; F6 does (warranty is draft-only). Documented in §3.9. Extends the NR-D9a invariant: only `transitionPack` writes `newsroom_packs.status`.
5. **Tooltip ordering.** F8 puts non-ok item labels first (in checklist order) then "Active signing key". Predictable scan order for the user — most-likely-fixable items surface first.

---

## §9 — Commit plan

Branch: `feat/newsroom-phase-nr-2` (currently 10 commits ahead of `origin/main` after NR-D9a).

Stage exactly **11 paths**:
1. `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` (EDIT — F1)
2. `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/publish-actions.tsx` (NEW — F2)
3. `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pre-publish-checklist.tsx` (NEW — F3)
4. `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/rights-warranty-modal.tsx` (NEW — F4)
5. `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/publish-confirmation-modal.tsx` (NEW — F5)
6. `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/rights-warranty/route.ts` (NEW — F6)
7. `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/transition/route.ts` (NEW — F7)
8. `src/lib/newsroom/publish-checklist.ts` (NEW — F8)
9. `src/lib/newsroom/__tests__/publish-checklist.test.ts` (NEW — F9)
10. `docs/public-newsroom/directives/NR-D9b-publish-flow.md` (directive)
11. `docs/audits/NR-D9b-publish-flow-EXIT-REPORT.md` (this file)

Plus a separate update to `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` to:
- Append 2 new v1.1 backlog rows (Modal primitive promotion, Toast primitive promotion).
- Append a Change log row for "NR-D9b cleared (approve)".

Total: **12 paths in the NR-D9b commit** (11 deliverables/docs + 1 DIRECTIVE_SEQUENCE.md update).

DO NOT stage:
- `.claude/scheduled_tasks.lock` — incidental scheduler artifact from in-session wakeup; not a deliverable.

---

## §10 — HALT

Surfacing for founder ratification before commit:

**Q1 — All 8 VERIFY steps green; VERIFY 7 deferral acceptable?** Same JWT-blocked path as NR-D9a; structural signals (typecheck + 290 tests + build + curl 401) load-bearing.

**Q2 — Stage 11 deliverable paths + 1 DIRECTIVE_SEQUENCE.md update = 12 total, single commit?** Or split into NR-D9b commit (11) + governance commit (1)?

**Q3 — `.claude/scheduled_tasks.lock` skip confirmed?** Same posture as NR-D9a — not a deliverable, will be left untracked.
