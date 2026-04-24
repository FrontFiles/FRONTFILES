# NR-D4 — Newsroom Domain Libraries (Phase NR-1)

**Status.** Drafted 2026-04-24 on top of NR-D1 through NR-D3 (all committed on `feat/newsroom-phase-nr-1` at `50eeeb0`). **Final directive of Phase NR-1.** Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single Claude Code session. Ships the pure-TypeScript domain library at `src/lib/newsroom/*` that downstream phases consume:

- Licence-class configuration (the single source of truth for PRD Part 2 blurbs, flags, codes, URIs)
- Embed-snippet generator (HTML snippet per PRD J4 §5.3, with TDM opt-out tags and HTML escaping)
- Receipt-terms generator (human-readable `terms_summary` for `newsroom_download_receipts`)
- Pack state-machine validator (transitions + visibility derivation per PRD §3.3)
- Invariants helpers (pure precondition checkers for publish gating — called from NR-D9 RPC)
- Canonical URL helpers (`packCanonicalUrl`, `receiptUrl`)
- Public barrel (`src/lib/newsroom/index.ts`)
- Unit tests for all the above

**Scope boundary.** Pure TypeScript. No DB. No pages. No proxy changes. No dependencies on Supabase client, Next server, or any paid-FF source module. Consumers of these libraries (the NR-D9 RPC, the NR-D11 pack page, the NR-D10 receipt emitter) come later.

**Deliverables.**

Source (7 files):
- `src/lib/newsroom/licence-classes.ts`
- `src/lib/newsroom/embed-snippet.ts`
- `src/lib/newsroom/receipt-terms.ts`
- `src/lib/newsroom/state-machine.ts`
- `src/lib/newsroom/invariants.ts`
- `src/lib/newsroom/canonical-url.ts`
- `src/lib/newsroom/index.ts` (barrel)

Tests (6 files):
- `src/lib/newsroom/__tests__/licence-classes.test.ts`
- `src/lib/newsroom/__tests__/embed-snippet.test.ts`
- `src/lib/newsroom/__tests__/receipt-terms.test.ts`
- `src/lib/newsroom/__tests__/state-machine.test.ts`
- `src/lib/newsroom/__tests__/invariants.test.ts`
- `src/lib/newsroom/__tests__/canonical-url.test.ts`

Total: 13 files. No tests for the barrel (it is pure re-exports).

**Existing files touched.** None. All 13 files are new. `host.ts` and its test from NR-D3 stay unchanged (barrel will re-export `isNewsroomHost` and `NEWSROOM_HOST_PATTERN` from it).

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 2 §2.1–§2.5 (licence classes: enumeration, flags, blurbs, machine-readable metadata, uploader selector — **this directive implements the canonical config**), Part 2 §2.6 (trademark overlay — consumed by embed-snippet + receipt-terms), Part 2 §2.7 (AI training opt-out surfaces), Part 3 §3.3 (Pack state machine + visibility matrix), Part 3 §3.4 (key invariants — points 1, 2, 3, 4, 5), Part 5 §5.1 P4 (signed receipt view — terms_summary), Part 5 §5.3 J4 (public Pack page — embed snippet format verbatim).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §2 (scope), §3 exit criteria (licence class correctness, terms snapshot integrity).
- **`docs/public-newsroom/directives/NR-D1-schema-foundation.md`** — `newsroom_licence_class` enum values + TS union `NewsroomLicenceClass` in schema.ts.
- **`docs/public-newsroom/directives/NR-D2c-i-provenance-stack.md`** — `NewsroomDownloadReceiptRow` consumes `terms_summary` and `credit_line`; this directive produces them.
- **`docs/public-newsroom/directives/NR-D3-subdomain-routing.md`** — `host.ts` from NR-D3 stays; this directive's barrel re-exports from it.
- **`src/lib/db/schema.ts`** — read-only source for `NewsroomLicenceClass`, `NewsroomPackStatus`, `NewsroomPackVisibility` enums. This directive does NOT edit schema.ts.
- **`src/lib/offer/rights-display.ts`** — reference pattern for how a licence-class display module is structured in this codebase. Consult for style conventions, not content.
- **Reference for test structure**: `src/lib/offer/tests/*.test.ts` (vitest + `@/` alias + `describe`/`it` convention).

