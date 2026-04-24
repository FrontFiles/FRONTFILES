# Newsroom — Directive Sequence

**Status:** v1 · **Date:** 2026-04-24 · **Owner:** João Nuno Martins
**Reads from:** `docs/public-newsroom/PRD.md`, `docs/public-newsroom/BUILD_CHARTER.md`, `docs/public-newsroom/LEGAL-BRIEF.md`, `PLATFORM_BUILD.md`, `CLAUDE_CODE_PROMPT_SEQUENCE.md` (for rules of engagement + notation), `.claude/agents/*.md`

## How to use

This is the sequenced set of directives that build Newsroom v1 into the existing Frontfiles codebase. It extends — it does not replace — `CLAUDE_CODE_PROMPT_SEQUENCE.md`, which governs non-Newsroom work.

Each NR-D{N} directive lives at `docs/public-newsroom/directives/NR-D{N}-{slug}.md`, follows the existing directive format (see `docs/audits/P4_CONCERN_4A_2_B1_DIRECTIVE.md` as the reference template), and governs exactly one Claude Code session.

Rules of engagement are the same as the existing sequence:

1. One directive per Claude Code session. Do not bundle.
2. Run directives in order; earlier work is a hard dependency for later work.
3. Gate each directive's exit before dispatching the next. Exit report returns `approve` / `approve with corrections` / `revise before approval` / `reject`.
4. Every directive cites the PRD by Part + §, the Build Charter, and — where relevant — the Legal Brief.
5. Every directive declares (a) scope sentence, (b) cross-references with file paths and line numbers where possible, (c) authoritative deliverables list, (d) acceptance criteria, (e) explicit out-of-scope list.

Notation (same as existing):

- `@agent-name` → summon the named sub-agent (e.g. `@frontfiles-context`)
- `→ VERIFY:` → commands that prove done
- `→ GATE:` → what must be true before moving to the next directive

## Dependency graph

```
                ┌── Phase NR-1: Foundation ──┐
                │                            │
  NR-D1 ───► NR-D2 ───► NR-D3 ───► NR-D4 ───► NR-G1 ✓
  schema 1   schema 2   subdomain   domain
             + scan +   + routing   libraries
             receipts
                │
                ▼
        ┌── Phase NR-2: Distributor path ──┐
        │                                  │
        NR-D5 ───► NR-D6 ───► NR-D7* ───► NR-D8 ───► NR-D9 ───► NR-D10* ───► NR-G2 ✓
        signup +  Pack       upload +    embargo    rights +   signing +
        verify    editor     scan +                 publish    receipts
                            renditions
                │
                ▼
        ┌── Phase NR-3: Consumer path ──┐
        │                               │
        NR-D11 ───► NR-D12 ───► NR-D13 ───► NR-D14 ───► NR-G3 ✓
        public     preview    dir/org/   journalist
        Pack page             search     account +
                                         subs + history
                │
                ▼
        ┌── Phase NR-4: Claims + analytics + AI opt-out ──┐
        │                                                 │
        NR-D15 ───► NR-D16 ───► NR-D20 ───► NR-G4 ✓
        C1 + C2    P11 +       AI training
                   P12 +       surfaces
                   P14
                │
                ▼
        ┌── Phase NR-5: Admin console + launch hardening ──┐
        │                                                   │
        NR-D17* ───► NR-D18 ───► NR-D19 ───► NR-D21 ───► NR-G5 ✓
        admin       claims +    keys +      launch
        shell +     takedown    audit +     hardening
        queues                  org admin
```

`*` — candidates for Parts A/B/C split at dispatch time.

## Phase NR gates (from Build Charter §5)

| Gate | Exit criteria |
|---|---|
| **NR-G1** | Migrations applied on dev; `bun run build` exit 0; `tsc --noEmit` clean; `src/lib/newsroom/*` importable; subdomain middleware works for `newsroom.frontfiles.com` without breaking `frontfiles.com`. |
| **NR-G2** | A verified company can create, embargo, and publish a Pack in dev with signed receipts. |
| **NR-G3** | A journalist can discover, preview (with token), download, and subscribe; every action emits correct events and receipts. |
| **NR-G4** | Claim intake → admin uphold → tombstone works end-to-end; distributor analytics render; AI-training opt-out surfaces wired. |
| **NR-G5** | Full admin surface MFA-gated; audit log immutable; co-sign enforced; Build Charter §3 exit criteria all pass; Legal signed off (or launch hedge active). |

