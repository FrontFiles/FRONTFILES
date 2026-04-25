# NR-D6a — Distributor Dashboard (P5) + Tier-Gate Read

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D5b-ii (`9ba487a`) — verification dashboard family closed
**Branch:** `feat/newsroom-phase-nr-2`
**Base:** `e7e7767` (after governance-docs inheritance merge)
**Expected scope:** ~10 new + 2 modified files; route count delta +1 (102 → 103)

---

## 1. Why this directive

P5 is the distributor's home base inside `newsroom.frontfiles.com/{org-slug}/manage`. Today the page is a 53-line stub from NR-D5b-i (F2) showing org name + tier + a static "verify" link. NR-D6a replaces that stub with the full P5 dashboard per **PRD §5.1 P5**:

- Header (Org name + tier badge + "New pack" CTA)
- Verification banner (3 conditional states: unverified / expiring < 30 days / recently revoked)
- Pack list table (filter-driven; empty state)
- KPI strip (placeholder for NR-D11 download counts)

NR-D6a is the **read-only half** of the distributor surface. Pack creation (the write side) ships in NR-D6b. The split mirrors the NR-D5b-i / NR-D5b-ii precedent — a clean ratification gate between the read-pattern (RLS reads, tier-gate semantics, verification banner derivation) and the write-pattern (Pack creation form, draft-state RPC, slug generation).

The "New pack" CTA respects PRD §3.4 invariant 2: `verification_tier = unverified` cannot create Packs. The CTA is disabled with a tooltip in that state. In all enabled states, it routes to `/manage/packs/new` — a placeholder in NR-D6a (F10), replaced by the real form in NR-D6b.

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.1 Object roster, §3.2 Pack schema, §3.3 state machine + visibility matrix, **§5.1 P5 (verbatim copy)**, §5.2 distributor workflows |
| Schema migrations | `supabase/migrations/20260425000001_*` | `newsroom_packs` table (line 271), pack_status / pack_visibility / licence_class enums (lines 75/83/90), RLS policies (line 605+) |
| Predecessor | `src/app/newsroom/[orgSlug]/manage/page.tsx` | The F2 stub being replaced |
| Verification helpers | `src/lib/newsroom/verification.ts` | `recomputeTier`, `computeTier`, type imports — **not invoked** in NR-D6a; banner reads existing tier directly |

PRD §5.1 P5 is verbatim authority for all UI strings in this directive. PRD §3.3 is verbatim authority for status × visibility derivation.

---

## 3. AUDIT FIRST — MANDATORY

Before composing any file, Claude Code MUST verify the following and HALT to surface IPs if any check produces an interpretive ambiguity:

### (a) Current `/manage/page.tsx` state
- Confirm the file is the NR-D5b-i F2 stub (`Tier: ${TIER_LABELS[tier]}` + Verify your domain link).
- Action will be **REPLACE in place**, not append. Audit confirms no other surface depends on this file's current export shape.

### (b) `newsroom_packs` table shape
- Confirm via `\d newsroom_packs` or grep on the migration: columns `id, company_id, slug, title, subtitle, description, credit_line, licence_class, publish_at, embargo_id, rights_warranty_id, status, visibility, published_at, archived_at, takedown_at, takedown_reason, c2pa_signing_enabled, created_by_user_id, created_at, updated_at`.
- Confirm index `idx_newsroom_packs_company_status (company_id, status)` exists — drives the dashboard query.

### (c) RLS posture on `newsroom_packs`
- Read the SELECT policy (`newsroom_packs_select_public` at line 607). Confirm whether it gates on `status = 'published'` (public-only) or includes an `is_newsroom_admin(company_id)` OR clause for admin reads of own drafts.
- **If public-only:** the dashboard SELECT must use `getSupabaseClient()` (service_role) since admin reads of `draft` / `scheduled` rows would otherwise return zero. This mirrors NR-D5b-i's posture for `newsroom_verification_records`.
- **If admin OR clause exists:** an authenticated client (Bearer-token) read is permissible. Default to service_role unless audit confirms an admin OR clause is in place.
- **Surface as IP if ambiguous.**

### (d) `newsroom_verification_records` query for banner state
- Banner state requires reading active records (per NR-D5b-i: `expires_at IS NULL OR expires_at > now()`) plus their `verified_at` for the "expiring < 30 days" derivation.
- Confirm the column shape: `method, value_checked, verified_at, expires_at, company_id`. NR-D5b-i migration 20260425000001 is canonical.

