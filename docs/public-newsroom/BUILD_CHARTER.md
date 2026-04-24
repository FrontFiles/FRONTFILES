# Newsroom — Build Charter (v1)

**Status:** Locked — 2026-04-24
**Owner:** João Nuno Martins
**Canonical Spec:** `docs/public-newsroom/PRD.md`
**Legal handoff:** `docs/public-newsroom/LEGAL-BRIEF.md`
**Authority level:** Canonical Spec (peer to `docs/specs/ECONOMIC_FLOW_v1.md`)
**Revision gate:** Changes to Part 2 (licence classes), Part 3 (object model), or Part 7 (release plan) of the PRD require founder sign-off before implementation begins.

---

## 1. Scope sentence

Public press/newsroom distribution is a new subsystem on Frontfiles rails — shipping at `newsroom.frontfiles.com/{org-slug}/{pack-slug}` — that lets verified organisations publish authorised press material to working journalists under five enumerated licence classes with embargoes, signed download receipts, and first-class claims/takedown.

## 2. Positioning inside Frontfiles

- **Same rails.** Single Next.js 16.2.2 app, single Supabase DB, shared user identity, shared Stripe (unused by v1 Newsroom), shared Resend.
- **Different surface.** Subdomain `newsroom.frontfiles.com` routed via Next.js middleware; separate page chrome; distinct nav; no paid-FF inventory exposed here; no newsroom Packs in paid-FF surfaces.
- **Different economics.** Newsroom v1 has no billing. `ECONOMIC_FLOW_v1` does not govern Newsroom in v1.

## 3. Exit criteria for v1 ship (testable)

Checked at NR-G5. Five buckets; every bucket must pass.

### 3.1 Product flows

- **P1.** A verified company can create a Pack with all five licence classes selectable (FF-* classes flagged-disabled if the Fallback path in §3.5 is active).
- **P2.** Pack publish blocked unless all seven preconditions (PRD Part 3 §3.3) are satisfied; violations surface the exact blocking item in UI.
- **P3.** Embargo end-to-end works: create → invite EmbargoRecipient → pre-lift access (logged) → auto-lift at `lift_at` → public Pack page renders → subscribers notified.

### 3.2 Trust, receipts, claims

- **T1.** Download from a public Pack page emits a `distribution_events` row and a tamper-evident `download_receipts` row with a verifiable Ed25519 signature resolvable at `frontfiles.com/.well-known/receipt-keys`.
- **T2.** Public claim intake (C1) creates a `claims` row that reaches the admin queue (A4); admin uphold executes the shared takedown flow (A6) which replaces the canonical URL with the tombstone (C2) while preserving DownloadReceipt retrievability.
- **T3.** AI training opt-out expressed in all six surfaces when `ai_training_permitted = false`: embed `<meta>`, `/.well-known/tdmrep.json`, `/ai.txt`, XMP/IPTC on zip, C2PA assertion (when signing opted in), receipt terms summary.

### 3.3 Admin and security

- **A1.** Admin console gated by MFA + role; every admin mutation writes an `admin_audit_events` row with before/after snapshot and reason; co-sign enforced for takedown of `verified_publisher` orgs and for SigningKey rotation/revocation.

### 3.4 Build and regression

- **B1.** `bun run build` exit 0; `tsc --noEmit` clean; vitest suite green; no new lint errors.
- **B2.** Existing routes + state machines unbroken: a delta audit against `PLATFORM_BUILD.md` confirms 22 prior routes still pass their checks, the 12 locked state machines are unmodified, and `DOWNLOAD_ELIGIBLE_ROLES` in `src/lib/company-roles.ts` is preserved.

### 3.5 Legal readiness — Primary path or Fallback path

Either path satisfies this bucket. The choice is made at dispatch of NR-D21 (launch hardening) based on counsel status.

**Primary path (target).** Legal has signed off on FF-PRV-1.0, FF-EDU-1.0, FF-PROMO-1.0 terms pages + Content Standards + AI Training Reservation + Claims Policy + Distributor ToS + Consumer ToU + Privacy/DPA + Verification Policy. All five licence classes enabled at launch.

**Fallback path (hedge).** Counsel review of FF-* terms pages has slipped. Launch proceeds with `cc_attribution` and `cc_public_domain` classes only; FF-* classes are flagged-disabled at both UI and API level. Public CC terms pages at `creativecommons.org` satisfy the legal-pages requirement for the two CC classes. Content Standards, Claims Policy, Distributor ToS, Consumer ToU, Privacy/DPA, and Verification Policy are still required and signed off.

## 4. Mapping Newsroom to existing Frontfiles primitives

Observed from audit; locks the primitive-reuse decision.