## Human prerequisites (block NR-D10 and NR-G5)

| ID | What | Why | Blocks |
|---|---|---|---|
| **NR-H1** | KMS tenancy for SigningKey private keys (Google Cloud KMS or equivalent) | Receipt signing private keys never leave KMS | NR-D10 |
| **NR-H2** | Scanner-provider contracts (ClamAV-as-a-service or self-hosted; Google Cloud Vision SafeSearch or AWS Rekognition) | Pack publish gated on scan results | NR-D7 |
| **NR-H3** | Legal sign-off on FF-* terms + policies (see `docs/public-newsroom/LEGAL-BRIEF.md` §4) | Gate NR-G5 or trigger launch hedge | NR-G5 |
| **NR-H4** | Content-standards policy page content (from counsel per Legal Brief §7) | NR-D21 renders it | NR-D21 |
| **NR-H5** | Sanctions/export-control list data source | Verification integrity check at onboarding | NR-D5 (v1 can stub; NR-G5 requires live) |
| **NR-H6** | DNS for `newsroom.frontfiles.com` subdomain pointed to Vercel app; TLS cert issued | Subdomain middleware routing | NR-D3 verification |
| **NR-H7** | Storage bucket/CDN allocation for Newsroom assets (separate namespace from paid-FF) | Asset upload path | NR-D7 |

## Directive list

Each row: slug, phase, one-line scope, entry gate (what must be true to dispatch), exit gate (what the exit report must show), PRD references. Parts split noted where applicable.

### Phase NR-1 — Foundation

**NR-D1 — Schema foundation (core objects + RLS)**
- Phase: NR-1
- Scope: Supabase migration creating `newsroom_profiles`, `newsroom_verification_records`, `newsroom_packs`, `newsroom_assets`, plus all required enums (`newsroom_verification_tier`, `newsroom_pack_status`, `newsroom_pack_visibility`, `newsroom_licence_class`) and RLS policies. Edit `src/lib/db/schema.ts` to add TS row types. No app code beyond type exports.
- Entry gate: Build Charter approved; PRD Part 3 locked.
- Exit gate: migration applies clean on dev (`bun run supabase db reset` green); TS types compile; existing 81 routes still build; no edits to `companies`, `users`, `company_memberships`, or any migration prior to this one.
- PRD refs: Part 3 §3.1 (object roster), §3.2 (field schemas for Organization/VerificationRecord/Pack/Asset), §3.3 (state machine + visibility matrix), §3.4 (invariants).

**NR-D2 — Schema extensions (scanning, renditions, rights, embargo, events, receipts, claims, admin, subscriptions)**
- Phase: NR-1
- Scope: Second migration creating the remaining 16 tables (`newsroom_asset_scan_results`, `newsroom_asset_renditions`, `newsroom_rights_warranties`, `newsroom_corrections`, `newsroom_embargoes`, `newsroom_embargo_recipients`, `newsroom_recipients`, `newsroom_outlets`, `newsroom_distribution_events`, `newsroom_download_receipts`, `newsroom_signing_keys`, `newsroom_claims`, `newsroom_admin_users`, `newsroom_admin_audit_events`, `newsroom_beat_subscriptions`) + enums + RLS.
- Entry gate: NR-D1 exit report approved.
- Exit gate: migration applies clean; TS row types in `src/lib/db/schema.ts` complete; FK integrity with NR-D1 objects verified.
- PRD refs: Part 3 §3.1–§3.2 (all remaining objects).

**NR-D3 — Subdomain routing + middleware**
- Phase: NR-1
- Scope: Next.js middleware at `src/middleware.ts` (or edit existing) that routes `newsroom.frontfiles.com` to a new `src/app/newsroom/` route group. Isolate cookies, analytics bootstrap, and page chrome. Preserve `frontfiles.com` behaviour.
- Entry gate: NR-D2 exit report approved; NR-H6 (DNS) done on the dev environment.
- Exit gate: `newsroom.frontfiles.localhost` renders a placeholder; `localhost` still renders the paid-FF root; E2E smoke shows no cookie/auth bleed.
- PRD refs: Part 4 §9 (URL namespace), Locked Decision #13 (strategic separation).