### (e) Schema.ts row type for Pack
- Confirm `NewsroomPackRow` does NOT yet exist in `src/lib/db/schema.ts`.
- F1 will append it — column types must match the migration exactly. Use existing `NewsroomVerificationTier`, `NewsroomPackStatus`, `NewsroomPackVisibility`, `NewsroomLicenceClass` enum types as imports if already exported; if any are missing, append them too in F1.

### (f) Filter-state convention
- This directive defaults to **server-rendered, URL-param-driven filters** (no client-side state, no `useState`, no `useTransition`). A `<form method="GET">` submits and the page re-renders.
- Audit: confirm no existing precedent in the codebase suggests otherwise. If an established client-filter pattern exists for similar surfaces, surface as IP and we'll choose explicitly.

### (g) Placeholder for `/manage/packs/new`
- The "New pack" CTA links to `/manage/packs/new`. F10 ships a minimal placeholder page so users don't hit a 404 if they click in NR-D6a's window. NR-D6b replaces it with the real form.
- Audit confirms the route doesn't exist yet — the placeholder is net-new in NR-D6a.

### Audit deliverable
After running checks (a)–(g), report:
- Findings table (any drift / ambiguity).
- IPs requiring sign-off (HALT before composing).
- A locked file list with the same shape as NR-D5b-ii's audit phase.

If audit clears with no IPs, state "No IPs surfaced — proceeding to composition" and continue.

---

## 4. Scope (post-audit, locked at composition time)

| F# | File | Action | Est. lines |
|---|---|---|---|
| ~~F1~~ | ~~`src/lib/db/schema.ts`~~ | **SKIPPED (IP-1)** — already in schema.ts | — |
| F2 | `src/app/newsroom/[orgSlug]/manage/page.tsx` | **REPLACE** — server component composing the dashboard | ~140 |
| F3 | `src/app/newsroom/[orgSlug]/manage/_components/dashboard-header.tsx` | NEW — org name + tier badge + "New pack" CTA | ~80 |
| F4 | `src/app/newsroom/[orgSlug]/manage/_components/verification-banner.tsx` | NEW — 3-state conditional banner | ~110 |
| F5 | `src/app/newsroom/[orgSlug]/manage/_components/pack-list.tsx` | NEW — table + row rendering + empty state | ~180 |
| F6 | `src/app/newsroom/[orgSlug]/manage/_components/pack-list-filters.tsx` | NEW — `<form method="GET">` filter controls | ~80 |
| F7 | `src/app/newsroom/[orgSlug]/manage/_components/kpi-strip.tsx` | NEW — placeholder KPI tiles | ~50 |
| F8 | `src/lib/newsroom/dashboard.ts` | NEW — pure helpers: `deriveBannerState`, `parseFilterParams`, `canCreatePack` | ~110 |
| F9 | `src/lib/newsroom/__tests__/dashboard.test.ts` | NEW — vitest cases for F8 helpers | ~140 |
| F10 | `src/app/newsroom/[orgSlug]/manage/packs/new/page.tsx` | NEW — placeholder ("Pack creation ships in NR-D6b") | ~30 |

Totals (post-IP-1): 8 NEW + 1 EDIT (F2 edit-rewrite) = 9 conceptual deliverables; +1 route (`/{orgSlug}/manage/packs/new`). Final commit = 11 paths (9 deliverables + directive + exit report).

---

## 5. F-specs

### F1 — `src/lib/db/schema.ts` (EDIT) — **SKIPPED PER AUDIT IP-1**