| PRD object | Existing primitive | Newsroom addition |
|---|---|---|
| `Organization` | `companies` (migration 20260413230015) | New 1:1 extension table `newsroom_profiles(company_id PK, verification_tier, verified_at, primary_domain, logo_asset_id, suspended)` |
| `User` | `users` (migration 20260408230009) | No change. |
| `OrganizationMembership` | `company_memberships` | Reuse. Role mapping below. |
| Role — PRD `owner` | `admin` | Direct map. |
| Role — PRD `editor` | `editor` | Direct map. |
| Role — PRD `uploader` | `editor` (v1) | v1 collapses uploader into editor. Split deferred to v1.1 (requires enum extension and call-site audit on entitlement/fulfilment stores). |
| Role — PRD `viewer` | *none in v1* | Deferred to v1.1. `DOWNLOAD_ELIGIBLE_ROLES` in `src/lib/company-roles.ts` stays untouched. |
| `VerificationRecord` | — | New table `newsroom_verification_records`. |
| `Pack` | — | New table `newsroom_packs`. |
| `Asset` | — | New table `newsroom_assets`. Distinct namespace from paid-FF asset primitives. |
| `AssetScanResult` | — | New table `newsroom_asset_scan_results`. |
| `AssetRendition` | — | New table `newsroom_asset_renditions`. |
| `RightsWarranty` | — | New table `newsroom_rights_warranties`. |
| `Correction` | — | New table `newsroom_corrections`. |
| `Embargo` | — | New table `newsroom_embargoes`. |
| `EmbargoRecipient` | — | New table `newsroom_embargo_recipients`. |
| `Recipient` | new `newsroom_recipients` | `newsroom_recipients(id PK, email text unique, user_id uuid nullable FK to users, outlet_id uuid nullable FK to newsroom_outlets, verified bool default false)`. Email is the stable identity. Created on first embargo invite (email-first, no user account required). `user_id` populated when the email signs up as a journalist. Anonymous visitors get no Recipient row; tracked via `anon_session_id` in events only. |
| `Outlet` | — | New table `newsroom_outlets`. |
| `DistributionEvent` | — | New table `newsroom_distribution_events`. Distinct from paid-FF `download_events`. |
| `DownloadReceipt` | — | New table `newsroom_download_receipts`. |
| `SigningKey` | — | New table `newsroom_signing_keys` (KMS-backed). |
| `Claim` | — | New table `newsroom_claims`. |
| `AdminAuditEvent` | — | New table `newsroom_admin_audit_events`. Distinct from any existing audit surface. |
| `AdminUser` | `users` with admin role | Reuses `users`; admin role assignment via a new `newsroom_admin_users(user_id PK, role)` table keyed to users. |
| `BeatSubscription` | — | New table `newsroom_beat_subscriptions`. |

All Newsroom tables prefixed `newsroom_*` for clarity and to keep the migration footprint contained. All RLS policies new. No modification to existing tables beyond the non-breaking additions tracked above.

## 5. Phase NR structure and gates

Five phases in a parallel track, each closed by a gate (NR-G1 … NR-G5). Distinct from existing Phase 0–7.

The *Directives* column below is a tracking aid. `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` is the authoritative source for directive assignment, slicing, and dependency ordering.

| Phase | Name | Exit gate | Directives (tracking) |
|---|---|---|---|
| **NR-1** | Foundation — schema, types, subdomain routing, domain libraries | **NR-G1**: migrations applied on dev; `bun run build` exit 0; `tsc --noEmit` clean; `src/lib/newsroom/*` importable; middleware routes `newsroom.frontfiles.com` without breaking `frontfiles.com` | NR-D1, NR-D2, NR-D3, NR-D4 |
| **NR-2** | Distributor path — signup → verification → Pack editor → publish | **NR-G2**: a verified company (via the full P2 flow) can create, embargo, and publish a Pack in dev with signed receipts | NR-D5, NR-D6, NR-D7, NR-D8, NR-D9, NR-D10 |
| **NR-3** | Consumer path — public Pack page, preview, directory, search, journalist account | **NR-G3**: a journalist can discover, preview (with token), download, and subscribe; every action emits correct events and receipts | NR-D11, NR-D12, NR-D13, NR-D14 |
| **NR-4** | Claims, takedown, analytics, corrections, AI-training surfaces | **NR-G4**: claim intake → admin uphold → tombstone works end-to-end; distributor analytics render; AI-training opt-out surfaces wired | NR-D15, NR-D16, NR-D20 |
| **NR-5** | Admin console + launch hardening | **NR-G5**: full admin surface MFA-gated; audit log immutable; co-sign enforced; §3 exit criteria all pass across the five buckets (Primary or Fallback path in §3.5) | NR-D17, NR-D18, NR-D19, NR-D21 |

## 6. Hard dependencies on existing phases

- **Phase 1 (Foundation)** — closed (G2 ✓ 2026-04-17). Newsroom builds on Supabase + RLS + dual-mode mocks-to-real.
- **Phase 3 (Email — Resend)** — required for embargo invites, verification emails, claim notifications, subscription notifications, admin notifications. Already partially landed per commit `5e652df`.
- **Phase 2 (Observability — Sentry/pino)** — strongly recommended before NR-G5. Newsroom adds high-consequence admin mutations (takedowns, key rotation) that must be observable.
- **Phase 4 (Google)** — not required.
- **Phase 5 (Stripe)** — not required for v1 Newsroom (no billing).
- **Phase 7 (Hardening)** — Newsroom hardening is subsumed by NR-5 for the Newsroom surface.

## 7. Non-goals for v1 Newsroom

Enforced. Any attempt by a directive to exceed these is rejected.

- Creator surfaces A and C (PRD Locked Decision #2)
- Asset-level licence override
- Coordinated / tiered embargoes
- Video transcoding (original only)
- Public API + webhooks
- Topic taxonomy (`Tag`, `PackTag`) + topic-based beat subscriptions
- Third-party receipt verification UI
- Organisation rename / rebrand / transfer beyond simple slug-change with redirect
- Paid billing, newsroom monetisation, pricing tiers
- SavedSearch on journalist side
- Outlet verification on journalist side
- Authorised-signatory attestation UI (schema ready, UI v1.1)
- Outbound mention detection
- Admin throughput dashboards
- Custom per-Org copy on public surfaces (beyond the defined fields)

## 8. Revision gate

Changes to this charter require founder sign-off. Changes to the PRD that touch:

- Part 2 — licence classes (enumeration, flags, blurbs, machine-readable metadata)
- Part 3 — object model, state machine, invariants
- Part 7 — release plan, launch dependencies, hedge

…require founder sign-off before the affected directive is dispatched. Other PRD sections may be refined mid-build with inline version notes in the PRD itself.

---

**End of charter.**