**NR-D4 — Domain libraries (`src/lib/newsroom/*`)**
- Phase: NR-1
- Scope: Create `src/lib/newsroom/` with: `types.ts` (discriminated unions mirroring schema), `licence-classes.ts` (canonical config — the five classes + flags + blurbs + code/URI; single source of truth for Part 2 §2.1–§2.4), `embed-snippet.ts` (snippet generator), `receipt-terms.ts` (terms summary generator from flags + blurb), `state-machine.ts` (Pack status transition validator), `invariants.ts` (guard functions from Part 3 §3.4).
- Entry gate: NR-D3 exit report approved.
- Exit gate: `bun test` green for all invariant + state-machine unit tests; `tsc --noEmit` clean; `src/lib/newsroom/licence-classes.ts` imports nowhere outside `src/lib/newsroom/` and `src/app/newsroom/`.
- PRD refs: Part 2 (full), Part 3 §3.3–§3.4, Part 6 §6.3 (licence display consistency).

**→ NR-G1**: all four directives exit-report approved. No new-directive dispatch against Phase NR-2 before this gate.

### Phase NR-2 — Distributor path

**NR-D5 — P1 signup + P2 verification dashboard + DNS TXT worker + domain-email worker**
- Phase: NR-2
- Scope: P1 signup flow that creates `companies` row + `newsroom_profiles` extension + `company_memberships` with `admin` role; P2 verification dashboard with DNS TXT challenge issuance + recheck + domain-email OTP; two server workers for auto-checks; watchlist collision check stub (NR-H5 can land later).
- Entry gate: NR-G1 ✓; Resend configured (Phase 3); NR-H5 optional stub OK.
- Exit gate: a company can be created on dev and progress from `unverified` to `verified_source` end-to-end; admin queue entries appear for watchlist collisions; UI copy matches PRD P1/P2 verbatim.
- PRD refs: Part 5 §5.1 (P1, P2, P3), Part 3 §3.2 (Organization, VerificationRecord).

**NR-D6 — P6 Pack editor, Details tab**
- Phase: NR-2
- Scope: `src/app/newsroom/(authenticated)/{org-slug}/manage/packs/new/page.tsx` and supporting components for the Details tab only (title, subtitle, description, credit_line, licence selector with blurb, slug). Implement the licence-class selector consuming `src/lib/newsroom/licence-classes.ts`. Save as `draft`.
- Entry gate: NR-D5 exit-report approved.
- Exit gate: a verified-source admin can create a draft Pack with a selected licence class; blurb renders verbatim; slug is unique within org.
- PRD refs: Part 5 §5.2 P6 (Details tab), Part 2 §2.5 (selector).

**NR-D7 — P7 Asset upload + scanning pipeline + rendition generation (Parts A/B/C)**
- Phase: NR-2
- Scope (Part A): Asset upload component + storage integration + `newsroom_assets` row creation + caption/alt/trademark fields.
- Scope (Part B): Scanning pipeline. Worker calls ClamAV + Google Cloud Vision SafeSearch (or AWS Rekognition); writes `newsroom_asset_scan_results`; Pack publish blocked while any Asset is not `clean`.
- Scope (Part C): Rendition generation for `image` kind — thumbnail 400px, web 1600px, print 3000px, social 1200×630. `video`/`audio` original-only; `document` first-page thumbnail.
- Entry gate: NR-D6 exit; NR-H2 done; NR-H7 storage allocated.
- Exit gate: A admin can upload an image, which is scanned `clean` and has four renditions generated within 60s.
- PRD refs: Part 5 §5.2 P7, Part 3 §3.2 (Asset, AssetScanResult, AssetRendition), Legal Brief §7 (content standards ingestion).

**NR-D8 — P8 Embargo configuration + invite email + EmbargoRecipient token gate**
- Phase: NR-2
- Scope: Embargo toggle + lift_at TZ-aware datetime + policy_text; add/remove recipients UI; invite email via Resend matching PRD copy verbatim; EmbargoRecipient with unguessable access_token; J5 preview URL gated by token (preview page itself comes in NR-D12).
- Entry gate: NR-D7 exit.
- Exit gate: admin can set an embargo, invite 3 recipients, revoke 1; invite email delivered; token URL returns a stub "Preview not yet implemented" page in dev (real preview in NR-D12).
- PRD refs: Part 5 §5.2 P8, Part 3 §3.2 (Embargo, EmbargoRecipient), Locked Decision #8.

