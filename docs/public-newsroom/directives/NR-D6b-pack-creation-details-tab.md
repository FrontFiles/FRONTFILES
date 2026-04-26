# NR-D6b — Pack Creation Flow + Details Tab

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D6a (`95c5f7d`) — distributor dashboard P5 + tier-gate read
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~8 new + 1 modified file; route count delta +3 (103 → 106)

---

## 1. Why this directive

NR-D6a shipped the read-only half of the distributor surface: dashboard, banner, list, tier-gate. The "New pack" CTA routes to `/manage/packs/new` which is currently a placeholder.

NR-D6b replaces that placeholder with the **Pack creation flow + the Details tab** per **PRD §5.1 P6** (lines 819–845 of PRD.md):

- Top bar (title breadcrumb, status badge, save indicator, disabled publish CTA)
- Tab nav (Details active; Assets + Embargo disabled placeholders)
- Details tab form: title, subtitle, description, credit_line, licence_class, slug
- Create form (`/manage/packs/new`): blank state → POST → redirect
- Edit form (`/manage/packs/[packSlug]`): existing draft → PATCH → revalidate
- Slug uniqueness validation
- Server-side validation via zod

**Out of scope (deferred):**
- Publish CTA actual flow (NR-D9 — rights warranty + state machine RPC)
- Pre-publish checklist sidebar (NR-D9)
- Assets tab content (NR-D7)
- Embargo tab content (NR-D8)
- Mutability locks for `credit_line` / `licence_class` post-publish (NR-D9 — Pack can't transition to `published` in this directive)

The Details tab form is the **first write surface** for newsroom-side data. Everything ships in the `draft` state — no transitions yet. Auth posture matches the existing pattern: client form, Bearer token from supabase browser client, POST/PATCH to API route.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.2 Pack schema (line 265), §3.3 state machine (line 539), **§5.1 P6 Details tab (lines 819–845, verbatim)**, Part 2 licence blurbs (line 110) |
| Existing migrations | `supabase/migrations/20260425000001_*` | `newsroom_packs` table + 5 CHECKs + slug-format regex (line 309) |
| Existing schema.ts | `src/lib/db/schema.ts` | `NewsroomPackRow` at line 657, enum types 597–625 |
| Existing licence library | `src/lib/newsroom/licence-classes.ts` | `LICENCE_CLASSES` constant with `humanLabel` + `blurb` (NR-D4) |
| Existing auth pattern | `src/app/newsroom/[orgSlug]/manage/_components/admin-gate.tsx` | AdminGate session + Bearer fetch (NR-D5b-i F1b) |
| Existing API pattern | `src/app/api/newsroom/orgs/[orgSlug]/me/route.ts` (NR-D5b-i) and `verifications/email/send-otp/route.ts` (NR-D5b-ii) | Bearer extraction → `supabase.auth.getUser(token)` → 401 fail-closed |

PRD §5.1 P6 is verbatim authority for Details-tab field labels, helper text, and CTA copy.

---

## 3. AUDIT FIRST — MANDATORY

Pre-audit complete from NR-D6a's session — most checks should return clean. Re-verify each before composing:

### (a) NR-D6a's placeholder at `/manage/packs/new`
- Confirm 29-line server component exists; replace in place. No external dependents.

### (b) `newsroom_packs` INSERT/UPDATE RLS
- Read `newsroom_packs_insert_editor` (line 617) and `newsroom_packs_update_editor` (line 622) policies.
- Confirm both gate via `is_newsroom_editor_or_admin(company_id)`.
- Standing decision: **use service-role client** (`getSupabaseClient()`) for all writes in this directive. Mirrors NR-D6a's read posture and the broader newsroom convention. Do NOT switch to authenticated-client writes.
- The auth context (`supabase.auth.getUser(token)`) is used for caller identity (→ `created_by_user_id`) and admin-membership check, not for the SQL write itself.

### (c) Schema row type + enum imports
- Confirm `NewsroomPackRow`, `NewsroomPackStatus`, `NewsroomLicenceClass` are exported from `src/lib/db/schema.ts`.
- All 4 component files + 2 API routes import from `@/lib/db/schema`. No re-declaration.

### (d) Slug uniqueness constraint
- Confirm `newsroom_packs_slug_unique UNIQUE (company_id, slug)` (migration line 304).
- Confirm slug format regex `^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$` (line 309) — slugify helper must produce strings that pass this.

### (e) Auth helper precedent
- Re-read the Bearer extraction pattern in `verifications/email/send-otp/route.ts` (~line 1–60). The two new API routes in this directive must mirror that shape exactly: extract Bearer (inline `extractBearerToken` — there is no extracted helper in the codebase, every route inlines the same 7-line function; do NOT introduce a new helper in this directive) → `supabase.auth.getUser(token)` → 401 if invalid → check admin membership via **direct membership query** (NOT the `is_newsroom_editor_or_admin` RPC — service-role + that RPC always returns false because `auth.uid()` is NULL under service-role) → service-role client for write.

### (f) AdminGate coverage
- Confirm the `<AdminGate>` in `manage/layout.tsx` (NR-D5b-i F1a) wraps `/manage/packs/**` routes by virtue of layout inheritance. No extra gate needed in this directive.

### (g) Create-page redirect pattern
- POST creates the Pack and returns the new slug. Client form receives the response and uses `router.push(\`/${orgSlug}/manage/packs/${newSlug}\`)` to navigate. Do NOT issue a 303 redirect from the API — keep the API JSON-response shape consistent with the rest of the newsroom API surface.

### (h) Server-action pattern (locked NO)
- Codebase has no server-action precedent. Do NOT introduce one in this directive. The Details form is a `'use client'` component using `fetch()` with Bearer. Same posture as the verification cards (NR-D5b-i F6 / NR-D5b-ii F6).

### (i) Tab-nav placeholder behaviour
- Tab nav renders three tabs: Details (active), Assets (disabled placeholder), Embargo (disabled placeholder).
- Disabled tabs render as `<span>` (not `<button>` / not `<Link>`) with a tooltip "Available in NR-D7" / "Available in NR-D8" or similar — final copy at composition time, but tooltips must be present so admins know it's intentional, not broken.

### (j) Top-bar "publish" CTA disabled
- Render a disabled `<button>` labelled "Publish" with tooltip "Publishing ships in NR-D9. Save draft for now."
- Save indicator: shows "Saved" after a successful PATCH; "Unsaved changes" while the form is dirty (client-side state). Initial state on edit page = "Saved".

### Audit deliverable
After running checks (a)–(j), report:
- Findings table.
- IPs requiring sign-off (HALT before composing).
- Locked file list.

If audit clears with no IPs, state "No IPs surfaced — proceeding to composition."

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `src/app/newsroom/[orgSlug]/manage/packs/new/page.tsx` | EDIT — replace placeholder; server-component shell that renders DetailsForm in create mode | ~70 |
| F2 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/page.tsx` | NEW — server component, fetches existing draft Pack, renders editor shell + DetailsForm | ~110 |
| F3 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` | NEW — top bar (breadcrumb + status badge + disabled publish + save indicator slot) + tab nav | ~140 |
| F4 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/details-form.tsx` | NEW — `'use client'` form: 6 fields, validation, fetch + Bearer, redirect on create / revalidate on edit | ~240 |
| F5 | `src/app/api/newsroom/orgs/[orgSlug]/packs/route.ts` | NEW — POST: auth → admin check → validate → slug uniqueness → service-role INSERT | ~180 |
| F6 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/route.ts` | NEW — PATCH: auth → admin check → validate → service-role UPDATE; GET (optional, see note below) | ~180 |
| F7a | `src/lib/newsroom/pack-form-constants.ts` | NEW — client-safe constants (`PACK_*_MAX`, `SLUG_FORMAT`) + `slugify()` helper. **No `'server-only'`** | ~70 |
| F7b | `src/lib/newsroom/pack-form.ts` | NEW — `'server-only'` zod schemas (`createPackSchema`, `updatePackSchema`); imports constants from F7a | ~80 |
| F8 | `src/lib/newsroom/__tests__/pack-form.test.ts` | NEW — vitest cases for slugify + zod | ~140 |

**Note on F7 split (post-IP-1):** F4 needs runtime values (`SLUG_FORMAT` regex + max-length constants) for client-side validation hints. Value imports from a `'server-only'` module break Next.js's client/server module-graph boundary, so F7 is split: F7a (client-safe constants + slugify) and F7b (server-only zod schemas + imports F7a).

**Note on F6 GET:** F2 fetches the Pack via service-role client directly (page-level). F6 GET is optional — add only if a future client-side refetch needs it; otherwise PATCH-only.

Totals: 8 NEW + 1 EDIT = 9 conceptual deliverables; +3 routes (`/manage/packs/[packSlug]`, `/api/.../packs`, `/api/.../packs/[packSlug]`). Final commit = 11 paths (9 + directive + exit report).

---

## 5. F-specs

### F1 — `/manage/packs/new/page.tsx` (EDIT, replace)

Server component. Async params `Promise<{ orgSlug: string }>`. Fetches the company (id, name, primary_domain) and the active newsroom_profile (verification_tier).

**Tier gate:** if `tier === 'unverified'`, render an empty-state with copy "Verify your source to create packs." and a link to `/${orgSlug}/manage/verification`. Match the disabled-CTA semantics from NR-D6a F3.

**If tier verified:** render the editor shell in create mode, with DetailsForm seeded with empty defaults and `mode='create'`.

```tsx
<PackEditorShell
  orgSlug={orgSlug}
  orgName={company.name}
  pack={null}              // signals create mode
  saveState="idle"
>
  <DetailsForm
    orgSlug={orgSlug}
    pack={null}
    licenceClasses={Object.values(LICENCE_CLASSES)}
  />
</PackEditorShell>
```

---

### F2 — `/manage/packs/[packSlug]/page.tsx` (NEW)

Server component. Async params `Promise<{ orgSlug: string; packSlug: string }>`.

Fetches:
1. Company (id, name, primary_domain) by slug → `notFound()` if missing
2. newsroom_profiles (verification_tier) → `notFound()` if missing
3. newsroom_packs by `company_id + slug` → `notFound()` if missing
4. **Status guard:** if `pack.status !== 'draft'`, render a stub "This pack is no longer editable. Status: {status}." This directive only handles draft editing; scheduled/published transitions are NR-D9.

If everything checks out, render the editor shell + DetailsForm in edit mode.

```tsx
<PackEditorShell
  orgSlug={orgSlug}
  orgName={company.name}
  pack={pack}
  saveState="saved"
>
  <DetailsForm
    orgSlug={orgSlug}
    pack={pack}
    licenceClasses={Object.values(LICENCE_CLASSES)}
  />
</PackEditorShell>
```

---

### F3 — `_components/pack-editor-shell.tsx` (NEW)

Server component. Composition shell.

**Props:**
```ts
{
  orgSlug: string
  orgName: string
  pack: NewsroomPackRow | null   // null in create mode
  saveState: 'idle' | 'saving' | 'saved'
  children: React.ReactNode      // the active tab content (DetailsForm)
}
```

**Layout:**
- Top bar: breadcrumb ("`{orgName}` / Packs / `{pack?.title ?? 'New pack'}`"), status badge (`Draft` always in this directive — pack.status defaults to 'draft' in create mode and the F2 status-guard ensures only drafts pass through), save indicator (renders the saveState string), disabled "Publish" button with tooltip "Publishing ships in NR-D9."
- Tab nav: Details (active link to current page), Assets (disabled tooltip "Available in NR-D7"), Embargo (disabled tooltip "Available in NR-D8")
- Tab content: `{children}`

Save indicator is a slot — F3 renders the prop value verbatim. F4's `'use client'` form mutates the value via... actually, since F3 is server and F4 is client, the saveState passed in is initial state only. The actual reactive save indicator lives **inside** F4 as part of the form's internal state, and re-renders within the form's region. F3 renders the initial server state in the top bar; F4 manages its own local indicator.

**Compromise to avoid prop-drilling reactivity through a server boundary:** F3 renders the static initial saveState string in the top bar; F4 renders its own dynamic indicator inline next to the form's submit button. Two separate indicators is acceptable for v1; can be unified in a v1.1 polish pass when client-server reactivity patterns get a closer look.

---

### F4 — `_components/details-form.tsx` (NEW, `'use client'`)

The form. Details tab body. PRD §5.1 P6 verbatim labels and helper text.

**Props:**
```ts
{
  orgSlug: string
  pack: NewsroomPackRow | null    // null = create mode
  licenceClasses: ReadonlyArray<{
    id: NewsroomLicenceClass
    humanLabel: string
    blurb: string
  }>
}
```

**State (client):**
- `title`, `subtitle`, `description`, `creditLine`, `licenceClass`, `slug` — controlled inputs
- `slugWasManuallyEdited` — boolean. While false, slug auto-derives from title via `slugify()`. Flips true on first manual slug edit.
- `errors` — Record<string, string> from server validation responses
- `submitting`, `saveIndicator` — submit state

**Field copy (PRD §5.1 P6 verbatim):**

| Field | Label | Required | Helper |
|---|---|---|---|
| title | "Pack title" | yes | — |
| subtitle | "Subtitle (optional)" | no | — |
| description | "Description" | yes | multiline `<textarea>` |
| credit_line | "Credit line" | yes | `Appears wherever assets are used. Example: "Photo: Nike"` |
| Licence selector | "Licence" | yes | radio group; blurb renders beneath the selected option |
| Pack slug | "URL slug" | auto | helper: `newsroom.frontfiles.com/{orgSlug}/p/{slug}` |

**Submit behaviour:**
- Create mode: POST `/api/newsroom/orgs/{orgSlug}/packs` with `{ title, subtitle, description, credit_line, licence_class, slug }`. On 201, parse `{ slug: newSlug }` and `router.push(\`/${orgSlug}/manage/packs/${newSlug}\`)`.
- Edit mode: PATCH `/api/newsroom/orgs/{orgSlug}/packs/{pack.slug}` with same body. On 200, set `saveIndicator='saved'` and call `router.refresh()` to re-fetch the server component (which re-renders with the new values).

**Auth:** mirror NR-D5b-i F6 / NR-D5b-ii F6 — get session via `getSupabaseBrowserClient()` from `@/lib/supabase/browser` (audit-corrected path; the codebase uses `browser` not `browser-client` and exports `getSupabaseBrowserClient`), attach `Authorization: Bearer ${session.access_token}` to fetch.

**Error handling:**
- 400 (zod validation) → display per-field errors from the response body
- 409 (slug conflict) → display "This URL slug is already used. Try another."
- 401 / 403 → display "Session expired. Refresh and try again."
- 5xx → display "Couldn't save. Try again in a moment."

**Disabled state:** while `submitting === true`, all inputs disabled, submit button shows spinner.

---

### F5 — `/api/newsroom/orgs/[orgSlug]/packs/route.ts` (NEW, POST)

```ts
export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
  if (!isAuthWired()) return NextResponse.json({ ok: false, error: 'feature-disabled' }, { status: 404 })

  // 1. Bearer auth
  const token = extractBearer(request)
  if (!token) return 401
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return 401

  // 2. Resolve company by orgSlug; verify caller is an admin via direct
  //    membership query (NOT the is_newsroom_editor_or_admin RPC — that
  //    function checks auth.uid() internally and returns false under a
  //    service-role client where auth.uid() is NULL). Audit IP-3 lock:
  //    admin-only role check, mirroring AdminGate's UI gate and every
  //    existing newsroom API route. Mirror the EXACT membership-check
  //    shape used by NR-D5b-i / NR-D5b-ii / NR-D6a routes — do not
  //    introduce a new admin-check pattern in this directive.
  const company = await client.from('companies').select('id, primary_domain').eq('slug', orgSlug).maybeSingle()
  if (!company) return 404

  // [Audit precedent: read existing newsroom API routes for the exact
  //  table name + role-column shape. Likely a `newsroom_admin_memberships`
  //  table (or similar) keyed on (company_id, user_id, role). Do NOT
  //  invent a new pattern — copy the working one verbatim.]
  const membership = /* direct query against the membership table */
  if (!membership || membership.role !== 'admin') return 403

  // 3. Verify tier ≥ verified_source (PRD §3.4 invariant 2)
  const profile = await client.from('newsroom_profiles').select('verification_tier').eq('company_id', company.id).maybeSingle()
  if (!profile || profile.verification_tier === 'unverified') {
    return NextResponse.json({ ok: false, reason: 'unverified' }, { status: 403 })
  }

  // 4. Validate body via zod (createPackSchema from F7)
  const body = await request.json()
  const parsed = createPackSchema.safeParse(body)
  if (!parsed.success) return 400 with field errors

  // 5. Slug uniqueness pre-check
  const existing = await client.from('newsroom_packs').select('id').eq('company_id', company.id).eq('slug', parsed.data.slug).maybeSingle()
  if (existing) return 409 'slug-conflict'

  // 6. Service-role INSERT
  const { data: pack, error: insertErr } = await getSupabaseClient()
    .from('newsroom_packs')
    .insert({
      company_id: company.id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      description: parsed.data.description,
      credit_line: parsed.data.credit_line,
      licence_class: parsed.data.licence_class,
      created_by_user_id: user.id,
      // status / visibility default to 'draft' / 'private' per migration
    })
    .select()
    .single()
  if (insertErr) return 500

  return NextResponse.json({ ok: true, pack }, { status: 201 })
}
```

Auth helper functions (`extractBearer`, `isAuthWired`) inherit from existing route precedent — do not re-implement; import where they live.

---

### F6 — `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/route.ts` (NEW, PATCH)

Same shape as F5 but:
- Resolves the existing pack by `(company_id, slug)` → 404 if missing
- Refuses if `pack.status !== 'draft'` → 409 with `reason: 'not-editable'`
- Validates body via `updatePackSchema` (allows partial updates; all fields optional but at least one required)
- If body includes a new `slug`, runs the uniqueness pre-check excluding the current pack id
- Service-role UPDATE
- Returns `{ ok: true, pack }` with the updated row

GET (optional) — only add if F2's server-side fetch can't cover all needs. Default: skip GET; F2 fetches directly.

---

### F7 — `src/lib/newsroom/pack-form.ts` (NEW)

```ts
import 'server-only'  // imported by API routes; F4 (client) imports types only
import { z } from 'zod'

import type { NewsroomLicenceClass } from '@/lib/db/schema'

export const PACK_TITLE_MAX = 200
export const PACK_SUBTITLE_MAX = 200
export const PACK_DESCRIPTION_MAX = 5000
export const PACK_CREDIT_LINE_MAX = 200
export const PACK_SLUG_MAX = 60

export const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/

const LICENCE_VALUES: ReadonlyArray<NewsroomLicenceClass> = [
  'press_release_verbatim',
  'editorial_use_only',
  'promotional_use',
  'cc_attribution',
  'cc_public_domain',
]

export const createPackSchema = z.object({
  title: z.string().min(1).max(PACK_TITLE_MAX),
  subtitle: z.string().max(PACK_SUBTITLE_MAX).nullable().optional(),
  description: z.string().min(1).max(PACK_DESCRIPTION_MAX),
  credit_line: z.string().min(1).max(PACK_CREDIT_LINE_MAX),
  licence_class: z.enum(LICENCE_VALUES as [string, ...string[]]),
  slug: z.string().regex(SLUG_FORMAT).max(PACK_SLUG_MAX),
})

export const updatePackSchema = createPackSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided.' },
)

/**
 * Slugify a pack title for the URL slug.
 *
 * - Lowercase
 * - NFKD normalize + strip combining marks (e.g. "São Paulo" → "sao-paulo")
 * - Replace non-alphanumeric runs with single hyphen
 * - Trim leading/trailing hyphens
 * - Truncate to PACK_SLUG_MAX
 *
 * Result must satisfy SLUG_FORMAT. If the result would be empty
 * (e.g. title is all symbols), returns 'pack' as a safe fallback.
 */
export function slugify(input: string): string {
  // ... implementation
}
```

The licence values list is duplicated here from `LICENCE_CLASSES` for zod typing — acceptable redundancy; both must stay in sync with the schema enum. Note in code comment.

Re `'server-only'`: F7 is imported by API routes (server) and F4's client form needs types only (`type { ... }` imports). Confirm `import type` works for the schema constants F4 needs (regex + max constants for client-side validation hints). If not, split F7 into a `.types.ts` (constants-only, no `'server-only'`) and `.ts` (zod schemas, server-only). Surface as IP if needed.

---

### F8 — `__tests__/pack-form.test.ts` (NEW)

Vitest cases. Aim for 12–15:

- `slugify`:
  - "Hello World" → "hello-world"
  - "São Paulo & Co." → "sao-paulo-co"
  - "   spaces   " → "spaces"
  - "!!@@##" → "pack" (fallback)
  - 100-char title → 60-char slug (truncate)
  - Already-slug "valid-slug" → "valid-slug" (idempotent)
  - Output always passes `SLUG_FORMAT` regex (property check across 3-4 cases)
- `createPackSchema`:
  - Valid full payload passes
  - Missing title fails
  - Missing description fails
  - Invalid licence_class fails
  - Slug too long fails
  - Slug with bad format fails
- `updatePackSchema`:
  - Empty object fails (refine)
  - Single field passes
  - Same field validations as create (sample 1–2)

---

## 6. New env vars

None.

---

## 7. VERIFY block

In order, after all 8 files are composed:

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/newsroom/__tests__/pack-form.test.ts` — all cases green.
3. `bunx vitest run src/lib/newsroom/__tests__` — full newsroom suite green (NR-D5b-i + NR-D5b-ii + NR-D6a remain passing).
4. `bun run build` exit 0; route count delta is +3 (`/manage/packs/[packSlug]`, `/api/.../packs`, `/api/.../packs/[packSlug]`); total = 106.
5. **Bounce dev server before VERIFY 6** (carry-forward from NR-D5b-ii).
6. Curl smoke (no auth) on the three new routes:
   - `GET /{orgSlug}/manage/packs/[any-slug]` → 200 (AdminGate "Loading…" placeholder)
   - `POST /api/newsroom/orgs/{orgSlug}/packs` → 401
   - `PATCH /api/newsroom/orgs/{orgSlug}/packs/[any-slug]` → 401
7. Visual smoke: navigate to `/{orgSlug}/manage/packs/new` as an authed admin (if test admin available); confirm form renders with empty fields and licence radio group; confirm disabled tabs (Assets, Embargo) render with tooltips. **Defer** if no test admin in fixtures (mirrors NR-D5b-i posture).
8. Scope diff: `git status --porcelain` shows exactly 9 paths (1M + 8??) — post-IP-1 split adds F7a alongside F7b.

---

## 8. Exit report mandate

Save to `docs/audits/NR-D6b-pack-creation-details-tab-EXIT-REPORT.md` BEFORE proposing the commit. Standard sections:

1. Summary (file table)
2. Audit findings + IPs resolution
3. Decisions that diverged
4. Open questions for founder
5. Test results (vitest verbatim)
6. Build + typecheck (exit codes; route count delta)
7. Runtime smoke (tested vs deferred)
8. Verdict
9. Carry-forwards for NR-D7

Founder ratifies before commit + push.

---

## 9. Standing carry-forward checks

Inherited from NR-D6a and prior:

- **Audit-first IP discipline** — surface IPs as HALT before composing.
- **Service-role for newsroom_* writes** — `getSupabaseClient()` in API routes; auth-context only for caller identity.
- **No server actions; client form + Bearer fetch** — established pattern, audit (h) re-confirms.
- **PRD wins on drift** — Details-tab field labels + helper text are §5.1 P6 verbatim.
- **`runtime = 'nodejs'`** declared on F5 + F6 (newsroom API route convention).
- **Service-role + auth-membership-check pattern** — `is_newsroom_editor_or_admin(company_id_arg)` is the gate; verify it's the right RPC name (audit (b) / (e) confirms from existing API routes).
- **Bounce dev server** between `bun run build` and curl smoke.
- **Tight per-directive commits** — selective `git add` of exactly the 9 deliverables (post-IP-1 split) + the directive file + the exit report = 11 paths total. No `git add -A`.
- **Display labels in domain library** (NR-D6a carry-forward) — F4's licence options pull from `LICENCE_CLASSES`, no inline duplicates beyond F7's zod enum list.
- **Embargo state column reads "None" for cancelled** (NR-D6a carry-forward) — applies to NR-D6a's pack-list, not this directive, but worth re-confirming if F2's status-guard surfaces edge cases.

---

## 10. Predecessor sequence

NR-D1 → NR-D2a → NR-D2b → NR-D2c-i → NR-D2c-ii → NR-D3 → NR-D4 (Phase NR-1, merged via PR #12 at `785aa2f`)
→ NR-D5a → NR-D5b-i → NR-D5b-ii → governance docs merge → **NR-D6a (`95c5f7d`)**
→ **NR-D6b — this directive**
→ NR-D7 (asset upload — split candidate; see closeout note)
→ NR-D8 (embargo configuration)
→ NR-D9 (rights warranty + publish + state machine RPC) — unblocks the disabled "Publish" button
→ ... NR-D21 (launch hardening)

---

End of NR-D6b directive.
