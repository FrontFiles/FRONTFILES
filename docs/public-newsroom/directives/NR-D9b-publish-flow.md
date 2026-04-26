# NR-D9b — Publish Flow UI (P9 + P10)

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D9a (`bfeeb3c`) — pack state-machine RPC
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~8 new + 1 modified file; route count delta +2 (114 → 116)

---

## 1. Why this directive

NR-D9a shipped the `transitionPack` RPC — the canonical state-mutation entry point. NR-D9b lights up the **distributor-side publish flow** that calls it: rights warranty modal (PRD §5.1 P9), pre-publish checklist sidebar (PRD §5.1 P10), publish/schedule CTA + confirmation modal.

**In scope:**

- **P9 — Rights warranty gate modal** (PRD line 919): 3 mandatory checkboxes + optional narrative + confirming-user footer. Triggered when Publish/Schedule clicked AND `pack.rights_warranty_id IS NULL`. POSTs to a new `/rights-warranty` route, sets `pack.rights_warranty_id`, then proceeds to P10.
- **P10 — Pre-publish checklist + confirmation** (PRD line 939): 7-item sidebar showing live readiness state; CTA label derivation (Publish disabled / Publish now / Schedule per PRD verbatim); confirmation modal with 3 body-copy variants (no-embargo / with-embargo / publish_at-only).
- **Transition API route** that calls `transitionPack()` (NR-D9a's wrapper) with the user's caller_user_id.
- **Pure checklist derivation** in `src/lib/newsroom/publish-checklist.ts` (server-only): takes pack + warranty + scan aggregate + signing key state → returns 7-item state + CTA label + disabled-reason list.

**Out of scope (deferred):**

- **Embargo lift worker** (auto-publish at lift_at) — NR-D9c.
- **Subscriber notifications on publish** — NR-D9c.
- **Pull-back (scheduled → draft)** — v1.1 polish for closed beta. Founder can pull back via direct DB if needed; UI affordance is non-gating for NR-G2.
- **Post-publish toast Copy-link interaction** — PRD line 971 specifies "Published. {canonical_url} · Copy link." NR-D9b shows the toast text; the Copy-link button is a v1.1 polish (toast is a transient confirmation, not a primary surface).
- **NR-D11 Distributor Pack view (P11)** — separate consumer-facing surface; out of NR-2.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | **§5.1 P9 (line 919, verbatim) + P10 (line 939, verbatim)**, §3.2 RightsWarranty (line 354), §3.3 publish precondition checklist (line 576) |
| NR-D9a wrapper | `src/lib/newsroom/pack-transition.ts` | `transitionPack(client, input)` + `TransitionResult` discriminated union |
| Existing migrations | `supabase/migrations/20260425000002_*` (NR-D2a) | `newsroom_rights_warranties` schema |
| Existing schema.ts | `src/lib/db/schema.ts` | `NewsroomRightsWarrantyRow` + `transitionPack` types |
| NR-D6b precedent | `pack-editor-shell.tsx` | Top bar with disabled Publish button + tab nav (currently shows tooltip "Publishing ships in NR-D9.") |
| NR-D7a + D7b precedent | `assets/page.tsx`, `scan-poller.tsx` | Server-component pages + client polling pattern; mirror for the new client modals |

PRD §5.1 P9 is verbatim authority for: modal title, intro, checkbox copy (cross-ref §3.2), narrative label, footer, validation text, post-action behaviour. PRD §5.1 P10 is verbatim authority for: 7 checklist items + their state labels, CTA label states, 3 confirmation-modal body-copy variants, post-publish toast.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) **`transitionPack` wrapper** lives at `src/lib/newsroom/pack-transition.ts` per NR-D9a IP-1 rename. F7 imports + calls it.
- (P2) **`newsroom_rights_warranties` schema** confirmed in NR-D2a migration. CHECK enforces all 3 booleans = true (so warranty row's existence implies completeness).
- (P3) **NR-D6b's `pack-editor-shell.tsx`** has the disabled Publish button + tooltip; F1 EDIT activates it.
- (P4) **NR-D9a IP-1 file collision lesson** — I'll name the new lib file `publish-checklist.ts` (verb-form for the data shape it produces). Distinct from `pack-transition.ts` (executor) and `state-machine.ts` (NR-D4 validator).

### Audit checks to run

#### (a) `newsroom_rights_warranties` RLS
- Confirm INSERT policy permits service-role writes (mirror NR-D6b/D7a posture). UPDATE not needed (warranty immutable post-creation per PRD §5.1 P9 post-publish line 937).
- Surface as IP if posture differs.

#### (b) Pack-status guard for warranty + transition
- Warranty creation: permitted when `pack.status = 'draft'` (forms only show on draft packs).
- Transition POST: defers to `transitionPack` RPC's internal logic — the RPC accepts any current status and rejects illegal transitions. F6 (transition route) does NOT need a status guard; it's enforced by the RPC.

#### (c) PRD §5.1 P9 + P10 verbatim copy
- Re-read both sections in full. Lock all UI strings used in F2/F3/F4/F5 from those sections.

#### (d) Canonical URL builder
- The publish confirmation modal renders `{canonical_url}` per PRD §5.1 P10 line 959/965/969. Use existing `packCanonicalUrl(orgSlug, packSlug)` from `src/lib/newsroom/canonical-url.ts:17` (audit-corrected from earlier `canonicalPackUrl` typo per IP-4).

#### (e) Checklist data dependencies
- F8 helper needs: `pack` + `warranty` + asset count + asset-scan aggregate (count by `result`) + signing key state.
- F1 (shell EDIT) needs to fetch all of these to render the sidebar + CTA. Confirm the fetch shape doesn't conflict with NR-D6b's existing shell signature.

#### (f) Toast pattern in codebase
- Post-publish toast (PRD §5.1 P10 line 971): "Published. {canonical_url} · Copy link." Confirm whether the codebase has an existing toast pattern (sonner, react-hot-toast, custom) or NR-D9b introduces one.
- If introducing one: use `sonner` (popular, simple, ~3kb). Surface as IP if a different default is preferred.

#### (g) Modal pattern in codebase
- Confirm whether the codebase has an existing modal/dialog pattern (Radix UI Dialog, custom). Mirror it. Surface as IP if no precedent — NR-D9b introduces Radix Dialog as the default for modals.

### Audit deliverable

Findings table + IPs + locked file list. HALT before composing.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` | EDIT — convert to async server component; fetch warranty + signing key + asset aggregate; derive checklist state via F8; mount `<PrePublishChecklist>` sidebar + `<PublishActions>` button | ~80 lines added |
| F2 | `_components/publish-actions.tsx` | NEW — `'use client'` wrapper for Publish/Schedule button; manages modal open state; conditionally opens P9 (if warranty null) → P10 confirmation | ~140 |
| F3 | `_components/pre-publish-checklist.tsx` | NEW — server component; renders 7 items from derived state per PRD §5.1 P10 line 941 verbatim | ~100 |
| F4 | `_components/rights-warranty-modal.tsx` | NEW — `'use client'` P9 modal; 3 checkboxes + narrative + footer + Cancel/Confirm buttons; POSTs to F6; on success dispatches to F5 (publish confirmation) | ~220 |
| F5 | `_components/publish-confirmation-modal.tsx` | NEW — `'use client'` P10 confirmation modal; 3 body-copy variants (no embargo / with embargo / publish_at); Cancel / Publish-now or Schedule button; POSTs to F7 transition route | ~200 |
| F6 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/rights-warranty/route.ts` | NEW — POST: auth → admin → pack-status='draft' guard → validate body → INSERT warranty → UPDATE pack.rights_warranty_id | ~210 |
| F7 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/transition/route.ts` | NEW — POST: auth → admin → call `transitionPack` RPC → return result | ~180 |
| F8 | `src/lib/newsroom/publish-checklist.ts` | NEW — `'server-only'`; pure derivation: takes pack/warranty/asset-aggregate/signing-key → returns `{ items: ChecklistItem[], ctaLabel, ctaDisabled, missing: string[] }`; zod schemas for warranty + transition request bodies | ~180 |
| F9 | `src/lib/newsroom/__tests__/publish-checklist.test.ts` | NEW — vitest cases for derivation + zod | ~180 |

Totals: 8 NEW + 1 EDIT = 9 conceptual deliverables; +2 routes (`/api/.../rights-warranty`, `/api/.../transition`); 114 → 116.

**Deliberate non-split decision:** F8 contains both pure derivation AND zod schemas. NR-D6b/D7a/D8's pattern split lib into `*-constants.ts` + `*.ts` for client-safe value imports. NR-D9b's client components (F2/F4/F5) do NOT import any value constants from F8 — they only fetch/POST and surface server responses. So no split needed; single F8 stays `'server-only'`. Audit confirms this assumption.

---

## 5. F-specs

### F1 — `pack-editor-shell.tsx` (EDIT)

Convert to async server component (currently sync). New fetches inside (parallel via Promise.all):

1. `newsroom_rights_warranties` by `pack_id` → null if missing
2. `newsroom_signing_keys` count where `status='active'`
3. Asset aggregate: count by `newsroom_asset_scan_results.result`
4. (Already fetched in caller pages: pack, embargo)

Derive checklist state via `derivePublishChecklist(...)` from F8.

Replace the disabled Publish button section with `<PublishActions ...>` (F2), passing:
- `orgSlug`, `packSlug`, `pack`, `warranty`, `checklistState`, `canonicalUrl`

Render `<PrePublishChecklist items={...} />` (F3) in the sidebar slot.

The shell remains a server component. Client interactivity (modals) lives entirely inside F2/F4/F5.

### F2 — `publish-actions.tsx` (NEW, `'use client'`)

Owns the modal-open state. Renders the CTA button with state-derived label (`Publish` disabled / `Publish now` / `Schedule`).

Click flow:
1. If `pack.rights_warranty_id IS NULL` → open `<RightsWarrantyModal>` (F4). On warranty success, that modal calls `handleWarrantyConfirmed()` → close warranty modal, open `<PublishConfirmationModal>` (F5).
2. If warranty already exists → skip directly to F5.

Props:
```ts
{
  orgSlug: string
  packSlug: string
  pack: NewsroomPackRow
  warranty: NewsroomRightsWarrantyRow | null
  checklistState: { ctaLabel: 'Publish' | 'Publish now' | 'Schedule'; ctaDisabled: boolean; missing: ReadonlyArray<string> }
  canonicalUrl: string
}
```

CTA disabled state shows tooltip listing missing items (PRD §5.1 P10 line 953: "Any ✗ → disabled 'Publish'. ... tooltip lists missing items").

### F3 — `pre-publish-checklist.tsx` (NEW)

Server component. Props: `items: ChecklistItem[]`. Renders 7 rows per PRD §5.1 P10 verbatim.

```ts
interface ChecklistItem {
  label: string             // e.g. "Title and credit line"
  state: 'ok' | 'missing' | 'partial' | 'na'
  detail?: string           // e.g. "{n} scanning", "Missing on {n}", "Not confirmed"
}
```

PRD verbatim labels (line 945–951):
- "Title and credit line"
- "Licence class"
- "At least one asset"
- "All assets scanned clean"
- "Alt text on all images"
- "Rights warranty confirmed"
- "Embargo configured (if set)"

State indicators: ✓ for ok, ✗ for missing, "{detail}" for partial, "N/A" for na.

### F4 — `rights-warranty-modal.tsx` (NEW, `'use client'`)

P9 modal. PRD §5.1 P9 verbatim copy:

| Element | Copy |
|---|---|
| Title | "Before publishing" |
| Intro | "Confirm the rights basis for this pack. These confirmations are recorded and attached to the pack." |
| Checkbox 1 | (PRD §3.2 line 368) "All identifiable people in this pack have given required releases, or this pack contains no identifiable people." |
| Checkbox 2 | (PRD §3.2 line 369) "All third-party content in this pack is cleared for this use, or this pack contains no third-party content." |
| Checkbox 3 | (PRD §3.2 line 370) "All music in this pack is cleared for this use, or this pack contains no music." |
| Narrative label | "Anything we should know? (optional)" |
| Footer | "Confirming as {User.name} · {User.email}" |
| Cancel button | "Cancel" |
| Confirm button | "Confirm and continue" |

Validation: all 3 checkboxes required. Confirm button disabled until all checked.

Footer fetches user from `getSupabaseBrowserClient().auth.getUser()` on mount.

POST flow: on Confirm click → POST `/api/newsroom/orgs/{orgSlug}/packs/{packSlug}/rights-warranty` with `{ subject_releases_confirmed: true, third_party_content_cleared: true, music_cleared: true, narrative_text: <optional> }`. On 201, calls `onWarrantyConfirmed()` prop → parent (F2) closes this modal + opens F5.

Auth: `getSupabaseBrowserClient()` → Bearer fetch. Mirrors NR-D6b/D7a/D8 precedent.

### F5 — `publish-confirmation-modal.tsx` (NEW, `'use client'`)

P10 confirmation modal. Three body-copy variants per PRD §5.1 P10 (lines 957–969):

```ts
function getBodyCopy(pack, embargo, canonicalUrl): { title: string; body: string; ctaLabel: string } {
  if (!embargo && !pack.publish_at) {
    return {
      title: 'Publish this pack?',
      body: `You are publishing **${pack.title}** to \`${canonicalUrl}\`. It will be public immediately. Licence class (${pack.licence_class}) and credit line (${pack.credit_line}) will be locked after publish.`,
      ctaLabel: 'Publish now',
    }
  }
  if (embargo) {
    return {
      title: 'Schedule this pack?',
      body: `This pack will lift at ${liftAtFormatted} (${tz}) and publish to \`${canonicalUrl}\`. ${recipientCount} recipient(s) will be invited now with pre-lift access.`,
      ctaLabel: 'Schedule',
    }
  }
  // publish_at set, no embargo
  return {
    title: 'Schedule this pack?',
    body: `This pack will publish at ${publishAtFormatted} (${tz}) to \`${canonicalUrl}\`. Before then, it remains private to your newsroom.`,
    ctaLabel: 'Schedule',
  }
}
```

POST flow: on CTA click → POST `/api/newsroom/orgs/{orgSlug}/packs/{packSlug}/transition` with `{ targetStatus: <derived> }`. Target status derivation:
- No embargo, no publish_at → `'published'`
- With embargo or publish_at → `'scheduled'`

On 200 with `{ ok: true }`, dispatch toast (PRD line 971): "Published. {canonical_url} · Copy link." → `router.refresh()` → close modal.

On 200 with `{ ok: false, errorCode, missingPreconditions }` from the RPC → display error (this should be rare since the checklist gates the CTA, but defends against race conditions).

### F6 — `rights-warranty/route.ts` (NEW, POST)

Standard auth pattern (Bearer → user → admin membership query → service-role write). Pack-status='draft' guard. Validate body via warranty zod schema from F8.

Two writes (sequential, two-INSERT atomicity v1.1 caveat applies):
1. INSERT `newsroom_rights_warranties` with the 3 booleans + narrative + `confirmed_by_user_id = user.id` + `confirmed_at = now()`. RETURNING id.
2. UPDATE `newsroom_packs` SET `rights_warranty_id = <new id>` WHERE id = pack.id.

Return 201 with the warranty row.

### F7 — `transition/route.ts` (NEW, POST)

Body: `{ targetStatus: 'scheduled' | 'published' | 'draft' | 'archived' }`. Validate via transition zod schema from F8.

Standard auth pattern. Calls `transitionPack(client, { packId, targetStatus, callerUserId: user.id, overrideEmbargoCancel: false })` from F8b's wrapper.

Returns the RPC's `TransitionResult` discriminated union as JSON. Status code 200 regardless (the result's `ok` field signals success/failure; client interprets).

### F8 — `publish-checklist.ts` (NEW, `'server-only'`)

```ts
import 'server-only'
import { z } from 'zod'

import type {
  NewsroomPackRow,
  NewsroomRightsWarrantyRow,
} from '@/lib/db/schema'

export interface ChecklistItem {
  label: string
  state: 'ok' | 'missing' | 'partial' | 'na'
  detail?: string
}

export interface DeriveChecklistInput {
  pack: NewsroomPackRow
  warranty: NewsroomRightsWarrantyRow | null
  embargo: { id: string; lift_at: string; policy_text: string; recipientCount: number } | null
  assetCount: number
  imagesMissingAltCount: number
  scanCounts: { pending: number; clean: number; flagged: number; error: number }
  hasActiveSigningKey: boolean
}

export interface ChecklistResult {
  items: ChecklistItem[]
  ctaLabel: 'Publish' | 'Publish now' | 'Schedule'
  ctaDisabled: boolean
  missing: ReadonlyArray<string>  // for tooltip
}

export function derivePublishChecklist(input: DeriveChecklistInput): ChecklistResult {
  // Build 7 ChecklistItems in PRD §5.1 P10 verbatim order.
  // Determine CTA label via:
  //   - any item state 'missing' → 'Publish' disabled
  //   - all ok, no embargo, no publish_at → 'Publish now'
  //   - all ok, embargo or publish_at set → 'Schedule'
  // missing[] = labels of items in 'missing' state (for tooltip).
}

export const createWarrantySchema = z.object({
  subject_releases_confirmed: z.literal(true),
  third_party_content_cleared: z.literal(true),
  music_cleared: z.literal(true),
  narrative_text: z.string().max(2000).nullable().optional(),
})

export const transitionRequestSchema = z.object({
  targetStatus: z.enum(['scheduled', 'published', 'draft', 'archived']),
  overrideEmbargoCancel: z.boolean().optional(),
})
```

### F9 — `publish-checklist.test.ts` (NEW)

Vitest cases:
- All preconditions met, no embargo, no publish_at → `ctaLabel: 'Publish now', ctaDisabled: false, missing: []`
- All preconditions met, embargo set → `ctaLabel: 'Schedule', ctaDisabled: false`
- All preconditions met, publish_at set, no embargo → `ctaLabel: 'Schedule'`
- Missing title → `ctaDisabled: true, missing: ['Title and credit line']`
- Missing licence → `missing: ['Licence class']`
- 0 assets → `missing: ['At least one asset']`
- Asset scan pending: `state: 'partial', detail: '1 scanning'`
- Asset scan flagged: `state: 'partial', detail: '1 flagged'`
- Image missing alt: `state: 'partial', detail: 'Missing on 2'`
- Warranty null: `state: 'missing', detail: 'Not confirmed'`
- No active signing key: `missing: ['Active signing key']` (PRD doesn't list this as a checklist row but it's a publish precondition; surface in `missing[]` for tooltip even if not rendered as a checklist item)
- Embargo configured: `state: 'ok'`
- No embargo set: `state: 'na'`
- Zod schemas: valid + invalid cases for warranty + transition

Aim for 16–20 cases.

---

## 6. New env vars

None.

---

## 7. VERIFY block

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/newsroom/__tests__/publish-checklist.test.ts` — green.
3. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full suite green; prior 259/259 still passing.
4. `bun run build` exit 0; route count 114 → 116 (+2 API routes).
5. **Bounce dev server.**
6. Curl smoke (no auth) — 2 new API routes:
   - `POST /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/rights-warranty` → 401
   - `POST /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/transition` → 401
7. Visual smoke deferred (fixture-dependence + `.env.local` JWT drift v1.1 backlog).
8. Scope diff: `git status --porcelain` shows exactly 9 paths (1M + 8??).

---

## 8. Exit report mandate

`docs/audits/NR-D9b-publish-flow-EXIT-REPORT.md`. Standard sections.

---

## 9. Standing carry-forward checks

- Audit-first IP discipline.
- PRD §5.1 P9 + P10 verbatim for all UI strings.
- Service-role for newsroom_rights_warranties writes.
- `transitionPack` from `@/lib/newsroom/pack-transition` is the SOLE entry point for `newsroom_packs.status` mutations — no direct UPDATE in F6/F7 or anywhere downstream.
- Two-INSERT atomicity caveat applies to F6 (warranty INSERT + pack UPDATE). v1.1 backlog item already logged.
- runtime='nodejs' on F6 + F7.
- Inline auth helpers per existing pattern.
- F1 conversion to async server component is a structural change — caller pages (F1 of NR-D6b, F2 of NR-D7a, F2 of NR-D8) pass the same `pack` prop; verify no signature break.
- Pack-status='draft' guard on F6 (warranty creation). F7 (transition) defers to RPC's internal logic — no application-layer status guard.
- Tight per-directive commits; selective add of exactly 11 paths total (9 deliverables + directive + exit report).

---

## 10. Predecessor sequence

NR-D8 → NR-D9a (`bfeeb3c`) → **NR-D9b — this directive** → NR-D9c (lift worker + subscriber notifications) → NR-D10 (signing keys + receipts + KMS) → NR-G2.

---

End of NR-D9b directive.