**NR-D9 — P9 Rights-warranty gate + P10 publish action + Pack state machine enforcement**
- Phase: NR-2
- Scope: P9 modal with three mandatory checkboxes + narrative; P10 publish action with the pre-publish checklist as spec'd in Part 5 §5.2 P10; `draft → scheduled/published` transition with all seven preconditions enforced; scheduler worker for auto-lift; `published` confirmation modal copy verbatim.
- Entry gate: NR-D8 exit.
- Exit gate: a Pack can transition through the full state machine (draft → scheduled → published or draft → published) and cannot transition with any precondition unmet. Canonical URL stable.
- PRD refs: Part 5 §5.2 P9 + P10, Part 3 §3.3–§3.4.

**NR-D10 — SigningKey infra + DownloadReceipt emitter + P4 signed receipt view (Parts A/B)**
- Phase: NR-2
- Scope (Part A): `newsroom_signing_keys` management, KMS-backed private key, public keyset endpoint at `frontfiles.com/.well-known/receipt-keys`, key bootstrapping (one `active` key at dev).
- Scope (Part B): Receipt emitter (generate receipt body from DistributionEvent + Pack snapshot + flags, sign with Ed25519, persist); P4 receipt view at `frontfiles.com/receipts/{id}` including "Download receipt JSON" + verification instructions.
- Entry gate: NR-D9 exit; NR-H1 done (KMS tenancy).
- Exit gate: every download (from P11 admin-preview or direct) emits exactly one `newsroom_distribution_events` row and one `newsroom_download_receipts` row; signature verifies against the public keyset.
- PRD refs: Part 5 §5.1 P4, Part 3 §3.2 (SigningKey, DownloadReceipt), Locked Decision #9.

**→ NR-G2**: end-to-end distributor flow works in dev.

### Phase NR-3 — Consumer path

**NR-D11 — J4 public Pack page (render, download CTA, download receipt emission, embed panel)**
- Phase: NR-3
- Scope: Public Pack page at `newsroom.frontfiles.com/{org-slug}/{pack-slug}`; licence block rendering exact blurb; credit_line display with copy button; trademark + AI-training notices; "Download pack (zip)" as primary CTA; per-asset download; first-session download confirmation; embed panel generating snippet from `src/lib/newsroom/embed-snippet.ts`; zip generation on-demand.
- Entry gate: NR-G2 ✓.
- Exit gate: a published Pack with two assets can be downloaded as zip and per-asset, each emitting correct events + receipts; embed snippet copies to clipboard and includes TDM meta tags when applicable.
- PRD refs: Part 5 §5.3 J4, Part 2 (full).

**NR-D12 — J5 pre-lift preview page (token gate, countdown, signed URLs, access logging)**
- Phase: NR-3
- Scope: Preview page gated by `access_token`; persistent embargo banner; policy text prominent; identity strip; downloads via short-lived signed URLs (15-min TTL); every load increments EmbargoRecipient access log and emits `preview_access` event; auto-reload/redirect to J4 on lift.
- Entry gate: NR-D11 exit.
- Exit gate: an invited recipient can preview an embargoed Pack; access is logged per-recipient; lift auto-reloads to the J4 page.
- PRD refs: Part 5 §5.3 J5.

**NR-D13 — J2 directory + J3 org page + J6 cross-newsroom search**
- Phase: NR-3
- Scope: Root of `newsroom.frontfiles.com` (J2); per-org page `/{org-slug}` (J3) with subscribe CTA; search at `/search?q=` (J6) with filters and inclusion rules per Part 5 §5.3. Feed shapes match PRD.
- Entry gate: NR-D12 exit.
- Exit gate: a journalist can land at the root, browse Orgs, view a Pack, search "Nike" and find Nike's packs.
- PRD refs: Part 5 §5.3 J2, J3, J6.

**NR-D14 — J1 journalist account + J7 subscriptions + J8 export history + P13 claim response surface**
- Phase: NR-3
- Scope: J1 signup/sign-in (minimal — email + password reusing existing `users` mechanism; new `newsroom_recipients` extension row); J7 BeatSubscription management (newsroom-only v1); J8 export history; P13 surface on the distributor side (reads from `newsroom_claims`).
- Entry gate: NR-D13 exit.
- Exit gate: a signed-in journalist can subscribe to an Org, view their download history, retrieve their receipts; distributor sees a placeholder empty claim list.
- PRD refs: Part 5 §5.3 J1/J7/J8 + §5.2 P13.