**Relationship to Phase NR-1.** NR-D4 is the closing directive of Phase NR-1. After its exit report clears, **NR-G1 gate closes** and Phase NR-2 (distributor path: signup → verification → Pack editor → publish) begins. Phase NR-2 directives (NR-D5 onward) consume NR-D4's libraries heavily.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Domain Libraries
       (pure TypeScript domain library at src/lib/newsroom/*;
       licence-class config + embed-snippet generator +
       receipt-terms generator + state-machine validator +
       invariants helpers + canonical URL helpers + barrel
       + unit tests; no DB; no pages; no proxy changes; no
       Supabase client; no dependencies on paid-FF source)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                (authority — Part 2 is canonical)
  docs/public-newsroom/BUILD_CHARTER.md      (scope)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md (place in sequence)

SCOPE

You are building the pure-TypeScript domain library for the
Newsroom subsystem. 13 files total: 7 source modules + 6
vitest test files. No existing file touched except the
barrel (which is new). `src/lib/newsroom/host.ts` from NR-D3
stays as-is; the new barrel re-exports from it.

This directive is PRD-prescriptive: PRD Part 2 §2.3 blurbs,
§2.4 codes/URIs, and §2.7 TDM opt-out surfaces are canonical
and must be reproduced verbatim. If any blurb or URI in this
directive drifts from PRD Part 2, the PRD wins — surface the
drift as an open question. Do not paraphrase. Do not reword
legal language.

No app code. No DB. No API routes. No server components.
No React components. No Supabase client imports. No Next.js
imports except where strictly needed for a type (none are
needed here). Pure library code, fully unit-testable.

DELIVERABLES

SOURCE (7 files, all new)

(F1) src/lib/newsroom/licence-classes.ts
(F2) src/lib/newsroom/embed-snippet.ts
(F3) src/lib/newsroom/receipt-terms.ts
(F4) src/lib/newsroom/state-machine.ts
(F5) src/lib/newsroom/invariants.ts
(F6) src/lib/newsroom/canonical-url.ts
(F7) src/lib/newsroom/index.ts                  (barrel)

TESTS (6 files, all new)

(T1) src/lib/newsroom/__tests__/licence-classes.test.ts
(T2) src/lib/newsroom/__tests__/embed-snippet.test.ts
(T3) src/lib/newsroom/__tests__/receipt-terms.test.ts
(T4) src/lib/newsroom/__tests__/state-machine.test.ts
(T5) src/lib/newsroom/__tests__/invariants.test.ts
(T6) src/lib/newsroom/__tests__/canonical-url.test.ts

No other files are touched. Do not edit src/lib/db/schema.ts,
src/proxy.ts, src/lib/newsroom/host.ts (NR-D3), any page in
src/app/newsroom/, tsconfig, next.config, package.json, or
anything else.

────────────────────────────────────────────────────────────
F1 — src/lib/newsroom/licence-classes.ts (D1)
────────────────────────────────────────────────────────────

Single source of truth for PRD Part 2. The five licence
classes, their codes, URIs, human labels, blurbs, and
permission flags.

Imports:
  import type { NewsroomLicenceClass } from '@/lib/db/schema'

Types (exported):

  export type LicenceUseContext =
    | 'editorial'
    | 'promotional'
    | 'any'

  export interface LicenceFlags {
    canModify: boolean
    requiresAttribution: boolean
    useContext: LicenceUseContext
    aiTrainingPermitted: boolean
    redistributionPermitted: boolean
  }

  export interface LicenceClassConfig {
    id: NewsroomLicenceClass
    code: string          // machine-readable, e.g. 'FF-PRV-1.0'
    uri: string           // full URL
    humanLabel: string    // e.g. 'Press release (verbatim)'
    blurb: string         // PRD §2.3 verbatim
    flags: LicenceFlags
  }

Data (exported):

  export const LICENCE_CLASSES:
    Readonly<Record<NewsroomLicenceClass, LicenceClassConfig>> = {

    press_release_verbatim: {
      id: 'press_release_verbatim',
      code: 'FF-PRV-1.0',
      uri: 'https://frontfiles.com/licences/press-release-verbatim/1.0',
      humanLabel: 'Press release (verbatim)',
      blurb: 'Published for reporting. Reproduce the text without modification. Excerpting is permitted when quoted accurately for news reporting or commentary. Translation is permitted when faithful and marked as a translation. Credit the source as shown.',
      flags: {
        canModify: false,
        requiresAttribution: true,
        useContext: 'editorial',
        aiTrainingPermitted: false,
        redistributionPermitted: true,
      },
    },

    editorial_use_only: {
      id: 'editorial_use_only',
      code: 'FF-EDU-1.0',
      uri: 'https://frontfiles.com/licences/editorial-use-only/1.0',
      humanLabel: 'Editorial use only',
      blurb: 'Use in news reporting, commentary, or review. Credit the source. Do not alter the asset. Not for advertising, sponsored content, native advertising, advertorial, or branded content.',
      flags: {
        canModify: false,
        requiresAttribution: true,
        useContext: 'editorial',
        aiTrainingPermitted: false,
        redistributionPermitted: true,
      },
    },

    promotional_use: {
      id: 'promotional_use',
      code: 'FF-PROMO-1.0',
      uri: 'https://frontfiles.com/licences/promotional-use/1.0',
      humanLabel: 'Promotional use',
      blurb: 'Use in editorial or promotional contexts. Credit the source. Do not alter the asset.',
      flags: {
        canModify: false,
        requiresAttribution: true,
        useContext: 'any',
        aiTrainingPermitted: false,
        redistributionPermitted: true,
      },
    },

    cc_attribution: {
      id: 'cc_attribution',
      code: 'CC-BY-4.0',
      uri: 'https://creativecommons.org/licenses/by/4.0/',
      humanLabel: 'CC Attribution 4.0',
      blurb: 'Use, adapt, and redistribute for any purpose, including commercial. Credit the creator as shown. Full terms: creativecommons.org/licenses/by/4.0/',
      flags: {
        canModify: true,
        requiresAttribution: true,
        useContext: 'any',
        aiTrainingPermitted: true,
        redistributionPermitted: true,
      },
    },

    cc_public_domain: {
      id: 'cc_public_domain',
      code: 'CC0-1.0',
      uri: 'https://creativecommons.org/publicdomain/zero/1.0/',
      humanLabel: 'CC0 Public Domain',
      blurb: 'No rights reserved. Use, adapt, and redistribute freely. Attribution appreciated, not required. Full terms: creativecommons.org/publicdomain/zero/1.0/',
      flags: {
        canModify: true,
        requiresAttribution: false,
        useContext: 'any',
        aiTrainingPermitted: true,
        redistributionPermitted: true,
      },
    },

  } as const

Helpers (exported):

  export function getLicenceClass(
    id: NewsroomLicenceClass
  ): LicenceClassConfig {
    return LICENCE_CLASSES[id]
  }

  export function isFFLicenceClass(
    id: NewsroomLicenceClass
  ): boolean {
    // Returns true for the three proprietary FF-* classes,
    // false for the two CC classes. Used by the fallback
    // path in Build Charter §3.5 (FF-* classes flagged-
    // disabled until counsel sign-off).
    return id === 'press_release_verbatim'
        || id === 'editorial_use_only'
        || id === 'promotional_use'
  }

────────────────────────────────────────────────────────────
F2 — src/lib/newsroom/embed-snippet.ts (D2)
────────────────────────────────────────────────────────────

Generates the HTML embed snippet per PRD Part 5 §5.3 J4.

Imports:
  import type { NewsroomLicenceClass } from '@/lib/db/schema'
  import { getLicenceClass } from './licence-classes'

Types (exported):

  export interface EmbedSnippetInput {
    renditionUrl: string
    altText: string
    creditLine: string
    packCanonicalUrl: string
    organizationName: string
    licenceClass: NewsroomLicenceClass
    isTrademarkAsset?: boolean
    lastCorrectedAt?: string  // ISO date, if present
  }

Canonical snippet shape (PRD §5.3 J4 verbatim):

  <figure>
    <img src="{renditionUrl}" alt="{altText}">
    <figcaption>
      {creditLine}. Source: <a href="{packCanonicalUrl}">{organizationName}</a>.
      Licence: <a href="{licenceUri}">{licenceCode}</a>.
    </figcaption>
    <meta name="tdm-reservation" content="1">
    <meta name="tdm-policy" content="{licenceUri}#tdm">
  </figure>

Rules:
  - The two `<meta>` tags are OMITTED when
    `aiTrainingPermitted === true` on the licence (i.e. the
    two CC classes). Present on the three FF-* classes.
  - If `isTrademarkAsset === true`, append a
    `<small class="trademark-notice">Trademark and brand
    rights retained by {creditLine}. The licence above does
    not grant trademark rights.</small>` line inside the
    <figcaption> after the licence line. Both sentences are
    required per PRD §2.6 — the second sentence is the
    legal disclaimer distinguishing trademark from copyright
    scope; do not drop it.
  - If `lastCorrectedAt` is present, append a
    `<small class="correction-notice">Last corrected:
    {formatted}</small>` line inside the <figcaption>
    after the trademark notice (if any). Date format:
    YYYY-MM-DD (ISO date only; not full timestamp). If
    `lastCorrectedAt` is a full ISO timestamp, take the
    first 10 characters.

HTML-escape these fields before insertion (they are
user-authored text):
  - creditLine
  - organizationName
  - altText

Do NOT HTML-escape URLs (renditionUrl, packCanonicalUrl,
licenceUri). URLs are expected to be server-computed.
However, do attribute-escape them so that a malicious
credit_line value containing a double quote in a URL
query string does not break the attribute context — use
the same escape map for any string placed inside an HTML
attribute.

Exported function:

  export function generateEmbedSnippet(
    input: EmbedSnippetInput
  ): string

Implementation pattern: build a string of well-formed HTML
with two-space indentation and newlines between top-level
elements (figure → img/figcaption/meta*). The output should
render clean in a blog's source view. No template engine.
Plain string construction with an `escapeHtml()` helper
internal to this file (not exported).

────────────────────────────────────────────────────────────
F3 — src/lib/newsroom/receipt-terms.ts (D3)
────────────────────────────────────────────────────────────

Generates the human-readable `terms_summary` stored on
`newsroom_download_receipts`. Called by the NR-D10 signing
RPC; captured at download time; immutable on the receipt
row.

Imports:
  import type { NewsroomLicenceClass } from '@/lib/db/schema'
  import { getLicenceClass } from './licence-classes'

Types (exported):

  export interface ReceiptTermsInput {
    licenceClass: NewsroomLicenceClass
    creditLine: string
    isTrademarkAsset?: boolean
  }

Exported function:

  export function generateReceiptTerms(
    input: ReceiptTermsInput
  ): string

Output: a single plain-text string of 2–5 short sentences
suitable for display on the P4 signed receipt view and for
inclusion in the receipt JSON body. Structure:

  Line 1: `{humanLabel}.` (from LICENCE_CLASSES[id].humanLabel)
  Line 2: `Credit: {creditLine}.`
  Line 3 (if !canModify):
    `Do not alter the asset.`
  Line 4 (if !aiTrainingPermitted):
    `AI training not permitted by this source.`
  Line 5 (if isTrademarkAsset):
    `Trademark and brand rights retained by {creditLine}.
    The licence above does not grant trademark rights.`

Sentences joined by a single space (not newlines). No HTML.
Plain text suitable for both receipt JSON and any text-only
rendering.

Example output (press_release_verbatim, credit "Nike",
not trademark):

  "Press release (verbatim). Credit: Nike. Do not alter the
  asset. AI training not permitted by this source."

Example output (cc_public_domain, credit "CERN", trademark):

  "CC0 Public Domain. Credit: CERN. Trademark and brand
  rights retained by CERN. The licence above does not grant
  trademark rights."

────────────────────────────────────────────────────────────
F4 — src/lib/newsroom/state-machine.ts (D4)
────────────────────────────────────────────────────────────

Pack status transition validator + visibility derivation.
Pure; no DB. Consumed by NR-D9 RPC and UI disabled-state
computations.

Imports:
  import type {
    NewsroomPackStatus,
    NewsroomPackVisibility,
  } from '@/lib/db/schema'

Types (exported):

  export type PackTransitionTrigger =
    | 'uploader'          // Pack owner action
    | 'scheduler'         // Auto-lift worker
    | 'admin'             // Frontfiles admin
    | 'creation'          // Pack created from nothing

  export interface PackTransition {
    from: NewsroomPackStatus | null  // null = creation
    to: NewsroomPackStatus
    trigger: PackTransitionTrigger
  }

Data (exported):

  export const VALID_PACK_TRANSITIONS:
    ReadonlyArray<PackTransition> = [
    // Creation
    { from: null, to: 'draft',     trigger: 'creation' },

    // Uploader path — draft to scheduled / published
    { from: 'draft',     to: 'scheduled', trigger: 'uploader' },
    { from: 'draft',     to: 'published', trigger: 'uploader' },

    // Uploader pull-back
    { from: 'scheduled', to: 'draft',     trigger: 'uploader' },

    // Scheduler auto-lift
    { from: 'scheduled', to: 'published', trigger: 'scheduler' },

    // Uploader manual early lift
    { from: 'scheduled', to: 'published', trigger: 'uploader' },

    // Published lifecycle
    { from: 'published', to: 'archived',  trigger: 'uploader' },
    { from: 'archived',  to: 'published', trigger: 'uploader' },

    // Takedown (admin only, from any non-terminal state)
    { from: 'draft',     to: 'takedown',  trigger: 'admin' },
    { from: 'scheduled', to: 'takedown',  trigger: 'admin' },
    { from: 'published', to: 'takedown',  trigger: 'admin' },
    { from: 'archived',  to: 'takedown',  trigger: 'admin' },
  ] as const

Helpers (exported):

  export function canTransition(
    from: NewsroomPackStatus | null,
    to: NewsroomPackStatus,
    trigger: PackTransitionTrigger
  ): boolean

  export function deriveVisibility(
    status: NewsroomPackStatus,
    hasActiveEmbargo: boolean
  ): NewsroomPackVisibility {
    // Per PRD §3.3 matrix:
    // draft                                → private
    // scheduled + active embargo           → restricted
    // scheduled + no embargo               → private
    // published                            → public
    // archived                             → public
    // takedown                             → tombstone
  }

  export function isTerminalStatus(
    status: NewsroomPackStatus
  ): boolean {
    // Returns true for 'takedown' only. 'archived' is
    // reversible to 'published' per PRD §3.3.
    return status === 'takedown'
  }

────────────────────────────────────────────────────────────
F5 — src/lib/newsroom/invariants.ts (D5)
────────────────────────────────────────────────────────────

Pure precondition checkers for Pack publish. Input is plain
data (not DB rows); caller (NR-D9 RPC) assembles the input
from query results. Output is a structured verdict.

Imports:
  import type {
    NewsroomLicenceClass,
    NewsroomAssetKind,
  } from '@/lib/db/schema'

Types (exported):

  export interface PackPublishInput {
    title: string
    creditLine: string
    licenceClass: NewsroomLicenceClass | null
    assets: ReadonlyArray<{
      kind: NewsroomAssetKind
      altText: string | null
      scanResult: 'pending' | 'clean' | 'flagged' | 'error'
    }>
    rightsWarrantyConfirmed: boolean  // true iff a warranty row exists with all three bools true
    schedule:
      | { kind: 'none' }              // publish now
      | { kind: 'scheduled_plain', publishAt: string }
      | { kind: 'scheduled_embargo', liftAt: string, recipientsCount: number, policyText: string }
  }

  export interface PublishPreconditionReport {
    hasTitle: boolean
    hasCreditLine: boolean
    hasLicenceClass: boolean
    hasAtLeastOneAsset: boolean
    allAssetScansClean: boolean
    allImagesHaveAltText: boolean
    hasRightsWarranty: boolean
    scheduleValid: boolean
  }

Exported functions:

  export function checkPublishPreconditions(
    input: PackPublishInput
  ): PublishPreconditionReport

  export function isPublishable(
    report: PublishPreconditionReport
  ): boolean {
    // All eight fields must be true.
    return Object.values(report).every(v => v === true)
  }

  export function blockingPreconditions(
    report: PublishPreconditionReport
  ): ReadonlyArray<keyof PublishPreconditionReport> {
    // Returns the subset that are false. UI uses this to
    // drive the pre-publish checklist in P10.
  }

Rules per PRD §3.3:
  - hasTitle: title.trim().length > 0
  - hasCreditLine: creditLine.trim().length > 0
  - hasLicenceClass: licenceClass != null
  - hasAtLeastOneAsset: assets.length >= 1
  - allAssetScansClean: every asset has scanResult === 'clean'
  - allImagesHaveAltText: for assets where kind === 'image',
    altText must be non-null and non-empty
  - hasRightsWarranty: input.rightsWarrantyConfirmed === true
  - scheduleValid:
      * schedule.kind === 'none' → true
      * 'scheduled_plain' → publishAt parses as ISO 8601 and
        is in the future
      * 'scheduled_embargo' → liftAt parses as ISO 8601 and
        is in the future; recipientsCount >= 1;
        policyText.trim().length > 0

Use the Date constructor for ISO parsing: a value `d = new
Date(s)` where `isNaN(d.getTime())` is invalid.

────────────────────────────────────────────────────────────
F6 — src/lib/newsroom/canonical-url.ts (D6)
────────────────────────────────────────────────────────────

URL computation helpers. Pure.

Exported constants:

  export const NEWSROOM_BASE_URL =
    'https://newsroom.frontfiles.com'

  export const RECEIPT_BASE_URL =
    'https://frontfiles.com/receipts'

Exported functions:

  export function packCanonicalUrl(
    orgSlug: string,
    packSlug: string
  ): string {
    return `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}`
  }

  export function newsroomOrgUrl(orgSlug: string): string {
    return `${NEWSROOM_BASE_URL}/${orgSlug}`
  }

  export function receiptUrl(receiptId: string): string {
    return `${RECEIPT_BASE_URL}/${receiptId}`
  }

Slug validation is the caller's concern; these helpers do
not validate. (The DB CHECK constraints in NR-D1
`newsroom_packs_slug_format` and `companies_slug_format`
are the single source of truth for slug shape.)

────────────────────────────────────────────────────────────
F7 — src/lib/newsroom/index.ts (D7, barrel)
────────────────────────────────────────────────────────────

Pure re-exports. Single source of imports for external
callers. Example shape:

  // Licence classes
  export {
    LICENCE_CLASSES,
    getLicenceClass,
    isFFLicenceClass,
  } from './licence-classes'
  export type {
    LicenceClassConfig,
    LicenceFlags,
    LicenceUseContext,
  } from './licence-classes'

  // Embed snippet
  export { generateEmbedSnippet } from './embed-snippet'
  export type { EmbedSnippetInput } from './embed-snippet'

  // Receipt terms
  export { generateReceiptTerms } from './receipt-terms'
  export type { ReceiptTermsInput } from './receipt-terms'

  // State machine
  export {
    VALID_PACK_TRANSITIONS,
    canTransition,
    deriveVisibility,
    isTerminalStatus,
  } from './state-machine'
  export type {
    PackTransition,
    PackTransitionTrigger,
  } from './state-machine'

  // Invariants
  export {
    checkPublishPreconditions,
    isPublishable,
    blockingPreconditions,
  } from './invariants'
  export type {
    PackPublishInput,
    PublishPreconditionReport,
  } from './invariants'

  // Canonical URLs
  export {
    NEWSROOM_BASE_URL,
    RECEIPT_BASE_URL,
    packCanonicalUrl,
    newsroomOrgUrl,
    receiptUrl,
  } from './canonical-url'

  // Host (from NR-D3)
  export {
    NEWSROOM_HOST_PATTERN,
    isNewsroomHost,
  } from './host'

────────────────────────────────────────────────────────────
TESTS (T1–T6) — D8
────────────────────────────────────────────────────────────

All tests use `vitest` with `@/` alias. Import shape:

  import { describe, expect, it } from 'vitest'
  import { ... } from '@/lib/newsroom/...'

Minimum test inventories:

T1 — licence-classes.test.ts
  - All 5 classes present in LICENCE_CLASSES
  - Each class has non-empty code, uri, humanLabel, blurb
  - Flag shapes correct per PRD §2.1 (one test per class,
    asserts each of the 5 flags matches the spec)
  - getLicenceClass returns config by id
  - isFFLicenceClass returns true for the three FF-* and
    false for the two CC classes
  - Blurb spot-check: press_release_verbatim blurb starts
    with "Published for reporting."; cc_public_domain blurb
    starts with "No rights reserved."

T2 — embed-snippet.test.ts
  - Renders <figure><img><figcaption>...licence link</figcaption><meta>*</figure>
  - TDM meta tags present for all three FF-* classes
  - TDM meta tags ABSENT for both CC classes
  - HTML-escapes credit line with special chars
    (e.g. creditLine = `Photo: "Ana" & Co <Press>` renders
    correctly)
  - HTML-escapes organization name and alt text
  - isTrademarkAsset=true adds the trademark-notice small
  - lastCorrectedAt='2026-03-15T10:00:00Z' adds
    correction-notice small with '2026-03-15'
  - lastCorrectedAt='2026-03-15' (date-only) works too

T3 — receipt-terms.test.ts
  - Base shape: humanLabel + credit + conditional clauses
  - press_release_verbatim non-trademark produces 4-sentence
    output (label, credit, do-not-alter, ai-not-permitted)
  - cc_public_domain non-trademark produces 1-sentence
    output (label only — has canModify=true, no attribution
    required, aiTrainingPermitted=true)
    — wait, credit still appears. Re-check logic.
    Actually the structure is:
      - Line 1 always: humanLabel
      - Line 2 if requiresAttribution OR always? Spec says
        always include credit. Include always.
    So cc_public_domain: "CC0 Public Domain. Credit: {credit}."
    (2 sentences; no do-not-alter, no ai-clause)
  - cc_attribution: 2 sentences (label + credit; canModify
    and aiTrainingPermitted both true, so no alter or ai
    clauses)
  - isTrademarkAsset=true appends trademark clause
  - Credit interpolation handles special chars (plain text;
    no HTML escape needed here)

T4 — state-machine.test.ts
  - canTransition returns true for every row in
    VALID_PACK_TRANSITIONS (12 rows)
  - canTransition returns false for sample invalid
    transitions (e.g. takedown → anything; published →
    draft; archived → draft)
  - deriveVisibility returns correct mapping for all six
    (status, embargo?) combinations per PRD §3.3 matrix
  - isTerminalStatus returns true for 'takedown' only;
    false for all other statuses (including 'archived')

T5 — invariants.test.ts
  - Empty input (no assets, no warranty, etc.) →
    isPublishable false; blockingPreconditions returns all
    false fields
  - Fully-valid input (title + credit + licence + 1 image
    with alt + clean scan + warranty + schedule.none) →
    isPublishable true
  - Missing alt text on an image asset → fails
    allImagesHaveAltText
  - Flagged scan on an asset → fails allAssetScansClean
  - No rights warranty → fails hasRightsWarranty
  - scheduled_plain with publishAt in the past → fails
    scheduleValid
  - scheduled_embargo with 0 recipients → fails scheduleValid
  - scheduled_embargo with empty policyText → fails
    scheduleValid
  - Non-image assets (audio, document, text) with null
    altText → still passes allImagesHaveAltText (rule applies
    only to images)

T6 — canonical-url.test.ts
  - packCanonicalUrl('acme', 'launch-2026') →
    'https://newsroom.frontfiles.com/acme/launch-2026'
  - newsroomOrgUrl('acme') →
    'https://newsroom.frontfiles.com/acme'
  - receiptUrl('abc-123') →
    'https://frontfiles.com/receipts/abc-123'
  - Constants exported as expected

OUT OF SCOPE (hard boundaries)

- NO edits to src/lib/db/schema.ts.
- NO edits to src/lib/newsroom/host.ts (exists from NR-D3).
- NO edits to src/proxy.ts.
- NO edits to any page in src/app/newsroom/ or elsewhere.
- NO DB migration. NO edits to supabase/**.
- NO API routes. NO React components. NO server components.
- NO Supabase client init, no auth logic, no session code.
- NO Next.js imports (these libraries are platform-agnostic
  TypeScript).
- NO new dependencies. If Claude Code believes a dependency
  is needed (for HTML escape, ISO date parsing, etc.), halt
  and surface. Use standard library / built-in primitives.
- NO fix of the PUBLIC-EXECUTE grant on NR-D1 helpers.
- NO changes to vitest config or tsconfig.

If a PRD Part 2 blurb, code, or URI in this directive differs
from the current PRD file, halt and surface as an open
question BEFORE writing licence-classes.ts. Blurbs are
Legal-ready text and must not drift.

VERIFY

Run these in order. Each must pass before moving to the next.

  # 1. TypeScript type-check
  rm -rf .next  # per the NR-D2b / NR-D3 lesson
  bun run typecheck
  # expected: tsc --noEmit exit 0

  # 2. Vitest — all six new test files
  bun test src/lib/newsroom/__tests__/
  # expected: all tests pass, 0 failures
  # Also confirm under vitest run:
  bunx vitest run src/lib/newsroom/__tests__/
  # expected: same result

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0, route count UNCHANGED
  # from NR-D3 baseline (93 routes). These libraries add no
  # pages or routes.

  # 4. Barrel import smoke (quick sanity check that index.ts
  #    re-exports don't have typos). From repo root:
  node -e "
    import('./src/lib/newsroom/index.ts').then(m => {
      const expected = [
        'LICENCE_CLASSES', 'getLicenceClass', 'isFFLicenceClass',
        'generateEmbedSnippet',
        'generateReceiptTerms',
        'VALID_PACK_TRANSITIONS', 'canTransition',
        'deriveVisibility', 'isTerminalStatus',
        'checkPublishPreconditions', 'isPublishable',
        'blockingPreconditions',
        'NEWSROOM_BASE_URL', 'RECEIPT_BASE_URL',
        'packCanonicalUrl', 'newsroomOrgUrl', 'receiptUrl',
        'NEWSROOM_HOST_PATTERN', 'isNewsroomHost',
      ]
      const missing = expected.filter(k => !(k in m))
      if (missing.length) {
        console.error('Missing from barrel:', missing)
        process.exit(1)
      }
      console.log('Barrel OK: all', expected.length, 'exports present')
    })
  " 2>&1 || true
  # If node ESM import of .ts fails in your environment,
  # skip this step and rely on typecheck + build to catch
  # typos. Note this in the exit report.

  # 5. PRD blurb fidelity check. Confirm the exact blurbs
  # in LICENCE_CLASSES match PRD §2.3. Grep:
  grep -F "Published for reporting. Reproduce the text without modification." src/lib/newsroom/licence-classes.ts
  grep -F "Use in news reporting, commentary, or review. Credit the source. Do not alter the asset. Not for advertising" src/lib/newsroom/licence-classes.ts
  grep -F "No rights reserved. Use, adapt, and redistribute freely." src/lib/newsroom/licence-classes.ts
  # expected: each grep returns 1 line (exact match).

  # 6. Scope diff
  git status --short
  # expected: exactly 13 new files under src/lib/newsroom/
  # (7 source + 6 tests). No edits elsewhere except the
  # pre-session untracked files that existed before dispatch.

EXIT REPORT

Required sections:

1. Summary — 13 files with line counts. Break down source
   (7) vs tests (6).

2. Decisions that diverged — blurb drift, type-shape
   adjustments, or any other deviation. Use same halt
   protocol as NR-D1.

3. Open questions for founder.

4. Test results — per-file test counts and pass rates.

5. Build + typecheck results — exit codes; route count
   (expected 93, unchanged from NR-D3).

6. Barrel verification — VERIFY 4 + 5 outputs.

7. Verdict.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Licence classes as a readonly Record.** The single source of truth for PRD Part 2. Every downstream consumer (embed-snippet, receipt-terms, UI selectors, receipt emitter) imports `LICENCE_CLASSES` or `getLicenceClass`. Keeping it as data (not scattered constants) makes v1.1 additions safe and tested.

**D2 — Embed snippet is template-free string construction.** Template engines introduce security and dependency overhead. A 20-line function with a local `escapeHtml` helper is clearer, testable, and dependency-free. Output is canonical HTML per PRD §5.3 J4.

**D3 — Receipt terms as plain text, not HTML.** Receipts live in DB + optional JSON bodies + human-readable displays. Plain text is lowest-common-denominator. P4 UI can wrap lines in paragraphs if needed.

**D4 — State transitions as data, not switch statements.** The 12-row array doubles as documentation, is iterable for tests, and makes the visibility-derivation logic easy to verify against the PRD matrix.

**D5 — Invariants take plain data, not DB rows.** Decouples library from DB client. The NR-D9 RPC assembles `PackPublishInput` from Supabase queries; this library validates. Unit-testable without a DB.

**D6 — Canonical URL helpers are trivially simple.** No regex, no slug validation. DB CHECK constraints already enforce slug shape. These helpers just concatenate.

**D7 — Barrel is pure re-exports, no tests.** The barrel's correctness is that its exports match the source modules. VERIFY 4 sanity-checks this via a runtime import.

**D8 — 6 tests, ~60 assertions total.** Each module gets a dedicated test file. Happy paths + edge cases + HTML escaping + PRD fidelity. Proportional to the risk of each module.

---

## C — Acceptance criteria

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Typecheck exits 0 | VERIFY 1 |
| **AC2** | All 6 test files pass (bun test + vitest run) | VERIFY 2 |
| **AC3** | Build exits 0; route count unchanged (93) | VERIFY 3 |
| **AC4** | Barrel exports all 19 expected symbols | VERIFY 4 |
| **AC5** | PRD blurbs match verbatim | VERIFY 5 |
| **AC6** | Exactly 13 new files under `src/lib/newsroom/`; no edits elsewhere | VERIFY 6 |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D3 exit report approved; commit on `feat/newsroom-phase-nr-1` | Confirmed 2026-04-24 — `50eeeb0` |
| **DC2** | `feat/newsroom-phase-nr-1` is current branch | `git branch --show-current` |
| **DC3** | Build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC4** | `.claude/agents/` reference present | `ls .claude/agents/` |
| **DC5** | `src/lib/newsroom/host.ts` and its test from NR-D3 exist | `ls src/lib/newsroom/` |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D4.** After this directive's exit report clears, **NR-G1 gate closes** and Phase NR-1 is complete. Phase NR-2 (distributor path) begins with NR-D5.
