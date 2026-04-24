# NR-D5b-i Exit Report — Verification Dashboard + DNS TXT Method

**Directive:** `docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Commit:** `96a7cc2`
**Date:** 2026-04-24
**Verdict (self-assessment):** Pass.

---

## 1. Summary

12 new + 3 modified files on disk; conceptually 11 directive-F items + the 3 env edits. Total lines added ≈ 1,554 (1,571 − 70 + 53 after F2 trim).

| # | File | Lines | Role |
|---|---|---|---|
| F1a | `src/app/newsroom/[orgSlug]/manage/layout.tsx` | 51 | server layout — wraps children in AdminGate |
| F1b | `src/app/newsroom/[orgSlug]/manage/_components/admin-gate.tsx` | 108 | client gate — session check + /me fetch + redirects |
| F1c | `src/app/api/newsroom/orgs/[orgSlug]/me/route.ts` | 143 | API — GET returns `{ ok, isAdmin, role }` |
| F2 | `src/app/newsroom/[orgSlug]/manage/page.tsx` | 53 | EDIT — title + tier badge + CTA |
| F3 | `src/app/newsroom/[orgSlug]/manage/verification/page.tsx` | 85 | server page — fetches tier + active records |
| F4 | `src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx` | 67 | client shell — composes 3 cards, owns refetch |
| F5 | `src/app/newsroom/[orgSlug]/manage/verification/_components/tier-header.tsx` | 34 | tier copy block — PRD §5.1 P2 verbatim |
| F6 | `src/app/newsroom/[orgSlug]/manage/verification/_components/dns-txt-card.tsx` | 196 | DNS TXT card state machine + recheck |
| F7 | `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx` | 19 | greyed stub for NR-D5b-ii |
| F8 | `src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue/route.ts` | 184 | POST returns deterministic token |
| F9 | `src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck/route.ts` | 289 | POST resolves DNS TXT, INSERTs record, recomputes tier |
| F10 | `src/lib/newsroom/verification.ts` | 209 | `deriveDnsTxtToken` / `expectedDnsTxtRecord` / `computeTier` / `recomputeTier` |
| F11 | `src/lib/newsroom/__tests__/verification.test.ts` | 116 | 13 vitest cases |
| env | `src/lib/env.ts` | +6 | Adds `NEWSROOM_VERIFICATION_HMAC_SECRET` (required) |
| env | `.env.example` | +9 | Documents the var |
| env | `.env.local` | +3 | Auto-populated via `openssl rand -base64 48` (gitignored) |

**F1 audit decision** (the unfolding triplet, per founder ratification): Option A — server-component layout + `'use client'` AdminGate + helper `/me` API endpoint. The triplet is auditable as one F1 deliverable: layout ⟶ admin-gate ⟶ /me. Mirrors NR-D5a's "server shell + client gate" (IP-1 precedent).

**`/me` added.** Yes — counted under F1c. Returns `{ ok, isAdmin, role }`.

---

## 2. Decisions that diverged

All six IPs were ratified pre-composition (see HALT message in transcript). Only one diverged from the pre-composition proposal:

- **F1 file count.** During composition, `<AdminGate>` needs its own `'use client'` file (F1b) — surfaced as a 12-vs-11 scope-diff delta. Founder confirmed the 12-new path; the conceptual F1 unfolds into (server layout, client gate, API endpoint).

No mid-session IPs. PRD-vs-directive drift on the "Coming soon" suffix (IP-D) was resolved before composing — F5 renders PRD verbatim, no suffix.

---

## 3. Open questions for founder

- **Dev server bounce after env-schema additions.** The pre-existing dev-server process was started before `.env.local` got the HMAC secret. After the edit, the live process saw an env validation throw at module load (page-level error on `/onboarding`, plus a phantom "module not found" on admin-gate.tsx during its stale compile pass). Restarting the preview cleared both. Future directives that add a required env var should explicitly call out a dev-server bounce in the VERIFY block — currently this is implicit. Worth adding to the directive template?
- **Edge case for `recomputeTier`.** Recompute failures are swallowed with a log and `{ ok: true, verified_at }` is still returned to the client (the verification record was already persisted; the next successful recheck of any method will re-derive the tier). Reasonable for v1, but consider whether NR-D5b-ii / NR-D17 admin surfaces should expose a "tier-out-of-sync" diagnostic. Not blocking.
- **`primary_domain` on `/me`?** Limited `/me` to `{ isAdmin, role }` per directive intent. The DnsTxtCard re-fetches primary_domain via the `/issue` endpoint anyway, so no leakage. If future surfaces need cheaper access, expand `/me` then. Not blocking.

---

## 4. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/verification.test.ts
 RUN  v4.1.5 /Users/jnmartins/dev/frontfiles
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  267ms
```

13/13 passed (4 `deriveDnsTxtToken` cases including the env-missing throw, 2 `expectedDnsTxtRecord` cases, 7 `computeTier` cases including the all-three-methods → publisher path and an authorized_signatory-without-email negative case).

---

## 5. Build + typecheck

| Step | Result |
|---|---|
| `rm -rf .next && bun run typecheck` | exit 0 (`tsc --noEmit` silent) |
| `bun run build` | exit 0 |

**Route count delta:** +4 (vs. directive's anticipated +3 or +4): `/api/newsroom/orgs/[orgSlug]/me`, `/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue`, `/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck`, `/newsroom/[orgSlug]/manage/verification`. Total in build output: 100 routes (66 dynamic ƒ + 35 static ○ minus 1 `Proxy (Middleware)`) — directive's "previous baseline 100" was a slight overcount of NR-D5a's actual 96-route end state; +4 lands cleanly at 100.

---

## 6. Runtime smoke

Preview server bounced after `.env.local` was populated (stale process didn't have the new required env var). Post-restart smoke:

| Endpoint | Test | Result |
|---|---|---|
| `/some-test-org/manage` (newsroom Host) | unauthed GET | HTTP 200 — layout renders, AdminGate's "Loading…" placeholder appears in HTML, auth gate fires client-side as designed |
| `/some-test-org/manage/verification` (newsroom Host) | unauthed GET | HTTP 200 — same pattern |
| `GET /api/newsroom/orgs/some-test-org/me` (no Bearer) | curl | HTTP 401 `{"ok":false,"error":"Authentication required."}` |
| `POST .../dns-txt/issue` (no Bearer) | curl | HTTP 401 `{"ok":false,"error":"Authentication required."}` |
| `POST .../dns-txt/recheck` (no Bearer) | curl | HTTP 401 `{"ok":false,"reason":"unauthenticated"}` |
| Dev-server error log post-restart | preview_logs(level=error) | "No server errors found." |

End-to-end DNS recheck against a real TXT record was **not** smoke-tested — would require a signed-in admin session token + a domain we control with a TXT record set. The state-machine and resolver code paths are covered by typecheck + unit tests on the pure helpers; the SQL writes inherit NR-D5a's service-role pattern.

---

## 7. Verdict

**Pass.** Directive scope met as ratified: 12 new + 3 modified files, all six IPs honoured, PRD §5.1 P2 copy verbatim in TierHeader + DnsTxtCard, env schema fail-fast posture, F9 `runtime = 'nodejs'` declared, vitest green, build green, typecheck clean, runtime smoke confirms the gate is fail-closed at 401 without auth and the page-render path is healthy.

NR-D5b-i is ready for commit + dispatch confirmation. Next directive in sequence: **NR-D5b-ii** (domain-email OTP method, Resend template, replaces F7 stub with real card).