**→ NR-G3**: consumer path works in dev.

### Phase NR-4 — Claims, analytics, AI-training surfaces

**NR-D15 — C1 public claim intake + C2 tombstone**
- Phase: NR-4
- Scope: C1 form with all fields per Part 5 §5.4, including DMCA 512(c)(3) sworn statement; reporter email verification flow; creates `newsroom_claims` row in `submitted`; C2 tombstone page rendering at any Pack URL when `status=takedown`; `noindex` + sitemap exclusion; 410 Gone on all rendition URLs after takedown; embed snippet fallback `<figcaption>` continues to render with credit.
- Entry gate: NR-G3 ✓.
- Exit gate: anyone can submit a claim; tombstone replaces the Pack page when status is flipped manually via SQL (admin UI lands in NR-D18).
- PRD refs: Part 5 §5.4 C1 + C2, Legal Brief §4.4.

**NR-D16 — P11 distributor Pack view + P12 corrections + P14 analytics (Org + per-Pack drill-down)**
- Phase: NR-4
- Scope: P11 post-draft Pack view for distributors; P12 correction authoring modal; P14 analytics dashboard with filters, KPI tiles, charts, per-Pack drill-down with embargo window timeline and recipient access log; CSV export.
- Entry gate: NR-D15 exit.
- Exit gate: distributor sees analytics for a Pack with real DistributionEvent data; can issue a correction that appears on J4 and in the embed snippet.
- PRD refs: Part 5 §5.2 P11, P12, P14.

**NR-D20 — AI training opt-out user-facing surfaces**
- Phase: NR-4
- Scope: `/.well-known/tdmrep.json` generator at each `newsroom.frontfiles.com/{org-slug}` subdomain (or central with org routing); `/ai.txt` generator; XMP/IPTC sidecar inclusion in zip exports; embed `<meta>` tags wired in NR-D11 — this directive only adds the org-level surfaces; C2PA opt-in scaffolding (opt-in UI on Pack editor; assertion written when enabled).
- Entry gate: NR-D16 exit.
- Exit gate: all six surfaces from Part 2 §2.7 present and returning correct payloads for sampled Packs.
- PRD refs: Part 2 §2.7, Part 4 §10, Legal Brief §6.

**→ NR-G4**: claims end-to-end (once NR-D18 lands, back-filled), analytics, AI opt-out surfaces live.

### Phase NR-5 — Admin console + launch hardening

**NR-D17 — A1 admin shell + A2 verification queue + A3 scan queue (Parts A/B/C)**
- Phase: NR-5
- Scope (Part A): A1 shell at `admin.frontfiles.com` subdomain or `/admin/newsroom` sub-route (decision at dispatch); TOTP MFA; role-based access (4 roles); session timeouts; reason-capture modal pattern; left nav.
- Scope (Part B): A2 verification review queue with approve/deny/request-info; watchlist-collision co-sign.
- Scope (Part C): A3 scan-flag review queue with uphold/override/delete; CSAM hard boundary (auto-escalate, no in-browser reveal).
- Entry gate: NR-G4 ✓.
- Exit gate: an admin can sign in with TOTP, see the three queues, approve a verification, override a scan flag (with reason and audit event).
- PRD refs: Part 5 §5.5 A1–A3.

**NR-D18 — A4 claims queue + A5 claim detail + A6 takedown shared flow**
- Phase: NR-5
- Scope: A4 list; A5 detail with internal notes; A6 shared takedown modal invoked from A5 + A3 + A9; controlled reason-category list matching C2 tombstone variants; two-person co-sign for `verified_publisher` orgs and for Packs with > 1000 downloads; reversal flow (security-role co-signed).
- Entry gate: NR-D17 exit.
- Exit gate: an upheld claim triggers the takedown flow, which flips the Pack to `takedown`, renders C2, and writes an `admin_audit_events` row with both admin IDs.
- PRD refs: Part 5 §5.5 A4, A5, A6.

**NR-D19 — A7 signing-key management + A8 audit log viewer + A9 organisation administration**
- Phase: NR-5
- Scope: A7 key rotation / revocation with security-role co-sign; keyset endpoint health check; A8 audit log viewer with filters, expand-row diff, CSV/NDJSON export (redacted for viewer role, full for security); A9 org administration with tier changes, suspend/unsuspend, revoke verification, org takedown cascade, slug change with redirect.
- Entry gate: NR-D18 exit.
- Exit gate: security admin can rotate a SigningKey with co-sign (no outage in receipt verification for prior keys); viewer admin can filter and export the audit log (redacted); operator can suspend an org (blocks new Pack creation; existing Packs live; preview tokens frozen).
- PRD refs: Part 5 §5.5 A7, A8, A9.