Audit confirmed `NewsroomPackRow` and all four supporting enum types (`NewsroomPackStatus`, `NewsroomPackVisibility`, `NewsroomLicenceClass`, `NewsroomVerificationMethod`) already exist in `src/lib/db/schema.ts` at lines 597–657 with migration-matched shapes (landed alongside NR-D1's foundation migration). Re-appending would be a duplicate-export error.

For the record (correct enum membership per migration `20260425000001` line 90 and `schema.ts:620`):

```ts
export type NewsroomLicenceClass =
  | 'press_release_verbatim'
  | 'editorial_use_only'
  | 'promotional_use'
  | 'cc_attribution'
  | 'cc_public_domain'
```

**F2 + F6 + F8 + F9 must read these enum members from the existing schema.ts exports — not from any hardcoded list elsewhere in this directive.** Filter-dropdown options in F6 iterate the existing `NewsroomLicenceClass` type's union members; do NOT inline a duplicate list.

---

### F2 — `src/app/newsroom/[orgSlug]/manage/page.tsx` (REPLACE)

Server component. Composes the dashboard top-to-bottom:

```
<DashboardHeader org={...} tier={...} canCreate={...} />
<VerificationBanner state={...} orgSlug={...} />   {/* conditional render */}
<KpiStrip stats={...} />
<PackListFilters current={filters} />
<PackList packs={...} filters={...} />
```

Data fetching (all parallel via `Promise.all`):
1. `companies` → `id, name, slug, primary_domain`
2. `newsroom_profiles` → `verification_tier`
3. `newsroom_verification_records` → active records (for banner state derivation)
4. `newsroom_packs` filtered by `company_id` + URL params (status, licence_class, date range)
5. KPI counts (placeholder query: total packs by status, no real download counts in v1)

Use `getSupabaseClient()` (service_role) for all queries — admin's-own-data view, audit-confirmed in section 3(c).

Reads URL search params via the `searchParams` page prop:
```ts
{ params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ status?: string; licence?: string; from?: string; to?: string }> }
```

`notFound()` on missing company / missing newsroom_profiles row, mirroring the existing F2 stub's posture.

---

### F3 — `_components/dashboard-header.tsx` (NEW)

Server component. Props:

```ts
{
  orgSlug: string
  orgName: string
  tier: NewsroomVerificationTier
  canCreatePack: boolean   // false when tier === 'unverified' OR when revoked
}
```

Layout: org name (h1), tier badge to the right (PRD §3.2 Organization badge copy), "New pack" CTA on the far right.

**CTA states (PRD §3.4 invariant 2 + §5.1 P5):**

| State | Render |
|---|---|
| `canCreatePack === true` | Active `<Link href={`/${orgSlug}/manage/packs/new`}>` "New pack" |
| `canCreatePack === false` | `<button disabled>` "New pack" with tooltip "Verify your source to create packs." |

Tier badge copy: `verified_source` → "Verified source"; `verified_publisher` → "Verified publisher"; `unverified` → no badge rendered.

---

### F4 — `_components/verification-banner.tsx` (NEW)

Server component. Conditional render — returns `null` if no banner state matches.

Props:

```ts
{
  state: BannerState   // from F8 deriveBannerState
  orgSlug: string
  // For 'expiring' state:
  method?: NewsroomVerificationMethod
  expiresAt?: string
  // For 'revoked' state:
  revokedAt?: string
}
```

Where `BannerState = 'unverified' | 'expiring' | 'revoked' | 'none'`.

**PRD §5.1 P5 verbatim copy table:**

| State | Copy | CTA |
|---|---|---|
| `unverified` | "Complete verification to publish your first pack." | "Go to verification" → `/{orgSlug}/manage/verification` |
| `expiring` | "Your {method} verification expires on {date}. Recheck to keep your tier." | "Re-verify" → `/{orgSlug}/manage/verification` |
| `revoked` | "Verification revoked on {date}. New packs are blocked until re-verified." | "Go to verification" → `/{orgSlug}/manage/verification` |

Date formatting: human-readable (e.g. "May 24, 2026"). Method label from `NewsroomVerificationMethod` enum: `dns_txt` → "DNS TXT", `domain_email` → "domain email", `authorized_signatory` → "authorized signatory".

Visual: full-width row above the KPI strip. No specific colour spec in PRD — use a neutral attention treatment (border + subtle background). Defer brutalist polish to a future design pass; functional shape is what matters.

---

### F5 — `_components/pack-list.tsx` (NEW)

Server component. Props:

```ts
{
  packs: ReadonlyArray<NewsroomPackRow & { embargo?: { lift_at: string; state: string } | null }>
  orgSlug: string
}
```

**PRD §5.1 P5 column spec (verbatim):**

| Column | Source | Format |
|---|---|---|
| Title | `pack.title` | Linked to `/${orgSlug}/manage/packs/${pack.slug}` (route placeholder until NR-D6b) |
| Status badge | `pack.status` | One of: draft, scheduled, published, archived, takedown |
| Visibility badge | `pack.visibility` | One of: private, restricted, public, tombstone |
| Licence | `pack.licence_class` | Mapped to PRD §2.1 display label |
| Embargo | derived | "None" if `embargo_id IS NULL`; "Lifts {rel}" if active; "Lifted" if state='lifted' |
| Downloads (30d) | placeholder | `—` (real count ships in NR-D11 with DistributionEvent) |
| Last edit | `pack.updated_at` | Relative format ("3 days ago") |

**Empty state (PRD §5.1 P5 verbatim):**
- When `packs.length === 0` AND no filters applied: render the empty state with copy "No packs yet. Create your first pack." and a "New pack" CTA (subject to same `canCreatePack` gate as F3).
- When `packs.length === 0` AND filters applied: render a different empty state ("No packs match the current filters. Clear filters.") with a clear-filters link that strips URL params.

Embargo column is the one schema-touch outside `newsroom_packs` — requires a JOIN to `newsroom_embargoes`. **Audit step in section 3:** confirm the embargo table exists and exposes `lift_at` and `state`. If missing or behind a separate RLS posture, render "—" for the embargo column in v1 and surface as a follow-up. The F2 query may need to be a left-join.

---

### F6 — `_components/pack-list-filters.tsx` (NEW)

Server component (no client state). Renders a `<form method="GET" action={`/${orgSlug}/manage`}>` with three select inputs and two date inputs:

| Field | Name | Options |
|---|---|---|
| Status | `status` | All / draft / scheduled / published / archived / takedown |
| Licence | `licence` | All / `<each licence_class enum value>` |
| Date from | `from` | `<input type="date">` |
| Date to | `to` | `<input type="date">` |

Submit button: "Apply". A separate "Clear" link to `/${orgSlug}/manage` (no params).

Reads current filter values from props to pre-select the active state on each render.

---

### F7 — `_components/kpi-strip.tsx` (NEW)

Server component. Props:

```ts
{
  stats: {
    totalPacks: number
    drafts: number
    scheduled: number
    published: number
    // No download counts in v1 — placeholder field documented but always 0
    downloads30d: number  // always 0; rendered as "—" in v1
  }
}
```

Renders 4 tiles in a row: Total / Drafts / Scheduled / Published. Downloads (30d) tile renders "—" with helper text "Available after first downloads" — note in inline comment that real count lands in NR-D11.

Stats query in F2: `SELECT status, count(*) FROM newsroom_packs WHERE company_id = $1 GROUP BY status`. Aggregate in the page.tsx then pass to F7.

---

### F8 — `src/lib/newsroom/dashboard.ts` (NEW)

Pure helpers. No I/O. No env reads.

```ts
import 'server-only'

import type {
  NewsroomVerificationMethod,
  NewsroomVerificationTier,
} from '@/lib/db/schema'

export type BannerState = 'unverified' | 'expiring' | 'revoked' | 'none'

export interface VerificationRecordSnapshot {
  method: NewsroomVerificationMethod
  verified_at: string
  expires_at: string | null
  // Future: a 'revoked_at' column will land in a future directive; until
  // then, 'revoked' state is unreachable from this helper. Documented as
  // a known limitation; banner state machine is shaped to support it.
}

export interface DeriveBannerInput {
  tier: NewsroomVerificationTier
  records: ReadonlyArray<VerificationRecordSnapshot>
  now: Date  // injected for testability
}

/**
 * Derives the verification banner state per PRD §5.1 P5.
 * Returns 'none' when no banner should render.
 */
export function deriveBannerState(input: DeriveBannerInput): {
  state: BannerState
  method?: NewsroomVerificationMethod
  expiresAt?: string
} {
  // tier === 'unverified' → 'unverified' (always wins)
  // any record with expires_at < now + 30d → 'expiring' with the soonest
  // (placeholder for future 'revoked' detection)
  // else → 'none'
}

/**
 * Whether the org can create new Packs.
 * PRD §3.4 invariant 2: unverified cannot create.
 * (Future: also returns false when revocation state is detected.)
 */
export function canCreatePack(tier: NewsroomVerificationTier): boolean {
  return tier !== 'unverified'
}

/**
 * Parses URL search params into a typed filter object.
 * Invalid values silently drop to undefined (the form re-renders without
 * them and the SQL query treats undefined as "no filter").
 */
export interface ParsedFilters {
  status?: NewsroomPackStatus
  licence?: NewsroomLicenceClass
  from?: string  // ISO date YYYY-MM-DD
  to?: string
}

export function parseFilterParams(
  params: Record<string, string | undefined>,
): ParsedFilters {
  // ...
}
```

---

### F9 — `__tests__/dashboard.test.ts` (NEW)

Vitest cases. Covers:

- `deriveBannerState`:
  - Returns `'unverified'` when tier is unverified, regardless of records.
  - Returns `'none'` when tier is verified_source and no records expire within 30 days.
  - Returns `'expiring'` with the soonest expiry when a record expires < 30 days out.
  - Returns `'expiring'` with the correct method when multiple records expire and we pick the soonest.
  - `expires_at IS NULL` records do NOT trigger the expiring state.
- `canCreatePack`:
  - `false` for `unverified`, `true` for `verified_source` and `verified_publisher`.
- `parseFilterParams`:
  - Returns empty object when no params.
  - Drops invalid status / licence values silently.
  - Pass-through for valid status / licence / from / to.

Aim for 8–10 cases. Parity with NR-D5b-i / NR-D5b-ii test density.

---

### F10 — `/manage/packs/new/page.tsx` (NEW placeholder)

Minimal 30-line server component. Renders a heading "New pack" + body "Pack creation ships in NR-D6b." + a back link to `/${orgSlug}/manage`. Replaced wholesale in NR-D6b.

Reason for landing this in NR-D6a: prevents a Next.js 404 page leak when admins click the "New pack" CTA in the brief window before NR-D6b ships.

---

## 6. New env vars

None. NR-D6a is read-only on existing data.

---

## 7. VERIFY block

In order, after all 11 files are composed:

1. `bun run typecheck` exits 0 with no errors.
2. `bunx vitest run src/lib/newsroom/__tests__/dashboard.test.ts` — all cases green.
3. `bunx vitest run src/lib/newsroom/__tests__` — full suite green (NR-D5b-i + NR-D5b-ii cases must remain passing).
4. `bun run build` exits 0; route count delta is +1 (`/{orgSlug}/manage/packs/new`); total = 103.
5. Visual smoke on `/{orgSlug}/manage` against the dev server (bounce dev server before this step per the NR-D5b-i / NR-D5b-ii carry-forward lesson). For an admin with `tier='unverified'`: banner renders the "Complete verification" copy; CTA disabled; pack list shows empty state.
6. Curl-smoke (no auth): `GET /{orgSlug}/manage` returns 200 (the AdminGate's "Loading…" placeholder appears in HTML — gate fires client-side as designed).
7. **Scope diff:** `git status --porcelain` shows exactly the 9 paths from section 4 (post-IP-1: F2 EDIT + F3–F10 NEW; F1 skipped).

If VERIFY 5 cannot complete due to environment limits (no test admin with packs in fixtures), document the gap in the exit report and rely on F9 unit tests + F2 type-check for coverage. Mirrors NR-D5b-i's posture.

---

## 8. Exit report mandate

Save to `docs/audits/NR-D6a-distributor-dashboard-tier-gate-EXIT-REPORT.md` BEFORE proposing the commit. Required sections:

1. **Summary** — files table with line counts, total +/-.
2. **Audit findings** — IPs surfaced and how they were resolved.
3. **Decisions that diverged** — anything that drifted from this directive.
4. **Open questions for founder** — anything unclear that didn't block composition but deserves attention.
5. **Test results** — vitest output verbatim for `dashboard.test.ts`.
6. **Build + typecheck** — exit codes; route count delta confirmation.
7. **Runtime smoke** — what was tested vs. what was deferred.
8. **Verdict** — Pass / Pass-with-corrections / Revise / Reject.
9. **Carry-forward observations** — lessons for NR-D6b.

Founder ratifies the exit report before commit + push.

---

## 9. Standing carry-forward checks

These are inherited from NR-D5b-i / NR-D5b-ii and apply to every directive in the sequence:

- **Audit-first IP discipline** — surface IPs as HALT before composing; no silent drift.
- **Server-shell + client-gate pattern** — the manage layout's `<AdminGate>` (NR-D5b-i F1) handles auth; F2 is a server component and does not re-implement the gate.
- **Service-role for admin-own-data reads** — pending audit (c) confirmation, default to `getSupabaseClient()` for admin reads of `newsroom_*` tables that are public-only on RLS.
- **Server-rendered URL-param filters** — no client state, no `useState` for filters in this directive (F6 is `<form method="GET">`).
- **Bounce dev server before runtime smoke** — `rm -rf .next` invalidates manifests; restart `bun run dev` before any curl / browser smoke. Pair with VERIFY 4's build step.
- **PRD wins on drift** — UI strings are §5.1 P5 verbatim. Any deviation requires an IP and exit-report log under "Decisions that diverged".
- **Tight per-directive commits** — selective `git add` of exactly the 9 deliverables + the directive file + the exit report = 11 paths total (post-IP-1). No `git add -A`.

---

## 10. Predecessor sequence

NR-D1 → NR-D2a → NR-D2b → NR-D2c-i → NR-D2c-ii → NR-D3 → NR-D4 (Phase NR-1, merged via PR #12 at `785aa2f`)
→ NR-D5a (`04a92c4`) → NR-D5b-i (`96a7cc2` + `c0b8e96`) → NR-D5b-ii (`9ba487a`) (Phase NR-2 in progress on `feat/newsroom-phase-nr-2`)
→ governance docs inheritance merge (`e7e7767`)
→ **NR-D6a — this directive**
→ NR-D6b (Pack creation flow + Details tab)
→ NR-D7 (asset upload + scanning + renditions, candidate for further split)
→ ... NR-D21 (launch hardening)

---

End of NR-D6a directive.