**NR-D21 — Launch hardening**
- Phase: NR-5
- Scope: content-standards policy page wiring at `frontfiles.com/policies/content-standards` (content from NR-H4); FF-* terms page stubs at the URIs with counsel-signed copy dropped in (content from NR-H3); verification policy page; AI training rights-reservation page wired; sanctions-list live check at org onboarding (NR-H5 live); `bun run build` + `tsc --noEmit` + vitest full sweep; delta audit against `PLATFORM_BUILD.md` confirming no regression in 22 pre-existing routes or 12 locked state machines; Sentry wiring for admin mutations (Phase 2 dependency verified).
- Entry gate: NR-D19 exit; NR-H3 + NR-H4 + NR-H5 all green.
- Exit gate: Build Charter §3 exit criteria all 10 pass; sign-off from founder on NR-G5.
- PRD refs: Part 7 (release plan), Legal Brief (full).

**→ NR-G5**: Newsroom v1 ship.

## Bundling notes

- **Parts-split candidates**: NR-D7 (A/B/C), NR-D10 (A/B), NR-D17 (A/B/C). Split decision made at dispatch time based on estimated session size; smaller parts when unsure.
- **Atomic directives**: all others are intended as single Claude Code sessions. If any exceeds session capacity in practice, split at natural seam and document the split in the exit report.

## v1.1 tightening backlog (non-blocking)

Surfaced during NR-D* execution. Tracked here; addressed after NR-G5.

| Item | Source | Scope |
|---|---|---|
| `REVOKE EXECUTE ... FROM PUBLIC` on `is_newsroom_admin` and `is_newsroom_editor_or_admin` | NR-D1 exit report §4 (VERIFY 8) | Postgres's default grants EXECUTE to PUBLIC. Functional behaviour is safe (anon `auth.uid()` returns NULL, EXISTS returns false) but security-in-depth prefers explicit REVOKE. One-line migration. |

## Change log for this sequence

| Date | Change | Reason |
|---|---|---|
| 2026-04-24 | v1 drafted | Initial sequence against PRD v1 |
| 2026-04-24 | NR-D1 cleared (approve) | Exit report clean across 7 sections; `idx_newsroom_vr_active` divergence approved and reflected back into directive file; v1.1 backlog opened |
| 2026-04-24 | NR-D2a cleared (approve) | Exit report clean across 7 sections; no divergence; 8 newsroom_* tables now live in dev; 3 named CHECKs + DO-block VERIFY 8 + tightened `newsroom_corrections_select_public` from the pre-dispatch redline pass all landed as authored |
| 2026-04-24 | NR-D2b cleared (approve) | Exit report clean across 7 sections; no divergence; 12 newsroom_* tables now live in dev; route-count baseline corrected to 91 (was stale "96" in directive); stale `.next/types/validator.ts` cache noted as pre-existing Next 16 artefact (`rm -rf .next` fix pattern); embargo_id FK validated; state-coherence CHECK fires as designed |
| 2026-04-24 | NR-D2c-i cleared (approve) | Exit report clean across 7 sections; no divergence; 15 newsroom_* tables now live in dev; provenance stack (signing keys, distribution events, download receipts) landed; at-most-one-active signing key invariant enforced via partial unique index; route-count baseline further corrected 91 → 90 (rebase-onto-main delta, no newsroom route changes); both partial-index predicates enum-constant (no SQLSTATE 42P17 risk) |
| 2026-04-24 | NR-D2c-ii cleared (approve) | Exit report clean across 7 sections; no divergence; 19 newsroom_* tables now live in dev; governance substrate (claims, admin users, admin audit events, beat subscriptions) landed; MFA-required CHECK + status-resolution coherence CHECK both fire as designed; 6 policies (1+1+1+3) match spec; admin_audit_events append-only (no updated_at, no UPDATE policy) — **Phase NR-1 schema subphase closed.** Full substrate: 19 tables, 23 enums, 2 helper functions, 21 RLS policies across 5 migrations (20260425000001 through 20260425000005) |

---

**End of directive sequence.**
